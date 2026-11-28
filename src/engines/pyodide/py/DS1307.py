"""DS1307 RTC facade (same BCD register layout as the simulated PCF8523)."""

from adafruit_pcf8523 import PCF8523


class DS1307:
    def __init__(self, bus=1, address=0x68):
        self._dev = PCF8523(address=address)

    def read_datetime(self):
        return self._dev.datetime
