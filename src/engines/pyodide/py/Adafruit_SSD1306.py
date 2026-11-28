"""SSD1306 OLED driver over the I2C framebuffer model."""

from rpi_sim import _bridge

_b = _bridge._b


class SSD1306:
    def __init__(self, width=128, height=64, bus=1, address=0x3c):
        self.width = int(width)
        self.height = int(height)
        self.bus = int(bus)
        self.address = int(address)
        self.buffer = [0] * ((width * height) // 8)
        _b.i2c_write(self.bus, self.address, [0x00, 0xae])

    def display(self):
        rows = self.height // 8
        for page in range(rows):
            start = page * self.width
            chunk = self.buffer[start:start + self.width]
            _b.i2c_write(self.bus, self.address, [0x40] + chunk)
        return True

    def show(self):
        return self.display()
