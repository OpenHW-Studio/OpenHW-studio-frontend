"""Deterministic edge interrupts: priorities, nesting and critical sections."""

from contextlib import contextmanager

from rpi_sim import _bridge

_handlers = []
_cursor = 0
_gen = None
_seq = 0
_critical_depth = 0
_pending = []
_ticking = False


def on_edge(pin, edge="both", callback=None, priority=0):
    global _cursor, _gen, _seq
    generation = _bridge.generation()
    if _gen is None or generation != _gen:
        _gen = generation
        _cursor = 0
        _handlers.clear()
        _pending.clear()
    if not callable(callback):
        raise TypeError("callback must be callable")
    _handlers.append({
        "pin": int(pin), "edge": edge, "callback": callback,
        "priority": int(priority), "seq": _seq,
    })
    _seq += 1
    return len(_handlers)


def clear():
    global _cursor, _critical_depth
    _handlers.clear()
    _pending.clear()
    _critical_depth = 0
    _cursor = _bridge.edge_count()


def in_critical_section():
    return _critical_depth > 0


@contextmanager
def critical():
    """Defer interrupt dispatch until the block exits."""
    global _critical_depth
    _critical_depth += 1
    try:
        yield
    finally:
        _critical_depth -= 1
        if _critical_depth == 0 and _pending:
            queued = list(_pending)
            _pending.clear()
            _dispatch(queued)


def _dispatch(edges, depth=0):
    global _cursor
    _cursor = max(_cursor, _bridge.edge_count())
    if depth > 16 or not edges:
        return None
    ordered = sorted(enumerate(edges), key=lambda item: (item[1]["t"], item[0]))
    for _, edge in ordered:
        if _critical_depth:
            _pending.append(edge)
            continue
        now = _bridge.clock_ms()
        for handler in sorted(_handlers, key=lambda h: (-h["priority"], h["seq"])):
            if handler["pin"] == edge["pin"] and handler["edge"] in ("both", edge["edge"]):
                _bridge.clock_set(edge["t"])
                handler["callback"](edge["pin"], edge["edge"], edge["t"])
        _bridge.clock_set(now)
        nested = _bridge.edges(_cursor)
        if nested:
            _dispatch(nested, depth + 1)
        _cursor = _bridge.edge_count()
    return None


def _tick():
    global _cursor, _gen, _ticking
    if _ticking:
        return None
    _ticking = True
    try:
        return _tick_inner()
    finally:
        _ticking = False


def _tick_inner():
    global _cursor, _gen
    generation = _bridge.generation()
    if _gen is None or generation != _gen:
        _gen = generation
        _cursor = 0
    edges = _bridge.edges(_cursor)
    if not edges:
        return None
    _cursor = _bridge.edge_count()
    _dispatch(edges)
    return None


_bridge.add_tick_hook(_tick)
