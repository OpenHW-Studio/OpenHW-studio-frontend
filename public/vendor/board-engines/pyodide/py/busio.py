"""CircuitPython-style bus objects backed by the simulated I2C/SPI models."""

from rpi_sim import _bridge

_b = _bridge._b


class I2C:
    def __init__(self, bus=1, scl=None, sda=None, frequency=100000):
        self.bus = int(bus)
        self.frequency = int(frequency)

    def writeto(self, addr, buf, start=0, end=None):
        data = list(buf)[start:end]
        return _b.i2c_write(self.bus, addr, data)

    def readfrom_into(self, addr, buf):
        data = _b.i2c_read(self.bus, addr, len(buf))
        for i, value in enumerate(data):
            buf[i] = int(value) & 0xff
        return len(data)

    def readfrom(self, addr, count):
        return bytes(int(v) & 0xff for v in _b.i2c_read(self.bus, addr, count))

    def try_lock(self):
        return True

    def unlock(self):
        return None


class SPI:
    def __init__(self, bus=0, sck=None, mosi=None, miso=None, baudrate=1000000):
        self.bus = int(bus)
        self.baudrate = int(baudrate)

    def write_readinto(self, out_buf, in_buf):
        data = _b.spi_xfer(self.bus, 0, list(out_buf))
        for i, value in enumerate(data[:len(in_buf)]):
            in_buf[i] = int(value) & 0xff
        return None

    def try_lock(self):
        return True

    def unlock(self):
        return None
