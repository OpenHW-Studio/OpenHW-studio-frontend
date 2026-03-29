import React from 'react';

export const SoilMoistureSensorUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const moisture = state?.moisture ?? 50;

    // Generate grid of vias for the prongs
    const renderVias = (startY: number) => {
        const vias = [];
        for (let x = 75; x <= 150; x += 15) {
            for (let y = startY; y <= startY + 12; y += 6) {
                vias.push(<circle key={`via-${x}-${y}`} cx={x} cy={y} r="1.5" fill="#7d7c67" />);
            }
        }
        return vias;
    };

    return (
        <svg width="180" height="60" viewBox="0 0 180 60" xmlns="http://www.w3.org/2000/svg">
            {/* Prongs (gold/greenish coating) */}
            <path d="M 70 5 L 160 5 L 180 15 L 160 25 L 70 25 Z" fill="#9fa08e" />
            <path d="M 70 35 L 160 35 L 180 45 L 160 55 L 70 55 Z" fill="#9fa08e" />

            {/* Vias */}
            {renderVias(9)}
            {renderVias(39)}

            {/* PCB Base (light blue/white) */}
            <path d="M 15 5 L 45 5 C 60 5, 55 25, 70 25 L 70 35 C 55 35, 60 55, 45 55 L 15 55 Z" fill="#e2effa" stroke="#bdc3c7" strokeWidth="0.5" />

            {/* Mounting holes */}
            <circle cx="23" cy="12" r="5" fill="#fcfcfc" stroke="#bdc3c7" strokeWidth="0.5" />
            <circle cx="23" cy="48" r="5" fill="#fcfcfc" stroke="#bdc3c7" strokeWidth="0.5" />

            {/* SMT Components */}
            <rect x="42" y="15" width="2" height="4" fill="#2c3e50" />
            <rect x="42" y="15" width="0.5" height="4" fill="#ecf0f1" />
            <rect x="45" y="24" width="3" height="2" fill="#2c3e50" />

            {/* Main IC */}
            <rect x="48" y="30" width="3" height="10" fill="#2c3e50" />
            <rect x="45" y="44" width="3" height="2" fill="#2c3e50" />

            {/* Power text */}
            <g transform="translate(42, 26) rotate(-90)">
                <text x="0" y="0" fontSize="4" fill="#3498db">+ Power</text>
            </g>

            {/* Gold connector pins */}
            <line x1="0" y1="20" x2="16" y2="20" stroke="#f1c40f" strokeWidth="2.5" />
            <line x1="0" y1="30" x2="16" y2="30" stroke="#f1c40f" strokeWidth="2.5" />
            <line x1="0" y1="40" x2="16" y2="40" stroke="#f1c40f" strokeWidth="2.5" />

            {/* Pin snap ends */}
            <circle cx="0" cy="20" r="1.5" fill="#7f8c8d" />
            <circle cx="0" cy="30" r="1.5" fill="#7f8c8d" />
            <circle cx="0" cy="40" r="1.5" fill="#7f8c8d" />

            {/* Black header plastic */}
            <rect x="15" y="16.5" width="6" height="27" fill="#2c3e50" rx="1" />

            {/* Blue logic labels box */}
            <g transform="translate(15, 14)">
                <rect x="6" y="2" width="14" height="28" fill="none" stroke="#3498db" strokeWidth="0.8" />
                <line x1="6" y1="11.3" x2="20" y2="11.3" stroke="#3498db" strokeWidth="0.8" />
                <line x1="6" y1="20.6" x2="20" y2="20.6" stroke="#3498db" strokeWidth="0.8" />
                <line x1="13" y1="2" x2="13" y2="30" stroke="#3498db" strokeWidth="0.8" />

                {/* Labels */}
                <text x="16.5" y="8.5" fontSize="6" fill="#3498db" textAnchor="middle">-</text>
                <text x="16.5" y="18" fontSize="6" fill="#3498db" textAnchor="middle">+</text>
                <text x="16.5" y="27.5" fontSize="6" fill="#3498db" textAnchor="middle">S</text>
            </g>

            {/* Moisture Overlay text */}
            <text x="60" y="32" fontSize="5" fill="#e74c3c" fontWeight="bold">MOISTURE: {moisture}%</text>

        </svg>
    );
};
