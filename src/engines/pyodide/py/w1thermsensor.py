"""w1thermsensor-style DS18B20 access over the 1-Wire bridge."""

from rpi_sim import onewire


class W1ThermSensor:
    THERMOMETER_DS18B20 = "DS18B20"

    def __init__(self, sensor_type=None, pin=4):
        self.type = sensor_type or self.THERMOMETER_DS18B20
        self.pin = int(pin)

    def get_temperature(self, unit=None):
        c = onewire.read_temp(self.pin)
        return c * 9 / 5 + 32 if unit == self.DEGREES_FAHRENHEIT else c

    DEGREES_CELSIUS = "c"
    DEGREES_FAHRENHEIT = "f"

    @classmethod
    def get_available_sensors(cls, types=None):
        return []
