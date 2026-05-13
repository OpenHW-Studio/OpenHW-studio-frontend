import React, { useEffect, useRef } from 'react';

const PLOTTER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c'];
const TRACK_HEIGHT = 80;

const PlotterCanvas = React.memo(({ 
  plotDataRef, 
  selectedPlotPins, 
  plotterPaused, 
  plotterTimeDiv, 
  theme,
  isRunning
}) => {
  const canvasRef = useRef(null);
  const requestRef = useRef();

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    if (selectedPlotPins.length === 0) return;

    const now = Date.now();
    const timeWindow = plotterTimeDiv; 
    const startTime = now - timeWindow;

    // Read from Ref directly
    const plotData = plotDataRef?.current || [];
    
    // We need to find the "initial state" for each channel (the last point before startTime)
    // and then all points within the window.
    
    const trackHeight = TRACK_HEIGHT;
    const getX = (time) => ((time - startTime) / timeWindow) * width;

    selectedPlotPins.forEach((chan, i) => {
      const trackTop = i * trackHeight;
      const trackBottom = trackTop + trackHeight;
      const trackMid = trackTop + trackHeight / 2;
      const trackHighY = trackTop + (trackHeight * 0.15);
      const trackLowY = trackBottom - (trackHeight * 0.15);
      
      const color = PLOTTER_COLORS[i % PLOTTER_COLORS.length];
      const isAnalog = chan.pinId.startsWith('A');
      const isLogic = !isNaN(parseInt(chan.pinId));
      const isSerial = !isAnalog && !isLogic;

      // --- Draw Lane Background/Dividers ---
      const isLightTheme = theme === 'light';
      const gridColor = isLightTheme ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
      const dividerColor = isLightTheme ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)';
      const midLineColor = isLightTheme ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)';

      if (i % 2 === 1) {
        ctx.fillStyle = isLightTheme ? 'rgba(0,0,0,0.01)' : 'rgba(255,255,255,0.015)';
        ctx.fillRect(0, trackTop, width, trackHeight);
      }
      
      ctx.strokeStyle = midLineColor;
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(0, trackMid); ctx.lineTo(width, trackMid); ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      const verticalLineCount = 10;
      const stepPx = width / verticalLineCount;
      for (let gi = 0; gi <= verticalLineCount; gi++) {
        const gx = gi * stepPx;
        ctx.beginPath(); ctx.moveTo(gx, trackTop); ctx.lineTo(gx, trackBottom); ctx.stroke();
      }

      ctx.strokeStyle = dividerColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, trackBottom); ctx.lineTo(width, trackBottom); ctx.stroke();
      if (i === 0) {
        ctx.beginPath(); ctx.moveTo(0, trackTop); ctx.lineTo(width, trackTop); ctx.stroke();
      }

      // --- Data Processing for this Channel ---
      const channelAllData = plotData.filter(pt => pt.boardId === chan.boardId);
      if (channelAllData.length === 0) return;

      // Find the last point BEFORE the window starts to have a continuous line from the left edge
      let lastPointBefore = null;
      const windowPoints = [];
      
      for (let j = channelAllData.length - 1; j >= 0; j--) {
        const pt = channelAllData[j];
        if (pt.time < startTime) {
          lastPointBefore = pt;
          break;
        }
        if (pt.time >= startTime && pt.time <= now) {
          windowPoints.unshift(pt);
        }
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      let lastY = null;

      const drawPoint = (time, value, isStep = false) => {
        const x = Math.max(0, getX(time));
        const y = isAnalog 
          ? trackLowY - (value / 1023) * (trackLowY - trackHighY)
          : (isLogic ? (value ? trackHighY : trackLowY) : trackLowY - ((value - sMin) / (sMax - sMin)) * (trackLowY - trackHighY));

        if (!started) {
          ctx.moveTo(0, y); // Start at left edge
          started = true;
        } else {
          if (isStep && lastY !== null) {
            ctx.lineTo(x, lastY); // Vertical step
          }
          ctx.lineTo(x, y);
        }
        lastY = y;
      };

      if (isAnalog) {
        const pinIdx = parseInt(chan.pinId.slice(1));
        if (lastPointBefore && lastPointBefore.analog?.[pinIdx] !== undefined) {
          drawPoint(startTime, lastPointBefore.analog[pinIdx]);
        }
        windowPoints.forEach(pt => {
          const v = pt.analog?.[pinIdx];
          if (v !== undefined) drawPoint(pt.time, v);
        });
        if (lastY !== null) ctx.lineTo(width, lastY); // Extend to right edge
      } else if (isLogic) {
        if (lastPointBefore && lastPointBefore.pins?.[chan.pinId] !== undefined) {
          drawPoint(startTime, lastPointBefore.pins[chan.pinId], true);
        }
        windowPoints.forEach(pt => {
          const v = pt.pins?.[chan.pinId];
          if (v !== undefined) drawPoint(pt.time, v, true);
        });
        if (lastY !== null) ctx.lineTo(width, lastY); // Extend to right edge
      } else if (isSerial) {
        // Find serial min/max for scaling
        let sMin = 0, sMax = 1, found = false;
        const allRelevant = lastPointBefore ? [lastPointBefore, ...windowPoints] : windowPoints;
        allRelevant.forEach(pt => {
          const v = pt.serialVars?.[chan.pinId];
          if (v !== undefined) {
            if (!found) { sMin = v; sMax = v; found = true; }
            else { sMin = Math.min(sMin, v); sMax = Math.max(sMax, v); }
          }
        });
        if (sMin === sMax) { sMin -= 1; sMax += 1; }

        if (lastPointBefore && lastPointBefore.serialVars?.[chan.pinId] !== undefined) {
          const v = lastPointBefore.serialVars[chan.pinId];
          const y = trackLowY - ((v - sMin) / (sMax - sMin)) * (trackLowY - trackHighY);
          ctx.moveTo(0, y);
          started = true;
          lastY = y;
        }
        windowPoints.forEach(pt => {
          const v = pt.serialVars?.[chan.pinId];
          if (v !== undefined) {
            const x = getX(pt.time);
            const y = trackLowY - ((v - sMin) / (sMax - sMin)) * (trackLowY - trackHighY);
            if (!started) { ctx.moveTo(0, y); started = true; }
            else ctx.lineTo(x, y);
            lastY = y;
          }
        });
        if (lastY !== null) ctx.lineTo(width, lastY); // Extend to right edge
      }
      ctx.stroke();
    });
  };

  const animate = () => {
    if (!plotterPaused && isRunning) {
      draw();
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [selectedPlotPins, plotterPaused, plotterTimeDiv, theme, isRunning]);

  const canvasHeight = selectedPlotPins.length > 0 ? (selectedPlotPins.length * TRACK_HEIGHT) : 600;

  return (
    <div style={{ flex: 1, position: 'relative', background: theme === 'light' ? '#f8fafc' : '#070b14', overflowY: 'auto' }}>
      <canvas
        ref={canvasRef}
        width={800}
        height={canvasHeight}
        style={{ 
          display: 'block', 
          width: '100%', 
          height: canvasHeight,
          background: 'transparent'
        }}
      />
      {(!isRunning || !plotDataRef?.current || (plotDataRef?.current?.length === 0)) && (
        <div style={{ 
          position: 'absolute', 
          inset: 0, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: 'var(--text3)', 
          gap: 12, 
          fontSize: 13,
          background: 'rgba(0,0,0,0.02)',
          pointerEvents: 'none',
          zIndex: 5
        }}>
          <span style={{ fontSize: 32 }}>📈</span>
          {isRunning ? 'Waiting for data...' : 'Run simulator to trace signals.'}
        </div>
      )}
    </div>
  );
});

export default PlotterCanvas;
