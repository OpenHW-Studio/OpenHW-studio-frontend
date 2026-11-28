"""luma.lcd-compatible text display over the simulated HD44780 buffer."""

from rpi_sim import _bridge

_b = _bridge._b


class pcd8544:
    def __init__(self, width=84, height=48, **kwargs):
        self.width = width
        self.height = height
        _b.lcd_create("luma", (width // 6), (height // 8))

    def display(self):
        return True

    def clear(self):
        return _b.lcd_clear("luma")


def text(value, **kwargs):
    return _b.lcd_write("luma", str(value))
