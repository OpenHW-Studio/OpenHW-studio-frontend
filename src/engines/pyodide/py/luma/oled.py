"""luma.oled-compatible I2C display over the SSD1306 model."""

from Adafruit_SSD1306 import SSD1306


class ssd1306:
    I2C = "i2c"

    def __init__(self, display_type, interface, width=128, height=64, **kwargs):
        self.device = SSD1306(width=width, height=height)

    def display(self):
        return self.device.display()

    def clear(self):
        self.device.buffer = [0] * len(self.device.buffer)
        return True
