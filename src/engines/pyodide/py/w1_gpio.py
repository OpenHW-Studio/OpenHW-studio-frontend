"""w1_gpio-style DS18B20 using real ROM/scratchpad command sequences."""

import time

from rpi_sim import _bridge, onewire

_b = _bridge._b


def read_rom(pin):
    _b.onewire_reset(pin)
    _b.onewire_write_byte(pin, 0x33)
    return [_b.onewire_read_byte(pin) for _ in range(8)]


def match_rom(pin, rom):
    _b.onewire_reset(pin)
    _b.onewire_write_byte(pin, 0x55)
    for byte in rom:
        _b.onewire_write_byte(pin, byte)
    return True


def read_temp(pin):
    _b.onewire_reset(pin)
    _b.onewire_write_byte(pin, 0xcc)   # SKIP ROM
    _b.onewire_write_byte(pin, 0x44)   # CONVERT T
    while _b.onewire_busy(pin):
        time.sleep(0.01)
    _b.onewire_reset(pin)
    _b.onewire_write_byte(pin, 0xcc)
    _b.onewire_write_byte(pin, 0xbe)   # READ SCRATCHPAD
    data = [_b.onewire_read_byte(pin) for _ in range(9)]
    raw = (data[0] << 8) | data[1]
    return (raw / 16.0) if raw < 0x8000 else ((raw - 65536) / 16.0)


class DS18B20:
    def __init__(self, pin):
        self.pin = int(pin)

    def read_temp(self):
        return read_temp(self.pin)
