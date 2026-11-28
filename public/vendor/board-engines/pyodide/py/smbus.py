"""smbus-compatible I2C access backed by the JS I2C model."""

from rpi_sim import _bridge

_b = _bridge._bridge


class SMBus:
    def __init__(self, bus=1):
        self.bus = int(bus)

    def write_byte(self, addr, value):
        return _b.i2c_write(self.bus, addr, [int(value) & 0xff])

    def read_byte(self, addr):
        return _b.i2c_read(self.bus, addr, 1)[0]

    def write_byte_data(self, addr, register, value):
        return _b.i2c_write(self.bus, addr, [int(register) & 0xff, int(value) & 0xff])

    def read_byte_data(self, addr, register):
        _b.i2c_write(self.bus, addr, [int(register) & 0xff])
        return _b.i2c_read(self.bus, addr, 1)[0]

    def write_i2c_block_data(self, addr, register, values):
        data = [int(register) & 0xff] + [int(v) & 0xff for v in values]
        return _b.i2c_write(self.bus, addr, data)

    def read_i2c_block_data(self, addr, register, length):
        _b.i2c_write(self.bus, addr, [int(register) & 0xff])
        return list(_b.i2c_read(self.bus, addr, length))

    def close(self):
        return None
