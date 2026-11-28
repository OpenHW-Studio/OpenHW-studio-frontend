"""LIS3DH accelerometer over simulated I2C registers."""

from rpi_sim import _bridge, devices

_b = _bridge._b
ADDR = 0x19


def _ensure(addr):
    if not _b.i2c_has(1, addr):
        regs = [0] * 256
        regs[0x28], regs[0x29] = 0x40, 0x00
        devices.I2CRegisterDevice(1, addr, "lis3dh", regs)


class LIS3DH:
    def __init__(self, i2c_bus=None, address=ADDR):
        self.addr = int(address)
        _ensure(self.addr)
        self._device = devices.I2CRegisterDevice(1, self.addr, "lis3dh", attach=False)

    @property
    def acceleration(self):
        data = self._device.read(0x28, 6)
        v = (data[0] << 8) | data[1]
        return (v / 16384.0, 0.0, 0.0)
