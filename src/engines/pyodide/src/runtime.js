import bridge, { getPeripherals } from './bridge.js';

const PYODIDE_VERSION = '314.0.8';
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

// Every shim shipped by the simulator, written into the Pyodide FS at init.
// Built-ins (socket/threading/queue/asyncio/logging/json/csv) need no entry.
const PY_FILES = [
  // core bridge + helpers
  'py/rpi_sim/__init__.py',
  'py/rpi_sim/_bridge.py',
  'py/rpi_sim/uart.py',
  'py/rpi_sim/timers.py',
  'py/rpi_sim/system.py',
  'py/rpi_sim/board.py',
  'py/rpi_sim/devices.py',
  'py/rpi_sim/onewire.py',
  'py/rpi_sim/config.py',
  'py/rpi_sim/drivers.py',
  'py/rpi_sim/sysfs.py',
  'py/rpi_sim/threads.py',
  'py/rpi_sim/interrupts.py',
  'py/rpi_sim/network.py',
  'py/rpi_sim/electrical.py',
  'py/rpi_sim/analog.py',
  'py/rpi_sim/environment.py',
  'py/w1_gpio.py',
  // core GPIO / buses
  'py/RPi/__init__.py',
  'py/RPi/GPIO.py',
  'py/gpiozero.py',
  'py/pigpio.py',
  'py/wiringpi.py',
  'py/periphery.py',
  'py/board.py',
  'py/busio.py',
  'py/digitalio.py',
  'py/analogio.py',
  'py/pwmio.py',
  'py/smbus.py',
  'py/smbus2.py',
  'py/spidev.py',
  'py/serial.py',
  'py/socket.py',
  'py/Adafruit_GPIO.py',
  // sensors
  'py/Adafruit_DHT.py',
  'py/w1thermsensor.py',
  'py/adafruit_bme280.py',
  'py/adafruit_bmp280.py',
  'py/adafruit_sht31d.py',
  'py/adafruit_mcp9808.py',
  'py/adafruit_adxl34x.py',
  'py/adafruit_mpu6050.py',
  'py/adafruit_lis3dh.py',
  'py/adafruit_pcf8523.py',
  'py/DS1307.py',
  'py/MFRC522.py',
  'py/nrf24l01.py',
  'py/hcsr04.py',
  'py/ina219.py',
  'py/bh1750.py',
  // display / actuators
  'py/Adafruit_SSD1306.py',
  'py/luma/__init__.py',
  'py/luma/oled.py',
  'py/luma/lcd.py',
  'py/RPLCD.py',
  'py/Adafruit_NeoPixel.py',
  'py/neopixel.py',
  'py/adafruit_pca9685.py',
  'py/PCA9685.py',
  'py/adafruit_motor.py',
  'py/adafruit_servokit.py',
  'py/picamera2.py',
  // app / network
  'py/requests.py',
  'py/paho/__init__.py',
  'py/paho/mqtt/__init__.py',
  'py/paho/mqtt/client.py',
  'py/flask.py',
  'py/zeroconf.py',
  'py/netifaces.py',
  // data
  'py/PIL/__init__.py',
  'py/PIL/Image.py',
];

const SHIM_ROOT = '/home/pyodide';

let pyodide = null;
let initialized = false;
let initPromise = null;

function ensureDir(fs, dir) {
  if (fs.analyzePath(dir).exists) return;
  const parent = dir.slice(0, dir.lastIndexOf('/')) || '/';
  if (parent !== dir) ensureDir(fs, parent);
  fs.mkdir(dir);
}

async function init() {
  if (initialized) return pyodide;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (typeof window.loadPyodide !== 'function') {
      throw new Error('Pyodide loader not present — include pyodide.js from the CDN');
    }
    const runtime = await window.loadPyodide({ indexURL: PYODIDE_BASE });
    runtime.globals.set('__rpiBridge', bridge);
    runtime.runPython(`import sys; sys.path.insert(0, '${SHIM_ROOT}')`);
    for (const path of PY_FILES) {
      const res = await fetch(new URL(path, document.baseURI));
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      const target = `${SHIM_ROOT}/${path.slice('py/'.length)}`;
      ensureDir(runtime.FS, target.slice(0, target.lastIndexOf('/')));
      runtime.FS.writeFile(target, await res.text());
    }
    // numpy ships with Pyodide but is not installed until explicitly loaded.
    try { await runtime.loadPackage('numpy'); }
    catch (err) { console.warn('numpy unavailable:', err); }
    runtime.runPython('import rpi_sim');
    pyodide = runtime;
    initialized = true;
    return pyodide;
  })();
  try { return await initPromise; }
  catch (e) { initPromise = null; throw e; }
}

const api = {
  version: PYODIDE_VERSION,
  ready: () => initialized,
  init,
  boards: () => bridge.boards(),
  board: () => bridge.board(),
  setBoard: (board) => bridge.reset(board),
  reset: (board) => bridge.reset(board),
  run: async (code) => {
    await init();
    return await pyodide.runPythonAsync(code);
  },
  runSync: (code) => {
    if (!pyodide) throw new Error('call init() first');
    return pyodide.runPython(code);
  },
  state: () => bridge.state(),
  peripheral: () => getPeripherals(),
  bridge,
};

if (typeof window !== 'undefined') window.RPiSim = api;
export default api;
