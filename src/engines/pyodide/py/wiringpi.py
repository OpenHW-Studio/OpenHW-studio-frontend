"""WiringPi-style numbering and GPIO facade over the JS bridge."""

from rpi_sim import _bridge
from rpi_sim.board import BCM_TO_BOARD, BOARD_TO_BCM

_b = _bridge._b

INPUT = 0
OUTPUT = 1
LOW = 0
HIGH = 1
PUD_OFF = 0
PUD_DOWN = 1
PUD_UP = 2


def _bcm(pin):
    """WiringPi numbers are the physical header pins in this subset."""
    bcm = BOARD_TO_BCM.get(int(pin))
    if bcm is None:
        raise ValueError(f"wiringPi pin {pin} is not a GPIO")
    return bcm


def wiringPiSetup():
    return 0


def pinMode(pin, mode):
    return _b.gpio_setup(_bcm(pin), "out" if mode == OUTPUT else "in", "none")


def digitalWrite(pin, value):
    return _b.gpio_write(_bcm(pin), 1 if value else 0)


def digitalRead(pin):
    return int(_b.gpio_read(_bcm(pin)))


def pullUpDnControl(pin, pud):
    pull = {PUD_UP: "up", PUD_DOWN: "down"}.get(pud, "none")
    return _b.gpio_setup(_bcm(pin), "in", pull)
