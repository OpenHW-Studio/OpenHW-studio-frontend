"""Deterministic picamera2 subset: test-pattern frames from the JS camera model.

No real camera hardware is involved; frames are reproducible RGB patterns.
"""

import numpy as np

from rpi_sim import _bridge

_b = _bridge._b


class Picamera2:
    def __init__(self):
        self.configuration = {"size": [64, 48], "format": "RGB888"}
        self.started = False
        _b.camera_configure(64, 48)

    def create_preview_configuration(self, main=None, **kwargs):
        main = main or {"size": (64, 48), "format": "RGB888"}
        return {"main": main}

    def configure(self, config=None):
        if config and "main" in config:
            size = config["main"].get("size", (64, 48))
            self.configuration["size"] = list(size)
            _b.camera_configure(int(size[0]), int(size[1]))
        return self.configuration

    def start(self):
        self.started = True
        return None

    def stop(self):
        self.started = False
        return None

    def _frame(self):
        width, height = self.configuration["size"]
        return bytes(int(v) & 0xff for v in _b.camera_capture().to_py())

    def capture_array(self, name="main"):
        width, height = self.configuration["size"]
        data = self._frame()
        return np.frombuffer(data, dtype=np.uint8).reshape((int(height), int(width), 3))

    def capture_file(self, path, name="main"):
        data = self._frame()
        with open(path, "wb") as fp:
            fp.write(data)
        return len(data)
