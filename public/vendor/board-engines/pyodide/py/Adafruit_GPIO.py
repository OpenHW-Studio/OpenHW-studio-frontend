"""Adafruit_GPIO-compatible facade over the JS bridge."""

from rpi_sim import _bridge
from rpi_sim import board as _board

_b = _bridge._b


def get_platform_name():
    return "raspberry_pi_" + _bridge.snapshot()["board"]


def get_platform():
    return get_platform_name()


class GPIO:
    BCM = 11
    BOARD = 10
    OUT = 1
    IN = 0
    HIGH = 1
    LOW = 0
    PUD_OFF = "off"
    PUD_UP = "up"
    PUD_DOWN = "down"

    @staticmethod
    def setmode(mode):
        return None

    @staticmethod
    def setup(pin, direction, pull_up_down=PUD_OFF):
        pull = pull_up_down if pull_up_down in ("up", "down") else "none"
        return _b.gpio_setup(int(pin), "out" if direction == GPIO.OUT else "in", pull)

    @staticmethod
    def output(pin, value):
        return _b.gpio_write(int(pin), 1 if value else 0)

    @staticmethod
    def input(pin):
        return int(_b.gpio_read(int(pin)))

    @staticmethod
    def cleanup():
        return _b.reset(_bridge.snapshot()["board"])


class I2C:
    def __init__(self, bus=None):
        self.bus = int(bus if bus is not None else 1)

    def read_list(self, addr, count):
        return list(_b.i2c_read(self.bus, addr, count))

    def write_list(self, addr, values):
        return _b.i2c_write(self.bus, addr, list(values))

    def close(self):
        return None
