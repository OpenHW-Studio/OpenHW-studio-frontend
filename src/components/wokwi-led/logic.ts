import { BaseComponent } from '../BaseComponent';

export class LEDLogic extends BaseComponent {
    voltageDrop = 1.8;

    private hasResistorInConnectedPath(currentWires: any[], allComponentsInstances: BaseComponent[]): boolean {
        const startNodes = new Set([`${this.id}:A`, `${this.id}:K`]);
        const visitedNodes = new Set<string>();
        const queue: string[] = Array.from(startNodes);

        while (queue.length > 0) {
            const node = queue.shift()!;
            if (visitedNodes.has(node)) continue;
            visitedNodes.add(node);

            for (const wire of currentWires) {
                if (wire.from === node || wire.to === node) {
                    const nextNode = wire.from === node ? wire.to : wire.from;
                    if (!visitedNodes.has(nextNode)) {
                        queue.push(nextNode);
                    }
                }
            }

            const [compId] = node.split(':');
            const comp = allComponentsInstances.find((c) => c.id === compId);
            if (comp?.type === 'wokwi-resistor') {
                return true;
            }
        }

        return false;
    }

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {
            illuminated: false,
            brightness: 0,
            color: manifest.attrs?.color || 'red',
            burnedOut: false,
            glow: false,
            vHistory: []
        };
    }

    getConductance() {
        const vA = this.getPinVoltage('A');
        const vK = this.getPinVoltage('K');
        const vDiff = vA - vK;
        if (vDiff >= 1.8) return 0.1; // Conducting (10 ohms equivalent)
        if (vDiff >= 1.5) return 0.01; // Starting to conduct
        if (vDiff <= -5.0) return 0.1; // Reverse breakdown conduction
        return 1e-9; // Non-conducting
    }

    update(cpuCycles: number, currentWires: any[], allComponentsInstances: BaseComponent[]) {
        if (this.state.burnedOut) return;

        const vA = this.getPinVoltage('A');
        const vK = this.getPinVoltage('K');
        const voltageDiff = vA - vK;

        const myPins = [`${this.id}:A`, `${this.id}:K`];
        const isWired = this.state.isWired ?? currentWires.some(w => myPins.includes(w.from) || myPins.includes(w.to));

        const hasResistor = this.state.hasResistor ?? this.hasResistorInConnectedPath(currentWires, allComponentsInstances);

        // Forward burnout (Over-current)
        if (isWired && voltageDiff > 4.0 && !hasResistor) {
            this.setState({ illuminated: false, brightness: 0, burnedOut: true });
            return;
        }

        // Reverse burnout (Breakdown)
        if (isWired && voltageDiff < -5.0) {
            this.setState({ illuminated: false, brightness: 0, burnedOut: true });
            return;
        }

        const vDropActual = Math.max(0, Math.min(voltageDiff, this.voltageDrop));
        
        // Simple current estimation: If we have a resistor in the path, 
        // the current is (TotalV - Vdrop) / R. 
        // We'll show the voltage drop across the LED specifically.
        if (voltageDiff >= 1.5) {
            const vHistory = [...(this.state.vHistory || []).slice(-19), voltageDiff];
            const current = Math.max(0, voltageDiff - 1.5) / 220;
            this.setState({ 
                illuminated: true, 
                brightness: 255,
                voltageDrop: vDropActual,
                current: current,
                glow: current > 0.015, // Glow if > 15mA
                vHistory
            });
        } else {
            const vHistory = [...(this.state.vHistory || []).slice(-19), voltageDiff > 0 ? voltageDiff : 0];
            this.setState({ 
                illuminated: false, 
                brightness: 0,
                voltageDrop: voltageDiff > 0 ? voltageDiff : 0,
                current: 0,
                glow: false,
                vHistory
            });
        }
    }

    onCustomTelemetry() {
        let status = 'off';
        if (this.state.burnedOut) status = 'burnedOut';
        else if (this.state.illuminated && this.state.brightness > 200) status = 'fully lit';
        else if (this.state.illuminated) status = 'dim';

        this.setCustomTelemetry({
            status,
            color: this.state.color,
            voltageDrop: (this.state.voltageDrop || 0).toFixed(2) + ' V',
            current: ((this.state.current || 0) * 1000).toFixed(2) + ' mA'
        });
    }
}
