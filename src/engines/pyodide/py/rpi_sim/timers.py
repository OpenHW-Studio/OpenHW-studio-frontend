"""Virtual-time timers: callbacks fire when time.sleep() advances the clock."""

from rpi_sim import _bridge


class Timer:
    """One-shot or repeating timer driven by virtual time (no real threads)."""

    def __init__(self, interval, callback, args=(), repeat=False):
        self.interval_ms = int(round(float(interval) * 1000))
        if self.interval_ms <= 0:
            raise ValueError("timer interval must be positive seconds")
        self.callback = callback
        self.args = tuple(args)
        self.repeat = bool(repeat)
        self.cancelled = False
        self.next_ms = _bridge.clock_ms() + self.interval_ms
        self.count = 0
        self.times = []
        _bridge.register_timer(self)

    def _fire(self, now):
        self.count += 1
        self.times.append(now)
        self.callback(*self.args)
        if self.repeat:
            self.next_ms = now + self.interval_ms
        else:
            self.cancelled = True
            _bridge.unregister_timer(self)

    def cancel(self):
        self.cancelled = True
        _bridge.unregister_timer(self)


def oneshot(interval, callback, args=()):
    return Timer(interval, callback, args, repeat=False)


def repeating(interval, callback, args=()):
    return Timer(interval, callback, args, repeat=True)
