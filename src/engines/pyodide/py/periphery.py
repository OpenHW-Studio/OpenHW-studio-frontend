"""periphery-style GPIO/I2C/SPI/PWM classes backed by the bridge."""

from rpi_sim import _bridge

_b = _bridge._b


class GPIO:
    def __init__(self, pin):
        self.pin = int(pin)
        self.direction = "in"

    def open(self, direction, bias=None):
        self.direction = direction
        pull = "up" if bias == "pull_up" else "down" if bias == "pull_down" else "none"
        return _b.gpio_setup(self.pin, direction, pull)

    def read(self):
        return int(_b.gpio_read(self.pin))

    def write(self, value):
        return _b.gpio_write(self.pin, 1 if value else 0)

    def close(self):
        return None


class I2C:
    def __init__(self, bus):
        self.bus = int(bus)

    def transfer(self, addr, writes=(), read_len=0):
        if writes:
            _b.i2c_write(self.bus, addr, list(writes))
        return list(_b.i2c_read(self.bus, addr, read_len)) if read_len else []

    def close(self):
        return None


class SPI:
    def __init__(self, bus, device=0):
        self.bus = int(bus)
        self.device = int(device)

    def transfer(self, data):
        return list(_b.spi_xfer(self.bus, self.device, list(data)))

    def close(self):
        return None


class PWM:
    def __init__(self, chip, channel):
        self.pin = int(channel)

    def enable(self, period_ns, duty_ns):
        _b.pwm_create(self.pin, max(1, int(1000000000 / period_ns)))
        duty = 100.0 * duty_ns / period_ns
        return _b.pwm_duty(self.pin, duty)

    def disable(self):
        return _b.pwm_stop(self.pin)
