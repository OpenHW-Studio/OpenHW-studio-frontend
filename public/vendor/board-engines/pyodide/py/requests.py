"""Requests subset: HTTP/1.1 over the virtual loopback sockets."""

import json as _json
from urllib.parse import quote as _quote, unquote as _unquote, urlparse

import socket
from rpi_sim import network

__version__ = "0.1.0-sim"


class utils:
    @staticmethod
    def quote(value, safe="/"):
        return _quote(value, safe=safe)

    @staticmethod
    def unquote(value):
        return _unquote(value)


class Request:
    def __init__(self, method, url, data=None, headers=None):
        self.method = str(method).upper()
        self.url = str(url)
        self.data = data
        self.headers = dict(headers or {})

    def prepare(self):
        return self


class Response:
    def __init__(self, status_code, text):
        self.status_code = int(status_code)
        self.text = str(text)
        self.content = self.text.encode()

    @property
    def ok(self):
        return 200 <= self.status_code < 400

    def json(self):
        return _json.loads(self.text)


def _request(method, url, data=None, headers=None):
    parsed = urlparse(str(url))
    if parsed.scheme == "https":
        raise NotImplementedError("TLS is not emulated in the virtual network")
    if parsed.scheme not in ("http", ""):
        raise NotImplementedError(f"unsupported URL scheme {parsed.scheme}")
    host = parsed.hostname or "localhost"
    port = parsed.port or 80
    path = parsed.path or "/"
    body = "" if data is None else str(data)
    request = (
        f"{method.upper()} {path} HTTP/1.1\r\n"
        f"Host: {host}\r\n"
        f"Content-Length: {len(body)}\r\n"
        "Connection: close\r\n\r\n" + body
    )
    client = socket.create_connection((host, port))
    try:
        client.sendall(request.encode("latin1"))
        network.serve_pending(port)
        raw = b""
        while True:
            chunk = client.recv(65536)
            if not chunk:
                break
            raw += chunk
    finally:
        client.close()
    text = raw.decode("latin1")
    head, _, response_body = text.partition("\r\n\r\n")
    status = 200
    if head.startswith("HTTP/1.1 "):
        try:
            status = int(head.split(" ", 2)[1])
        except (ValueError, IndexError):
            status = 200
    return Response(status, response_body)


def get(url, **kwargs):
    return _request("GET", url, **kwargs)


def post(url, data=None, **kwargs):
    return _request("POST", url, data=data, **kwargs)


class Session:
    def __init__(self):
        self.headers = {}

    def get(self, url, **kwargs):
        return _request("GET", url, **kwargs)

    def post(self, url, data=None, **kwargs):
        return _request("POST", url, data=data, **kwargs)

    def request(self, method, url, **kwargs):
        return _request(method, url, **kwargs)

    def close(self):
        return None
