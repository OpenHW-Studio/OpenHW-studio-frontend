"""Minimal UART shim: writes go to a host-visible TX buffer, RX is injected."""

from rpi_sim import _bridge

_b = _bridge._b


class UART:
    def __init__(self, device="/dev/serial0", baudrate=115200):
        self.device = device
        self.baudrate = int(baudrate)

    def write(self, data):
        if isinstance(data, str):
            data = data.encode()
        result = _b.uart_write(bytes(data).decode("latin1"))
        return len(data)

    def read(self, size=1):
        return _b.uart_read(int(size))

    def readline(self):
        return _b.uart_read_line()

    @property
    def in_waiting(self):
        return len(_bridge.snapshot()["uartRx"])

    @property
    def tx(self):
        return _bridge.snapshot()["uartTx"]
