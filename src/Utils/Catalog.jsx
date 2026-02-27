export const CATALOG = [
  { group: 'Basic', items: [
    { type: 'wokwi-led',        label: 'LED',         icon: '💡', w: 30,  h: 60,  attrs: { color: 'red' } },
    { type: 'wokwi-resistor',   label: 'Resistor',    icon: '〰️', w: 80,  h: 30,  attrs: { value: '220' } },
    { type: 'wokwi-pushbutton', label: 'Push Button', icon: '🔘', w: 40,  h: 40 },
    { type: 'wokwi-buzzer',     label: 'Buzzer',      icon: '🔊', w: 50,  h: 50 },
  ]},
  { group: 'Actuators', items: [
    { type: 'wokwi-servo',      label: 'Servo',       icon: '⚙️', w: 80,  h: 50 },
    { type: 'wokwi-neopixel',   label: 'NeoPixel',    icon: '🌈', w: 30,  h: 30 },
  ]},
  { group: 'Display', items: [
    { type: 'wokwi-lcd1602',    label: 'LCD 1602',    icon: '📺', w: 160, h: 60 },
  ]},
]