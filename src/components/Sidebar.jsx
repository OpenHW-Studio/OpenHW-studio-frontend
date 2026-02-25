import { useState } from 'react';

const COMPONENTS = [
    { id: 'arduino-uno', name: 'Arduino Uno', desc: 'Microcontroller board', icon: '🔲', color: '#dbeafe' },
    { id: 'led', name: 'LED', desc: 'Light emitting diode', icon: '💡', color: '#fef9c3' },
    { id: 'resistor', name: 'Resistor', desc: 'Current limiter', icon: '⏚', color: '#fce7f3' },
    { id: 'pushbutton', name: 'Pushbutton', desc: 'Momentary switch', icon: '◉', color: '#fee2e2' },
    { id: 'buzzer', name: 'Buzzer', desc: 'Audio output', icon: '🔊', color: '#ffedd5' },
    { id: 'servo', name: 'Servo Motor', desc: 'Positional actuator', icon: '⚙️', color: '#f3e8ff' },
    { id: 'potentiometer', name: 'Potentiometer', desc: 'Variable resistor', icon: '◎', color: '#ccfbf1' },
    { id: 'lcd', name: 'LCD Display', desc: '16×2 character display', icon: '▭', color: '#d1fae5' },
    { id: 'seven-seg', name: 'Seven Segment', desc: 'Numeric display', icon: '8', color: '#fee2e2' },
    { id: 'ultrasonic', name: 'Ultrasonic Sensor', desc: 'Distance sensor', icon: '〰️', color: '#cffafe' },
];

function Sidebar() {
    const [search, setSearch] = useState('');

    const filtered = COMPONENTS.filter(
        (c) =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.desc.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-title">Components</div>
                <div className="search-wrapper">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search components..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>
            <div className="component-list">
                {filtered.length > 0 ? (
                    filtered.map((comp) => (
                        <div key={comp.id} className="component-card" draggable>
                            <div
                                className="component-card-icon"
                                style={{ background: comp.color }}
                            >
                                {comp.icon}
                            </div>
                            <div className="component-card-info">
                                <span className="component-card-name">{comp.name}</span>
                                <span className="component-card-desc">{comp.desc}</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="no-results">
                        <span className="no-results-icon">🔍</span>
                        <span className="no-results-text">No components found</span>
                    </div>
                )}
            </div>
        </aside>
    );
}

export default Sidebar;
