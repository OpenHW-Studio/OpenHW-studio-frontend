import {
  UNO_SOFTSERIAL_PINS,
  UNO_UART_PINS,
  PICO_UART_PINS,
  PICO_SOFTSERIAL_PINS,
  ESP32_UART_PINS,
  ESP32_SOFTSERIAL_PINS,
  STM32F1_UART_PINS,
  STM32F4_UART_PINS,
  RETRO_UART_PINS,
} from './board-profiles';

export function isProgrammableBoardType(type) {
  const s = String(type || '');
  // Camera component shells (openhw-esp32-cam) share a family token but
  // are NOT boards: classifying them as boards spawns an esp32-emu engine
  // that dies on "Unknown chip", taking the real board's run down with it.
  if (/-cam/i.test(s)) return false;
  return /(arduino|rp2040|pico|esp32|stm32|8086|8088|8085|8051|mcs-51|6502|z80|rv32|risc|retro)/i.test(s);
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

export function getUartSources(boardType) {
  // STM32F4 exposes usart1-6 (+7/8 on F407); the runner bridges uart0→usart1
  // today, so advertise uart0+uart1 and let routing resolve wired pairs.
  const t = String(boardType || '').toLowerCase();
  if (t.includes('stm32')) return ['uart0', 'uart1'];
  if (t.includes('esp32')) return ['uart0'];
  return ['uart0'];
}

export function getUartPinCandidates(boardType, source = 'uart0') {
  void source;
  const t = String(boardType || '').toLowerCase();
  if (t.includes('esp32')) return ESP32_UART_PINS;
  if (t.includes('stm32')) {
    if (t.includes('f4') || t.includes('407') || t.includes('discovery')) return STM32F4_UART_PINS;
    return STM32F1_UART_PINS;
  }
  if (t.includes('rp2040') || t.includes('pico')) return PICO_UART_PINS;
  if (t.includes('8086') || t.includes('8088') || t.includes('8085') || t.includes('8051') || t.includes('6502') || t.includes('z80') || t.includes('rv32') || t.includes('retro')) return RETRO_UART_PINS;
  return UNO_UART_PINS;
}

export function getSoftwareSerialPinCandidates(boardType) {
  const t = String(boardType || '').toLowerCase();
  if (t.includes('esp32')) return ESP32_SOFTSERIAL_PINS;
  if (t.includes('rp2040') || t.includes('pico')) return PICO_SOFTSERIAL_PINS;
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
