import { BaseComponent } from '../BaseComponent';

export class BatteryLogic extends BaseComponent {
    lastUpdate = Date.now();

    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {
            capacity: parseFloat(manifest.attrs?.capacityMah || '2000'),
            charge: parseFloat(manifest.attrs?.currentChargeMah || '2000'),
            voltage: parseFloat(manifest.attrs?.nominalVoltage || '3.7'),
            isDead: false
        };
    }

    update(cpuCycles: number, currentWires: any[], allComponents: BaseComponent[], totalCurrentDraw: number = 0) {
        const now = Date.now();
        const dtHours = (now - this.lastUpdate) / (1000 * 60 * 60);
        this.lastUpdate = now;

        if (this.state.isDead) return;

        // Discharge based on total current draw from the engine (simulated)
        // Note: totalCurrentDraw is passed from the main engine stats
        const consumption = totalCurrentDraw * dtHours; 
        let newCharge = this.state.charge - consumption;

        if (newCharge <= 0) {
            newCharge = 0;
            this.setState({ charge: 0, isDead: true, voltage: 0 });
        } else {
            // Basic discharge curve simulation
            const percentage = newCharge / this.state.capacity;
            const newVoltage = 3.2 + (percentage * 1.0); // 3.2V to 4.2V range
            this.setState({ charge: newCharge, voltage: newVoltage });
        }
    }

    onCustomTelemetry() {
        this.setCustomTelemetry({
            percentage: Math.round((this.state.charge / this.state.capacity) * 100),
            voltage: this.state.voltage.toFixed(2) + 'V',
            status: this.state.isDead ? 'Empty' : 'Discharging'
        });
    }
}
