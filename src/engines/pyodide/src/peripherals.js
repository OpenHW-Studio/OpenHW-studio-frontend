import { AnalogSolver } from './analog.js';

// Lightweight board-level peripheral models for a Pyodide-driven Raspberry Pi.
// This is NOT ARM/Linux emulation: Python code calls these models through a
// thin bridge, and simulated time is advanced explicitly (fast-forward).
// All device behaviour is deterministic and inspectable from tests.

const GPIO_PINS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
  18, 19, 20, 21, 22, 23, 24, 25, 26, 27];
const LEGACY_PWM_PINS = [12, 13, 18, 19];

// These are model profiles, not a Linux/ARM machine description. Values are
// representative of the real boards so guest code sees board-specific limits.
export const BOARDS = {
  pi3: {
    name: 'Raspberry Pi 3 B+', soc: 'BCM2837',
    gpio: GPIO_PINS.slice(), pwmPins: LEGACY_PWM_PINS.slice(),
    i2cBuses: [0, 1], spiBuses: [0, 1], optionalSpiBuses: [],
    cpuClockMHz: 1200, pwmClockHz: 540000000, spiMaxHz: 32000000,
    cpuTempC: 45, pullUpOhms: 1800,
    vddVolts: 3.3, viL: 0.8, viH: 2.0, maxInputVolts: 3.3,
    driveStrengthmA: [2, 4, 8], slewMs: 3, debounceMs: 5, netOctet: 11,
    pinCapacitancePF: 20, pwmWindowMs: 20, cameraSensor: 'OV5647',
    onboardLed: { PWR: 'red', ACT: 'green' },
  },
  pi4: {
    name: 'Raspberry Pi 4 B', soc: 'BCM2711',
    gpio: GPIO_PINS.slice(), pwmPins: LEGACY_PWM_PINS.slice(),
    i2cBuses: [0, 1], spiBuses: [0, 1], optionalSpiBuses: [2],
    cpuClockMHz: 1500, pwmClockHz: 540000000, spiMaxHz: 125000000,
    cpuTempC: 50, pullUpOhms: 1800,
    vddVolts: 3.3, viL: 0.8, viH: 2.0, maxInputVolts: 3.3,
    driveStrengthmA: [2, 4, 8], slewMs: 3, debounceMs: 5, netOctet: 24,
    pinCapacitancePF: 20, pwmWindowMs: 20, cameraSensor: 'IMX219',
    onboardLed: { PWR: 'red', ACT: 'green' },
  },
  pi5: {
    name: 'Raspberry Pi 5', soc: 'BCM2712 + RP1',
    // RP1 function select exposes PWM on every header GPIO, not just the
    // four legacy BCM PWM pins.
    gpio: GPIO_PINS.slice(), pwmPins: GPIO_PINS.slice(),
    i2cBuses: [0, 1], spiBuses: [0, 1], optionalSpiBuses: [],
    cpuClockMHz: 2400, pwmClockHz: 200000000, spiMaxHz: 200000000,
    cpuTempC: 55, pullUpOhms: 50000,
    vddVolts: 3.3, viL: 0.7, viH: 2.1, maxInputVolts: 3.3,
    driveStrengthmA: [2, 4, 8, 12], slewMs: 1, debounceMs: 2, netOctet: 42,
    pinCapacitancePF: 12, pwmWindowMs: 20, cameraSensor: 'IMX708',
    onboardLed: { PWR: 'green', ACT: 'green' },
  },
};

const arr = (x) => Array.from(x || []);

export class Peripherals {
  constructor(board = 'pi4') {
    this.generation = 0;
    this.reset(board);
  }

  reset(board = this.board || 'pi4') {
    this.generation = (this.generation || 0) + 1;
    if (!BOARDS[board]) throw new Error(`unknown board: ${board}`);
    this.board = board;
    this.profile = BOARDS[board];
    this.clockMs = 0;
    this.gpio = new Map();
    for (const pin of this.profile.gpio) {
      this.gpio.set(pin, { pin, mode: 'in', level: false, pull: 'none', driven: null, volts: 0.0,
        targetVolts: 0.0, settledVolts: 0.0, settledAtMs: 0, slewMs: 1, overCurrent: false,
        capacitancePF: this.profile.pinCapacitancePF });
    }
    this.edges = [];
    this.i2c = new Map();
    for (const bus of this.profile.i2cBuses) this.i2c.set(bus, new Map());
    this.spi = new Map();
    for (const bus of this.profile.spiBuses) this.spi.set(bus, new Map());
    this.pwm = new Map();
    this.adc = Array(8).fill(0);
    this.uartTx = '';
    this.uartRx = '';
    this.errors = [];
    this.leds = {};
    for (const [name, color] of Object.entries(this.profile.onboardLed)) {
      this.leds[name] = { color, on: false };
    }
    this.onewire = new Map();
    this.dht = new Map();
    this.neopixels = new Map();
    this.lcds = {};
    this.cpuTempOverride = null;
    this.camera = { sensor: this.profile.cameraSensor, width: 64, height: 48,
      captures: 0, lastChecksum: 0 };
    this.analog = new AnalogSolver();
    this.analog.add('V', 'VDD_RAIL', 'VDD', 'GND', this.profile.vddVolts);
    this.analogPinNodes = new Map();
    this.adcNodes = new Map();
    this.environment = {
      tempC: 23.5, mcpTempC: 25, humidity: 50, pressureHPa: 1000,
      lux: 416.67, accel: [1, 0, 1], gyro: [0, 0, 0],
      busVoltage: 4.0, current: 1.0, distanceM: 0.5,
      onewireConversionMs: 750, sampleMs: 0,
    };
    this.onewireState = new Map();
    this.dhtState = new Map();
    this.config = { i2cArm: true, spi: true, uart: true, overlays: [] };
    this.net = {
      interfaces: {
        lo: '127.0.0.1',
        eth0: `10.0.0.${this.profile.netOctet}`,
        wlan0: `192.168.1.${this.profile.netOctet}`,
      },
      services: {}, mqttSubs: [], mqttQueue: [], traffic: [],
      dns: {}, sockets: {}, connections: {}, packets: [], pending: [],
      socketSeq: 0, connSeq: 0,
    };
    this.net.dns = {
      localhost: '127.0.0.1',
      'raspberrypi.local': this.net.interfaces.eth0,
      'pi.local': this.net.interfaces.wlan0,
    };
    this.installDefaultDevices();
    return this;
  }

  installDefaultDevices() {
    // EEPROM at 0x50: write sets the register pointer, read streams the image.
    const eeprom = () => {
      const regs = new Uint8Array(256);
      let ptr = 0;
      return {
        kind: 'eeprom', regs,
        write(bytes) { if (bytes.length) { ptr = bytes[0] & 0xff; for (let i = 1; i < bytes.length; i++) regs[(ptr + i - 1) & 0xff] = bytes[i] & 0xff; } },
        read(n) { const out = []; for (let i = 0; i < n; i++) out.push(regs[(ptr + i) & 0xff]); return out; },
      };
    };
    // SSD1306-like display: every write is captured for framebuffer assertions.
    const oled = () => {
      const state = { kind: 'ssd1306', writes: [], buffer: new Uint8Array(1024), lastCommand: 0 };
      state.write = (bytes) => {
        const b = arr(bytes);
        state.writes.push(b.slice());
        if (b.length && (b[0] & 0xfe) === 0x00) state.lastCommand = b[0];
        // Data writes (0x40) fill the framebuffer in order.
        if (b.length > 1 && b[0] === 0x40) {
          for (let i = 1; i < b.length; i++) state.buffer[(state.framePtr + i - 1) % 1024] = b[i] & 0xff;
          state.framePtr = (state.framePtr + b.length - 1) % 1024;
        }
      };
      state.framePtr = 0;
      state.read = () => [0x00];
      return state;
    };
    // Temperature sensor at 0x18: two-byte big-endian register 0x05.
    const temp = () => {
      const regs = new Uint8Array(16);
      regs[5] = 25; regs[6] = 0;
      return {
        kind: 'mcp9808', regs,
        write(bytes) { if (bytes.length) this.ptr = bytes[0] & 0x0f; },
        read(n) { const out = []; for (let i = 0; i < n; i++) out.push(regs[((this.ptr || 0) + i) & 0x0f]); return out; },
      };
    };
    for (const bus of this.profile.i2cBuses) {
      this.i2c.get(bus).set(0x50, eeprom());
      if (bus === 1) {
        this.i2c.get(bus).set(0x3c, oled());
        this.i2c.get(bus).set(0x18, temp());
      }
    }
    // SPI device 0: generic register file (address byte, then data).
    // SPI device 1: MAX7219-like shift register; last 8 bytes are the matrix.
    for (const bus of this.profile.spiBuses) {
      const regs = new Uint8Array(256);
      this.spi.get(bus).set(0, {
        kind: 'regfile', regs,
        xfer(bytes) {
          const b = arr(bytes); if (!b.length) return [];
          const a = b[0] & 0xff;
          if (b.length === 1) return [regs[a]];
          if (a & 0x80) { for (let i = 1; i < b.length; i++) regs[((a & 0x7f) + i - 1) & 0xff] = b[i] & 0xff; return b.slice(); }
          const out = [a]; for (let i = 1; i < b.length; i++) out.push(regs[(a + i - 1) & 0xff]);
          return out;
        },
      });
      this.spi.get(bus).set(1, {
        kind: 'shift', matrix: new Uint8Array(8),
        xfer(bytes) { const b = arr(bytes); for (let i = 0; i < b.length; i++) this.matrix[i % 8] = b[i] & 0xff; return b.slice(); },
      });
    }
  }

  // ---- GPIO ----
  _pin(pin) {
    const p = Number(pin);
    if (!this.gpio.has(p)) throw new Error(`invalid GPIO ${pin} on ${this.board}`);
    return this.gpio.get(p);
  }

  gpioSetup(pin, mode, pull = 'none') {
    const p = this._pin(pin);
    p.mode = mode === 'out' || mode === 1 || mode === 'OUTPUT' ? 'out' : 'in';
    p.pull = ['up', 'PUD_UP'].includes(pull) ? 'up' : ['down', 'PUD_DOWN'].includes(pull) ? 'down' : 'none';
    if (p.mode === 'in') {
      p.level = p.pull === 'up';
      p.volts = p.pull === 'up' ? this.profile.vddVolts : 0.0;
      p.driven = null;
      p.targetVolts = p.volts;
      p.settledVolts = p.volts;
      p.overCurrent = false;
    }
    return true;
  }

  _emit(p, level, source) {
    const before = p.level;
    p.level = !!level;
    if (before === p.level) return;
    const edge = p.level ? 'rising' : 'falling';
    this.edges.push({
      pin: p.pin, level: p.level, edge, source, t: this.clockMs,
      volts: p.volts, slewMs: this.profile.slewMs, debounceMs: this.profile.debounceMs,
    });
    if (this.edges.length > 4096) this.edges.shift();
  }

  gpioWrite(pin, value) {
    const p = this._pin(pin);
    if (p.mode !== 'out') this.errors.push(`write to GPIO ${pin} while not output`);
    p.volts = value ? this.profile.vddVolts : 0.0;
    this.analogSetDrive(pin, p.volts);
    this._emit(p, !!value, 'guest');
    return p.level;
  }

  gpioRead(pin) {
    const p = this._pin(pin);
    if (p.mode === 'out' || p.driven !== null) return p.level ? 1 : 0;
    return p.pull === 'up' ? 1 : 0;
  }

  gpioDrive(pin, level) {
    return this.gpioDriveVoltage(pin, level ? this.profile.vddVolts : 0.0);
  }

  // Voltage-level input with deterministic threshold logic. GPIOs are NOT 5 V
  // tolerant on any of the three boards, so over-voltage is rejected.
  gpioDriveVoltage(pin, volts) {
    const p = this._pin(pin);
    const v = Number(volts);
    if (!Number.isFinite(v)) throw new Error(`invalid voltage ${volts}`);
    if (v < -0.1 || v > this.profile.maxInputVolts + 0.001) {
      throw new Error(`GPIO ${pin}: ${v} V exceeds ${this.profile.maxInputVolts} V (GPIO is not 5 V tolerant)`);
    }
    p.volts = Math.max(0, Math.min(this.profile.maxInputVolts, v));
    const maxMA = Math.max(...this.profile.driveStrengthmA);
    const delta = Math.abs(p.volts - p.targetVolts);
    p.slewMs = Math.max(1, Math.ceil((p.capacitancePF * delta) / (maxMA * 1000)));
    const nominalCurrentMA = p.capacitancePF * delta / (this.profile.slewMs * 1000);
    p.overCurrent = nominalCurrentMA > maxMA;
    p.targetVolts = p.volts;
    this.analogSetDrive(pin, p.volts);
    p.settledAtMs = this.clockMs + p.slewMs;
    const level = p.volts >= this.profile.viH;
    p.driven = level;
    this._emit(p, level, 'device');
    return p.level ? 1 : 0;
  }

  // ---- 1-Wire DS18B20 command protocol ----
  onewireReset(pin) {
    const p = Number(pin);
    this._pin(p);
    const rom = [0x28, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x00];
    this.onewireState.set(p, { cmd: null, queue: [], match: [], rom, busyUntil: 0 });
    return true;
  }
  onewireWriteByte(pin, byte) {
    const p = Number(pin);
    const st = this.onewireState.get(p) || (this.onewireReset(p), this.onewireState.get(p));
    const b = Number(byte) & 0xff;
    if (st.cmd === 'match') {
      st.match.push(b);
      if (st.match.length === 8) st.cmd = 'matched';
      return true;
    }
    switch (b) {
      case 0x33: st.cmd = 'rom'; st.queue = st.rom.slice(); break;
      case 0xcc: st.cmd = 'skip'; break;
      case 0x55: st.cmd = 'match'; st.match = []; break;
      case 0x44: st.cmd = 'convert'; st.busyUntil = this.clockMs + this.environment.onewireConversionMs; break;
      case 0xbe: {
        st.cmd = 'scratch';
        const sensor = this.onewire.get(p);
        const temp = sensor ? sensor.tempC : this.environment.tempC;
        const raw = Math.round(temp * 16) & 0xffff;
        st.queue = [raw >> 8, raw & 0xff, 0x4b, 0x46, 0x7f, 0xff, 0x10, 0x00, 0xce];
        break;
      }
      default: break;
    }
    return true;
  }
  onewireReadByte(pin) {
    const st = this.onewireState.get(Number(pin));
    return st && st.queue.length ? st.queue.shift() : 0xff;
  }
  onewireBusy(pin) {
    const st = this.onewireState.get(Number(pin));
    return !!st && this.clockMs < st.busyUntil;
  }

  // ---- DHT22 waveform ----
  dhtWaveform(pin) {
    const p = Number(pin);
    const sensor = this.dht.get(p);
    const temp = sensor ? sensor.tempC : this.environment.tempC;
    const humidity = sensor ? sensor.humidity : this.environment.humidity;
    const rawH = Math.max(0, Math.min(65535, Math.round(humidity * 10)));
    const rawT = Math.max(0, Math.min(65535, Math.round(temp * 10)));
    const bits = [];
    for (const value of [rawH, rawT]) {
      for (let i = 15; i >= 0; i--) bits.push((value >> i) & 1);
    }
    bits.push((((rawH >> 8) + (rawH & 0xff) + (rawT >> 8) + (rawT & 0xff)) >> 0) & 1);
    return JSON.stringify({ startUs: 1000, responseUs: 80, bitUs: 50, bits });
  }

  // ---- HC-SR04 behavioural echo timing ----
  hcsr04Measure(trigger, echo) {
    const triggerEdges = this.gpioEdges(trigger, 'falling');
    const start = triggerEdges.length ? triggerEdges[triggerEdges.length - 1].t : 0;
    const edges = this.edges.filter((e) => e.pin === Number(echo) && e.t >= start);
    const rise = edges.find((e) => e.edge === 'rising');
    const fall = edges.find((e) => e.edge === 'falling' && rise && e.t >= rise.t);
    if (!rise || !fall) return null;
    const speed = 331.3 + 0.606 * this.environment.tempC;
    return Number(((fall.t - rise.t) / 1000.0 * speed / 2.0).toFixed(5));
  }

  // ---- SPICE-like analogue core ----
  analogReset() {
    this.analog.reset();
    this.analog.add('V', 'VDD_RAIL', 'VDD', 'GND', this.profile.vddVolts);
    this.analogPinNodes.clear();
    this.adcNodes.clear();
    return true;
  }
  analogEnsurePin(pin) {
    const p = this._pin(pin);
    const key = `P${p.pin}`;
    if (this.analogPinNodes.has(p.pin)) return key;
    const source = `DRV${p.pin}`;
    this.analog.node(key);
    this.analog.node(source);
    const driveMA = Math.max(...this.profile.driveStrengthmA);
    this.analog.add('V', `VDRV${p.pin}`, source, 'GND', 0);
    this.analog.add('R', `RDRV${p.pin}`, source, key, this.profile.vddVolts / (driveMA / 1000));
    this.analog.add('C', `CPIN${p.pin}`, key, 'GND', this.profile.pinCapacitancePF * 1e-12);
    this.analog.add('R', `PULL${p.pin}`, key, p.pull === 'down' ? 'GND' : 'VDD',
      p.pull === 'none' ? 1e12 : this.profile.pullUpOhms);
    this.analog.add('D', `CLAMPHI${p.pin}`, key, 'VDD', 0.3, { vdrop: 0.3, ron: 1 });
    this.analog.add('D', `CLAMPLO${p.pin}`, 'GND', key, 0.3, { vdrop: 0.3, ron: 1 });
    this.analogPinNodes.set(p.pin, key);
    return key;
  }
  analogSetDrive(pin, volts) {
    const key = `VDRV${Number(pin)}`;
    if (this.analog.get(key)) this.analog.set(key, volts);
  }
  analogAttachPin(pin) { return this.analogEnsurePin(pin); }
  analogAttachAdc(channel, node) {
    const c = Number(channel);
    if (c < 0 || c > 7) throw new Error(`invalid ADC channel ${channel}`);
    this.adcNodes.set(c, String(node).toUpperCase());
    return this.adcNodes.get(c);
  }
  adcSolved16(channel) {
    const c = Number(channel);
    const node = this.adcNodes.get(c);
    if (!node) throw new Error(`no analogue network on ADC channel ${c}`);
    const volts = Math.max(0, Math.min(this.profile.vddVolts, this.analog.voltage(node)));
    return Math.round(volts * 65535 / this.profile.vddVolts);
  }
  adcSolved(channel) {
    const c = Number(channel);
    const node = this.adcNodes.get(c);
    if (!node) throw new Error(`no analogue network on ADC channel ${channel}`);
    const volts = Math.max(0, Math.min(this.profile.vddVolts, this.analog.voltage(node)));
    return Math.round(volts * 1023 / this.profile.vddVolts);
  }
  analogSetTimestep(us) { this.analog.dtUs = Math.max(1, Number(us) || 10); return this.analog.dtUs; }
  analogSolve(dtUs) { return this.analog.solve(dtUs, this.profile.vddVolts); }
  analogVoltage(node) { return this.analog.voltage(node); }
  analogCurrent(name) { return this.analog.current(name); }
  analogCharge(name) { return this.analog.charge(name); }
  analogHasNode(name) { return this.analog.hasNode(name); }
  analogKcl() {
    return { residual: this.analog.kclResidual, residuals: Object.fromEntries(this.analog.kclResiduals) };
  }
  // Positive when the rail is delivering current into the circuit.
  analogRailCurrent() { return this.analog.railCurrent(); }
  // Positive when the pin driver sources current into the pin; negative when
  // the pin sinks current from an external network.
  analogPinCurrent(pin) {
    const key = `RDRV${Number(pin)}`;
    const e = this.analog.get(key);
    if (!e) throw new Error(`GPIO ${pin} has no analogue driver; call analog.attach(pin) first`);
    return (this.analog.voltage(`DRV${Number(pin)}`) - this.analog.voltage(`P${Number(pin)}`)) / e.value;
  }
  analogTrace(target, durationMs, dtUs) {
    return this.analog.trace(target, durationMs, dtUs === undefined ? this.analog.dtUs : dtUs,
      this.profile.vddVolts);
  }
  analogSummary() {
    const summary = this.analog.summary();
    summary.pinNodes = Object.fromEntries(this.analogPinNodes);
    summary.adcNodes = Object.fromEntries(this.adcNodes);
    return summary;
  }
  analogStep(ms) {
    if (this.analogPinNodes.size === 0 && this.adcNodes.size === 0) return null;
    const totalUs = Math.max(0, Number(ms) || 0) * 1000;
    if (totalUs <= 0) return null;
    const steps = Math.min(200, Math.max(1, Math.ceil(totalUs / Math.max(1, this.analog.dtUs))));
    const stepUs = totalUs / steps;
    for (let i = 0; i < steps; i++) this.analog.solve(stepUs, this.profile.vddVolts);
    return this.analog.summary();
  }

  electricalSetCapacitance(pin, pf) {
    const p = this._pin(pin);
    p.capacitancePF = Math.max(1, Number(pf) || 1);
    return p.capacitancePF;
  }
  settledVoltage(pin) { return this._pin(pin).settledVolts; }
  overCurrent(pin) { return !!this._pin(pin).overCurrent; }
  settleElectrical() {
    for (const p of this.gpio.values()) {
      if (p.driven !== null && this.clockMs >= p.settledAtMs) p.settledVolts = p.targetVolts;
    }
    return this.clockMs;
  }

  gpioVoltage(pin) {
    const p = this._pin(pin);
    if (p.mode === 'out' || p.driven !== null) return p.volts;
    return p.pull === 'up' ? this.profile.vddVolts : 0.0;
  }

  adcReadNoisy(channel) {
    const base = this.adcRead(channel);
    // Deterministic +/-1 LSB dither keyed by channel and virtual time.
    const noise = ((Math.floor(this.clockMs) + Number(channel)) % 3) - 1;
    return Math.max(0, Math.min(1023, base + noise));
  }

  pwmVoltage(pin) {
    const c = this.pwm.get(Number(pin));
    if (!c) throw new Error(`no PWM channel on GPIO ${pin}`);
    return this.profile.vddVolts * c.dutyPercent / 100.0;
  }
  pwmAverageVoltage(pin, windowMs = this.profile.pwmWindowMs) {
    const c = this.pwm.get(Number(pin));
    if (!c) throw new Error(`no PWM channel on GPIO ${pin}`);
    const window = Math.max(1, Number(windowMs) || this.profile.pwmWindowMs);
    const from = this.clockMs - window;
    let area = 0;
    let lastT = from;
    let duty = 0;
    for (const sample of c.samples || []) {
      if (sample.t <= from) { duty = sample.duty; continue; }
      if (sample.t > this.clockMs) break;
      area += (sample.t - lastT) * duty;
      lastT = sample.t;
      duty = sample.duty;
    }
    area += (this.clockMs - lastT) * duty;
    return this.profile.vddVolts * (area / window) / 100.0;
  }

  gpioRelease(pin) { this._pin(pin).driven = null; return true; }

  gpioEdges(pin, edge = 'both', afterIndex = 0) {
    const p = Number(pin);
    return this.edges.slice(afterIndex).filter((e) => e.pin === p && (edge === 'both' || edge === e.edge));
  }

  gpioEventCount(pin, edge = 'both') { return this.gpioEdges(pin, edge).length; }
  edgeCount() { return this.edges.length; }
  edgesSince(after = 0) { return this.edges.slice(after); }

  // ---- I2C ----
  i2cDevice(bus, addr) {
    if (Number(bus) === 1 && !this.config.i2cArm) {
      throw new Error('I2C bus 1 is disabled (dtparam=i2c_arm=off)');
    }
    const b = this.i2c.get(Number(bus));
    if (!b) throw new Error(`no I2C bus ${bus}`);
    const d = b.get(Number(addr) & 0x7f);
    if (!d) throw new Error(`I2C NACK 0x${(Number(addr) & 0x7f).toString(16)} on bus ${bus}`);
    return d;
  }

  i2cAttach(bus, addr, device) {
    const b = this.i2c.get(Number(bus));
    if (!b) throw new Error(`no I2C bus ${bus}`);
    b.set(Number(addr) & 0x7f, device);
    return true;
  }

  i2cHas(bus, addr) {
    const b = this.i2c.get(Number(bus));
    return !!b && b.has(Number(addr) & 0x7f);
  }

  i2cWrite(bus, addr, bytes) {
    const d = this.i2cDevice(bus, addr);
    d.writeCount = (d.writeCount || 0) + 1;
    d.lastWrite = arr(bytes);
    d.write(arr(bytes));
    return true;
  }

  envSet(values) {
    const source = values || {};
    for (const key of Object.keys(this.environment)) {
      if (source[key] !== undefined && source[key] !== null) {
        this.environment[key] = Array.isArray(this.environment[key])
          ? arr(source[key]) : (typeof this.environment[key] === 'number' ? Number(source[key]) : source[key]);
      }
    }
    if (source.sampleMs !== undefined) {
      for (const devs of this.i2c.values()) {
        for (const d of devs.values()) d.lastSampleMs = this.clockMs;
      }
    }
    return { ...this.environment };
  }
  envGet() { return { ...this.environment, accel: this.environment.accel.slice(), gyro: this.environment.gyro.slice() }; }

  refreshSensorRegs(d) {
    const e = this.environment;
    const regs = d.regs;
    if (!regs) return;
    if (e.sampleMs > 0 && this.clockMs - (d.lastSampleMs === undefined ? -e.sampleMs : d.lastSampleMs) < e.sampleMs) return;
    d.lastSampleMs = this.clockMs;
    const u16 = (offset, value) => {
      const v = Math.max(0, Math.min(65535, Math.round(value))) & 0xffff;
      regs[offset] = v >> 8; regs[offset + 1] = v & 0xff;
    };
    const i16 = (offset, value) => {
      const v = Math.max(-32768, Math.min(32767, Math.round(value)));
      regs[offset] = (v >> 8) & 0xff; regs[offset + 1] = v & 0xff;
    };
    switch (d.kind) {
      case 'bme280':
      case 'bmp280':
        u16(0xfa, e.tempC * 100); u16(0xf7, e.pressureHPa * 10); u16(0xfd, e.humidity * 100);
        break;
      case 'sht31d':
        u16(0x00, e.tempC * 100); u16(0x03, e.humidity * 100);
        break;
      case 'mcp9808': {
        const t = e.mcpTempC;
        const whole = Math.floor(t);
        regs[5] = whole & 0x7f;
        regs[6] = (Math.round((t - whole) * 16) << 4) & 0xf0;
        break;
      }
      case 'adxl345':
        for (let i = 0; i < 3; i++) i16(0x32 + i * 2, e.accel[i] * 256);
        break;
      case 'mpu6050':
        for (let i = 0; i < 3; i++) i16(0x3b + i * 2, e.accel[i] * 16384);
        break;
      case 'lis3dh':
        for (let i = 0; i < 3; i++) i16(0x28 + i * 2, e.accel[i] * 16384);
        break;
      case 'ina219':
        u16(0x02, e.busVoltage * 1000); u16(0x04, e.current * 100);
        break;
      case 'bh1750':
        u16(0x00, e.lux * 1.2);
        break;
      case 'pcf8523': {
        const sec = Math.floor(this.clockMs / 1000) % 60;
        const bcd = (v) => ((Math.floor(v / 10) << 4) | (v % 10)) & 0xff;
        regs[0] = bcd(sec); regs[1] = bcd(Math.floor(this.clockMs / 60000) % 60);
        break;
      }
      default:
        break;
    }
  }

  i2cRead(bus, addr, count) {
    const d = this.i2cDevice(bus, addr);
    this.refreshSensorRegs(d);
    d.readCount = (d.readCount || 0) + 1;
    return d.read(Number(count) || 1);
  }

  // ---- SPI ----
  spiDevice(bus, dev) {
    if (Number(bus) === 0 && !this.config.spi) {
      throw new Error('SPI is disabled (dtparam=spi=off)');
    }
    const b = this.spi.get(Number(bus));
    if (!b) throw new Error(`no SPI bus ${bus}`);
    const d = b.get(Number(dev));
    if (!d) throw new Error(`no SPI device ${dev} on bus ${bus}`);
    return d;
  }

  spiAttach(bus, dev, device) {
    const b = this.spi.get(Number(bus));
    if (!b) throw new Error(`no SPI bus ${bus}`);
    b.set(Number(dev), device);
    return true;
  }

  spiAttachRegFile(bus, dev, kind = 'custom', length = 256, initial = null) {
    const regs = new Uint8Array(Math.max(1, Number(length) || 256));
    if (initial) arr(initial).forEach((v, i) => { if (i < regs.length) regs[i] = Number(v) & 0xff; });
    let ptr = 0;
    const device = {
      kind: String(kind), regs,
      write(bytes) {
        const b = arr(bytes);
        if (!b.length) return;
        ptr = b[0] & 0xff;
        for (let i = 1; i < b.length; i++) regs[(ptr + i - 1) % regs.length] = b[i] & 0xff;
      },
      read(n) {
        const out = [];
        for (let i = 0; i < (Number(n) || 1); i++) out.push(regs[(ptr + i) % regs.length]);
        return out;
      },
      xfer(bytes) {
        const b = arr(bytes);
        if (!b.length) return [];
        const a = b[0] & 0xff;
        if (b.length === 1) return [regs[a]];
        if (a & 0x80) {
          for (let i = 1; i < b.length; i++) regs[((a & 0x7f) + i - 1) % regs.length] = b[i] & 0xff;
          return b.slice();
        }
        const out = [a];
        for (let i = 1; i < b.length; i++) out.push(regs[(a + i - 1) % regs.length]);
        return out;
      },
    };
    return this.spiAttach(bus, dev, device);
  }

  spiXfer(bus, dev, bytes) {
    return this.spiDevice(bus, dev).xfer(arr(bytes));
  }

  // ---- PWM ----
  pwmCreate(pin, frequency = 1000) {
    const p = this._pin(pin);
    if (!this.profile.pwmPins.includes(p.pin)) {
      // Pi 3/4 only have the four legacy BCM PWM channels; RP1 on Pi 5 has
      // PWM available on every header GPIO.
      throw new Error(`GPIO ${pin} has no hardware PWM on ${this.board}`);
    }
    p.mode = 'out';
    this.pwm.set(p.pin, {
      pin: p.pin, frequencyHz: Number(frequency), dutyPercent: 0, enabled: true,
      clockHz: this.profile.pwmClockHz, samples: [{ t: this.clockMs, duty: 0 }],
    });
    return true;
  }

  pwmDuty(pin, dutyPercent) {
    const c = this.pwm.get(Number(pin));
    if (!c) throw new Error(`no PWM channel on GPIO ${pin}`);
    c.dutyPercent = Math.max(0, Math.min(100, Number(dutyPercent)));
    c.samples.push({ t: this.clockMs, duty: c.dutyPercent });
    this.gpioWrite(pin, c.dutyPercent > 0);
    return c.dutyPercent;
  }

  pwmFrequency(pin, hz) {
    const c = this.pwm.get(Number(pin));
    if (!c) throw new Error(`no PWM channel on GPIO ${pin}`);
    c.frequencyHz = Math.max(1, Math.floor(Number(hz) || 1));
    c.clockHz = this.profile.pwmClockHz;
    return c.frequencyHz;
  }

  pwmStop(pin) {
    const c = this.pwm.get(Number(pin));
    if (c) {
      c.enabled = false; c.dutyPercent = 0;
      c.samples.push({ t: this.clockMs, duty: 0 });
      this.gpioWrite(pin, false);
    }
    return true;
  }

  // ---- ADC (MCP3008 attached to SPI0 CE0) ----
  adcSet(channel, value) {
    const c = Number(channel);
    if (c < 0 || c > 7) throw new Error(`invalid ADC channel ${channel}`);
    this.adc[c] = Math.max(0, Math.min(1023, Number(value)));
    return this.adc[c];
  }

  adcRead(channel) {
    const c = Number(channel);
    if (c < 0 || c > 7) throw new Error(`invalid ADC channel ${channel}`);
    return this.adc[c];
  }

  // ---- UART ----
  uartWrite(text) {
    if (!this.config.uart) throw new Error('UART is disabled (enable_uart=0)');
    this.uartTx += String(text); return true;
  }
  uartInject(text) { this.uartRx += String(text); return true; }
  // pyserial-style: read(n) consumes exactly n chars; n <= 0 drains all.
  uartRead(size = 1) {
    const n = Number(size);
    const count = Number.isFinite(n) && n > 0 ? Math.floor(n) : this.uartRx.length;
    const out = this.uartRx.slice(0, count);
    this.uartRx = this.uartRx.slice(count);
    return out;
  }
  uartReadLine() {
    const i = this.uartRx.indexOf('\n');
    if (i < 0) return '';
    const line = this.uartRx.slice(0, i); this.uartRx = this.uartRx.slice(i + 1); return line;
  }

  // ---- Time ----
  sleep(ms) {
    const delta = Math.max(0, Number(ms) || 0);
    this.clockMs += delta;
    this.analogStep(delta);
    this.settleElectrical();
    return this.clockMs;
  }
  clockNow() { return this.clockMs; }
  clockSet(ms) {
    const n = Math.max(0, Number(ms) || 0);
    this.clockMs = n;
    this.settleElectrical();
    return this.clockMs;
  }

  // ---- Board-level hardware ----
  cpuTemp() {
    return this.cpuTempOverride === null ? this.profile.cpuTempC : this.cpuTempOverride;
  }
  cpuTempSet(celsius) {
    this.cpuTempOverride = Number(celsius);
    return this.cpuTemp();
  }
  ledWrite(name, on) {
    const key = String(name).toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(this.leds, key)) {
      throw new Error(`unknown onboard LED ${name}`);
    }
    this.leds[key].on = !!on;
    return this.leds[key].on;
  }
  ledRead(name) {
    const key = String(name).toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(this.leds, key)) {
      throw new Error(`unknown onboard LED ${name}`);
    }
    return { ...this.leds[key] };
  }

  // ---- 1-Wire DS18B20 (simplified: one sensor per GPIO) ----
  onewireSet(pin, celsius) {
    this._pin(pin);
    this.onewire.set(Number(pin), { kind: 'ds18b20', tempC: Number(celsius) });
    return this.onewire.get(Number(pin)).tempC;
  }
  onewireRead(pin) {
    const d = this.onewire.get(Number(pin));
    if (!d) throw new Error(`no 1-Wire device on GPIO ${pin}`);
    return d.tempC;
  }

  // ---- Generic attachable I2C register device ----
  i2cAttachRegFile(bus, addr, kind = 'custom', length = 256, initial = null) {
    const regs = new Uint8Array(Math.max(1, Number(length) || 256));
    if (initial) {
      arr(initial).forEach((v, i) => { if (i < regs.length) regs[i] = Number(v) & 0xff; });
    }
    let ptr = 0;
    const device = {
      kind: String(kind), regs,
      write(bytes) {
        const b = arr(bytes);
        if (!b.length) return;
        ptr = b[0] & 0xff;
        for (let i = 1; i < b.length; i++) regs[(ptr + i - 1) % regs.length] = b[i] & 0xff;
      },
      read(n) {
        const out = [];
        for (let i = 0; i < (Number(n) || 1); i++) out.push(regs[(ptr + i) % regs.length]);
        return out;
      },
    };
    return this.i2cAttach(bus, addr, device);
  }

  // ---- NeoPixel / WS2812 strips ----
  neopixelSetup(pin, count) {
    const p = this._pin(pin);
    const n = Math.max(1, Math.min(1024, Math.floor(Number(count) || 1)));
    this.neopixels.set(p.pin, { pin: p.pin, count: n, pixels: Array.from({ length: n }, () => [0, 0, 0]) });
    p.mode = 'out';
    return n;
  }
  neopixelSet(pin, index, r, g, b) {
    const strip = this.neopixels.get(Number(pin));
    if (!strip) throw new Error(`no NeoPixel strip on GPIO ${pin}`);
    const i = Number(index);
    if (i < 0 || i >= strip.count) throw new Error(`invalid NeoPixel index ${index}`);
    strip.pixels[i] = [Number(r) & 0xff, Number(g) & 0xff, Number(b) & 0xff];
    return true;
  }
  neopixelFill(pin, r, g, b) {
    const strip = this.neopixels.get(Number(pin));
    if (!strip) throw new Error(`no NeoPixel strip on GPIO ${pin}`);
    strip.pixels = strip.pixels.map(() => [Number(r) & 0xff, Number(g) & 0xff, Number(b) & 0xff]);
    return true;
  }

  // ---- HD44780-style text LCD (simplified, text only) ----
  lcdCreate(name, cols = 16, rows = 2) {
    this.lcds[String(name)] = {
      cols: Math.max(1, Number(cols) || 16), rows: Math.max(1, Number(rows) || 2), text: '', lines: [],
    };
    return true;
  }
  lcdWrite(name, text) {
    const lcd = this.lcds[String(name)];
    if (!lcd) throw new Error(`no LCD ${name}`);
    const lines = String(text).split('\n').slice(0, lcd.rows);
    lcd.lines = lines.map((line) => line.slice(0, lcd.cols));
    lcd.text = lcd.lines.join('\n');
    return lcd.text;
  }
  lcdClear(name) {
    const lcd = this.lcds[String(name)];
    if (!lcd) throw new Error(`no LCD ${name}`);
    lcd.lines = []; lcd.text = '';
    return true;
  }

  // ---- Deterministic camera test-pattern frames ----
  cameraConfigure(width, height) {
    this.camera.width = Math.max(1, Math.min(4096, Math.floor(Number(width) || 64)));
    this.camera.height = Math.max(1, Math.min(4096, Math.floor(Number(height) || 48)));
    return { width: this.camera.width, height: this.camera.height };
  }
  cameraCapture() {
    const { width, height } = this.camera;
    const frame = new Array(width * height * 3);
    let checksum = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 3;
        frame[i] = (x * 4) & 0xff;
        frame[i + 1] = (y * 4) & 0xff;
        frame[i + 2] = ((x + y) * 2) & 0xff;
        checksum = (checksum + frame[i] + frame[i + 1] + frame[i + 2]) & 0xffff;
      }
    }
    this.camera.captures += 1;
    this.camera.lastChecksum = checksum;
    return frame;
  }

  // ---- DHT11/22 (host-injected reading, single-wire simplified) ----
  dhtSet(pin, celsius, humidity) {
    const p = this._pin(pin);
    this.dht.set(p.pin, { kind: 'dht', tempC: Number(celsius), humidity: Number(humidity) });
    return this.dht.get(p.pin);
  }
  dhtRead(pin) {
    const d = this.dht.get(Number(pin));
    if (!d) throw new Error(`no DHT sensor on GPIO ${pin}`);
    return { ...d };
  }

  // ---- /boot/config.txt and device tree (no kernel) ----
  configGet() {
    return {
      i2c_arm: this.config.i2cArm, spi: this.config.spi, uart: this.config.uart,
      dtoverlays: this.config.overlays.slice(),
    };
  }

  configSet(key, value) {
    const raw = String(key).trim();
    const lower = raw.toLowerCase();
    const enabled = (v) => !(v === false || v === 0 || v === '0' || v === 'off' || v === 'no' || v === 'false' || v === '');
    // Only a second '=' carries an inline value (e.g. dtparam=i2c_arm=off);
    // otherwise the value comes from the argument.
    const parts = lower.split('=');
    const requested = parts.length > 2 ? parts[parts.length - 1] : value;
    if (lower.startsWith('dtoverlay=')) {
      const overlay = lower.slice('dtoverlay='.length).split(',')[0];
      if (enabled(value) && !this.config.overlays.includes(overlay)) {
        this.config.overlays.push(overlay);
        this.applyOverlay(overlay);
      } else if (!enabled(value)) {
        this.config.overlays = this.config.overlays.filter((o) => o !== overlay);
      }
    } else if (lower.includes('i2c_arm') || lower === 'i2c') {
      this.config.i2cArm = enabled(requested);
    } else if (lower.includes('spi')) {
      this.config.spi = enabled(requested);
    } else if (lower.includes('uart') || lower.includes('serial')) {
      this.config.uart = enabled(requested);
    } else {
      throw new Error(`unknown config key ${raw}`);
    }
    return this.configGet();
  }

  applyOverlay(name) {
    switch (String(name)) {
      case 'i2c-sensor':
        this.i2cAttachRegFile(1, 0x41, 'overlay-i2c-sensor', 16, [0x2a]);
        return true;
      case 'spi-lcd':
        this.spiAttachRegFile(0, 2, 'overlay-spi-lcd', 16, [0x3c]);
        return true;
      case 'w1-gpio':
        this.onewireSet(4, 21.5);
        return true;
      case 'dht11':
        this.dhtSet(4, 23.0, 45);
        return true;
      default:
        return false;
    }
  }

  configText() {
    const c = this.config;
    return [
      `dtparam=i2c_arm=${c.i2cArm ? 'on' : 'off'}`,
      `dtparam=spi=${c.spi ? 'on' : 'off'}`,
      `enable_uart=${c.uart ? 1 : 0}`,
      ...c.overlays.map((o) => `dtoverlay=${o}`),
    ].join('\n') + '\n';
  }

  devNodes() {
    const nodes = ['/dev/i2c-0'];
    if (this.config.i2cArm) nodes.push('/dev/i2c-1');
    if (this.config.spi) nodes.push('/dev/spidev0.0', '/dev/spidev0.1');
    if (this.config.uart) nodes.push('/dev/serial0');
    return nodes;
  }

  deviceTree() {
    const devices = [];
    if (this.config.i2cArm) {
      devices.push({ bus: 'i2c', number: 1, address: '0x50', kind: 'eeprom', driver: 'at24' });
      devices.push({ bus: 'i2c', number: 1, address: '0x3c', kind: 'ssd1306', driver: 'ssd1306' });
      devices.push({ bus: 'i2c', number: 1, address: '0x18', kind: 'mcp9808', driver: 'mcp9808' });
    }
    if (this.config.spi) {
      devices.push({ bus: 'spi', number: 0, address: '0.0', kind: 'regfile', driver: 'spidev' });
      devices.push({ bus: 'spi', number: 0, address: '0.1', kind: 'shift', driver: 'spidev' });
    }
    const pins = {};
    for (const [name, num] of Object.entries({
      SDA: 2, SCL: 3, MOSI: 10, MISO: 9, SCK: 11, CE0: 8, CE1: 7, TXD: 14, RXD: 15,
    })) pins[name] = num;
    return {
      board: this.board, soc: this.profile.soc,
      buses: { i2c: this.profile.i2cBuses.slice(), spi: this.profile.spiBuses.slice() },
      i2cEnabled: this.config.i2cArm, spiEnabled: this.config.spi,
      devices,
      overlayDevices: this.config.overlays.map((overlay) => ({
        overlay, driver: `overlay-${overlay}`,
        bus: overlay === 'spi-lcd' ? 'spi' : overlay === 'w1-gpio' || overlay === 'dht11' ? 'gpio' : 'i2c',
        number: overlay === 'spi-lcd' ? 0 : 1,
        address: overlay === 'i2c-sensor' ? '0x41' : overlay === 'spi-lcd' ? '0.2' : '4',
        kind: `overlay-${overlay}`,
      })),
      pins, overlays: this.config.overlays.slice(), devNodes: this.devNodes(),
    };
  }

  // ---- Virtual network (no real sockets) ----
  netInterfaces() { return { ...this.net.interfaces }; }
  netRegisterService(name, port) {
    const key = String(port);
    if (!this.net.services[key]) this.net.services[key] = { name: String(name), port: Number(port), routes: {} };
    return { ...this.net.services[key], routes: { ...this.net.services[key].routes } };
  }
  netRegisterRoute(port, path, body) {
    const service = this.net.services[String(port)];
    if (!service) throw new Error(`no virtual service on port ${port}`);
    service.routes[String(path)] = String(body);
    return true;
  }
  netHttpRequest(method, url) {
    let parsed;
    try { parsed = new URL(String(url)); }
    catch { throw new Error(`invalid virtual URL ${url}`); }
    const service = this.net.services[parsed.port || '80'];
    const record = { method: String(method).toUpperCase(), url: String(url), status: service ? 200 : 404 };
    this.net.traffic.push(record);
    if (!service) return { status: 404, body: 'not found' };
    const body = Object.prototype.hasOwnProperty.call(service.routes, parsed.pathname)
      ? service.routes[parsed.pathname] : 'not found';
    record.status = body === 'not found' ? 404 : 200;
    return { status: record.status, body };
  }
  netMqttSubscribe(topic) {
    if (!this.net.mqttSubs.includes(String(topic))) this.net.mqttSubs.push(String(topic));
    return true;
  }
  netMqttPublish(topic, payload, qos = 0) {
    const level = Number(qos) || 0;
    const message = { topic: String(topic), payload: String(payload), t: this.clockMs };
    if (level > 0) {
      message.qos = level;
      message.acked = true;
      this.net.packets.push({ type: 'PUBACK', topic: message.topic, qos: level, t: this.clockMs });
    }
    this.net.mqttQueue.push(message);
    this.net.traffic.push({ method: 'MQTT', url: message.topic, status: 200 });
    return level > 0 ? this.net.mqttQueue.length : true;
  }
  netMqttMessages(topic) {
    return this.net.mqttQueue
      .filter((m) => topic === undefined || m.topic === String(topic))
      .map((m) => ({ ...m }));
  }

  // ---- Packet-level loopback sockets ----
  netDnsResolve(name) {
    const key = String(name).toLowerCase();
    if (key === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(key)) return key;
    const address = this.net.dns[key];
    if (!address) throw new Error(`DNS resolution failed for ${name}`);
    return address;
  }
  netSocketOpen(kind = 'tcp') {
    const id = ++this.net.socketSeq;
    this.net.sockets[id] = {
      id, kind: String(kind), state: 'CLOSED', localPort: null,
      conn: null, rx: '', datagrams: [],
    };
    return id;
  }
  netSocketBind(id, port) {
    const s = this.net.sockets[Number(id)];
    if (!s) throw new Error(`no socket ${id}`);
    s.localPort = Number(port);
    s.state = 'BOUND';
    this.net.listeners = this.net.listeners || {};
    this.net.listeners[s.localPort] = s.id;
    return true;
  }
  netSocketListen(id) {
    const s = this.net.sockets[Number(id)];
    if (!s) throw new Error(`no socket ${id}`);
    s.state = 'LISTEN';
    return true;
  }
  netSocketConnect(id, host, port) {
    const s = this.net.sockets[Number(id)];
    if (!s) throw new Error(`no socket ${id}`);
    const address = this.netDnsResolve(host);
    const serverId = (this.net.listeners || {})[Number(port)];
    if (!serverId || !this.net.sockets[serverId]) throw new Error(`connection refused: ${address}:${port}`);
    const connId = ++this.net.connSeq;
    const conn = {
      id: connId, client: s.id, server: serverId, address, port: Number(port),
      state: 'SYN_SENT', seq: 0, ack: 0, last: null, rxClient: '', rxServer: '',
    };
    this.net.connections[connId] = conn;
    s.conn = connId;
    s.state = 'ESTABLISHED';
    this.net.packets.push({ type: 'SYN', from: address, to: port, conn: connId, t: this.clockMs });
    this.net.packets.push({ type: 'SYN-ACK', from: port, to: address, conn: connId, t: this.clockMs });
    this.net.packets.push({ type: 'ACK', from: address, to: port, conn: connId, t: this.clockMs });
    conn.state = 'ESTABLISHED';
    this.net.pending.push(connId);
    return connId;
  }
  netSocketAccept(id) {
    const s = this.net.sockets[Number(id)];
    if (!s || s.state !== 'LISTEN') throw new Error(`socket ${id} is not listening`);
    const at = this.net.pending.findIndex((c) => this.net.connections[c].server === s.id);
    if (at < 0) return null;
    const connId = this.net.pending.splice(at, 1)[0];
    const acceptedId = this.netSocketOpen('tcp');
    const a = this.net.sockets[acceptedId];
    a.state = 'ESTABLISHED';
    a.localPort = s.localPort;
    a.conn = connId;
    return acceptedId;
  }
  netSocketSend(id, data) {
    const s = this.net.sockets[Number(id)];
    const conn = s && this.net.connections[s.conn];
    if (!conn || conn.state !== 'ESTABLISHED') throw new Error(`socket ${id} is not connected`);
    const payload = String(data);
    if (s.id === conn.client) conn.rxServer += payload;
    else conn.rxClient += payload;
    const packet = {
      type: 'PSH', from: s.id, to: s.id === conn.client ? conn.server : conn.client,
      conn: conn.id, seq: conn.seq++, ack: conn.ack, bytes: payload.length, t: this.clockMs,
    };
    conn.last = packet;
    this.net.packets.push(packet);
    return payload.length;
  }
  netSocketRecv(id, size = 4096) {
    const s = this.net.sockets[Number(id)];
    const conn = s && this.net.connections[s.conn];
    if (!conn) return '';
    const key = s.id === conn.client ? 'rxClient' : 'rxServer';
    const out = conn[key].slice(0, Number(size));
    conn[key] = conn[key].slice(out.length);
    return out;
  }
  netSocketClose(id) {
    const s = this.net.sockets[Number(id)];
    if (!s) return false;
    const conn = s && this.net.connections[s.conn];
    if (conn && conn.state === 'ESTABLISHED') {
      conn.state = 'FIN_WAIT';
      this.net.packets.push({ type: 'FIN', from: s.id, conn: conn.id, t: this.clockMs });
      conn.state = 'CLOSED';
    }
    s.state = 'CLOSED';
    return true;
  }
  netRetransmit(connId) {
    const conn = this.net.connections[Number(connId)];
    if (!conn || !conn.last) throw new Error(`nothing to retransmit for ${connId}`);
    const copy = { ...conn.last, type: 'RETRANS', t: this.clockMs };
    this.net.packets.push(copy);
    return copy;
  }
  netDatagramSend(id, host, port, data) {
    const s = this.net.sockets[Number(id)];
    if (!s || s.kind !== 'udp') throw new Error(`socket ${id} is not UDP`);
    const address = this.netDnsResolve(host);
    const packet = { type: 'UDP', from: address, to: Number(port), bytes: String(data).length, t: this.clockMs };
    this.net.packets.push(packet);
    const targetId = (this.net.listeners || {})[Number(port)];
    const target = targetId && this.net.sockets[targetId];
    if (target && target.kind === 'udp') target.datagrams.push({ from: address, data: String(data) });
    return packet.bytes;
  }
  netDatagramRecv(id) {
    const s = this.net.sockets[Number(id)];
    if (!s) throw new Error(`no socket ${id}`);
    return s.datagrams.shift() || null;
  }
  netServePending(port) {
    let served = 0;
    const key = Number(port);
    const listenerId = (this.net.listeners || {})[key];
    while (true) {
      if (!this.net.pending.some((c) => this.net.connections[c].port === key)) break;
      const accepted = this.netSocketAccept(listenerId);
      if (!accepted) break;
      const request = this.netSocketRecv(accepted, 65536);
      const line = String(request).split('\r\n')[0] || '';
      const path = line.split(' ')[1] || '/';
      const service = this.net.services[String(key)] || { routes: {} };
      const body = Object.prototype.hasOwnProperty.call(service.routes, path)
        ? service.routes[path] : 'not found';
      const status = body === 'not found' ? 404 : 200;
      const response = `HTTP/1.1 ${status} OK\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n${body}`;
      this.netSocketSend(accepted, response);
      this.netSocketClose(accepted);
      served += 1;
    }
    return served;
  }
  netPacketLog() { return this.net.packets.slice(); }
  netSocketState(id) {
    const s = this.net.sockets[Number(id)];
    return s ? { id: s.id, kind: s.kind, state: s.state, localPort: s.localPort, conn: s.conn } : null;
  }

  state() {
    const gpio = {};
    const electricalPins = {};
    for (const [pin, p] of this.gpio) {
      gpio[pin] = { mode: p.mode, level: p.level, pull: p.pull, driven: p.driven };
      electricalPins[pin] = {
        volts: this.gpioVoltage(pin), logic: !!p.level,
        targetVolts: p.targetVolts, settledVolts: p.settledVolts,
        slewMs: p.slewMs, overCurrent: p.overCurrent, capacitancePF: p.capacitancePF,
      };
    }
    const i2c = {};
    for (const [bus, devs] of this.i2c) {
      i2c[bus] = {};
      for (const [addr, d] of devs) i2c[bus][`0x${addr.toString(16)}`] = {
        kind: d.kind,
        writes: d.writeCount || 0,
        reads: d.readCount || 0,
        lastWrite: d.lastWrite ? arr(d.lastWrite) : undefined,
        buffer: d.buffer ? arr(d.buffer.slice(0, 32)) : undefined,
      };
    }
    const spi = {};
    for (const [bus, devs] of this.spi) {
      spi[bus] = {};
      for (const [dev, d] of devs) spi[bus][dev] = {
        kind: d.kind,
        matrix: d.matrix ? arr(d.matrix) : undefined,
      };
    }
    const leds = {};
    for (const [name, led] of Object.entries(this.leds)) leds[name] = { ...led };
    const onewire = {};
    for (const [pin, sensor] of this.onewire) onewire[pin] = { ...sensor };
    const neopixels = {};
    for (const [pin, strip] of this.neopixels) {
      neopixels[pin] = { count: strip.count, pixels: strip.pixels.map((p) => p.slice()) };
    }
    const dht = {};
    for (const [pin, sensor] of this.dht) dht[pin] = { ...sensor };
    return {
      board: this.board, soc: this.profile.soc, clockMs: this.clockMs,
      cpuClockMHz: this.profile.cpuClockMHz, pwmClockHz: this.profile.pwmClockHz,
      pwmPins: this.profile.pwmPins.slice(), i2cBuses: this.profile.i2cBuses.slice(),
      spiBuses: this.profile.spiBuses.slice(), spiMaxHz: this.profile.spiMaxHz,
      optionalSpiBuses: this.profile.optionalSpiBuses.slice(),
      pullUpOhms: this.profile.pullUpOhms,
      onboardLed: { ...this.profile.onboardLed }, cpuTempC: this.cpuTemp(),
      electrical: {
        vddVolts: this.profile.vddVolts, viL: this.profile.viL, viH: this.profile.viH,
        maxInputVolts: this.profile.maxInputVolts, pullUpOhms: this.profile.pullUpOhms,
        driveStrengthmA: this.profile.driveStrengthmA.slice(),
        slewMs: this.profile.slewMs, debounceMs: this.profile.debounceMs,
        pinCapacitancePF: this.profile.pinCapacitancePF, pwmWindowMs: this.profile.pwmWindowMs,
        fiveVoltTolerant: false, pins: electricalPins,
      },
      camera: { ...this.camera }, analog: this.analogSummary(),
      environment: this.envGet(),
      config: this.configGet(), devNodes: this.devNodes(), deviceTree: this.deviceTree(),
      network: {
        interfaces: { ...this.net.interfaces },
        services: Object.fromEntries(Object.entries(this.net.services).map(([p, s]) => [p, { name: s.name, port: s.port, routes: { ...s.routes } }])),
        mqttSubs: this.net.mqttSubs.slice(), mqttMessages: this.netMqttMessages(),
        traffic: this.net.traffic.slice(), dns: { ...this.net.dns },
        sockets: Object.fromEntries(Object.entries(this.net.sockets).map(([id, s]) => [id, {
          kind: s.kind, state: s.state, localPort: s.localPort, conn: s.conn,
        }])),
        connections: Object.fromEntries(Object.entries(this.net.connections).map(([id, c]) => [id, {
          state: c.state, address: c.address, port: c.port, seq: c.seq, ack: c.ack,
        }])),
        packets: this.netPacketLog(), pending: this.net.pending.slice(),
      },
      leds, onewire, dht, neopixels, lcds: JSON.parse(JSON.stringify(this.lcds)),
      gpio, edges: this.edges.slice(-64), pwm: Object.fromEntries(this.pwm),
      adc: this.adc.slice(), i2c, spi,
      uartTx: this.uartTx, uartRx: this.uartRx, errors: this.errors.slice(),
    };
  }
}

export default Peripherals;
