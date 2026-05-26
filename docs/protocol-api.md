# Protocol API Reference

This document outlines the high-level API exposed by each Protocol Base Class in the `protocol-handlers` directory.

## I2C (`GenericI2CDeviceLogic`)

Automatically tracks I2C start/stop conditions, ACK handling, and byte transmission.

- `getI2CAddress(): number` - Override to provide dynamic addressing.
- `onI2CReadRequest(reg: number, count: number): number[]` - Triggered when the master reads data.
- `onI2CWriteRegister(reg: number, data: number[]): void` - Triggered when the master finishes writing data.
- `onI2CStopCondition(): void` - Optional hook for general stop conditions.

## SPI (`GenericSPIDeviceLogic`)

Automatically manages CS assertion and full-frame buffering.

- `getCSPinName(): string` - Defines which pin acts as Chip Select.
- `onSPITransaction(command: number, payload: number[]): number[]` - Triggered on CS de-assertion for full frame processing.
- `onSPIByteExchange(byte: number, byteIndex: number): number` - Alternative byte-by-byte full-duplex exchange hook.

## PWM (`GenericPWMDeviceLogic`)

Performs rolling-window averaging to filter high-frequency noise and jitter.

- `getPWMPinNames(): string[]` - List of pins to monitor.
- `onPWMSignal(pinId: string, frequencyHz: number, dutyCycle: number, pulseUs: number): void` - Triggered when a stable PWM signal is detected.

## Digital (`GenericDigitalDeviceLogic`)

Provides edge detection and optional cycle-accurate debouncing.

- `getDebounceCycles(): number` - Override to set hardware debounce.
- `onRisingEdge(pinId: string, cycles: number): void`
- `onFallingEdge(pinId: string, cycles: number): void`

## Analog (`GenericAnalogDeviceLogic`)

Tracks voltage changes over a rolling window to detect meaningful threshold changes (simulated ADC).

- `getAnalogPinName(): string` - The primary analog pin.
- `onAnalogVoltageChange(pinId: string, voltage: number, rawAdc: number): void` - Triggered when the average voltage shifts past the threshold.

## UART (`GenericUARTDeviceLogic`)

Handles software serial decoding and optional TX injection.

- `getTXPinName(): string`
- `onUARTByte(byte: number): void` - Triggered when a byte is fully decoded or injected.

## OneWire (`GenericOneWireDeviceLogic`)

Implements the 1-Wire ROM command state machine (e.g., for DS18B20).

- `getROMAddress(): number[]` - Returns the 64-bit device ROM.
- `onConvertTemperature(): void` - Triggered on `0x44` command.
- `onReadScratchpad(): number[]` - Triggered on `0xBE` command.

## I2S (`GenericI2SDeviceLogic`)

Collects left/right audio samples by listening to BCLK and WS (LRCK).

- `getI2SBitsPerFrame(): number` - Defines audio resolution (e.g., 16, 24, 32).
- `onI2SFrame(channel: 0|1, sample: number, bitsPerFrame: number): void` - Triggered when a full channel sample is decoded.
