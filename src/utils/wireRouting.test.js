import { describe, it, expect } from 'vitest';
import { calculateWireBundleOffsets } from './wireRouting.js';

describe('wireRouting - collinear point simplification', () => {
  it('should simplify collinear points and not contain notches/hooks in shifted routes', () => {
    // Define two overlapping parallel wires to trigger micro-shifting
    const wires = [
      { id: 'wire1', from: 'compA:1', to: 'compB:1' },
      { id: 'wire2', from: 'compA:2', to: 'compB:2' }
    ];

    // Mock resolution points so both wires route along a shared trunk at Y=100
    // and turn horizontally.
    const resolveWirePoints = (wire) => {
      if (wire.id === 'wire1') {
        return {
          p1: { x: 10, y: 200 },
          e1: { x: 10, y: 100, dir: 'top' },
          e2: { x: 300, y: 100, dir: 'bottom' },
          p2: { x: 300, y: 400 }
        };
      } else {
        return {
          p1: { x: 20, y: 200 },
          e1: { x: 20, y: 100, dir: 'top' },
          e2: { x: 310, y: 100, dir: 'bottom' },
          p2: { x: 310, y: 400 }
        };
      }
    };

    const offsets = calculateWireBundleOffsets(wires, resolveWirePoints, true);
    
    // Check wire2's points (which will be shifted to avoid overlapping wire1)
    const wire2Offset = offsets.get('wire2');
    expect(wire2Offset).toBeDefined();
    expect(wire2Offset.points).toBeDefined();

    const pts = wire2Offset.points;

    // Verify that there are no consecutive collinear points in the output
    for (let i = 0; i < pts.length - 2; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const c = pts[i + 2];

      const isCollinearX = Math.abs(a.x - b.x) < 0.1 && Math.abs(b.x - c.x) < 0.1;
      const isCollinearY = Math.abs(a.y - b.y) < 0.1 && Math.abs(b.y - c.y) < 0.1;

      expect(isCollinearX || isCollinearY).toBe(false);
    }
  });
});

describe('wireRouting - bus offset nesting/waterfall sorting', () => {
  it('should sort offsets in ascending order when flowing Left-to-Right and trunk is below pins', () => {
    const wires = [
      { id: 'w2', from: 'compA:2', to: 'compB:2' }, // Pin 2 (middle)
      { id: 'w3', from: 'compA:3', to: 'compB:3' }, // Pin 3 (rightmost)
      { id: 'w1', from: 'compA:1', to: 'compB:1' }  // Pin 1 (leftmost)
    ];

    const resolveWirePoints = (wire) => {
      const pinMap = {
        w1: { p1: { x: 10, y: 100 }, p2: { x: 300, y: 100 } },
        w2: { p1: { x: 20, y: 100 }, p2: { x: 310, y: 100 } },
        w3: { p1: { x: 30, y: 100 }, p2: { x: 320, y: 100 } }
      };
      const pins = pinMap[wire.id];
      return {
        p1: pins.p1,
        e1: { x: pins.p1.x, y: 115, dir: 'bottom' },
        e2: { x: pins.p2.x, y: 115, dir: 'bottom' },
        p2: pins.p2
      };
    };

    const offsets = calculateWireBundleOffsets(wires, resolveWirePoints, true);

    const offset1 = offsets.get('w1').offset;
    const offset2 = offsets.get('w2').offset;
    const offset3 = offsets.get('w3').offset;

    // Leftmost pin (w1) turns first, so its trunk should be furthest (most positive offset) to let others nest closer
    // Rightmost pin (w3) turns last, so its trunk should be closest (most negative offset)
    expect(offset3).toBeLessThan(offset2);
    expect(offset2).toBeLessThan(offset1);
  });

  it('should reverse offset order when flowing Right-to-Left and trunk is below pins', () => {
    const wires = [
      { id: 'w1', from: 'compA:1', to: 'compB:1' }, // compA is right component, compB is left
      { id: 'w2', from: 'compA:2', to: 'compB:2' },
      { id: 'w3', from: 'compA:3', to: 'compB:3' }
    ];

    const resolveWirePoints = (wire) => {
      const pinMap = {
        w1: { p1: { x: 300, y: 100 }, p2: { x: 10, y: 100 } }, // w1 is leftmost on target (compB)
        w2: { p1: { x: 310, y: 100 }, p2: { x: 20, y: 100 } },
        w3: { p1: { x: 320, y: 100 }, p2: { x: 30, y: 100 } }  // w3 is rightmost
      };
      const pins = pinMap[wire.id];
      return {
        p1: pins.p1,
        e1: { x: pins.p1.x, y: 115, dir: 'bottom' },
        e2: { x: pins.p2.x, y: 115, dir: 'bottom' },
        p2: pins.p2
      };
    };

    const offsets = calculateWireBundleOffsets(wires, resolveWirePoints, true);

    const offset1 = offsets.get('w1').offset;
    const offset2 = offsets.get('w2').offset;
    const offset3 = offsets.get('w3').offset;

    // Rightmost pin on compA (w3) turns first when moving right-to-left, so its trunk should be furthest (most positive offset)
    // Leftmost pin on compA (w1) turns last, so its trunk should be closest (most negative offset)
    expect(offset1).toBeLessThan(offset2);
    expect(offset2).toBeLessThan(offset3);
  });
});

describe('wireRouting - primary edge grouping', () => {
  it('should group wires by the congested component edge even if they originate from different components', () => {
    // 3 wires going to compB (LCD) on the bottom edge:
    // w1: compA:1 -> compB:1
    // w2: compC:1 -> compB:2
    // w3: compA:2 -> compB:3
    const wires = [
      { id: 'w1', from: 'compA:1', to: 'compB:1' },
      { id: 'w2', from: 'compC:1', to: 'compB:2' },
      { id: 'w3', from: 'compA:2', to: 'compB:3' }
    ];

    const resolveWirePoints = (wire) => {
      const pinMap = {
        w1: { p1: { x: 50, y: 50 }, p2: { x: 100, y: 200 } },
        w2: { p1: { x: 150, y: 50 }, p2: { x: 115, y: 200 } },
        w3: { p1: { x: 60, y: 50 }, p2: { x: 130, y: 200 } }
      };
      const pins = pinMap[wire.id];
      return {
        p1: pins.p1,
        e1: { x: pins.p1.x, y: 65, dir: 'bottom' },
        e2: { x: pins.p2.x, y: 185, dir: 'top' }, // entering from top of compB
        p2: pins.p2
      };
    };

    const offsets = calculateWireBundleOffsets(wires, resolveWirePoints, true);

    const o1 = offsets.get('w1');
    const o2 = offsets.get('w2');
    const o3 = offsets.get('w3');

    expect(o1).toBeDefined();
    expect(o2).toBeDefined();
    expect(o3).toBeDefined();

    // Verify they all share the same bundleMidY (trunk) and are grouped under compB::top
    expect(o1.bundleMidY).toEqual(o2.bundleMidY);
    expect(o2.bundleMidY).toEqual(o3.bundleMidY);

    // Pin order on compB: w1 (x=100), w2 (x=115), w3 (x=130)
    // Since they are not reversed, the expected offset order is w3.offset < w2.offset < o1.offset
    expect(o3.offset).toBeLessThan(o2.offset);
    expect(o2.offset).toBeLessThan(o1.offset);
  });
});


