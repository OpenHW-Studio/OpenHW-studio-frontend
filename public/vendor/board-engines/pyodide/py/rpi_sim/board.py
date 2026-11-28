"""Board identity, header pin naming and onboard LEDs."""

from rpi_sim import _bridge

BCM = 11
BOARD = 10

# 40-pin header: physical pin -> BCM number. None = power/ground.
BOARD_TO_BCM = {
    1: None, 2: None, 3: 2, 4: None, 5: 3, 6: None, 7: 4, 8: 14,
    9: None, 10: 15, 11: 17, 12: 18, 13: 27, 14: None, 15: 22, 16: 23,
    17: None, 18: 24, 19: 10, 20: None, 21: 9, 22: 25, 23: 11, 24: 8,
    25: None, 26: 7, 27: 0, 28: 1, 29: 5, 30: None, 31: 6, 32: 12,
    33: 13, 34: None, 35: 19, 36: 16, 37: 26, 38: 20, 39: None, 40: 21,
}
BCM_TO_BOARD = {bcm: pin for pin, bcm in BOARD_TO_BCM.items() if bcm is not None}


def to_bcm(pin, mode=BCM):
    """Translate a BCM or physical header pin number to BCM."""
    pin = int(pin)
    if mode == BCM:
        return pin
    if mode == BOARD:
        bcm = BOARD_TO_BCM.get(pin)
        if bcm is None:
            raise ValueError(f"physical pin {pin} is not a GPIO")
        return bcm
    raise ValueError("unknown pin numbering mode")


def board_info():
    state = _bridge.snapshot()
    keys = ("board", "soc", "cpuClockMHz", "pwmClockHz", "pwmPins",
            "i2cBuses", "spiBuses", "spiMaxHz", "optionalSpiBuses",
            "pullUpOhms", "onboardLed", "cpuTempC")
    return {key: state[key] for key in keys}


def onboard_led(name, on=None):
    if on is None:
        return _bridge._b.led_read(name).to_py()
    return _bridge._b.led_write(name, bool(on))
