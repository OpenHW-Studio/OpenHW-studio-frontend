import React, { useEffect, useRef } from 'react';

export const BOUNDS = { x: 8, y: 32, w: 144, h: 192 };

export const ILI9341UI = ({ state }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Shadow buffer Ref - The absolute ground truth in RGBA
    const rgbaBufferRef = useRef(new Uint8ClampedArray(240 * 320 * 4));
    const lastHeartbeatRef = useRef(Date.now());

    // Initialize shadow buffer with alpha 255
    useEffect(() => {
        const buf = rgbaBufferRef.current;
        for (let i = 3; i < buf.length; i += 4) {
            buf[i] = 255;
        }
    }, []);

    // ATOMIC INGEST: Convert RGB -> RGBA immediately when new data arrives
    // This happens OUTSIDE the render loop, so the render loop always sees 
    // a consistent, non-tearing frame.
    useEffect(() => {
        if (!state) return;

        // Update heartbeat if worker is alive
        if (state.t) {
            lastHeartbeatRef.current = Date.now();
        }

        const rgbaBuf = rgbaBufferRef.current;

        // Handle power-off or reset
        if (!state.powerOn || state.reset) {
            for (let i = 0; i < rgbaBuf.length; i += 4) {
                rgbaBuf[i] = 0; rgbaBuf[i + 1] = 0; rgbaBuf[i + 2] = 0; rgbaBuf[i + 3] = 255;
            }
            return;
        }

        // Convert the incoming RGB buffer (Uint8Array) to our local RGBA Ref
        const rgbBuf = state.buffer;
        if (rgbBuf && rgbBuf.length === 240 * 320 * 3) {
            for (let i = 0; i < 240 * 320; i++) {
                const src = i * 3;
                const dst = i * 4;
                rgbaBuf[dst] = rgbBuf[src];     // R
                rgbaBuf[dst + 1] = rgbBuf[src + 1]; // G
                rgbaBuf[dst + 2] = rgbBuf[src + 2]; // B
                // Alpha is already 255
            }
        }
    }, [state]);

    // STABLE RENDER LOOP
    useEffect(() => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d', { alpha: false });
        if (!ctx) return;

        let animationId: number;

        const render = () => {
            const now = Date.now();
            const timeSinceHeartbeat = now - lastHeartbeatRef.current;

            // HEARTBEAT / STOP DETECTION: 
            // If the worker hasn't blinked for 600ms, clear to black.
            if (timeSinceHeartbeat > 600) {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, 240, 320);
            } else {
                // Atomic Draw: The rgbaBufferRef is always a complete frame
                const imgData = new ImageData(rgbaBufferRef.current, 240, 320);
                ctx.putImageData(imgData, 0, 0);
            }

            animationId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animationId);
    }, []); // Empty deps = Evergreen loop

    const w = 160;
    const h = 240;

    return (
        <div style={{ width: w, height: h, position: 'relative' }}>
            <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${w} ${h}`}
                xmlns="http://www.w3.org/2000/svg"
                style={{ display: 'block' }}
            >
                <g>
                    {/* PCB Background */}
                    <rect x="0" y="0" width={w} height={h} fill="#a01a1e" rx="4" />

                    {/* Mounting Holes */}
                    <circle cx="10" cy="10" r="4.5" fill="#FFFFFF" />
                    <circle cx={w - 10} cy="10" r="4.5" fill="#FFFFFF" />
                    <circle cx="10" cy={h - 10} r="4.5" fill="#FFFFFF" />
                    <circle cx={w - 10} cy={h - 10} r="4.5" fill="#FFFFFF" />

                    {/* Title Text */}
                    <text x={w / 2} y="22" fill="#FFFFFF" fontSize="14" fontFamily="monospace" textAnchor="middle" fontWeight="bold">ILI9341</text>

                    {/* Screen Bezel */}
                    <rect x="5" y="29" width={w - 10} height={h - 42} fill="#F4E3EB" />

                    {/* Screen Dark Area */}
                    <rect x="8" y="32" width={w - 16} height={h - 48} fill="#000000" />

                    {/* The Simulation Canvas */}
                    <foreignObject x="8" y="32" width={w - 16} height={h - 48}>
                        <canvas
                            ref={canvasRef}
                            width={240}
                            height={320}
                            style={{
                                width: '100%',
                                height: '100%',
                                pointerEvents: 'none',
                                imageRendering: 'pixelated'
                            }}
                        />
                    </foreignObject>

                    {/* Flex Cable Connector */}
                    <rect x={w / 2 - 40} y={h - 25} width="80" height="12" fill="#b06423" />

                    {/* Pin Headers */}
                    <rect x="36" y="231" width="88" height="8" fill="none" stroke="#FFFFFF" strokeWidth="0.5" opacity="0.5" />
                    <rect x="38.5" y="233.5" width="3" height="3" fill="#FFFFFF" />
                    {[50, 60, 70, 80, 90, 100, 110, 120].map((x, i) => (
                        <circle key={i} cx={x} cy="235" r="1.5" fill="#FFFFFF" />
                    ))}
                </g>
            </svg>
        </div>
    );
};