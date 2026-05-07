import React, { useState, useRef } from 'react';

// Bounding box for the blue selection ring.
export const BOUNDS = { x: 0, y: 0, w: 60, h: 60 };

export const JoystickUI = ({ state, attrs, isRunning, comp }: { state: any, attrs: any, isRunning: boolean, comp?: any }) => {
    const handleRef = useRef<SVGCircleElement>(null);
    const [localState, setLocalState] = useState({ x: 0.5, y: 0.5, pressed: false });

    // Use simulated state if running, else local component state
    // Prioritize local state during active dragging for instantaneous UI feedback without worker lag!
    const isDraggingRef = useRef(false);
    const isArrowHoldingRef = useRef(false);
    const currentX = isDraggingRef.current || isArrowHoldingRef.current ? localState.x : (isRunning && state?.x !== undefined ? state.x : localState.x);
    const currentY = isDraggingRef.current || isArrowHoldingRef.current ? localState.y : (isRunning && state?.y !== undefined ? state.y : localState.y);
    const isPressed = isDraggingRef.current || isArrowHoldingRef.current ? localState.pressed : (isRunning && state?.pressed !== undefined ? state.pressed : localState.pressed);

    // Map 0..1 to UI coordinates
    // Center is 30,30. Movement radius is ~15.
    const cx = 30 + (currentX - 0.5) * 30;
    const cy = 30 + (currentY - 0.5) * 30;

    const updatePosition = (e: React.PointerEvent) => {
        const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
        let nx = (e.clientX - rect.left) / rect.width;
        let ny = (e.clientY - rect.top) / rect.height;

        // Clamp to 0..1
        nx = Math.max(0, Math.min(1, nx));
        ny = Math.max(0, Math.min(1, ny));

        if (attrs.onInteract) attrs.onInteract({ type: 'move', x: nx, y: ny });
        setLocalState((prev: any) => ({ ...prev, x: nx, y: ny }));
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!isRunning) return;
        e.stopPropagation();
        try { if ('pointerId' in e) (e.target as any).setPointerCapture(e.pointerId); } catch (err) { }

        if (e.button === 2 || e.shiftKey) {
            // Right click or Shift + click = press button
            if (attrs.onInteract) attrs.onInteract('press');
            setLocalState((prev: any) => ({ ...prev, pressed: true }));
        } else {
            // Calculate new X/Y immediately on click
            isDraggingRef.current = true;
            updatePosition(e);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isRunning) return;
        if (isArrowHoldingRef.current) return; // Ignore drag updates if holding an arrow
        if (!isDraggingRef.current) return;
        if (isPressed && !e.shiftKey && e.button !== 2) return; // If pressed and moving, just update position too
        updatePosition(e);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isRunning) return;
        e.stopPropagation();
        try { if ('pointerId' in e) (e.target as any).releasePointerCapture(e.pointerId); } catch (err) { }
        isDraggingRef.current = false;

        // On release, joystick snaps back to center
        if (attrs.onInteract) {
            attrs.onInteract({ type: 'move', x: 0.5, y: 0.5 });
            if (isPressed) attrs.onInteract('release');
        }
        setLocalState({ x: 0.5, y: 0.5, pressed: false });
    };

    const handleArrowDown = (e: React.PointerEvent | React.MouseEvent, nx: number, ny: number) => {
        if (!isRunning) return;
        e.stopPropagation();
        try { if ('pointerId' in e) (e.target as any).setPointerCapture((e as React.PointerEvent).pointerId); } catch (err) { }

        isArrowHoldingRef.current = true;
        if (attrs.onInteract) attrs.onInteract({ type: 'move', x: nx, y: ny });
        setLocalState((prev: any) => ({ ...prev, x: nx, y: ny }));
    };

    const handleArrowUp = (e: React.PointerEvent | React.MouseEvent) => {
        if (!isRunning) return;
        e.stopPropagation();
        try { if ('pointerId' in e) (e.target as any).releasePointerCapture((e as React.PointerEvent).pointerId); } catch (err) { }

        isArrowHoldingRef.current = false;
        if (attrs.onInteract) attrs.onInteract({ type: 'move', x: 0.5, y: 0.5 });
        setLocalState((prev: any) => ({ ...prev, x: 0.5, y: 0.5 }));
    };

    const Arrow = ({ d, nx, ny, hx, hy, hw, hh }: { d: string, nx: number, ny: number, hx: number, hy: number, hw: number, hh: number }) => (
        <g>
            <rect
                x={hx} y={hy} width={hw} height={hh}
                fill="#ffffff" opacity={0.01} stroke="none"
                style={{ cursor: isRunning ? 'pointer' : 'default', pointerEvents: 'all' }}
                onPointerDown={(e: React.PointerEvent) => handleArrowDown(e, nx, ny)}
                onPointerUp={handleArrowUp}
                onPointerCancel={handleArrowUp}
                onPointerLeave={(e: React.PointerEvent) => {
                    if (isArrowHoldingRef.current && (e.target as any).hasPointerCapture && (e.target as any).hasPointerCapture(e.pointerId)) {
                        // Do nothing if it captured
                    } else if (!isArrowHoldingRef.current) {
                        // Do nothing
                    } else {
                        handleArrowUp(e)
                    }
                }}
                onMouseDown={e => {
                    if (isRunning) e.stopPropagation();
                }}
            />
            <path
                d={d}
                fill="#7f8c8d"
                stroke="#2c3e50"
                strokeWidth={0.5}
                style={{ opacity: 0.6, pointerEvents: 'none' }}
            />
        </g>
    );

    return (
        <div style={{
            width: comp?.w ?? BOUNDS.w,
            height: comp?.h ?? BOUNDS.h,
            pointerEvents: 'none',
            position: 'relative'
        }}>
            <svg
                width="100%" height="100%"
                viewBox="0 0 60 60"
                style={{ display: 'block', overflow: 'visible', cursor: isRunning ? 'pointer' : 'default', touchAction: 'none' }}
                onMouseDown={e => isRunning && e.stopPropagation()}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onContextMenu={e => { if (isRunning) e.preventDefault(); }} // Prevent context menu if running
            >
            {/* Base */}
            <rect x={2} y={2} width={56} height={56} rx={8} fill="#2c3e50" stroke="#1a252f" strokeWidth={2} />
            <circle cx={30} cy={30} r={22} fill="#34495e" stroke="#2c3e50" strokeWidth={2} />

            {/* D-Pad Arrows with large hitboxes */}
            <Arrow d="M 26 14 L 30 8 L 34 14 Z" nx={0.5} ny={0.0} hx={18} hy={4} hw={24} hh={14} />
            <Arrow d="M 26 46 L 30 52 L 34 46 Z" nx={0.5} ny={1.0} hx={18} hy={42} hw={24} hh={14} />
            <Arrow d="M 14 26 L 8 30 L 14 34 Z" nx={0.0} ny={0.5} hx={4} hy={18} hw={14} hh={24} />
            <Arrow d="M 46 26 L 52 30 L 46 34 Z" nx={1.0} ny={0.5} hx={42} hy={18} hw={14} hh={24} />

            {/* Pins */}
            {[10, 20, 30, 40, 50].map((px, i) => (
                <g key={i}>
                    <line x1={px} y1={58} x2={px} y2={64} stroke="#f1c40f" strokeWidth={2} />
                    <circle cx={px} cy={64} r={1.5} fill="#f1c40f" />
                </g>
            ))}
            <text x={10} y={56} fontSize={4} fill="#ecf0f1" textAnchor="middle">GND</text>
            <text x={20} y={56} fontSize={4} fill="#ecf0f1" textAnchor="middle">5V</text>
            <text x={30} y={56} fontSize={4} fill="#ecf0f1" textAnchor="middle">VRX</text>
            <text x={40} y={56} fontSize={4} fill="#ecf0f1" textAnchor="middle">VRY</text>
            <text x={50} y={56} fontSize={4} fill="#ecf0f1" textAnchor="middle">SW</text>

            {/* Handle / Stick */}
            <circle
                ref={handleRef}
                cx={cx}
                cy={cy}
                r={14}
                fill={isPressed ? "#c0392b" : "#e74c3c"}
                stroke="#c0392b"
                strokeWidth={2}
                style={{
                    transition: (currentX === 0.5 && currentY === 0.5) ? 'all 0.15s ease-out' : 'none'
                }}
            />
            {/* Inner shading for the stick */}
            <circle cx={cx - 3} cy={cy - 3} r={4} fill="#ffffff" opacity={0.3} style={{ pointerEvents: 'none' }} />
        </svg>
    </div>
    );
};
