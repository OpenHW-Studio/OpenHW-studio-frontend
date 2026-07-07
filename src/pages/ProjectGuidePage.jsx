import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Microchip, Lightbulb, CircuitBoard, FlaskConical, Cpu } from "lucide-react";
import { SerialTabBar, SerialOutputPane, SerialSendRow } from "./simulationpage/components/SerialMonitor";

const SLUG_MAP = {
  "led-blink": "led-blink",
  "rgb-led": "rgb-led-blink",
  buzzer: "buzzer",
  potentiometer: "potentiometer-led",
  "button-led": "button-led",
  "button-debounce": "button-debounce",
  "rgb-led-3-buttons": "rgb-led-3-buttons",
  "rgb-led-serial": "rgb-led-serial",
  "traffic-light": "traffic-light",
  "led-pwm": "led-pwm",
  "temperature-sensor": "temperature-sensor",
  "potentiometer-led": "potentiometer-led",
  "ldr-automatic-light": "ldr-automatic-light",
  "lcd-scrolling-text": "lcd-scrolling-text",
  "7-segment-display": "7-segment-display",
  "up-counter": "up-counter",
  "up-down-counter": "up-down-counter",
  "7-segment-counter": "7-segment-counter",
  "temperature-rgb-led": "temperature-rgb-led",
  "ultrasonic-distance": "ultrasonic-distance",
  "motion-sensor-alarm": "motion-sensor-alarm",
  "gas-sensor-led": "gas-sensor-led",
  "dht-lcd": "dht-lcd",
  "servo-motor": "servo-motor",
  "servo-potentiometer": "servo-potentiometer",
  "dc-motor-pwm": "dc-motor-pwm",
  "dc-motor-l293d": "dc-motor-l293d",
  "auto-fan-speed": "auto-fan-speed",
  "smart-street-light": "smart-street-light",
  "water-level-indicator": "water-level-indicator",
  "smart-dustbin": "smart-dustbin",
  "bluetooth-hc05": "bluetooth-hc05",
  "ir-remote-control": "ir-remote-control",
  "rf-remote-control": "rf-remote-control",
  "communication-protocols": "communication-protocols",
  "wifi-led-control": "wifi-led-control",
  "smart-home-automation": "smart-home-automation",
  "obstacle-avoiding-robot": "obstacle-avoiding-robot",
  "line-following-robot": "line-following-robot",
};

import { markAdventureStepComplete } from "../services/adventureService";

import PROJECT_INDEX from "../services/guideProjectsIndex.json";

export default function ProjectGuidePage() {
  const { projectName = "" } = useParams();
  const [searchParams] = useSearchParams();
  const classId = searchParams.get('classId');

  useEffect(() => {
    if (projectName) {
      markAdventureStepComplete({
        classId,
        projectSlug: projectName,
        stepKey: 'demo',
        stepOrder: 4,
      }).catch(() => {});
    }
  }, [projectName, classId]);

  const jsonSlug = SLUG_MAP[projectName]
  const project = jsonSlug ? PROJECT_INDEX[jsonSlug] : null

  const iframeRef = useRef(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [serialBtnHovered, setSerialBtnHovered] = useState(false);
  const [serialOpen, setSerialOpen] = useState(false);
  const [serialEntries, setSerialEntries] = useState([]);
  const serialOutputRef = useRef(null);
  const serialPopupRef = useRef(null);
  const [serialPopupPos, setSerialPopupPos] = useState(null);
  const serialPopupDragging = useRef(false);
  const serialPopupDragOffset = useRef({ x: 0, y: 0 });
  const [serialBoardFilter, setSerialBoardFilter] = useState('all');
  const [serialPaused, setSerialPaused] = useState(false);
  const [autoscroll, setAutoscroll] = useState(true);
  const [serialInput, setSerialInput] = useState('');
  const [serialBaudRate, setSerialBaudRate] = useState('9600');
  const [serialLineEnding, setSerialLineEnding] = useState('nl');
  const [isSerialSplit, setIsSerialSplit] = useState(false);

  const BOARD_ID = 'board-0';
  const serialBoardOptions = ['all', BOARD_ID];
  const serialBoardLabels = { [BOARD_ID]: 'Arduino Uno' };
  const serialBoardKinds = { [BOARD_ID]: 'arduino_uno' };
  const boardColors = { [BOARD_ID]: '#1a5276' };

  const serialHistory = useMemo(() =>
    serialEntries.map(e => ({
      ...e,
      ts: '',
      boardId: BOARD_ID,
      source: 'simulation',
    })),
    [serialEntries]
  );

  const handleSerialPopupMouseDown = useCallback((e) => {
    serialPopupDragging.current = true;
    const rect = serialPopupRef.current?.getBoundingClientRect();
    if (rect) {
      serialPopupDragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!serialPopupDragging.current) return;
      setSerialPopupPos({
        x: Math.max(0, e.clientX - serialPopupDragOffset.current.x),
        y: Math.max(0, e.clientY - serialPopupDragOffset.current.y),
      });
    };
    const handleMouseUp = () => {
      serialPopupDragging.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'serial-entry') {
        setSerialEntries(prev => {
          const next = [...prev, ...e.data.entries]
          return next.length > 1000 ? next.slice(next.length - 800) : next
        })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  useEffect(() => {
    if (autoscroll && !serialPaused && serialOutputRef.current) {
      serialOutputRef.current.scrollTop = serialOutputRef.current.scrollHeight;
    }
  }, [serialEntries, serialBoardFilter, autoscroll, serialPaused])

  const sendSerialInput = useCallback(() => {
    const txt = String(serialInput || "");
    if (!txt.trim()) return;
    const lineEndings = { nl: "\n", cr: "\r", "cr+nl": "\r\n", no: "" };
    const payload = txt + (lineEndings[serialLineEnding] ?? "\n");
    iframeRef.current?.contentWindow?.postMessage({
      type: "serial-send", data: payload,
    }, "*");
    setSerialInput("");
  }, [serialInput, serialLineEnding]);

  const canvasOnlyUrl = `/${projectName}/demo?canvas-only=1&readonly=1`

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = canvasOnlyUrl
    link.as = 'document'
    document.head.appendChild(link)
    return () => document.head.removeChild(link)
  }, [canvasOnlyUrl])

  const explanation = project?.description
    ? `This project demonstrates ${project.description.charAt(0).toLowerCase() + project.description.slice(1)}. The code configures the board in the setup() function and runs the main logic repeatedly in the loop() function.`
    : ''

  return (
    <div style={{
      width: "100vw", height: "100vh", overflow: "hidden",
      background: "var(--bg, #0b1120)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        display: "flex", alignItems: "stretch",
        height: "70vh", maxWidth: "calc(70vw + 400px)",
      }}>
        <div style={{
          width: "110vh", maxWidth: "70vw",
          borderRadius: 12, overflow: "hidden",
          border: "1px solid var(--border, rgba(255,255,255,0.08))",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          background: "var(--bg, #0b1120)",
          position: "relative",
        }}>
          <iframe
            ref={iframeRef}
            src={canvasOnlyUrl}
            onLoad={() => setIframeLoading(false)}
            style={{
              width: "100%", height: "100%", border: "none", display: "block",
            }}
            title={`${projectName} Simulator`}
            fetchpriority="high"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
          />

          {iframeLoading && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 10,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 16, background: "var(--bg, #0b1120)",
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 0.8s linear infinite" }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text, #e2e8f0)" }}>
                Loading circuit… Placing components and wiring connection
              </div>
            </div>
          )}
        </div>

        {project && (
        <div style={{
          width: 400, flexShrink: 0, height: "100%",
          borderLeft: "1px solid var(--border, rgba(255,255,255,0.08))",
          background: "var(--bg2, #0f172a)",
          overflowY: "auto", padding: "24px 24px 24px 20px",
          display: "flex", flexDirection: "column", gap: 20,
          borderRadius: "0 12px 12px 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "linear-gradient(135deg, #3b82f6, #2563eb)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Microchip size={20} color="#fff" strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3, #64748b)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                Mission Brief
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text, #e2e8f0)", lineHeight: 1.3 }}>
                {project.title}
              </div>
            </div>
            <button
              onClick={() => {
                setSerialOpen(v => {
                  if (!v) setSerialEntries([])
                  return !v
                })
                iframeRef.current?.contentWindow?.postMessage({ type: 'serial-toggle' }, '*')
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: serialBtnHovered ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: serialBtnHovered ? '#e2e8f0' : '#94a3b8',
                padding: '6px 12px', borderRadius: 8,
                fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                transition: 'all 0.15s',
              }}
              onMouseEnter={() => setSerialBtnHovered(true)}
              onMouseLeave={() => setSerialBtnHovered(false)}
              title="Toggle Serial Monitor"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" /><line x1="6" y1="6" x2="6" y2="6" /><line x1="10" y1="6" x2="10" y2="6" />
              </svg>
              Serial
            </button>
          </div>

          <div style={{
            background: "var(--bg3, #1e293b)", borderRadius: 10, padding: 14,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <Lightbulb size={12} strokeWidth={2.5} /> How It Works
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text2, #94a3b8)", lineHeight: 1.7 }}>
              {project.description}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 100,
              color: "#60a5fa", background: "rgba(96,165,250,0.1)",
            }}>
              <CircuitBoard size={11} strokeWidth={2.5} />
              {project.board}
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 100,
              color: "var(--text2, #94a3b8)", background: "var(--bg3, #1e293b)",
            }}>
              <FlaskConical size={11} strokeWidth={2.5} />
              {project.components.length} components
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3, #64748b)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
              <CircuitBoard size={12} strokeWidth={2.5} /> Required Components
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {project.components.map((comp, i) => (
                <span key={i} style={{
                  fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 6,
                  background: "var(--bg3, #1e293b)", border: "1px solid var(--border, rgba(255,255,255,0.06))",
                  color: "var(--text2, #94a3b8)",
                }}>
                  {comp}
                </span>
              ))}
            </div>
          </div>

          {explanation && (
            <div style={{
              background: "rgba(96,165,250,0.08)", borderRadius: 10, padding: 14,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                <Lightbulb size={12} strokeWidth={2.5} /> Code Explanation
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text2, #94a3b8)", lineHeight: 1.7 }}>
                {explanation}
              </p>
            </div>
          )}


            
            {searchParams.get('fromMap') && (
              <div style={{ marginTop: 'auto', paddingTop: 20 }}>
                <button 
                  onClick={() => {
                    window.location.href = classId ? `/adventure?classId=${encodeURIComponent(classId)}` : '/adventure';
                  }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'center',
                    padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    color: '#fff', fontSize: 15, fontWeight: 800,
                    boxShadow: '0 8px 24px rgba(34,197,94,0.35)',
                  }}>
                  ← Back to Adventure Map
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {serialOpen && (
        <div ref={serialPopupRef} style={{
          position: 'fixed',
          left: serialPopupPos?.x ?? (typeof window !== 'undefined' ? window.innerWidth - 420 : 700),
          top: serialPopupPos?.y ?? (typeof window !== 'undefined' ? window.innerHeight - 350 : 400),
          width: 'min(520px, 94vw)', height: 'min(400px, 70vh)',
          background: '#0f172a',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          zIndex: 9999,
          overflow: 'hidden',
        }}>
          <div
            onMouseDown={handleSerialPopupMouseDown}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              padding: '10px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              fontSize: 12, fontWeight: 700, color: '#e2e8f0',
              cursor: 'grab', userSelect: 'none',
              background: '#1e293b', flexShrink: 0,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Cpu size={14} strokeWidth={2.5} /> Serial Monitor
            </span>
            <button
              onClick={() => {
                setSerialEntries([])
                setSerialOpen(false)
                iframeRef.current?.contentWindow?.postMessage({ type: 'serial-toggle' }, '*')
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8', padding: '3px 10px', borderRadius: 6,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >✕ Close</button>
          </div>

          <SerialTabBar
            activeBoard={serialBoardFilter}
            otherActiveBoard={null}
            setBoard={setSerialBoardFilter}
            isPaused={serialPaused}
            onTogglePause={() => setSerialPaused(p => !p)}
            autoscroll={autoscroll}
            onToggleAutoscroll={setAutoscroll}
            onClear={() => setSerialEntries([])}
            onToggleSplit={() => setIsSerialSplit(s => !s)}
            isSplit={isSerialSplit}
            boardOptions={serialBoardOptions}
            boardColors={boardColors}
            boardLabels={serialBoardLabels}
            boardKinds={serialBoardKinds}
          />

          <SerialOutputPane
            boardId={serialBoardFilter}
            history={serialHistory}
            outputRef={serialOutputRef}
            isPaused={serialPaused}
            boardColors={boardColors}
            isRunning={true}
          />

          <SerialSendRow
            boardId={serialBoardFilter === 'all' ? BOARD_ID : serialBoardFilter}
            input={serialInput}
            setInput={setSerialInput}
            onSend={sendSerialInput}
            isRunning={true}
            hardwareConnected={false}
            serialLineEnding={serialLineEnding}
            setSerialLineEnding={setSerialLineEnding}
            serialBaudRate={serialBaudRate}
            setSerialBaudRate={setSerialBaudRate}
            boardLabels={serialBoardLabels}
            theme="dark"
          />
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
