"""MPU-6050 IMU over simulated I2C registers."""

from rpi_sim import _bridge, devices

_b = _bridge._b
ADDR = 0x69


def _ensure(addr):
    if not _b.i2c_has(1, addr):
        regs = [0] * 256
        regs[0x3B], regs[0x3C] = 0x40, 0x00   # +1 g
        devices.I2CRegisterDevice(1, addr, "mpu6050", regs)


class MPU6050:
    def __init__(self, i2c_bus=None, address=ADDR):
        self.addr = int(address)
        _ensure(self.addr)
        self._device = devices.I2CRegisterDevice(1, self.addr, "mpu6050", attach=False)

    @property
    def acceleration(self):
        data = self._device.read(0x3B, 6)
        v = (data[0] << 8) | data[1]
        return (v / 16384.0, 0.0, 0.0)
