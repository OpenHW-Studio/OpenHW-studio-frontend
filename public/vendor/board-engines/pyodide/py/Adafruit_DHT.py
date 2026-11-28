"""Adafruit_DHT decoding a *timed* DHT22 waveform.

The guest drives the start pulse as real GPIO edges, the host sensor model
supplies the response/data edges at exact virtual microseconds, and the
decoder measures the resulting edge log (26 us = 0, 70 us = 1) instead of
reading a canned register. Model timings are datasheet-shaped parameters,
not measured silicon timing.
"""

import json

from rpi_sim import _bridge, environment

_b = _bridge._b
DHT11 = 11
DHT22 = 22
AM2302 = 22


def _waveform(pin):
    pin = int(pin)
    _b.gpio_setup(pin, 'out')
    _b.gpio_write(pin, 0)
    _bridge.sleep_us(2)
    _b.gpio_write(pin, 1)                # guarantee a falling edge at start
    _bridge.sleep_us(2)
    start = _b.dht_start(pin).to_py()
    _b.gpio_write(pin, 0)
    _bridge.sleep_us(18000)          # 18 ms start pulse
    _b.gpio_write(pin, 1)
    _b.dht_reply(pin)                # host supplies the reply at exact times
    _bridge.sleep_us(6000)           # advance the virtual clock past 40 bits
    edges = _b.protocol_edges(pin, start['from']).to_py()
    timing = _b.dht_timing(pin).to_py()

    # The guest start pulse and the 80 us sensor response are low pulses
    # (falling -> rising); each data bit's *high* pulse (rising -> falling)
    # carries the 26 us (0) / 70 us (1) value.
    start_fall = next((e for e in edges if e['source'] == 'guest' and e['edge'] == 'falling'), None)
    start_rise = next((e for e in edges if e['source'] == 'guest' and e['edge'] == 'rising'), None)
    device = [e for e in edges if e['source'] == 'device']
    response_fall = device[0]
    response_rise = device[1]
    bit_edges = device[2:]
    first_rise = next((i for i, e in enumerate(bit_edges) if e['edge'] == 'rising'), 0)
    highs = []
    for i in range(first_rise, len(bit_edges) - 1, 2):
        if bit_edges[i]['edge'] == 'rising' and bit_edges[i + 1]['edge'] == 'falling':
            highs.append(round(bit_edges[i + 1]['tUs'] - bit_edges[i]['tUs']))
    if start_fall is None or start_rise is None or len(highs) < 40:
        raise ValueError(f'DHT22 pin {pin}: incomplete waveform ({len(highs)} data bits, {len(edges)} edges)')
    highs = highs[:40]
    start_pulse_us = round(start_rise['tUs'] - start_fall['tUs'])
    response_low_us = round(response_rise['tUs'] - response_fall['tUs'])
    bits = [1 if width > 45 else 0 for width in highs]
    values = []
    for offset in range(0, 40, 8):
        value = 0
        for bit in bits[offset:offset + 8]:
            value = (value << 1) | int(bit)
        values.append(value)
    return {
        'humidity': ((values[0] << 8) | values[1]) / 10.0,
        'temperature': ((values[2] << 8) | values[3]) / 10.0,
        'bits': bits,
        'startPulseUs': start_pulse_us,
        'responseLowUs': response_low_us,
        'bitHighsUs': highs,
        'modelHighsUs': timing['bitHighsUs'],
    }


def read(sensor, pin):
    wave = _waveform(pin)
    return wave['humidity'], wave['temperature']


def read_timed(sensor, pin):
    """Same decode plus measured pulse widths for timing assertions."""
    return _waveform(pin)


def read_retry(sensor, pin, retries=15, delay_seconds=2):
    return read(sensor, pin)


class DHT:
    def __init__(self, sensor=DHT22, pin=4):
        self.sensor = int(sensor)
        self.pin = int(pin)

    def read(self):
        return read(self.sensor, self.pin)
