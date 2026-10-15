/*
 * SDD JS-mirror device (OpenHW-studio fork addition).
 *
 * A virtual I2C slave that ACKs its address and mirrors every transaction
 * into a pollable ring buffer for the JS host, instead of modelling any
 * real chip. The simulator UI owns the actual component models (displays,
 * sensors); this device is purely the electrical termination + observer:
 * firmware sees a live ACKed bus, JS sees every byte.
 *
 * Ring entry encoding (uint16_t):
 *   0x100 | addr7   START (incl. RESTART) targeting addr7
 *   0x200           STOP
 *   0x00..0xFF      data byte (direction: master→slave write path)
 * Reads return 0xFF (open-bus behavior, identical to unattached today).
 *
 * Multiple addresses share one ring (one sdd_add call attaches all of
 * them — sdd_add resets the registry per call, so batching here is what
 * makes multi-slave boards work). The JS side tracks the current address
 * from the last START, exactly like the AVR TWIAdapter's activeSlave.
 *
 * Overflow: drop-oldest + sticky drop counter (polled for diagnostics).
 *
 * Usage (single call, comma-separated):
 *   jsmirror:i2c=0,addr=0x3c          one mirror on I2C0 at 0x3C
 *   jsmirror:i2c=0,addr=0x3c,addr=0x27 two mirrors sharing the ring
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "sdd.h"

#define JSMIRROR_RING_BITS  12
#define JSMIRROR_RING_SIZE  (1u << JSMIRROR_RING_BITS)
#define JSMIRROR_RING_MASK  (JSMIRROR_RING_SIZE - 1u)

#define JSMIRROR_EVT_START  0x0100u
#define JSMIRROR_EVT_STOP   0x0200u

typedef struct {
    int i2c_addr;
} sdd_jsmirror_devctx_t;

static uint16_t jsmirror_ring[JSMIRROR_RING_SIZE];
static uint32_t jsmirror_head = 0;
static uint32_t jsmirror_tail = 0;
static uint32_t jsmirror_drops = 0;

static void jsmirror_push(uint16_t entry) {
    jsmirror_ring[jsmirror_head & JSMIRROR_RING_MASK] = entry;
    jsmirror_head++;
    if (jsmirror_head - jsmirror_tail > JSMIRROR_RING_SIZE) {
        jsmirror_tail = jsmirror_head - JSMIRROR_RING_SIZE;
        jsmirror_drops++;
    }
}

/* --- device callbacks (one ctx per attached address) --- */

static void jsmirror_i2c_start(void *ctx) {
    sdd_jsmirror_devctx_t *d = (sdd_jsmirror_devctx_t *)ctx;
    if (!d) return;
    jsmirror_push(JSMIRROR_EVT_START | ((uint16_t)(d->i2c_addr & 0x7F)));
}

static void jsmirror_i2c_stop(void *ctx) {
    (void)ctx;
    jsmirror_push(JSMIRROR_EVT_STOP);
}

static int jsmirror_i2c_write(void *ctx, uint8_t data) {
    (void)ctx;
    jsmirror_push((uint16_t)data);
    return 0;  /* ACK everything */
}

static uint8_t jsmirror_i2c_read(void *ctx) {
    (void)ctx;
    return 0xFF;  /* open-bus behavior */
}

static void jsmirror_cleanup(void *ctx) {
    free(ctx);
}

/* --- JS polling API (exported) --- */

int picoemu_jsmirror_pending(void) {
    return (int)(jsmirror_head - jsmirror_tail);
}

int picoemu_jsmirror_drops(void) {
    return (int)jsmirror_drops;
}

int picoemu_jsmirror_pop(uint16_t *out, int max) {
    int n = 0;
    if (!out || max <= 0) return 0;
    while (n < max && jsmirror_tail != jsmirror_head) {
        out[n++] = jsmirror_ring[jsmirror_tail & JSMIRROR_RING_MASK];
        jsmirror_tail++;
    }
    return n;
}

/* --- factory --- */

static int jsmirror_attach_one(int i2c_bus, int i2c_addr, const char *name) {
    sdd_jsmirror_devctx_t *state =
        (sdd_jsmirror_devctx_t *)calloc(1, sizeof(sdd_jsmirror_devctx_t));
    if (!state) return -1;
    state->i2c_addr = i2c_addr & 0x7F;

    sdd_device_t dev;
    memset(&dev, 0, sizeof(dev));
    strncpy(dev.name, name ? name : "jsmirror", SDD_NAME_LEN - 1);
    dev.i2c_bus = i2c_bus;
    dev.i2c_addr = state->i2c_addr;
    dev.i2c_write = jsmirror_i2c_write;
    dev.i2c_read = jsmirror_i2c_read;
    dev.i2c_start = jsmirror_i2c_start;
    dev.i2c_stop = jsmirror_i2c_stop;
    dev.spi_bus = -1;
    dev.cleanup = jsmirror_cleanup;
    dev.ctx = state;

    int idx = sdd_register(&dev);
    if (idx < 0) {
        free(state);
        return -1;
    }
    fprintf(stderr, "[SDD] jsmirror on I2C%d addr 0x%02X (ring shared)\n",
            i2c_bus, state->i2c_addr);
    return idx;
}

int sdd_create_jsmirror(int i2c_bus, const int *addrs, int naddrs) {
    int ok = 0;
    for (int i = 0; i < naddrs; i++) {
        if (jsmirror_attach_one(i2c_bus, addrs[i], "jsmirror") >= 0) ok++;
    }
    return ok > 0 ? ok : -1;
}
