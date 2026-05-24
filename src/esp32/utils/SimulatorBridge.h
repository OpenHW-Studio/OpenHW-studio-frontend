/**
 * SimulatorBridge.h — ESP32 QEMU GPIO Shim
 * ─────────────────────────────────────────
 * Automatically injected before every user sketch at compile time.
 * MUST NOT be visible to the user in the code editor.
 *
 * Architecture:
 *   UART pipe = uart.out    (firmware → Node.js via Serial TX)
 *   UART pipe = uart.in     (Node.js → firmware via Serial RX)
 *
 * Two separate named FIFOs give us full-duplex communication without
 * the stdin/stdout conflict that exists when using a single serial pipe.
 *
 * GPIO output protocol  (firmware → Node.js, written to uart.out):
 *   \n>GPIO:pin:value<\n   (value is 0 or 1)
 *
 * GPIO input protocol   (Node.js → firmware, written to uart.in):
 *   <GPIO:pin:value>\n     (value is 0 or 1)
 */

#ifndef SIMULATOR_BRIDGE_H
#define SIMULATOR_BRIDGE_H

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

// ─── State arrays for all 40 ESP32 GPIO pins ─────────────────────────────────
volatile uint8_t sim_gpio_state[40] = {0};  // current pin level (0 or 1)
volatile uint8_t sim_gpio_mode[40]  = {0};  // 0 = INPUT, 1 = OUTPUT

// ─── UART Task — runs on Core 0, separate from the user loop on Core 1 ────────
// Continuously drains the UART RX buffer.
// When a complete <GPIO:pin:value>\n command is received, it updates the
// corresponding entry in sim_gpio_state[] so that the next sim_digitalRead()
// call sees the injected value immediately.

void simulatorUARTTask(void* pvParameters) {
    String rxBuf = "";
    rxBuf.reserve(32);

    for (;;) {
        // Drain all available bytes in one pass to minimize latency
        while (Serial.available() > 0) {
            char c = (char)Serial.read();

            if (c == '\n') {
                // ── Parse GPIO input command: <GPIO:pin:value> ──────────────────
                // We accept both <GPIO:..> and >GPIO:..<  to be forward-compatible
                if ((rxBuf.startsWith("<GPIO:") || rxBuf.startsWith(">GPIO:")) && rxBuf.length() > 8) {
                    int firstColon  = rxBuf.indexOf(':');                       // after "GPIO"
                    int secondColon = rxBuf.indexOf(':', firstColon + 1);
                    int closing     = rxBuf.indexOf(rxBuf.charAt(0) == '<' ? '>' : '<', secondColon);

                    if (firstColon > 0 && secondColon > firstColon && closing > secondColon) {
                        int pin = rxBuf.substring(firstColon + 1, secondColon).toInt();
                        int val = rxBuf.substring(secondColon + 1, closing).toInt();

                        if (pin >= 0 && pin < 40) {
                            sim_gpio_state[pin] = (uint8_t)(val & 1);
                        }
                    }
                }
                rxBuf = "";
            } else if (c != '\r') {
                // Guard against runaway input — drop if suspiciously long
                if (rxBuf.length() < 64) rxBuf += c;
            }
        }

        // Yield 5ms — tight enough for ~200Hz input events without CPU-spinning
        vTaskDelay(5 / portTICK_PERIOD_MS);
    }
}

// ─── Core interception functions ──────────────────────────────────────────────

void sim_pinMode(uint8_t pin, uint8_t mode) {
    if (pin < 40) {
        sim_gpio_mode[pin] = (mode == OUTPUT) ? 1 : 0;
    }
    // We don't call the real pinMode — there is no real hardware in QEMU
}

uint8_t sim_digitalRead(uint8_t pin) {
    if (pin < 40) return sim_gpio_state[pin];
    return LOW;
}

void sim_digitalWrite(uint8_t pin, uint8_t val) {
    if (pin >= 40) return;

    const uint8_t clamped = val ? 1 : 0;
    sim_gpio_state[pin] = clamped;

    // Send GPIO output event to Node.js over uart.out (the UART TX pipe).
    // Format: \n>GPIO:pin:value<\n
    Serial.printf("\n>GPIO:%d:%d<\n", pin, clamped);
    
    // Debug output — visible in the serial monitor to confirm the shim is working
    Serial.printf("[Simulator] Pin %d set to %d\n", pin, clamped);
    
    Serial.flush();
}

// ─── Auto-initialisation — runs BEFORE user setup() ──────────────────────────
__attribute__((constructor))
void initSimulatorBridge() {
    Serial.begin(115200);   // ensure Serial is open before the UART task starts

    // Pin the UART task to Core 0. The Arduino loop() task runs on Core 1.
    // This ensures GPIO injection from Node.js is processed without interfering
    // with the timing of the user's sketch.
    xTaskCreatePinnedToCore(
        simulatorUARTTask,  /* task function  */
        "SimBridgeUART",    /* task name      */
        4096,               /* stack (bytes)  */
        NULL,               /* parameters     */
        2,                  /* priority       */
        NULL,               /* task handle    */
        0                   /* Core 0         */
    );
}

// ─── Macro hijacking — MUST remain at the very bottom of this file ────────────
// Every call to pinMode/digitalRead/digitalWrite in user code below this include
// will be transparently redirected to the shim functions above.
#undef  pinMode
#undef  digitalRead
#undef  digitalWrite
#define pinMode      sim_pinMode
#define digitalRead  sim_digitalRead
#define digitalWrite sim_digitalWrite

#endif // SIMULATOR_BRIDGE_H
