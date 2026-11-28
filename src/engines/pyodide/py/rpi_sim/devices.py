"""Generic attachable I2C/SPI register devices for sensor shims."""

from rpi_sim import _bridge

_b = _bridge._b


class I2CRegisterDevice:
    """A simple register-pointer device attached to the JS I2C model."""

    def __init__(self, bus, addr, kind="custom", registers=None, length=256, attach=True):
        self.bus = int(bus)
        self.addr = int(addr) & 0x7f
        if attach:
            initial = None if registers is None else [int(v) & 0xff for v in registers]
            _b.i2c_attach_regfile(self.bus, self.addr, kind, length, initial)

    def write(self, register, values=()):
        data = [int(register) & 0xff] + [int(v) & 0xff for v in values]
        return _b.i2c_write(self.bus, self.addr, data)

    def read(self, register, count=1):
        _b.i2c_write(self.bus, self.addr, [int(register) & 0xff])
        return list(_b.i2c_read(self.bus, self.addr, count))

    def read_u16be(self, register):
        hi, lo = self.read(register, 2)
        return (int(hi) << 8) | int(lo)


class SPIRegisterDevice:
    """Register access over an spidev-style bridge (address byte first)."""

    def __init__(self, bus=0, device=0):
        self.bus = int(bus)
        self.device = int(device)

    def write(self, register, value):
        return list(_b.spi_xfer(self.bus, self.device,
                                [0x80 | (int(register) & 0x7f), int(value) & 0xff]))

    def read(self, register):
        return list(_b.spi_xfer(self.bus, self.device, [int(register) & 0x7f, 0]))[1]
