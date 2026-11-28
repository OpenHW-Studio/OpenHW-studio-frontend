"""smbus2-style I2C with an I2C_MSG-style combined transfer API."""

from rpi_sim import _bridge
from smbus import SMBus as _SMBus

_b = _bridge._b
I2C_M_RD = 1


class I2C_MSG:
    """Minimal analogue of smbus2.i2c_msg.msg: write(data) / read(length)."""

    def __init__(self, addr, flags, buf=None, length=None):
        self.addr = int(addr) & 0x7f
        self.flags = int(flags)
        if self.flags & I2C_M_RD:
            self.len = int(length if length is not None else (len(buf) if buf else 1))
            self.buf = bytearray(self.len)
        else:
            self.buf = bytearray(int(v) & 0xff for v in (buf or []))
            self.len = len(self.buf)

    @classmethod
    def write(cls, addr, data):
        return cls(addr, 0, buf=data)

    @classmethod
    def read(cls, addr, length):
        return cls(addr, I2C_M_RD, length=length)

    def __repr__(self):
        return f"I2C_MSG(addr=0x{self.addr:02x}, read={bool(self.flags & I2C_M_RD)}, len={self.len})"


class SMBus(_SMBus):
    def i2c_rdwr(self, *msgs):
        for msg in msgs:
            if msg.flags & I2C_M_RD:
                data = _b.i2c_read(self.bus, msg.addr, msg.len)
                msg.buf = bytearray(int(v) & 0xff for v in data)
                msg.len = len(msg.buf)
            else:
                _b.i2c_write(self.bus, msg.addr, list(msg.buf))
        return None
