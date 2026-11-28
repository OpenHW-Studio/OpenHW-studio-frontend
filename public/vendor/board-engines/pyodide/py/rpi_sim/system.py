"""Board-level system information backed by the JS board profile."""

from rpi_sim import _bridge


def cpu_temperature():
    """Die temperature in degrees Celsius for the selected board."""
    return float(_bridge._b.cpu_temp())


def set_cpu_temperature(celsius):
    """Host-side injection for testing thermal logic."""
    return float(_bridge._b.cpu_temp_set(celsius))


def board_name():
    return _bridge.snapshot()["board"]
