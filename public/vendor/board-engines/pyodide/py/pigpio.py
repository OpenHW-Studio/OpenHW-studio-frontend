"""pigpio-style GPIO/PWM facade over the JS peripheral bridge."""

from rpi_sim import _bridge

_b = _bridge._b

INPUT = 0
OUTPUT = 1
PUD_OFF = 0
PUD_UP = 2
PUD_DOWN = 1
RISING_EDGE = 1
FALLING_EDGE = 2
EITHER_EDGE = 3


class pi:
    """A single simulated pigpio connection."""

    def __init__(self, host=None, port=None, show_messages=False):
        self.connected = True

    def write(self, gpio, level):
        return _b.gpio_write(int(gpio), 1 if level else 0)

    def read(self, gpio):
        return int(_b.gpio_read(int(gpio)))

    def set_mode(self, gpio, mode):
        return _b.gpio_setup(int(gpio), "out" if mode == OUTPUT else "in", "none")

    def set_pull_up_down(self, gpio, pud):
        pull = {PUD_UP: "up", PUD_DOWN: "down"}.get(pud, "none")
        return _b.gpio_setup(int(gpio), "in", pull)

    def hardware_PWM(self, gpio, frequency, dutycycle):
        _b.pwm_create(int(gpio), frequency)
        return _b.pwm_duty(int(gpio), max(0.0, min(100.0, float(dutycycle) / 10000.0)))

    def set_PWM_dutycycle(self, gpio, dutycycle):
        return _b.pwm_duty(int(gpio), max(0.0, min(100.0, float(dutycycle) / 10000.0)))

    def stop(self):
        self.connected = False
        return None


# pigpio also exposes module-level helpers via a default connection.
_default = None


def _conn():
    global _default
    if _default is None or not _default.connected:
        _default = pi()
    return _default


def write(gpio, level):
    return _conn().write(gpio, level)


def read(gpio):
    return _conn().read(gpio)


def set_mode(gpio, mode):
    return _conn().set_mode(gpio, mode)
