"""BME280 temperature/pressure/humidity over simulated I2C registers."""

from rpi_sim import _bridge, devices

_b = _bridge._b
ADDR = 0x76


def _ensure(addr):
    if not _b.i2c_has(1, addr):
        regs = [0] * 256
        regs[0xFA], regs[0xFB] = 0x09, 0x2E          # 2350 -> 23.5 C
        regs[0xF7], regs[0xF8] = 0x27, 0x10                   # 10000 -> 1000 hPa
        regs[0xFD], regs[0xFE] = 0x13, 0x88          # 5000 -> 50 %
        devices.I2CRegisterDevice(1, addr, "bme280", regs)


class BME280:
    def __init__(self, i2c_bus=None, address=ADDR):
        self.addr = int(address)
        _ensure(self.addr)
        self._device = devices.I2CRegisterDevice(1, self.addr, "bme280", attach=False)

    @property
    def temperature(self):
        return self._device.read_u16be(0xFA) / 100.0

    @property
    def pressure(self):
        return self._device.read_u16be(0xF7) / 10.0

    @property
    def humidity(self):
        return self._device.read_u16be(0xFD) / 100.0

