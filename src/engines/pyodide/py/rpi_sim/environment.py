"""Shared deterministic environment model for behavioural sensor shims."""

import json

from rpi_sim import _bridge

_b = _bridge._b


def set(**values):
    return _b.env_set(values).to_py()


def get():
    return json.loads(_b.env_get())


def set_temperature(celsius):
    return set(tempC=celsius)


def set_humidity(percent):
    return set(humidity=percent)
