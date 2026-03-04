// Shift Register UI Placeholder
import * as React from 'react';

export const ShiftRegisterUI = (props: any) => {
    const { id, x, y, rotation, attrs } = props;

    return React.createElement('div', {
        style: {
            width: 60,
            height: 180,
            background: '#222',
            borderRadius: 4,
            border: '2px solid #444',
            position: 'relative',
            transform: `rotate(${rotation || 0}deg)`
        }
    }, [
        React.createElement('div', {
            style: {
                color: 'white',
                fontSize: 12,
                position: 'absolute',
                top: 90,
                left: -20,
                transform: 'rotate(-90deg)',
                whiteSpace: 'nowrap'
            },
            key: "label"
        }, '74HC595 Shift Register'),
        React.createElement('div', {
            style: {
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#666',
                position: 'absolute',
                top: 4,
                left: 27
            },
            key: "notch"
        })
    ]);
};
