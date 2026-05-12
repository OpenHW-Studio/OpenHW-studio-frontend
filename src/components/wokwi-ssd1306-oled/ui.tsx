import React, { useEffect, useRef } from 'react';

// Bounding box for the selection ring
export const BOUNDS = { x: 0, y: 0, w: 150, h: 140 };

export const SSD1306UI = ({ state, attrs }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const imageDataRef = useRef<ImageData | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Pre-allocate ImageData to avoid GC pressure
    imageDataRef.current = ctx.createImageData(128, 64);
    const imgData = imageDataRef.current;

    // Fill with background color initially
    for (let i = 0; i < imgData.data.length; i += 4) {
      imgData.data[i] = 34;
      imgData.data[i + 1] = 34;
      imgData.data[i + 2] = 34;
      imgData.data[i + 3] = 255;
    }

    let animationId: number;

    const render = () => {
      const currentState = stateRef.current;
      if (currentState && currentState.vram && currentState.displayOn) {
        const { vram, invert, allOn, displayStartLine, segmentRemap, comScanDir, displayOffset } = currentState;

        for (let page = 0; page < 8; page++) {
          for (let col = 0; col < 128; col++) {
            const vramIndex = (page * 128) + col;
            const byte = vram[vramIndex];

            for (let bit = 0; bit < 8; bit++) {
              let isOn = (byte >> bit) & 1;
              if (allOn) isOn = 1;
              if (invert) isOn = isOn ? 0 : 1;

              // Physical coordinate mapping: Standard modules are 180-rotated by default
              let x = segmentRemap ? col : (127 - col);
              let y = (page * 8) + bit;

              // Apply Display Start Line and Offset
              y = (y - displayStartLine + 64) % 64;

              // COM Scan Direction: Invert logic so library 'Correction' (C8) is upright
              if (!comScanDir) y = 63 - y;

              // Apply Display Offset (Vertical Shift)
              y = (y + displayOffset) % 64;

              const pixelIndex = (y * 128 + x) * 4;

              const r = isOn ? 200 : 34;
              const g = isOn ? 243 : 34;
              const b = isOn ? 255 : 34;

              imgData.data[pixelIndex] = r;
              imgData.data[pixelIndex + 1] = g;
              imgData.data[pixelIndex + 2] = b;
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
      } else if (currentState && !currentState.displayOn) {
        // Clear screen if display is OFF
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, 128, 64);
      }
      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 150 140" 
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
    >
      <path d="M 0,0 H 150 V 140 H 105 A 5,5 0 0,1 100,135 V 125 H 50 V 135 A 5,5 0 0,1 45,140 H 0 Z" fill="#104271" />

      {/* Mounting holes */}
      <circle cx="15" cy="15" r="6.5" fill="#FFFFFF" />
      <circle cx="135" cy="15" r="6.5" fill="#FFFFFF" />
      <circle cx="15" cy="115" r="6.5" fill="#FFFFFF" />
      <circle cx="135" cy="115" r="6.5" fill="#FFFFFF" />

      {/* I2C Header Plastic */}
      <rect x="42" y="5" width="66" height="20" fill="#222" rx="2" />

      {/* Pins */}
      <circle cx="50" cy="15" r="4.5" stroke="#E5B85C" strokeWidth="2.5" fill="#FFFFFF" />
      <circle cx="67" cy="15" r="4.5" stroke="#E5B85C" strokeWidth="2.5" fill="#FFFFFF" />
      <circle cx="84" cy="15" r="4.5" stroke="#E5B85C" strokeWidth="2.5" fill="#FFFFFF" />
      <circle cx="101" cy="15" r="4.5" stroke="#E5B85C" strokeWidth="2.5" fill="#FFFFFF" />

      <text x="43" y="32" fill="#FFFFFF" fontSize="6" fontFamily="Arial, sans-serif" fontWeight="bold">GND</text>
      <text x="61" y="32" fill="#FFFFFF" fontSize="6" fontFamily="Arial, sans-serif" fontWeight="bold">VCC</text>
      <text x="79" y="32" fill="#FFFFFF" fontSize="6" fontFamily="Arial, sans-serif" fontWeight="bold">SCL</text>
      <text x="96" y="32" fill="#FFFFFF" fontSize="6" fontFamily="Arial, sans-serif" fontWeight="bold">SDA</text>

      {/* Screen area */}
      <rect x="10" y="35" width="130" height="75" fill="#050505" rx="2" />
      <rect x="11" y="36" width="128" height="73" fill="#111" rx="1" />

      <foreignObject x="11" y="40.5" width="128" height="64">
        <canvas
          ref={canvasRef}
          width="128"
          height="64"
          style={{ width: '128px', height: '64px', imageRendering: 'pixelated', pointerEvents: 'none' }}
        />
      </foreignObject>

      <text x="75" y="130" fill="#FFFFFF" fontSize="8" textAnchor="middle" opacity="0.5">SSD1306 OLED</text>
    </svg>
  );
};
