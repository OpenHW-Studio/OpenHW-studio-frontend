"""Virtual network: loopback services, MQTT and interfaces (no real sockets)."""

from rpi_sim import _bridge

_b = _bridge._b


def interfaces():
    return _b.net_interfaces().to_py()


def register_service(name, port):
    return _b.net_register_service(name, port).to_py()


def register_route(port, path, body):
    return _b.net_register_route(port, path, body)


def serve_pending(port):
    return _b.net_serve_pending(int(port))


def packet_log():
    return _b.net_packet_log().to_py()


def socket_state(sock_id):
    return _b.net_socket_state(int(sock_id)).to_py()


def retransmit(conn_id):
    return _b.net_retransmit(int(conn_id)).to_py()


def http_request(method, url):
    return _b.net_http_request(method, url).to_py()


def http_get(url):
    return http_request("GET", url)


def http_post(url, data=None):
    return http_request("POST", url)


def mqtt_publish(topic, payload, qos=0):
    return _b.net_mqtt_publish(topic, payload, int(qos))


def mqtt_subscribe(topic):
    return _b.net_mqtt_subscribe(topic)


def mqtt_messages(topic=None):
    return _b.net_mqtt_messages(topic).to_py()


class mqtt:
    publish = staticmethod(mqtt_publish)
    subscribe = staticmethod(mqtt_subscribe)
    messages = staticmethod(mqtt_messages)
