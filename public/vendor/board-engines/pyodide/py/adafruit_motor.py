"""adafruit-motor style DC motor and servo using simulated PWM."""

from gpiozero import PWMLED


class Motor:
    def __init__(self, pin, direction_pin=None):
        self._pwm = PWMLED(pin)
        self._direction = None
        if direction_pin is not None:
            self._direction = PWMLED(direction_pin)

    @property
    def throttle(self):
        return self._pwm.value * 2 - 1

    @throttle.setter
    def throttle(self, value):
        value = max(-1.0, min(1.0, float(value)))
        if self._direction is not None and value < 0:
            self._direction.value = 1.0
        self._pwm.value = (value + 1.0) / 2.0


class Servo:
    def __init__(self, pin):
        from gpiozero import Servo as _Servo
        self._servo = _Servo(pin)

    @property
    def angle(self):
        return self._servo.angle

    @angle.setter
    def angle(self, value):
        self._servo.angle = value
