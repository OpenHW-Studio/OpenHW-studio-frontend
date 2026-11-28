"""pyserial-compatible subset backed by the simulated UART."""

from rpi_sim.uart import UART


class Serial(UART):
    def __init__(self, port=None, baudrate=9600, timeout=None, **kwargs):
        super().__init__(device=port or "/dev/serial0", baudrate=baudrate)
        self.timeout = timeout

    @property
    def in_waiting(self):
        from rpi_sim import _bridge
        return len(_bridge._b.state()["uartRx"])

    def reset_input_buffer(self):
        from rpi_sim import _bridge
        while _bridge._b.uart_read(1):
            pass
        return None

    def writable(self):
        return True

    def readable(self):
        return True
