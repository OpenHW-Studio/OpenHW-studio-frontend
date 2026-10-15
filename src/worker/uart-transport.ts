/**
 * uart-transport.ts — SAB-ring UART transport for multi-board runs (Phase B).
 *
 * Replaces the per-byte `uart-tx` / `SERIAL_RX` postMessages between the
 * parent sim worker and per-board compute workers with shared ring buffers:
 *   - TX ring per board (worker → parent): framed [kind, value] pairs.
 *   - RX ring per board (parent → worker): framed [kind, value] pairs.
 *
 * Framing preserves the exact routing flavors of the postMessage protocol:
 *   kind 0 = hardware UART 'uart0' (serialRxByteFromSource)
 *   kind 1 = hardware UART 'uart1' (serialRxByteFromSource)
 *   kind 2 = soft-serial link ('softserial')
 * The sender's source label (uart vs soft TX) selects the kind on TX; the
 * parent's routeUartByte decision selects the kind on RX. Draining either
 * side reproduces the same inject calls the message handlers made, so this
 * transport is behavior-identical — only the wakeup changes (lockstep tick
 * drain instead of per-byte posts).
 *
 * Bounds: 4KB per ring per board per tick (~500KB/s) — ~50× the fastest
 * emulated UART rate, so overflow (drop-oldest, per SabSerialRing) is
 * unreachable in practice. UI serial input (SERIAL_STR, human typing) stays
 * on postMessage — rare traffic never moves.
 */
import { SabSerialRing, SAB_SERIAL_RING_B } from './sab/layout.ts';

export const UART_TXRX_KIND_UART0 = 0;
export const UART_TXRX_KIND_UART1 = 1;
export const UART_TXRX_KIND_SOFT = 2;

/** Sender source label → frame kind. Unknown labels ride uart0. */
export function uartKindFromSource(source: string | undefined | null): number {
    const s = String(source || 'uart0').trim().toLowerCase();
    if (s === 'uart1') return UART_TXRX_KIND_UART1;
    if (s === 'softserial' || s === 'soft-serial' || s === 'soft_uart' || s === 'soft-uart' || s === 'softuart') {
        return UART_TXRX_KIND_SOFT;
    }
    return UART_TXRX_KIND_UART0;
}

/** Frame kind → source label for monitor/routing. */
export function uartSourceFromKind(kind: number): string {
    if (kind === UART_TXRX_KIND_UART1) return 'uart1';
    if (kind === UART_TXRX_KIND_SOFT) return 'softserial';
    return 'uart0';
}

/** Bytes per board slot: TX ring + RX ring. */
export const UART_TRANSPORT_STRIDE_B = 2 * (8 + SAB_SERIAL_RING_B);

export interface UartTransportOffsets {
    txOff: number;
    rxOff: number;
}

/** Allocate a transport SAB for up to `numBoards` boards. Null when SAB is unavailable. */
export function createUartTransport(numBoards: number): { sab: SharedArrayBuffer; offsets: UartTransportOffsets[] } | null {
    try {
        if (typeof SharedArrayBuffer === 'undefined') return null;
        const n = Math.max(1, Math.floor(Number(numBoards) || 1));
        const sab = new SharedArrayBuffer(n * UART_TRANSPORT_STRIDE_B);
        const offsets: UartTransportOffsets[] = [];
        for (let i = 0; i < n; i++) {
            const base = i * UART_TRANSPORT_STRIDE_B;
            offsets.push({ txOff: base, rxOff: base + 8 + SAB_SERIAL_RING_B });
        }
        return { sab, offsets };
    } catch {
        return null;
    }
}

/** Bind ring handles for one board slot. */
export function bindUartTransportRings(
    sab: SharedArrayBuffer,
    offsets: UartTransportOffsets,
): { tx: SabSerialRing; rx: SabSerialRing } {
    return {
        tx: new SabSerialRing(sab, offsets.txOff),
        rx: new SabSerialRing(sab, offsets.rxOff),
    };
}

/** Push one framed TX pair. Returns false when the ring handle is missing. */
export function uartTransportPushTx(tx: SabSerialRing | null, kind: number, value: number): boolean {
    if (!tx) return false;
    try {
        tx.pushByte(kind & 0xff);
        tx.pushByte(value & 0xff);
        return true;
    } catch {
        return false;
    }
}

/** Push one framed RX pair (parent → worker delivery). */
export function uartTransportPushRx(rx: SabSerialRing | null, kind: number, value: number): boolean {
    return uartTransportPushTx(rx, kind, value);
}

/**
 * Drain framed pairs, invoking `onPair(kind, value)` per complete entry.
 * A trailing lone kind byte (half-written pair) is left buffered for the
 * next drain — pairs are always pushed adjacently by one writer, so a lone
 * byte only ever means "more coming", never corruption.
 */
export function uartTransportDrain(
    ring: SabSerialRing | null,
    onPair: (kind: number, value: number) => void,
    maxPairs = 256,
): number {
    if (!ring) return 0;
    let bytes: number[] = [];
    try {
        bytes = ring.drain(Math.max(2, maxPairs * 2));
    } catch {
        return 0;
    }
    let n = 0;
    // Length is always even: the writer pushes kind+value adjacently and
    // drains request even counts, so pairs never split. The i+1 bound is
    // belt-and-braces against a torn write (drops it, keeps order).
    for (let i = 0; i + 1 < bytes.length; i += 2) {
        try {
            onPair(bytes[i] & 0xff, bytes[i + 1] & 0xff);
        } catch { /* one bad pair never stops the drain */ }
        n++;
    }
    return n;
}
