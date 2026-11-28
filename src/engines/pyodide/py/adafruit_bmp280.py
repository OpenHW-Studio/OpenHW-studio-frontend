"""BMP280 temperature/pressure over simulated I2C registers."""

from adafruit_bme280 import BME280 as _BME280


class BMP280:
    def __init__(self, i2c_bus=None, address=0x77):
        self._dev = _BME280(address=address)

    @property
    def temperature(self):
        return self._dev.temperature

    @property
    def pressure(self):
        return self._dev.pressure
