import React, { useState } from 'react';

// Bounding box for the selection ring
export const BOUNDS = { x: 0, y: 0, w: 90, h: 105 };

const ROWS = ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D'];

const KEY_W = 18;
const KEY_H = 18;
const GAP = 4;
const PAD_X = 5;
const PAD_Y = 12; // leave room for ribbon cable header

export const KeypadUI = ({ state, attrs, isRunning }: { state: any, attrs: any, isRunning: boolean }) => {
    const [pressedKey, setPressedKey] = useState<string | null>(null);

    const handlePress = (key: string) => {
        setPressedKey(key);
        // We always try to send the interaction; SimulatorPage filters it by isRunning
        if (attrs.onInteract) attrs.onInteract(`press:${key}`);
    };

    const handleRelease = () => {
        setPressedKey(null);
        if (attrs.onInteract) attrs.onInteract('release');
    };

    return (
        <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0 }}>
            <svg
                width={90} height={105}
                style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}
            >
                {/* Body */}
                <rect x={1} y={8} width={88} height={96} rx={4} fill="#1c1c1c" stroke="#444" strokeWidth={1} />

                {/* Ribbon header dots */}
                {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                    <circle key={i} cx={PAD_X + 5 + i * 10.5} cy={4} r={2.5} fill="#c0a000" stroke="#888" strokeWidth={0.8} />
                ))}

                {/* Key labels above grid */}
                {['R1', 'R2', 'R3', 'R4', 'C1', 'C2', 'C3', 'C4'].map((lbl, i) => (
                    <text key={lbl} x={PAD_X + 5 + i * 10.5} y={10} textAnchor="middle" fontSize={4} fill="#666" fontFamily="monospace">{lbl}</text>
                ))}

                {/* Keys 4x4 grid */}
                {ROWS.map((key, idx) => {
                    const col = idx % 4;
                    const row = Math.floor(idx / 4);
                    const kx = PAD_X + col * (KEY_W + GAP);
                    const ky = PAD_Y + row * (KEY_H + GAP);
                    const isPressed = pressedKey === key || state?.pressedKey === key;
                    const isAction = ['A', 'B', 'C', 'D'].includes(key);
                    const isSpecial = key === '*' || key === '#';

                    const fill = isPressed
                        ? (isAction ? '#1a6fbf' : '#cc4400')
                        : (isAction ? '#1c3a5c' : isSpecial ? '#2c2c2c' : '#333');

                    const textFill = isAction ? '#7ec8ff' : isSpecial ? '#aaa' : '#eee';

                    return (
                        <g
                            key={key}
                            style={{
                                pointerEvents: 'auto', // Always allow visual press
                                cursor: isRunning ? 'pointer' : 'default',
                                opacity: isRunning ? 1 : 0.8 // Visual hint if disabled logic-wise
                            }}
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                (e.currentTarget as any).setPointerCapture?.(e.pointerId);
                                handlePress(key);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => {
                                (e.currentTarget as any).releasePointerCapture?.(e.pointerId);
                                handleRelease();
                            }}
                            onPointerLeave={handleRelease}
                            onPointerCancel={handleRelease}
                        >
                            <rect
                                x={kx} y={ky} width={KEY_W} height={KEY_H} rx={3}
                                fill={fill}
                                stroke={isPressed ? '#fff4' : '#555'}
                                strokeWidth={0.8}
                                style={{ transition: 'fill 0.05s' }}
                            />
                            <text
                                x={kx + KEY_W / 2} y={ky + KEY_H / 2 + 4}
                                textAnchor="middle"
                                fontSize={7}
                                fontWeight="bold"
                                fontFamily="monospace"
                                fill={textFill}
                                style={{ userSelect: 'none', pointerEvents: 'none' }}
                            >
                                {key}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};
