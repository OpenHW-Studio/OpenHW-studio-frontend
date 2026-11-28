"""Zeroconf service descriptions registered in the virtual network registry."""

from rpi_sim import network


class ServiceInfo:
    def __init__(self, type_, name, address, port, properties=None, server=None):
        self.type = type_
        self.name = name
        self.addresses = [address]
        self.address = address
        self.port = int(port)
        self.properties = dict(properties or {})


class Zeroconf:
    def __init__(self, *args, **kwargs):
        self.services = []

    def register_service(self, info):
        network.register_service(info.name, info.port)
        self.services.append(info)
        return info

    def close(self):
        self.services.clear()
        return None
