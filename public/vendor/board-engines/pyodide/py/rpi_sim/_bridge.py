"""Typed wrapper over window.__rpiBridge, virtual time and timer dispatch."""

from js import window

_b = window.__rpiBridge
if not _b:
    raise RuntimeError("window.__rpiBridge is not installed by the JS runtime")

# Compatibility alias: older shims use `_bridge._bridge`.
_bridge = _b

import time as _time

_timers = []
_tick_hooks = []


def clock_ms():
    return int(_b.clock_ms())


def clock_set(ms):
    _b.clock_set(int(ms))
    return clock_ms()


def register_timer(timer):
    if timer not in _timers:
        _timers.append(timer)
    return timer


def unregister_timer(timer):
    try:
        _timers.remove(timer)
    except ValueError:
        pass


def add_tick_hook(fn):
    """fn() is called whenever the virtual clock is advanced."""
    if fn not in _tick_hooks:
        _tick_hooks.append(fn)


def _run_hooks():
    for fn in list(_tick_hooks):
        fn()


def _advance_to(target_ms):
    """Advance to target_ms, firing due timers at their exact due time."""
    while True:
        due = [t for t in _timers if not t.cancelled and t.next_ms <= target_ms]
        if not due:
            break
        when = min(t.next_ms for t in due)
        clock_set(when)
        _run_hooks()
        for timer in list(due):
            if timer.cancelled or timer.next_ms != when:
                continue
            timer._fire(when)
    clock_set(target_ms)
    _run_hooks()


def _virtual_sleep(seconds):
    """Advance simulated time instantly, dispatching due timers on the way."""
    ms = int(float(seconds) * 1000)
    _advance_to(clock_ms() + max(0, ms))
    return None


_time.sleep = _virtual_sleep
_time.monotonic = lambda: clock_ms() / 1000.0
_time.time = lambda: 1000000000.0 + clock_ms() / 1000.0

import asyncio as _asyncio


async def _virtual_async_sleep(delay, result=None):
    """asyncio.sleep on the same virtual clock as time.sleep."""
    _virtual_sleep(delay)
    return result


_asyncio.sleep = _virtual_async_sleep


def sleep_ms(ms):
    _virtual_sleep(int(ms) / 1000.0)


def snapshot():
    """JS peripheral state as a real Python dict, never a JsProxy."""
    return _b.state().to_py()


def generation():
    return int(_b.generation())


def edge_count():
    return int(_b.edge_count())


def edges(after=0):
    return _b.edges_since(after).to_py()


def gpio_edges(pin, edge="both", after=0):
    return _b.gpio_edges(pin, edge, after).to_py()


def clock():
    return clock_ms()
