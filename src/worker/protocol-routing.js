import {
  PICO_SOFTSERIAL_PINS,
  PICO_UART_SOURCE_PINS,
  UNO_SOFTSERIAL_PINS,
  UNO_UART_PINS,
} from './board-profiles';

export function isProgrammableBoardType(type) {
  return /(arduino|rp2040|pico)/i.test(String(type || ''));
}

export function endpointAliases(endpoint) {
  const [compId, pinIdRaw] = String(endpoint || '').split(':');
  const pinId = String(pinIdRaw || '');
  if (!compId || !pinId) return [String(endpoint || '')];

  const aliases = new Set([`${compId}:${pinId}`]);
  if (/^D\d+$/i.test(pinId)) aliases.add(`${compId}:${pinId.substring(1)}`);
  if (/^\d+$/.test(pinId)) aliases.add(`${compId}:D${pinId}`);
  if (/^GPIO\d+$/i.test(pinId)) aliases.add(`${compId}:${pinId.replace(/^GPIO/i, '')}`);
  if (/^GP\d+$/i.test(pinId)) aliases.add(`${compId}:${pinId.replace(/^GP/i, '')}`);
  return Array.from(aliases);
}

function withAliases(boardId, pins) {
  const out = [];
  for (const pin of pins) {
    const ep = `${boardId}:${pin}`;
    out.push(...endpointAliases(ep));
  }
  return Array.from(new Set(out));
}

function normalizeUartSource(source) {
  const s = String(source || 'uart0').toLowerCase();
  if (s === 'uart1' || s === 'serial1' || s === '1') return 'uart1';
  if (s === 'usb' || s === 'cdc' || s === 'serialusb') return 'usb';
  return 'uart0';
}

export function getUartSources(boardType) {
  const t = String(boardType || '').toLowerCase();
  if (t.includes('rp2040') || t.includes('pico')) {
    return ['uart0', 'uart1'];
  }
  return ['uart0'];
}

export function getUartPinCandidates(boardType, source = 'uart0') {
  const t = String(boardType || '').toLowerCase();

  if (t.includes('rp2040') || t.includes('pico')) {
    const selectedSource = normalizeUartSource(source);
    if (selectedSource === 'uart1') return PICO_UART_SOURCE_PINS.uart1;
    if (selectedSource === 'usb') {
      // USB CDC is not tied to board pin endpoints, so use UART0 pins as a
      // conservative compatibility fallback for wiring checks.
      return PICO_UART_SOURCE_PINS.uart0;
    }
    return PICO_UART_SOURCE_PINS.uart0;
  }

  return UNO_UART_PINS;
}

export function getSoftwareSerialPinCandidates(boardType) {
  const t = String(boardType || '').toLowerCase();

  if (t.includes('rp2040') || t.includes('pico')) {
    return PICO_SOFTSERIAL_PINS;
  }

  // Arduino UNO / default: SoftwareSerial(11,10) => RX=11, TX=10
  return UNO_SOFTSERIAL_PINS;
}

export function resolveUartRoute(sourceBoardId, sourceType, targetBoardId, targetType, areConnected, source = 'uart0') {
  const sourcePins = getUartPinCandidates(sourceType, source);
  const sourceEndpoints = withAliases(sourceBoardId, sourcePins.tx);

  for (const targetSource of getUartSources(targetType)) {
    const targetPins = getUartPinCandidates(targetType, targetSource);
    const targetEndpoints = withAliases(targetBoardId, targetPins.rx);

    for (const src of sourceEndpoints) {
      for (const dst of targetEndpoints) {
        if (areConnected(src, dst)) {
          return { connected: true, targetSource };
        }
      }
    }
  }

  return { connected: false, targetSource: null };
}

export function areBoardsUartConnected(sourceBoardId, sourceType, targetBoardId, targetType, areConnected, source = 'uart0') {
  return resolveUartRoute(sourceBoardId, sourceType, targetBoardId, targetType, areConnected, source).connected;
}

export function areBoardsSoftSerialConnected(sourceBoardId, sourceType, targetBoardId, targetType, areConnected) {
  const source = getSoftwareSerialPinCandidates(sourceType);
  const target = getSoftwareSerialPinCandidates(targetType);

  const sourceEndpoints = withAliases(sourceBoardId, source.tx);
  const targetEndpoints = withAliases(targetBoardId, target.rx);

  for (const src of sourceEndpoints) {
    for (const dst of targetEndpoints) {
      if (areConnected(src, dst)) {
        return true;
      }
    }
  }
  return false;
}
