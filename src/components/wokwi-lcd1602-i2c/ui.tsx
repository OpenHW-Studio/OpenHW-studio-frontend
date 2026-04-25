import React, { useEffect, useRef } from 'react';

export const BOUNDS = { x: 0, y: 0, w: 300, h: 133 };

export const Lcd1602I2CUI = ({ state, attrs }: { state: any, attrs: any }) => {
    const lcdRef = useRef<any>(null);

    useEffect(() => {
        if (lcdRef.current && state) {
            // Apply text lines logic for 2 lines, 16 characters each.
            const lines = state.lines || ["", ""];

            lcdRef.current.text =
                (lines[0] || "").padEnd(16, " ") +
                (lines[1] || "").padEnd(16, " ");

            lcdRef.current.backlight = state.illuminated !== false;
        }
    }, [state]);

    return (
        <div style={{ position: 'relative', width: 280, height: 110, pointerEvents: 'none' }}>
            <wokwi-lcd1602
                ref={lcdRef}
                pins="i2c"
                color={attrs?.color || 'blue'}
                style={{ pointerEvents: 'none', width: '100%', height: '100%' }}
                {...attrs}
            />
        </div>
    );
};
