"""Python builder API over the deterministic MNA analogue solver.

Supports resistor/capacitor/diode networks, independent sources, dependent
sources, switches, a piecewise-linear NPN BJT, current probes, accumulated
charge, transient traces and a small SPICE-like netlist grammar. It is not a
full SPICE implementation: see FIDELITY.md for the exact boundary.
"""

import json
import math
import re

from rpi_sim import _bridge

_b = _bridge._b

_timestep_us = 10
_info = {'elements': [], 'directives': {}, 'dt_us': 10, 'duration_ms': None}
_aliases = {}


class AnalogError(Exception):
    """Base class for analogue solver failures."""


class ConvergenceError(AnalogError):
    """Piecewise-linear iteration did not settle within the iteration cap."""


class SingularMatrixError(AnalogError):
    """Circuit has a floating node or conflicting ideal sources."""


def _js(fn, *args):
    """Call the bridge with clear Python exceptions, never silent numbers."""
    try:
        return fn(*args)
    except AnalogError:
        raise
    except Exception as exc:
        message = str(exc)
        lower = message.lower()
        if 'singular matrix' in lower:
            raise SingularMatrixError(message) from None
        if 'did not converge' in lower or 'iteration' in lower:
            raise ConvergenceError(message) from None
        if 'negative capacitance' in lower:
            raise ValueError(message) from None
        raise AnalogError(message) from None


def _finite(value, label, positive=False, nonnegative=False):
    v = float(value)
    if not math.isfinite(v):
        raise ValueError(f'{label} must be finite, got {value}')
    if positive and v <= 0:
        raise ValueError(f'{label} must be positive, got {value}')
    if nonnegative and v < 0:
        raise ValueError(f'{label} must not be negative, got {value}')
    return v


class Node:
    def __init__(self, name):
        self.name = str(name).upper()
        _js(_b.analog_node, self.name)

    def voltage(self):
        return float(_js(_b.analog_voltage, self.name))

    def __repr__(self):
        return f"Node({self.name})"


class Element:
    def __init__(self, kind, name, a, b, value, extra=None):
        self.name = str(name).upper()
        self.kind = kind
        _js(_b.analog_add, kind, self.name, Node(a).name, Node(b).name, value, extra or {})

    def set(self, value):
        return _js(_b.analog_set, self.name, value)

    def current(self):
        return current(self.name)

    def charge(self):
        return charge(self.name)

    def remove(self):
        return _js(_b.analog_remove, self.name)

    def __repr__(self):
        return f"{self.kind}({self.name})"


class Resistor(Element):
    def __init__(self, name, a, b, ohms):
        super().__init__('R', name, a, b, _finite(ohms, f'{name} resistance', positive=True))


class Capacitor(Element):
    def __init__(self, name, a, b, farads):
        super().__init__('C', name, a, b, _finite(farads, f'{name} capacitance', nonnegative=True))


class Diode(Element):
    def __init__(self, name, a, b, vdrop=0.7, ron=1.0):
        vdrop = _finite(vdrop, f'{name} diode drop', nonnegative=True)
        ron = _finite(ron, f'{name} diode on-resistance', positive=True)
        super().__init__('D', name, a, b, vdrop, {'vdrop': vdrop, 'ron': ron})


class VoltageSource(Element):
    def __init__(self, name, a, b, volts):
        super().__init__('V', name, a, b, _finite(volts, f'{name} voltage'))


class CurrentSource(Element):
    def __init__(self, name, a, b, amps):
        super().__init__('I', name, a, b, _finite(amps, f'{name} current'))


class VCVS(Element):
    def __init__(self, name, a, b, control_plus, control_minus, gain):
        super().__init__('E', name, a, b, _finite(gain, f'{name} gain'),
                         {'gain': gain, 'c': Node(control_plus).name, 'd': Node(control_minus).name})


class VCCS(Element):
    def __init__(self, name, a, b, control_plus, control_minus, gain):
        super().__init__('G', name, a, b, _finite(gain, f'{name} gain'),
                         {'gain': gain, 'c': Node(control_plus).name, 'd': Node(control_minus).name})


class Switch(Element):
    def __init__(self, name, a, b, closed=True):
        super().__init__('SW', name, a, b, 1 if closed else 0)


class NPN(Element):
    """Piecewise-linear NPN: collector=a, emitter=b, base=extra['c'].

    Regions: cutoff (no current), active (Ic = beta*Ib) and saturation
    (Vce = Vce(sat) + rce*Ic). This is a switch/amplifier approximation, not a
    Gummel-Poon or SPICE transistor model.
    """

    def __init__(self, name, collector, base, emitter, beta=100, vbe_on=0.7,
                 rbe=100, vce_sat=0.2, rce=5):
        beta = _finite(beta, f'{name} beta', positive=True)
        vbe_on = _finite(vbe_on, f'{name} Vbe(on)', positive=True)
        rbe = _finite(rbe, f'{name} base resistance', positive=True)
        vce_sat = _finite(vce_sat, f'{name} Vce(sat)', nonnegative=True)
        rce = _finite(rce, f'{name} saturation resistance', positive=True)
        super().__init__('Q', name, collector, emitter, beta,
                         {'beta': beta, 'vbeOn': vbe_on, 'rbe': rbe,
                          'vceSat': vce_sat, 'rce': rce, 'c': Node(base).name})

    def base_current(self):
        return current(f'{self.name}:B')

    def collector_current(self):
        return current(self.name)


def reset():
    global _timestep_us, _info, _aliases
    _timestep_us = 10
    _info = {'elements': [], 'directives': {}, 'dt_us': 10, 'duration_ms': None}
    _aliases = {}
    return _js(_b.analog_reset)


def set_timestep(us):
    global _timestep_us
    _timestep_us = int(_js(_b.analog_set_timestep, int(us)))
    return _timestep_us


def solve(dt_us=None):
    _js(_b.analog_solve, _timestep_us if dt_us is None else int(dt_us))
    return summary()


def voltage(node):
    return float(_js(_b.analog_voltage, str(node).upper()))


def _resolve(name):
    name = str(name).upper()
    return _aliases.get(name, name)


def current(element):
    return float(_js(_b.analog_current, _resolve(element)))


def charge(name):
    """Integral of an element current over all solved timesteps, in coulombs."""
    return float(_js(_b.analog_charge, _resolve(name)))


def kcl_residual():
    """Maximum |sum of outgoing currents| over all non-ground nodes, in amps."""
    return float(json.loads(_js(_b.analog_kcl))['residual'])


def kcl_residuals():
    return json.loads(_js(_b.analog_kcl))['residuals']


def rail_current():
    """Current delivered by the VDD rail into the circuit (positive = sourcing)."""
    return -float(_js(_b.analog_current, 'VDD_RAIL'))


def pin_current(pin):
    """Current from a GPIO driver into its pin (negative = pin sinking)."""
    return float(_js(_b.analog_pin_current, int(pin)))


def summary():
    return json.loads(_js(_b.analog_summary))


def info():
    return dict(_info)


def attach(pin, node=None):
    result = _js(_b.analog_attach_pin, int(pin))
    if node is not None:
        VoltageSource(f'PINDRV{pin}', f'DRV{pin}', 'GND', 0)
    return result


def adc_attach(channel, node):
    return _js(_b.analog_attach_adc, int(channel), str(node).upper())


def adc_read(channel):
    return int(_js(_b.adc_solved, int(channel)))


def ads1115_read(channel):
    return int(_js(_b.adc_solved16, int(channel)))


def divider(name, channel=0, r_top=10000, r_bottom=10000, node=None):
    n = Node(node or f'{name}_NODE')
    Resistor(f'{name}_TOP', 'VDD', n.name, r_top)
    Resistor(f'{name}_BOTTOM', n.name, 'GND', r_bottom)
    adc_attach(channel, n.name)
    return n


def rc_lowpass(name, channel=1, resistance=1000, capacitance=1e-6, source='VDD', node=None):
    n = Node(node or f'{name}_NODE')
    Resistor(f'{name}_R', source, n.name, resistance)
    Capacitor(f'{name}_C', n.name, 'GND', capacitance)
    adc_attach(channel, n.name)
    return n


def ntc_divider(name, channel=2, r_fixed=10000, r25=10000, beta=3950, temp_c=25.0, node=None):
    resistance = r25 * math.exp(beta * (1.0 / (float(temp_c) + 273.15) - 1.0 / 298.15))
    return divider(name, channel, r_fixed, resistance, node)


def photoresistor_divider(name, channel=3, r_fixed=10000, lux=400.0, node=None):
    # Deterministic photo-resistor model: R = 1e6 / lux (clamped).
    resistance = max(100, min(1e7, 1e6 / max(0.1, float(lux))))
    return divider(name, channel, r_fixed, resistance, node)


# ---- Transient traces -----------------------------------------------------

def trace(target, duration_ms, dt_us=None):
    """Sample a node voltage or element current while advancing the solver.

    `target` is a node name / `V:NODE` for voltage or an element name /
    `I:ELEM` for current. Returns [{'t_us', 'target', 'kind', 'value'}, ...].
    """
    dt = _timestep_us if dt_us is None else int(dt_us)
    rows = json.loads(_js(_b.analog_trace, str(target), float(duration_ms), int(dt)))
    return rows


def trace_csv(rows):
    lines = ['t_us,value']
    for row in rows:
        lines.append(f"{int(row['t_us'])},{float(row['value']):.12g}")
    return '\n'.join(lines) + '\n'


def trace_json(rows):
    return json.dumps(rows)


def export_trace(rows, path, format='csv'):
    """Write a trace to the Pyodide filesystem as CSV or JSON."""
    fmt = str(format).lower()
    if fmt == 'csv':
        text = trace_csv(rows)
    elif fmt == 'json':
        text = trace_json(rows)
    else:
        raise ValueError(f'unsupported trace format {format!r}; use csv or json')
    with open(str(path), 'w', encoding='utf-8') as handle:
        handle.write(text)
    return str(path)


# ---- SPICE-like netlist ---------------------------------------------------

_SI = {'f': 1e-15, 'p': 1e-12, 'n': 1e-9, 'u': 1e-6, 'm': 1e-3,
       'k': 1e3, 'meg': 1e6, 'g': 1e9, 't': 1e12}
_VALUE = re.compile(r'^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)([a-zA-Z]*)$')


def _value(token, label):
    match = _VALUE.match(str(token).strip())
    if not match:
        raise ValueError(f'netlist {label}: invalid number {token!r}')
    suffix = match.group(2).lower()
    if suffix and suffix not in _SI:
        raise ValueError(f'netlist {label}: unknown SI suffix {match.group(2)!r}')
    return float(match.group(1)) * (_SI.get(suffix, 1.0))


def _node(token):
    name = str(token).upper()
    return 'GND' if name in ('0', 'GND', 'GROUND') else name


def netlist(text):
    """Build the circuit from SPICE-like lines; return parsed information.

    Grammar (one element per line, `*` and `;` start comments):

        R<name> <n+> <n-> <ohms>              e.g. R1 VDD OUT 10k
        C<name> <n+> <n-> <farads>            e.g. C1 OUT 0 1u
        D<name> <anode> <cathode> [vdrop ron] default 0.7 V, 1 ohm
        V<name> <n+> <n-> <volts>             positive current n+ -> n-
        I<name> <n+> <n-> <amps>              positive current n+ -> n-
        SW<name> <n+> <n-> <1|0|ON|OFF>       1/ON = 1 mOhm, 0/OFF = 1 GOhm
        E<name> <n+> <n-> <c+> <c-> <gain>    VCVS, Vout = gain*(Vc+ - Vc-)
        G<name> <n+> <n-> <c+> <c-> <gain>    VCCS, I(n+ -> n-) = gain*Vctrl
        Q<name> <C> <B> <E> [NPN] [BETA=x VBE=x RB=x VCESAT=x RCE=x]
        .TRAN <tstep> <tstop>                 e.g. .TRAN 10us 5ms
        .END

    SI suffixes: f, p, n, u, m (milli), k, meg, g, t. Node `0`, `GND` and
    `GROUND` are the same ground. A V source directly across VDD/GND sets the
    rail voltage instead of adding a second, conflicting ideal source.
    """
    reset()
    elements = []
    directives = {}
    duration_ms = None
    for raw in str(text).splitlines():
        line = raw.strip()
        if not line or line.startswith('*'):
            continue
        line = line.split(';', 1)[0].split('#', 1)[0].strip()
        if not line:
            continue
        tokens = [t for t in re.split(r'[\s=]+', line) if t]
        if not tokens:
            continue
        head = tokens[0].upper()
        if head.startswith('.'):
            if head == '.END':
                continue
            if head == '.TRAN':
                args = tokens[1:]
                if len(args) == 1:
                    seconds = _value(args[0], '.TRAN tstop')
                    duration_ms = seconds * 1000
                elif len(args) >= 2:
                    step = _value(args[0], '.TRAN tstep')
                    if step <= 0:
                        raise ValueError('netlist .TRAN tstep must be positive')
                    set_timestep(round(step * 1e6))
                    duration_ms = _value(args[1], '.TRAN tstop') * 1000
                else:
                    raise ValueError('netlist .TRAN needs a stop time')
                directives['tran'] = {'tstep_us': _timestep_us, 'tstop_ms': duration_ms}
            else:
                raise ValueError(f'netlist: unsupported directive {tokens[0]!r}')
            continue

        kind = 'SW' if head.startswith('SW') else head[0].upper()
        name = tokens[0].upper()
        try:
            if kind == 'R':
                if len(tokens) != 4:
                    raise ValueError('expected R<name> <n+> <n-> <ohms>')
                Resistor(name, _node(tokens[1]), _node(tokens[2]), _value(tokens[3], name))
            elif kind == 'C':
                if len(tokens) != 4:
                    raise ValueError('expected C<name> <n+> <n-> <farads>')
                Capacitor(name, _node(tokens[1]), _node(tokens[2]), _value(tokens[3], name))
            elif kind == 'V':
                if len(tokens) != 4:
                    raise ValueError('expected V<name> <n+> <n-> <volts>')
                plus, minus = _node(tokens[1]), _node(tokens[2])
                volts = _value(tokens[3], name)
                if {plus, minus} == {'VDD', 'GND'}:
                    _js(_b.analog_set, 'VDD_RAIL', volts if plus == 'VDD' else -volts)
                    _aliases[name] = 'VDD_RAIL'
                else:
                    VoltageSource(name, plus, minus, volts)
            elif kind == 'I':
                if len(tokens) != 4:
                    raise ValueError('expected I<name> <n+> <n-> <amps>')
                CurrentSource(name, _node(tokens[1]), _node(tokens[2]), _value(tokens[3], name))
            elif kind == 'D':
                if len(tokens) not in (4, 6):
                    raise ValueError('expected D<name> <anode> <cathode> [vdrop ron]')
                vdrop = _value(tokens[4], name) if len(tokens) == 6 else 0.7
                ron = _value(tokens[5], name) if len(tokens) == 6 else 1.0
                Diode(name, _node(tokens[1]), _node(tokens[2]), vdrop, ron)
            elif kind == 'SW':
                if len(tokens) != 4:
                    raise ValueError('expected SW<name> <n+> <n-> <1|0|ON|OFF>')
                state = tokens[3].upper()
                if state in ('1', 'ON', 'CLOSED', 'TRUE'):
                    closed = True
                elif state in ('0', 'OFF', 'OPEN', 'FALSE'):
                    closed = False
                else:
                    raise ValueError(f'netlist {name}: invalid switch state {tokens[3]!r}')
                Switch(name, _node(tokens[1]), _node(tokens[2]), closed)
            elif kind in ('E', 'G'):
                if len(tokens) != 6:
                    raise ValueError(f'expected {kind}<name> <n+> <n-> <c+> <c-> <gain>')
                cls = VCVS if kind == 'E' else VCCS
                cls(name, _node(tokens[1]), _node(tokens[2]),
                    _node(tokens[3]), _node(tokens[4]), _value(tokens[5], name))
            elif kind == 'Q':
                if len(tokens) < 4:
                    raise ValueError('expected Q<name> <C> <B> <E> [NPN] [BETA=x ...]')
                params = {'beta': 100.0, 'vbe_on': 0.7, 'rbe': 100.0,
                          'vce_sat': 0.2, 'rce': 5.0}
                key_map = {'BETA': 'beta', 'VBE': 'vbe_on', 'RB': 'rbe',
                           'VCESAT': 'vce_sat', 'RCE': 'rce'}
                for token in tokens[4:]:
                    if token.upper() == 'NPN':
                        continue
                    if token.upper() == 'PNP':
                        raise ValueError('netlist: PNP transistors are not modelled')
                    if '=' not in token:
                        raise ValueError(f'netlist {name}: unknown Q parameter {token!r}')
                    key, raw = token.split('=', 1)
                    key = key.upper()
                    if key not in key_map:
                        raise ValueError(f'netlist {name}: unknown Q parameter {key!r}')
                    params[key_map[key]] = _value(raw, f'{name}.{key}')
                NPN(name, _node(tokens[1]), _node(tokens[2]), _node(tokens[3]), **params)
            else:
                raise ValueError(f'netlist: unknown element {tokens[0]!r}')
        except (ValueError, TypeError) as exc:
            raise ValueError(f'netlist line {raw.strip()!r}: {exc}') from None
        elements.append(name)
    _info = {'elements': elements, 'directives': directives,
             'dt_us': _timestep_us, 'duration_ms': duration_ms}
    return dict(_info)
