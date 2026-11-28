"""Subset of RPi.GPIO backed by the JS peripheral models."""

from rpi_sim import _bridge

BCM = 11
BOARD = 10
OUT = 1
IN = 0
HIGH = 1
LOW = 0
PUD_OFF = 20
PUD_UP = 21
PUD_DOWN = 22
RISING = 31
FALLING = 32
BOTH = 33

_mode = None
_edge_index = {}
_callbacks = {}
_gen = None
_EDGE_NAMES = {RISING: "rising", FALLING: "falling", BOTH: "both"}


def setmode(mode):
    global _mode
    if mode not in (BCM, BOARD):
        raise ValueError("unsupported numbering mode")
    _mode = mode
    return None


def getmode():
    return _mode


def setup(pin, direction, pull_up_down=PUD_OFF):
    pull = {PUD_UP: "up", PUD_DOWN: "down", PUD_OFF: "none"}.get(pull_up_down, "none")
    return _bridge._b.gpio_setup(int(pin), "out" if direction == OUT else "in", pull)


def output(pin, value):
    return _bridge._b.gpio_write(int(pin), 1 if value else 0)


def input(pin):
    return int(_bridge._b.gpio_read(int(pin)))


def cleanup(pin=None):
    if pin is None:
        _callbacks.clear()
        _edge_index.clear()
        return _bridge._b.reset(_bridge.snapshot()["board"])
    return _bridge._b.gpio_setup(int(pin), "in", "none")


def _sync_generation():
    global _gen
    generation = _bridge.generation()
    if _gen is None or generation != _gen:
        _gen = generation
        _edge_index.clear()
        _callbacks.clear()


def _poll_callbacks():
    """Deliver Python edge callbacks from edges collected since the last poll."""
    _sync_generation()
    if not _callbacks:
        return None
    total = _bridge.edge_count()
    for pin, (edge_name, callback) in list(_callbacks.items()):
        start = _edge_index.get(pin, 0)
        found = _bridge._b.gpio_edges(pin, edge_name, start)
        n = len(found)
        if n:
            _edge_index[pin] = total
            for _ in range(n):
                callback(pin)
    return None


_bridge.add_tick_hook(_poll_callbacks)


def add_event_detect(pin, edge, callback=None, bouncetime=None):
    _sync_generation()
    pin = int(pin)
    edge_name = _EDGE_NAMES.get(edge, "both")
    _edge_index[pin] = _bridge.edge_count()
    if callback is not None:
        _callbacks[pin] = (edge_name, callback)
    else:
        _callbacks.pop(pin, None)
    return None


def remove_event_detect(pin):
    pin = int(pin)
    _edge_index.pop(pin, None)
    _callbacks.pop(pin, None)
    return None


def event_detected(pin):
    _sync_generation()
    start = _edge_index.get(int(pin), 0)
    return len(_bridge.gpio_edges(int(pin), "both", start)) > 0


def wait_for_edge(pin, edge=BOTH, timeout=5000):
    _sync_generation()
    edge_name = _EDGE_NAMES.get(edge, "both")
    start = _edge_index.get(int(pin), 0)
    waited = 0
    while waited <= timeout:
        _poll_callbacks()
        found = _bridge._b.gpio_edges(int(pin), edge_name, start)
        if len(found):
            _edge_index[int(pin)] = _bridge.edge_count()
            return int(pin)
        _bridge.sleep_ms(5)
        waited += 5
    return None


class PWM:
    """Hardware PWM on a board-supported GPIO pin."""

    def __init__(self, pin, frequency):
        self.pin = int(pin)
        self.frequency = int(frequency)
        self.duty = 0
        _bridge._b.pwm_create(self.pin, self.frequency)

    def start(self, duty_cycle):
        return self.ChangeDutyCycle(duty_cycle)

    def ChangeDutyCycle(self, duty_cycle):
        self.duty = _bridge._b.pwm_duty(self.pin, float(duty_cycle))
        return None

    ChangeDutyCycle2 = ChangeDutyCycle

    def ChangeFrequency(self, frequency):
        self.frequency = _bridge._b.pwm_frequency(self.pin, frequency)
        return None

    def stop(self):
        _bridge._b.pwm_stop(self.pin)
        self.duty = 0
        return None
