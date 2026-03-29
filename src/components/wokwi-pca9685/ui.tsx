import React from 'react';

export const PCA9685UI = ({ state, attrs }: { state: any, attrs: any }) => {
    const topLabels = ['SDA', 'SCL', 'TXD', 'RXD', '#4', '#17', '#18', '#27', '#22', '#23', '#24', '#25', 'MOSI', 'MISO', 'CLK', 'CE0', 'CE1', '#5', '#6', '#12', '#13', '#16', '#19', '#20', '#21'];

    // Pi GPIO Header 2x25 grids for looks
    const topPins = [];
    topLabels.forEach((label, i) => {
        const cx = 10 + i * 6;
        topPins.push(<circle key={`t1-${i}`} cx={cx} cy={10} r="1.5" fill="#7f8c8d" />); // Top row (unmapped in manifest)
        topPins.push(<circle key={`t2-${i}`} cx={cx} cy={16} r="1.5" fill="#bdc3c7" />); // Bottom row (mapped)
        topPins.push(<text key={`tlbl-${i}`} x={cx} y={28} fontSize="3" fill="white" transform={`rotate(-90 ${cx} 28)`}>{label}</text>);
    });

    // Right-side Proto Area holes
    const protoHoles = [];
    for (let x = 148; x <= 172; x += 6) {
        for (let y = 35; y <= 119; y += 6) {
            protoHoles.push(<circle key={`p-${x}-${y}`} cx={x} cy={y} r="1.5" fill="#7f8c8d" />);
        }
    }

    // PWM Pin Grids (4 blocks of 4x3)
    const pwmBlocks = [];
    const blockOffsets = [23, 55, 87, 119];

    blockOffsets.forEach((bx, bIdx) => {
        // Black housing base
        pwmBlocks.push(<rect key={`box-${bIdx}`} x={bx} y={125} width={26} height={20} fill="#2c3e50" rx="2" stroke="#ecf0f1" strokeWidth="0.2" />);

        for (let c = 0; c < 4; c++) {
            const px = bx + 3 + c * 6;

            // Labels on top of block
            pwmBlocks.push(<text key={`lbl-${bIdx}-${c}`} x={px} y={123} fontSize="3" fill="white" textAnchor="middle">{bIdx * 4 + c}</text>);

            // S (Yellow trace indication), V+ (Red), G (Black)
            pwmBlocks.push(<circle key={`s-${bIdx}-${c}`} cx={px} cy={129} r="1.5" fill="#ecf0f1" />);
            pwmBlocks.push(<circle key={`v-${bIdx}-${c}`} cx={px} cy={135} r="1.5" fill="#e74c3c" />);
            pwmBlocks.push(<circle key={`g-${bIdx}-${c}`} cx={px} cy={141} r="1.5" fill="#bdc3c7" />);
        }
    });

    return (
        <svg width="180" height="150" viewBox="0 0 180 150" xmlns="http://www.w3.org/2000/svg">
            {/* Raspberry Pi HAT Board Outline */}
            <path d="M 15 0 L 165 0 A 15 15 0 0 1 180 15 L 180 135 A 15 15 0 0 1 165 150 L 15 150 A 15 15 0 0 1 0 135 L 0 100 A 4 4 0 0 0 10 96 L 10 64 A 4 4 0 0 0 0 60 L 0 15 A 15 15 0 0 1 15 0 Z" fill="#144f9c" />

            {/* Mounting Holes */}
            <circle cx="10" cy="15" r="4" fill="#fcfcfc" />
            <circle cx="170" cy="15" r="4" fill="#fcfcfc" />
            <circle cx="10" cy="135" r="4" fill="#fcfcfc" />
            <circle cx="170" cy="135" r="4" fill="#fcfcfc" />

            {/* Top GPIO Header footprint */}
            {topPins}

            {/* Proto Area */}
            {protoHoles}
            <text x="142" y="36.5" fontSize="3" fill="white" textAnchor="end">5.0V</text>
            <text x="142" y="48.5" fontSize="3" fill="white" textAnchor="end">3.3V</text>
            <text x="142" y="60.5" fontSize="3" fill="white" textAnchor="end">GND</text>

            {/* Power Input Barrel Connector Base & Pads */}
            <rect x="25" y="44" width="6" height="6" fill="#bdc3c7" />
            <rect x="42" y="44" width="6" height="6" fill="#bdc3c7" />
            <rect x="25" y="70" width="6" height="6" fill="#bdc3c7" />
            <rect x="13" y="50" width="37" height="20" fill="#1e1e1e" rx="1" />
            <rect x="10" y="53" width="6" height="14" fill="#111111" rx="0.5" />

            {/* Blue Terminal Block */}
            <rect x="12" y="78" width="20" height="20" fill="#2980b9" rx="1" />
            <rect x="14" y="80" width="16" height="16" fill="#035e9c" />
            {/* Screw heads */}
            <circle cx="21" cy="85" r="3" fill="#95a5a6" />
            <line x1="19" y1="85" x2="23" y2="85" stroke="#7f8c8d" strokeWidth="1" />
            <line x1="21" y1="83" x2="21" y2="87" stroke="#7f8c8d" strokeWidth="1" />
            <circle cx="21" cy="93" r="3" fill="#95a5a6" />
            <line x1="19" y1="93" x2="23" y2="93" stroke="#7f8c8d" strokeWidth="1" />
            <line x1="21" y1="91" x2="21" y2="95" stroke="#7f8c8d" strokeWidth="1" />
            <text x="35" y="86" fontSize="5" fill="white">GND</text>
            <text x="35" y="95" fontSize="5" fill="white">+5</text>

            {/* Capacitor C2 */}
            <circle cx="85" cy="65" r="10" fill="none" stroke="white" strokeWidth="0.8" />
            <circle cx="85" cy="65" r="9" fill="#1e1e1e" />
            <text x="85" y="66" fontSize="4" fill="white" textAnchor="middle">C2</text>
            <text x="80" y="74" fontSize="4" fill="white" textAnchor="middle">+</text>

            {/* PCA9685 Central IC */}
            <text x="85" y="81" fontSize="4" fill="white" textAnchor="middle">PCA9685</text>
            <rect x="79" y="83" width="12" height="24" fill="#2c3e50" rx="1" />
            <circle cx="81" cy="85" r="1" fill="#1e1e1e" />

            {/* SMT pins on chip */}
            {Array.from({ length: 12 }).map((_, i) => (
                <rect key={`chipL-${i}`} x="75" y={84 + i * 1.8} width="4" height="0.8" fill="#bdc3c7" />
            ))}
            {Array.from({ length: 12 }).map((_, i) => (
                <rect key={`chipR-${i}`} x="91" y={84 + i * 1.8} width="4" height="0.8" fill="#bdc3c7" />
            ))}

            {/* Power LED */}
            <rect x="21" y="105" width="2" height="4" fill="#2c3e50" />
            <rect x="21" y="110" width="3" height="4" fill="#2ecc71" style={{ filter: 'drop-shadow(0px 0px 1px #2ecc71)' }} />
            <text x="21" y="116" fontSize="3" fill="white" transform="rotate(-90 21 116)">POWER</text>
            <text x="13" y="125" fontSize="3" fill="white">adafruit!</text>

            {/* Some SMT bits */}
            <rect x="58" y="50" width="18" height="14" fill="#34495e" /> {/* Regulator */}
            <rect x="61" y="64" width="2" height="6" fill="#bdc3c7" />
            <rect x="71" y="64" width="2" height="6" fill="#bdc3c7" />
            <rect x="60" y="70" width="3" height="6" fill="#2c3e50" />
            <rect x="68" y="70" width="3" height="6" fill="#2c3e50" />

            {/* I2C Address jumpers */}
            <text x="110" y="61" fontSize="3" fill="white" textAnchor="middle">I2C Address</text>
            <rect x="98" y="63" width="5" height="8" fill="none" stroke="white" strokeWidth="0.5" />
            <rect x="104" y="63" width="5" height="8" fill="none" stroke="white" strokeWidth="0.5" />
            <rect x="110" y="63" width="5" height="8" fill="none" stroke="white" strokeWidth="0.5" />
            <rect x="116" y="63" width="5" height="8" fill="none" stroke="white" strokeWidth="0.5" />
            <rect x="122" y="63" width="5" height="8" fill="none" stroke="white" strokeWidth="0.5" />
            <rect x="128" y="63" width="5" height="8" fill="none" stroke="white" strokeWidth="0.5" />

            <rect x="99" y="64" width="3" height="3" fill="#d4af37" />
            <rect x="105" y="64" width="3" height="3" fill="#d4af37" />
            <rect x="111" y="64" width="3" height="3" fill="#d4af37" />
            <rect x="117" y="64" width="3" height="3" fill="#d4af37" />
            <rect x="123" y="64" width="3" height="3" fill="#d4af37" />
            <rect x="129" y="64" width="3" height="3" fill="#d4af37" />

            <text x="98.5" y="74" fontSize="3" fill="white">A5</text>
            <text x="104.5" y="74" fontSize="3" fill="white">A4</text>
            <text x="110.5" y="74" fontSize="3" fill="white">A3</text>
            <text x="116.5" y="74" fontSize="3" fill="white">A2</text>
            <text x="122.5" y="74" fontSize="3" fill="white">A1</text>
            <text x="128.5" y="74" fontSize="3" fill="white">A0</text>

            <text x="115" y="85" fontSize="3" fill="white" textAnchor="middle">Open=0/Closed=1</text>

            {/* Text & Graphics */}
            <text x="35" y="42" fontSize="6" fill="white">5-6VDC</text>
            <text x="45" y="105" fontSize="4" fill="white">16 x 12-bit PWM</text>
            <text x="50" y="112" fontSize="6" fill="white">Servo/PWM Pi HAT!</text>

            <circle cx="85" cy="116" r="3.5" fill="none" stroke="white" strokeWidth="0.8" />
            <text x="85" y="118" fontSize="5" fill="white" textAnchor="middle" fontWeight="bold">A</text>

            {/* Row labels near PWM blocks */}
            <text x="85" y="130" fontSize="4" fill="white" textAnchor="middle">S</text>
            <text x="85" y="136" fontSize="4" fill="white" textAnchor="middle">V+</text>
            <text x="85" y="142" fontSize="4" fill="white" textAnchor="middle">G</text>

            {/* PWM Headers Arrays */}
            {pwmBlocks}

        </svg>
    );
};
