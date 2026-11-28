"""Network interface addresses from the per-board virtual network model."""

from rpi_sim import network


def interfaces():
    # Compatibility: only the loopback is advertised by this shim. Use
    # rpi_sim.network.interfaces() for the full per-board interface map.
    return ["lo"]


def ifaddresses(interface):
    addresses = network.interfaces()
    if interface not in addresses:
        raise ValueError(f"no such interface: {interface}")
    return {2: [{"addr": addresses[interface], "netmask": "255.255.255.0"}]}


def gateways():
    return {"default": network.interfaces()["eth0"]}
