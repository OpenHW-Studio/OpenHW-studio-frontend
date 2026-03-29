import React from 'react';

export const PCA9865UI = ({ state, attrs }: { state: any, attrs: any }) => {

    // PWM Pin Grids (4 blocks of 4x3)
    const pwmBlocks = [];
    const blockOffsets = [23, 55, 87, 119];

    blockOffsets.forEach((bx, bIdx) => {
        for (let c = 0; c < 4; c++) {
            const px = bx + 3 + c * 6;

            // Channel Number Label
            pwmBlocks.push(<text key={`lbl-${bIdx}-${c}`} x={px} y={58} fontSize="4" fill="white" textAnchor="middle">{bIdx * 4 + c}</text>);

            // Plastic bases
            pwmBlocks.push(<rect key={`boxY-${bIdx}-${c}`} x={px - 2.5} y={59.5} width={5} height={5} fill="#f1c40f" rx="0.5" />);
            pwmBlocks.push(<rect key={`boxR-${bIdx}-${c}`} x={px - 2.5} y={65.5} width={5} height={5} fill="#e74c3c" rx="0.5" />);
            pwmBlocks.push(<rect key={`boxB-${bIdx}-${c}`} x={px - 2.5} y={71.5} width={5} height={5} fill="#2c3e50" rx="0.5" />);

            // Pin holes
            pwmBlocks.push(<circle key={`s-${bIdx}-${c}`} cx={px} cy={62} r="1" fill="#7f8c8d" />);
            pwmBlocks.push(<circle key={`v-${bIdx}-${c}`} cx={px} cy={68} r="1" fill="#7f8c8d" />);
            pwmBlocks.push(<circle key={`g-${bIdx}-${c}`} cx={px} cy={74} r="1" fill="#7f8c8d" />);
        }
    });

    const sideLabels = ['GND', 'OE', 'SCL', 'SDA', 'VCC', 'V+'];

    return (
        <svg width="160" height="80" viewBox="0 0 160 80" xmlns="http://www.w3.org/2000/svg">
            {/* PCB Outline */}
            <rect x="10" y="5" width="140" height="70" fill="#144f9c" rx="4" />

            {/* Left Header Pins sticking out */}
            {sideLabels.map((l, i) => (
                <g key={`L-${l}`}>
                    <line x1="0" y1={15 + i * 7} x2="12" y2={15 + i * 7} stroke="#bdc3c7" strokeWidth="1" />
                    <rect x="9" y={13.5 + i * 7} width="3" height="3" fill="#2c3e50" />
                    <text x="14" y={16.5 + i * 7} fontSize="4" fill="white">{l}</text>
                </g>
            ))}

            {/* Right Header Pins */}
            {sideLabels.map((l, i) => (
                <g key={`R-${l}`}>
                    <circle cx="145" cy={15 + i * 7} r="1.5" fill="#fcfcfc" stroke="#bdc3c7" strokeWidth="0.5" />
                    <text x="142" y={16.5 + i * 7} fontSize="4" fill="white" textAnchor="end">{l}</text>
                </g>
            ))}

            {/* Mounting Holes */}
            <circle cx="15" cy="10" r="2.5" fill="#fcfcfc" />
            <circle cx="145" cy="10" r="2.5" fill="#fcfcfc" />
            <circle cx="15" cy="70" r="2.5" fill="#fcfcfc" />
            <circle cx="145" cy="70" r="2.5" fill="#fcfcfc" />

            {/* Huge Capacitor C1 */}
            <circle cx="45" cy="20" r="8" fill="#bdc3c7" stroke="black" strokeWidth="1" />
            <path d="M 45 12 A 8 8 0 0 0 37 20 Z" fill="#2c3e50" />

            {/* PCA9685 Central IC */}
            <rect x="85" y="25" width="10" height="20" fill="#2c3e50" rx="0.5" />
            {Array.from({ length: 12 }).map((_, i) => (
                <rect key={`chipL-${i}`} x="82" y={26 + i * 1.6} width="3" height="0.8" fill="#bdc3c7" />
            ))}
            {Array.from({ length: 12 }).map((_, i) => (
                <rect key={`chipR-${i}`} x="95" y={26 + i * 1.6} width="3" height="0.8" fill="#bdc3c7" />
            ))}

            {/* Green Terminal Block */}
            <rect x="91" y="5" width="18" height="15" fill="#27ae60" rx="1" />
            <circle cx="95" cy="12" r="2.5" fill="#95a5a6" />
            <line x1="93" y1="12" x2="97" y2="12" stroke="#7f8c8d" strokeWidth="1" />
            <circle cx="105" cy="12" r="2.5" fill="#95a5a6" />
            <line x1="103" y1="12" x2="107" y2="12" stroke="#7f8c8d" strokeWidth="1" />
            <text x="89" y="14" fontSize="4" fill="white" textAnchor="end">V+</text>
            <text x="111" y="14" fontSize="4" fill="white">GND</text>

            {/* Some SMT Bits */}
            {/* resistors/caps cluster */}
            <rect x="62" y="18" width="6" height="8" fill="#ecf0f1" />
            <rect x="63" y="20" width="4" height="4" fill="#2c3e50" />
            <text x="60" y="15" fontSize="4" fill="white" textAnchor="middle">POWER</text>

            <text x="60" y="32" fontSize="5" fill="white" textAnchor="middle">PCA9685</text>
            <text x="60" y="38" fontSize="4" fill="white" textAnchor="middle">16 x 12-bit PWM</text>
            <text x="65" y="10" fontSize="4" fill="white" textAnchor="middle">duinofun!</text>

            {/* SMT Resistors for PWM outputs */}
            {Array.from({ length: 8 }).map((_, i) => (
                <g key={`r1-${i}`}>
                    <rect x={32 + i * 7} y="40" width="3" height="5" fill="#1e1e1e" />
                    <rect x={32 + i * 7} y="39" width="3" height="1" fill="#bdc3c7" />
                    <rect x={32 + i * 7} y="45" width="3" height="1" fill="#bdc3c7" />
                </g>
            ))}

            {/* I2C Jumper blocks */}
            <text x="125" y="30" fontSize="4" fill="white" textAnchor="middle">I2C Address</text>
            <text x="125" y="35" fontSize="3" fill="white" textAnchor="middle">(Open=0/Closed=1)</text>

            {/* PWM Blocks */}
            <text x="100" y="58" fontSize="4" fill="white">PWM</text>
            <text x="100" y="65" fontSize="4" fill="white">V+</text>
            <text x="100" y="72" fontSize="4" fill="white">GND</text>
            {pwmBlocks}

        </svg>
    );
};
