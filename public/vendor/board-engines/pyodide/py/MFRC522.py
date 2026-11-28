"""MFRC522 RFID reader: register access over the simulated SPI bus."""

from rpi_sim.devices import SPIRegisterDevice

VERSION_REG = 0x01


class MFRC522:
    def __init__(self, bus=0, device=0, reset_pin=None):
        self._spi = SPIRegisterDevice(bus, device)

    def read_register(self, register):
        return self._spi.read(register)

    def write_register(self, register, value):
        return self._spi.write(register, value)

    def request(self, req_mode=0x26):
        raise NotImplementedError("MFRC522 anti-collision/tag protocol is not emulated")
