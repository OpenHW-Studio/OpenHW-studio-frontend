import React from 'react';

// Bounding box for the board UI.
export const BOUNDS = { x: 0, y: 0, w: 180, h: 50 };

export const ArduinoNanoUI = ({ state, attrs }: { state: any, attrs: any }) => {

    const topLabels = ['D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'GND', 'RST', 'RX0', 'TX1', 'PE1'];
    const botLabels = ['D13', '3V3', 'AREF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', '+5V', 'RST', 'GND', 'VIN', 'PE0'];

    return (
        <svg 
            width="100%" 
            height="100%" 
            viewBox="0 0 180 50" 
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: 'block' }}
        >
            {/* Main PCB */}
            <rect x="15" y="0" width="165" height="50" fill="#004d80" />

            {/* Left Edge Notches */}
            <circle cx="15" cy="5" r="3" fill="#fcfcfc" />
            <circle cx="15" cy="45" r="3" fill="#fcfcfc" />

            {/* Right Edge Notches */}
            <circle cx="180" cy="5" r="3" fill="#fcfcfc" />
            <circle cx="180" cy="45" r="3" fill="#fcfcfc" />

            {/* USB Type-C Socket */}
            <rect x="0" y="12" width="22" height="26" fill="#bdc3c7" rx="2" />
            <rect x="5" y="16" width="10" height="18" fill="#1e1e1e" rx="1" />
            <path d="M 22 17 L 25 17 L 25 33 L 22 33 Z" fill="#95a5a6" />

            {/* ATmega328P Central Chip (Rotated 45 degrees) */}
            <g transform="translate(75, 25) rotate(45)">
                <rect x="-10" y="-10" width="20" height="20" fill="#2c3e50" rx="1" />
                <circle cx="-6" cy="-6" r="1.5" fill="#1e1e1e" />
                {Array.from({ length: 8 }).map((_, i) => (
                    <rect key={`c1-${i}`} x={-11} y={-8 + i * 2.2} width="1" height="0.8" fill="#bdc3c7" />
                ))}
                {Array.from({ length: 8 }).map((_, i) => (
                    <rect key={`c2-${i}`} x={10} y={-8 + i * 2.2} width="1" height="0.8" fill="#bdc3c7" />
                ))}
                {Array.from({ length: 8 }).map((_, i) => (
                    <rect key={`c3-${i}`} y={-11} x={-8 + i * 2.2} height="1" width="0.8" fill="#bdc3c7" />
                ))}
                {Array.from({ length: 8 }).map((_, i) => (
                    <rect key={`c4-${i}`} y={10} x={-8 + i * 2.2} height="1" width="0.8" fill="#bdc3c7" />
                ))}
                <text x="0" y="2" fontSize="3" fill="#7f8c8d" textAnchor="middle" transform="rotate(-90)">MEGA328P</text>
            </g>

            {/* Sub-IC (CH340C / USB-Serial) */}
            <rect x="35" y="22" width="5" height="12" fill="#2c3e50" rx="0.5" />
            {Array.from({ length: 8 }).map((_, i) => (
                <rect key={`usb-${i}`} x={33} y={23 + i * 1.2} width="2" height="0.5" fill="#bdc3c7" />
            ))}
            {Array.from({ length: 8 }).map((_, i) => (
                <rect key={`usb2-${i}`} x={40} y={23 + i * 1.2} width="2" height="0.5" fill="#bdc3c7" />
            ))}

            {/* Reset Button */}
            <rect x="110" y="15" width="12" height="16" fill="#bdc3c7" rx="1" />
            <rect x="112" y="17" width="8" height="12" fill="#ecf0f1" rx="0.5" />
            <circle cx="116" cy="23" r="3" fill="#e74c3c" />
            <text x="107" y="28" fontSize="4" fill="white" transform="rotate(-90 107 28)">RESET</text>

            {/* LEDs (RX, TX, PWR, L) */}
            <rect x="135" y="14" width="4" height="2.5" fill="#f1c40f" />
            <rect x="135" y="20" width="4" height="2.5" fill="#f1c40f" />
            <rect x="135" y="26" width="4" height="2.5" fill="#2ecc71" />
            <rect x="135" y="32" width="4" height="2.5" fill="#3498db" />

            <text x="142" y="16.5" fontSize="3" fill="white">RX</text>
            <text x="142" y="22.5" fontSize="3" fill="white">TX</text>
            <text x="142" y="28.5" fontSize="3" fill="white">PWR</text>
            <text x="142" y="34.5" fontSize="3" fill="white">L</text>

            {/* Oscillators and standard SMT */}
            <rect x="90" y="10" width="10" height="4" fill="#95a5a6" rx="0.5" />
            <rect x="91" y="9" width="1" height="1" fill="#bdc3c7" />
            <rect x="98" y="9" width="1" height="1" fill="#bdc3c7" />

            {/* ICSP Header (3x2 right side) */}
            <circle cx="160" cy="18" r="1.5" fill="#fcfcfc" stroke="#bdc3c7" strokeWidth="0.5" />
            <circle cx="160" cy="24" r="1.5" fill="#fcfcfc" stroke="#bdc3c7" strokeWidth="0.5" />
            <circle cx="160" cy="30" r="1.5" fill="#fcfcfc" stroke="#bdc3c7" strokeWidth="0.5" />
            <circle cx="165" cy="18" r="1.5" fill="#fcfcfc" stroke="#bdc3c7" strokeWidth="0.5" />
            <circle cx="165" cy="24" r="1.5" fill="#fcfcfc" stroke="#bdc3c7" strokeWidth="0.5" />
            <circle cx="165" cy="30" r="1.5" fill="#fcfcfc" stroke="#bdc3c7" strokeWidth="0.5" />
            <rect x="156" y="29.5" width="2" height="1" fill="white" /> {/* Pin 1 indicator */}

            <text x="125" y="36" fontSize="5" fill="white" fontWeight="bold">Nano</text>
            <text x="95" y="38" fontSize="3" fill="white" fontWeight="bold">SDA SCL</text>

            {/* Top and Bottom Pin Arrays mapped from manifest */}
            {topLabels.map((lbl, i) => (
                <g key={`top-${i}`}>
                    <circle cx={20 + i * 10} cy={5} r="2.2" fill="#fcfcfc" />
                    <circle cx={20 + i * 10} cy={5} r="1.5" fill="#2c3e50" />
                    <text x={20 + i * 10} y={11} fontSize="3" fill="white" textAnchor="middle" fontWeight="bold">{lbl}</text>
                </g>
            ))}

            {botLabels.map((lbl, i) => (
                <g key={`bot-${i}`}>
                    <circle cx={20 + i * 10} cy={45} r="2.2" fill="#fcfcfc" />
                    <circle cx={20 + i * 10} cy={45} r="1.5" fill="#2c3e50" />
                    <text x={20 + i * 10} y={41} fontSize="3" fill="white" textAnchor="middle" fontWeight="bold">{lbl}</text>
                </g>
            ))}

        </svg>
    );
};
