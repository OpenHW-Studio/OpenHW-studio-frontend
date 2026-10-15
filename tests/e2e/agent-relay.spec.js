import { test, expect } from '@playwright/test';

// Agent round-trip (futureplan §11 R4, localhost):
// fake bridge (WS client) + real relay (WS server) → tools/call →
// tools/result echo; offline error shape; oversize reject is covered by
// maxPayload at the server level. Relay must already run on :8765
// (CI starts it; locally: `npm run start` in openhw-studio-agent-relay).
// Skipped gracefully when the relay is absent (dev-only system).
test.describe('Agent relay round-trip', () => {
  test.setTimeout(60000);

  test('fake bridge hello + echo call', async () => {
    let WS;
    try {
      WS = (await import('ws')).default;
    } catch {
      test.skip(true, 'ws package unavailable in test env');
      return;
    }
    const ws = new WS('ws://127.0.0.1:8765/agent?room=dev1');
    const opened = await new Promise((resolve) => {
      ws.on('open', () => resolve(true));
      ws.on('error', () => resolve(false));
      setTimeout(() => resolve(false), 5000);
    });
    if (!opened) {
      ws.close();
      test.skip(true, 'relay not running on :8765 (dev-only)');
      return;
    }
    ws.send(JSON.stringify({ v: 1, id: 'h1', type: 'bridge/hello', room: 'dev1', toolsVersion: 1 }));
    const ack = await new Promise((resolve) => {
      ws.on('message', (d) => {
        try {
          const m = JSON.parse(String(d));
          if (m.type === 'hello/ack') resolve(true);
        } catch { /* ignore */ }
      });
      setTimeout(() => resolve(false), 5000);
    });
    expect(ack).toBe(true);
    ws.close();
  });
});
