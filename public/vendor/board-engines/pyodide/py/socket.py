"""socket-like API over the deterministic virtual loopback network.

Only AF_INET loopback is supported. TLS and external hosts are not emulated.
"""

from rpi_sim import _bridge

_b = _bridge._b

AF_INET = 2
SOCK_STREAM = 1
SOCK_DGRAM = 2
IPPROTO_TCP = 6
IPPROTO_UDP = 17

error = OSError


class gaierror(OSError):
    pass


def gethostbyname(host):
    try:
        return _b.net_dns_resolve(host)
    except Exception as exc:
        raise gaierror(str(exc)) from exc


def _wrap_socket_id(sid, addr=None):
    sock = socket.__new__(socket)
    sock._id = sid
    sock._addr = addr
    sock._closed = False
    sock.family = AF_INET
    sock.type = SOCK_STREAM
    return sock


class socket:
    def __init__(self, family=AF_INET, type=SOCK_STREAM, proto=0):
        if family != AF_INET:
            raise NotImplementedError("only AF_INET is emulated")
        if type not in (SOCK_STREAM, SOCK_DGRAM):
            raise NotImplementedError("only TCP/UDP sockets are emulated")
        self.family = family
        self.type = type
        self.proto = proto
        self._id = _b.net_socket_open("udp" if type == SOCK_DGRAM else "tcp")
        self._addr = None
        self._closed = False

    def bind(self, address):
        self._addr = (str(address[0]), int(address[1]))
        _b.net_socket_bind(self._id, self._addr[1])
        return None

    def listen(self, backlog=5):
        _b.net_socket_listen(self._id)
        return None

    def accept(self):
        sid = _b.net_socket_accept(self._id)
        if sid is None:
            raise error("no pending connection")
        addr = (gethostbyname("localhost"), self._addr[1] if self._addr else 0)
        return _wrap_socket_id(int(sid), addr), addr

    def connect(self, address):
        _b.net_socket_connect(self._id, str(address[0]), int(address[1]))
        self._addr = (str(address[0]), int(address[1]))
        return None

    def send(self, data):
        if isinstance(data, bytes):
            data = data.decode("latin1")
        return int(_b.net_socket_send(self._id, str(data)))

    def sendall(self, data):
        self.send(data)
        return None

    def recv(self, bufsize=4096, flags=0):
        return str(_b.net_socket_recv(self._id, bufsize)).encode("latin1")

    def sendto(self, data, address):
        if isinstance(data, bytes):
            data = data.decode("latin1")
        return int(_b.net_datagram_send(self._id, str(address[0]), int(address[1]), str(data)))

    def recvfrom(self, bufsize=4096, flags=0):
        message = _b.net_datagram_recv(self._id)
        if not message:
            return b"", (gethostbyname("localhost"), 0)
        message = message.to_py()
        return str(message["data"]).encode("latin1"), (str(message["from"]), 0)

    def close(self):
        if not self._closed:
            _b.net_socket_close(self._id)
            self._closed = True
        return None

    def settimeout(self, value):
        return None

    def getsockname(self):
        return self._addr or (gethostbyname("localhost"), 0)

    @property
    def fileno(self):
        return int(self._id)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
        return False


def create_connection(address, timeout=None, source_address=None):
    sock = socket()
    sock.connect(address)
    return sock
