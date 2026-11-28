"""Driver registry: claims device-tree nodes and installs them in the models."""

from rpi_sim import _bridge, config, devices

_b = _bridge._b

DRIVERS = {}


class Driver:
    name = "generic"
    kind = "custom"
    bus = "i2c"

    def claim(self, node):
        raise NotImplementedError("driver has no claim implementation")


class I2CRegisterDriver(Driver):
    def claim(self, node):
        address = int(str(node["address"]), 16)
        bus = int(node["number"])
        if not _b.i2c_has(bus, address):
            devices.I2CRegisterDevice(bus, address, self.kind)
        return {
            "driver": self.name, "bus": "i2c", "number": bus,
            "address": node["address"], "kind": self.kind, "claimed": True,
        }


class AT24Driver(I2CRegisterDriver):
    name = "at24"
    kind = "eeprom"


class SSD1306Driver(I2CRegisterDriver):
    name = "ssd1306"
    kind = "ssd1306"


class MCP9808Driver(I2CRegisterDriver):
    name = "mcp9808"
    kind = "mcp9808"


class SPIRegisterDriver(Driver):
    name = "spidev"
    kind = "regfile"
    bus = "spi"

    def claim(self, node):
        return {
            "driver": self.name, "bus": "spi", "number": int(node["number"]),
            "address": node["address"], "kind": self.kind, "claimed": True,
        }


class OverlayI2CDriver(I2CRegisterDriver):
    name = "overlay-i2c-sensor"
    kind = "overlay-i2c-sensor"


class OverlaySPIDriver(Driver):
    name = "overlay-spi-lcd"
    kind = "overlay-spi-lcd"
    bus = "spi"

    def claim(self, node):
        return {"driver": self.name, "bus": "spi", "number": int(node["number"]),
                "address": node["address"], "kind": self.kind, "claimed": True}


class OverlayGPIODriver(Driver):
    name = "overlay-gpio"
    kind = "overlay-gpio"
    bus = "gpio"

    def claim(self, node):
        return {"driver": self.name, "overlay": node["overlay"], "pin": int(node["address"]),
                "kind": self.kind, "claimed": True}


for _driver in (AT24Driver, SSD1306Driver, MCP9808Driver, SPIRegisterDriver,
                OverlayI2CDriver, OverlaySPIDriver, OverlayGPIODriver):
    DRIVERS[_driver.name] = _driver()


def probe_all():
    """Claim every enabled device-tree node with a matching driver."""
    tree = config.read_device_tree()
    claimed = []
    for node in tree["devices"]:
        driver = DRIVERS.get(node["driver"])
        if driver is None:
            continue
        claimed.append(driver.claim(node))
    return claimed


def probe_overlays():
    """Claim devices introduced by dtoverlay= lines."""
    tree = config.read_device_tree()
    claimed = []
    for node in tree.get("overlayDevices", []):
        name = str(node["driver"])
        if name.startswith("overlay-w1-gpio") or name.startswith("overlay-dht11"):
            driver = DRIVERS["overlay-gpio"]
        else:
            driver = DRIVERS.get(name)
        if driver is not None:
            claimed.append(driver.claim(node))
    return claimed


def attach_i2c_sensor(bus, address, kind="custom", registers=None):
    """Attach a custom register device, e.g. a sensor at 0x40."""
    return devices.I2CRegisterDevice(bus, address, kind, registers)
