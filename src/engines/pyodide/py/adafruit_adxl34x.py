"""ADXL345 accelerometer over simulated I2C registers."""

from rpi_sim import _bridge, devices

_b = _bridge._b
ADDR = 0x53


def _ensure(addr):
    if not _b.i2c_has(1, addr):
        regs = [0] * 256
        regs[0x32], regs[0x33] = 0x01, 0x00   # +1 g (256 raw)
        regs[0x34], regs[0x35] = 0x00, 0x00
        regs[0x36], regs[0x37] = 0x01, 0x00
        devices.I2CRegisterDevice(1, addr, "adxl345", regs)


class ADXL345:
    def __init__(self, i2c_bus=None, address=ADDR):
        self.addr = int(address)
        _ensure(self.addr)
        self._device = devices.I2CRegisterDevice(1, self.addr, "adxl345", attach=False)

    @property
    def acceleration(self):
        def signed(hi, lo):
            v = (hi << 8) | lo
            return (v - 65536 if v > 32767 else v) / 256.0
        data = self._device.read(0x32, 6)
        return (signed(data[0], data[1]), signed(data[2], data[3]), signed(data[4], data[5]))
