import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import { Readable } from 'stream';
import path from 'path';
import wsManager from './websocketManager.js';
import NetworkProxy from './networkProxy.js';

// ─── Constants ─────────────────────────────────────────────────────────────────

// Boot signature lines produced by the ESP32 ROM/IDF before user code runs
const BOOT_SIGNATURES = ['ets Jun', 'cpu_reset', 'app_main', 'Arduino setup', 'rst:0x1'];

// Exact regex for the GPIO shim protocol written by SimulatorBridge.h
const GPIO_PATTERN = /^>GPIO:(\d+):([01])<$/;

// ─── QemuRunner class ──────────────────────────────────────────────────────────

class QemuRunner {
    /**
     * @param {string} buildId     UUID for this session
     * @param {string} flashImage  Path to the merged flash .bin (bootloader + pt + app)
     * @param {string} pipesDir    Directory where uart.in / uart.out FIFOs will live
     */
    constructor(buildId, flashImage, pipesDir) {
        this.buildId    = buildId;
        this.flashImage = flashImage;
        this.pipesDir   = pipesDir;
        this.uartIn     = path.join(pipesDir, 'uart.in');   // Node.js writes GPIO cmds here
        this.uartOut    = path.join(pipesDir, 'uart.out');  // Node.js reads UART output from here
        this.process    = null;
        this.outStream  = null;  // readable fd on uart.out
        this.outBuffer  = '';
        this.lastActivity = Date.now();
        this.isReady    = false;
        
        // Wi-Fi Proxy
        this.proxy      = null;
    }

    start() {
        const qemuPath = process.env.QEMU_ESP32_PATH || 'qemu-system-xtensa';

        // ── Create named pipes (FIFOs) ───────────────────────────────────────────
        // QEMU's -serial pipe:PREFIX creates PREFIX.in and PREFIX.out automatically,
        // but only on Linux. On macOS we create them manually with mkfifo so the
        // code works on both platforms.
        const pipePrefix = path.join(this.pipesDir, 'uart');

        try {
            fs.mkdirSync(this.pipesDir, { recursive: true });
            // Remove stale FIFOs from a previous run, if any
            [this.uartIn, this.uartOut].forEach(p => {
                try { fs.unlinkSync(p); } catch {}
            });
            // mkfifo via shell — Node.js has no native mkfifo binding
            execFileSync('mkfifo', [this.uartIn]);
            execFileSync('mkfifo', [this.uartOut]);
        } catch (err) {
            console.error(`[${this.buildId}] ❌ Failed to create FIFOs:`, err.message);
            wsManager.sendToSession(this.buildId, {
                type: 'QEMU_ERROR',
                buildId: this.buildId,
                message: `Failed to create serial pipes: ${err.message}`,
            });
            return;
        }

        // ── Resolve WIFI_MODE ────────────────────────────────────────────────────
        // WIFI_MODE=slirp (default, works everywhere, outbound only via SLIRP/userspace NAT)
        // WIFI_MODE=tap   (Linux production only, requires a pre-configured tap0 interface)
        const wifiMode = (process.env.WIFI_MODE || 'slirp').toLowerCase();
        let nicArgs;
        if (wifiMode === 'tap') {
            // Requires: ip tuntap add tap0 mode tap && ip link set tap0 up
            // and iptables NAT masquerade on the uplink interface.
            const tapIface = process.env.TAP_INTERFACE || 'tap0';
            nicArgs = ['-nic', `tap,ifname=${tapIface},script=no,downscript=no,model=open_eth`];
            console.log(`[${this.buildId}] 🌐 WiFi mode: TAP (interface=${tapIface})`);
        } else {
            // SLIRP userspace networking — no root required, works on macOS and Linux.
            nicArgs = ['-nic', 'user,model=open_eth'];
            console.log(`[${this.buildId}] 🌐 WiFi mode: SLIRP (userspace NAT)`);
        }

        // ── Start NetworkProxy and retrieve dynamic port ─────────────────────────
        this.proxy = new NetworkProxy(this.buildId, (proxyPort) => {
            
            // ── Build QEMU argv ──────────────────────────────────────────────────────
            // -serial pipe:PREFIX                  → UART0 (System logs and GPIO bridge)
            // -serial tcp:127.0.0.1:<proxyPort>    → UART1 (Wi-Fi Payload Multiplexer)
            const args = [
                '-nographic',
                '-machine', 'esp32',
                '-drive',   `file=${this.flashImage},if=mtd,format=raw`,
                '-serial',  `pipe:${pipePrefix}`,
                '-serial',  `tcp:127.0.0.1:${proxyPort}`,
                ...nicArgs,
            ];

            console.log(`[${this.buildId}] 🚀 Starting QEMU: ${qemuPath} ${args.join(' ')}`);

            this.process = spawn(qemuPath, args, {
                // stdin/stdout/stderr are all for QEMU's QEMU-monitor/console — not the UART
                stdio: ['ignore', 'ignore', 'pipe'],
            });

            // ── Open uart.out for reading (QEMU serial TX → Node.js) ────────────────
            // We open with O_RDONLY | O_NONBLOCK to avoid blocking the event loop.
            // Wrapped in a retry because the FIFO blocks until both ends are open.
            const openOutPipe = (attempts = 0) => {
                try {
                    const fd = fs.openSync(this.uartOut, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
                    this.outStream = new Readable({ read() {} });
                    const buf = Buffer.alloc(4096);
                    const readLoop = () => {
                        if (!this.process) return;
                        try {
                            const n = fs.readSync(fd, buf, 0, buf.length, null);
                            if (n > 0) this._handleSerialData(buf.slice(0, n).toString());
                        } catch (e) {
                            if (e.code !== 'EAGAIN' && e.code !== 'EWOULDBLOCK') {
                                console.error(`[${this.buildId}] uart.out read error:`, e.code);
                            }
                        }
                        // Poll every 10ms — tight enough for sub-50ms latency
                        if (this.process) setTimeout(readLoop, 10);
                        else fs.closeSync(fd);
                    };
                    readLoop();
                } catch (e) {
                    if (attempts < 50) {
                        // Retry for up to 5 seconds — wait for QEMU to open its write end
                        setTimeout(() => openOutPipe(attempts + 1), 100);
                    } else {
                        console.error(`[${this.buildId}] ❌ Could not open uart.out after 5s:`, e.message);
                    }
                }
            };
            openOutPipe();

            // ── QEMU stderr (monitor / error log — not UART) ─────────────────────────
            this.process.stderr.on('data', (data) => {
                const text = data.toString().trim();
                if (text.toLowerCase().includes('error') || text.toLowerCase().includes('failed')) {
                    console.error(`[${this.buildId}] 🔴 QEMU: ${text}`);
                }
            });

            // ── Process lifecycle ─────────────────────────────────────────────────────
            this.process.on('close', (code) => {
                console.log(`[${this.buildId}] 🛑 QEMU exited (code ${code})`);
                wsManager.sendToSession(this.buildId, {
                    type: 'QEMU_EXIT',
                    buildId: this.buildId,
                    code,
                });
                wsManager.unregisterSession(this.buildId);
                this.process = null;
                this._cleanupPipes();
            });

            this.process.on('error', (err) => {
                console.error(`[${this.buildId}] 🔴 Failed to spawn QEMU: ${err.message}`);
                wsManager.sendToSession(this.buildId, {
                    type: 'QEMU_ERROR',
                    buildId: this.buildId,
                    message: `Failed to start QEMU: ${err.message}. Is qemu-system-xtensa installed and in PATH?`,
                });
                this._cleanupPipes();
            });
        });
        
        // Boot the proxy so QEMU can be spawned inside the callback
        this.proxy.start();
    }

    // ─── Internal: handle a raw UART data chunk from uart.out ────────────────────
    _handleSerialData(chunk) {
        this.lastActivity = Date.now();
        this.outBuffer += chunk;

        const lines = this.outBuffer.split('\n');
        this.outBuffer = lines.pop(); // keep the last incomplete line

        lines.forEach(line => {
            const clean = line.replace(/\r/g, '').trim();
            if (!clean) return;

            // ── Boot detection ────────────────────────────────────────────────────
            if (!this.isReady) {
                if (BOOT_SIGNATURES.some(sig => clean.includes(sig))) {
                    this.isReady = true;
                    wsManager.sendToSession(this.buildId, {
                        type: 'QEMU_READY',
                        buildId: this.buildId,
                    });
                    console.log(`[${this.buildId}] ✅ QEMU_READY`);
                }
            }

            // ── GPIO protocol filter (Blocker 4) ──────────────────────────────────
            // Lines matching >GPIO:pin:val< are shim events — extract and route as
            // GPIO_SYNC.  They must NEVER appear in the user's serial monitor.
            const gpioMatch = clean.match(GPIO_PATTERN);
            if (gpioMatch) {
                wsManager.sendToSession(this.buildId, {
                    type: 'GPIO_SYNC',
                    buildId: this.buildId,
                    pin:   parseInt(gpioMatch[1], 10),
                    value: parseInt(gpioMatch[2], 10),
                });
                return; // ← discard: do not forward to SERIAL_OUTPUT
            }

            // ── Regular serial output ─────────────────────────────────────────────
            wsManager.sendToSession(this.buildId, {
                type: 'SERIAL_OUTPUT',
                buildId: this.buildId,
                text: clean,
            });
        });
    }

    // ─── Inject a GPIO input into the running firmware via uart.in ───────────────
    // SimulatorBridge.h polls Serial.available() and parses <GPIO:pin:value>\n
    setVirtualPin(pin, value) {
        const cmd = `<GPIO:${pin}:${value ? 1 : 0}>\n`;
        try {
            // O_WRONLY | O_NONBLOCK — never block if firmware isn't reading
            const fd = fs.openSync(this.uartIn, fs.constants.O_WRONLY | fs.constants.O_NONBLOCK);
            fs.writeSync(fd, cmd);
            fs.closeSync(fd);
        } catch (e) {
            if (e.code !== 'ENXIO') {
                // ENXIO = no reader on the FIFO yet — expected during boot, silently ignore
                console.warn(`[${this.buildId}] setVirtualPin write error:`, e.code);
            }
        }
    }

    kill() {
        if (this.process) {
            console.log(`[${this.buildId}] ⚡ Killing QEMU`);
            this.process.kill('SIGKILL');
            this.process = null;
        }
        this._cleanupPipes();
    }

    _cleanupPipes() {
        if (this.proxy) {
            this.proxy.stop();
            this.proxy = null;
        }
        [this.uartIn, this.uartOut].forEach(p => {
            try { fs.unlinkSync(p); } catch {}
        });
        try { fs.rmdirSync(this.pipesDir); } catch {}
    }
}

export default QemuRunner;
