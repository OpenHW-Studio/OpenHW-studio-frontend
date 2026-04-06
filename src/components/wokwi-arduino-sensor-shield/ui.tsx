import React from 'react';

export const SensorShieldUI = ({ state, attrs }: { state: any, attrs: any }) => {

    const renderColumn = (label: string, x: number, y: number) => {
        return (
            <g key={`col-${label}`}>
                <circle cx={x} cy={y} r="1.5" fill="#1e1e1e" />     {/* G */}
                <circle cx={x} cy={y + 10} r="1.5" fill="#e74c3c" />  {/* V */}
                <circle cx={x} cy={y + 20} r="1.5" fill="#f1c40f" />  {/* S */}
                <text x={x} y={y + 28} fontSize="4" fill="white" textAnchor="middle">{label}</text>
            </g>
        );
    };

    const renderBlock = (xBase: number, yBase: number, width: number, height: number, color = "#2c3e50") => {
        return <rect x={xBase} y={yBase} width={width} height={height} fill={color} rx="1" />;
    };

    return (
        <svg width="230" height="210" viewBox="0 0 230 210" xmlns="http://www.w3.org/2000/svg">
            <path d="M 0 0 L 230 0 L 230 50 L 215 65 L 215 195 A 15 15 0 0 1 200 210 L 0 210 Z" fill="#1f618d" />

            <circle cx="15" cy="15" r="5" fill="#fcfcfc" />
            <circle cx="215" cy="75" r="5" fill="#fcfcfc" />
            <circle cx="215" cy="195" r="5" fill="#fcfcfc" />

            {/* Top Pass-through Header (Uno Digital) */}
            {renderBlock(55, 5, 80, 10)}    {/* AREF to D8 block */}
            {renderBlock(145, 5, 80, 10)}   {/* D7 to D0 block */}
            {[60, 70, 80, 90, 100, 110, 120, 130].map(x => <circle key={`thd-${x}`} cx={x} cy={10} r="1.5" fill="#1e1e1e" />)}
            {[150, 160, 170, 180, 190, 200, 210, 220].map(x => <circle key={`thd-${x}`} cx={x} cy={10} r="1.5" fill="#1e1e1e" />)}
            <text x="60" y="20" fontSize="3" fill="white" textAnchor="middle">AREF</text>
            <text x="70" y="20" fontSize="3" fill="white" textAnchor="middle">GND</text>
            <text x="220" y="20" fontSize="3" fill="white" textAnchor="middle">0/RX</text>

            {/* Bottom Pass-through Header (Uno Power & Analog) */}
            {renderBlock(75, 195, 60, 10)}
            {[80, 90, 100, 110, 120, 130].map(x => <circle key={`bhd-p-${x}`} cx={x} cy={200} r="1.5" fill="#1e1e1e" />)}
            {renderBlock(145, 195, 60, 10)}
            {[150, 160, 170, 180, 190, 200].map(x => <circle key={`bhd-a-${x}`} cx={x} cy={200} r="1.5" fill="#1e1e1e" />)}

            <text x="12" y="32" fontSize="4" fill="white">Pin 13</text>
            <rect x="15" y="35" width="8" height="4" fill="#f1c40f" />
            <rect x="15" y="42" width="8" height="4" fill="#1e1e1e" />

            <text x="10" y="98" fontSize="8" fill="white" fontWeight="bold">Arduino Sensor Shield v5.0</text>
            <text x="10" y="112" fontSize="6" fill="white">V1.1</text>

            {/* Reset Button */}
            <text x="10" y="128" fontSize="5" fill="white">RESET</text>
            <rect x="10" y="132" width="20" height="20" fill="#bdc3c7" />
            <circle cx="20" cy="142" r="6" fill="#7f8c8d" />

            <text x="8" y="175" fontSize="4" fill="white" transform="rotate(-90 8 175)">SEL</text>
            <rect x="15" y="170" width="15" height="10" fill="#2c3e50" />

            <rect x="10" y="182" width="20" height="25" fill="#2980b9" />
            <rect x="10" y="184" width="15" height="21" fill="#bdc3c7" />

            <text x="5" y="200" fontSize="4" fill="white" transform="rotate(-90 5 200)">VCC</text>
            <text x="5" y="185" fontSize="4" fill="white" transform="rotate(-90 5 185)">GND</text>

            {/* Digital Sensor Array Blocks */}
            <g transform="translate(0, 50)">
                <text x="15" y="0" fontSize="4" fill="white">G</text>
                <text x="15" y="10" fontSize="4" fill="white">V</text>
                <text x="15" y="20" fontSize="4" fill="white">S</text>

                {renderBlock(25, -5, 40, 30)}
                {renderColumn('AREF', 30, 0)} {renderColumn('GND', 40, 0)} {renderColumn('13', 50, 0)} {renderColumn('12', 60, 0)}

                {renderBlock(75, -5, 40, 30)}
                {renderColumn('11', 80, 0)} {renderColumn('10', 90, 0)} {renderColumn('9', 100, 0)} {renderColumn('8', 110, 0)}

                {renderBlock(125, -5, 40, 30)}
                {renderColumn('7', 130, 0)} {renderColumn('6', 140, 0)} {renderColumn('5', 150, 0)} {renderColumn('4', 160, 0)}

                {renderBlock(175, -5, 40, 30)}
                {renderColumn('3', 180, 0)} {renderColumn('2', 190, 0)} {renderColumn('1', 200, 0)} {renderColumn('0', 210, 0)}
            </g>

            {/* Analog Sensor Array Blocks */}
            <g transform="translate(0, 110)">
                <text x="45" y="0" fontSize="4" fill="white">G</text>
                <text x="45" y="10" fontSize="4" fill="white">V</text>
                <text x="45" y="20" fontSize="4" fill="white">S</text>

                {renderBlock(55, -5, 60, 30)}
                {renderColumn('A0', 60, 0)} {renderColumn('A1', 70, 0)} {renderColumn('A2', 80, 0)}
                {renderColumn('A3', 90, 0)} {renderColumn('A4', 100, 0)} {renderColumn('A5', 110, 0)}
            </g>

            <text x="80" y="175" fontSize="4" fill="white" transform="rotate(-90 80 175)">RESET</text>
            <text x="90" y="175" fontSize="4" fill="white" transform="rotate(-90 90 175)">3V3</text>

            <text x="115" y="175" fontSize="5" fill="white" textAnchor="middle">POWER</text>
            <text x="100" y="185" fontSize="4" fill="white" textAnchor="middle">5V</text>
            <text x="110" y="185" fontSize="4" fill="white" textAnchor="middle">GND</text>
            <text x="120" y="185" fontSize="4" fill="white" textAnchor="middle">GND</text>
            <text x="130" y="185" fontSize="4" fill="white" textAnchor="middle">VIN</text>

            <text x="175" y="175" fontSize="5" fill="white" textAnchor="middle">ANALOG IN</text>
            <text x="150" y="185" fontSize="4" fill="white" textAnchor="middle">0</text>
            <text x="160" y="185" fontSize="4" fill="white" textAnchor="middle">1</text>
            <text x="170" y="185" fontSize="4" fill="white" textAnchor="middle">2</text>
            <text x="180" y="185" fontSize="4" fill="white" textAnchor="middle">3</text>
            <text x="190" y="185" fontSize="4" fill="white" textAnchor="middle">4</text>
            <text x="200" y="185" fontSize="4" fill="white" textAnchor="middle">5</text>
        </svg>
    );
};
