"""BH1750 ambient light sensor over simulated I2C registers."""

from rpi_sim import _bridge, devices

_b = _bridge._b
ADDR = 0x23


def _ensure(addr):
    if not _b.i2c_has(1, addr):
        regs = [0x01, 0xF4]  # 500 raw -> ~416 lux
        devices.I2CRegisterDevice(1, addr, "bh1750", regs)


class BH1750:
    def __init__(self, i2c_bus=None, address=ADDR):
        self.addr = int(address)
        _ensure(self.addr)
        self._device = devices.I2CRegisterDevice(1, self.addr, "bh1750", attach=False)

    @property
    def lux(self):
        return round(self._device.read_u16be(0x00) / 1.2, 2)
