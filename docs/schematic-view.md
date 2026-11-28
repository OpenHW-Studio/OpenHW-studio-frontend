# Schematic View

`Tool → Schematic View` renders an A4 wiring diagram of the current canvas. It
is a **wiring/view symbol** diagram, not a SPICE netlist: symbols show pin
names and wire routing derived from each component's manifest, and make no
claim about electrical behaviour.

## Where symbols live

Every emulator component folder (`openhw-studio-emulator/src/components/<id>/`)
has a `schematic.ts` exporting:

```js
{ width, height, refPrefix, pins: [{ id, label, x, y, side }], body: [/* SVG */], source }
```

`SCHEMATICS` is exported from the emulator's `components/index.ts`; the
frontend attaches it to `COMPONENT_REGISTRY` in
`src/pages/simulationpage/utils/emulatorLoader.js`. The generator
(`src/pages/simulationpage/hooks/useSchematicExport.js`) waits for the registry,
then draws one `<g class="comp" data-symbol-type="…">` per placed component.
Pin labels carry `data-pin` so they can be inspected in tests. Components
without a `schematic.ts` (e.g. uploaded ZIP components) still get a
deterministic rectangle with manifest-derived pin labels.

Regenerate emulator stubs with `node scripts/gen-schematics.mjs` in the
emulator repo (add the `HAND-WRITTEN OVERRIDE` marker to keep a custom symbol).

## Export

The panel offers **Download PNG** (`schematic.png`, 2× A4) and **Download PDF**.
Export behaviour and filenames are unchanged from the previous implementation.
