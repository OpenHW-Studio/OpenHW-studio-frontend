"""Minimal Image: new/getpixel/putpixel/tobytes/save-to-memory (PPM)."""

from io import BytesIO


class Image:
    def __init__(self, mode, size, color=0):
        self.mode = mode
        self.size = (int(size[0]), int(size[1]))
        channels = 3 if mode == "RGB" else 1
        c = color if isinstance(color, (tuple, list)) else (color,) * channels
        self._pixels = [tuple(c[:channels])] * (self.size[0] * self.size[1])

    @classmethod
    def new(cls, mode, size, color=0):
        return cls(mode, size, color)

    @property
    def width(self):
        return self.size[0]

    @property
    def height(self):
        return self.size[1]

    def getpixel(self, xy):
        x, y = xy
        return self._pixels[y * self.size[0] + x]

    def putpixel(self, xy, value):
        x, y = xy
        self._pixels[y * self.size[0] + x] = value

    def tobytes(self):
        return bytes(v for pixel in self._pixels for v in pixel)

    def save(self, fp, format="PPM"):
        if not hasattr(fp, "write"):
            fp = BytesIO()
        header = f"P6\n{self.width} {self.height}\n255\n".encode()
        fp.write(header + self.tobytes())
        return fp
