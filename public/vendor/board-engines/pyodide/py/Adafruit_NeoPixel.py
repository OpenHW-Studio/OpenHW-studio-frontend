"""Adafruit_NeoPixel over the simulated WS2812 strip model."""

from rpi_sim import _bridge

_b = _bridge._b


class Adafruit_NeoPixel:
    def __init__(self, numPixels, pin, freq_hz=800000, dma=5, invert=False, brightness=255):
        self.n = int(numPixels)
        self.pin = int(pin)
        self.brightness = int(brightness)
        _b.neopixel_setup(self.pin, self.n)

    def setPixelColor(self, n, color, green=None, blue=None):
        if green is None and isinstance(color, (tuple, list)):
            r, g, b = color
        elif green is None:
            r = (color >> 16) & 0xff
            g = (color >> 8) & 0xff
            b = color & 0xff
        else:
            r, g, b = color, green, blue
        return _b.neopixel_set(self.pin, n, r, g, b)

    def fill(self, color, first=0, count=None):
        r = (color >> 16) & 0xff
        g = (color >> 8) & 0xff
        b = color & 0xff
        return _b.neopixel_fill(self.pin, r, g, b)

    def show(self):
        return True
