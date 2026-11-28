"""Flask subset: routes are registered in the virtual HTTP service registry."""

import socket

from rpi_sim import network

__version__ = "0.1.0-sim"


class Flask:
    def __init__(self, import_name, static_folder=None):
        self.name = str(import_name)
        self.view_functions = {}
        network.register_service(self.name, 8080)
        self.server = socket.socket()
        self.server.bind(("127.0.0.1", 8080))
        self.server.listen()

    def route(self, rule, **options):
        def decorator(fn):
            self.view_functions[fn.__name__] = fn
            # Route handlers in this model are static response providers.
            network.register_route(8080, rule, str(fn()))
            return fn
        return decorator

    def run(self, *args, **kwargs):
        raise NotImplementedError("Flask HTTP server is not emulated; use requests.get against 127.0.0.1:8080")

    def test_client(self):
        raise NotImplementedError("Flask test client is not emulated; use requests.get")
