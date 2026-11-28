"""CircuitPython neopixel facade over Adafruit_NeoPixel."""

from Adafruit_NeoPixel import Adafruit_NeoPixel as _Strip


class NeoPixel(_Strip):
    def __init__(self, pin, n, **kwargs):
        super().__init__(n, pin, **kwargs)

    def __setitem__(self, index, color):
        self.setPixelColor(index, color)

    def __getitem__(self, index):
        return (0, 0, 0)
