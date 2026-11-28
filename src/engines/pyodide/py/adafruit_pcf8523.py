"""PCF8523 RTC over simulated I2C BCD registers."""

from rpi_sim import _bridge, devices

_b = _bridge._b
ADDR = 0x68


def _ensure(addr):
    if not _b.i2c_has(1, addr):
        regs = [0x00, 0x30, 0x12, 0x03, 0x15, 0x11, 0x26]
        devices.I2CRegisterDevice(1, addr, "pcf8523", regs)


class PCF8523:
    def __init__(self, i2c_bus=None, address=ADDR):
        self.addr = int(address)
        _ensure(self.addr)
        self._device = devices.I2CRegisterDevice(1, self.addr, "pcf8523", attach=False)

    @property
    def datetime(self):
        sec, minute, hour, weekday, day, month, year = self._device.read(0x00, 7)
        bcd = lambda v: (int(v) >> 4) * 10 + (int(v) & 0x0f)
        return (2000 + bcd(year), bcd(month), bcd(day), bcd(hour), bcd(minute), bcd(sec))
