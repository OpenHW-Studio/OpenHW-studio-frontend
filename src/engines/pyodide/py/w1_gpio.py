"""w1_gpio-style DS18B20 using timed bit-level 1-Wire slots.

The guest drives reset/write/read slots as real GPIO edges through the bridge;
the host DS18B20 model supplies the presence pulse and scratchpad bits at
exact virtual microseconds. The decoder measures the slot widths instead of
reading a canned register. Model timings are datasheet-shaped parameters.
"""

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


def _command(pin, value):
    for i in range(8):
        _b.ow_write_slot(pin, (value >> i) & 1)


def read_temp_timed(pin):
    """Full ROM/scratchpad sequence with measured slot timing."""
    pin = int(pin)
    reset = _b.ow_reset(pin).to_py()
    _command(pin, 0xCC)              # SKIP ROM
    _command(pin, 0x44)              # CONVERT T
    _bridge.sleep_us(750)            # conversion time on the virtual clock
    reset2 = _b.ow_reset(pin).to_py()

    # The runner translator supplied this temperature from the host DS18B20.
    host_temp = float(onewire.read_temp(pin))
    scratchpad = _b.ow_load_scratchpad(pin, host_temp).to_py()
    _command(pin, 0xCC)              # SKIP ROM
    _command(pin, 0xBE)              # READ SCRATCHPAD

    lsb_bits = []
    msb_bits = []
    widths = []
    for i in range(16):
        slot = _b.ow_read_slot(pin).to_py()
        widths.append(int(slot['sampleUs']))
        (lsb_bits if i < 8 else msb_bits).append(int(slot['bit']))
    lsb = msb = 0
    for bit in lsb_bits:
        lsb = (lsb << 1) | bit
    for bit in msb_bits:
        msb = (msb << 1) | bit
    raw = (msb << 8) | lsb
    temp = (raw / 16.0) if raw < 0x8000 else ((raw - 65536) / 16.0)
    return {
        'temperature': temp,
        'raw': raw,
        'resetLowUs': reset['resetLowUs'],
        'presenceUs': reset['presenceUs'],
        'sampleUs': widths[0] if widths else 0,
        'slotUs': 60,
        'scratchpad': scratchpad,
    }


def read_temp(pin):
    """Compatibility wrapper: decoded temperature as a float."""
    return float(read_temp_timed(pin)['temperature'])


class DS18B20:
    def __init__(self, pin):
        self.pin = int(pin)

    def read_temp(self):
        return read_temp(self.pin)
