import { useState, useEffect } from "react";
import { Cpu, Activity, Signal } from "lucide-react";

export default function AuthLeftShowcase() {
  const [pingState, setPingState] = useState("idle"); // "idle" | "pinging" | "complete"
  const [latency, setLatency] = useState(null);
  const [logs, setLogs] = useState([
    "SYS_STATUS: ACTIVE [OK]",
    "BUS_SPEED: 1.2GHz [RISC-V]",
    "CORES: 4x RV64IMAC [STABLE]",
    "NET_INTERFACE: ETH_0 [READY]"
  ]);

  const handlePingTest = () => {
    if (pingState === "pinging") return;

    setPingState("pinging");
    setLatency(null);
    setLogs((prev) => [
      ...prev,
      `> CALLING NODE [10.0.8.2]...`,
      `> INITIALIZING HANDSHAKE PROTOCOL...`
    ]);

    // Step 1: Sending packet
    setTimeout(() => {
      setLogs((prev) => [
        ...prev,
        `> TRANSMITTING 32 BYTES TO COPROCESSOR...`
      ]);
    }, 400);

    // Step 2: Receive ACK and display latency
    setTimeout(() => {
      const generatedLatency = Math.floor(Math.random() * 41) + 12; // 12ms - 52ms
      setLatency(generatedLatency);
      setPingState("complete");
      setLogs((prev) => [
        ...prev,
        `> ACK RECEIVED: ${generatedLatency}ms`,
        `> LINK TELEMETRY: SECURE [100%]`
      ]);
    }, 1000);
  };

  // Keep logs view scrolled to bottom if needed, or cap it at last 6 lines
  const visibleLogs = logs.slice(-5);

  return (
    <section className="auth-hardware-showcase">
      {/* Top Card: RISC-V CPU Core Schematic */}
      <div className="cpu-schematic-card">
        <div className="cpu-schematic-card__header">
          <span className="cpu-schematic-card__core-label">
            <Cpu className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
            <span>RV64IMAC CORE COMPLEX</span>
          </span>
          <span>V1.4.0</span>
        </div>

        <div className="cpu-schematic-card__visualization">
          <svg
            viewBox="0 0 320 200"
            className="w-full h-full text-slate-400"
            style={{ display: "block" }}
          >
            {/* Animated Bus Lines (Electronic Current) */}
            <path
              d="M 60 60 L 60 140"
              stroke="#38bdf8"
              strokeWidth="1.5"
              fill="none"
              className="bus-trace"
            />
            <path
              d="M 100 40 L 120 40"
              stroke="#10b981"
              strokeWidth="1.5"
              fill="none"
              className="bus-trace bus-trace--fast"
            />
            <path
              d="M 200 40 L 260 40 L 260 70"
              stroke="#38bdf8"
              strokeWidth="1.5"
              fill="none"
              className="bus-trace"
            />
            <path
              d="M 260 125 L 260 160 L 200 160"
              stroke="#f59e0b"
              strokeWidth="1.5"
              fill="none"
              className="bus-trace bus-trace--fast"
            />
            <path
              d="M 160 140 L 160 60"
              stroke="#38bdf8"
              strokeWidth="1.5"
              fill="none"
              className="bus-trace"
            />

            {/* Blocks */}
            {/* Control Unit */}
            <g transform="translate(20, 20)">
              <rect width="80" height="40" rx="6" className="cpu-block" />
              <text x="40" y="24" textAnchor="middle" className="cpu-block__text">
                CTRL_UNIT
              </text>
            </g>

            {/* Registers */}
            <g transform="translate(120, 20)">
              <rect width="80" height="40" rx="6" className="cpu-block" />
              <text x="40" y="24" textAnchor="middle" className="cpu-block__text">
                REG_FILE
              </text>
            </g>

            {/* Instruction Cache */}
            <g transform="translate(20, 140)">
              <rect width="80" height="40" rx="6" className="cpu-block" />
              <text x="40" y="24" textAnchor="middle" className="cpu-block__text">
                I_CACHE
              </text>
            </g>

            {/* ALU */}
            <g transform="translate(220, 70)">
              <rect width="80" height="55" rx="6" className="cpu-block" />
              <text x="40" y="32" textAnchor="middle" className="cpu-block__text">
                ALU CORE
              </text>
            </g>

            {/* Data Cache */}
            <g transform="translate(120, 140)">
              <rect width="80" height="40" rx="6" className="cpu-block" />
              <text x="40" y="24" textAnchor="middle" className="cpu-block__text">
                D_CACHE
              </text>
            </g>
          </svg>
        </div>

        <div className="cpu-schematic-card__footer">
          <span>HARDSYNC: OK</span>
          <span>BUS_LOCK: FALSE</span>
        </div>
      </div>

      {/* Bottom Card: Diagnostics & Telemetry Ping Panel */}
      <div className="ping-monitor-panel">
        <div className="flex justify-between border-b border-slate-700 pb-1.5 mb-1.5 text-slate-300">
          <span className="font-bold flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            CONNECTION TELEMETRY
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={`ping-signal-pulse ${
                pingState === "pinging" ? "is-pinging" : ""
              }`}
            />
            <span className="text-[10px] text-slate-400 uppercase">
              {pingState === "pinging"
                ? "TESTING"
                : pingState === "complete"
                ? "SECURE"
                : "READY"}
            </span>
          </span>
        </div>

        {visibleLogs.map((log, idx) => (
          <div key={idx} className="truncate text-slate-300">
            {log}
          </div>
        ))}

        {latency !== null && (
          <div className="mt-2 text-emerald-400 font-bold border-t border-slate-800 pt-1.5 flex justify-between">
            <span>[RTT_LATENCY]</span>
            <span>{latency} ms</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handlePingTest}
        disabled={pingState === "pinging"}
        className={`ping-trigger-btn ${pingState === "pinging" ? "is-pinging" : ""}`}
      >
        <Signal className="w-3.5 h-3.5 animate-pulse" />
        {pingState === "pinging" ? "[ PINGING NODE... ]" : "[ TEST NODE PING ]"}
      </button>
    </section>
  );
}
