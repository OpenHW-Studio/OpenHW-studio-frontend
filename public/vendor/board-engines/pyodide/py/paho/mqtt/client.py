"""paho-mqtt subset backed by the virtual MQTT bus (no broker sockets)."""

from rpi_sim import network

MQTT_ERR_SUCCESS = 0


class MQTTMessage:
    def __init__(self, topic=b"", payload=b"", qos=0, retain=False):
        self.topic = topic if isinstance(topic, bytes) else topic.encode()
        self.payload = payload if isinstance(payload, bytes) else str(payload).encode()
        self.qos = int(qos)
        self.retain = bool(retain)


class Client:
    def __init__(self, client_id="", clean_session=True, userdata=None):
        self._client_id = client_id or "rpi-pyodide"
        self.clean_session = clean_session
        self.userdata = userdata
        self.connected = False

    @property
    def client_id(self):
        return self._client_id

    def connect(self, host, port=1883, keepalive=60):
        """Connect to the in-process virtual bus (no network)."""
        self.connected = True
        network.register_service("mqtt", port)
        return MQTT_ERR_SUCCESS

    def publish(self, topic, payload=None, qos=0, retain=False):
        if qos not in (0, 1):
            raise NotImplementedError("MQTT QoS > 1 is not emulated")
        network.mqtt_publish(topic, "" if payload is None else str(payload), qos)
        return (MQTT_ERR_SUCCESS, 1)

    def subscribe(self, topic, qos=0):
        if qos not in (0, 1):
            raise NotImplementedError("MQTT QoS > 1 is not emulated")
        network.mqtt_subscribe(topic)
        return (MQTT_ERR_SUCCESS, 1)

    def messages(self, topic=None):
        """Deliver queued virtual messages as MQTTMessage objects."""
        return [MQTTMessage(m["topic"], m["payload"], m.get("qos", 0)) for m in network.mqtt_messages(topic)]

    def loop_start(self):
        return None

    def loop_stop(self):
        return None