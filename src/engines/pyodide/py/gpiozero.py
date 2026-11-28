"""gpiozero-style device API backed by the JS peripheral models."""

from rpi_sim import _bridge

_b = _bridge._b

_STATE_IDX = {(0, 0): 0, (0, 1): 1, (1, 1): 2, (1, 0): 3}
_QUAD = {
    (2, 1): -1, (1, 0): -1, (0, 3): -1, (3, 2): -1,
    (2, 3): 1, (3, 0): 1, (0, 1): 1, (1, 2): 1,
}


class OutputDevice:
    def __init__(self, pin, active_high=True, initial_value=False):
        self.pin = int(pin)
        self.active_high = bool(active_high)
        _b.gpio_setup(self.pin, "out", "none")
        self.value = initial_value
        self._apply()

    def _apply(self):
        _b.gpio_write(self.pin, int(bool(self.value) == self.active_high))

    def on(self):
        self.value = True
        self._apply()

    def off(self):
        self.value = False
        self._apply()

    def toggle(self):
        self.value = not self.value
        self._apply()

    def close(self):
        self.off()


class LED(OutputDevice):
    @property
    def is_lit(self):
        return bool(self.value)


class PWMLED(OutputDevice):
    def __init__(self, pin, frequency=1000):
        self.pin = int(pin)
        _b.pwm_create(self.pin, frequency)
        self._duty = 0

    @property
    def value(self):
        return self._duty / 100.0

    @value.setter
    def value(self, v):
        self._duty = _b.pwm_duty(self.pin, max(0.0, min(1.0, float(v))) * 100)

    @property
    def is_lit(self):
        return self._duty > 0

    def on(self):
        self.value = 1.0

    def off(self):
        self.value = 0.0

    def close(self):
        self.off()


class Servo(PWMLED):
    """ hobby servo: angle maps to a 2..12% duty cycle at 50 Hz """

    def __init__(self, pin, min_angle=0, max_angle=180, frequency=50):
        super().__init__(pin, frequency)
        self.min_angle = min_angle
        self.max_angle = max_angle
        self._angle = min_angle
        self.angle = min_angle

    @property
    def angle(self):
        return self._angle

    @angle.setter
    def angle(self, value):
        value = max(self.min_angle, min(self.max_angle, float(value)))
        span = (self.max_angle - self.min_angle) or 1
        self._angle = value
        self.value = 0.02 + 0.10 * (value - self.min_angle) / span


class RGBLED:
    """Three PWM channels with a tuple-valued .color property."""

    def __init__(self, red, green, blue, active_high=True):
        self.red = PWMLED(red)
        self.green = PWMLED(green)
        self.blue = PWMLED(blue)
        self.color = (0.0, 0.0, 0.0)

    @property
    def color(self):
        return (self.red.value, self.green.value, self.blue.value)

    @color.setter
    def color(self, value):
        r, g, b = value
        self.red.value = max(0.0, min(1.0, float(r)))
        self.green.value = max(0.0, min(1.0, float(g)))
        self.blue.value = max(0.0, min(1.0, float(b)))

    def off(self):
        self.color = (0.0, 0.0, 0.0)

    def close(self):
        self.off()


class InputDevice:
    def __init__(self, pin, pull_up=True, bounce_time=None):
        self.pin = int(pin)
        _b.gpio_setup(self.pin, "in", "up" if pull_up else "none")
        self._last = None

    @property
    def is_active(self):
        return int(_b.gpio_read(self.pin)) == 0

    @property
    def value(self):
        return int(_b.gpio_read(self.pin))

    @property
    def state(self):
        return 0 if self.is_active else 1

    def wait_for_active(self, timeout=5):
        waited = 0
        while waited < timeout * 1000:
            if self.is_active:
                return True
            _bridge.sleep_ms(5)
            waited += 5
        return False


class Button(InputDevice):
    when_pressed = None
    when_released = None


class DistanceSensor:
    """HC-SR04-style measurement from virtual echo-edge timestamps."""

    def __init__(self, trigger, echo, max_distance=1.0):
        self.trigger = int(trigger)
        self.echo = int(echo)
        _b.gpio_setup(self.trigger, "out", "none")
        _b.gpio_setup(self.echo, "in", "none")
        self._index = 0
        self.triggered()

    def triggered(self):
        _b.gpio_write(self.trigger, True)
        _bridge.sleep_ms(0.01)
        _b.gpio_write(self.trigger, False)
        self._index = _bridge.edge_count()

    @property
    def distance(self):
        edges = _bridge.gpio_edges(self.echo, "both", self._index)
        rise = next((e for e in edges if e.get("edge") == "rising"), None)
        if rise is None:
            return None
        fall = next((e for e in edges if e.get("edge") == "falling" and e["t"] >= rise["t"]), None)
        if fall is None:
            return None
        return (fall["t"] - rise["t"]) / 1000.0 * 343.0 / 2.0


class RotaryEncoder:
    """Quadrature decoder driven by injected GPIO edges."""

    def __init__(self, pin_a, pin_b):
        self.pin_a = int(pin_a)
        self.pin_b = int(pin_b)
        _b.gpio_setup(self.pin_a, "in", "up")
        _b.gpio_setup(self.pin_b, "in", "up")
        self.value = 0
        self._index = _bridge.edge_count()
        self._state = self._idx(int(_b.gpio_read(self.pin_a)), int(_b.gpio_read(self.pin_b)))

    def _idx(self, a, b):
        return _STATE_IDX[(a, b)]

    def poll(self):
        all_edges = _bridge.edges(self._index)
        self._index = _bridge.edge_count()
        states = [(0, 0), (0, 1), (1, 1), (1, 0)]
        a, b = states[self._state]
        for edge in all_edges:
            if edge["pin"] == self.pin_a:
                a = 1 if edge["level"] else 0
            elif edge["pin"] == self.pin_b:
                b = 1 if edge["level"] else 0
            else:
                continue
            state = self._idx(a, b)
            self.value += _QUAD.get((self._state, state), 0)
            self._state = state
        return self.value

    @property
    def steps(self):
        return self.poll()


class MCP3008:
    """10-bit ADC over SPI0 CE0 (the standard Pi ADC hat wiring)."""

    def __init__(self, bus=0, device=0, channel=0):
        self.bus = int(bus)
        self.device = int(device)
        self.channel = int(channel)

    @property
    def value(self):
        return _b.adc_read(self.channel)

    def read(self):
        return _b.adc_read(self.channel)
