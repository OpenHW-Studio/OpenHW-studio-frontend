# Protocol Handlers Architecture

## Overview

The `protocol-handlers` subsystem provides robust, reusable base classes for hardware components. Instead of duplicating SPI bit-banging, I2C state machines, or PWM window-averaging logic inside every single component, you simply `extend` the correct protocol base class.

This ensures all components share a **single ground truth** for protocol behavior, timing, telemetry, and simulation rules.

## The Core Concept

When the runner executes code (e.g., inside `avr-runner.ts` or `rp2040-runner.ts`), it detects pin state changes and invokes specific lifecycle methods on the connected component. The protocol base classes implement these complex lifecycle methods and expose simplified, higher-level abstractions to the component developer.

For example, instead of manually tracking `CS` assertion and bit-shifting in your component, you extend `GenericSPIDeviceLogic` and implement `onSPITransaction()`.

## Component Migration Guide

Currently, many core components in the external `@openhw/emulator` package implement their own manual protocol parsing. The long-term architectural goal is to **migrate all existing components to use these base classes**.

### Step 1: Replace `BaseComponent`
In your component's `logic.ts`:
```diff
- import { BaseComponent } from '@openhw/emulator';
+ import { GenericI2CDeviceLogic } from './protocol-handlers/i2c-device.ts';

- export class MySensorLogic extends BaseComponent {
+ export class MySensorLogic extends GenericI2CDeviceLogic {
```

### Step 2: Remove Manual Protocol Parsing
Remove any `onPinStateChange`, bit-banging logic, or I2C state tracking.

### Step 3: Implement the High-Level API
```typescript
    onI2CReadRequest(reg: number, count: number): number[] {
        if (reg === 0x00) return [this.state.sensorData];
        return [];
    }

    onI2CWriteRegister(reg: number, data: number[]): void {
        if (reg === 0x01) this.state.config = data[0];
    }
```

By following this migration path, all components will behave consistently and correctly handle edge cases (like I2C repeated starts or PWM high-frequency noise).
