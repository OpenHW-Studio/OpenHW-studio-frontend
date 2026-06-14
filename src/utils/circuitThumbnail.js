const THUMB_W = 320;
const THUMB_H = 180;
const PAD = 12;

const BOARD_COLORS = {
  arduino_uno: '#00979c',
  'esp-32': '#e7352c',
  pico: '#d8236b',
};

const COMP_COLORS = {
  resistor: '#f59e0b',
  led: '#ef4444',
  capacitor: '#3b82f6',
  diode: '#8b5cf6',
  transistor: '#10b981',
  ic: '#6366f1',
  sensor: '#f97316',
  motor: '#ec4899',
  buzzer: '#14b8a6',
  switch: '#78716c',
  button: '#78716c',
  potentiometer: '#a3a3a3',
  breadboard: '#e2e8f0',
};

function getCompColor(type) {
  if (!type) return '#94a3b8';
  const key = Object.keys(COMP_COLORS).find(k => type.toLowerCase().includes(k));
  return key ? COMP_COLORS[key] : '#94a3b8';
}

function getBoardLabel(type) {
  const map = {
    arduino_uno: 'Arduino Uno',
    'esp-32': 'ESP32',
    pico: 'Raspberry Pi Pico',
  };
  return map[type] || type || 'Board';
}

function getCompLabel(comp) {
  return comp.label || comp.type?.replace(/^(wokwi|openhw)-/, '').replace(/-/g, ' ') || 'Component';
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function generateCircuitThumbnail(components = [], wires = []) {
  if (!components.length) {
    const c = document.createElement('canvas');
    c.width = THUMB_W;
    c.height = THUMB_H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, THUMB_W, THUMB_H);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Empty Circuit', THUMB_W / 2, THUMB_H / 2);
    return c.toDataURL('image/png', 0.7);
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const comps = components.filter(c => c.x != null && c.y != null);
  if (!comps.length) {
    const c = document.createElement('canvas');
    c.width = THUMB_W;
    c.height = THUMB_H;
    return c.toDataURL('image/png', 0.7);
  }

  for (const comp of comps) {
    const w = comp.w || 80;
    const h = comp.h || 60;
    if (comp.x < minX) minX = comp.x;
    if (comp.y < minY) minY = comp.y;
    if (comp.x + w > maxX) maxX = comp.x + w;
    if (comp.y + h > maxY) maxY = comp.y + h;
  }

  if (maxX - minX < 1) { minX -= 40; maxX += 40; }
  if (maxY - minY < 1) { minY -= 30; maxY += 30; }

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const scale = Math.min((THUMB_W - PAD * 2) / contentW, (THUMB_H - PAD * 2) / contentH, 1.5);
  const offsetX = (THUMB_W - contentW * scale) / 2 - minX * scale;
  const offsetY = (THUMB_H - contentH * scale) / 2 - minY * scale;

  const canvas = document.createElement('canvas');
  canvas.width = THUMB_W;
  canvas.height = THUMB_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, THUMB_W, THUMB_H);

  const tx = (x) => x * scale + offsetX;
  const ty = (y) => y * scale + offsetY;
  const tw = (w) => Math.max(w * scale, 6);
  const th = (h) => Math.max(h * scale, 4);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  const step = 20;
  for (let x = 0; x < THUMB_W; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, THUMB_H); ctx.stroke();
  }
  for (let y = 0; y < THUMB_H; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(THUMB_W, y); ctx.stroke();
  }

  const boardComp = comps.find(c => {
    const t = c.type || '';
    return t.includes('arduino_uno') || t.includes('esp') || t.includes('pico') || t.includes('board');
  });

  for (const wire of wires) {
    const points = [{ x: 0, y: 0 }];
    if (wire.waypoints && wire.waypoints.length) {
      points.length = 0;
      points.push(...wire.waypoints);
    }
    if (points.length < 2) {
      const fComp = comps.find(c => wire.from?.startsWith(c.id));
      const tComp = comps.find(c => wire.to?.startsWith(c.id));
      if (fComp && tComp) {
        points.length = 0;
        points.push({ x: fComp.x + (fComp.w || 80) / 2, y: fComp.y + (fComp.h || 60) / 2 });
        points.push({ x: tComp.x + (tComp.w || 80) / 2, y: tComp.y + (tComp.h || 60) / 2 });
      }
    }
    if (points.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(tx(points[0].x), ty(points[0].y));
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(tx(points[i].x), ty(points[i].y));
      }
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  for (const comp of comps) {
    const x = tx(comp.x);
    const y = ty(comp.y);
    const w = tw(comp.w || 80);
    const h = th(comp.h || 60);
    const isBoard = comp === boardComp;
    const color = isBoard
      ? (BOARD_COLORS[comp.type] || '#00979c')
      : getCompColor(comp.type);

    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 4;
    drawRoundedRect(ctx, x, y, w, h, 4);
    ctx.fillStyle = isBoard ? color : color + '20';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = isBoard ? 2 : 1.5;
    ctx.stroke();

    const label = isBoard ? getBoardLabel(comp.type) : getCompLabel(comp);
    const fontSize = Math.min(Math.max(w / label.length * 1.8, 7), 11);
    ctx.fillStyle = isBoard ? '#fff' : '#334155';
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  return canvas.toDataURL('image/png', 0.7);
}
