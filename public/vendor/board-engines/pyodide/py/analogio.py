"""CircuitPython-style analog input backed by the MCP3008 model."""

from rpi_sim import _bridge

_b = _bridge._b


class AnalogIn:
    def __init__(self, pin, channel=None):
        self.pin = int(pin)
        self.channel = int(channel if channel is not None else pin)

    @property
    def value(self):
        return int(_b.adc_read(self.channel))

    @property
    def voltage(self):
        return self.value * 3.3 / 1023.0

    def deinit(self):
        return None
