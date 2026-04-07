import { BaseComponent } from '../BaseComponent';

export function validate(component: BaseComponent, instances: BaseComponent[], wires: any[]): any[] {
    const warnings: any[] = [];
    
    // Check required pins: VCC, GND, SDA, SCL
    const requiredPins = ['VCC', 'GND', 'SDA', 'SCL'];
    
    for (const pinId of requiredPins) {
        let isConnected = false;
        for (const w of wires) {
            if (w.from === `${component.id}:${pinId}` || w.to === `${component.id}:${pinId}`) {
                isConnected = true;
                break;
            }
        }
        
        if (!isConnected) {
            warnings.push({
                type: 'warning',
                componentId: component.id,
                message: `LCD 16x2 I2C pin ${pinId} is not connected.`
            });
        }
    }
    
    return warnings;
}
