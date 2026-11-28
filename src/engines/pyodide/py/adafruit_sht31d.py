"""SHT31-D temperature/humidity over simulated I2C registers."""

from rpi_sim import _bridge, devices

_b = _bridge._b
ADDR = 0x44


def _ensure(addr):
    if not _b.i2c_has(1, addr):
        regs = [0] * 256
        regs[0], regs[1] = 0x09, 0x2E
        regs[3], regs[4] = 0x13, 0x88
        devices.I2CRegisterDevice(1, addr, "sht31d", regs)


class SHT31D:
    def __init__(self, i2c_bus=None, address=ADDR):
        self.addr = int(address)
        _ensure(self.addr)
        self._device = devices.I2CRegisterDevice(1, self.addr, "sht31d", attach=False)

    @property
    def temperature(self):
        return self._device.read_u16be(0x00) / 100.0

    @property
    def relative_humidity(self):
        return self._device.read_u16be(0x03) / 100.0
