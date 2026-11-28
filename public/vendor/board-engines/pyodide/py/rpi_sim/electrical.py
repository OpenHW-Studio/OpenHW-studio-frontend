"""Deterministic electrical model: voltage levels, thresholds, drive strength."""

from rpi_sim import _bridge

_b = _bridge._b


def state():
    return _bridge.snapshot()["electrical"]


def voltage(pin):
    return float(_b.gpio_voltage(int(pin)))


def set_voltage(pin, volts):
    return int(_b.gpio_drive_voltage(int(pin), float(volts)))


def thresholds():
    s = state()
    return s["viL"], s["viH"]


def drive_strength():
    return state()["driveStrengthmA"]


def pull_up_ohms():
    return state()["pullUpOhms"]


def pwm_voltage(pin):
    return float(_b.pwm_voltage(int(pin)))


def pwm_average_voltage(pin, window_ms=None):
    if window_ms is None:
        return float(_b.pwm_average_voltage(int(pin)))
    return float(_b.pwm_average_voltage(int(pin), int(window_ms)))


def set_capacitance(pin, picofarads):
    return float(_b.electrical_set_capacitance(int(pin), picofarads))


def settled_voltage(pin):
    return float(_b.electrical_settled_voltage(int(pin)))


def over_current(pin):
    return bool(_b.electrical_overcurrent(int(pin)))


def slew_time(pin):
    return state()["pins"][str(int(pin))]["slewMs"]


def settle():
    return int(_b.electrical_settle())


def read_adc_noisy(channel):
    return int(_b.adc_read_noisy(int(channel)))


def is_5v_tolerant():
    """No GPIO on Pi 3/4/5 is 5 V tolerant; over-voltage is rejected."""
    return False
