import { useCallback, useRef } from "react";

/**
 * Schematic + viewer-export domain, extracted verbatim from SimulatorPage.jsx.
 *
 * Owns: generateSchematic (A4 schematic SVG from components+wires+board),
 * downloadSchematicPng/Pdf. Pure derivation + two setters + one svg ref.
 *
 * Behavior contract: byte-identical SVG output, same filenames
 * ("schematic.png"/".svg"). Verify via TopToolbox schematic dialog +
 * schematic PNG download Playwright checks.
 *
 * @param {{ components: Array, wires: Array, board: string,
 *          setSchematicLoading: Function, setSchematicDataUrl: Function }} args
 */
export function useSchematicExport({
  components,
  wires,
  board,
  setSchematicLoading,
  setSchematicDataUrl,
}) {
  const schematicSvgRef = useRef(null);

  // ── View Panel helpers — SVG Schematic Generator ─────────────────────────
  const generateSchematic = useCallback(() => {
    setSchematicLoading(true);
    setSchematicDataUrl(null);
    try {
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
        `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${sz}" font-family="${font}" ${bold ? 'font-weight="bold"' : ""} fill="${fill}">${t}</text>`;
      const circ = (cx, cy, r, fill = "white") =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#1a1a1a" stroke-width="1.5"/>`;

      // ── Symbol library ──────────────────────────────────────────────────
      const SYMS = {};

      // LED
      SYMS["wokwi-led"] = {
        w: 72,
        h: 44,
        refPrefix: "D",
        pins: { A: { dx: 0, dy: 22 }, K: { dx: 72, dy: 22 } },
        draw(x, y, comp, ref) {
          const c = comp.attrs?.color || "red";
          const fill =
            c === "green"
              ? "#2a7a2a30"
              : c === "blue"
                ? "#2a2a9a30"
                : c === "yellow"
                  ? "#8a7a0030"
                  : "#c0202030";
          return [
            ln(x, y + 22, x + 16, y + 22),
            `<polygon points="${x + 16},${y + 6} ${x + 16},${y + 38} ${x + 48},${y + 22}" fill="${fill}" stroke="#1a1a1a" stroke-width="1.5"/>`,
            ln(x + 48, y + 6, x + 48, y + 38),
            ln(x + 48, y + 22, x + 72, y + 22),
            ln(x + 38, y + 6, x + 52, y - 5, 1),
            ln(x + 32, y + 6, x + 46, y - 5, 1),
            `<polygon points="${x + 50},${y - 7} ${x + 52},${y - 5} ${x + 48},${y - 4}" fill="#1a1a1a"/>`,
            `<polygon points="${x + 44},${y - 7} ${x + 46},${y - 5} ${x + 42},${y - 4}" fill="#1a1a1a"/>`,
            tx(x + 36, y + 54, ref, 9, "middle", true),
            tx(x + 5, y + 18, "+", 7, "middle", false, "#777"),
            tx(x + 64, y + 18, "−", 7, "middle", false, "#777"),
          ].join("");
        },
      };

      // Resistor
      SYMS["wokwi-resistor"] = {
        w: 70,
        h: 32,
        refPrefix: "R",
        pins: { p1: { dx: 0, dy: 16 }, p2: { dx: 70, dy: 16 } },
        draw(x, y, comp, ref) {
          const v = parseFloat(comp.attrs?.value || 220);
          const u =
            v >= 1e6
              ? `${v / 1e6}M\u03A9`
              : v >= 1000
                ? `${v / 1000}k\u03A9`
                : `${v}\u03A9`;
          return [
            ln(x, y + 16, x + 12, y + 16),
            bx(x + 12, y + 6, 46, 20),
            ln(x + 58, y + 16, x + 70, y + 16),
            tx(x + 35, y + 44, ref, 9, "middle", true),
            tx(x + 35, y + 53, u, 8, "middle", false, "#555"),
          ].join("");
        },
      };

      // Push button
      SYMS["wokwi-pushbutton"] = {
        w: 62,
        h: 48,
        refPrefix: "S",
        pins: { 1: { dx: 0, dy: 28 }, 2: { dx: 62, dy: 28 } },
        draw(x, y, comp, ref) {
          return [
            ln(x, y + 28, x + 16, y + 28),
            ln(x + 16, y + 14, x + 16, y + 42),
            ln(x + 40, y + 14, x + 40, y + 42),
            ln(x + 16, y + 14, x + 46, y + 9),
            ln(x + 40, y + 28, x + 62, y + 28),
            ln(x + 28, y + 9, x + 28, y + 2),
            ln(x + 23, y + 2, x + 33, y + 2, 1.5),
            tx(x + 31, y + 60, ref, 9, "middle", true),
          ].join("");
        },
      };

      // Buzzer
      SYMS["wokwi-buzzer"] = {
        w: 52,
        h: 48,
        refPrefix: "BZ",
        pins: { 1: { dx: 0, dy: 24 }, 2: { dx: 52, dy: 24 } },
        draw(x, y, comp, ref) {
          return [
            ln(x, y + 24, x + 10, y + 24),
            bx(x + 10, y + 10, 32, 28),
            `<path d="M${x + 21},${y + 16} Q${x + 26},${y + 11} ${x + 31},${y + 16}" fill="none" stroke="#1a1a1a" stroke-width="1"/>`,
            `<path d="M${x + 17},${y + 13} Q${x + 26},${y + 5} ${x + 35},${y + 13}" fill="none" stroke="#1a1a1a" stroke-width="1"/>`,
            ln(x + 26, y + 24, x + 26, y + 30, 1.5),
            ln(x + 42, y + 24, x + 52, y + 24),
            tx(x + 46, y + 22, "+", 7, "middle", false, "#777"),
            tx(x + 26, y + 60, ref, 9, "middle", true),
          ].join("");
        },
      };

      // Power supply
      SYMS["wokwi-power-supply"] = {
        w: 52,
        h: 70,
        refPrefix: "PS",
        pins: { "5V": { dx: 26, dy: 0 }, GND: { dx: 26, dy: 70 } },
        draw(x, y, comp, ref) {
          const v = comp.attrs?.voltage || "5V";
          return [
            ln(x + 26, y, x + 26, y + 16),
            ln(x + 14, y + 16, x + 38, y + 16, 2),
            ln(x + 26, y + 50, x + 26, y + 70),
            ln(x + 14, y + 50, x + 38, y + 50),
            ln(x + 18, y + 56, x + 34, y + 56),
            ln(x + 22, y + 62, x + 30, y + 62),
            tx(x + 26, y - 4, `+${v}`, 9),
            tx(x + 26, y + 32, ref, 8, "middle", false, "#555"),
          ].join("");
        },
      };

      // Potentiometer
      SYMS["wokwi-potentiometer"] = {
        w: 80,
        h: 72,
        refPrefix: "RV",
        pins: {
          1: { dx: 0, dy: 36 },
          2: { dx: 80, dy: 36 },
          SIG: { dx: 40, dy: 72 },
        },
        draw(x, y, comp, ref) {
          const v = parseFloat(comp.attrs?.value || 50000);
          const u =
            v >= 1e6
              ? `${v / 1e6}M\u03A9`
              : v >= 1000
                ? `${v / 1000}k\u03A9`
                : `${v}\u03A9`;
          return [
            ln(x, y + 36, x + 12, y + 36),
            bx(x + 12, y + 26, 56, 20),
            ln(x + 68, y + 36, x + 80, y + 36),
            ln(x + 40, y + 46, x + 40, y + 60),
            `<polygon points="${x + 34},${y + 46} ${x + 46},${y + 46} ${x + 40},${y + 36}" fill="#1a1a1a"/>`,
            ln(x + 40, y + 60, x + 40, y + 72),
            tx(x + 40, y + 22, u, 7),
            tx(x + 40, y + 84, ref, 9, "middle", true),
          ].join("");
        },
      };

      // Servo
      SYMS["wokwi-servo"] = {
        w: 90,
        h: 56,
        refPrefix: "SV",
        pins: {
          GND: { dx: 18, dy: 56 },
          "V+": { dx: 45, dy: 56 },
          PWM: { dx: 72, dy: 56 },
        },
        draw(x, y, comp, ref) {
          return [
            bx(x + 5, y + 5, 80, 36, undefined, 1.5, 3),
            tx(
              x + 45,
              y + 28,
              "SERVO",
              10,
              "middle",
              true,
              "#1a1a1a",
              "sans-serif",
            ),
            ln(x + 18, y + 41, x + 18, y + 56),
            ln(x + 45, y + 41, x + 45, y + 56),
            ln(x + 72, y + 41, x + 72, y + 56),
            tx(x + 18, y + 66, "GND", 7),
            tx(x + 45, y + 66, "V+", 7),
            tx(x + 72, y + 66, "PWM", 7),
            tx(x + 45, y + 76, ref, 9, "middle", true),
          ].join("");
        },
      };

      // DC Motor
      SYMS["wokwi-motor"] = {
        w: 60,
        h: 52,
        refPrefix: "M",
        pins: { 1: { dx: 0, dy: 26 }, 2: { dx: 60, dy: 26 } },
        draw(x, y, comp, ref) {
          return [
            ln(x, y + 26, x + 8, y + 26),
            circ(x + 30, y + 26, 18),
            tx(
              x + 30,
              y + 30,
              "M",
              14,
              "middle",
              true,
              "#1a1a1a",
              "sans-serif",
            ),
            ln(x + 52, y + 26, x + 60, y + 26),
            tx(x + 30, y + 56, ref, 9, "middle", true),
          ].join("");
        },
      };

      // NeoPixel
      SYMS["wokwi-neopixel-matrix"] = {
        w: 80,
        h: 62,
        refPrefix: "NP",
        pins: {
          DIN: { dx: 0, dy: 31 },
          VCC: { dx: 40, dy: 0 },
          GND: { dx: 40, dy: 62 },
        },
        draw(x, y, comp, ref) {
          return [
            bx(x + 10, y + 10, 60, 42, "#111"),
            ln(x, y + 31, x + 10, y + 31),
            ln(x + 40, y, x + 40, y + 10),
            ln(x + 40, y + 52, x + 40, y + 62),
            `<circle cx="${x + 30}" cy="${y + 26}" r="5" fill="#f00" opacity="0.9"/>`,
            `<circle cx="${x + 40}" cy="${y + 26}" r="5" fill="#0f0" opacity="0.9"/>`,
            `<circle cx="${x + 50}" cy="${y + 26}" r="5" fill="#00f" opacity="0.9"/>`,
            `<circle cx="${x + 35}" cy="${y + 38}" r="5" fill="#ff0" opacity="0.9"/>`,
            `<circle cx="${x + 45}" cy="${y + 38}" r="5" fill="#0ff" opacity="0.9"/>`,
            tx(x + 40, y + 76, ref, 9, "middle", true),
          ].join("");
        },
      };

      // 74HC595 Shift Register
      SYMS["shift_register"] = {
        w: 120,
        h: 210,
        refPrefix: "IC",
        pins: {
          vcc: { dx: 60, dy: 0 },
          gnd: { dx: 60, dy: 210 },
          ser: { dx: 0, dy: 40 },
          srclk: { dx: 0, dy: 58 },
          rclk: { dx: 0, dy: 76 },
          oe: { dx: 0, dy: 94 },
          srclr: { dx: 0, dy: 112 },
          q0: { dx: 120, dy: 40 },
          q1: { dx: 120, dy: 58 },
          q2: { dx: 120, dy: 76 },
          q3: { dx: 120, dy: 94 },
          q4: { dx: 120, dy: 112 },
          q5: { dx: 120, dy: 130 },
          q6: { dx: 120, dy: 148 },
          q7: { dx: 120, dy: 166 },
          q7s: { dx: 120, dy: 184 },
        },
        draw(x, y, comp, ref) {
          const LP = [
            ["SER", 40],
            ["SRCLK", 58],
            ["RCLK", 76],
            ["~OE", 94],
            ["~SRCLR", 112],
          ];
          const RP = [
            ["Q0", 40],
            ["Q1", 58],
            ["Q2", 76],
            ["Q3", 94],
            ["Q4", 112],
            ["Q5", 130],
            ["Q6", 148],
            ["Q7", 166],
            ["Q7'", 184],
          ];
          return [
            bx(x + 15, y + 12, 90, 186),
            tx(x + 60, y + 28, "74HC595", 9, "middle", true),
            tx(x + 60, y + 10, ref, 7, "middle", false, "#555"),
            ln(x + 60, y, x + 60, y + 12),
            tx(x + 60, y - 2, "VCC", 7),
            ln(x + 60, y + 198, x + 60, y + 210),
            tx(x + 60, y + 220, "GND", 7),
            ...LP.map(
              ([l, dy]) =>
                ln(x, y + dy, x + 15, y + dy) +
                `<text x="${x + 18}" y="${y + dy + 3}" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`,
            ),
            ...RP.map(
              ([l, dy]) =>
                ln(x + 105, y + dy, x + 120, y + dy) +
                `<text x="${x + 102}" y="${y + dy + 3}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`,
            ),
          ].join("");
        },
      };

      // L298N Motor Driver
      SYMS["wokwi-motor-driver"] = {
        w: 130,
        h: 170,
        refPrefix: "MD",
        pins: {
          ENA: { dx: 0, dy: 30 },
          IN1: { dx: 0, dy: 50 },
          IN2: { dx: 0, dy: 70 },
          IN3: { dx: 0, dy: 90 },
          IN4: { dx: 0, dy: 110 },
          ENB: { dx: 0, dy: 130 },
          OUT1: { dx: 130, dy: 30 },
          OUT2: { dx: 130, dy: 50 },
          OUT3: { dx: 130, dy: 90 },
          OUT4: { dx: 130, dy: 110 },
          "12V": { dx: 30, dy: 0 },
          GND: { dx: 65, dy: 0 },
          "5V": { dx: 100, dy: 0 },
        },
        draw(x, y, comp, ref) {
          const LP = [
            ["ENA", 30],
            ["IN1", 50],
            ["IN2", 70],
            ["IN3", 90],
            ["IN4", 110],
            ["ENB", 130],
          ];
          const RP = [
            ["OUT1", 30],
            ["OUT2", 50],
            ["OUT3", 90],
            ["OUT4", 110],
          ];
          const TP = [
            ["12V", 30],
            ["GND", 65],
            ["5V", 100],
          ];
          return [
            bx(x + 15, y + 12, 100, 148),
            tx(
              x + 65,
              y + 34,
              "L298N",
              10,
              "middle",
              true,
              "#1a1a1a",
              "sans-serif",
            ),
            tx(x + 65, y + 10, ref, 7, "middle", false, "#555"),
            ...LP.map(
              ([l, dy]) =>
                ln(x, y + dy, x + 15, y + dy) +
                `<text x="${x + 18}" y="${y + dy + 3}" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`,
            ),
            ...RP.map(
              ([l, dy]) =>
                ln(x + 115, y + dy, x + 130, y + dy) +
                `<text x="${x + 112}" y="${y + dy + 3}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`,
            ),
            ...TP.map(
              ([l, dx]) =>
                ln(x + dx, y, x + dx, y + 12) +
                `<text x="${x + dx}" y="${y - 2}" text-anchor="middle" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`,
            ),
          ].join("");
        },
      };

      // Arduino Uno ─────────────────────────────────────────────────────────
      const UL = [
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
        "11",
        "12",
        "13",
      ];
      const UR = [
        "A0",
        "A1",
        "A2",
        "A3",
        "A4",
        "A5",
        "vin",
        "gnd_1",
        "gnd_2",
        "gnd_3",
        "5V",
        "3v3",
        "rst",
        "ioref",
      ];
      const ULL = [
        "D0",
        "D1",
        "D2",
        "D3",
        "D4",
        "D5~",
        "D6~",
        "D7",
        "D8",
        "D9~",
        "D10~",
        "D11~",
        "D12",
        "D13",
      ];
      const URL2 = [
        "A0",
        "A1",
        "A2",
        "A3",
        "A4",
        "A5",
        "VIN",
        "GND",
        "GND",
        "GND",
        "5V",
        "3.3V",
        "RST",
        "IOREF",
      ];
      const UPS = 18,
        UW = 148,
        UH = UL.length * UPS + 46;
      const unoPins = {};
      UL.forEach((id, i) => {
        unoPins[id] = { dx: 0, dy: 34 + i * UPS };
      });
      UR.forEach((id, i) => {
        unoPins[id] = { dx: UW, dy: 34 + i * UPS };
      });
      SYMS["wokwi-arduino-uno"] = {
        w: UW,
        h: UH,
        refPrefix: "U",
        pins: unoPins,
        draw(x, y, comp, ref) {
          return [
            bx(x + 16, y + 14, UW - 32, UH - 28),
            tx(x + UW / 2, y + 30, "Arduino Uno", 10, "middle", true),
            tx(x + UW / 2, y + 10, ref, 8, "middle", false, "#555"),
            tx(x + UW / 2, y + 44, "ATmega328P", 7, "middle", false, "#777"),
            ...UL.map((id, i) => {
              const py = y + 34 + i * UPS;
              return (
                ln(x, py, x + 16, py) +
                `<text x="${x + 19}" y="${py + 3}" font-size="6.5" font-family="monospace" fill="#1a1a1a">${ULL[i]}</text>`
              );
            }),
            ...UR.map((id, i) => {
              const py = y + 34 + i * UPS;
              return (
                ln(x + UW - 16, py, x + UW, py) +
                `<text x="${x + UW - 19}" y="${py + 3}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#1a1a1a">${URL2[i]}</text>`
              );
            }),
          ].join("");
        },
      };

      // Aliases for openhw- rebranded components
      SYMS["openhw-led"] = SYMS["wokwi-led"];
      SYMS["openhw-resistor"] = SYMS["wokwi-resistor"];
      SYMS["openhw-pushbutton"] = SYMS["wokwi-pushbutton"];
      SYMS["openhw-buzzer"] = SYMS["wokwi-buzzer"];
      SYMS["openhw-power-supply"] = SYMS["wokwi-power-supply"];
      SYMS["openhw-potentiometer"] = SYMS["wokwi-potentiometer"];
      SYMS["openhw-servo"] = SYMS["wokwi-servo"];
      SYMS["openhw-motor"] = SYMS["wokwi-motor"];
      SYMS["openhw-neopixel-matrix"] = SYMS["wokwi-neopixel-matrix"];
      SYMS["openhw-motor-driver"] = SYMS["wokwi-motor-driver"];
      SYMS["openhw-arduino-uno"] = SYMS["wokwi-arduino-uno"];

      // Generic fallback IC ─────────────────────────────────────────────────
      const makeGenericSym = (comp) => {
        const used = new Set();
        wires.forEach((w) => {
          const [ci, pi] = w.from.split(":");
          if (ci === comp.id && pi) used.add(pi);
          const [ci2, pi2] = w.to.split(":");
          if (ci2 === comp.id && pi2) used.add(pi2);
        });
        const pl = [...used];
        const half = Math.ceil(pl.length / 2);
        const lp = pl.slice(0, half),
          rp = pl.slice(half);
        const rows = Math.max(lp.length, rp.length, 2),
          gh = rows * 20 + 44,
          gw = 100;
        const pins = {};
        lp.forEach((id, i) => {
          pins[id] = { dx: 0, dy: 32 + i * 20 };
        });
        rp.forEach((id, i) => {
          pins[id] = { dx: gw + 30, dy: 32 + i * 20 };
        });
        return {
          w: gw + 30,
          h: gh,
          refPrefix: "IC",
          pins,
          draw(x, y, _c, ref) {
            const sType = _c.type.replace(/^(wokwi-|openhw-)/, "");
            return [
              bx(x + 15, y + 12, gw, gh - 24),
              tx(x + 15 + gw / 2, y + 28, sType, 8, "middle", true),
              tx(x + 15 + gw / 2, y + 10, ref, 7, "middle", false, "#555"),
              ...lp.map(
                (id, i) =>
                  ln(x, y + 32 + i * 20, x + 15, y + 32 + i * 20) +
                  `<text x="${x + 18}" y="${y + 36 + i * 20}" font-size="6.5" font-family="monospace" fill="#1a1a1a">${id}</text>`,
              ),
              ...rp.map(
                (id, i) =>
                  ln(
                    x + gw + 15,
                    y + 32 + i * 20,
                    x + gw + 30,
                    y + 32 + i * 20,
                  ) +
                  `<text x="${x + gw + 12}" y="${y + 36 + i * 20}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#1a1a1a">${id}</text>`,
              ),
            ].join("");
          },
        };
      };

      // ── Layout ────────────────────────────────────────────────────────────
      if (components.length === 0) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}"><rect width="${SW}" height="${SH}" fill="white"/><text x="${SW / 2}" y="${SH / 2}" text-anchor="middle" font-size="18" fill="#aaa" font-family="sans-serif">No components on canvas</text></svg>`;
        schematicSvgRef.current = svg;
        setSchematicDataUrl(
          `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`,
        );
        return;
      }

      // Assign reference designators (sorted left-to-right by canvas x)
      const sorted = [...components].sort((a, b) => a.x - b.x);
      const refCounts = {},
        compSymMap = {},
        compRefMap = {};
      sorted.forEach((c) => {
        let sym = SYMS[c.type];
        if (!sym) sym = makeGenericSym(c);
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
      const sc = Math.min(availW / srcW, availH / srcH, 1.8);

      const toSch = (cx, cy) => ({
        x: FX1 + PAD + (cx - mnX) * sc,
        y: FY1 + PAD + (cy - mnY) * sc,
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

      // Pin world position helper
      const pinXY = (compId, pinId) => {
        const c = components.find((cc) => cc.id === compId);
        if (!c) return null;
        const sym = compSymMap[c.id];
        if (!sym) return null;
        const pos = cPos[c.id];
        const pin = sym.pins[pinId];
        if (!pin) return { x: pos.x + sym.w, y: pos.y + sym.h / 2 };
        return { x: pos.x + pin.dx, y: pos.y + pin.dy };
      };

      // ── Components SVG ────────────────────────────────────────────────────
      const compsSVG = components
        .map((c) => {
          const sym = compSymMap[c.id];
          const pos = cPos[c.id];
          const ref = compRefMap[c.id];
          return `<g class="comp" id="${c.id}">${sym.draw(pos.x, pos.y, c, ref)}</g>`;
        })
        .join("\n");

      // ── Wires SVG ─────────────────────────────────────────────────────────
      const wiresSVG = wires
        .map((w) => {
          const [fC, fP] = w.from.split(":"),
            [tC, tP] = w.to.split(":");
          const p1 = pinXY(fC, fP),
            p2 = pinXY(tC, tP);
          if (!p1 || !p2) return "";
          // Route: horizontal from p1 half-way, then vertical, then horizontal to p2
          const midX = (p1.x + p2.x) / 2;
          const d = `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} L${midX.toFixed(1)},${p1.y.toFixed(1)} L${midX.toFixed(1)},${p2.y.toFixed(1)} L${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
          // Junction dot at middle junction if same Y (direct horizontal)
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
        borderSVG += tx(
          cx,
          FY1 - 5,
          c + 1,
          8,
          "middle",
          false,
          "#444",
          "sans-serif",
        );
        borderSVG += tx(
          cx,
          FY2 + 14,
          c + 1,
          8,
          "middle",
          false,
          "#444",
          "sans-serif",
        );
      }
      for (let r = 0; r < GROWS; r++) {
        const ry = FY1 + r * rStep + rStep / 2 + 4;
        borderSVG += tx(
          FX1 - 5,
          ry,
          GRL[r],
          8,
          "end",
          false,
          "#444",
          "sans-serif",
        );
        borderSVG += tx(
          FX2 + 5,
          ry,
          GRL[r],
          8,
          "start",
          false,
          "#444",
          "sans-serif",
        );
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
            : "ESP32";
      const dateStr = new Date().toISOString().slice(0, 10);
      borderSVG += `
        <rect x="${FX1}" y="${TBY}" width="${FW}" height="${TBH2}" fill="white" stroke="#cc0000" stroke-width="1"/>
        <line x1="${FX1 + divW}" y1="${TBY}" x2="${FX1 + divW}" y2="${TBY + TBH2}" stroke="#bbb" stroke-width="0.5"/>
        <line x1="${FX1 + divW * 2}" y1="${TBY}" x2="${FX1 + divW * 2}" y2="${TBY + TBH2}" stroke="#bbb" stroke-width="0.5"/>
        <text x="${FX1 + 10}" y="${TBY + TBH2 / 2 + 4}" font-size="9" font-family="sans-serif" fill="#666">Made with OpenHW Studio</text>
        <text x="${FX1 + divW * 1.5}" y="${TBY + TBH2 / 2 - 4}" text-anchor="middle" font-size="10" font-weight="bold" font-family="sans-serif" fill="#1a1a1a">Board: ${boardLabel}</text>
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
