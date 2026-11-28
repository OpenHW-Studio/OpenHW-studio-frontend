"""MCP9808 temperature sensor over the default I2C device at 0x18."""

from rpi_sim import _bridge

_b = _bridge._b


class MCP9808:
    def __init__(self, i2c_bus=None, address=0x18):
        self.addr = int(address)

    @property
    def temperature(self):
        _b.i2c_write(1, self.addr, [0x05])
        data = _b.i2c_read(1, self.addr, 2)
        return float(data[0]) + ((int(data[1]) >> 4) / 16.0)
