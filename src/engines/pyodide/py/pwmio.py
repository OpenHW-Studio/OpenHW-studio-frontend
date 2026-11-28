"""CircuitPython-style PWMOut backed by the board-specific PWM model."""

from rpi_sim import _bridge

_b = _bridge._b


class PWMOut:
    def __init__(self, pin, frequency=500, duty_cycle=0, variable_frequency=False):
        self.pin = int(pin)
        self.frequency = int(frequency)
        _b.pwm_create(self.pin, self.frequency)
        self.duty_cycle = int(duty_cycle)

    @property
    def duty_cycle(self):
        return int(round(self._duty * 65535 / 100.0))

    @duty_cycle.setter
    def duty_cycle(self, value):
        self._duty = _b.pwm_duty(self.pin, max(0.0, min(100.0, 100.0 * int(value) / 65535.0)))

    @property
    def frequency(self):
        return self._frequency

    @frequency.setter
    def frequency(self, value):
        self._frequency = _b.pwm_frequency(self.pin, value) if hasattr(self, "_duty") else int(value)

    def deinit(self):
        return _b.pwm_stop(self.pin)
