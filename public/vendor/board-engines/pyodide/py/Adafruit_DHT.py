"""Adafruit_DHT decoding the simulated DHT22 start/response/bit waveform."""

import json

from rpi_sim import _bridge, environment

_b = _bridge._b
DHT11 = 11
DHT22 = 22
AM2302 = 22


def _bits(pin):
    return json.loads(_b.dht_waveform(int(pin)))["bits"]


def read(sensor, pin):
    bits = _bits(pin)
    values = []
    for offset in range(0, 40, 8):
        value = 0
        for bit in bits[offset:offset + 8]:
            value = (value << 1) | int(bit)
        values.append(value)
    humidity = ((values[0] << 8) | values[1]) / 10.0
    temperature = ((values[2] << 8) | values[3]) / 10.0
    return humidity, temperature


def read_retry(sensor, pin, retries=15, delay_seconds=2):
    return read(sensor, pin)


class DHT:
    def __init__(self, sensor=DHT22, pin=4):
        self.sensor = int(sensor)
        self.pin = int(pin)

    def read(self):
        return read(self.sensor, self.pin)
