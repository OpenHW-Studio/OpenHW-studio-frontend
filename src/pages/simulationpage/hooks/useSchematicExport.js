import { useCallback, useRef } from "react";
import {
  COMPONENT_REGISTRY,
  LOCAL_PIN_DEFS,
  ensureEmulatorRegistry,
} from "../utils/componentRegistry";

/**
 * Schematic + viewer-export domain (see TopToolbox "Tool → Schematic View").
 *
 * Symbols come from the emulator catalog: every component folder ships a
 * schematic.ts next to its logic/UI code, exposing {width, height, pins, body}.
 * Pin ids/labels are always derived from that component's manifest.json. This
 * is a WIRING/VIEW diagram, not a SPICE netlist — no electrical behaviour is
 * asserted here. Custom components without a schematic.ts get a deterministic
 * rectangle + labelled pins derived from their manifest pins.
 *
 * Owns: generateSchematic (A4 SVG from components+wires+board),
 * downloadSchematicPng/Pdf. Filenames stay "schematic.png"/".svg".
 */
export function useSchematicExport({
  components,
  wires,
  board,
  setSchematicLoading,
  setSchematicDataUrl,
}) {
  const schematicSvgRef = useRef(null);

  const generateSchematic = useCallback(async () => {
    setSchematicLoading(true);
    setSchematicDataUrl(null);
    try {
      // The emulator package (and its schematic catalog) is lazy-loaded.
      await ensureEmulatorRegistry();

      const SW = 1122,
        SH = 794; // A4 landscape px
      const OM = 10,
        GL = 20,
        TH = 65; // outer-margin, grid-label, title height
      const FX1 = OM + GL,
        FY1 = OM + GL;
      const FX2 = SW - OM - GL,
        FY2 = SH - OM - GL - TH;
      const FW = FX2 - FX1,
        FH = FY2 - FY1;

      // ── SVG micro helpers ───────────────────────────────────────────────
      const esc = (v) =>
        String(v ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      const ln = (x1, y1, x2, y2, sw = 1.5, col = "#1a1a1a") =>
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${sw}"/>`;
      const bx = (x, y, w, h, fill = "white", sw = 1.5, rx = 0) =>
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="#1a1a1a" stroke-width="${sw}"/>`;
      const tx = (
        x,
        y,
        t,
        sz = 9,
        anchor = "middle",
        bold = false,
        fill = "#1a1a1a",
        font = "monospace",
      ) =>
        `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${sz}" font-family="${font}" ${bold ? 'font-weight="bold"' : ""} fill="${fill}">${esc(t)}</text>`;

      // ── Symbol catalog adapter ──────────────────────────────────────────
      // Each symbol definition is data shipped by the emulator component.
      const sides = ["left", "right", "top", "bottom"];
      const inferSide = (pin, w, h) => {
        if (sides.includes(pin.side)) return pin.side;
        const x = Number(pin.x ?? w / 2),
          y = Number(pin.y ?? h / 2);
        const d = [x, w - x, y, h - y];
        let best = 0;
        for (let i = 1; i < d.length; i++) if (d[i] < d[best]) best = i;
        return sides[best];
      };

      const adapt = (def, type) => {
        const width = Math.max(40, Number(def.width) || 100);
        const height = Math.max(30, Number(def.height) || 60);
        const pins = (Array.isArray(def.pins) ? def.pins : []).map((p) => ({
          id: String(p.id ?? ""),
          label: String(p.label ?? p.id ?? ""),
          x: Number(p.x) || 0,
          y: Number(p.y) || 0,
          side: inferSide(p, width, height),
        })).filter((p) => p.id);
        return {
          type,
          w: width,
          h: height,
          refPrefix: String(def.refPrefix || "U"),
          pins,
          body: Array.isArray(def.body) ? def.body.join("") : String(def.body || ""),
        };
      };

      // Fallback for a custom component with no schematic.ts of its own.
      // Still deterministic and manifest-derived — never invented pin names.
      const makeFallback = (comp) => {
        const type = String(comp.type || "component");
        const manifestPins =
          COMPONENT_REGISTRY[type]?.manifest?.pins || LOCAL_PIN_DEFS[type] || [];
        const groups = { left: [], right: [], top: [], bottom: [] };
        manifestPins.forEach((p) => {
          const id = String(p?.id ?? "");
          if (!id) return;
          const x = Number(p.x ?? 0),
            y = Number(p.y ?? 0);
          const d = [x, (Number(COMPONENT_REGISTRY[type]?.manifest?.w) || 100) - x, y, (Number(COMPONENT_REGISTRY[type]?.manifest?.h) || 80) - y];
          let best = 0;
          for (let i = 1; i < d.length; i++) if (d[i] < d[best]) best = i;
          groups[sides[best]].push(id);
        });
        (Object.keys(groups)).forEach((s) => groups[s].sort());
        const maxPer = Math.max(1, ...sides.map((s) => groups[s].length));
        const w = Math.max(96, Math.min(180, 34 + Math.max(...sides.flatMap((s) => groups[s].map((id) => id.length)), 4) * 7));
        const h = Math.max(56, Math.min(260, maxPer * 11 + 26));
        const pins = [];
        sides.forEach((side) => {
          groups[side].forEach((id, i) => {
            const t = (i + 1) / (groups[side].length + 1);
            pins.push({
              id,
              label: id,
              side,
              x: side === "right" ? w : side === "left" ? 0 : Math.round(t * w),
              y: side === "bottom" ? h : side === "top" ? 0 : Math.round(t * h),
            });
          });
        });
        const label = COMPONENT_REGISTRY[type]?.manifest?.label || type;
        return {
          type,
          w,
          h,
          refPrefix: "U",
          pins,
          body: [
            bx(12, 12, w - 24, h - 24),
            tx(w / 2, 28, "{{label}}", 9, "middle", true, "#1a1a1a", "sans-serif"),
            tx(w / 2, 10, "{{ref}}", 7, "middle", false, "#555"),
            tx(w / 2, h - 16, "{{type}}", 6, "middle", false, "#888"),
          ].join(""),
        };
      };

      // Pin label overlay. Highlighted with data-pin so the Schematic View
      // can be inspected/asserted in the DOM. Very wide pin headers are
      // sampled to keep the drawing legible (the full ids stay in the data).
      const pinLabelSvg = (sym) => {
        const grouped = { left: [], right: [], top: [], bottom: [] };
        sym.pins.forEach((p) => grouped[p.side]?.push(p));
        return sides
          .map((side) => {
            const list = grouped[side];
            if (!list.length) return "";
            const step = Math.ceil(list.length / 24);
            const shown = list.filter((_, i) => i % step === 0);
            const labels = shown
              .map((p) => {
                const x = side === "left" ? 14 : side === "right" ? sym.w - 14 : p.x;
                const y = side === "top" ? 22 : side === "bottom" ? sym.h - 6 : p.y + 3;
                const anchor = side === "left" ? "start" : side === "right" ? "end" : "middle";
                return `<text data-pin="${esc(p.id)}" x="${x}" y="${y}" text-anchor="${anchor}" font-size="6.5" font-family="monospace" fill="#1a1a1a">${esc(p.label)}</text>`;
              })
              .join("");
            const extra =
              list.length > shown.length
                ? `<text x="${side === "left" ? 14 : side === "right" ? sym.w - 14 : sym.w / 2}" y="${side === "bottom" ? sym.h - 18 : sym.h - 8}" text-anchor="${side === "right" ? "end" : "middle"}" font-size="6" fill="#888">+${list.length - shown.length} pins</text>`
                : "";
            return labels + extra;
          })
          .join("");
      };

      if (components.length === 0) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}"><rect width="${SW}" height="${SH}" fill="white"/><text x="${SW / 2}" y="${SH / 2}" text-anchor="middle" font-size="18" fill="#aaa" font-family="sans-serif">No components on canvas</text></svg>`;
        schematicSvgRef.current = svg;
        setSchematicDataUrl(
          `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`,
        );
        return;
      }

      // Assign reference designators (sorted left-to-right by canvas x).
      const sorted = [...components].sort((a, b) => a.x - b.x);
      const refCounts = {},
        compSymMap = {},
        compRefMap = {};
      sorted.forEach((c) => {
        const def = COMPONENT_REGISTRY[c.type]?.schematic;
        const sym = def ? adapt(def, c.type) : makeFallback(c);
        compSymMap[c.id] = sym;
        const pre = sym.refPrefix;
        refCounts[pre] = (refCounts[pre] || 0) + 1;
        compRefMap[c.id] = `${pre}${refCounts[pre]}`;
      });

      // Bounding box (canvas component centers)
      let mnX = 1e9,
        mnY = 1e9,
        mxX = -1e9,
        mxY = -1e9;
      components.forEach((c) => {
        const cx = c.x + (c.w || 60) / 2,
          cy = c.y + (c.h || 60) / 2;
        mnX = Math.min(mnX, cx);
        mnY = Math.min(mnY, cy);
        mxX = Math.max(mxX, cx);
        mxY = Math.max(mxY, cy);
      });

      const PAD = 70;
      const availW = FW - PAD * 2,
        availH = FH - PAD * 2;
      const srcW = Math.max(mxX - mnX, 1),
        srcH = Math.max(mxY - mnY, 1);
      const maxSymW = Math.max(...Object.values(compSymMap).map((s) => s.w));
      const maxSymH = Math.max(...Object.values(compSymMap).map((s) => s.h));
      // Reserve half of the widest/tallest symbol at BOTH ends of the canvas
      // span so no symbol is clipped by the drawing frame.
      const sc = Math.min(
        Math.max(100, availW - maxSymW) / srcW,
        Math.max(100, availH - maxSymH) / srcH,
        1.4,
      );
      const totalW = srcW * sc + maxSymW,
        totalH = srcH * sc + maxSymH;
      const ox = FX1 + (availW - totalW) / 2 + maxSymW / 2;
      const oy = FY1 + (availH - totalH) / 2 + maxSymH / 2;
      const toSch = (cx, cy) => ({
        x: ox + (cx - mnX) * sc,
        y: oy + (cy - mnY) * sc,
      });

      // Symbol top-left positions
      const cPos = {};
      components.forEach((c) => {
        const sym = compSymMap[c.id];
        const cx = c.x + (c.w || 60) / 2,
          cy = c.y + (c.h || 60) / 2;
        const s = toSch(cx, cy);
        cPos[c.id] = { x: s.x - sym.w / 2, y: s.y - sym.h / 2 };
      });

      // Pin world position helper (wire routing)
      const pinXY = (compId, pinId) => {
        const sym = compSymMap[compId];
        const pos = cPos[compId];
        if (!sym || !pos) return null;
        const pin = sym.pins.find((p) => p.id === pinId);
        if (!pin) return { x: pos.x + sym.w, y: pos.y + sym.h / 2 };
        return { x: pos.x + pin.x, y: pos.y + pin.y };
      };

      // ── Components SVG ────────────────────────────────────────────────────
      const compsSVG = components
        .map((c) => {
          const sym = compSymMap[c.id];
          const pos = cPos[c.id];
          const ref = compRefMap[c.id];
          const body = sym.body.replace(/\{\{ref\}\}/g, esc(ref))
            .replace(/\{\{label\}\}/g, esc(c.label || c.name || COMPONENT_REGISTRY[c.type]?.manifest?.label || sym.type))
            .replace(/\{\{type\}\}/g, esc(sym.type))
            .replace(/\{\{value\}\}/g, esc(c.attrs?.value ?? COMPONENT_REGISTRY[c.type]?.manifest?.attrs?.value ?? ""));
          return `<g class="comp" id="${esc(c.id)}" data-symbol-type="${esc(c.type)}"><g transform="translate(${pos.x.toFixed(1)},${pos.y.toFixed(1)})">${body}${pinLabelSvg(sym)}</g></g>`;
        })
        .join("\n");

      // ── Wires SVG ─────────────────────────────────────────────────────────
      const wiresSVG = wires
        .map((w) => {
          const [fC, fP] = String(w.from).split(":"),
            [tC, tP] = String(w.to).split(":");
          const p1 = pinXY(fC, fP),
            p2 = pinXY(tC, tP);
          if (!p1 || !p2) return "";
          const midX = (p1.x + p2.x) / 2;
          const d = `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} L${midX.toFixed(1)},${p1.y.toFixed(1)} L${midX.toFixed(1)},${p2.y.toFixed(1)} L${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
          const dot =
            Math.abs(p1.y - p2.y) < 1
              ? ""
              : `<circle cx="${midX.toFixed(1)}" cy="${p1.y.toFixed(1)}" r="2.5" fill="#1a1a1a"/>`;
          return `<path d="${d}" fill="none" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>${dot}`;
        })
        .filter(Boolean)
        .join("\n");

      // ── Border + grid coordinates ─────────────────────────────────────────
      const GCOLS = 6,
        GROWS = 4,
        GRL = ["A", "B", "C", "D"];
      const cStep = FW / GCOLS,
        rStep = FH / GROWS;
      let borderSVG = `
        <rect x="${OM}" y="${OM}" width="${SW - OM * 2}" height="${SH - OM * 2}" fill="none" stroke="#cc0000" stroke-width="1.2"/>
        <rect x="${FX1}" y="${FY1}" width="${FW}" height="${FH}" fill="none" stroke="#cc0000" stroke-width="2"/>
      `;
      for (let c = 1; c < GCOLS; c++) {
        const gx = FX1 + c * cStep;
        borderSVG += `${ln(gx, FY1, gx, FY1 - 3, 0.5, "#777")}${ln(gx, FY2, gx, FY2 + 3, 0.5, "#777")}`;
      }
      for (let r = 1; r < GROWS; r++) {
        const gy = FY1 + r * rStep;
        borderSVG += `${ln(FX1, gy, FX1 - 3, gy, 0.5, "#777")}${ln(FX2, gy, FX2 + 3, gy, 0.5, "#777")}`;
      }
      for (let c = 0; c < GCOLS; c++) {
        const cx = FX1 + c * cStep + cStep / 2;
        borderSVG += tx(cx, FY1 - 5, c + 1, 8, "middle", false, "#444", "sans-serif");
        borderSVG += tx(cx, FY2 + 14, c + 1, 8, "middle", false, "#444", "sans-serif");
      }
      for (let r = 0; r < GROWS; r++) {
        const ry = FY1 + r * rStep + rStep / 2 + 4;
        borderSVG += tx(FX1 - 5, ry, GRL[r], 8, "end", false, "#444", "sans-serif");
        borderSVG += tx(FX2 + 5, ry, GRL[r], 8, "start", false, "#444", "sans-serif");
      }

      // ── Title block ───────────────────────────────────────────────────────
      const TBY = FY2,
        TBH2 = SH - OM - GL - FY2,
        divW = FW / 3;
      const boardLabel =
        board === "arduino_uno"
          ? "Arduino Uno"
          : board === "pico"
            ? "Raspberry Pi Pico"
            : board === "pi3" || board === "pi4" || board === "pi5"
              ? `Raspberry Pi ${String(board).slice(2)}`
              : "ESP32";
      const dateStr = new Date().toISOString().slice(0, 10);
      borderSVG += `
        <rect x="${FX1}" y="${TBY}" width="${FW}" height="${TBH2}" fill="white" stroke="#cc0000" stroke-width="1"/>
        <line x1="${FX1 + divW}" y1="${TBY}" x2="${FX1 + divW}" y2="${TBY + TBH2}" stroke="#bbb" stroke-width="0.5"/>
        <line x1="${FX1 + divW * 2}" y1="${TBY}" x2="${FX1 + divW * 2}" y2="${TBY + TBH2}" stroke="#bbb" stroke-width="0.5"/>
        <text x="${FX1 + 10}" y="${TBY + TBH2 / 2 + 4}" font-size="9" font-family="sans-serif" fill="#666">Made with OpenHW Studio</text>
        <text x="${FX1 + 10}" y="${TBY + TBH2 - 4}" font-size="6" font-family="sans-serif" fill="#999">Wiring view — not a SPICE netlist</text>
        <text x="${FX1 + divW * 1.5}" y="${TBY + TBH2 / 2 - 4}" text-anchor="middle" font-size="10" font-weight="bold" font-family="sans-serif" fill="#1a1a1a">Board: ${esc(boardLabel)}</text>
        <text x="${FX1 + divW * 1.5}" y="${TBY + TBH2 / 2 + 10}" text-anchor="middle" font-size="8" font-family="sans-serif" fill="#555">${components.length} components · ${wires.length} wires</text>
        <text x="${FX1 + divW * 2.5}" y="${TBY + TBH2 / 2 + 4}" text-anchor="middle" font-size="9" font-family="sans-serif" fill="#444">${dateStr}</text>
        <text x="${FX1 + divW}" y="${TBY + 8}" font-size="6" font-family="sans-serif" fill="#aaa">TITLE</text>
        <text x="${FX1 + divW * 2}" y="${TBY + 8}" font-size="6" font-family="sans-serif" fill="#aaa">DATE</text>
      `;

      // ── Assemble SVG ───────────────────────────────────────────────────────
      const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">
  <rect width="${SW}" height="${SH}" fill="white"/>
  ${borderSVG}
  <g id="wires" stroke-linecap="round" stroke-linejoin="round">${wiresSVG}</g>
  <g id="components">${compsSVG}</g>
</svg>`;

      schematicSvgRef.current = svgStr;
      const b64 = btoa(unescape(encodeURIComponent(svgStr)));
      setSchematicDataUrl(`data:image/svg+xml;base64,${b64}`);
    } catch (err) {
      console.error("[Schematic]", err);
    } finally {
      setSchematicLoading(false);
    }
  }, [components, wires, board]);

  const downloadSchematicPng = useCallback(() => {
    const svgStr = schematicSvgRef.current;
    if (!svgStr) return;
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 2244;
      canvas.height = 1588; // 2x high-res
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png", 0.95);
      a.download = "schematic.png";
      a.click();
    };
    img.onerror = () => {
      // Fallback: download SVG
      const a = document.createElement("a");
      a.href = url;
      a.download = "schematic.svg";
      a.click();
    };
    img.src = url;
  }, []);

  const downloadSchematicPdf = useCallback(() => {
    const svgStr = schematicSvgRef.current;
    if (!svgStr) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      `<html><head><title>Schematic</title>` +
      `<style>@page{margin:0;size:A4 landscape}body{margin:0;padding:0}svg{width:100%;height:auto;display:block}</style></head>` +
      `<body>${svgStr}<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};}<\/script></body></html>`,
    );
    win.document.close();
  }, []);

  return {
    schematicSvgRef,
    generateSchematic,
    downloadSchematicPng,
    downloadSchematicPdf,
  };
}
