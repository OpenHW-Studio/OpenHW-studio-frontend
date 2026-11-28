"""Virtual sysfs/proc files served from the JS bridge via patched builtins.open."""

import builtins
import io
import os

from rpi_sim import _bridge, config, system

_b = _bridge._b
_real_open = builtins.open
_exported = {}
_edge_modes = {}
_patched = False

GPIO_ROOT = "/sys/class/gpio"
THERMAL = "/sys/class/thermal/thermal_zone0/temp"
I2C_ROOT = "/sys/bus/i2c/devices"


def _dirs():
    return [GPIO_ROOT, os.path.dirname(THERMAL), I2C_ROOT, "/proc/device-tree/aliases", "/proc/device-tree/bus", "/boot"]


def _touch(path, content=""):
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)
    if not os.path.exists(path):
        with io.open(path, "w") as fp:
            fp.write(content)


def _text(path, value):
    _touch(path, str(value))
    with io.open(path, "w") as fp:
        fp.write(str(value))


def export(pin):
    pin = int(pin)
    _b.gpio_setup(pin, "out", "none")
    root = f"{GPIO_ROOT}/gpio{pin}"
    os.makedirs(root, exist_ok=True)
    for name, value in (("direction", "out"), ("value", "0"), ("edge", "none")):
        _text(f"{root}/{name}", value)
    _exported[pin] = True
    return pin


def unexport(pin):
    pin = int(pin)
    root = f"{GPIO_ROOT}/gpio{pin}"
    for name in ("direction", "value", "edge"):
        path = f"{root}/{name}"
        if os.path.exists(path):
            os.remove(path)
    _exported.pop(pin, None)
    return pin


def _cpuinfo(snapshot):
    return (
        "processor\t: 0\n"
        f"Hardware\t: {snapshot['soc']}\n"
        f"Board\t\t: {snapshot['board']}\n"
        f"CPU clock\t: {snapshot['cpuClockMHz']} MHz\n"
        "Flags\t\t: simulated\n"
    )


def _meminfo(snapshot):
    total = { "pi3": 1024, "pi4": 2048, "pi5": 4096 }[snapshot["board"]]
    return f"MemTotal:        {total * 1024} kB\nMemFree:         {total * 512} kB\nMemAvailable:    {total * 768} kB\n"


def reload():
    os.makedirs(GPIO_ROOT, exist_ok=True)
    _touch("/boot/config.txt")
    _touch(THERMAL)
    snapshot = _bridge.snapshot()
    _text("/proc/cpuinfo", _cpuinfo(snapshot))
    _text("/proc/meminfo", _meminfo(snapshot))
    _text(THERMAL, int(snapshot["cpuTempC"] * 1000))
    _text(f"{GPIO_ROOT}/export", "")
    _text(f"{GPIO_ROOT}/unexport", "")
    for pin in list(_exported):
        export(pin)
    dt = _bridge.snapshot().get("deviceTree", {})
    _text("/proc/device-tree/model", f"{snapshot['board']} ({snapshot['soc']})")
    _text("/proc/device-tree/compatible", snapshot["soc"])
    _text("/proc/device-tree/serial-number", "00000000" + snapshot["board"])
    _text("/proc/device-tree/aliases/i2c", "/soc/i2c@7e205000")
    _text("/proc/device-tree/aliases/spi", "/soc/spi@7e204000")
    _text("/proc/device-tree/bus/i2c", ",".join(sorted(
        d["address"] for d in dt.get("devices", []) if d.get("bus") == "i2c")))
    for bus, devices in snapshot["i2c"].items():
        for address, device in devices.items():
            name = f"{I2C_ROOT}/{bus}-{address[2:].rjust(4, '0')}/name"
            _touch(name, device["kind"] or "unknown")
            _text(name, device["kind"] or "unknown")
    return True


def _read(path):
    if path == "/boot/config.txt":
        return config.text()
    if path == THERMAL:
        return str(int(system.cpu_temperature() * 1000))
    if path == "/proc/cpuinfo":
        return _cpuinfo(_bridge.snapshot())
    if path == "/proc/meminfo":
        return _meminfo(_bridge.snapshot())
    if path == f"{GPIO_ROOT}/export" or path == f"{GPIO_ROOT}/unexport":
        return ""
    if path.startswith(f"{GPIO_ROOT}/gpio"):
        tail = path[len(f"{GPIO_ROOT}/gpio"):]
        parts = tail.split("/")
        if parts and parts[0].isdigit():
            pin = int(parts[0])
            field = parts[1] if len(parts) > 1 else "value"
            snapshot = _bridge.snapshot()
            if field == "direction":
                return snapshot["gpio"].get(str(pin), {}).get("mode", "in")
            if field == "value":
                return str(int(_b.gpio_read(pin)))
            if field == "edge":
                return _edge_modes.get(pin, "none")
    if path.startswith("/proc/device-tree/"):
        relative = path[len("/proc/device-tree/"):]
        with io.open(path, "r") as fp:
            return fp.read()
    if path.startswith(I2C_ROOT) and path.endswith("/name"):
        rel = path[len(I2C_ROOT) + 1:-len("/name")]
        bus, addr = rel.split("-")
        dev = _bridge.snapshot()["i2c"].get(str(int(bus)), {}).get("0x" + addr[2:].lstrip("0").rjust(2, "0"), {})
        return dev.get("kind", "unknown")
    with io.open(path, "r") as fp:
        return fp.read()


def _write(path, data):
    text = str(data)
    if path == "/boot/config.txt":
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            if line.startswith("dtoverlay="):
                config.set(line, True)
            else:
                key, value = line.split("=", 1)
                config.set(key, value)
        reload()
        return
    if path == f"{GPIO_ROOT}/export":
        export(int(text.strip()))
        return
    if path == f"{GPIO_ROOT}/unexport":
        unexport(int(text.strip()))
        return
    if path.startswith(f"{GPIO_ROOT}/gpio"):
        tail = path[len(f"{GPIO_ROOT}/gpio"):]
        parts = tail.split("/")
        if parts and parts[0].isdigit():
            pin = int(parts[0])
            field = parts[1] if len(parts) > 1 else "value"
            if field == "direction":
                _b.gpio_setup(pin, "out" if text.strip() == "out" else "in", "none")
            elif field == "value":
                _b.gpio_write(pin, 1 if text.strip() == "1" else 0)
            elif field == "edge":
                _edge_modes[pin] = text.strip()
            return
    with io.open(path, "w") as fp:
        fp.write(text)


class _VirtualFile:
    def __init__(self, path, mode="r"):
        self.path = path
        self.mode = mode
        self.binary = "b" in mode
        self.closed = False
        self._pos = 0

    def read(self, size=-1):
        data = _read(self.path)
        out = data[self._pos:] if size is None or size < 0 else data[self._pos:self._pos + size]
        self._pos += len(out)
        return out.encode() if self.binary else out

    def write(self, data):
        if isinstance(data, bytes):
            data = data.decode()
        _write(self.path, data)
        return len(data)

    def seek(self, pos, whence=0):
        self._pos = max(0, pos)
        return self._pos

    def tell(self):
        return self._pos

    def flush(self):
        return None

    def close(self):
        self.closed = True

    def readable(self):
        return "w" not in self.mode and "a" not in self.mode

    def writable(self):
        return "w" in self.mode or "a" in self.mode or "+" in self.mode

    def seekable(self):
        return True

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
        return False

    def __iter__(self):
        for line in _read(self.path).splitlines(True):
            yield line


def install():
    global _patched
    for directory in _dirs():
        os.makedirs(directory, exist_ok=True)
    config.refresh()
    reload()
    if not _patched:
        builtins.open = _open
        _patched = True
    return True


def _open(file, mode="r", *args, **kwargs):
    path = os.fspath(file) if hasattr(file, "__fspath__") else str(file)
    if path in ("/boot/config.txt", THERMAL, "/proc/cpuinfo", "/proc/meminfo",
                f"{GPIO_ROOT}/export", f"{GPIO_ROOT}/unexport"):
        return _VirtualFile(path, mode)
    if path.startswith(f"{GPIO_ROOT}/gpio") or path.startswith("/proc/device-tree/") or (
        path.startswith(I2C_ROOT) and path.endswith("/name")
    ):
        return _VirtualFile(path, mode)
    return _real_open(file, mode, *args, **kwargs)
