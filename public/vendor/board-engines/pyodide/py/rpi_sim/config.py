"""Simulated /boot/config.txt and the device-tree view it produces."""

import io
import os

from rpi_sim import _bridge

_b = _bridge._b
_dev_files = []


def get():
    return _b.config_get().to_py()


def text():
    return _b.config_text()


def set(key, value=True):
    """Set a config.txt key, e.g. set('dtparam=i2c_arm', 'off')."""
    result = _b.config_set(key, value).to_py()
    refresh()
    return result


def dev_nodes():
    return list(_b.dev_nodes())


def read_device_tree():
    return _b.device_tree().to_py()


def refresh():
    """Materialise/remove /dev nodes so os.path.exists reflects config."""
    nodes = frozenset(dev_nodes())
    for path in list(_dev_files):
        if path not in nodes and os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass
    for path in nodes:
        directory = os.path.dirname(path)
        if directory:
            os.makedirs(directory, exist_ok=True)
        if not os.path.exists(path):
            with io.open(path, "w") as fp:
                fp.write("")
    _dev_files[:] = sorted(nodes)
    return nodes
