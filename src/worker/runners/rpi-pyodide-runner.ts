/**
 * rpi-pyodide-runner.ts — Raspberry Pi 3 B+ / 4 B / 5 board runner.
 *
 * CPython runs in the worker as Pyodide and imports the mirrored `py/`
 * shims, which call the deterministic JS peripheral models in
 * `src/engines/pyodide/src/{bridge,peripherals,analog}.js`. This adapter
 * exposes those models to ArmRunnerBase as ordinary engine hooks, so all
 * existing host components (LED, SSD1306, MAX7219, …) react exactly as they
 * do for the compiled board runners.
 *
 * HONEST BOUNDARY: this is peripheral-level Python, not a machine emulator.
 * There is no Linux, no ARM CPU, no boot and no C device drivers. Pyodide
 * time is virtual (fast-forward), not wall-clock real time. See the
 * `no-linux-arm-emulation` / `virtual-time-only` limits in boards-registry.
 *
 * Resolution follows the repo contract: the Pyodide ESM runtime is resolved
 * only through `importEngine` (CDN URL, vendored fallback), and the engine
 * sources are imported through the `pyodide/*` aliases in vite.config.js.
 */
import { ArmRunnerBase, ArmEngineHooks, importEngine } from './arm-runner-base.ts';
import { AVRRunnerOptions } from '../registries/component-registry.ts';
import bridge, { getPeripherals } from 'pyodide/src/bridge.js';

const PYODIDE_VERSION = '314.0.8';
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const PYODIDE_ESM = `${PYODIDE_BASE}pyodide.mjs`;
const PYODIDE_VENDOR_ESM = '/vendor/board-engines/pyodide/pyodide.mjs';
const SHIM_BASE = '/vendor/board-engines/pyodide/py/';

// Mirrors upstream src/runtime.js PY_FILES verbatim (order matters: rpi_sim
// must import before the per-library shims). Fetched from the public vendor
// mirror at boot; never from the network.
const PY_FILES = [
  'py/rpi_sim/__init__.py', 'py/rpi_sim/_bridge.py', 'py/rpi_sim/uart.py',
  'py/rpi_sim/timers.py', 'py/rpi_sim/system.py', 'py/rpi_sim/board.py',
  'py/rpi_sim/devices.py', 'py/rpi_sim/onewire.py', 'py/rpi_sim/config.py',
  'py/rpi_sim/drivers.py', 'py/rpi_sim/sysfs.py', 'py/rpi_sim/threads.py',
  'py/rpi_sim/interrupts.py', 'py/rpi_sim/network.py', 'py/rpi_sim/electrical.py',
  'py/rpi_sim/analog.py', 'py/rpi_sim/environment.py', 'py/w1_gpio.py',
  'py/RPi/__init__.py', 'py/RPi/GPIO.py', 'py/gpiozero.py', 'py/pigpio.py',
  'py/wiringpi.py', 'py/periphery.py', 'py/board.py', 'py/busio.py',
  'py/digitalio.py', 'py/analogio.py', 'py/pwmio.py', 'py/smbus.py',
  'py/smbus2.py', 'py/spidev.py', 'py/serial.py', 'py/socket.py',
  'py/Adafruit_GPIO.py', 'py/Adafruit_DHT.py', 'py/w1thermsensor.py',
  'py/adafruit_bme280.py', 'py/adafruit_bmp280.py', 'py/adafruit_sht31d.py',
  'py/adafruit_mcp9808.py', 'py/adafruit_adxl34x.py', 'py/adafruit_mpu6050.py',
  'py/adafruit_lis3dh.py', 'py/adafruit_pcf8523.py', 'py/DS1307.py',
  'py/MFRC522.py', 'py/nrf24l01.py', 'py/hcsr04.py', 'py/ina219.py',
  'py/bh1750.py', 'py/Adafruit_SSD1306.py', 'py/luma/__init__.py',
  'py/luma/oled.py', 'py/luma/lcd.py', 'py/RPLCD.py', 'py/Adafruit_NeoPixel.py',
  'py/neopixel.py', 'py/adafruit_pca9685.py', 'py/PCA9685.py',
  'py/adafruit_motor.py', 'py/adafruit_servokit.py', 'py/picamera2.py',
  'py/requests.py', 'py/paho/__init__.py', 'py/paho/mqtt/__init__.py',
  'py/paho/mqtt/client.py', 'py/flask.py', 'py/zeroconf.py',
  'py/netifaces.py', 'py/PIL/__init__.py', 'py/PIL/Image.py',
];

type BoardKey = 'pi3' | 'pi4' | 'pi5';

function boardKeyOf(boardType: string): BoardKey {
  const t = String(boardType || '').toLowerCase();
  if (t.includes('pi5') || t.includes('raspberry-pi-5')) return 'pi5';
  if (t.includes('pi3') || t.includes('raspberry-pi-3')) return 'pi3';
  return 'pi4';
}

function pinNumber(pinId: string): number | null {
  const s = String(pinId || '').trim();
  const m = /^GPIO(\d+)$/i.exec(s) || /^(?:D|GP)?(\d+)$/i.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function ensureDir(fs: any, dir: string): void {
  if (fs.analyzePath(dir).exists) return;
  const parent = dir.slice(0, dir.lastIndexOf('/')) || '/';
  if (parent !== dir) ensureDir(fs, parent);
  fs.mkdir(dir);
}

interface I2cTransaction { bus: number; addr: number; read: boolean; bytes: number[]; count: number }
interface SpiTransaction { bus: number; dev: number; bytes: number[] }
interface WiredEndpoint { inst: any; pinId: string; boardPin: string }

/**
 * ADC channel for a wired board pin. MCP3008-style ADC hats are addressed by
 * channel 0..7; for a direct GPIO wire the BCM number maps modulo 8 into the
 * same 8-channel space (so `pi:5` is channel 5). Explicit `ADCn`/`An` labels
 * win when present.
 */
function adcChannelOf(pinId: string): number | null {
  const s = String(pinId || '').trim();
  const explicit = /^(?:ADC|A|CH)(\d+)$/i.exec(s);
  const m = explicit || /^(\d+)$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 ? n % 8 : null;
}

class RpiPyodideEngine implements ArmEngineHooks {
  private pyodide: any = null;
  private initPromise: Promise<void> | null = null;
  private script = '';
  private board: BoardKey = 'pi4';
  private txQueue: number[] = [];
  private i2cLog: I2cTransaction[] = [];
  private spiLog: SpiTransaction[] = [];
  private peripherals = getPeripherals();
  private stdoutReady = false;
  private wrapped = false;
  /** Guest UART TX since the last host delivery (drained into a wired
   * host serial sink such as the USB-device terminal). */
  private uartLog = '';
  /** Python poll hook defined by a sketch; called on every runner tick so a
   * sketch can observe mid-run host changes (UART RX, sensors, …). */
  private pollFn: any = null;
  private lastAdc: Record<number, number> = {};
  private lastOneWire: Record<number, number> = {};
  private lastDht = '';
  private lastNeoPixel = '';
  private lastPwm = '';
  private lastUart = '';

  constructor(private readonly owner: RpiPyodideRunner) {
    this.installBridgeTaps();
  }

  /** Intercept guest peripheral calls so host component models can see the
   * same transaction the Pyodide JS model saw (no changes to the mirrored
   * engine sources). */
  private installBridgeTaps(): void {
    if (this.wrapped) return;
    this.wrapped = true;
    const b = bridge as any;
    const i2cWrite = b.i2c_write;
    b.i2c_write = (bus: number, addr: number, bytes: any) => {
      const out = i2cWrite.call(b, bus, addr, bytes);
      try {
        this.i2cLog.push({ bus: Number(bus), addr: Number(addr) & 0x7f, read: false,
          bytes: Array.from(bytes || []).map(Number), count: 0 });
      } catch { /* a bad log never breaks the guest call */ }
      return out;
    };
    const i2cRead = b.i2c_read;
    b.i2c_read = (bus: number, addr: number, count: number) => {
      const out = i2cRead.call(b, bus, addr, count);
      try {
        this.i2cLog.push({ bus: Number(bus), addr: Number(addr) & 0x7f, read: true,
          bytes: Array.from(out || []).map(Number), count: Number(count) });
      } catch { /* ditto */ }
      return out;
    };
    const spiXfer = b.spi_xfer;
    b.spi_xfer = (bus: number, dev: number, bytes: any) => {
      const out = spiXfer.call(b, bus, dev, bytes);
      try {
        this.spiLog.push({ bus: Number(bus), dev: Number(dev),
          bytes: Array.from(bytes || []).map(Number) });
      } catch { /* ditto */ }
      return out;
    };
    // Guest UART writes are host-visible bytes (the physical TX line).
    const uartWrite = b.uart_write;
    b.uart_write = (text: any) => {
      const out = uartWrite.call(b, text);
      try { this.uartLog += String(text ?? ''); } catch { /* ignore */ }
      return out;
    };
  }

  private emit(text: string): void {
    const encoder = new TextEncoder();
    const s = String(text ?? '');
    const rows = s.endsWith('\n') ? [s] : [s + '\n'];
    for (const row of rows) for (const byte of encoder.encode(row)) this.txQueue.push(byte & 0xff);
  }

  private async ensurePyodide(): Promise<void> {
    if (this.pyodide) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      const mod = await importEngine(PYODIDE_ESM, PYODIDE_VENDOR_ESM);
      if (!mod || typeof mod.loadPyodide !== 'function') {
        throw new Error('Pyodide ESM loader unavailable (CDN and vendor mirror both failed)');
      }
      const runtime = await mod.loadPyodide({ indexURL: PYODIDE_BASE });
      runtime.globals.set('__rpiBridge', bridge);
      runtime.runPython(`import sys; sys.path.insert(0, '/home/pyodide')`);
      for (const rel of PY_FILES) {
        const target = `/home/pyodide/${rel.slice('py/'.length)}`;
        const res = await fetch(SHIM_BASE + rel.slice('py/'.length));
        if (!res.ok) throw new Error(`${rel}: HTTP ${res.status}`);
        ensureDir(runtime.FS, target.slice(0, target.lastIndexOf('/')));
        runtime.FS.writeFile(target, await res.text());
      }
      try { await runtime.loadPackage('numpy'); } catch { /* optional */ }
      runtime.runPython('import rpi_sim');
      try {
        runtime.setStdout({ batched: (s: string) => this.emit(s) });
      } catch {
        try { runtime.setStdout((s: string) => this.emit(s)); } catch { /* older Pyodide */ }
      }
      try {
        runtime.setStderr({ batched: (s: string) => this.emit(`RPI_ERR: ${s}`) });
      } catch { /* older Pyodide: stdout still carries the error */ }
      this.pyodide = runtime;
      this.stdoutReady = true;
    })();
    try { await this.initPromise; }
    catch (e) { this.initPromise = null; throw e; }
  }

  // ── ArmEngineHooks ───────────────────────────────────────────────
  async loadFirmware(firmware: string, boardType: string): Promise<void> {
    this.board = boardKeyOf(boardType);
    await this.ensurePyodide();
    try { bridge.reset(this.board); } catch { /* reset never blocks boot */ }
    // Rebind after reset (the engine resets in place today, but a future
    // instance swap must not leave translators reading stale devices).
    this.peripherals = getPeripherals();
    this.i2cLog.length = 0;
    this.spiLog.length = 0;
    this.uartLog = '';
    this.lastAdc = {}; this.lastOneWire = {}; this.lastDht = '';
    this.lastNeoPixel = ''; this.lastPwm = ''; this.lastUart = ''; this.cameraCacheValue = '';
    this.pollFn = null;
    const raw = String(firmware || '');
    this.script = this.owner.pyScript
      || (raw.startsWith('PYSCRIPT:') ? raw.slice('PYSCRIPT:'.length) : raw);
    if (!this.script.trim()) {
      this.emit('RPI_PYERROR: no Python sketch supplied');
      return;
    }
    // Prime host-supplied sensor values BEFORE the sketch runs: boot-time
    // reads must see the wired components, not engine defaults.
    try { this.owner.pumpOneWire(this); } catch { /* ignore */ }
    try { this.owner.pumpDht(this); } catch { /* ignore */ }
    try { this.owner.pumpCamera(this); } catch { /* ignore */ }
    try {
      await this.pyodide.runPythonAsync(this.script);
      // A sketch may define rpi_poll(): the runner calls it on each tick so
      // it can observe host changes that happen AFTER boot (serial RX,
      // sensor value changes via INTERACT, …) with real read()/readline().
      try {
        const fn = this.pyodide.globals.get('rpi_poll');
        if (fn && typeof fn === 'function') this.pollFn = fn;
        else if (fn && typeof fn.destroy === 'function') fn.destroy();
      } catch { /* no poll hook defined — fine */ }
    } catch (e: any) {
      // Keep the failure in the serial channel: e2e prints it verbatim and
      // fails the cell instead of silently timing out.
      this.emit(`RPI_PYERROR: ${e && e.message ? e.message : String(e)}`);
    }
  }

  stepBudget(budget: number): number {
    // The sketch completes synchronously in loadFirmware; guest time is
    // virtual and already consumed. Advance only the simulation clock.
    return Math.max(1, Math.floor(Number(budget) || 1));
  }

  drainUartOut(): number[] {
    const out = this.txQueue.slice();
    this.txQueue.length = 0;
    return out;
  }

  injectUartByte(value: number): void {
    try { bridge.uart_inject(String.fromCharCode(value & 0xff)); } catch { /* ignore */ }
  }

  sampleGpioOut(pinId: string): { level: number; driving: boolean } | null {
    const n = pinNumber(pinId);
    if (n === null) return null;
    const p = this.peripherals.gpio.get(n);
    if (!p || p.mode !== 'out') return null;
    return { level: p.level ? 1 : 0, driving: true };
  }

  setGpioInput(pinId: string, high: boolean): void {
    const n = pinNumber(pinId);
    if (n === null) return;
    const p = this.peripherals.gpio.get(n);
    if (!p || p.mode === 'out') return; // guest output always wins
    try { bridge.gpio_drive(n, !!high); } catch { /* over-voltage etc. ignored */ }
  }

  readAnalog(ref: string): number {
    const n = pinNumber(ref);
    if (n === null || n < 0 || n > 7) return NaN;
    const value = Number(bridge.adc_read(n));
    return Number.isFinite(value) ? (value / 1023) * 3.3 : NaN;
  }

  /** Publish guest bus transactions into wired host component models and
   * translate host component state back into the guest peripheral models. */
  tickEnd(): void {
    if (this.i2cLog.length) {
      const log = this.i2cLog.splice(0, this.i2cLog.length);
      for (const tx of log) this.owner.deliverI2c(tx);
    }
    if (this.spiLog.length) {
      const log = this.spiLog.splice(0, this.spiLog.length);
      for (const tx of log) this.owner.deliverSpi(tx);
    }
    // Host → guest translators. Each is idempotent: a repeated identical
    // value is a no-op, so component updates never churn.
    try { this.owner.pumpAdc(this); } catch { /* translator never breaks a tick */ }
    try { this.owner.pumpUart(this); } catch { /* ditto */ }
    try { this.owner.pumpOneWire(this); } catch { /* ditto */ }
    try { this.owner.pumpDht(this); } catch { /* ditto */ }
    try { this.owner.pumpNeoPixel(this); } catch { /* ditto */ }
    try { this.owner.pumpServo(this); } catch { /* ditto */ }
    try { this.owner.pumpCamera(this); } catch { /* ditto */ }
    // Guest poll hook sees the translated state on this same tick.
    if (this.pollFn) {
      try { this.pollFn(); } catch { /* a sketch hook never breaks the tick */ }
    }
  }

  /** Exposed for the runner's translators (read-only view of live devices). */
  get devices(): any { return this.peripherals; }
  get boardKey(): BoardKey { return this.board; }
  get adcCache(): Record<number, number> { return this.lastAdc; }
  get oneWireCache(): Record<number, number> { return this.lastOneWire; }
  get dhtCache(): string { return this.lastDht; }
  set dhtCache(v: string) { this.lastDht = v; }
  get neoPixelCache(): string { return this.lastNeoPixel; }
  set neoPixelCache(v: string) { this.lastNeoPixel = v; }
  get pwmCache(): string { return this.lastPwm; }
  set pwmCache(v: string) { this.lastPwm = v; }
  get uartCache(): string { return this.lastUart; }
  set uartCache(v: string) { this.lastUart = v; }
  get cameraCache(): string { return this.cameraCacheValue; }
  set cameraCache(v: string) { this.cameraCacheValue = v; }
  private cameraCacheValue = '';
  clearUartLog(): void { this.uartLog = ''; }

  resetEngine(): void {
    try { bridge.reset(this.board); } catch { /* ignore */ }
    this.peripherals = getPeripherals();
    this.i2cLog.length = 0;
    this.spiLog.length = 0;
    this.txQueue.length = 0;
    this.uartLog = '';
    this.cameraCacheValue = '';
    this.pollFn = null;
  }

  close(): void { /* no persistent handles beyond the Pyodide instance */ }

  get stdoutBound(): boolean { return this.stdoutReady; }
}

export class RpiPyodideRunner extends ArmRunnerBase {
  protected uartTxPins = ['3', 'GPIO3', 'TX', '1', 'GPIO1'];
  protected uartRxPins = ['2', 'GPIO2', 'RX', '0', 'GPIO0'];
  protected engine = new RpiPyodideEngine(this);
  private pyScript: string;
  private boardType: string;
  private i2cEndpoints: WiredEndpoint[] | null = null;
  private spiEndpoints: WiredEndpoint[] | null = null;
  private wiredCache = new Map<string, WiredEndpoint[]>();

  constructor(
    hexData: string,
    componentsDef: any[],
    wiresDef: any[],
    onStateUpdate: (state: any) => void,
    options: AVRRunnerOptions & { pyScript?: string; boardType?: string } = {},
  ) {
    super(hexData, componentsDef, wiresDef, onStateUpdate, options);
    this.pyScript = String(options.pyScript || '');
    this.boardType = String(options.boardType || '');
    void this.boot(this.boardType);
  }

  protected gpioRailV(): number { return 3.3; }
  protected cyclesPerMicrosecond(): number { return 16; }
  protected budgetForDelta(deltaMs: number): number {
    return Math.floor(Math.max(0, deltaMs) * 1000 * Math.max(0.05, Number(this.speed) || 1));
  }

  /** All host instances wired to this board that satisfy `wanted`, deduped
   * by instance id and annotated with the board pin that reaches them. */
  private wiredEndpoints(key: string, wanted: string): WiredEndpoint[] {
    const cached = this.wiredCache.get(key);
    if (cached) return cached;
    const out = new Map<string, WiredEndpoint>();
    try {
      for (const boardPin of this.boardPinMap()) {
        for (const ep of this.getProtocolEndpointsForPin(boardPin)) {
          if (typeof (ep.inst as any)?.[wanted] !== 'function') continue;
          const id = String(ep.inst.id);
          if (!out.has(id)) out.set(id, {
            inst: ep.inst, pinId: String(ep.pinId), boardPin: String(boardPin),
          });
        }
      }
    } catch { /* discovery never breaks a tick */ }
    const list = Array.from(out.values());
    this.wiredCache.set(key, list);
    return list;
  }

  private endpoints(kind: 'i2c' | 'spi'): WiredEndpoint[] {
    const cache = kind === 'i2c' ? this.i2cEndpoints : this.spiEndpoints;
    if (cache) return cache;
    const list = kind === 'i2c'
      ? this.wiredEndpoints('i2c', 'onI2CStart')
      : this.wiredEndpoints('spi', 'onSPIByte');
    if (kind === 'i2c') this.i2cEndpoints = list;
    else this.spiEndpoints = list;
    return list;
  }

  /** Host component analogue output → guest MCP3008 channel. The host
   * model (potentiometer wiper / LDR / NTC divider) is the source of truth;
   * the guest reads the same converted 10-bit value. Per-board electrical
   * facts (ref/threshold/pull-up) are published into the board's state so
   * Pi 3/4 and Pi 5 differences remain observable. */
  protected pumpAdc(engine: RpiPyodideEngine): void {
    const meta: Record<string, any> = {
      board: engine.boardKey,
      refVolts: Number(engine.devices.profile?.vddVolts) || 3.3,
      bits: engine.boardKey === 'pi5' ? 12 : 10,
      viH: Number(engine.devices.profile?.viH),
      pullUpOhms: Number(engine.devices.profile?.pullUpOhms),
      channels: {},
    };
    const analogEndpoints = this.wiredEndpoints('analog', 'getPinVoltage');
    // Publish per-board conversion facts once, on the first source that
    // reports full state (potentiometer's getSyncState only reports value).
    const metaTarget = analogEndpoints.find((ep) => !String(ep.inst.type || '').includes('potentiometer'))
      || analogEndpoints[0];
    if (metaTarget) {
      try {
        metaTarget.inst.state = { ...(metaTarget.inst.state || {}), rpiAdc: meta };
        metaTarget.inst.stateChanged = true;
      } catch { /* metadata never breaks a component */ }
    }
    for (const ep of analogEndpoints) {
      const ch = adcChannelOf(ep.boardPin);
      if (ch === null) continue;
      // Only analogue-producing component pins are sources: rails and
      // digital-only parts are excluded by the pin-name list.
      const candidates = ['SIG', 'A0', 'p2', '2', 'HORZ', 'VERT'];
      let volts = NaN;
      for (const pin of candidates) {
        try {
          const v = Number(ep.inst.getPinVoltage(pin));
          if (Number.isFinite(v) && v > 0) { volts = v; break; }
        } catch { /* try next pin */ }
      }
      if (!Number.isFinite(volts)) continue;
      const ref = Number(meta.refVolts) || 3.3;
      const raw = Math.max(0, Math.min(1023,
        Math.round((Math.min(volts, ref) / ref) * 1023)));
      if (engine.adcCache[ch] !== raw) {
        engine.adcCache[ch] = raw;
        // Feed the analogue node, NOT the latched code: the guest's SAR
        // performs acquisition + conversion and produces the code itself.
        try { bridge.adc_source(ch, volts); } catch { /* ignore invalid channel */ }
      }
      meta.channels[String(ch)] = { volts: Number(volts.toFixed(4)), raw };
    }
    try {
      const boardInst = this.instances.get(this.boardId) as any;
      if (boardInst) {
        boardInst.state = { ...(boardInst.state || {}), rpiAdc: meta };
        boardInst.stateChanged = true;
      }
    } catch { /* metadata never breaks a tick */ }
  }

  /** Guest UART TX → host serial sink. `onUsbState` is the existing host
   * terminal contract (`enumState`, `rxCount`, `lastEcho`). */
  protected pumpUart(engine: RpiPyodideEngine): void {
    const pending = engine.uartLog;
    if (!pending || pending === engine.uartCache) return;
    for (const inst of this.instances.values()) {
      const sink = inst as any;
      if (typeof sink.onUsbState !== 'function') continue;
      try { sink.onUsbState('enumerated', pending.length, pending.slice(-64)); }
      catch { /* one sink never breaks the bus */ }
    }
    engine.uartCache = pending;
  }

  /** Host DS18B20 temperature → JS 1-Wire model, read by the guest through
   * `w1_gpio.read_temp()` / `rpi_sim.onewire.read_temp()`. */
  protected pumpOneWire(engine: RpiPyodideEngine): void {
    for (const ep of this.wiredEndpoints('onewire', 'getROMAddress')) {
      const pin = pinNumber(ep.boardPin);
      if (pin === null) continue;
      const temp = Number((ep.inst as any).state?.temperature);
      if (!Number.isFinite(temp)) continue;
      if (engine.oneWireCache[pin] === temp) continue;
      engine.oneWireCache[pin] = temp;
      try { bridge.onewire_set(pin, temp); } catch { /* ignore */ }
    }
  }

  /** Host DHT22 reading → JS DHT model behind `Adafruit_DHT.read*()`. */
  protected pumpDht(engine: RpiPyodideEngine): void {
    for (const ep of this.wiredEndpoints('dht', 'isTransactionActive')) {
      if (!String((ep.inst as any).type || '').includes('dht22')) continue;
      const pin = pinNumber(ep.boardPin);
      if (pin === null) continue;
      const temp = Number((ep.inst as any).state?.temperature);
      const hum = Number((ep.inst as any).state?.humidity);
      if (!Number.isFinite(temp) || !Number.isFinite(hum)) continue;
      const key = `${pin}:${temp}:${hum}`;
      if (engine.dhtCache === key) continue;
      engine.dhtCache = key;
      try { bridge.dht_set(pin, temp, hum); } catch { /* ignore */ }
    }
  }

  /** Guest NeoPixel pixels → host WS2812 framebuffer (`onNeoPixelFrame`). */
  protected pumpNeoPixel(engine: RpiPyodideEngine): void {
    const panels = this.wiredEndpoints('neopixel', 'onNeoPixelFrame');
    if (!panels.length) return;
    let packed = '';
    try {
      for (const strip of engine.devices.neopixels.values()) {
        for (const px of strip.pixels || []) {
          packed += `${Number(px[0]) & 0xff},${Number(px[1]) & 0xff},${Number(px[2]) & 0xff};`;
        }
      }
    } catch { return; }
    if (!packed || packed === engine.neoPixelCache) return;
    engine.neoPixelCache = packed;
    const pixels = packed.split(';').filter(Boolean).map((s) => {
      const [r, g, b] = s.split(',').map(Number);
      return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
    });
    for (const ep of panels) {
      try { ep.inst.onNeoPixelFrame(pixels); } catch { /* one panel never breaks a tick */ }
    }
  }

  /** Guest PWM channel → host RC servo pulse (`onPWMSignal`). Pulse width
   * is derived from the guest's own frequency + duty, never guessed. */
  protected pumpServo(engine: RpiPyodideEngine): void {
    const servos = this.wiredEndpoints('servo', 'onPWMSignal');
    if (!servos.length) return;
    for (const [pin, ch] of engine.devices.pwm.entries()) {
      const key = `${pin}:${ch.frequencyHz}:${ch.dutyPercent}`;
      if (engine.pwmCache === key) continue;
      engine.pwmCache = key;
      const freq = Math.max(1, Number(ch.frequencyHz) || 50);
      const duty = Math.max(0, Math.min(100, Number(ch.dutyPercent) || 0));
      const pulseUs = (duty / 100) * (1_000_000 / freq);
      for (const ep of servos) {
        try { ep.inst.onPWMSignal(ep.pinId, freq, duty, pulseUs); }
        catch { /* one servo never breaks the tick */ }
      }
    }
  }

  /** Replay one guest I2C transaction into every acking host device. The
   * address decode is the component's own framer (`onI2CStart` returns ACK),
   * so wrong-address devices stay untouched — same rule as a real bus. */
  protected deliverI2c(tx: I2cTransaction): void {
    for (const ep of this.endpoints('i2c')) {
      const inst = ep.inst;
      try {
        if (!inst.onI2CStart(tx.addr, tx.read)) continue;
        if (tx.read) {
          for (let i = 0; i < Math.max(1, tx.count || 1); i++) {
            try { inst.onI2CReadByte?.(); } catch { /* one byte never breaks the bus */ }
          }
        } else {
          for (const byte of tx.bytes) {
            try { inst.onI2CByte?.(tx.addr, byte & 0xff); } catch { /* ditto */ }
          }
        }
        try { inst.onI2CStop?.(); } catch { /* ditto */ }
      } catch { /* one bad device never breaks the bus */ }
    }
  }

  /** Host camera frame → Pyodide camera model. `picamera2.capture_array()`
   * then returns these bytes instead of an internal test pattern. */
  protected pumpCamera(engine: RpiPyodideEngine): void {
    for (const inst of this.instances.values()) {
      const cam = inst as any;
      if (String(cam.type || '') !== 'openhw-camera-module') continue;
      const frame = typeof cam.getFrame === 'function' ? cam.getFrame() : [];
      if (!Array.isArray(frame) || !frame.length) continue;
      const key = frame.slice(0, 24).join(',') + `:${frame.length}`;
      if (engine.cameraCache === key) continue;
      engine.cameraCache = key;
      try {
        bridge.camera_set_frame(frame,
          Number(cam.state?.width) || 64, Number(cam.state?.height) || 48);
      } catch { /* camera frame never breaks a tick */ }
    }
  }

  /** Replay guest SPI bytes (and CS edges) into wired host SPI devices. */
  protected deliverSpi(tx: SpiTransaction): void {
    for (const ep of this.endpoints('spi')) {
      const inst = ep.inst;
      try {
        // Frame boundary = one xfer() call (mirrors a complete CS-low frame).
        // The component's own CS pin name decides which edge latches the
        // frame (active-low for MAX7219 et al.), not the wired data pin.
        let csPin = 'CS';
        try { csPin = String(inst.getCSPinName?.() || 'CS'); } catch { /* default */ }
        try { inst.onPinStateChange?.(csPin, false, Math.floor(this.simCycleCount)); } catch { /* ignore */ }
        for (const byte of tx.bytes) {
          try { inst.onSPIByte?.(byte & 0xff); } catch { /* ignore */ }
        }
        try { inst.onPinStateChange?.(csPin, true, Math.floor(this.simCycleCount)); } catch { /* ignore */ }
      } catch { /* one bad device never breaks the bus */ }
    }
  }
}

export default RpiPyodideRunner;
