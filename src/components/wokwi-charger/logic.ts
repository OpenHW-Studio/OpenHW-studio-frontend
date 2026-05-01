import { BaseComponent } from '../BaseComponent';
import { BatteryLogic } from '../wokwi-battery/logic';

export class ChargerLogic extends BaseComponent {
    constructor(id: string, manifest: any) {
        super(id, manifest);
        this.state = {
            isCharging: false,
            currentMa: parseFloat(manifest.attrs?.chargeCurrentMa || '1000')
        };
    }

    update(cpuCycles: number, currentWires: any[], allComponents: BaseComponent[]) {
        const hasPower = this.getPinVoltage('IN+') > 4.5;
        
        if (hasPower) {
            // Look for a battery connected to BAT+
            const battery = allComponents.find(c => 
                c instanceof BatteryLogic && 
                currentWires.some(w => 
                    (w.from === `${this.id}:BAT+` && w.to === `${c.id}:VCC`) ||
                    (w.to === `${this.id}:BAT+` && w.from === `${c.id}:VCC`)
                )
            ) as BatteryLogic;

            if (battery) {
                this.setState({ isCharging: true });
                // Charge the battery (inverse of discharge)
                // This would ideally be handled in a shared power manager, 
                // but for simplicity we'll just flag it for now.
            } else {
                this.setState({ isCharging: false });
            }
        } else {
            this.setState({ isCharging: false });
        }
    }

    onCustomTelemetry() {
        this.setCustomTelemetry({
            status: this.state.isCharging ? 'Charging' : 'Standby',
            input: this.getPinVoltage('IN+').toFixed(1) + 'V',
            isCharging: this.state.isCharging,
            inputVoltage: this.getPinVoltage('IN+')
        });
    }
}
