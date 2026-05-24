/**
 * WiFiClient.h — Standalone shim for ESP32 Arduino 3.x
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides the full WiFiClient API that BlynkArduinoClientGen<WiFiClient>,
 * PubSubClient, HTTPClient, etc. need.
 *
 * Deliberately does NOT extend Client or include <Client.h>:
 *   - In ESP32 Arduino 3.3.7, <Client.h> pulls in NetworkClient and the real
 *     WiFi stack, causing type conflicts with our lightweight shim.
 *   - Blynk's BlynkArduinoClientGen<T> template does NOT require T to extend
 *     Client; it calls methods directly via the template parameter.
 *
 * All socket traffic is proxied over UART1 → NetworkProxy.js.
 */

#ifndef SIMULATOR_WIFI_CLIENT_H
#define SIMULATOR_WIFI_CLIENT_H

#pragma once

#include "WiFi.h"    // our SimulatorWiFi.h (provides WiFiClass helpers)
#include <Arduino.h>
#include <IPAddress.h>

// ─── Simple binary ring-buffer ────────────────────────────────────────────────
class _SimRingBuf {
public:
    _SimRingBuf() : _h(0), _t(0), _n(0) {}
    void clear() { _h = _t = _n = 0; }
    bool push(uint8_t b) {
        if (_n >= CAP) return false;
        _buf[_t] = b; _t = (_t + 1) % CAP; _n++; return true;
    }
    int pop()  { if (!_n) return -1; uint8_t b=_buf[_h]; _h=(_h+1)%CAP; _n--; return b; }
    int peek() const { return _n ? _buf[_h] : -1; }
    int available() const { return _n; }
private:
    static const int CAP = 4096;
    uint8_t _buf[CAP];
    int _h, _t, _n;
};

// ─── Connection ID allocator ──────────────────────────────────────────────────
static uint8_t _wfcNextId = 1;
static uint8_t _wfcAllocId() { uint8_t id=_wfcNextId; _wfcNextId=(_wfcNextId%8)+1; return id; }

// ─── WiFiClient ───────────────────────────────────────────────────────────────

class WiFiClient {
public:
    WiFiClient()  : _id(0), _conn(false) {}
    ~WiFiClient() {}

    // ── connect ───────────────────────────────────────────────────────────────
    virtual int connect(IPAddress ip, uint16_t port) {
        char h[20]; snprintf(h, sizeof(h), "%d.%d.%d.%d", ip[0],ip[1],ip[2],ip[3]);
        return _open(h, port, false);
    }
    virtual int connect(const char* host, uint16_t port) {
        return _open(host, port, false);
    }
    int connect(const String& host, uint16_t port) {
        return connect(host.c_str(), port);
    }

    // ── begin (alias used by BlynkArduinoClientGen) ───────────────────────────
    int begin(const char* host, uint16_t port)  { return connect(host, port); }
    int begin(IPAddress ip,     uint16_t port)  { return connect(ip, port); }

    // ── stop / disconnect ─────────────────────────────────────────────────────
    virtual void stop() {
        if (_id && _conn) { WiFiClass::_sendFrame(_id, "CLOSE", ""); }
        _conn = false; _id = 0; _rx.clear();
    }
    void disconnect() { stop(); }

    // ── connected ─────────────────────────────────────────────────────────────
    virtual uint8_t connected() { _pump(); return _conn ? 1 : 0; }
    explicit operator bool()    { return connected(); }

    // ── available ─────────────────────────────────────────────────────────────
    virtual int available() { _pump(); return _rx.available(); }

    // ── read ──────────────────────────────────────────────────────────────────
    virtual int     read()                          { _pump(); return _rx.pop(); }
    virtual int     read(uint8_t* buf, size_t n)    { _pump(); int c=0; while(c<(int)n&&_rx.available()) buf[c++]=(uint8_t)_rx.pop(); return c; }
    virtual int     peek()                          { _pump(); return _rx.peek(); }
    
    virtual void    setTimeout(unsigned long timeout) { _timeout = timeout; }
    virtual size_t  readBytes(char *buffer, size_t length) {
        size_t count = 0;
        unsigned long start = millis();
        while (count < length) {
            int c = read();
            if (c >= 0) {
                buffer[count++] = (char)c;
                start = millis();
            } else {
                if (millis() - start >= _timeout) break;
                delay(1);
            }
        }
        return count;
    }

    // ── write ─────────────────────────────────────────────────────────────────
    virtual size_t write(uint8_t b)                 { return write(&b, 1); }
    virtual size_t write(const uint8_t* buf, size_t n) {
        if (!_conn || !_id || !n) return 0;
        String h; h.reserve(n * 2);
        for (size_t i = 0; i < n; i++) {
            char tmp[3]; snprintf(tmp, sizeof(tmp), "%02X", buf[i]); h += tmp;
        }
        WiFiClass::_sendFrame(_id, "WRITE", h.c_str());
        return n;
    }
    virtual size_t write(const char* s)             { return s ? write((const uint8_t*)s, strlen(s)) : 0; }

    // ── flush ─────────────────────────────────────────────────────────────────
    virtual void flush() {}

    // ── print helpers ─────────────────────────────────────────────────────────
    size_t print(const String& s)   { return write((const uint8_t*)s.c_str(), s.length()); }
    size_t print(const char* s)     { return s ? write((const uint8_t*)s, strlen(s)) : 0; }
    size_t println(const String& s) { String l=s+"\r\n"; return write((const uint8_t*)l.c_str(),l.length()); }
    size_t println(const char* s)   { String l=String(s)+"\r\n"; return write((const uint8_t*)l.c_str(),l.length()); }
    size_t println()                { return write((const uint8_t*)"\r\n",2); }

    // Remote address stubs
    IPAddress remoteIP()   { return IPAddress(0,0,0,0); }
    uint16_t  remotePort() { return 0; }
    IPAddress localIP()    { return IPAddress(10,13,37,2); }
    uint16_t  localPort()  { return 0; }

    // Used by WiFiServer to bind an inbound connection
    void attach(uint8_t id) { _id = id; _conn = true; }
    uint8_t connId() const  { return _id; }

protected:
    uint8_t       _id;
    bool          _conn;
    _SimRingBuf   _rx;
    unsigned long _timeout = 1000;

    int _open(const char* host, uint16_t port, bool tls) {
        _id = _wfcAllocId(); _conn = false; _rx.clear();
        char pl[256]; snprintf(pl, sizeof(pl), "%s:%u", host, port);
        WiFiClass::_sendFrame(_id, tls ? "TLS_CONNECT" : "CONNECT", pl);
        unsigned long dl = millis() + 10000;
        while (millis() < dl) {
            String f;
            if (WiFiClass::_popFrame(_id, f)) {
                if (f == "CONN_OK")   { _conn = true;  return 1; }
                if (f == "CONN_FAIL") { _conn = false; return 0; }
                if (f.startsWith("DATA:")) _pushHex(f.substring(5));
            }
            delay(5);
        }
        return 0;
    }

    void _pump() {
        String f;
        while (WiFiClass::_popFrame(_id, f)) {
            if      (f == "EOF")              { _conn = false; }
            else if (f == "CONN_OK")          { _conn = true;  }
            else if (f == "CONN_FAIL")        { _conn = false; }
            else if (f.startsWith("DATA:"))   { _pushHex(f.substring(5)); }
        }
    }

    void _pushHex(const String& h) {
        for (int i = 0; i + 1 < (int)h.length(); i += 2) {
            uint8_t b = (_n(h[i]) << 4) | _n(h[i+1]);
            _rx.push(b);
        }
    }
    static uint8_t _n(char c) {
        if (c>='0'&&c<='9') return c-'0';
        if (c>='A'&&c<='F') return c-'A'+10;
        if (c>='a'&&c<='f') return c-'a'+10;
        return 0;
    }
};

#endif // SIMULATOR_WIFI_CLIENT_H
