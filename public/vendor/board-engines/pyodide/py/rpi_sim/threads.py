"""Cooperative threads on virtual time: round-robin steps and priorities.

Not OS threads: there is no preemption at instruction level. Generator targets
yield at explicit virtual-time points; each tick advances every runnable
thread once, in descending priority then start order.
"""

import inspect

from rpi_sim import _bridge

_threads = []
_gen = None
_seq = 0
_ticking = False


class Thread:
    def __init__(self, target, args=(), kwargs=None, name=None, priority=0, preempt=None):
        if not callable(target):
            raise TypeError("target must be callable")
        global _seq
        self.target = target
        self.args = tuple(args)
        self.kwargs = dict(kwargs or {})
        self.name = name or getattr(target, "__name__", "Thread")
        self.priority = int(priority)
        self.preempt = inspect.isgeneratorfunction(target) if preempt is None else bool(preempt)
        self.alive = False
        self._started = False
        self._generator = None
        self.result = None
        self.steps = 0
        self._seq = _seq
        _seq += 1

    def start(self):
        global _gen
        generation = _bridge.generation()
        if _gen is None or generation != _gen:
            _gen = generation
            _threads.clear()
        if self._started:
            raise RuntimeError("threads can only be started once")
        self._started = True
        self.alive = True
        _threads.append(self)
        return None

    def _step(self):
        self.steps += 1
        if not self.preempt:
            self.result = self.target(*self.args, **self.kwargs)
            self.alive = False
            return
        if self._generator is None:
            self._generator = self.target(*self.args, **self.kwargs)
        try:
            next(self._generator)
        except StopIteration:
            self.alive = False

    def join(self, timeout=None):
        budget = 10000
        while self.alive and budget > 0:
            _bridge.sleep_ms(0)
            budget -= 1
        if self.alive:
            raise TimeoutError(f"thread {self.name} did not finish")
        return None


def _tick():
    global _gen, _ticking
    if _ticking:
        return None
    _ticking = True
    try:
        return _tick_inner()
    finally:
        _ticking = False


def _tick_inner():
    global _gen
    generation = _bridge.generation()
    if _gen is None or generation != _gen:
        _gen = generation
        _threads.clear()
    for thread in sorted([t for t in _threads if t.alive], key=lambda t: (-t.priority, t._seq)):
        thread._step()


_bridge.add_tick_hook(_tick)
