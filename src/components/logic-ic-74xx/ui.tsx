import React from 'react';

export const BOUNDS = { x: 0, y: 0, w: 200, h: 120 };

// Pin label lookup by IC type
const PIN_LABELS: Record<string, Record<string, string>> = {
    '7408': { p1: '1A', p2: '1B', p3: '1Y', p4: '2A', p5: '2B', p6: '2Y', p7: 'GND', p8: '3Y', p9: '3B', p10: '3A', p11: '4Y', p12: '4B', p13: '4A', p14: 'VCC' },
    '7432': { p1: '1A', p2: '1B', p3: '1Y', p4: '2A', p5: '2B', p6: '2Y', p7: 'GND', p8: '3Y', p9: '3B', p10: '3A', p11: '4Y', p12: '4B', p13: '4A', p14: 'VCC' },
    '7400': { p1: '1A', p2: '1B', p3: '1Y', p4: '2A', p5: '2B', p6: '2Y', p7: 'GND', p8: '3Y', p9: '3B', p10: '3A', p11: '4Y', p12: '4B', p13: '4A', p14: 'VCC' },
    '7486': { p1: '1A', p2: '1B', p3: '1Y', p4: '2A', p5: '2B', p6: '2Y', p7: 'GND', p8: '3Y', p9: '3B', p10: '3A', p11: '4Y', p12: '4B', p13: '4A', p14: 'VCC' },
    '7402': { p1: '1Y', p2: '1A', p3: '1B', p4: '2Y', p5: '2A', p6: '2B', p7: 'GND', p8: '3A', p9: '3B', p10: '3Y', p11: '4A', p12: '4B', p13: '4Y', p14: 'VCC' },
    '7404': { p1: '1A', p2: '1Y', p3: '2A', p4: '2Y', p5: '3A', p6: '3Y', p7: 'GND', p8: '4Y', p9: '4A', p10: '5Y', p11: '5A', p12: '6Y', p13: '6A', p14: 'VCC' },
    '7407': { p1: '1A', p2: '1Y', p3: '2A', p4: '2Y', p5: '3A', p6: '3Y', p7: 'GND', p8: '4Y', p9: '4A', p10: '5Y', p11: '5A', p12: '6Y', p13: '6A', p14: 'VCC' },
    '74266': { p1: '1A', p2: '1B', p3: '1Y', p4: '2A', p5: '2B', p6: '2Y', p7: 'GND', p8: '3Y', p9: '3B', p10: '3A', p11: '4Y', p12: '4B', p13: '4A', p14: 'VCC' },
};

const IC_NAMES: Record<string, string> = {
    '7400': 'NAND', '7402': 'NOR', '7404': 'NOT',
    '7407': 'BUF', '7408': 'AND', '7432': 'OR', '7486': 'XOR', '74266': 'XNOR',
};

export const LogicIC74xxUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const icType = attrs?.icType || '7408';
    const labels = PIN_LABELS[icType] || PIN_LABELS['7408'];

    // Bottom pins (1-7 left to right)
    const bottomPins = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
    // Top pins (14-8 left to right, matching bottom positions)
    const topPins = ['p14', 'p13', 'p12', 'p11', 'p10', 'p9', 'p8'];

    const pinSpacing = 22;
    const pinStartX = 28;
    const bodyX = 8;
    const bodyY = 28;
    const bodyW = 184;
    const bodyH = 64;

    return (
        <svg width="200" height="120" viewBox="0 0 200 120" style={{ pointerEvents: 'none' }}>
            <defs>
                {/* Chip body gradient for 3D realism */}
                <linearGradient id="icBodyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#353535" />
                    <stop offset="10%" stopColor="#2c2c2c" />
                    <stop offset="50%" stopColor="#242424" />
                    <stop offset="90%" stopColor="#1e1e1e" />
                    <stop offset="100%" stopColor="#111" />
                </linearGradient>
                {/* Pin metal gradient (silver) */}
                <linearGradient id="icPinGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#9a9a9a" />
                    <stop offset="30%" stopColor="#e0e0e0" />
                    <stop offset="70%" stopColor="#b3b3b3" />
                    <stop offset="100%" stopColor="#8a8a8a" />
                </linearGradient>
            </defs>

            {/* ── Pin legs (top, pins 14-8) ── */}
            {topPins.map((pin, i) => {
                const cx = pinStartX + i * pinSpacing;
                return (
                    <g key={pin}>
                        {/* Stepped pin leg going up */}
                        <path d={`M ${cx - 5} ${bodyY} 
                                   L ${cx - 5} ${bodyY - 4} 
                                   L ${cx - 2.5} ${bodyY - 8} 
                                   L ${cx - 2.5} ${bodyY - 18} 
                                   A 2.5 2 0 0 1 ${cx + 2.5} ${bodyY - 18} 
                                   L ${cx + 2.5} ${bodyY - 8} 
                                   L ${cx + 5} ${bodyY - 4} 
                                   L ${cx + 5} ${bodyY} Z`}
                            fill="url(#icPinGrad)" stroke="#555" strokeWidth="0.5" />
                    </g>
                );
            })}

            {/* ── Pin legs (bottom, pins 1-7) ── */}
            {bottomPins.map((pin, i) => {
                const cx = pinStartX + i * pinSpacing;
                return (
                    <g key={pin}>
                        {/* Stepped pin leg going down */}
                        <path d={`M ${cx - 5} ${bodyY + bodyH} 
                                   L ${cx - 5} ${bodyY + bodyH + 4} 
                                   L ${cx - 2.5} ${bodyY + bodyH + 8} 
                                   L ${cx - 2.5} ${bodyY + bodyH + 18} 
                                   A 2.5 2 0 0 0 ${cx + 2.5} ${bodyY + bodyH + 18} 
                                   L ${cx + 2.5} ${bodyY + bodyH + 8} 
                                   L ${cx + 5} ${bodyY + bodyH + 4} 
                                   L ${cx + 5} ${bodyY + bodyH} Z`}
                            fill="url(#icPinGrad)" stroke="#555" strokeWidth="0.5" />
                    </g>
                );
            })}

            {/* ── Chip body base ── */}
            <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} rx="2" ry="2"
                fill="url(#icBodyGrad)" stroke="#111" strokeWidth="1" />

            {/* ── Inner Bevel (3D edge) ── */}
            <rect x={bodyX + 2} y={bodyY + 2} width={bodyW - 4} height={bodyH - 4} rx="1" ry="1"
                fill="none" stroke="#4d4d4d" strokeWidth="0.8" />
            <line x1={bodyX + 2} y1={bodyY + bodyH - 2} x2={bodyX + bodyW - 2} y2={bodyY + bodyH - 2} 
                stroke="#1a1a1a" strokeWidth="1" />

            {/* ── Pin 1 Dimple (circular indent) ── */}
            <circle cx={bodyX + 12} cy={bodyY + bodyH - 12} r="5" 
                fill="#1c1c1c" stroke="#111" strokeWidth="1" />
            
            {/* Soft inner highlight for dimple */}
            <path d={`M ${bodyX + 12 - 3.5} ${bodyY + bodyH - 12 + 3.5} A 5 5 0 0 0 ${bodyX + 12 + 4.5} ${bodyY + bodyH - 12 + 2}`}
                fill="none" stroke="#333" strokeWidth="0.8" />

            {/* ── Notch / hole (semicircle on the left side) ── */}
            <path d={`M ${bodyX} ${bodyY + bodyH / 2 - 7} A 7 7 0 0 1 ${bodyX} ${bodyY + bodyH / 2 + 7}`}
                fill="#1c1c1c" stroke="#111" strokeWidth="1" />
            <path d={`M ${bodyX} ${bodyY + bodyH / 2 - 7} A 7 7 0 0 1 ${bodyX + 2.5} ${bodyY + bodyH / 2 + 5}`}
                fill="none" stroke="#4d4d4d" strokeWidth="0.8" />

            {/* ── Pin labels INSIDE chip, just below top pins ── */}
            {topPins.map((pin, i) => {
                const cx = pinStartX + i * pinSpacing;
                const pn = parseInt(pin.slice(1));
                const lbl = labels[pin] || '';
                return (
                    <g key={`label-t-${pn}`}>
                        <text x={cx} y={bodyY + 9} fill="#e0e0e0" fontSize="7" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">{pn}</text>
                        <text x={cx} y={bodyY + 16} fill="#aaa" fontSize="6.5" fontFamily="sans-serif" textAnchor="middle">{lbl}</text>
                    </g>
                );
            })}

            {/* ── Pin labels INSIDE chip, just above bottom pins ── */}
            {bottomPins.map((pin, i) => {
                const cx = pinStartX + i * pinSpacing;
                const pn = i + 1;
                const lbl = labels[pin] || '';
                return (
                    <g key={`label-b-${pn}`}>
                        <text x={cx} y={bodyY + bodyH - 12} fill="#aaa" fontSize="6.5" fontFamily="sans-serif" textAnchor="middle">{lbl}</text>
                        <text x={cx} y={bodyY + bodyH - 5} fill="#e0e0e0" fontSize="7" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">{pn}</text>
                    </g>
                );
            })}

            {/* ── IC part number (centered) ── */}
            <text x={bodyX + bodyW / 2 + 4} y={bodyY + bodyH / 2 + 8} fill="#c8c8c8" fontSize="24" fontWeight="800"
                fontFamily="'Arial Black', 'Impact', sans-serif" textAnchor="middle" letterSpacing="2">
                74LS{icType.slice(2)}
            </text>
        </svg>
    );
};

export const LogicIC74xxContextMenu = ({ attrs, onUpdate }: { attrs: any, onUpdate: (k: string, v: any) => void }) => {
    return (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '0 4px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)' }}>IC Type</span>
                <select
                    value={attrs.icType || '7408'}
                    onChange={e => onUpdate('icType', e.target.value)}
                    style={{
                        height: 26, background: 'var(--bg3)', border: '1px solid var(--border)',
                        color: 'var(--text)', borderRadius: 4, padding: '0 6px', fontSize: 12, outline: 'none'
                    }}
                >
                    <option value="7400">7400 (NAND)</option>
                    <option value="7402">7402 (NOR)</option>
                    <option value="7404">7404 (NOT)</option>
                    <option value="7407">7407 (Buffer)</option>
                    <option value="7408">7408 (AND)</option>
                    <option value="7432">7432 (OR)</option>
                    <option value="7486">7486 (XOR)</option>
                    <option value="74266">74266 (XNOR)</option>
                </select>
            </div>
        </div>
    );
};
