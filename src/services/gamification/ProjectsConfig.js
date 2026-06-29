
import { PROJECT_DATA, getOpenhwType } from './ProjectData';

export const PROJECTS = [
  // ── World 1: Circuit Basics ──────────────────────────────────────────────
  {
    id: 'led-blink',
    slug: 'led-blink',
    number: 1,
    prerequisite: null, // Always available — no unlock needed
    title: 'LED Blink',
    subtitle: 'The "Hello, World" of hardware',
    description:
      'Make an LED blink on and off. This is the very first project every maker builds! ' +
      'You will learn how to turn a light on and off using code.',
    difficulty: 'beginner',
    difficultyLabel: 'Beginner',
    estimatedTime: '15 min',
    xpReward: 100,
    color: '#22c55e',
    icon: '💡',
    world: 1,
    tags: ['LED', 'digital output', 'blinking'],
    // Components available at start (given for free — no unlock needed)
    startingComponents: ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor'],
    // What you EARN when you finish this project
    rewardComponents: [
      { type: 'openhw-rgb-led', name: 'RGB LED', icon: '🌈', description: 'A special LED that can glow red, green, blue, or any mix of colors!' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-led', label: 'LED (any color)', qty: 1 },
      { type: 'openhw-resistor', label: '220Ω Resistor', qty: 1, attrs: { value: '220' } },
    ],
    wiring: [
      { from: 'Arduino pin 13', to: 'LED anode (+)' },
      { from: 'LED cathode (−)', to: '220Ω resistor' },
      { from: 'Resistor', to: 'Arduino GND' },
    ],
    starterCode: `void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);  // Turn LED ON
  delay(1000);              // Wait 1 second
  digitalWrite(13, LOW);   // Turn LED OFF
  delay(1000);              // Wait 1 second
}`,
    concepts: ['pinMode()', 'digitalWrite()', 'delay()', 'Digital output', 'LED polarity'],
    kidFriendlyTip: '💡 Tip: The LED has a long leg (+) and a short leg (−). The long leg goes toward the Arduino, and the short leg goes toward the resistor!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: {
          description: 'Correct components placed',
          weight: 0.3,
          required: [
            { type: 'arduino', count: 1 },
            { type: 'led', count: 1 },
            { type: 'resistor', count: 1 },
          ],
        },
        wiringAccuracy: {
          description: 'Correct wiring',
          weight: 0.3,
          requiredConnections: [
            { from: { component: 'arduino', pin: '13' }, to: { component: 'led', terminal: 'A' } },
            { from: { component: 'led', terminal: 'K' }, to: { component: 'resistor', terminal: '1' } },
            { from: { component: 'resistor', terminal: '2' }, to: { component: 'arduino', pin: 'GND.1' } },
          ],
          alternativeConnections: [
            [
              { from: { component: 'arduino', pin: '13' }, to: { component: 'resistor', terminal: '1' } },
              { from: { component: 'resistor', terminal: '2' }, to: { component: 'led', terminal: 'A' } },
              { from: { component: 'led', terminal: 'K' }, to: { component: 'arduino', pin: 'GND.1' } },
            ]
          ]
        },
        codeFunctionality: {
          description: 'Code blinks LED correctly',
          weight: 0.4,
          requiredFunctions: ['setup', 'loop'],
          expectedBehavior: { pinNumber: 13, pinMode: 'OUTPUT', pattern: 'alternating high/low', blinkDelay: 1000 },
        },
      },
    },
    badge: {
      id: 'badge_led_blink',
      name: 'First Light',
      description: 'Made your first LED blink!',
      icon: '💡',
      rarity: 'common',
    },
  },

  {
    id: 'rgb-led',
    slug: 'rgb-led',
    number: 2,
    prerequisite: 'led-blink',
    title: 'RGB LED',
    subtitle: 'Mix any color you want!',
    description:
      'Control a special LED that can show ANY color. Red, green, blue — or mix them to make purple, yellow, cyan, and more! ' +
      'You will learn how to control brightness using PWM (a cool trick where the Arduino blinks super fast).',
    difficulty: 'beginner',
    difficultyLabel: 'Beginner',
    estimatedTime: '20 min',
    xpReward: 150,
    color: '#a855f7',
    icon: '🌈',
    world: 1,
    tags: ['PWM', 'RGB', 'color mixing'],
    startingComponents: ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor'],
    rewardComponents: [
      { type: 'openhw-buzzer', name: 'Buzzer', icon: '🔔', description: 'Makes sounds and tones — you can even play music with it!' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-led', label: 'LED (1 Red, 1 Green, 1 Blue)', qty: 3 },
      { type: 'openhw-resistor', label: '220Ω Resistor', qty: 3, attrs: { value: '220' } },
    ],
    wiring: [
      { from: 'Arduino pin 9', to: 'Red LED via Resistor' },
      { from: 'Arduino pin 10', to: 'Green LED via Resistor' },
      { from: 'Arduino pin 11', to: 'Blue LED via Resistor' },
      { from: 'All LED Cathodes', to: 'Arduino GND' },
    ],
    starterCode: `int redPin   = 9;
int greenPin = 10;
int bluePin  = 11;

void setup() {
  pinMode(redPin,   OUTPUT);
  pinMode(greenPin, OUTPUT);
  pinMode(bluePin,  OUTPUT);
}

void setColor(int r, int g, int b) {
  analogWrite(redPin,   r);
  analogWrite(greenPin, g);
  analogWrite(bluePin,  b);
}

void loop() {
  setColor(255, 0,   0);   // Red
  delay(1000);
  setColor(0,   255, 0);   // Green
  delay(1000);
  setColor(0,   0,   255); // Blue
  delay(1000);
  setColor(255, 255, 0);   // Yellow!
  delay(1000);
}`,
    concepts: ['analogWrite()', 'PWM', 'RGB color model', 'Color mixing'],
    kidFriendlyTip: '🌈 Tip: analogWrite() sends a number from 0 (off) to 255 (full brightness). Mix red, green, and blue to make any color — just like mixing paint!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'led', count: 3 }, { type: 'resistor', count: 3 }] },
        wiringAccuracy: {
          description: 'Correct wiring',
          weight: 0.3,
          requiredConnections: [
            // We just require 3 LEDs connected to pins 9, 10, 11 (with resistors in between)
            // Since we can't easily distinguish which LED is which color in Wokwi JSON without reading the 'color' attribute,
            // we will let the assessment engine handle it via flexible matching if needed, or we just require the topology.
          ],
          // Add custom validation for the 3-LED topology
          customWiringCheck: 'rgb-discrete'
        },
        codeFunctionality: { description: 'Code changes LED colors', weight: 0.4, requiredFunctions: ['setup', 'loop', 'setColor'] },
      },
    },
    badge: {
      id: 'badge_rgb_led',
      name: 'Rainbow Maker',
      description: 'Mixed colors with an RGB LED!',
      icon: '🌈',
      rarity: 'common',
    },
  },

  {
    id: 'buzzer',
    slug: 'buzzer',
    number: 3,
    prerequisite: 'rgb-led',
    title: 'Buzzer Music',
    subtitle: 'Make your Arduino sing!',
    description:
      'Use a buzzer to play tones and melodies! You can even program it to play songs like Twinkle Twinkle Little Star. ' +
      'Learn how sound is made by vibrating air super fast.',
    difficulty: 'beginner',
    difficultyLabel: 'Beginner',
    estimatedTime: '20 min',
    xpReward: 120,
    color: '#f59e0b',
    icon: '🎵',
    world: 1,
    tags: ['sound', 'buzzer', 'tone'],
    startingComponents: ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor', 'openhw-rgb-led', 'openhw-buzzer'],
    rewardComponents: [
      { type: 'openhw-potentiometer', name: 'Potentiometer', icon: '🎛️', description: 'A knob you can turn! It lets you control things by rotating it.' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-buzzer', label: 'Passive Buzzer', qty: 1 },
    ],
    wiring: [
      { from: 'Arduino pin 8', to: 'Buzzer positive (+)' },
      { from: 'Buzzer negative (−)', to: 'Arduino GND' },
    ],
    starterCode: `// Twinkle Twinkle Little Star!
// Each note has a frequency (Hz) — higher = higher pitch

void setup() {
  // nothing to set up
}

void playNote(int pin, int freq, int duration) {
  tone(pin, freq, duration);
  delay(duration + 50);
}

void loop() {
  int buzzer = 8;

  // C  C  G  G  A  A  G
  playNote(buzzer, 262, 400); // C - Twin-
  playNote(buzzer, 262, 400); // C - kle
  playNote(buzzer, 392, 400); // G - twin-
  playNote(buzzer, 392, 400); // G - kle
  playNote(buzzer, 440, 400); // A - lit-
  playNote(buzzer, 440, 400); // A - tle
  playNote(buzzer, 392, 800); // G - star

  delay(2000); // Pause before repeating
}`,
    concepts: ['tone()', 'noTone()', 'Sound frequency', 'Musical notes'],
    kidFriendlyTip: '🎵 Tip: tone(pin, frequency, duration) plays a sound! Frequency is measured in Hz — the higher the number, the higher-pitched the sound. Middle C is 262 Hz!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'buzzer', count: 1 }] },
        wiringAccuracy: {
          description: 'Correct wiring',
          weight: 0.3,
          requiredConnections: [
            { from: { component: 'arduino', pin: '8' }, to: { component: 'buzzer', pin: 'SIG' } },
            { from: { component: 'buzzer', pin: 'GND' }, to: { component: 'arduino', pin: 'GND' } }
          ],
          alternativeConnections: [
            [
              { from: { component: 'arduino', pin: '8' }, to: { component: 'buzzer', pin: '1' } },
              { from: { component: 'buzzer', pin: '2' }, to: { component: 'arduino', pin: 'GND' } }
            ],
            [
              { from: { component: 'arduino', pin: '8' }, to: { component: 'buzzer', pin: '2' } },
              { from: { component: 'buzzer', pin: '1' }, to: { component: 'arduino', pin: 'GND' } }
            ],
            [
              { from: { component: 'arduino', pin: '8' }, to: { component: 'buzzer', pin: 'GND' } },
              { from: { component: 'buzzer', pin: 'SIG' }, to: { component: 'arduino', pin: 'GND' } }
            ],
            [
              { from: { component: 'arduino', pin: '8' }, to: { component: 'buzzer', pin: '+' } },
              { from: { component: 'buzzer', pin: '-' }, to: { component: 'arduino', pin: 'GND' } }
            ],
            [
              { from: { component: 'arduino', pin: '8' }, to: { component: 'buzzer', pin: '-' } },
              { from: { component: 'buzzer', pin: '+' }, to: { component: 'arduino', pin: 'GND' } }
            ]
          ]
        },
        codeFunctionality: { description: 'Code plays tones', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: {
      id: 'badge_buzzer',
      name: 'Sound Maker',
      description: 'Played a melody with a buzzer!',
      icon: '🎵',
      rarity: 'common',
    },
  },

  {
    id: 'potentiometer',
    slug: 'potentiometer',
    number: 4,
    prerequisite: 'buzzer',
    title: 'Potentiometer',
    subtitle: 'Turn a knob, control a light!',
    description:
      'A potentiometer is a knob that you can turn from 0% to 100%. ' +
      'Turn it one way → LED gets brighter. Turn it the other way → LED gets dimmer. ' +
      'You will learn about analog signals — values that can be anything, not just ON or OFF!',
    difficulty: 'beginner',
    difficultyLabel: 'Beginner',
    estimatedTime: '20 min',
    xpReward: 130,
    color: '#06b6d4',
    icon: '🎛️',
    world: 1,
    tags: ['analog input', 'potentiometer', 'PWM'],
    startingComponents: ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor', 'openhw-rgb-led', 'openhw-buzzer', 'openhw-potentiometer'],
    rewardComponents: [
      { type: 'openhw-photoresistor', name: 'Light Sensor (LDR)', icon: '🌞', description: 'Detects how bright or dark the room is. Like eyes for your Arduino!' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-led', label: 'LED', qty: 1 },
      { type: 'openhw-resistor', label: '220Ω Resistor', qty: 1, attrs: { value: '220' } },
      { type: 'openhw-potentiometer', label: 'Potentiometer', qty: 1 },
    ],
    wiring: [
      { from: 'Potentiometer left pin', to: 'Arduino 5V' },
      { from: 'Potentiometer middle pin (wiper)', to: 'Arduino A0' },
      { from: 'Potentiometer right pin', to: 'Arduino GND' },
      { from: 'Arduino pin 3 (~)', to: 'LED anode (+)' },
      { from: 'LED cathode (−)', to: '220Ω resistor → GND' },
    ],
    starterCode: `//Controlling LED brightness using a potentiometer

int ledPin=3;
int analogPin=0;
int val=0;

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  val=analogRead(analogPin);
  Serial.println(val);
  val=map(val,0,1023,0,255);
  analogWrite(ledPin,val);
}`,
    concepts: ['analogRead()', 'analogWrite()', 'Analog signals', 'Mapping values', 'Serial.print()'],
    kidFriendlyTip: '🎛️ Tip: analogRead() gives you a number from 0 to 1023. Divide by 4 to get 0-255 for analogWrite. This is called "mapping" — like converting centimetres to inches!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'led', count: 1 }, { type: 'potentiometer', count: 1 }, { type: 'resistor', count: 1 }] },
        wiringAccuracy: {
          description: 'Correct wiring',
          weight: 0.3,
          requiredConnections: [
            { from: { component: 'arduino', pin: 'A0' }, to: { component: 'potentiometer', pin: 'SIG' } },
            { from: { component: 'potentiometer', pin: '1' }, to: { component: 'arduino', pin: 'GND' } },
            { from: { component: 'potentiometer', pin: '2' }, to: { component: 'arduino', pin: '5V' } },
            { from: { component: 'arduino', pin: '3' }, to: { component: 'led', terminal: 'A' } },
            { from: { component: 'led', terminal: 'K' }, to: { component: 'resistor', terminal: '1' } },
            { from: { component: 'resistor', terminal: '2' }, to: { component: 'arduino', pin: 'GND' } }
          ],
          alternativeConnections: [
            [
              { from: { component: 'arduino', pin: 'A0' }, to: { component: 'potentiometer', pin: 'SIG' } },
              { from: { component: 'potentiometer', pin: '1' }, to: { component: 'arduino', pin: '5V' } },
              { from: { component: 'potentiometer', pin: '2' }, to: { component: 'arduino', pin: 'GND' } },
              { from: { component: 'arduino', pin: '3' }, to: { component: 'led', terminal: 'A' } },
              { from: { component: 'led', terminal: 'K' }, to: { component: 'resistor', terminal: '1' } },
              { from: { component: 'resistor', terminal: '2' }, to: { component: 'arduino', pin: 'GND' } }
            ],
            [
              { from: { component: 'arduino', pin: 'A0' }, to: { component: 'potentiometer', pin: 'SIG' } },
              { from: { component: 'potentiometer', pin: '1' }, to: { component: 'arduino', pin: 'GND' } },
              { from: { component: 'potentiometer', pin: '2' }, to: { component: 'arduino', pin: '5V' } },
              { from: { component: 'arduino', pin: '3' }, to: { component: 'resistor', terminal: '1' } },
              { from: { component: 'resistor', terminal: '2' }, to: { component: 'led', terminal: 'A' } },
              { from: { component: 'led', terminal: 'K' }, to: { component: 'arduino', pin: 'GND' } }
            ],
            [
              { from: { component: 'arduino', pin: 'A0' }, to: { component: 'potentiometer', pin: 'SIG' } },
              { from: { component: 'potentiometer', pin: '1' }, to: { component: 'arduino', pin: '5V' } },
              { from: { component: 'potentiometer', pin: '2' }, to: { component: 'arduino', pin: 'GND' } },
              { from: { component: 'arduino', pin: '3' }, to: { component: 'resistor', terminal: '1' } },
              { from: { component: 'resistor', terminal: '2' }, to: { component: 'led', terminal: 'A' } },
              { from: { component: 'led', terminal: 'K' }, to: { component: 'arduino', pin: 'GND' } }
            ]
          ]
        },
        codeFunctionality: { description: 'Knob controls brightness', weight: 0.4, requiredFunctions: ['setup', 'loop', 'analogRead', 'analogWrite'] },
      },
    },
    badge: {
      id: 'badge_potentiometer',
      name: 'Knob Controller',
      description: 'Used a potentiometer to control LED brightness!',
      icon: '🎛️',
      rarity: 'uncommon',
    },
  },

  {
    id: 'ldr',
    slug: 'ldr',
    number: 5,
    prerequisite: 'potentiometer',
    title: 'Light Sensor',
    subtitle: 'See the light!',
    description:
      'An LDR (Light Dependent Resistor) changes its resistance based on how bright it is. ' +
      'In a dark room → LED turns ON automatically. In a bright room → LED turns OFF. ' +
      'This is exactly how automatic street lights work!',
    difficulty: 'beginner',
    difficultyLabel: 'Beginner',
    estimatedTime: '20 min',
    xpReward: 140,
    color: '#eab308',
    icon: '🌞',
    world: 1,
    tags: ['analog input', 'light sensor', 'voltage divider'],
    startingComponents: ['openhw-arduino-uno', 'openhw-photoresistor', 'openhw-resistor', 'openhw-led'],
    rewardComponents: [],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-photoresistor', label: 'Light Sensor (LDR)', qty: 1 },
      { type: 'openhw-led', label: 'LED', qty: 1 },
      { type: 'openhw-resistor', label: '10kΩ Resistor', qty: 1, attrs: { value: '10000' } },
      { type: 'openhw-resistor', label: '220Ω Resistor', qty: 1, attrs: { value: '220' } },
    ],
    wiring: [
      { from: 'Arduino 5V', to: 'LDR one leg' },
      { from: 'LDR other leg', to: 'Arduino A0 & 10kΩ resistor' },
      { from: '10kΩ resistor', to: 'Arduino GND' },
      { from: 'Arduino pin 13', to: 'LED anode → 220Ω → GND' },
    ],
    starterCode: `void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int lightLevel = analogRead(A0);  // High = bright, Low = dark

  Serial.print("Light level: ");
  Serial.println(lightLevel);

  if (lightLevel < 500) {
    digitalWrite(13, HIGH);  // Dark room → LED ON
  } else {
    digitalWrite(13, LOW);   // Bright room → LED OFF
  }

  delay(200);
}`,
    concepts: ['analogRead()', 'Voltage divider', 'if/else', 'Light sensors', 'Automatic control'],
    kidFriendlyTip: '🌞 Tip: Cover the LDR with your finger in the simulator to make it dark! Watch the light value drop below 500 and the LED turns on.',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'photoresistor', count: 1 }] },
        wiringAccuracy: {
          description: 'Correct wiring',
          weight: 0.3,
          requiredConnections: [
            { from: { component: 'photoresistor', pin: '1' }, to: { component: 'arduino', pin: '5V' } },
            { from: { component: 'photoresistor', pin: '2' }, to: { component: 'arduino', pin: 'A0' } },
            { from: { component: 'photoresistor', pin: '2' }, to: { component: 'resistor', terminal: '1' } },
            { from: { component: 'resistor', terminal: '2' }, to: { component: 'arduino', pin: 'GND' } },
            { from: { component: 'arduino', pin: '13' }, to: { component: 'resistor', terminal: '1' } },
            { from: { component: 'resistor', terminal: '2' }, to: { component: 'arduino', pin: 'GND' } }
          ],
          alternativeConnections: [
            [
              { from: { component: 'photoresistor', pin: '2' }, to: { component: 'arduino', pin: '5V' } },
              { from: { component: 'photoresistor', pin: '1' }, to: { component: 'arduino', pin: 'A0' } },
              { from: { component: 'photoresistor', pin: '1' }, to: { component: 'resistor', terminal: '1' } },
              { from: { component: 'resistor', terminal: '2' }, to: { component: 'arduino', pin: 'GND' } },
              { from: { component: 'arduino', pin: '13' }, to: { component: 'resistor', terminal: '1' } },
              { from: { component: 'resistor', terminal: '2' }, to: { component: 'arduino', pin: 'GND' } }
            ]
          ]
        },
        codeFunctionality: { description: 'LED responds to light level', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: {
      id: 'badge_ldr',
      name: 'Light Chaser',
      description: 'Built an automatic light sensor circuit!',
      icon: '🌞',
      rarity: 'uncommon',
    },
  },

  // ── World 2: Signal Control ──────────────────────────────────────────────
  {
    id: 'servo-motor',
    slug: 'servo-motor',
    number: 6,
    prerequisite: 'lcd-scrolling-text',
    title: 'Servo Motor',
    subtitle: 'Control a robot arm!',
    description:
      'A servo motor turns to any angle you tell it to — 0°, 45°, 90°, 180°. ' +
      'These are used in robot arms, camera gimbals, RC cars, and more! ' +
      'You will write code to make the servo sweep back and forth.',
    difficulty: 'intermediate',
    difficultyLabel: 'Intermediate',
    estimatedTime: '25 min',
    xpReward: 200,
    color: '#3b82f6',
    icon: '⚙️',
    world: 2,
    tags: ['servo', 'motor', 'PWM', 'robotics'],
    startingComponents: ['openhw-arduino-uno', 'openhw-servo'],
    rewardComponents: [
      { type: 'openhw-neopixel-matrix', name: 'NeoPixel LED Strip', icon: '✨', description: 'A strip of colorful LEDs you can control individually — make animations and patterns!' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-servo', label: 'Servo Motor', qty: 1 },
    ],
    wiring: [
      { from: 'Servo GND', to: 'Arduino GND' },
      { from: 'Servo V+', to: 'Arduino 5V' },
      { from: 'Servo PWM', to: 'Arduino pin 6' },
    ],
    starterCode: `#include <Servo.h>

Servo myservo;

void setup() {
  myservo.attach(6);
  myservo.write(0);
  delay(500);
  Serial.begin(9600);
  Serial.println("Servo Motor Ready");
}

void loop() {
  for (int pos = 0; pos <= 180; pos++) {
    myservo.write(pos);
    Serial.print("Angle: ");
    Serial.println(pos);
    delay(15);
  }
  for (int pos = 180; pos >= 0; pos--) {
    myservo.write(pos);
    Serial.print("Angle: ");
    Serial.println(pos);
    delay(15);
  }
}`,
    concepts: ['Servo library', 'myservo.write()', 'for loops', 'Servo motors', 'PWM signals'],
    kidFriendlyTip: '⚙️ Tip: The Servo library makes it easy to control the motor. Just tell it the angle you want!',
    evaluation: {
      passingThreshold: 80,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'servo', count: 1 }] },
        wiringAccuracy: {
          description: 'Correct wiring',
          weight: 0.4,
          requiredConnections: [
            { from: { component: 'servo', terminal: 'gnd' }, to: { component: 'arduino', pin: 'GND' } },
            { from: { component: 'servo', terminal: 'v+' }, to: { component: 'arduino', pin: '5V' } },
            { from: { component: 'servo', terminal: 'pwm' }, to: { component: 'arduino', pin: '6' } },
          ]
        },
        codeFunctionality: { description: 'Servo sweeps back and forth', weight: 0.3, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: {
      id: 'badge_servo',
      name: 'Motion Master',
      description: 'Controlled a servo motor!',
      icon: '⚙️',
      rarity: 'uncommon',
    },
  },

  {
    id: 'led-strip',
    slug: 'led-strip',
    number: 7,
    prerequisite: 'servo-motor',
    title: 'LED Strip',
    subtitle: 'NeoPixel light show!',
    description:
      'NeoPixel LEDs are individually addressable — that means you can control each LED separately! ' +
      'Make rainbow patterns, chase animations, or a fully custom light show. ' +
      'This uses the FastLED library to make it easy.',
    difficulty: 'intermediate',
    difficultyLabel: 'Intermediate',
    estimatedTime: '30 min',
    xpReward: 220,
    color: '#ec4899',
    icon: '✨',
    world: 2,
    tags: ['NeoPixel', 'LED strip', 'FastLED', 'animation'],
    startingComponents: ['openhw-arduino-uno', 'openhw-neopixel-matrix'],
    rewardComponents: [
      { type: 'openhw-pushbutton', name: 'Push Button', icon: '🔘', description: 'Press it to trigger things! Used in almost every electronic device.' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-neopixel-matrix', label: 'NeoPixel Strip (8 LEDs)', qty: 1 },
    ],
    wiring: [
      { from: 'NeoPixel DIN (data in)', to: 'Arduino pin 6' },
      { from: 'NeoPixel 5V', to: 'Arduino 5V' },
      { from: 'NeoPixel GND', to: 'Arduino GND' },
    ],
    starterCode: `#include <Adafruit_NeoPixel.h>

#define PIN 6
#define NUM_LEDS 8

Adafruit_NeoPixel strip(NUM_LEDS, PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  strip.begin();
  strip.show(); // All LEDs off
}

void loop() {
  // Rainbow chase!
  for (int i = 0; i < NUM_LEDS; i++) {
    strip.clear();
    // Set each LED to a different color
    strip.setPixelColor(i, strip.Color(255, 0, 0));   // Red
    strip.show();
    delay(100);
  }
}`,
    concepts: ['NeoPixel library', 'strip.setPixelColor()', 'strip.Color()', 'LED arrays', 'Animations'],
    kidFriendlyTip: '✨ Tip: strip.Color(R, G, B) sets the color. strip.setPixelColor(0, color) sets LED #0. strip.show() actually updates the lights — do not forget it!',
    evaluation: {
      passingThreshold: 80,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'neopixel', count: 1 }] },
        wiringAccuracy: {
          description: 'Correct wiring',
          weight: 0.4,
          requiredConnections: [
            { from: { component: 'neopixel', terminal: 'vcc' }, to: { component: 'arduino', pin: '5V' } },
            { from: { component: 'neopixel', terminal: 'gnd' }, to: { component: 'arduino', pin: 'GND' } },
            { from: { component: 'neopixel', terminal: 'din' }, to: { component: 'arduino', pin: '6' } },
          ],
          alternativeConnections: [
            [
              { from: { component: 'neopixel', terminal: 'vdd' }, to: { component: 'arduino', pin: '5V' } },
              { from: { component: 'neopixel', terminal: 'vss' }, to: { component: 'arduino', pin: 'GND' } },
              { from: { component: 'neopixel', terminal: 'din' }, to: { component: 'arduino', pin: '6' } },
            ]
          ]
        },
        codeFunctionality: { description: 'LEDs animate correctly', weight: 0.3, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: {
      id: 'badge_led_strip',
      name: 'Light Show Artist',
      description: 'Created a NeoPixel animation!',
      icon: '✨',
      rarity: 'rare',
    },
  },

  {
    id: 'button-debounce',
    slug: 'button-debounce',
    number: 8,
    prerequisite: 'led-strip',
    title: 'Button & Debounce',
    subtitle: 'Clean, reliable button presses',
    description:
      'Buttons are tricky — they "bounce" (flicker on/off really fast) when pressed! ' +
      'Debouncing is a clever technique to ignore the bouncing and only count real presses. ' +
      'You will use the millis() timer instead of delay() — a big upgrade in coding skill!',
    difficulty: 'intermediate',
    difficultyLabel: 'Intermediate',
    estimatedTime: '30 min',
    xpReward: 250,
    color: '#14b8a6',
    icon: '🔘',
    world: 2,
    tags: ['button', 'debounce', 'millis', 'state machine'],
    startingComponents: ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor', 'openhw-pushbutton'],
    rewardComponents: [
      { type: 'openhw-ntc-temperature-sensor', name: 'Temperature Sensor', icon: '🌡️', description: 'Measures how hot or cold it is! Used in thermostats, weather stations, and more.' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-pushbutton', label: 'Push Button', qty: 1 },
      { type: 'openhw-led', label: 'LED', qty: 1 },
      { type: 'openhw-resistor', label: '220Ω Resistor', qty: 1, attrs: { value: '220' } },
    ],
    wiring: [
      { from: 'Button one side', to: 'Arduino pin 2' },
      { from: 'Button other side', to: 'Arduino GND' },
      { from: 'Arduino pin 13', to: 'LED anode → 220Ω → GND' },
    ],
    starterCode: `const int buttonPin = 2;
const int ledPin    = 13;

bool ledState    = false;
bool lastButton  = HIGH;
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50; // milliseconds

void setup() {
  pinMode(buttonPin, INPUT_PULLUP); // Built-in resistor!
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  bool reading = digitalRead(buttonPin);

  // Reset the debounce timer if the button changed
  if (reading != lastButton) {
    lastDebounceTime = millis();
  }

  // Only act if button stayed stable for 50ms
  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (reading == LOW) {          // Button pressed!
      ledState = !ledState;        // Flip LED on/off
      digitalWrite(ledPin, ledState);
      Serial.println(ledState ? "LED ON" : "LED OFF");
      delay(200); // Prevent rapid toggling
    }
  }

  lastButton = reading;
}`,
    concepts: ['millis()', 'debouncing', 'INPUT_PULLUP', 'State machines', 'Boolean toggle'],
    kidFriendlyTip: '🔘 Tip: INPUT_PULLUP means the pin reads HIGH when nothing is pressed, and LOW when pressed. millis() counts milliseconds since the Arduino started — like a stopwatch!',
    evaluation: {
      passingThreshold: 80,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'button', count: 1 }, { type: 'led', count: 1 }] },
        wiringAccuracy: {
          description: 'Correct wiring',
          weight: 0.4,
          requiredConnections: [
            { from: { component: 'button', terminal: '1.l' }, to: { component: 'arduino', pin: '2' } },
            { from: { component: 'button', terminal: '2.l' }, to: { component: 'arduino', pin: 'GND' } },
            { from: { component: 'arduino', pin: '13' }, to: { component: 'resistor', terminal: '1' } },
            { from: { component: 'resistor', terminal: '2' }, to: { component: 'led', terminal: 'a' } },
            { from: { component: 'led', terminal: 'c' }, to: { component: 'arduino', pin: 'GND' } }
          ],
          alternativeConnections: [
            [
              { from: { component: 'button', terminal: '1.r' }, to: { component: 'arduino', pin: '2' } },
              { from: { component: 'button', terminal: '2.r' }, to: { component: 'arduino', pin: 'GND' } },
              { from: { component: 'arduino', pin: '13' }, to: { component: 'resistor', terminal: '1' } },
              { from: { component: 'resistor', terminal: '2' }, to: { component: 'led', terminal: 'a' } },
              { from: { component: 'led', terminal: 'c' }, to: { component: 'arduino', pin: 'GND' } }
            ]
          ]
        },
        codeFunctionality: { description: 'Button toggles LED reliably', weight: 0.3, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: {
      id: 'badge_button_debounce',
      name: 'Button Ninja',
      description: 'Mastered button debouncing!',
      icon: '🔘',
      rarity: 'rare',
    },
  },

  {
    id: 'temperature-sensor',
    slug: 'temperature-sensor',
    number: 9,
    prerequisite: 'button-debounce',
    title: 'Temperature Sensor',
    subtitle: 'Build your own thermometer!',
    description:
      'Read the temperature with an NTC sensor and print it to the Serial Monitor. ' +
      'If it gets too hot, trigger an alarm! ' +
      'Temperature sensors are inside every smartphone, thermostat, and car engine.',
    difficulty: 'intermediate',
    difficultyLabel: 'Intermediate',
    estimatedTime: '30 min',
    xpReward: 260,
    color: '#ef4444',
    icon: '🌡️',
    world: 2,
    tags: ['temperature', 'NTC', 'sensor', 'Serial Monitor'],
    startingComponents: ['openhw-arduino-uno', 'openhw-ntc-temperature-sensor', 'openhw-resistor', 'openhw-led', 'openhw-buzzer'],
    rewardComponents: [
      { type: 'openhw-motor', name: 'DC Motor', icon: '🔩', description: 'Spins at any speed you want! Used in fans, robots, and toy cars.' },
      { type: 'openhw-l293d', name: 'Motor Driver (L293D)', icon: '🔌', description: 'Controls the motor — gives it the power it needs to spin fast.' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-ntc-temperature-sensor', label: 'NTC Temperature Sensor', qty: 1 },
      { type: 'openhw-buzzer', label: 'Alarm Buzzer', qty: 1 },
    ],
    wiring: [
      { from: 'NTC OUT', to: 'Arduino A0' },
      { from: 'NTC VCC', to: 'Arduino 5V' },
      { from: 'NTC GND', to: 'Arduino GND' },
      { from: 'Buzzer positive', to: 'Arduino pin 8' },
      { from: 'Buzzer negative', to: 'Arduino GND' },
    ],
    starterCode: `const int TEMP_PIN = A0;
const int BUZZER_PIN = 8;
const float BETA = 3950;

void setup() {
  Serial.begin(9600);
  pinMode(BUZZER_PIN, OUTPUT);
}

void loop() {
  int raw = analogRead(TEMP_PIN);
  float resistance = 10000.0 * raw / (1023.0 - raw);
  float tempK = 1.0 / (log(resistance / 10000.0) / BETA + 1.0 / 298.15);
  float tempC = tempK - 273.15;

  Serial.print("Temp C: ");
  Serial.println(tempC);

  if (tempC >= 30.0) {
    tone(BUZZER_PIN, 900);
  } else {
    noTone(BUZZER_PIN);
  }

  delay(150);
}`,
    concepts: ['NTC sensor', 'Voltage divider', 'Temperature conversion', 'Thresholds', 'Alarms'],
    kidFriendlyTip: '🌡️ Tip: In the Wokwi simulator, you can click on the NTC sensor and drag a slider to change the temperature! Try setting it above 30°C to trigger the alarm.',
    evaluation: {
      passingThreshold: 80,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'ntc', count: 1 }, { type: 'buzzer', count: 1 }] },
        wiringAccuracy: {
          description: 'Correct wiring',
          weight: 0.4,
          requiredConnections: [
            { from: { component: 'ntc', terminal: 'out' }, to: { component: 'arduino', pin: 'A0' } },
            { from: { component: 'ntc', terminal: 'vcc' }, to: { component: 'arduino', pin: '5V' } },
            { from: { component: 'ntc', terminal: 'gnd' }, to: { component: 'arduino', pin: 'GND' } },
            { from: { component: 'buzzer', terminal: 'p' }, to: { component: 'arduino', pin: '8' } },
            { from: { component: 'buzzer', terminal: 'n' }, to: { component: 'arduino', pin: 'GND' } }
          ],
          alternativeConnections: []
        },
        codeFunctionality: { description: 'Temperature reads and alerts correctly', weight: 0.3, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: {
      id: 'badge_temperature',
      name: 'Temperature Detective',
      description: 'Built a temperature alarm!',
      icon: '🌡️',
      rarity: 'rare',
    },
  },

  // ── World 3: Machines & Sensors ──────────────────────────────────────────
  {
    id: 'dc-motor',
    slug: 'dc-motor',
    number: 10,
    prerequisite: 'temperature-sensor',
    title: 'DC Motor',
    subtitle: 'Power and speed control!',
    description:
      'DC motors are in fans, toy cars, drones, and robots. ' +
      'You will use an L293D motor driver chip to give the motor enough power, ' +
      'then control its speed and direction with your code!',
    difficulty: 'advanced',
    difficultyLabel: 'Advanced',
    estimatedTime: '40 min',
    xpReward: 300,
    color: '#f97316',
    icon: '🔩',
    world: 3,
    tags: ['motor', 'PWM', 'H-bridge', 'robotics'],
    startingComponents: ['openhw-arduino-uno', 'openhw-motor', 'openhw-l293d'],
    rewardComponents: [
      // Completing this unlocks ALL remaining components — you're a Circuit Champion!
      { type: '*', name: 'ALL Components Unlocked!', icon: '🏆', description: 'You completed every project! You now have access to the full component library!' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-l293d', label: 'L293D Motor Driver', qty: 1 },
      { type: 'openhw-motor', label: 'DC Motor', qty: 1 },
    ],
    wiring: [
      { from: 'L293D VCC1 & VCC2', to: 'Arduino 5V' },
      { from: 'L293D GND1', to: 'Arduino GND' },
      { from: 'L293D EN1,2', to: 'Arduino pin 9' },
      { from: 'L293D IN1', to: 'Arduino pin 8' },
      { from: 'L293D IN2', to: 'Arduino pin 7' },
      { from: 'L293D OUT1 & OUT2', to: 'DC Motor' },
    ],
    starterCode: `const int EN = 9;
const int IN1 = 8;
const int IN2 = 7;

void setup() {
  pinMode(EN, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  Serial.begin(9600);
  Serial.println(F("DC Motor L293D Ready"));
}

void loop() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  for (int s = 0; s <= 255; s++) {
    analogWrite(EN, s);
    Serial.print("CW: ");
    Serial.println(s);
    delay(20);
  }
  delay(1000);

  analogWrite(EN, 0);
  delay(500);

  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  for (int s = 0; s <= 255; s++) {
    analogWrite(EN, s);
    Serial.print("CCW: ");
    Serial.println(s);
    delay(20);
  }
  delay(1000);

  analogWrite(EN, 0);
  delay(500);
}`,
    concepts: ['H-bridge', 'L293D', 'Motor direction', 'PWM speed control', 'Motor drivers'],
    kidFriendlyTip: '🔩 Tip: An H-bridge lets current flow in two directions through the motor — that\'s how you reverse it! The L293D chip has a built-in H-bridge.',
    evaluation: {
      passingThreshold: 80,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'motor', count: 1 }, { type: 'motor-driver', count: 1 }] },
        wiringAccuracy: {
          description: 'Correct wiring',
          weight: 0.4,
          requiredConnections: [
            { from: { component: 'motor-driver', terminal: 'vcc1' }, to: { component: 'arduino', pin: '5V' } },
            { from: { component: 'motor-driver', terminal: 'vcc2' }, to: { component: 'arduino', pin: '5V' } },
            { from: { component: 'motor-driver', terminal: 'gnd1' }, to: { component: 'arduino', pin: 'GND' } },
            { from: { component: 'motor-driver', terminal: 'en1,2' }, to: { component: 'arduino', pin: '9' } },
            { from: { component: 'motor-driver', terminal: 'in1' }, to: { component: 'arduino', pin: '8' } },
            { from: { component: 'motor-driver', terminal: 'in2' }, to: { component: 'arduino', pin: '7' } },
            { from: { component: 'motor-driver', terminal: 'out1' }, to: { component: 'motor', terminal: '1' } },
            { from: { component: 'motor-driver', terminal: 'out2' }, to: { component: 'motor', terminal: '2' } }
          ],
          alternativeConnections: []
        },
        codeFunctionality: { description: 'Motor speed and direction controlled', weight: 0.3, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: {
      id: 'badge_dc_motor',
      name: 'Circuit Champion',
      description: 'Controlled a DC motor — a true maker!',
      icon: '🏆',
      rarity: 'legendary',
    },
  },
  {
    id: 'traffic-light',
    slug: 'traffic-light',
    number: 11,
    prerequisite: 'ldr',
    title: 'Traffic Light',
    subtitle: 'Simulate a traffic light system',
    description: 'Simulate a traffic light system with red, yellow, and green LEDs.',
    difficulty: 'beginner',
    difficultyLabel: 'Beginner',
    estimatedTime: '20 min',
    xpReward: 180,
    color: '#22c55e',
    icon: '🚦',
    world: 1,
    tags: ['LED', 'digital output', 'traffic light'],
    startingComponents: ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor'],
    rewardComponents: [],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-led', label: 'Red LED', qty: 1, attrs: { color: 'red' } },
      { type: 'openhw-led', label: 'Yellow LED', qty: 1, attrs: { color: 'yellow' } },
      { type: 'openhw-led', label: 'Green LED', qty: 1, attrs: { color: 'green' } },
      { type: 'openhw-resistor', label: '220Ω Resistor', qty: 3, attrs: { value: '220' } },
    ],
    wiring: [
      { from: 'Arduino pin 11', to: '220Ω resistor → Red LED anode (+)' },
      { from: 'Red LED cathode (−)', to: 'Arduino GND' },
      { from: 'Arduino pin 10', to: '220Ω resistor → Yellow LED anode (+)' },
      { from: 'Yellow LED cathode (−)', to: 'Arduino GND' },
      { from: 'Arduino pin 9', to: '220Ω resistor → Green LED anode (+)' },
      { from: 'Green LED cathode (−)', to: 'Arduino GND' },
    ],
    starterCode: `const int RED_PIN = 11;
const int GREEN_PIN = 10;
const int BLUE_PIN = 9;

void setup() {
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);
  Serial.begin(9600);
}

void showColor(bool r, bool g, bool b) {
  digitalWrite(RED_PIN, r ? HIGH : LOW);
  digitalWrite(GREEN_PIN, g ? HIGH : LOW);
  digitalWrite(BLUE_PIN, b ? HIGH : LOW);
}

void loop() {
  // RED = STOP
  showColor(true, false, false);
  Serial.println("STOP");
  delay(5000);
  // YELLOW = WAIT
  showColor(false, true, false);
  Serial.println("WAIT");
  delay(2000);
  // GREEN = GO
  showColor(false, false, true);
  Serial.println("GO");
  delay(5000);
}`,
    concepts: ['digitalWrite', 'timing', 'traffic light logic'],
    kidFriendlyTip: '🚦 Red means stop, yellow means slow down, green means go!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'led', count: 3 }, { type: 'resistor', count: 3 }] },
        wiringAccuracy: {
          description: 'Correct wiring',
          weight: 0.3,
          requiredConnections: [
            { from: { component: 'arduino', pin: '11' }, to: { component: 'resistor', terminal: '1' } },
            { from: { component: 'resistor', terminal: '2' }, to: { component: 'led', terminal: 'A' } },
            { from: { component: 'led', terminal: 'K' }, to: { component: 'arduino', pin: 'GND' } },
            { from: { component: 'arduino', pin: '10' }, to: { component: 'resistor', terminal: '1' } },
            { from: { component: 'resistor', terminal: '2' }, to: { component: 'led', terminal: 'A' } },
            { from: { component: 'led', terminal: 'K' }, to: { component: 'arduino', pin: 'GND' } },
            { from: { component: 'arduino', pin: '9' }, to: { component: 'resistor', terminal: '1' } },
            { from: { component: 'resistor', terminal: '2' }, to: { component: 'led', terminal: 'A' } },
            { from: { component: 'led', terminal: 'K' }, to: { component: 'arduino', pin: 'GND' } }
          ],
          alternativeConnections: [
            [
              { from: { component: 'arduino', pin: '11' }, to: { component: 'led', terminal: 'A' } },
              { from: { component: 'led', terminal: 'K' }, to: { component: 'resistor', terminal: '1' } },
              { from: { component: 'resistor', terminal: '2' }, to: { component: 'arduino', pin: 'GND' } },
              { from: { component: 'arduino', pin: '10' }, to: { component: 'led', terminal: 'A' } },
              { from: { component: 'led', terminal: 'K' }, to: { component: 'resistor', terminal: '1' } },
              { from: { component: 'resistor', terminal: '2' }, to: { component: 'arduino', pin: 'GND' } },
              { from: { component: 'arduino', pin: '9' }, to: { component: 'led', terminal: 'A' } },
              { from: { component: 'led', terminal: 'K' }, to: { component: 'resistor', terminal: '1' } },
              { from: { component: 'resistor', terminal: '2' }, to: { component: 'arduino', pin: 'GND' } }
            ]
          ]
        },
        codeFunctionality: { description: 'Traffic light sequence works', weight: 0.4, requiredFunctions: ['setup', 'loop', 'showColor'] },
      },
    },
    badge: {
      id: 'badge_traffic_light',
      name: 'Traffic Controller',
      description: 'Built a working traffic light!',
      icon: '🚦',
      rarity: 'common',
    },
  },
  {
    id: 'led-pwm',
    slug: 'led-pwm',
    number: 12,
    prerequisite: 'traffic-light',
    title: 'LED Brightness (PWM)',
    subtitle: 'Control LED brightness using PWM',
    description: 'Control LED brightness using PWM with analogWrite().',
    difficulty: 'beginner',
    difficultyLabel: 'Beginner',
    estimatedTime: '15 min',
    xpReward: 160,
    color: '#22c55e',
    icon: '🔆',
    world: 1,
    tags: ['LED', 'PWM', 'analog output'],
    startingComponents: ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor'],
    rewardComponents: [
      { type: 'openhw-lcd1602', name: 'LCD Display', icon: '📟', description: 'A tiny screen to display messages!' }
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-led', label: 'LED', qty: 1 },
      { type: 'openhw-resistor', label: '220Ω Resistor', qty: 1, attrs: { value: '220' } },
    ],
    wiring: [
      { from: 'Arduino pin 9 (PWM)', to: '220Ω resistor → LED anode (+)' },
      { from: 'LED cathode (−)', to: 'Arduino GND' },
    ],
    starterCode: `void setup() {
  pinMode(9, OUTPUT);
  Serial.begin(9600);
}
void loop() {
  for (int i = 0; i <= 255; i++) {
    analogWrite(9, i);
    Serial.print("Brightness: ");
    Serial.println(i);
    delay(10);
  }
  for (int i = 255; i >= 0; i--) {
    analogWrite(9, i);
    Serial.print("Brightness: ");
    Serial.println(i);
    delay(10);
  }
}`,
    concepts: ['analogWrite', 'PWM', 'LED brightness'],
    kidFriendlyTip: '💡 PWM lets you control brightness like a dimmer switch!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'led', count: 1 }, { type: 'resistor', count: 1 }] },
        wiringAccuracy: {
          description: 'Correct wiring',
          weight: 0.3,
          requiredConnections: [
            { from: { component: 'arduino', pin: '9' }, to: { component: 'resistor', terminal: '1' } },
            { from: { component: 'resistor', terminal: '2' }, to: { component: 'led', terminal: 'A' } },
            { from: { component: 'led', terminal: 'K' }, to: { component: 'arduino', pin: 'GND' } }
          ],
          alternativeConnections: [
            [
              { from: { component: 'arduino', pin: '9' }, to: { component: 'led', terminal: 'A' } },
              { from: { component: 'led', terminal: 'K' }, to: { component: 'resistor', terminal: '1' } },
              { from: { component: 'resistor', terminal: '2' }, to: { component: 'arduino', pin: 'GND' } }
            ]
          ]
        },
        codeFunctionality: { description: 'LED dims up and down', weight: 0.4, requiredFunctions: ['setup', 'loop', 'analogWrite'] },
      },
    },
    badge: {
      id: 'badge_led_pwm',
      name: 'Dimmer Master',
      description: 'Mastered PWM brightness control!',
      icon: '🔆',
      rarity: 'common',
    },
  },
  {
    id: 'lcd-scrolling-text',
    slug: 'lcd-scrolling-text',
    number: 13,
    prerequisite: 'led-pwm',
    title: 'Scrolling Text LCD',
    subtitle: 'Display scrolling text on LCD',
    description: 'Display scrolling text on a 16x2 LCD character display.',
    difficulty: 'beginner',
    difficultyLabel: 'Beginner',
    estimatedTime: '25 min',
    xpReward: 190,
    color: '#22c55e',
    icon: '📟',
    world: 1,
    tags: ['LCD', 'display', 'I2C'],
    startingComponents: ['openhw-arduino-uno', 'openhw-lcd1602'],
    rewardComponents: [
      { type: 'openhw-servo', name: 'Servo Motor', icon: '⚙️', description: 'A motor that can turn exactly where you tell it to!' }
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-lcd1602', label: '16x2 LCD', qty: 1 },
    ],
    wiring: [
      { from: 'LCD VDD', to: 'Arduino 5V' },
      { from: 'LCD VSS', to: 'Arduino GND' },
      { from: 'LCD RS', to: 'Arduino pin 12' },
      { from: 'LCD E', to: 'Arduino pin 11' },
      { from: 'LCD D4', to: 'Arduino pin 5' },
      { from: 'LCD D5', to: 'Arduino pin 4' },
      { from: 'LCD D6', to: 'Arduino pin 3' },
      { from: 'LCD D7', to: 'Arduino pin 2' },
    ],
    starterCode: `#include <LiquidCrystal.h>
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
void setup() {
  lcd.begin(16, 2);
  Serial.begin(9600);
}
void loop() {
  lcd.setCursor(0, 0);
  lcd.print("Hello, Arduino!");
  for (int i = 0; i < 16; i++) {
    lcd.scrollDisplayLeft();
    delay(200);
  }
}`,
    concepts: ['LiquidCrystal', 'LCD display', 'scrolling text'],
    kidFriendlyTip: '📟 LCDs let you display messages — like a tiny TV for your Arduino!',
    evaluation: {
      passingThreshold: 80,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'lcd', count: 1 }] },
        wiringAccuracy: {
          description: 'Correct wiring',
          weight: 0.4,
          requiredConnections: [
            { from: { component: 'lcd', terminal: 'vdd' }, to: { component: 'arduino', pin: '5V' } },
            { from: { component: 'lcd', terminal: 'vss' }, to: { component: 'arduino', pin: 'GND' } },
            { from: { component: 'lcd', terminal: 'rs' }, to: { component: 'arduino', pin: '12' } },
            { from: { component: 'lcd', terminal: 'e' }, to: { component: 'arduino', pin: '11' } },
            { from: { component: 'lcd', terminal: 'd4' }, to: { component: 'arduino', pin: '5' } },
            { from: { component: 'lcd', terminal: 'd5' }, to: { component: 'arduino', pin: '4' } },
            { from: { component: 'lcd', terminal: 'd6' }, to: { component: 'arduino', pin: '3' } },
            { from: { component: 'lcd', terminal: 'd7' }, to: { component: 'arduino', pin: '2' } }
          ],
          alternativeConnections: []
        },
        codeFunctionality: { description: 'LCD scrolls text', weight: 0.3, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: {
      id: 'badge_lcd',
      name: 'Message Board',
      description: 'Programmed an LCD display!',
      icon: '📟',
      rarity: 'rare',
    },
  },
];

// Difficulty styling
export const DIFFICULTY_CONFIG = {
  easy:         { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  label: 'Easy' },
  intermediate: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Intermediate' },
  hard:         { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  label: 'Hard' },
};

export function normalizeDifficulty(value, fallback = 'intermediate') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'beginner') return 'easy';
  if (raw === 'advanced') return 'hard';
  if (raw === 'easy' || raw === 'intermediate' || raw === 'hard') return raw;
  return fallback;
}

export function getDifficultyDisplay(value, fallback = 'intermediate') {
  const normalized = normalizeDifficulty(value, fallback);
  return DIFFICULTY_CONFIG[normalized] || DIFFICULTY_CONFIG[fallback] || DIFFICULTY_CONFIG.intermediate;
}

// ── Helper: get project status based on completed projects ────────────────────
export function getProjectStatus(projectSlug, completedProjects = []) {
  if (completedProjects.includes(projectSlug)) return 'completed';
  const project = PROJECTS.find(p => p.slug === projectSlug);
  if (!project) return 'locked';
  if (!project.prerequisite) return 'available'; // First project always available
  if (completedProjects.includes(project.prerequisite)) return 'available';
  return 'locked';
}

// ── Helper: get unlocked projects list ────────────────────────────────────────
export function getUnlockedProjects(completedProjects = []) {
  return PROJECTS.filter(p => getProjectStatus(p.slug, completedProjects) !== 'locked');
}

// ── Helper: get all reward components earned so far ───────────────────────────
export function getEarnedComponents(completedProjects = []) {
  const earned = new Set([
    'wokwi-arduino-uno',
    'openhw-arduino-uno',
    'wokwi-led',
    'openhw-led',
    'wokwi-resistor',
    'openhw-resistor',
  ]);
  let allUnlocked = false;

  for (const project of PROJECTS) {
    if (completedProjects.includes(project.slug)) {
      for (const reward of (project.rewardComponents || [])) {
        if (reward.type === '*') { allUnlocked = true; break; }
        earned.add(reward.type);
        if (reward.type.startsWith('openhw-')) earned.add(reward.type.replace('openhw-', 'wokwi-'));
        if (reward.type.startsWith('wokwi-')) earned.add(reward.type.replace('wokwi-', 'openhw-'));
      }
    }
    if (allUnlocked) break;
  }

  return allUnlocked ? '*' : earned;
}

// ── Helper: what components will I earn from completing this project? ─────────
export function getProjectRewardComponents(projectSlug) {
  const project = PROJECTS.find(p => p.slug === projectSlug);
  return project?.rewardComponents || [];
}

export function getLockedProjects(completedProjects = []) {
  return PROJECTS.filter(p => getProjectStatus(p.slug, completedProjects) === 'locked');
}
