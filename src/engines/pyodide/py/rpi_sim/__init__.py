"""Pyodide-side Raspberry Pi simulator shims.

Importing this package installs virtual time, sysfs/proc files, config and
driver views. This is a board-level Python simulation, not ARM/Linux emulation.
"""

import sys as _sys

from . import _bridge  # noqa: F401

# Pyodide preloads its own socket stub; install our loopback shim in its place.
_sys.modules.pop("socket", None)
import socket as _socket_shim  # noqa: F401
_sys.modules["socket"] = _socket_shim

from . import config  # noqa: F401
from . import electrical  # noqa: F401
from . import analog  # noqa: F401
from . import environment  # noqa: F401
from . import network  # noqa: F401
from . import drivers  # noqa: F401
from . import sysfs  # noqa: F401
from . import interrupts  # noqa: F401
from . import threads  # noqa: F401

sysfs.install()

__all__ = [
    "_bridge", "analog", "board", "config", "devices", "drivers", "electrical", "environment",
    "interrupts", "network", "onewire", "sysfs", "system", "threads", "timers", "uart",
]
__version__ = "0.3.0"
