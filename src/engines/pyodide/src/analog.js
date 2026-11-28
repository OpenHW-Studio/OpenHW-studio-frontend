// Deterministic SPICE-like linear circuit solver: modified nodal analysis,
// backward-Euler capacitors, piecewise-linear diodes and a piecewise-linear
// NPN BJT. This is a small, inspectable engine, not full SPICE.
//
// Sign convention: every reported current is positive when it flows from an
// element's first terminal (a, anode, collector-side, positive source terminal)
// to its second terminal (b, cathode, emitter-side, negative source terminal).
// A voltage source that is *delivering* power therefore has a negative branch
// current; `railCurrent()` returns the positive delivered current.

const EPS = 1e-12;
const PIVOT_EPS = 1e-14;
const MAX_ITERATIONS = 12;
const VALID_TYPES = new Set(['R', 'C', 'D', 'V', 'I', 'E', 'G', 'SW', 'Q']);

export class AnalogSolver {
  constructor() {
    this.reset();
  }

  reset() {
    this.nodeNames = new Map([['GND', 0], ['VDD', 1]]);
    this.nextNode = 2;
    this.elements = new Map();
    this.order = [];
    this.dtUs = 10;
    this.lastVoltages = new Map([[0, 0], [1, 3.3]]);
    this.voltages = new Map([[0, 0], [1, 3.3]]);
    this.lastCurrents = new Map();
    this.accumulatedCharge = new Map();
    this.stats = { iterations: 0, steps: 0, size: 0 };
    this.clampFlags = new Map();
    this.kclResidual = 0;
    this.kclResiduals = new Map();
    return true;
  }

  node(name) {
    const key = String(name).toUpperCase();
    if (!this.nodeNames.has(key)) this.nodeNames.set(key, this.nextNode++);
    return this.nodeNames.get(key);
  }

  hasNode(name) { return this.nodeNames.has(String(name).toUpperCase()); }

  add(type, name, a, b, value, extra = {}) {
    const t = String(type).toUpperCase();
    const key = String(name).toUpperCase();
    if (!VALID_TYPES.has(t)) throw new Error(`analog: unknown element type ${type} (${name})`);
    const v = Number(value);
    if (!Number.isFinite(v)) throw new Error(`analog: ${name}: non-finite value ${value}`);
    if (t === 'R' && v <= 0) throw new Error(`analog: ${name}: resistance must be positive, got ${value}`);
    if (t === 'C' && v < 0) throw new Error(`analog: ${name}: negative capacitance ${value}`);
    if (t === 'Q' && v <= 0) throw new Error(`analog: ${name}: beta must be positive, got ${value}`);
    const num = (x, d) => {
      const n = x === undefined || x === null || x === '' ? d : Number(x);
      if (!Number.isFinite(n)) throw new Error(`analog: ${name}: non-finite parameter ${x}`);
      return n;
    };
    const cNode = (x) => this.node(extra && extra.c !== undefined ? extra.c : 'GND');
    const dNode = (x) => this.node(extra && extra.d !== undefined ? extra.d : 'GND');
    const element = {
      type: t, name: key,
      a: this.node(a), b: this.node(b), value: v,
      // Copy immediately: Python dicts arrive as short-lived JsProxy values.
      extra: {
        vdrop: num(extra && extra.vdrop, 0.7),
        ron: num(extra && extra.ron, 1),
        gain: num(extra && extra.gain, 1),
        beta: num(extra && extra.beta, v),
        vbeOn: num(extra && extra.vbeOn, 0.7),
        rbe: num(extra && extra.rbe, 100),
        vceSat: num(extra && extra.vceSat, 0.2),
        rce: num(extra && extra.rce, 5),
        c: cNode(),
        d: dNode(),
      },
      state: t === 'D' ? true : 'off',
    };
    if (t === 'D' && element.extra.vdrop < 0) throw new Error(`analog: ${name}: negative diode drop`);
    if (t === 'D' && element.extra.ron <= 0) throw new Error(`analog: ${name}: diode on-resistance must be positive`);
    if (t === 'Q' && element.extra.beta <= 0) throw new Error(`analog: ${name}: beta must be positive`);
    if (t === 'Q' && element.extra.vbeOn <= 0) throw new Error(`analog: ${name}: Vbe(on) must be positive`);
    if (t === 'Q' && element.extra.rbe <= 0) throw new Error(`analog: ${name}: base resistance must be positive`);
    if (t === 'Q' && element.extra.rce <= 0) throw new Error(`analog: ${name}: saturation resistance must be positive`);
    this.elements.set(key, element);
    if (!this.order.includes(key)) this.order.push(key);
    return key;
  }

  remove(name) {
    const key = String(name).toUpperCase();
    this.elements.delete(key);
    this.order = this.order.filter((n) => n !== key);
    return true;
  }

  set(name, value) {
    const element = this.elements.get(String(name).toUpperCase());
    if (!element) throw new Error(`no analog element ${name}`);
    const v = Number(value);
    if (!Number.isFinite(v)) throw new Error(`analog: ${name}: non-finite value ${value}`);
    if (element.type === 'C' && v < 0) throw new Error(`analog: ${name}: negative capacitance ${value}`);
    if (element.type === 'R' && v <= 0) throw new Error(`analog: ${name}: resistance must be positive`);
    element.value = v;
    return v;
  }

  get(name) {
    return this.elements.get(String(name).toUpperCase()) || null;
  }

  voltage(name) {
    if (!this.hasNode(name)) return 0;
    return Number(this.voltages.get(this.node(name)) || 0);
  }

  current(name) {
    return Number(this.lastCurrents.get(String(name).toUpperCase()) || 0);
  }

  charge(name) {
    return Number(this.accumulatedCharge.get(String(name).toUpperCase()) || 0);
  }

  railCurrent() { return -this.current('VDD_RAIL'); }

  _solveLinear(G, b) {
    const n = b.length;
    const M = G.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let pivot = col;
      let scale = 0;
      for (let r = col; r < n; r++) {
        const mag = Math.abs(M[r][col]);
        if (!Number.isFinite(mag)) throw new Error('analog: non-finite matrix entry (invalid element value)');
        if (mag > Math.abs(M[pivot][col])) pivot = r;
        if (mag > scale) scale = mag;
      }
      // A zero (or numerically zero) pivot means a floating node or two
      // conflicting ideal voltage sources. Report it instead of inventing a
      // small conductance and printing a plausible but wrong answer.
      if (Math.abs(M[pivot][col]) < PIVOT_EPS || Math.abs(M[pivot][col]) < 1e-12 * scale) {
        throw new Error('analog: singular matrix (floating node, no path to ground, or conflicting voltage sources)');
      }
      if (pivot !== col) [M[pivot], M[col]] = [M[col], M[pivot]];
      const diag = M[col][col];
      for (let c = col; c <= n; c++) M[col][c] /= diag;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const factor = M[r][col];
        if (Math.abs(factor) < EPS) continue;
        for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
      }
    }
    const out = M.map((row) => row[n]);
    if (out.some((x) => !Number.isFinite(x))) throw new Error('analog: non-finite solution (invalid element value)');
    return out;
  }

  _diodeState(e, va, thresholdScale) {
    const vdrop = e.extra.vdrop;
    // Hysteresis: turn on at Vd, stay on down to 0.6*Vd. Without it a diode
    // can flap between iterations and never converge.
    return e.state ? va >= vdrop * 0.6 * thresholdScale : va >= vdrop * thresholdScale;
  }

  _bjtState(e, vbe, vce) {
    const { vbeOn, vceSat, rce } = e.extra;
    const satExit = vceSat + Math.max(0.05, 0.02 * rce);
    if (e.state === 'off') {
      if (vbe < vbeOn) return 'off';
      return vce <= vceSat ? 'sat' : 'active';
    }
    if (vbe < vbeOn * 0.9) return 'off';
    if (e.state === 'active') return vce <= vceSat ? 'sat' : 'active';
    return vce > satExit ? 'active' : 'sat';
  }

  solve(dtUs = this.dtUs, railVolts = 3.3) {
    const dt = Math.max(1e-9, Number(dtUs) * 1e-6);
    this.dtUs = Number(dtUs);
    this.lastVoltages = new Map(this.voltages);
    const working = new Map(this.lastVoltages);
    this.lastCurrents.clear();

    // Ground is the reference: it is not an unknown in the MNA system.
    const unknowns = [...this.nodeNames.entries()].filter(([, idx]) => idx !== 0);
    const nodeIndex = new Map(unknowns.map(([, idx], i) => [idx, i]));
    const idx = (node) => (node === 0 ? -1 : nodeIndex.get(node));
    const byNode = new Map([...this.nodeNames].map(([name, i2]) => [i2, name]));

    const extraRows = [];
    for (const key of this.order) {
      const e = this.elements.get(key);
      if (e.type === 'V' || e.type === 'E' || e.type === 'D') extraRows.push([key, 1]);
      else if (e.type === 'Q') extraRows.push([key, 2]);
    }
    const extraIndex = new Map();
    let row = unknowns.length;
    for (const [key, count] of extraRows) { extraIndex.set(key, row); row += count; }
    const size = row;
    const voltageAt = (map, node) => (node ? (map.get(node) || 0) : 0);
    const prev = (iNode, jNode) => voltageAt(this.lastVoltages, iNode) - voltageAt(this.lastVoltages, jNode);

    let iterations = 0;
    let result = null;
    let converged = false;
    for (; iterations < MAX_ITERATIONS; iterations++) {
      const G = Array.from({ length: size }, () => Array(size).fill(0));
      const b = Array(size).fill(0);
      const stampG = (iNode, jNode, g) => {
        const i = idx(iNode); const j = idx(jNode);
        if (i >= 0) { G[i][i] += g; if (j >= 0) G[i][j] -= g; }
        if (j >= 0) { G[j][j] += g; if (i >= 0) G[j][i] -= g; }
      };
      const stampI = (iNode, jNode, current) => {
        const i = idx(iNode); const j = idx(jNode);
        if (i >= 0) b[i] += current;
        if (j >= 0) b[j] -= current;
      };
      const prevIter = (iNode, jNode) => voltageAt(working, iNode) - voltageAt(working, jNode);
      const branch = (rw, a, c, value) => {
        const ia = idx(a); const ic = idx(c);
        if (ia >= 0) { G[ia][rw] += 1; G[rw][ia] += 1; }
        if (ic >= 0) { G[ic][rw] -= 1; G[rw][ic] -= 1; }
        b[rw] += value;
      };

      const stampedStates = new Map();
      for (const key of this.order) {
        const e = this.elements.get(key);
        const { a, b: c } = e;
        switch (e.type) {
          case 'R':
            stampG(a, c, 1 / e.value);
            break;
          case 'SW':
            stampG(a, c, e.value ? 1 / 1e-3 : 1 / 1e9);
            break;
          case 'C': {
            const g = Math.max(EPS, e.value / dt);
            stampG(a, c, g);
            stampI(a, c, g * prev(a, c));
            break;
          }
          case 'I':
            // stampI() injects into its first node; a positive I-source value
            // flows a -> c, so the injection at a is negative.
            stampI(a, c, -e.value);
            break;
          case 'V':
            branch(extraIndex.get(key), a, c, e.value);
            break;
          case 'E': {
            // Dependent source: the branch has no independent voltage; the
            // control appears in the constraint row, not the RHS.
            branch(extraIndex.get(key), a, c, 0);
            const r = extraIndex.get(key);
            const cc = idx(e.extra.c); const dd = idx(e.extra.d);
            G[r][cc] -= e.extra.gain;
            if (dd >= 0) G[r][dd] += e.extra.gain;
            break;
          }
          case 'G': {
            const cc = idx(e.extra.c); const dd = idx(e.extra.d);
            const ia = idx(a); const ic = idx(c);
            if (cc >= 0) {
              if (ia >= 0) G[ia][cc] += e.extra.gain;
              if (ic >= 0) G[ic][cc] -= e.extra.gain;
            }
            if (dd >= 0) {
              if (ia >= 0) G[ia][dd] -= e.extra.gain;
              if (ic >= 0) G[ic][dd] += e.extra.gain;
            }
            break;
          }
          case 'D': {
            const r = extraIndex.get(key);
            const next = this._diodeState(e, prevIter(a, c), 1);
            stampedStates.set(key, next);
            e.state = next;
            if (!next) { G[r][r] = 1; break; }
            branch(r, a, c, e.extra.vdrop);
            G[r][r] -= e.extra.ron;
            break;
          }
          case 'Q': {
            const r = extraIndex.get(key);
            const base = e.extra.c; const emitter = c;
            const next = this._bjtState(e, prevIter(base, emitter), prevIter(a, emitter));
            stampedStates.set(key, next);
            e.state = next;
            if (next === 'off') {
              G[r][r] = 1;
              G[r + 1][r + 1] = 1;
              break;
            }
            // Base-emitter PWL branch: Vbe = Vbe(on) + rbe * Ibe.
            branch(r, base, emitter, e.extra.vbeOn);
            G[r][r] -= e.extra.rbe;
            // Collector-emitter branch; its equation is either
            // Ic = beta*Ibe (active) or Vce = Vce(sat) + rce*Ic (saturation).
            branch(r + 1, a, emitter, next === 'sat' ? e.extra.vceSat : 0);
            if (next === 'sat') G[r + 1][r + 1] -= e.extra.rce;
            else G[r + 1][r] -= e.extra.beta;
            break;
          }
          default:
            break;
        }
      }
      result = this._solveLinear(G, b);
      for (const [node, i2] of nodeIndex) working.set(node, result[i2] || 0);

      // Decide the next PWL region from the freshly solved voltages and keep
      // iterating only while a region actually changes.
      let changed = false;
      for (const key of this.order) {
        const e = this.elements.get(key);
        let next = null;
        if (e.type === 'D') {
          next = this._diodeState({ ...e, state: stampedStates.get(key) },
            (result[idx(e.a)] || 0) - (e.b ? (result[idx(e.b)] || 0) : 0), 1);
        } else if (e.type === 'Q') {
          const vc = result[idx(e.a)] || 0;
          const ve = e.b ? (result[idx(e.b)] || 0) : 0;
          const vb = e.extra.c ? (result[idx(e.extra.c)] || 0) : 0;
          next = this._bjtState({ ...e, state: stampedStates.get(key) }, vb - ve, vc - ve);
        }
        if (next !== null && next !== stampedStates.get(key)) changed = true;
        if (next !== null) e.state = next;
      }
      if (!changed) { iterations += 1; converged = true; break; }
    }
    if (!converged) {
      throw new Error(`analog: piecewise-linear iteration did not converge after ${MAX_ITERATIONS} iterations`);
    }
    iterations = Math.max(1, iterations);
    this.voltages.set(0, 0);
    for (const [node, i2] of nodeIndex) this.voltages.set(node, result[i2] || 0);

    // Currents, with an explicit, documented sign convention.
    const currents = new Map();
    for (const key of this.order) {
      const e = this.elements.get(key);
      const va = this.voltage(byNode.get(e.a));
      const vb = this.voltage(byNode.get(e.b));
      const diff = va - vb;
      let value = 0;
      switch (e.type) {
        case 'R': value = diff / e.value; break;
        case 'SW': value = diff * (e.value ? 1 / 1e-3 : 1 / 1e9); break;
        case 'C': value = Math.max(EPS, e.value / dt) * (diff - prev(e.a, e.b)); break;
        case 'I': value = e.value; break;
        case 'V': case 'E': case 'D': value = result[extraIndex.get(key)] || 0; break;
        case 'G': value = e.extra.gain * (this.voltage(byNode.get(e.extra.c)) - this.voltage(byNode.get(e.extra.d))); break;
        case 'Q': {
          if (e.state === 'off') break;
          currents.set(`${key}:B`, result[extraIndex.get(key)] || 0);
          currents.set(`${key}:C`, result[extraIndex.get(key) + 1] || 0);
          value = currents.get(`${key}:C`);
          break;
        }
        default: break;
      }
      currents.set(key, value);
    }
    this.lastCurrents = currents;

    // Integral of each element current over this timestep (coulombs).
    for (const [key, value] of currents) {
      this.accumulatedCharge.set(key, (this.accumulatedCharge.get(key) || 0) + value * dt);
    }

    // Kirchhoff current residual: sum of outgoing currents at every node.
    const residuals = new Map([...this.nodeNames.keys()].filter((n) => n !== 'GND').map((n) => [n, 0]));
    const accumulate = (nodeIndexId, value) => {
      const name = byNode.get(nodeIndexId);
      if (residuals.has(name)) residuals.set(name, residuals.get(name) + value);
    };
    for (const key of this.order) {
      const e = this.elements.get(key);
      if (e.type === 'Q' && e.state !== 'off') {
        accumulate(e.extra.c, currents.get(`${key}:B`));
        accumulate(e.b, -(currents.get(`${key}:B`)));
        accumulate(e.a, currents.get(`${key}:C`));
        accumulate(e.b, -(currents.get(`${key}:C`)));
      } else {
        const value = currents.get(key) || 0;
        accumulate(e.a, value);
        accumulate(e.b, -value);
      }
    }
    this.kclResiduals = residuals;
    this.kclResidual = Math.max(0, ...[...residuals.values()].map(Math.abs));
    this.stats = { iterations, steps: this.stats.steps + 1, size: this.nodeNames.size - 1 };
    return Object.fromEntries([...this.nodeNames].map(([name, index]) => [name, this.voltages.get(index) || 0]));
  }

  // Time series of a node voltage (`V:NODE` / node name) or element current
  // (`I:ELEM` / element name). Each solve advances the capacitor state.
  trace(target, durationMs, dtUs = this.dtUs, railVolts = 3.3) {
    let name = String(target).toUpperCase();
    let kind = null;
    if (/^V[:()]/.test(name)) { kind = 'voltage'; name = name.slice(2).replace(/\)$/, ''); }
    else if (/^I[:()]/.test(name)) { kind = 'current'; name = name.slice(2).replace(/\)$/, ''); }
    if (!kind) kind = this.hasNode(name) ? 'voltage' : (this.elements.has(name) ? 'current' : null);
    if (!kind) throw new Error(`analog: trace target ${target} is neither a node nor an element`);
    const dt = Math.max(1, Number(dtUs) || 10);
    const steps = Math.max(1, Math.round((Number(durationMs) || 0) * 1000 / dt));
    const series = [];
    for (let i = 0; i <= steps; i++) {
      if (i > 0) this.solve(dt, railVolts);
      series.push({
        t_us: i * dt,
        target: name,
        kind,
        value: kind === 'voltage' ? this.voltage(name) : this.current(name),
      });
    }
    return series;
  }

  summary() {
    const nodes = {};
    for (const [name, index] of this.nodeNames) nodes[name] = Number((this.voltages.get(index) || 0).toFixed(6));
    const currents = {};
    for (const [name, value] of this.lastCurrents) currents[name] = Number(value.toFixed(9));
    const charges = {};
    for (const [name, value] of this.accumulatedCharge) charges[name] = Number(value.toFixed(12));
    const kclResiduals = {};
    for (const [name, value] of this.kclResiduals) kclResiduals[name] = Number(value.toExponential(3));
    return {
      dtUs: this.dtUs, nodes, currents, charges,
      kclResidual: Number(this.kclResidual.toExponential(3)), kclResiduals,
      iterations: this.stats.iterations, steps: this.stats.steps, size: this.stats.size,
      elements: this.order.map((name) => {
        const e = this.elements.get(name);
        return { name, type: e.type, value: e.value, state: e.state };
      }),
      clampFlags: Object.fromEntries(this.clampFlags),
    };
  }
}

export default AnalogSolver;
