"""spidev-compatible SPI access backed by the JS SPI model."""

from rpi_sim import _bridge

_b = _bridge._bridge


class SpiDev:
    def __init__(self):
        self.bus = 0
        self.dev = 0

    def open(self, bus, dev):
        self.bus = int(bus)
        self.dev = int(dev)
        return None

    def xfer(self, values):
        return list(_b.spi_xfer(self.bus, self.dev, [int(v) & 0xff for v in values]))

    def xfer2(self, values):
        return self.xfer(values)

    def writebytes(self, values):
        return _b.spi_xfer(self.bus, self.dev, [int(v) & 0xff for v in values]) and None

    def readbytes(self, count):
        return list(_b.spi_xfer(self.bus, self.dev, [0] * int(count)))

    def close(self):
        return None
