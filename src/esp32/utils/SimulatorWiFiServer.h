/**
 * SimulatorWiFiServer.h
 * ─────────────────────────────────────────────────────────────────────────────
 * Faux Arduino WiFiServer for accepting inbound IoT connections (e.g.,
 * ESPAsyncWebServer, generic HTTP servers).
 */

#ifndef SIMULATOR_WIFI_SERVER_H
#define SIMULATOR_WIFI_SERVER_H

#pragma once

#include "WiFi.h"
#include "WiFiClient.h"
#include <Server.h>

class WiFiServer : public Server {
public:
    WiFiServer(uint16_t port = 80) : _port(port), _started(false) {}

    void begin() {
        if (_started) return;
        _started = true;
        // Signal Node.js proxy to start listening on this port on our behalf
        char payload[16];
        snprintf(payload, sizeof(payload), "%u", _port);
        WiFiClass::_sendFrame(0, "SERVER_LISTEN", payload);
    }

    void begin(uint16_t port) {
        _port = port;
        begin();
    }

    // Process inbound connections
    WiFiClient available() {
        if (!_started) return WiFiClient();
        
        uint8_t incomingId = WiFiClass::_popIncomingClient();
        if (incomingId > 0) {
            WiFiClient newClient;
            newClient.attach(incomingId);
            return newClient;
        }
        
        return WiFiClient();
    }

    // Optional Accept standard signature
    WiFiClient available(uint8_t* status) {
        WiFiClient client = available();
        if (status) {
            *status = client ? 1 : 0;
        }
        return client;
    }

    void end() {
        if (!_started) return;
        char payload[16];
        snprintf(payload, sizeof(payload), "%u", _port);
        WiFiClass::_sendFrame(0, "SERVER_CLOSE", payload);
        _started = false;
    }

    // Deprecated / stubs
    void close() { end(); }
    void stop() { end(); }
    
    // Server stream write (broadcasts to all active clients? usually unsupported cleanly, stubbed)
    size_t write(uint8_t b) { return 0; }
    size_t write(const uint8_t *buf, size_t size) { return 0; }

protected:
    uint16_t _port;
    bool     _started;
};

#endif // SIMULATOR_WIFI_SERVER_H
