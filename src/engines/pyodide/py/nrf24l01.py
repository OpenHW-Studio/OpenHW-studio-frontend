"""nRF24L01+ register access over the simulated SPI bus."""

from rpi_sim.devices import SPIRegisterDevice

CONFIG = 0x00
STATUS = 0x07


class nRF24L01:
    def __init__(self, spi=None, ce_pin=None, csn_pin=None, bus=0, device=0):
        self._spi = SPIRegisterDevice(bus, device)

    def read_register(self, register):
        return self._spi.read(register)

    def write_register(self, register, value):
        return self._spi.write(register, value)

    def send(self, data):
        raise NotImplementedError("nRF24L01 radio packet transmission is not emulated")
