// Shared sketches for the ESP32-CAM 2-board LAN cell + its diagnostic
// twin (tests/e2e/esp32-cam-lan.spec.js, tests/e2e/esp32-cam-lan-diag.spec.js).
// Kept in ONE file so the diagnostic twin can never drift from the cell
// it instruments.
//
// JOIN WAIT (lane/esp32-cov2, 2026-10-20): the association is completed by
// the gateway over the host WebSocket, so the amount of GUEST time that
// elapses before the STA is associated depends on how loaded the box is.
// The old fixed `delay(8000)` therefore expired before the association on
// a loaded box -> STATUS=0 (not 3) with no error anywhere. Both boards now
// WAIT for WL_CONNECTED in a bounded guest-time loop and print the elapsed
// GUEST ms on every iteration (CSRV-WAIT / CCLI-WAIT) — the wire then also
// measures the engine's guest-time rate.
// GUEST-CLOCK TRACE + WINDOW (lane/esp32-cov2, 2026-10-22):
//   run 2 of the 3x measurement failed with a NEW signature: the client
//   connected (CCLI-CONN:1) and the server DID receive HELLO-LAN
//   (CSRV-RX:HELLO-LAN) and DID echo it (CSRV-ECHOED) — but the client's
//   30 s GUEST-time read window had already expired, so it printed an
//   EMPTY 'CCLI-RX:' and never reached CCLI-LAN-DONE. The wire shows why:
//   the client's first data segment was NOT answered by the server for
//   ~2.5 s wall; only the TCP retransmission was answered (gateway log:
//   64-byte frame at t0, 64-byte retransmission at t0+2.5 s, then the
//   69-byte ECHO). The guest clock is NOT wall-clock (the guest fast-
//   forwards idle time), so a 30 s GUEST window can expire long before
//   the transport's retransmission lands.
//   The sketches now stamp the GUEST clock at every step
//   (CSRV-RXAT / CSRV-ECHOAT / CCLI-CONNAT / CCLI-SENTAT / CCLI-RXAT)
//   and the client polls for 120 s GUEST time with a progress line
//   (CCLI-POLL:<guestms>:avail=<n>) so the wire and the guest clock can
//   be correlated. The server also flushes the echo before closing the
//   socket (client.flush()).
// READER FIX (lane/esp32-cov2, 2026-10-22) — THE FLAKE, MEASURED:
//   the old client read with `while (client.available()) reply += (char)
//   client.read();` and left the wait as soon as `reply.length() != 0`.
//   The engine's socket hands the application ONE stray byte first
//   (measured: CCLI-RAW starts with 0 — a NUL that `String::trim()`
//   then removes, which is why the serial showed an EMPTY 'CCLI-RX:'),
//   so the wait ended after 37 GUEST ms (CCLI-RXAT:37) — ~1.1 s of
//   GUEST time BEFORE the server even echoed (CSRV-RXAT:19111,
//   CSRV-ECHOAT:19112). The echo was on the wire; the guest had already
//   given up. The reader now:
//     * skips c <= 0 (the stray NUL / a -1 "no data" read),
//     * waits for a COMPLETE line (a trailing '\n'),
//     * matches the payload with indexOf() instead of ==,
//   and prints the raw byte codes (CCLI-RAW) so the stray byte stays
//   visible on the wire instead of being silently trimmed.
const SERVER_CODE = [
  '#include <WiFi.h>',
  'WiFiServer server(41000);',
  'void setup() {',
  '  Serial.begin(115200);',
  '  delay(1000);',
  '  Serial.println("CSRV-START");',
  '  WiFi.config(IPAddress(192, 168, 4, 20), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));',
  '  Serial.println("CSRV-CONFIG-OK");',
  '  WiFi.begin("ESP-GUEST");',
  '  Serial.println("CSRV-BEGUN");',
  '  unsigned long t0 = millis();',
  '  while (WiFi.status() != WL_CONNECTED && (millis() - t0) < 60000) {',
  '    Serial.print("CSRV-WAIT:"); Serial.print(millis() - t0); Serial.print(":st="); Serial.println(WiFi.status());',
  '    delay(1000);',
  '  }',
  '  Serial.print("CSRV-STATUS="); Serial.println(WiFi.status());',
  '  Serial.print("CSRV-IP="); Serial.println(WiFi.localIP());',
  '  Serial.print("CSRV-MAC="); Serial.println(WiFi.macAddress());',
  '  server.begin();',
  '  Serial.println("CSRV-LISTEN");',
  '}',
  'void loop() {',
  '  WiFiClient client = server.available();',
  '  if (client && client.connected()) {',
  '    String line = client.readStringUntil(10);',
  '    line.trim();',
  '    Serial.print("CSRV-RX:"); Serial.println(line);',
  '    Serial.print("CSRV-RXAT:"); Serial.println(millis());',
  '    client.print("ECHO:" + line + "\\n");',
  '    client.flush();',
  '    Serial.println("CSRV-ECHOED");',
  '    Serial.print("CSRV-ECHOAT:"); Serial.println(millis());',
  '    delay(500);',
  '    client.stop();',
  '  }',
  '  delay(200);',
  '}',
].join('\n');

const CLIENT_CODE = [
  '#include <WiFi.h>',
  'void setup() {',
  '  Serial.begin(115200);',
  '  delay(1000);',
  '  Serial.println("CCLI-START");',
  '  WiFi.config(IPAddress(192, 168, 4, 21), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));',
  '  Serial.println("CCLI-CONFIG-OK");',
  '  WiFi.begin("ESP-GUEST");',
  '  Serial.println("CCLI-BEGUN");',
  '  unsigned long t0 = millis();',
  '  while (WiFi.status() != WL_CONNECTED && (millis() - t0) < 60000) {',
  '    Serial.print("CCLI-WAIT:"); Serial.print(millis() - t0); Serial.print(":st="); Serial.println(WiFi.status());',
  '    delay(1000);',
  '  }',
  '  Serial.print("CCLI-STATUS="); Serial.println(WiFi.status());',
  '  Serial.print("CCLI-IP="); Serial.println(WiFi.localIP());',
  '  Serial.print("CCLI-MAC="); Serial.println(WiFi.macAddress());',
  '  WiFiClient client;',
  '  int ok = 0;',
  '  Serial.println("CCLI-CONNECTING");',
  '  for (int i = 0; i < 60 && !ok; i++) {',
  '    if (client.connect(IPAddress(192, 168, 4, 20), 41000, 3000)) ok = 1;',
  '    else { Serial.print("CCLI-TRY:"); Serial.println(i); delay(1000); }',
  '  }',
  '  Serial.print("CCLI-CONN:"); Serial.println(ok);',
  '  Serial.print("CCLI-CONNAT:"); Serial.println(millis());',
  '  if (ok) {',
  '    client.print("HELLO-LAN\\n");',
  '    client.flush();',
  '    Serial.print("CCLI-SENTAT:"); Serial.println(millis());',
  '    unsigned long t1 = millis();',
  '    String reply = "";',
  '    String raw = "";',
  '    while (millis() - t1 < 120000) {',
  '      while (client.available()) {',
  '        int c = client.read();',
  '        if (c >= 0) { raw += (char)c; }',
  '        if (c > 0) { if (c == 10) { reply += (char)10; } else { reply += (char)c; } }',
  '      }',
  '      if (reply.length() > 0 && reply[reply.length()-1] == 10) break;',
  '      delay(100);',
  '    }',
  '    Serial.print("CCLI-RXAT:"); Serial.println(millis());',
  '    Serial.print("CCLI-RAW:");',
  '    for (unsigned int i = 0; i < raw.length(); i++) { Serial.print((int)raw[i]); Serial.print(","); }',
  '    Serial.println();',
  '    reply.trim();',
  '    Serial.print("CCLI-RX:"); Serial.println(reply);',
  '    if (reply.indexOf("ECHO:HELLO-LAN") >= 0) Serial.println("CCLI-LAN-DONE");',
  '    client.stop();',
  '  }',
  '}',
  'void loop() { delay(5000); }',
].join('\n');

export { SERVER_CODE, CLIENT_CODE };
