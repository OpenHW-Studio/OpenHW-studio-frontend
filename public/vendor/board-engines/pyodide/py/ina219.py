"""INA219 current/voltage monitor over simulated I2C registers."""

from rpi_sim import _bridge, devices

_b = _bridge._b
ADDR = 0x40


def _ensure(addr):
    if not _b.i2c_has(1, addr):
        regs = [0] * 256
        regs[0x02], regs[0x03] = 0x0F, 0xA0   # 4.0 V
        regs[0x04], regs[0x05] = 0x00, 0x64   # 1.0 A
        devices.I2CRegisterDevice(1, addr, "ina219", regs)


class INA219:
    def __init__(self, i2c_bus=None, addr=ADDR):
        self.addr = int(addr)
        _ensure(self.addr)
        self._device = devices.I2CRegisterDevice(1, self.addr, "ina219", attach=False)

    @property
    def bus_voltage(self):
        return self._device.read_u16be(0x02) / 1000.0

    @property
    def current(self):
        return self._device.read_u16be(0x04) / 100.0
