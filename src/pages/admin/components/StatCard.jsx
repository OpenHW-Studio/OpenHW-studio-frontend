import React from 'react';

/**
 * StatCard — used in infrastructure tabs for large metric display.
 * Now uses admin.css token variables.
 */
const StatCard = ({ label, value, icon, color = 'blue' }) => {
    const colorMap = {
        'text-blue-500':    'blue',
        'text-emerald-500': 'emerald',
        'text-amber-500':   'amber',
        'text-purple-500':  'purple',
        'text-red-500':     'red',
        'text-cyan-500':    'cyan',
        blue: 'blue', emerald: 'emerald', amber: 'amber',
        purple: 'purple', red: 'red', cyan: 'cyan',
    };
    const resolvedColor = colorMap[color] || 'blue';

    return (
        <div className="ad-stat-card">
            <div className={`ad-stat-icon ${resolvedColor}`}>
                {icon}
            </div>
            <div>
                <div className="ad-stat-value">{value}</div>
                <div className="ad-stat-label" style={{ marginTop: 4 }}>{label}</div>
            </div>
        </div>
    );
};

export default StatCard;
