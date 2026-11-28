"""Simplified 1-Wire DS18B20 access backed by the JS 1-Wire model."""

from rpi_sim import _bridge


def set_temperature(pin, celsius):
    return float(_bridge._b.onewire_set(int(pin), celsius))


def read_temp(pin):
    return float(_bridge._b.onewire_read(int(pin)))
