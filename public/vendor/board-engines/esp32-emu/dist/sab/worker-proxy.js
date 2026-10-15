// src/sab/worker-proxy.js
var SAB_SLOT_RUN = 0;
var SAB_SLOT_BUDGET = 1;
var SAB_SLOT_NANOS_LO = 2;
var SAB_SLOT_PC = 4;
var SAB_SLOT_STUCK = 5;
var SAB_SLOT_IDLE = 6;
var SAB_SLOT_PROGRESS_INTERVAL = 7;
var SAB_SLOT_NANOS_HI = 8;
var SAB_SLOT_CMD = 9;
var SAB_SLOT_CMD_ARG0 = 10;
var SAB_SLOT_CMD_ARG1 = 11;
var SAB_SLOT_RESP = 12;
var SAB_SLOT_ERR_FLAG = 13;
var SAB_SLOT_CPU_FREQ = 14;
var SAB_SLOT_WIFI_STATE = 15;
var SAB_SLOT_WIFI_TX_FRAMES = 16;
var SAB_SLOT_WIFI_TX_BYTES = 17;
var SAB_SLOT_WIFI_RX_FRAMES = 18;
var SAB_SLOT_WIFI_RX_BYTES = 19;
var SAB_SLOT_WIFI_PROBES = 20;
var SAB_SLOT_CMD_ARG2 = 21;
var CMD_NONE = 0;
var CMD_RUN = 1;
var CMD_RESET = 2;
var CMD_SEED_MMU = 3;
var CMD_WRITE_UINT32 = 4;
var CMD_READ_MEMORY = 5;
var CMD_GET_PCAP = 6;
var CMD_GET_WIFI_STATS = 7;
var CMD_STEP = 8;
var CMD_GET_FFI_COUNTS = 10;
var CMD_READ_MMIO = 11;
var CMD_UART_RX = 12;
var CMD_SET_PIN_INPUT = 13;
var CMD_SET_TOUCH_INPUT = 14;
var CMD_SET_VOLTAGE = 15;
var CMD_FEED_I2S_RX = 16;
var CMD_SEND_TWAI = 17;
var CMD_PUSH_TWAI = 18;
var CMD_GET_TWAI_TX = 19;
var CMD_WATCHPOINT = 20;
var CMD_PCTRACE = 21;
var CMD_PRESS_RESET = 22;
var CMD_PRESS_BOOT = 23;
var CMD_BT_HCI_POLL = 24;
var CMD_BT_HCI_PUSH = 25;
var CMD_BT_HCI_RESP = 26;
var CMD_BT_HCI_SEND = 27;
var CMD_I2C_SET_SLAVE = 28;
var CMD_I2C_TX_PUSH = 29;
var CMD_I2C_RX_POP = 30;
var CMD_I2C_POLL = 31;
var CMD_SPI_INJECT = 32;
var CMD_SPI_POLL = 33;
var CMD_GET_GPIO_OUT = 34;
var CMD_SAMPLE_GPIO_OUT = 35;
var CMD_POLL_GPIO_CHANGES = 36;
var CMD_SET_ANALOG_INPUT = 37;
var CMD_GET_LEDC = 38;
var CMD_I2S_POLL_TX = 39;
var CMD_I2S_TX_ARM = 40;
var CMD_OW_ATTACH = 41;
var CMD_OW_SET_TEMP = 42;
var CMD_OW_POLL = 43;
var CMD_OW_SCRATCH = 44;
var CMD_WRITE_MMIO = 45;
var RESP_IDLE = 0;
var SAB_NUM_SLOTS = 22;
var UART_RING_SIZE = 16384;
var UART_CTRL_INTS = 2;
var READ_RESP_SIZE = 65536;
var ERR_SAB_SIZE = 256;
var _liveWorkers = /* @__PURE__ */ new Set();
var _shutdownHandlersInstalled = false;
function _installShutdownHandlers() {
  if (_shutdownHandlersInstalled || typeof process === "undefined" || !process.on) return;
  _shutdownHandlersInstalled = true;
  const cleanup = () => {
    for (const w of _liveWorkers) {
      try {
        w.terminate();
      } catch (_) {
      }
    }
    _liveWorkers.clear();
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}
var SimulatorWorker = class {
  constructor() {
    this.worker = null;
    this.ctrlSab = null;
    this.ctrl = null;
    this.uartSab = null;
    this.uartCtrl = null;
    this.uartRing = null;
    this.readRespSab = null;
    this.readResp = null;
    this.errSab = null;
    this.errMsg = null;
    this._ready = false;
    this._chipInfo = {};
    this._onUART = null;
    this._onReady = null;
    this._onError = null;
    this.memory = {};
    this._simMode = "auto";
    this._chunkSize = 5e5;
  }
  /** @returns {'auto'|'tight'|'chunked'} */
  get simMode() {
    return this._simMode;
  }
  /** @param {'auto'|'tight'|'chunked'} mode */
  set simMode(mode) {
    if (mode === "tight" || mode === "chunked" || mode === "auto") this._simMode = mode;
  }
  /** @returns {number} */
  get chunkSize() {
    return this._chunkSize;
  }
  /** @param {number} n */
  set chunkSize(n) {
    if (typeof n === "number" && n > 0 && Number.isFinite(n)) this._chunkSize = Math.floor(n);
  }
  /**
   * Initialize the simulator worker.
   * @param {string} chipType - Chip type (e.g. 'ESP32')
   * @param {any} config - Configuration (flashSizeMB, mmuPages, strapValue, budget, partitions, etc.)
   * @param {Uint8Array|null} flash - Flash image (SharedArrayBuffer-backed preferred)
   * @param {Uint8Array|null} rom - Boot ROM bytes
   * @returns {Promise<void>} Resolves when worker is ready
   */
  async init(chipType, config = {}, flash = null, rom = null) {
    if (this.worker) this.terminate();
    this.ctrlSab = new SharedArrayBuffer(SAB_NUM_SLOTS * 4);
    this.ctrl = new Int32Array(this.ctrlSab);
    Atomics.store(this.ctrl, SAB_SLOT_RUN, 0);
    Atomics.store(this.ctrl, SAB_SLOT_BUDGET, config.budget || 5e4);
    Atomics.store(this.ctrl, SAB_SLOT_PROGRESS_INTERVAL, config.progressInterval || 5e6);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_NONE);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_ERR_FLAG, 0);
    this.uartSab = new SharedArrayBuffer(UART_CTRL_INTS * 4 + UART_RING_SIZE);
    this.uartCtrl = new Int32Array(this.uartSab, 0, 2);
    this.uartCtrl[0] = 0;
    this.uartCtrl[1] = 0;
    this.uartRing = new Uint8Array(this.uartSab, UART_CTRL_INTS * 4, UART_RING_SIZE);
    this.uartRxSab = new SharedArrayBuffer(UART_CTRL_INTS * 4 + UART_RING_SIZE);
    this.uartRxCtrl = new Int32Array(this.uartRxSab, 0, 2);
    this.uartRxCtrl[0] = 0;
    this.uartRxCtrl[1] = 0;
    this.uartRxRing = new Uint8Array(this.uartRxSab, UART_CTRL_INTS * 4, UART_RING_SIZE);
    this.readRespSab = new SharedArrayBuffer(READ_RESP_SIZE);
    this.readResp = new Uint8Array(this.readRespSab);
    this.errSab = new SharedArrayBuffer(ERR_SAB_SIZE);
    this.errMsg = new Uint8Array(this.errSab);
    this.debugSab = new SharedArrayBuffer(772 * 4);
    this.debug = new Uint32Array(this.debugSab);
    let WorkerCtor;
    if (typeof Worker !== "undefined") {
      WorkerCtor = Worker;
    } else {
      WorkerCtor = (await import("worker_threads")).Worker;
    }
    const url = new URL("./worker-entry.js", import.meta.url);
    this.worker = new WorkerCtor(url, { type: "module" });
    _liveWorkers.add(this.worker);
    _installShutdownHandlers();
    if (typeof this.worker.onmessage !== "undefined") {
      this.worker.onmessage = this._onMessage.bind(this);
    } else {
      const w = (
        /** @type {any} */
        this.worker
      );
      w.on("message", this._onMessage.bind(this));
      w.on("error", (err) => {
        if (this._onError) this._onError(err);
      });
    }
    if (flash && flash.buffer instanceof SharedArrayBuffer) {
      this.memory.flash = new Uint8Array(flash.buffer, flash.byteOffset, flash.byteLength);
    }
    if (rom && rom.buffer instanceof SharedArrayBuffer) {
      this.memory.chipROM = new Uint8Array(rom.buffer, rom.byteOffset, rom.byteLength);
    }
    await new Promise((resolve, reject) => {
      this._onReady = resolve;
      this._onError = reject;
      this.worker.postMessage({
        type: "init",
        chipType,
        config: { ...config, simMode: this._simMode, chunkSize: this._chunkSize },
        flash,
        rom,
        sab: this.ctrlSab,
        uartSab: this.uartSab,
        uartRxSab: this.uartRxSab,
        readRespSab: this.readRespSab,
        errSab: this.errSab,
        debugSab: this.debugSab
      });
    });
    this._ready = true;
  }
  // loadROM is superseded by direct SAB write to proxy.memory.chipROM
  //   proxy.memory.chipROM.set(romBytes, 0) — instantly visible to worker
  /** @param {number} [offset=0] Seed MMU page table from flash data */
  async seedMMU(offset = 0) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, offset);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_SEED_MMU);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /** Reset the chip to initial state */
  async reset() {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_RESET);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /**
   * Tap the RESET (EN) button: full chip reset, like pulling CHIP_PU low
   * on a real dev board (digital + RTC state cleared, flash/RTC-memory
   * preserved). Works mid-run (serviced inline in the sim loop).
   */
  async pressResetButton() {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_PRESS_RESET);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /**
   * Hold/release the BOOT button (GPIO0 strapping): drives GPIO0's live
   * input level + the BOOT strap bit (bit4 of the strap value), so a
   * subsequent reset samples download mode like holding BOOT on a real
   * dev board. Works mid-run (serviced inline in the sim loop).
   * @param {boolean} held - true = button held down, false = released
   */
  async pressBootButton(held) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, held ? 1 : 0);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_PRESS_BOOT);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /** Write a 32-bit value to core 0's address space */
  async writeUint32(addr, value) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, addr);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG1, value);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_WRITE_UINT32);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /** Step N instructions on core 0 */
  async step(count = 1) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, count);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_STEP);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /**
   * Drive a GPIO input level at runtime (host-driven pin toggle).
   * Routes through the native GPIO matrix to PCNT/RMT/etc. inputs.
   */
  async setPinInput(pin, level) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, pin);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG1, level ? 1 : 0);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_SET_PIN_INPUT);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /**
   * Drive a touch pad count at runtime (host-driven touch).
   * Updates the JS touchCounts read by the native SENS Touch engine.
   */
  async setTouchInput(pad, count) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, pad);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG1, count);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_SET_TOUCH_INPUT);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /**
   * Drive the supply rail in millivolts at runtime (brownout detector).
   */
  async setVoltageMv(mv) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, mv);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_SET_VOLTAGE);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /**
   * Push one u32 audio sample word into I2S0's RX buffer (virtual microphone).
   * Serviced inline during run; call repeatedly to stream, or bulk-feed
   * before run() (buffer persists until the RX DMA drains it).
   */
  async feedI2SRX(sample) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, sample >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_FEED_I2S_RX);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /**
   * Inject a virtual-CAN peer frame (peer -> ESP32). The frame lands in the
   * TWAI RX path through the real acceptance filter + RX interrupt.
   * Two-phase over the 3-arg CMD channel: STAGE (id/flags/data0-3) then
   * PUSH (data4-7 + deliver).
   * @param {number} id - 11-bit standard or 29-bit extended identifier
   * @param {number[]|Uint8Array} data - up to 8 payload bytes
   * @param {{ext?: boolean, rtr?: boolean}} [opts] - { ext: boolean, rtr: boolean }
   */
  async sendTwaiFrame(id, data, opts = {}) {
    this._checkReady();
    const bytes = Array.from(data || []).slice(0, 8);
    const flags = bytes.length | (opts.ext ? 1 : 0) << 8 | (opts.rtr ? 1 : 0) << 9;
    let w2 = 0, w3 = 0;
    for (let i = 0; i < bytes.length; i++) {
      if (i < 4) w2 |= (bytes[i] & 255) << 8 * i;
      else w3 |= (bytes[i] & 255) << 8 * (i - 4);
    }
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, id >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG1, flags >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG2, w2 >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_SEND_TWAI);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, w3 >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_PUSH_TWAI);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  // ---- Host peripheral taps (esp32-emu.md §1-4, Worker split mode) ----
  // The worker thread owns the tap objects (same I2cTap/SpiTap classes);
  // these methods sync wiring/preloads/polls across the SAB (no synchronous
  // round-trip mid-transaction — preload reads BEFORE run, drain writes
  // AFTER run chunks).
  /**
   * Attach/detach a host I2C slave model at a 7-bit address on a bus
   * (0 = I2C0, 1 = I2C1). Registered addresses ACK; all others NACK, so
   * scan() enumerates only attached models. Wiring survives reset.
   */
  async attachI2cSlave(bus, addr) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, bus >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG1, addr & 127);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG2, 1);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_I2C_SET_SLAVE);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  async detachI2cSlave(bus, addr) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, bus >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG1, addr & 127);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG2, 0);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_I2C_SET_SLAVE);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /**
   * Pre-stage bytes a future master READ from `addr` will consume
   * (sensor ROM, split-mode equivalent of onRead). Survives reset.
   */
  async pushI2cTx(bus, addr, bytes) {
    this._checkReady();
    const arr = Uint8Array.from(bytes ?? []).slice(0, 4096);
    this.readResp.set(arr, 0);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, bus >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG1, addr & 127);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG2, arr.length);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_I2C_TX_PUSH);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /** Drain bytes the master WROTE to `addr` since the last drain. */
  async popI2cRx(bus, addr) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, bus >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG1, addr & 127);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_I2C_RX_POP);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
    const n = Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG1);
    return Array.from(this.readResp.subarray(0, Math.min(n, this.readResp.length)));
  }
  /**
   * Drain staged I2C transaction events on a bus since the last poll.
   * @returns {Promise<Array<{t:string,addr?:number,read?:boolean,byte?:number,wasRead?:boolean}>>}
   */
  async pollI2c(bus) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, bus >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_I2C_POLL);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
    const n = Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG1);
    const dv = new DataView(this.readResp.buffer, this.readResp.byteOffset, Math.min(n * 4, this.readResp.length));
    const out = [];
    for (let i = 0; i < n; i++) {
      const w = dv.getUint32(i * 4, true);
      const type = w >>> 24, payload = w & 16777215;
      if (type === 1) out.push({ t: "start", addr: payload >>> 1 & 127, read: !!(payload & 1) });
      else if (type === 2) out.push({ t: "write", byte: payload & 255 });
      else if (type === 3) out.push({ t: "read", byte: payload & 255 });
      else if (type === 4) out.push({ t: "stop", wasRead: !!payload });
    }
    return out;
  }
  /**
   * Pre-stage MISO bytes for future master transfers on a bus
   * (0..3 = SPI1, SPI0, SPI2, SPI3; user buses are 2/HSPI and 3/VSPI).
   * Split-mode equivalent of onTransfer; survives reset.
   */
  async injectSpiMiso(bus, bytes) {
    this._checkReady();
    const arr = Uint8Array.from(bytes ?? []).slice(0, 4096);
    this.readResp.set(arr, 0);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, bus >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG1, arr.length);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_SPI_INJECT);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /** Drain captured MOSI bytes on a bus since the last drain. */
  async pollSpiTx(bus) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, bus >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_SPI_POLL);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
    const n = Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG1);
    return Array.from(this.readResp.subarray(0, Math.min(n, this.readResp.length)));
  }
  /**
   * Fresh core-side GPIO output readback (output value, NOT input stimulus).
   * @returns {Promise<{level:number,dir:number,pull:number}>} dir 0=in,1=out,2=inout; pull 0=none,1=up,2=down,3=both.
   */
  async getGpioOut(pin) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, pin >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_GET_GPIO_OUT);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
    return {
      level: Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG0) >>> 0,
      dir: Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG1) >>> 0,
      pull: Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG2) >>> 0
    };
  }
  /** Snapshot of all 40 pins: {levels, dirs, pulls} arrays. */
  async sampleGpioOut() {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_SAMPLE_GPIO_OUT);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
    const n = Math.min(Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG1), 40);
    const levels = [], dirs = [], pulls = [];
    for (let i = 0; i < n; i++) {
      levels.push(this.readResp[i * 3] || 0);
      dirs.push(this.readResp[i * 3 + 1] || 0);
      pulls.push(this.readResp[i * 3 + 2] || 0);
    }
    return { levels, dirs, pulls };
  }
  /** Drain staged GPIO output edges since the last poll: [{pin, level}]. */
  async pollGpioChanges() {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_POLL_GPIO_CHANGES);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
    const n = Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG1);
    const dv = new DataView(this.readResp.buffer, this.readResp.byteOffset, Math.min(n * 4, this.readResp.length));
    const out = [];
    for (let i = 0; i < n; i++) {
      const w = dv.getUint32(i * 4, true);
      out.push({ pin: w >>> 1, level: w & 1 });
    }
    return out;
  }
  /**
   * Drive a per-pin analog voltage at runtime (host-driven ADC inject).
   * @param {number} pin - GPIO pin number
   * @param {number} volts - volts (full-scale per attenuation, see analogRead cells)
   */
  async setAnalogInput(pin, volts) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, pin >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG1, Math.round(Number(volts) * 1e3));
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_SET_ANALOG_INPUT);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /**
   * GPIO pin driven by an LEDC channel (-1 = none). Register-file scan of
   * FUNC_OUT_SEL_CFG for the channel's matrix signal (71 + ch).
   */
  async getLedcPin(channel) {
    this._checkReady();
    const sig = 71 + (channel >>> 0);
    for (let pin = 0; pin < 40; pin++) {
      const sel = await this.readMmio(5, 1072971776 + 1328 + pin * 4 >>> 0, 4) & 511;
      if (sel === sig) return pin;
    }
    return -1;
  }
  /**
   * Drain staged I2S TX DMA words for a controller (guest→host).
   * @returns {Promise<number[]>} u32 words in DMA order.
   */
  async pollI2sTx(idx = 0) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, idx >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_I2S_POLL_TX);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
    const n = Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG1);
    const dv = new DataView(this.readResp.buffer, this.readResp.byteOffset, Math.min(n * 4, this.readResp.length));
    const out = [];
    for (let i = 0; i < n; i++) out.push(dv.getUint32(i * 4, true) >>> 0);
    return out;
  }
  /** Arm the I2S TX hook (sticky wiring; staging starts on next TX DMA). */
  async armI2sTx() {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_I2S_TX_ARM);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /**
   * Attach a DS18B20-compatible OneWire slave model to a pin (P1).
   * The model answers presence + ROM/scratchpad reads synchronously on
   * sim-time ticks — no host round-trip, so microsecond slots hold.
   */
  async attachOneWire(pin) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, pin >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_OW_ATTACH);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /** Set the OneWire model's temperature in °C (recomputes scratchpad + CRC). */
  async setOneWireTemp(pin, celsius) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, pin >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG1, (Math.round(Number(celsius) * 1e3) | 0) >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_OW_SET_TEMP);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /** Replace the OneWire model's scratchpad (8 bytes → CRC recomputed; 9 used as-is). */
  async preloadOneWireScratch(pin, bytes) {
    this._checkReady();
    const arr = Uint8Array.from(bytes ?? []).slice(0, 9);
    this.readResp.set(arr, 0);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, pin >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG1, arr.length);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_OW_SCRATCH);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /**
   * Drain the OneWire model's decoded master traffic since the last poll.
   * @returns {Promise<{log:Array<{t:string,byte?:number}>,presence:number}>}
   */
  async pollOneWire(pin) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, pin >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_OW_POLL);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
    const n = Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG1);
    const dv = new DataView(this.readResp.buffer, this.readResp.byteOffset, Math.min(n * 4, this.readResp.length));
    const log = [];
    let presence = 0;
    for (let i = 0; i < n; i++) {
      const w = dv.getUint32(i * 4, true);
      if (w >>> 24 === 1) {
        log.push({ t: "presence" });
        presence++;
      } else if (w >>> 24 === 2) log.push({ t: "byte", byte: w & 255 });
    }
    return { log, presence };
  }
  /**
   * 32-bit native MMIO backdoor write (mirrors readMmio; same HID dispatch
   * as the guest path, so tap hooks fire identically).
   */
  async writeMmio(hid, addr, value) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, hid >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG1, addr >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG2, value >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_WRITE_MMIO);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  /**
   * LEDC/PWM readback for servo/LED cells.
   * @returns {Promise<{duty:number,freq:number,timer:number}>} duty = effective duty, freq = derived Hz.
   */
  async getLedc(channel) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, channel >>> 0);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_GET_LEDC);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
    return {
      duty: Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG0) >>> 0,
      freq: Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG1) >>> 0,
      timer: Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG2) >>> 0
    };
  }
  /**
   * Read back the last NORMAL-mode TX frame captured by the virtual peer.
   * @returns {Promise<{count:number,id:number,ext:boolean,rtr:boolean,dlc:number,data:number[]}|null>}
   */
  async getTwaiTx() {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_GET_TWAI_TX);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
    const written = Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG1);
    if (written < 20) return null;
    const dv = new DataView(this.readResp.buffer, this.readResp.byteOffset, written);
    const flags = dv.getUint32(8, true);
    const d0 = dv.getUint32(12, true), d1 = dv.getUint32(16, true);
    const dlc = flags & 15, data = [];
    for (let i = 0; i < dlc && i < 8; i++) data.push(i < 4 ? d0 >>> 8 * i & 255 : d1 >>> 8 * (i - 4) & 255);
    return { count: dv.getUint32(0, true), id: dv.getUint32(4, true), ext: !!(flags & 256), rtr: !!(flags & 512), dlc, data };
  }
  /**
   * Read memory from the chip address space.
   * @param {number} addr - Start address
   * @param {number} bytes - Number of bytes to read
   * @returns {Promise<Uint8Array>} Read data
   */
  async readMemory(addr, bytes = 0) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, addr);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG1, bytes);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_READ_MEMORY);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
    const written = Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG1);
    return this.readResp.subarray(0, written);
  }
  /**
   * Read a native MMIO register.
   * @param {number} hid - Native handler ID
   * @param {number} addr - Register address
   * @param {number} [size=4] - Access size (1/2/4 bytes)
   * @returns {Promise<number>} Register value
   */
  /**
   * Arm a Rust-side write watchpoint (logs [WP] pc/addr/val on match).
   * Pass 0xFFFFFFFF to clear all. Fire-and-forget (no response data).
   * @param {number} addr - DRAM address to watch (u32 word)
   */
  /**
   * Arm Rust PC tracing for the next n instructions ([T] pc=... lines).
   * @param {number} n - instruction budget
   */
  async pcTrace(n) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, n);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_PCTRACE);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  async watchpoint(addr) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, addr);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_WATCHPOINT);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
  }
  async readMmio(hid, addr, size = 4) {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, hid);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG1, addr);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG2, size);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_READ_MMIO);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
    return Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG0) >>> 0;
  }
  async getPcapData() {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_GET_PCAP);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
    const written = Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG1);
    return this.readResp.subarray(0, written);
  }
  async getFfiCounts() {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_GET_FFI_COUNTS);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
    const written = Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG1);
    const out = [];
    const dv = new DataView(this.readResp.buffer, this.readResp.byteOffset, written);
    for (let i = 0; i < written / 8; i++) out.push(dv.getFloat64(i * 8, true));
    return out;
  }
  /** Get WiFi AP statistics (state, tx/rx, clients, IP) */
  async getWifiStats() {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_GET_WIFI_STATS);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
    }
    const written = Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG1);
    if (written < 28) return null;
    const dv = new DataView(this.readResp.buffer, this.readResp.byteOffset, written);
    const decode = (off) => {
      let end = off;
      while (end < written && this.readResp[end] !== 0) end++;
      return new TextDecoder().decode(this.readResp.subarray(off, end));
    };
    return {
      state: dv.getInt32(0, true),
      txFrames: dv.getInt32(4, true),
      txBytes: dv.getInt32(8, true),
      rxFrames: dv.getInt32(12, true),
      rxBytes: dv.getInt32(16, true),
      probeRequestCount: dv.getInt32(20, true),
      connectedClients: dv.getInt32(24, true),
      ip: decode(28),
      portForward: decode(68),
      errorMessage: decode(108),
      udpForward: decode(148)
    };
  }
  /** Start continuous simulation (non-blocking) */
  run() {
    this._checkReady();
    Atomics.store(this.ctrl, SAB_SLOT_RUN, 1);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_RUN);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
  }
  /** Stop the simulation loop (non-blocking, finishes current chunk) */
  stop() {
    if (!this._ready) return;
    Atomics.store(this.ctrl, SAB_SLOT_RUN, 0);
  }
  /** Terminate the worker thread and release resources */
  terminate() {
    if (this.worker) {
      _liveWorkers.delete(this.worker);
      this.worker.terminate();
      this.worker = null;
    }
    this._ready = false;
    this.ctrl = null;
    this.ctrlSab = null;
    this.uartCtrl = null;
    this.uartRing = null;
    this.uartSab = null;
    this.readResp = null;
    this.readRespSab = null;
    this.errMsg = null;
    this.errSab = null;
    this.memory = {};
  }
  /** Poll the UART ring buffer and deliver bytes via _onUART callback */
  pollUart() {
    if (!this.uartCtrl || !this._onUART) return;
    const w = Atomics.load(this.uartCtrl, 0);
    const r = Atomics.load(this.uartCtrl, 1);
    const count = w - r;
    if (count <= 0) return;
    const maxRead = Math.min(count, UART_RING_SIZE);
    for (let i = 0; i < maxRead; i++) {
      this._onUART(this.uartRing[(r + i) % UART_RING_SIZE]);
    }
    Atomics.store(this.uartCtrl, 1, r + maxRead);
    try {
      this._pollBtHciProxy();
    } catch {
    }
  }
  /**
   * BT HCI proxy pump: forward staged H2C bytes to Bumble, feed back C2H.
   * Runs on the host (test-script) thread — never in the worker — so TCP
   * I/O + dynamic import cannot stall the sim. Requires an open socket
   * (this._btHciSock, connected by btHciProxyConnect); without it this is
   * a single null check per pollUart (zero cost otherwise).
   *
   * NOTE: pollUart is synchronous, so this only services the socket when
   * the test calls the async pollBtHciProxy() below (CMD round-trips need
   * no await, but the Bumble exchange does). Kept as a no-op hook.
   */
  _pollBtHciProxy() {
    return;
  }
  /**
   * BT HCI proxy pump (async): pull staged H2C via CMD_BT_HCI_POLL, run
   * the Bumble exchange over TCP, push C2H back via CMD_BT_HCI_PUSH.
   * Call from the test loop (e.g. every pollUart tick when btHciProxy is
   * configured). No-op without a connected socket.
   *
   * @returns {Promise<{sent: number, pushed: number, timeout?: boolean}>} byte counts.
   */
  async pollBtHciProxy() {
    this._checkReady();
    const sock = this._btHciSock;
    if (!sock || !this._btHciConnected || !this._btHciForward) return { sent: 0, pushed: 0 };
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_BT_HCI_POLL);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    const t0 = Date.now();
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
      if (Date.now() - t0 > 2e3) return { sent: 0, pushed: 0, timeout: true };
    }
    const n = Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG1) >>> 0;
    if (!n) return { sent: 0, pushed: 0 };
    const h2c = this.readResp.slice(0, n);
    const c2h = await this._btHciForward(h2c);
    if (!c2h || !c2h.length) return { sent: n, pushed: 0 };
    const bytes = Uint8Array.from(c2h).slice(0, 264);
    this.readResp.set(bytes, 0);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG1, bytes.length);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_BT_HCI_PUSH);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    const t1 = Date.now();
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
      if (Date.now() - t1 > 2e3) return { sent: n, pushed: 0, timeout: true };
    }
    const ok = Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG1) >>> 0;
    return { sent: n, pushed: ok ? bytes.length : 0 };
  }
  /**
   * Open the TCP socket to the Bumble HCI bridge and wire it into the
   * proxy pump. Call once per test (opt-in via config.btHciProxy or
   * explicitly); without it pollBtHciProxy is a null check per tick.
   *
   * @param {{host?: string, port?: number}} [opts] - bridge address.
   */
  async btHciProxyConnect(opts = {}) {
    const net = await import("node:net");
    const host = opts.host || "127.0.0.1";
    const port = (opts.port || 14821) >>> 0;
    await /** @type {Promise<void>} */
    new Promise(
      (resolve, reject) => {
        const sock = net.createConnection({ host, port }, () => {
          this._btHciSock = sock;
          this._btHciConnected = true;
          this._btHciBuf = Buffer.alloc(0);
          sock.on("data", (chunk) => {
            this._btHciBuf = Buffer.concat([this._btHciBuf, chunk]);
          });
          sock.on("close", () => {
            this._btHciConnected = false;
            this._btHciSock = null;
          });
          sock.on("error", () => {
            this._btHciConnected = false;
          });
          resolve();
        });
        sock.on("error", reject);
        setTimeout(() => reject(new Error("btHciProxy connect timeout")), 5e3);
      }
    );
    this._btHciForward = async (h2c) => {
      const sock = this._btHciSock;
      if (!sock || !this._btHciConnected) return null;
      this._btHciBuf = Buffer.alloc(0);
      sock.write(Buffer.from(h2c));
      const t0 = Date.now();
      for (; ; ) {
        const buf = this._btHciBuf;
        if (buf.length >= 2) {
          const t = buf[0];
          let need = -1;
          if (t === 4) need = 2 + (buf.length >= 3 ? buf[2] + 1 : 0);
          else if (t === 2) need = buf.length >= 5 ? 5 + (buf[3] | buf[4] << 8) : -1;
          else if (buf[0] === 123) {
            const nl = buf.indexOf(10);
            need = nl >= 0 ? nl + 1 : -1;
          }
          if (need > 0 && buf.length >= need) {
            const pkt = buf.subarray(0, need);
            this._btHciBuf = buf.subarray(need);
            return new Uint8Array(pkt);
          }
        }
        if (Date.now() - t0 > 200) return null;
        await new Promise((r) => setTimeout(r, 5));
      }
    };
  }
  /**
   * BT HCI proxy control message: send a JSON line (connect/read/...) over
   * the worker-owned proxy socket and read one JSON reply line. The worker
   * socket is the ONLY connection Bumble's per-connection Controller
   * listens to, so host-side control must ride it (a second TCP socket
   * would talk to a different radio). Resolves to the reply object.
   *
   * @param {any} msg - JSON-serializable control message.
   * @param {number} [timeoutMs=25000] - grace for the reply.
   */
  async btHciControl(msg, timeoutMs = 25e3) {
    this._checkReady();
    const line = JSON.stringify(msg) + "\n";
    const bytes = Buffer.from(line, "utf8");
    this.readResp.set(bytes.subarray(0, Math.min(bytes.length, this.readResp.length)), 0);
    Atomics.store(this.ctrl, SAB_SLOT_CMD_ARG0, bytes.length);
    Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
    Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_BT_HCI_SEND);
    Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
    const t0 = Date.now();
    while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
      if (Date.now() - t0 > 5e3) throw new Error("btHciControl send timeout");
      try {
        this.pollUart();
      } catch {
      }
      await new Promise((r) => setTimeout(r, 5));
    }
    const t1 = Date.now();
    const wantOp = msg.op;
    for (; ; ) {
      Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
      Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_BT_HCI_RESP);
      Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
      while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
        if (Date.now() - t1 > timeoutMs) throw new Error("btHciControl reply timeout");
        try {
          this.pollUart();
        } catch {
        }
        await new Promise((r) => setTimeout(r, 10));
      }
      const n = Atomics.load(this.ctrl, SAB_SLOT_CMD_ARG1) >>> 0;
      if (n > 0) {
        const obj = JSON.parse(Buffer.from(this.readResp.slice(0, n)).toString("utf8"));
        const isEcho = obj.op && !obj.event && !obj.ok && Object.keys(obj).length <= 2;
        if (!isEcho) return obj;
      }
      try {
        this.pollUart();
      } catch {
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  /** Send bytes to the emulated UART RX (guest input) */
  sendUart(data) {
    if (!this.uartRxCtrl || !this.uartRxRing) return;
    const bytes = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
    for (let i = 0; i < bytes.length; i++) {
      const w = Atomics.load(this.uartRxCtrl, 0);
      this.uartRxRing[w % UART_RING_SIZE] = bytes[i];
      Atomics.store(this.uartRxCtrl, 0, w + 1);
    }
    if (this.ctrl && Atomics.load(this.ctrl, SAB_SLOT_RUN) === 0) {
      Atomics.store(this.ctrl, SAB_SLOT_RESP, RESP_IDLE);
      Atomics.store(this.ctrl, SAB_SLOT_CMD, CMD_UART_RX);
      Atomics.notify(this.ctrl, SAB_SLOT_CMD, 1);
      while (Atomics.load(this.ctrl, SAB_SLOT_RESP) === RESP_IDLE) {
      }
    }
  }
  get running() {
    return this.ctrl ? Atomics.load(this.ctrl, SAB_SLOT_RUN) === 1 : false;
  }
  get nanos() {
    if (!this.ctrl) return 0;
    const lo = Atomics.load(this.ctrl, SAB_SLOT_NANOS_LO);
    const hi = Atomics.load(this.ctrl, SAB_SLOT_NANOS_HI);
    return hi * 4294967296 + (lo >>> 0);
  }
  get pc1() {
    return this.debug ? this.debug[1] : -1;
  }
  get pc() {
    return this.ctrl ? Atomics.load(this.ctrl, SAB_SLOT_PC) : -1;
  }
  // Retired instructions per core (Rust inst_count via debug SAB slots 8/9).
  // Unlike chip.cycles (JS step budget + idle fast-forward), these count
  // instructions the WASM cores really executed — the honest MIPS numerator.
  get inst0() {
    return this.debug ? this.debug[8] >>> 0 : 0;
  }
  get inst1() {
    return this.debug ? this.debug[9] >>> 0 : 0;
  }
  get instTotal() {
    return this.inst0 + this.inst1 >>> 0;
  }
  get stuck() {
    return this.ctrl ? Atomics.load(this.ctrl, SAB_SLOT_STUCK) : 0;
  }
  get idle() {
    return this.ctrl ? Atomics.load(this.ctrl, SAB_SLOT_IDLE) === 1 : false;
  }
  get ready() {
    return this._ready;
  }
  get macAddress() {
    if (!this.memory.wifiMac) return null;
    const buf = this.memory.wifiMac;
    const hi = new DataView(buf.buffer, buf.byteOffset + 64, 4).getUint32(0, true);
    const lo = new DataView(buf.buffer, buf.byteOffset + 68, 4).getUint32(0, true);
    return [
      hi & 255,
      hi >> 8 & 255,
      hi >> 16 & 255,
      hi >> 24 & 255,
      lo & 255,
      lo >> 8 & 255
    ].map((b) => b.toString(16).padStart(2, "0")).join(":");
  }
  get psramType() {
    return this._chipInfo.psramType || null;
  }
  get flashSizeMB() {
    return this._chipInfo.flashSizeMB || null;
  }
  get psramSizeMB() {
    return this._chipInfo.psramSizeMB || null;
  }
  get board() {
    return this._chipInfo.board || "esp32";
  }
  get cpuFrequency() {
    return this.ctrl ? Atomics.load(this.ctrl, SAB_SLOT_CPU_FREQ) : this._chipInfo.cpuFrequency || null;
  }
  set cpuFrequency(freq) {
    if (!this.ctrl) return;
    const native = this._chipInfo._nativeFrequency || 16e7;
    const v = freq === "auto" ? 8e6 : freq === "max" ? native : Number(freq) * 1e6;
    Atomics.store(this.ctrl, SAB_SLOT_CPU_FREQ, v);
  }
  // Live WiFi stats — read directly from SAB, zero-latency
  get wifiState() {
    return this.ctrl ? Atomics.load(this.ctrl, SAB_SLOT_WIFI_STATE) : -1;
  }
  get wifiTxFrames() {
    return this.ctrl ? Atomics.load(this.ctrl, SAB_SLOT_WIFI_TX_FRAMES) : 0;
  }
  get wifiTxBytes() {
    return this.ctrl ? Atomics.load(this.ctrl, SAB_SLOT_WIFI_TX_BYTES) : 0;
  }
  get wifiRxFrames() {
    return this.ctrl ? Atomics.load(this.ctrl, SAB_SLOT_WIFI_RX_FRAMES) : 0;
  }
  get wifiRxBytes() {
    return this.ctrl ? Atomics.load(this.ctrl, SAB_SLOT_WIFI_RX_BYTES) : 0;
  }
  get wifiProbes() {
    return this.ctrl ? Atomics.load(this.ctrl, SAB_SLOT_WIFI_PROBES) : 0;
  }
  set budget(nanos) {
    if (this.ctrl) Atomics.store(this.ctrl, SAB_SLOT_BUDGET, nanos);
  }
  get budget() {
    return this.ctrl ? Atomics.load(this.ctrl, SAB_SLOT_BUDGET) : 5e4;
  }
  _checkReady() {
    if (!this._ready) throw new Error("SimulatorWorker not initialized");
  }
  _onMessage(e) {
    const msg = e && e.data && typeof e.data === "object" && e.data.type ? e.data : e;
    const { type } = msg;
    switch (type) {
      case "ready":
        this._ready = true;
        if (msg.memoryRegions) {
          for (const [key, { buffer, byteOffset, byteLength }] of Object.entries(msg.memoryRegions)) {
            this.memory[key] = new Uint8Array(buffer, byteOffset, byteLength);
          }
        }
        if (msg.chipInfo) Object.assign(this._chipInfo, msg.chipInfo);
        if (Atomics.load(this.ctrl, SAB_SLOT_ERR_FLAG) && this.errMsg) {
          const end = this.errMsg.indexOf(0);
          const errText = new TextDecoder().decode(this.errMsg.subarray(0, end >= 0 ? end : this.errMsg.length));
          if (this._onError) {
            this._onError(new Error(errText));
            this._onError = null;
          }
        }
        if (this._onReady) {
          this._onReady();
          this._onReady = null;
        }
        break;
      case "error":
        if (this._onError) {
          this._onError(new Error(msg.message));
          this._onError = null;
        }
        break;
    }
  }
};
export {
  SimulatorWorker
};
//# sourceMappingURL=worker-proxy.js.map
