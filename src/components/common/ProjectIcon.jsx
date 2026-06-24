import React from 'react';
import openhwLed from '@openhw/emulator/src/components/openhw-led';
import openhwRGBLED from '@openhw/emulator/src/components/openhw-rgb-led';
import openhwBuzzer from '@openhw/emulator/src/components/openhw-buzzer';
import openhwPotentiometer from '@openhw/emulator/src/components/openhw-potentiometer';
import openhwPhotoresistor from '@openhw/emulator/src/components/openhw-photoresistor';
import openhwPushbutton from '@openhw/emulator/src/components/openhw-pushbutton';
import openhwServo from '@openhw/emulator/src/components/openhw-servo';
import openhwNeopixelMatrix from '@openhw/emulator/src/components/openhw-neopixel-matrix';
import openhwNtcTemperatureSensor from '@openhw/emulator/src/components/openhw-ntc-temperature-sensor';
import openhwMotor from '@openhw/emulator/src/components/openhw-motor';

export default function ProjectIcon({ slug, size = 40 }) {
  const map = {
    'led-blink': { module: openhwLed, attrs: { color: 'red' } },
    'rgb-led': { module: openhwRGBLED, attrs: {} },
    'buzzer': { module: openhwBuzzer, attrs: {} },
    'potentiometer': { module: openhwPotentiometer, attrs: {} },
    'ldr': { module: openhwPhotoresistor, attrs: {} },
    'button-debounce': { module: openhwPushbutton, attrs: { color: 'green' } },
    'servo-motor': { module: openhwServo, attrs: {} },
    'led-strip': { module: openhwNeopixelMatrix, attrs: {} },
    'temperature-sensor': { module: openhwNtcTemperatureSensor, attrs: {} },
    'dc-motor': { module: openhwMotor, attrs: {} },
  };

  const entry = map[slug];
  if (!entry || !entry.module || !entry.module.UI) return <span>🔌</span>;

  const { module, attrs } = entry;
  const Component = module.UI;
  const bounds = module.BOUNDS || { w: 100, h: 100 };
  
  // Calculate scale so the largest dimension fits inside the size box
  // Add a slight padding multiplier (0.8) so it doesn't touch the edges
  const maxDim = Math.max(bounds.w, bounds.h);
  const scale = (size / maxDim) * 0.85;

  return (
    <div style={{
      width: size, 
      height: size, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      overflow: 'hidden'
    }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Component state={{}} attrs={attrs} />
      </div>
    </div>
  );
}
