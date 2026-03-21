import { AVRRunner, LOGIC_REGISTRY, COMPONENT_PINS } from './execute';
import { BaseComponent } from '@openhw/emulator/src/components/BaseComponent.ts';

function isProgrammableBoardType(type: string): boolean {
    return /(arduino|esp32|stm32|rp2040|pico)/i.test(type || '');
}

let runner: AVRRunner | null = null;
let boardRunners: Map<string, AVRRunner> = new Map();
let mode: 'single' | 'multi' = 'single';
let pinToNet: Map<string, number> = new Map();

function stopAllRunners() {
    if (runner) {
        runner.stop();
        runner = null;
    }
    boardRunners.forEach((r) => r.stop());
    boardRunners.clear();
    pinToNet.clear();
}

function endpointAliases(endpoint: string): string[] {
    const [compId, pinId] = endpoint.split(':');
    if (!compId || !pinId) return [endpoint];

    const aliases = new Set<string>([endpoint]);
    if (/^\d+$/.test(pinId)) aliases.add(`${compId}:D${pinId}`);
    if (/^D\d+$/i.test(pinId)) aliases.add(`${compId}:${pinId.substring(1)}`);
    return Array.from(aliases);
}

function buildNetIndex(wires: any[]) {
    const adj = new Map<string, string[]>();

    for (const wire of wires || []) {
        if (!adj.has(wire.from)) adj.set(wire.from, []);
        if (!adj.has(wire.to)) adj.set(wire.to, []);
        adj.get(wire.from)!.push(wire.to);
        adj.get(wire.to)!.push(wire.from);
    }

    const visited = new Set<string>();
    pinToNet.clear();
    let currentNet = 0;

    for (const startNode of adj.keys()) {
        if (visited.has(startNode)) continue;
        const queue = [startNode];
        visited.add(startNode);
        while (queue.length > 0) {
            const node = queue.shift()!;
            pinToNet.set(node, currentNet);
            endpointAliases(node).forEach((alias) => pinToNet.set(alias, currentNet));

            for (const neighbor of adj.get(node) || []) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }
        currentNet++;
    }
}

function areConnected(pinA: string, pinB: string): boolean {
    const netA = pinToNet.get(pinA);
    const netB = pinToNet.get(pinB);
    return netA !== undefined && netA === netB;
}

function postRunnerState(stateObj: any, boardId: string) {
    if (mode === 'single') {
        postMessage(stateObj);
        return;
    }

    if (stateObj.type !== 'state') {
        postMessage({ ...stateObj, boardId });
        return;
    }

    const msg: any = { type: 'state', boardId };

    if (stateObj.pins) msg.pins = stateObj.pins;

    if (stateObj.analog) msg.analog = stateObj.analog;
    if (stateObj.components) msg.components = stateObj.components;
    postMessage(msg);
}

function routeUartByte(sourceBoardId: string, value: number) {
    const sourceRunner = boardRunners.get(sourceBoardId);
    const sourceBaud = sourceRunner?.getSerialBaudRate?.() ?? 9600;

    for (const [targetBoardId, targetRunner] of boardRunners.entries()) {
        if (targetBoardId === sourceBoardId) continue;

        const sourceTx = `${sourceBoardId}:1`;
        const targetRx = `${targetBoardId}:0`;
        if (areConnected(sourceTx, targetRx)) {
            targetRunner.setSerialBaudRate(sourceBaud);
            targetRunner.serialRxByte(value);
        }
    }
}

self.onmessage = async (e) => {
    const data = e.data;

    if (data.type === 'START') {
        const { hex, components, wires, customLogics, boardHexMap, baudRate, boardBaudMap } = data;

        stopAllRunners();

        // --- INJECT TEMPORARY SANDBOX LOGIC ---
        if (customLogics && Array.isArray(customLogics)) {
            customLogics.forEach((cl: any) => {
                try {
                    const exportsObj: any = {};
                    const requireFn = (mod: string) => {
                        if (mod.includes('BaseComponent')) return { BaseComponent };
                        return {};
                    };
                    const evalFn = new Function('exports', 'require', cl.code);
                    evalFn(exportsObj, requireFn);

                    const LogicClass = exportsObj[Object.keys(exportsObj)[0]] || exportsObj.default;
                    if (LogicClass) {
                        LOGIC_REGISTRY[cl.type] = LogicClass;
                        COMPONENT_PINS[cl.type] = cl.pins;
                        console.log(`[Worker] Sandbox injected component logic for: ${cl.type}`);
                    }
                } catch (e) {
                    console.error(`[Worker] Failed to inject sandbox logic for ${cl.type}:`, e);
                }
            });
        }

        const unoComponents = (components || []).filter((c: any) => c.type === 'wokwi-arduino-uno');
        const sharedPeripheralComponents = (components || []).filter((c: any) => !isProgrammableBoardType(c.type));

        if (unoComponents.length <= 1) {
            mode = 'single';
            runner = new AVRRunner(
                hex,
                components,
                wires,
                (stateObj) => postMessage(stateObj),
                {
                    boardId: unoComponents[0]?.id,
                    serialBaudRate: Number(boardBaudMap?.[unoComponents[0]?.id] ?? baudRate ?? 9600),
                }
            );
            return;
        }

        mode = 'multi';
        buildNetIndex(wires || []);

        unoComponents.forEach((uno: any) => {
            const fwHex = boardHexMap?.[uno.id] || uno?.attrs?.firmwareHex || uno?.attrs?.hex || hex;
            const runnerComponents = [uno, ...sharedPeripheralComponents];

            const boardRunner = new AVRRunner(
                fwHex,
                runnerComponents,
                wires,
                (stateObj) => postRunnerState(stateObj, uno.id),
                {
                    boardId: uno.id,
                    serialBaudRate: Number(boardBaudMap?.[uno.id] ?? baudRate ?? 9600),
                    onByteTransmit: ({ boardId, value, char }) => {
                        postMessage({ type: 'serial', data: char, boardId, value });
                        routeUartByte(boardId, value);
                    },
                }
            );

            boardRunners.set(uno.id, boardRunner);
        });

    } else if (data.type === 'STOP') {
        stopAllRunners();
    } else if (data.type === 'INTERACT') {
        console.log(`[Worker] Received INTERACT for ${data.compId}: ${data.event}`);

        if (mode === 'single' && runner) {
            runner.onEvent(data.compId, data.event);
        } else {
            let delivered = false;
            for (const boardRunner of boardRunners.values()) {
                const inst = boardRunner.instances.get(data.compId);
                if (inst) {
                    boardRunner.onEvent(data.compId, data.event);
                    delivered = true;
                }
            }
            if (!delivered) {
                console.warn(`[Worker] INTERACT target not found in any runner: ${data.compId}`);
            }
        }
    } else if (data.type === 'SERIAL_INPUT') {
        if (mode === 'single' && runner) {
            if (data.baudRate) runner.setSerialBaudRate(Number(data.baudRate));
            runner.serialRx(data.data);
        } else {
            if (data.targetBoardId) {
                if (!boardRunners.has(data.targetBoardId)) {
                    return;
                }
                const target = boardRunners.get(data.targetBoardId)!;
                if (data.baudRate) target.setSerialBaudRate(Number(data.baudRate));
                target.serialRx(data.data);
            } else {
                boardRunners.forEach((boardRunner) => {
                    if (data.baudRate) boardRunner.setSerialBaudRate(Number(data.baudRate));
                    boardRunner.serialRx(data.data);
                });
            }
        }
    } else if (data.type === 'RESET') {
        if (mode === 'single' && runner && runner.cpu) {
            runner.cpu.reset();
        } else {
            boardRunners.forEach((boardRunner) => {
                if (boardRunner.cpu) boardRunner.cpu.reset();
            });
        }
    }
};
