"""ServoKit-style PWM/servo channels backed by the PCA9685 register model."""

from adafruit_pca9685 import PCA9685


class ServoKit:
    def __init__(self, channels=16, address=0x41, i2c=None):
        self.channels = int(channels)
        self._pca = PCA9685(address=address)
        self._servos = self._ServoArray(self)

    @property
    def servo(self):
        return self._servos

    class _ServoArray:
        def __init__(self, kit):
            self.kit = kit
            self._angles = {}

        def __getitem__(self, channel):
            return self._angles.get(int(channel), 0)

        def __setitem__(self, channel, angle):
            channel = int(channel)
            angle = max(0.0, min(180.0, float(angle)))
            self._angles[channel] = angle
            self.kit._pca.set_duty_cycle(channel, 0.02 + 0.10 * angle / 180.0)
