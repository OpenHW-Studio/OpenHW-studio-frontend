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
  '    client.print("ECHO:" + line + "\\n");',
  '    Serial.println("CSRV-ECHOED");',
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
  '  if (ok) {',
  '    client.print("HELLO-LAN\\n");',
  '    unsigned long t1 = millis();',
  '    String reply = "";',
  '    while (millis() - t1 < 30000 && reply.length() == 0) {',
  '      while (client.available()) reply += (char)client.read();',
  '      delay(100);',
  '    }',
  '    reply.trim();',
  '    Serial.print("CCLI-RX:"); Serial.println(reply);',
  '    if (reply == "ECHO:HELLO-LAN") Serial.println("CCLI-LAN-DONE");',
  '    client.stop();',
  '  }',
  '}',
  'void loop() { delay(5000); }',
].join('\n');

export { SERVER_CODE, CLIENT_CODE };
