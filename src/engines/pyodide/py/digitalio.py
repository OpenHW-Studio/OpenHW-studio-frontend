"""CircuitPython-style DigitalInOut backed by the GPIO model."""

from rpi_sim import _bridge

_b = _bridge._b


class Direction:
    INPUT = False
    OUTPUT = True


class DriveMode:
    PUSH_PULL = 0
    OPEN_DRAIN = 1


class Pull:
    UP = "up"
    DOWN = "down"


class DigitalInOut:
    def __init__(self, pin):
        self.pin = int(pin)
        self.direction = Direction.INPUT
        self.pull = None
        _b.gpio_setup(self.pin, "in", "none")

    def switch_to_output(self, value=False, drive_mode=DriveMode.PUSH_PULL):
        self.direction = Direction.OUTPUT
        _b.gpio_setup(self.pin, "out", "none")
        self.value = value

    def switch_to_input(self, pull=None):
        self.direction = Direction.INPUT
        self.pull = pull
        _b.gpio_setup(self.pin, "in", pull or "none")

    @property
    def value(self):
        return bool(int(_b.gpio_read(self.pin)))

    @value.setter
    def value(self, v):
        _b.gpio_write(self.pin, 1 if v else 0)

    def deinit(self):
        return None
