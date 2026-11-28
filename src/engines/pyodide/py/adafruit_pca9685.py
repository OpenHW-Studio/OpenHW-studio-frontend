"""PCA9685 16-channel PWM driver over the simulated I2C register file."""

from rpi_sim import _bridge, devices

_b = _bridge._b
LED0_ON_L = 0x06


def _ensure(addr):
    if not _b.i2c_has(1, addr):
        devices.I2CRegisterDevice(1, addr, "pca9685")


class PCA9685:
    def __init__(self, i2c_bus=None, address=0x40):
        self.addr = int(address)
        _ensure(self.addr)
        self._device = devices.I2CRegisterDevice(1, self.addr, "pca9685", attach=False)

    def set_pwm(self, channel, on, off):
        reg = LED0_ON_L + 4 * int(channel)
        self._device.write(reg, [on & 0xff, on >> 8, off & 0xff, off >> 8])
        return None

    def set_duty_cycle(self, channel, duty):
        off = int(max(0.0, min(1.0, float(duty))) * 4095)
        return self.set_pwm(channel, 0, off)

    @property
    def channels(self):
        return 16
