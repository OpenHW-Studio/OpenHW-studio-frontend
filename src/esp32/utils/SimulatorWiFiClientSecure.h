/**
 * SimulatorWiFiClientSecure.h
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop-in replacement for WiFiClientSecure.h.
 * Inherits from WiFiClient and signals TLS_CONNECT to NetworkProxy.js
 * which then performs the actual TLS handshake on the Node.js side.
 *
 * This means the simulated ESP32 can talk to AWS IoT, HiveMQ, Adafruit IO,
 * and any other TLS endpoint without paying the RSA overhead inside QEMU.
 */

#ifndef SIMULATOR_WIFI_CLIENT_SECURE_H
#define SIMULATOR_WIFI_CLIENT_SECURE_H

#pragma once

#include "WiFiClient.h"

class WiFiClientSecure : public WiFiClient {
public:
    WiFiClientSecure() : WiFiClient() {}

    // ── TLS connect overrides ─────────────────────────────────────────────────
    int connect(const char* host, uint16_t port) override {
        return _doConnect(host, port, true);   // true = TLS
    }
    int connect(IPAddress ip, uint16_t port) override {
        char ipStr[20];
        snprintf(ipStr, sizeof(ipStr), "%d.%d.%d.%d", ip[0], ip[1], ip[2], ip[3]);
        return _doConnect(ipStr, port, true);
    }
    int connect(const String& host, uint16_t port) {
        return connect(host.c_str(), port);
    }

    // ── Certificate API stubs (Node.js handles real TLS) ─────────────────────
    void setCACert(const char*)              {}
    void setCertificate(const char*)         {}
    void setPrivateKey(const char*)          {}
    void setCACertBundle(const uint8_t*, int){}
    void setInsecure()                       {}
    bool verify(const char*, const char*)    { return true; }
    bool verifyCertChain(const char*)        { return true; }

    // ── begin() TLS overload ──────────────────────────────────────────────────
    int begin(const char* host, uint16_t port) {
        return connect(host, port);
    }
};

#endif // SIMULATOR_WIFI_CLIENT_SECURE_H
