"""RPLCD CharLCD-style text output over the HD44780 model."""

from rpi_sim import _bridge

_b = _bridge._b


class CharLCD:
    def __init__(self, gpio=None, cols=16, rows=2, pin_rs=None, pin_e=None, pins_data=None):
        self.cols = int(cols)
        self.rows = int(rows)
        self.lines = ["", ""]
        _b.lcd_create("rplcd", self.cols, self.rows)

    def write_string(self, text):
        line = str(text).replace("\n", " ")[:self.cols]
        self.lines[0] = line
        return _b.lcd_write("rplcd", line)

    def clear(self):
        self.lines = ["", ""]
        return _b.lcd_clear("rplcd")

    def close(self):
        return None
