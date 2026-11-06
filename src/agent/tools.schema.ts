/**
 * Agent tool contract — single source of truth (§11 R0).
 *
 * Tool names + JSON schemas + trace/assert event schemas shared by:
 *  - frontend bridge (src/agent/bridge.ts) — executes on the live tab
 *  - relay copy (openhw-studio-agent-relay/src/schema.ts) — version-checked
 *  - in-browser panel (src/agent/panel.jsx) — same getTrace/assert JSON
 *
 * Wire envelopes:
 *  bridge→relay: { v:1, id, type:'bridge/hello', room, toolsVersion }
 *  relay→bridge: { v:1, id, type:'tools/call', tool, args }
 *  bridge→relay: { v:1, id, type:'tools/result', ok, result?, error? }
 *  bridge→relay: { v:1, type:'tools/progress', id, pct, note }
 *  either:       { v:1, type:'ping' } / { v:1, type:'pong' }
 */
export const AGENT_TOOLS_VERSION = 1;

export const BROWSER_TOOLS = [
  'agent.getProject',
  'agent.place',
  'agent.move',
  'agent.delete',
  'agent.setAttr',
  'agent.wire',
  'agent.unwire',
  'agent.validateCircuit',
  'agent.readComponent',
  'agent.reloadComponents',
  'agent.setFirmware',
  'agent.run',
  'agent.stop',
  'agent.interact',
  'agent.serialInput',
  'agent.startCapture',
  'agent.getTrace',
  'agent.assert',
  'agent.snapshot',
  'agent.bridgeStatus',
];

// JSON-schema params per tool (subset of full JSON Schema: type/properties/
// required/enum/default — relay validates args against these).
export const TOOL_SCHEMAS = {
  'agent.getProject': {
    type: 'object', properties: {}, additionalProperties: false,
  },
  'agent.place': {
    type: 'object',
    properties: {
      type: { type: 'string', description: 'Component type, e.g. openhw-led' },
      x: { type: 'number' }, y: { type: 'number' },
      attrs: { type: 'object' },
    },
    required: ['type', 'x', 'y'],
  },
  'agent.move': {
    type: 'object',
    properties: { id: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' } },
    required: ['id', 'x', 'y'],
  },
  'agent.delete': {
    type: 'object', properties: { id: { type: 'string' } }, required: ['id'],
  },
  'agent.setAttr': {
    type: 'object',
    properties: { id: { type: 'string' }, key: { type: 'string' }, value: {} },
    required: ['id', 'key', 'value'],
  },
  'agent.wire': {
    type: 'object',
    properties: {
      from: { type: 'string', description: "'compId:pin'" },
      to: { type: 'string', description: "'compId:pin'" },
    },
    required: ['from', 'to'],
  },
  'agent.unwire': {
    type: 'object',
    properties: { from: { type: 'string' }, to: { type: 'string' } },
    required: ['from', 'to'],
  },
  'agent.validateCircuit': {
    type: 'object', properties: {}, additionalProperties: false,
  },
  'agent.readComponent': {
    type: 'object', properties: { type: { type: 'string' } }, required: ['type'],
  },
  'agent.reloadComponents': {
    type: 'object',
    properties: { types: { type: 'array', items: { type: 'string' } } },
    required: ['types'],
  },
  'agent.setFirmware': {
    type: 'object',
    properties: {
      boardId: { type: 'string' },
      hex: { type: 'string' },
      pythonFiles: { type: 'object' },
      baud: { type: 'number' },
    },
    required: ['boardId'],
  },
  'agent.run': {
    type: 'object',
    properties: {
      capture: {
        type: 'object',
        properties: {
          budgetMs: { type: 'number', default: 3000 },
          watch: {
            type: 'object',
            properties: {
              pins: { type: 'array', items: { type: 'string' } },
              serial: { type: 'boolean' },
              components: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { id: { type: 'string' }, keys: { type: 'array', items: { type: 'string' } } },
                  required: ['id'],
                },
              },
            },
          },
        },
      },
    },
  },
  'agent.stop': {
    type: 'object', properties: { runId: { type: 'string' } },
  },
  'agent.interact': {
    type: 'object',
    properties: {
      runId: { type: 'string' }, compId: { type: 'string' }, event: { type: 'string' },
    },
    required: ['compId', 'event'],
  },
  'agent.serialInput': {
    type: 'object',
    properties: {
      runId: { type: 'string' }, boardId: { type: 'string' }, bytes: { type: 'string' },
    },
    required: ['boardId', 'bytes'],
  },
  'agent.startCapture': {
    type: 'object',
    properties: {
      runId: { type: 'string' },
      watch: {
        type: 'object',
        properties: {
          pins: { type: 'array', items: { type: 'string' } },
          serial: { type: 'boolean' },
          components: {
            type: 'array',
            items: {
              type: 'object',
              properties: { id: { type: 'string' }, keys: { type: 'array', items: { type: 'string' } } },
              required: ['id'],
            },
          },
        },
      },
    },
    required: ['watch'],
  },
  'agent.getTrace': {
    type: 'object',
    properties: {
      runId: { type: 'string' },
      sinceSeq: { type: 'number', default: 0 },
      limit: { type: 'number', default: 500 },
    },
  },
  'agent.assert': {
    type: 'object',
    properties: {
      runId: { type: 'string' },
      assertions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            when: { type: 'object' },
            expect: { type: 'object' },
            withinMs: { type: 'number' },
          },
          required: ['id', 'expect'],
        },
      },
    },
    required: ['assertions'],
  },
  'agent.snapshot': {
    type: 'object',
    properties: { runId: { type: 'string' }, kind: { type: 'string', enum: ['full'] } },
  },
  'agent.bridgeStatus': {
    type: 'object', properties: {}, additionalProperties: false,
  },
};

// Trace event schema (§11.4): stable, versioned, sim-time stamped.
// { seq, cycles, simTimeMs, kind, ...payload } where kind ∈
// PinChange { boardId, pin, state } | SerialOutput { boardId, data, source }
// | ComponentState { id, key, value } | RunEvent { code, message? }.
export const TRACE_EVENT_KINDS = ['PinChange', 'SerialOutput', 'ComponentState', 'RunEvent'];

export const TRACE_CAPS = {
  maxEvents: 500,
  maxPayloadBytes: 1024 * 1024,
};

export function validateToolCall(tool, args) {
  if (!BROWSER_TOOLS.includes(tool)) {
    return { ok: false, error: `unknown tool: ${tool}` };
  }
  const schema = TOOL_SCHEMAS[tool];
  if (schema?.required) {
    for (const key of schema.required) {
      if (args?.[key] === undefined) {
        return { ok: false, error: `missing required arg: ${key}` };
      }
    }
  }
  return { ok: true };
}
