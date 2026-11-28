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

    def configure(self, baudrate=None, parity='N', data_bits=8,
                  stop_bits=1, fifo_depth=16):
        """Set the framed UART line mode and return live statistics."""
        config = {'parity': parity, 'dataBits': data_bits,
                  'stopBits': stop_bits, 'fifoDepth': fifo_depth}
        if baudrate is not None:
            config['baud'] = int(baudrate)
        return dict(_b.uart_config(config).to_py())

    @property
    def stats(self):
        """Framed UART counters: baud, bitTimeUs, FIFO depths, overruns."""
        return dict(_b.uart_stats().to_py())

    @property
    def overrun(self):
        return int(self.stats['rxOverrun']) + int(self.stats['txOverrun'])

    @property
    def framing_error(self):
        return int(self.stats['framingErrors'])

    @property
    def clock_us(self):
        return _bridge.clock_us()

    @property
    def in_waiting(self):
        return int(self.stats['rxFifo'])

    @property
    def tx(self):
        return _bridge.snapshot()["uartTx"]
