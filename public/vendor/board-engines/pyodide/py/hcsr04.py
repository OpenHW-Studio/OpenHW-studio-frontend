"""HC-SR04 ultrasonic distance sensor using virtual edge timestamps."""

from gpiozero import DistanceSensor
from rpi_sim import _bridge

_b = _bridge._b


class HCSR04:
    def __init__(self, trigger, echo):
        self._dev = DistanceSensor(trigger, echo)

    @property
    def distance(self):
        return self._dev.distance

    def measure(self):
        return self.distance

    def distance_behaviour(self):
        """Temperature-corrected distance from the generated echo pulse."""
        return _b.hcsr04_measure(self._dev.trigger, self._dev.echo)
