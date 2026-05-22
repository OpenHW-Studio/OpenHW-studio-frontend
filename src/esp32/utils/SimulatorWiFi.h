/**
 * SimulatorWiFi.h  — Self-contained shim, no SDK dependencies
 * Works with ESP32 Arduino 3.x.x (esp-idf 5.x based)
 */
#ifndef SIMULATOR_WIFI_H
#define SIMULATOR_WIFI_H

#pragma once

// ─── Pull in only the absolute minimum Arduino types ─────────────────────────
#include <Arduino.h>
#include <mutex>

// ─── WiFi status constants as plain #defines (no typedef enum — avoids       ──
//     conflict with the real wl_status_t defined in the ESP32 3.x WiFi lib)   
#ifndef WL_NO_SHIELD
#  define WL_NO_SHIELD       255
#endif
#ifndef WL_IDLE_STATUS
#  define WL_IDLE_STATUS     0
#endif
#ifndef WL_NO_SSID_AVAIL
#  define WL_NO_SSID_AVAIL   1
#endif
#ifndef WL_SCAN_COMPLETED
#  define WL_SCAN_COMPLETED  2
#endif
#ifndef WL_CONNECTED
#  define WL_CONNECTED       3
#endif
#ifndef WL_CONNECT_FAILED
#  define WL_CONNECT_FAILED  4
#endif
#ifndef WL_CONNECTION_LOST
#  define WL_CONNECTION_LOST 5
#endif
#ifndef WL_DISCONNECTED
#  define WL_DISCONNECTED    6
#endif

// Only define wl_status_t if the real SDK hasn't already
#ifndef _WL_STATUS_T_DEFINED_
#  define _WL_STATUS_T_DEFINED_
typedef uint8_t wl_status_t;
#endif

// ─── WiFi mode constants ──────────────────────────────────────────────────────
#ifndef WIFI_MODE_STA
#  define WIFI_MODE_NULL  0
#  define WIFI_MODE_STA   1
#  define WIFI_MODE_AP    2
#  define WIFI_MODE_APSTA 3
#endif
#ifndef WIFI_STA
#  define WIFI_STA    WIFI_MODE_STA
#  define WIFI_AP     WIFI_MODE_AP
#  define WIFI_AP_STA WIFI_MODE_APSTA
#  define WIFI_OFF    WIFI_MODE_NULL
#endif

// Auth mode stubs
#ifndef WIFI_AUTH_OPEN
#  define WIFI_AUTH_OPEN     0
#  define WIFI_AUTH_WPA_PSK  2
#  define WIFI_AUTH_WPA2_PSK 3
#endif

// ─── Simulated IP / identity ──────────────────────────────────────────────────
#define SIM_RSSI      (-55)
#define SIM_CHANNEL   6
#define SIM_BAUD      115200

// ─── WiFiClass shim ───────────────────────────────────────────────────────────

class WiFiClass {
public:
    WiFiClass() {}

    // begin() — immediately returns WL_CONNECTED, boots UART1 proxy once
    wl_status_t begin(const char* ssid = nullptr, const char* pass = nullptr,
                      int32_t channel = 0, const uint8_t* bssid = nullptr,
                      bool connect = true) {
        _ssid = ssid ? String(ssid) : String("SimNet");
        _status = WL_CONNECTED;
        if (!_proxyReady) {
            Serial1.begin(SIM_BAUD);
            _proxyReady = true;
            _sendFrame(0, "WIFI_READY", "1");
        }
        return (wl_status_t)_status;
    }
    wl_status_t begin(const String& ssid, const String& pass) {
        return begin(ssid.c_str(), pass.c_str());
    }
    wl_status_t begin(const String& ssid) {
        return begin(ssid.c_str(), nullptr);
    }
    void disconnect(bool wifioff = false) { _status = WL_DISCONNECTED; }

    // Status
    wl_status_t status()      { return (wl_status_t)_status; }
    bool        isConnected() { return _status == WL_CONNECTED; }

    // Addressing
    IPAddress localIP()    { return IPAddress(10, 13, 37, 2); }
    IPAddress gatewayIP()  { return IPAddress(10, 13, 37, 1); }
    IPAddress subnetMask() { return IPAddress(255, 255, 255, 0); }
    IPAddress dnsIP(uint8_t = 0) { return IPAddress(8, 8, 8, 8); }

    // Identity
    String  SSID()         { return _ssid; }
    int32_t RSSI()         { return SIM_RSSI; }
    int32_t channel()      { return SIM_CHANNEL; }
    String  macAddress()   { return String("DE:AD:BE:EF:00:01"); }
    uint8_t* BSSID(uint8_t* b = nullptr) {
        static uint8_t mac[6] = {0xDE,0xAD,0xBE,0xEF,0x00,0x01};
        if (b) { memcpy(b, mac, 6); return b; }
        return mac;
    }

    // Mode / config stubs
    bool mode(uint8_t)             { return true; }
    bool enableSTA(bool)           { return true; }
    bool enableAP(bool)            { return false; }
    bool setAutoReconnect(bool)    { return true; }
    bool setAutoConnect(bool)      { return true; }
    bool setHostname(const char*)  { return true; }
    bool setSleep(bool)            { return true; }
    bool setTxPower(int)           { return true; }

    // Scan stubs
    int8_t  scanNetworks(bool = false, bool = false,
                         bool = false, uint32_t = 300, uint8_t = 0) { return 0; }
    int16_t scanComplete() { return 0; }
    void    scanDelete()   {}

    // AP / SmartConfig stubs
    bool softAP(const char*, const char* = nullptr,
                int = 1, int = 0, int = 4) { return false; }
    bool softAPdisconnect(bool = false) { return false; }
    bool beginSmartConfig() { return false; }
    bool stopSmartConfig()  { return false; }
    bool smartConfigDone()  { return false; }

    // ── Internal proxy helpers ────────────────────────────────────────────────
    static void _sendFrame(uint8_t id, const char* cmd, const char* payload) {
        std::lock_guard<std::mutex> lock(_simMtx);
        Serial1.write(0x01);
        Serial1.print(id);
        Serial1.write(':');
        Serial1.print(cmd);
        Serial1.write(':');
        Serial1.print(payload);
        Serial1.write(0x02);
        Serial1.write('\n');
        Serial1.flush();
    }

    static void _pumpSerial() {
        std::lock_guard<std::mutex> lock(_simMtx);
        while (Serial1.available()) {
            char c = (char)Serial1.read();
            _inBuf += c;
            if (c == '\n') {
                int s = _inBuf.indexOf(char(0x03));
                int e = _inBuf.indexOf(char(0x04));
                if (s >= 0 && e > s) {
                    String frame = _inBuf.substring(s + 1, e);
                    _inBuf = "";
                    int col = frame.indexOf(':');
                    if (col > 0) {
                        uint8_t id = (uint8_t)frame.substring(0, col).toInt();
                        String  pl = frame.substring(col + 1);
                        if (id == 0 && pl.startsWith("INCOMING_CLIENT:")) {
                            uint8_t nid = (uint8_t)pl.substring(16).toInt();
                            if (_clientQueueLen < 8) _clientQueue[_clientQueueLen++] = nid;
                        } else if (id >= 1 && id <= 8) {
                            if (_connBufs[id].length() < 8192) { // increased to 8k
                                _connBufs[id] += pl;
                                _connBufs[id] += '\n';
                            }
                        }
                    }
                } else { _inBuf = ""; }
            }
        }
    }

    static bool _popFrame(uint8_t id, String& out) {
        _pumpSerial();
        std::lock_guard<std::mutex> lock(_simMtx);
        if (id < 1 || id > 8) return false;
        int i = _connBufs[id].indexOf('\n');
        if (i < 0) return false;
        out = _connBufs[id].substring(0, i);
        _connBufs[id] = _connBufs[id].substring(i + 1);
        return true;
    }

    static uint8_t _popIncomingClient() {
        _pumpSerial();
        std::lock_guard<std::mutex> lock(_simMtx);
        if (_clientQueueLen == 0) return 0;
        uint8_t id = _clientQueue[0];
        for (int i = 1; i < _clientQueueLen; i++) _clientQueue[i-1] = _clientQueue[i];
        _clientQueueLen--;
        return id;
    }

private:
    uint8_t _status      = WL_DISCONNECTED;
    bool    _proxyReady  = false;
    String  _ssid;

    static std::mutex _simMtx;
    static String     _inBuf;
    static String     _connBufs[9];   // index 1-8
    static uint8_t    _clientQueue[8];
    static uint8_t    _clientQueueLen;
};

// Static storage
std::mutex WiFiClass::_simMtx;
String     WiFiClass::_inBuf         = "";
String     WiFiClass::_connBufs[9];
uint8_t    WiFiClass::_clientQueue[8];
uint8_t    WiFiClass::_clientQueueLen = 0;

// Global singleton
extern WiFiClass WiFi;
WiFiClass WiFi;

// The real ESP32 WiFi.h pulls in WiFiClient.h. Libraries like Blynk depend on this.
#include "WiFiClient.h"

#endif // SIMULATOR_WIFI_H
