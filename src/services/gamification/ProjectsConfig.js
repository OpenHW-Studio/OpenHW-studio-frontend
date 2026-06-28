
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
          ],
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
      { from: 'Arduino pin 9', to: 'RGB LED Red pin' },
      { from: 'Arduino pin 10', to: 'RGB LED Green pin' },
      { from: 'Arduino pin 11', to: 'RGB LED Blue pin' },
      { from: 'Each color pin', to: '220Ω resistor in series' },
      { from: 'RGB LED GND', to: 'Arduino GND' },
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
          requiredConnections: [],
          customWiringCheck: 'rgb-discrete',
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
      { from: 'Arduino pin 9 (~)', to: 'LED anode (+)' },
      { from: 'LED cathode (−)', to: '220Ω resistor → GND' },
    ],
    starterCode: `void setup() {
  pinMode(9, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int knobValue = analogRead(A0);  // Reads 0 to 1023
  int brightness = knobValue / 4;  // Map to 0-255 for PWM

  analogWrite(9, brightness);  // Set LED brightness

  Serial.print("Knob: ");
  Serial.print(knobValue);
  Serial.print("  Brightness: ");
  Serial.println(brightness);

  delay(100);
}`,
    concepts: ['analogRead()', 'analogWrite()', 'Analog signals', 'Mapping values', 'Serial.print()'],
    kidFriendlyTip: '🎛️ Tip: analogRead() gives you a number from 0 to 1023. Divide by 4 to get 0-255 for analogWrite. This is called "mapping" — like converting centimetres to inches!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'led', count: 1 }, { type: 'potentiometer', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'Knob controls brightness', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
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
    tags: ['LDR', 'light sensor', 'analog input'],
    startingComponents: ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor', 'openhw-photoresistor'],
    rewardComponents: [
      { type: 'openhw-servo', name: 'Servo Motor', icon: '⚙️', description: 'A motor that can turn to any angle you set — like a robot arm!' },
    ],
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
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'photoresistor', count: 1 }, { type: 'led', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
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
    prerequisite: 'ldr',
    title: 'Servo Motor',
    subtitle: 'Control a robot arm!',
    description:
      'A servo motor turns to any angle you tell it to — 0°, 45°, 90°, 180°. ' +
      'These are used in robot arms, camera gimbals, RC cars, and more! ' +
      'You will use a potentiometer to control the angle of the servo.',
    difficulty: 'intermediate',
    difficultyLabel: 'Intermediate',
    estimatedTime: '25 min',
    xpReward: 200,
    color: '#3b82f6',
    icon: '⚙️',
    world: 2,
    tags: ['servo', 'motor', 'PWM', 'robotics'],
    startingComponents: ['openhw-arduino-uno', 'openhw-servo', 'openhw-potentiometer'],
    rewardComponents: [
      { type: 'openhw-neopixel-matrix', name: 'NeoPixel LED Strip', icon: '✨', description: 'A strip of colorful LEDs you can control individually — make animations and patterns!' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-servo', label: 'Servo Motor', qty: 1 },
      { type: 'openhw-potentiometer', label: 'Potentiometer', qty: 1 },
    ],
    wiring: [
      { from: 'Servo brown wire', to: 'Arduino GND' },
      { from: 'Servo red wire', to: 'Arduino 5V' },
      { from: 'Servo orange wire (signal)', to: 'Arduino pin 9' },
      { from: 'Potentiometer middle pin', to: 'Arduino A0' },
    ],
    starterCode: `#include <Servo.h>

Servo myServo;

void setup() {
  myServo.attach(9);  // Servo connected to pin 9
  Serial.begin(9600);
}

void loop() {
  int knob = analogRead(A0);      // 0 to 1023
  int angle = map(knob, 0, 1023, 0, 180);  // Convert to 0-180 degrees

  myServo.write(angle);           // Move servo to angle

  Serial.print("Angle: ");
  Serial.println(angle);

  delay(15);
}`,
    concepts: ['Servo library', 'myServo.write()', 'map()', 'Servo motors', 'PWM signals'],
    kidFriendlyTip: '⚙️ Tip: The map() function converts one range to another. map(500, 0, 1023, 0, 180) gives you 88 — almost exactly halfway!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'servo', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'Servo moves to correct angle', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
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
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'neopixel', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'LEDs animate correctly', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
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
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'button', count: 1 }, { type: 'led', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'Button toggles LED reliably', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
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
      { type: 'openhw-resistor', label: '10kΩ Resistor', qty: 1, attrs: { value: '10000' } },
      { type: 'openhw-led', label: 'Red Alert LED', qty: 1 },
      { type: 'openhw-buzzer', label: 'Alarm Buzzer', qty: 1 },
    ],
    wiring: [
      { from: 'NTC sensor one leg', to: 'Arduino 5V' },
      { from: 'NTC sensor other leg', to: 'Arduino A0 & 10kΩ → GND' },
      { from: 'Arduino pin 13', to: 'Red LED → GND' },
      { from: 'Arduino pin 8', to: 'Buzzer → GND' },
    ],
    starterCode: `const float BETA = 3950;  // NTC sensor constant
const int ALERT_TEMP = 30; // Alert above 30°C

void setup() {
  pinMode(13, OUTPUT);
  pinMode(8, OUTPUT);
  Serial.begin(9600);
  Serial.println("Temperature Monitor Started!");
}

void loop() {
  // Read sensor and convert to temperature
  int raw = analogRead(A0);
  float resistance = 10000.0 * raw / (1023.0 - raw);
  float tempK = 1.0 / (log(resistance / 10000.0) / BETA + 1.0 / 298.15);
  float tempC = tempK - 273.15;

  Serial.print("Temperature: ");
  Serial.print(tempC, 1);
  Serial.println(" °C");

  if (tempC > ALERT_TEMP) {
    digitalWrite(13, HIGH);  // Red LED on
    tone(8, 1000, 200);      // Alarm sound!
    Serial.println("⚠️ TOO HOT!");
  } else {
    digitalWrite(13, LOW);
    noTone(8);
  }

  delay(1000);
}`,
    concepts: ['NTC sensor', 'Voltage divider', 'Temperature conversion', 'Thresholds', 'Alarms'],
    kidFriendlyTip: '🌡️ Tip: In the Wokwi simulator, you can click on the NTC sensor and drag a slider to change the temperature! Try setting it above 30°C to trigger the alarm.',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'ntc', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'Temperature reads and alerts correctly', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
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
    startingComponents: ['openhw-arduino-uno', 'openhw-motor', 'openhw-l293d', 'openhw-potentiometer'],
    rewardComponents: [
      // Completing this unlocks ALL remaining components — you're a Circuit Champion!
      { type: '*', name: 'ALL Components Unlocked!', icon: '🏆', description: 'You completed every project! You now have access to the full component library!' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-l293d', label: 'L293D Motor Driver', qty: 1 },
      { type: 'openhw-motor', label: 'DC Motor', qty: 1 },
      { type: 'openhw-potentiometer', label: 'Potentiometer (speed control)', qty: 1 },
    ],
    wiring: [
      { from: 'Arduino pin 9 (PWM)', to: 'L293D Enable 1 (pin 1)' },
      { from: 'Arduino pin 7', to: 'L293D Input 1A (pin 2)' },
      { from: 'Arduino pin 8', to: 'L293D Input 1B (pin 7)' },
      { from: 'L293D Output 1 & 2', to: 'DC Motor terminals' },
      { from: 'L293D 5V & GND', to: 'Arduino 5V & GND' },
      { from: 'Potentiometer middle', to: 'Arduino A0' },
    ],
    starterCode: `const int enablePin = 9;  // PWM speed control
const int in1Pin    = 7;  // Direction pin 1
const int in2Pin    = 8;  // Direction pin 2

void setup() {
  pinMode(enablePin, OUTPUT);
  pinMode(in1Pin, OUTPUT);
  pinMode(in2Pin, OUTPUT);
  Serial.begin(9600);
  Serial.println("DC Motor Controller Ready!");
}

void setMotor(int speed, bool forward) {
  digitalWrite(in1Pin, forward ? HIGH : LOW);
  digitalWrite(in2Pin, forward ? LOW : HIGH);
  analogWrite(enablePin, abs(speed));
}

void loop() {
  int knob = analogRead(A0);
  int speed = map(knob, 0, 1023, 0, 255);

  setMotor(speed, true);  // Forward at knob speed

  Serial.print("Speed: ");
  Serial.println(speed);

  delay(100);
}`,
    concepts: ['H-bridge', 'L293D', 'Motor direction', 'PWM speed control', 'Motor drivers'],
    kidFriendlyTip: '🔩 Tip: An H-bridge lets current flow in two directions through the motor — that\'s how you reverse it! The L293D chip has a built-in H-bridge.',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'motor', count: 1 }, { type: 'motor-driver', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'Motor speed and direction controlled', weight: 0.4, requiredFunctions: ['setup', 'loop', 'setMotor'] },
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

  // ── World 4: Smart Sensing ───────────────────────────────────────────────
  {
    id: 'push-button', slug: 'push-button', number: 11, prerequisite: 'dc-motor',
    title: 'Push Button', subtitle: 'Read user input!',
    description: 'Learn to detect button presses, handle debouncing, and toggle an LED on/off with each press.',
    difficulty: 'beginner', difficultyLabel: 'Beginner', estimatedTime: '20 min', xpReward: 120,
    color: '#06b6d4', icon: '🔘', world: 4,
    tags: ['button', 'debounce', 'INPUT_PULLUP'],
    startingComponents: ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor'],
    rewardComponents: [
      { type: 'openhw-pushbutton', name: 'Push Button', icon: '🔘', description: 'Read button presses!' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-pushbutton', label: 'Push Button', qty: 1 },
      { type: 'openhw-led', label: 'LED', qty: 1 },
      { type: 'openhw-resistor', label: '220 Ohm Resistor', qty: 1 },
    ],
    starterCode: `const int BTN_PIN = 2;
const int LED_PIN = 13;
bool ledState = false;
unsigned long lastDebounce = 0;
void setup() { pinMode(BTN_PIN, INPUT_PULLUP); pinMode(LED_PIN, OUTPUT); }
void loop() {
  if (digitalRead(BTN_PIN) == LOW && (millis() - lastDebounce) > 50) {
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState);
    lastDebounce = millis();
    delay(200);
  }
}`,
    concepts: ['digitalRead()', 'INPUT_PULLUP', 'Debouncing', 'Toggle logic'],
    kidFriendlyTip: 'With INPUT_PULLUP, pin reads HIGH normally and LOW when pressed!',
    evaluation: { passingThreshold: 70, evaluationCriteria: {
      components: { description: 'Button placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }] },
      wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
      codeFunctionality: { description: 'Button toggles LED', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
    }},
    badge: { id: 'badge_push_button', name: 'Input Master', description: 'Read a push button!', icon: '🔘', rarity: 'uncommon' },
  },
  {
    id: 'ultrasonic-sensor', slug: 'ultrasonic-sensor', number: 12, prerequisite: 'push-button',
    title: 'Ultrasonic Distance', subtitle: 'Measure distance with sound!',
    description: 'Use the HC-SR04 ultrasonic sensor to measure how far objects are using sound waves.',
    difficulty: 'intermediate', difficultyLabel: 'Intermediate', estimatedTime: '30 min', xpReward: 200,
    color: '#3b82f6', icon: '📡', world: 4,
    tags: ['ultrasonic', 'HC-SR04', 'distance'],
    startingComponents: ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor'],
    rewardComponents: [
      { type: 'openhw-hc-sr04', name: 'HC-SR04 Ultrasonic', icon: '📡', description: 'Measure 2cm to 400cm using sound!' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-hc-sr04', label: 'HC-SR04 Sensor', qty: 1 },
      { type: 'openhw-led', label: 'LED', qty: 1 },
      { type: 'openhw-resistor', label: '220 Ohm Resistor', qty: 1 },
    ],
    starterCode: `#define TRIG_PIN 9
#define ECHO_PIN 10
#define LED_PIN  11
void setup() { pinMode(TRIG_PIN,OUTPUT); pinMode(ECHO_PIN,INPUT); pinMode(LED_PIN,OUTPUT); Serial.begin(9600); }
long measureDistance() {
  digitalWrite(TRIG_PIN,LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN,HIGH); delayMicroseconds(10); digitalWrite(TRIG_PIN,LOW);
  return pulseIn(ECHO_PIN,HIGH)*0.0343/2;
}
void loop() {
  long cm = measureDistance();
  Serial.print("Distance: "); Serial.print(cm); Serial.println(" cm");
  analogWrite(LED_PIN, map(constrain(cm,5,50),50,5,0,255));
  delay(200);
}`,
    concepts: ['pulseIn()', 'Speed of sound', 'map()', 'constrain()'],
    kidFriendlyTip: 'Divide duration by 2 because sound goes THERE and BACK!',
    evaluation: { passingThreshold: 70, evaluationCriteria: {
      components: { description: 'HC-SR04 placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }] },
      wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
      codeFunctionality: { description: 'Measures distance', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
    }},
    badge: { id: 'badge_ultrasonic', name: 'Sonar Ranger', description: 'Measured distances with sound!', icon: '📡', rarity: 'rare' },
  },
  {
    id: 'dht11-sensor', slug: 'dht11-sensor', number: 13, prerequisite: 'ultrasonic-sensor',
    title: 'DHT11 Weather Station', subtitle: 'Read temperature and humidity!',
    description: 'Build a mini weather station using the DHT11 sensor.',
    difficulty: 'intermediate', difficultyLabel: 'Intermediate', estimatedTime: '25 min', xpReward: 220,
    color: '#ef4444', icon: '🌡️', world: 4,
    tags: ['DHT11', 'temperature', 'humidity'],
    startingComponents: ['openhw-arduino-uno', 'openhw-resistor'],
    rewardComponents: [
      { type: 'openhw-dht22', name: 'DHT11/DHT22 Sensor', icon: '🌡️', description: 'Measures temperature and humidity!' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-dht22', label: 'DHT11 Sensor', qty: 1 },
      { type: 'openhw-resistor', label: '10k Pull-up Resistor', qty: 1 },
    ],
    starterCode: `#include <DHT.h>
DHT dht(2, DHT11);
void setup() { Serial.begin(9600); dht.begin(); }
void loop() {
  delay(2000);
  float h = dht.readHumidity(), t = dht.readTemperature();
  if (!isnan(h) && !isnan(t)) {
    Serial.print("Temp: "); Serial.print(t); Serial.print("C  Hum: "); Serial.print(h); Serial.println("%");
  }
}`,
    concepts: ['DHT library', 'readTemperature()', 'readHumidity()'],
    kidFriendlyTip: 'Wait 2 seconds between readings - DHT11 max rate is 1Hz!',
    evaluation: { passingThreshold: 70, evaluationCriteria: {
      components: { description: 'DHT placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }] },
      wiringAccuracy: { description: 'Pull-up wiring', weight: 0.3, requiredConnections: [] },
      codeFunctionality: { description: 'Reads temp and humidity', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
    }},
    badge: { id: 'badge_dht11', name: 'Weather Watcher', description: 'Built a weather station!', icon: '🌡️', rarity: 'rare' },
  },
  {
    id: 'lcd-display', slug: 'lcd-display', number: 14, prerequisite: 'dht11-sensor',
    title: 'LCD Display', subtitle: 'Show messages on a screen!',
    description: 'Use I2C LCD to show text. Combine with DHT11 for a real weather station!',
    difficulty: 'advanced', difficultyLabel: 'Advanced', estimatedTime: '35 min', xpReward: 280,
    color: '#14b8a6', icon: '🖥️', world: 4,
    tags: ['LCD', 'I2C', 'display'],
    startingComponents: ['openhw-arduino-uno', 'openhw-dht22', 'openhw-resistor'],
    rewardComponents: [
      { type: 'openhw-lcd1602-i2c', name: 'I2C LCD Display', icon: '🖥️', description: '16x2 character display with just 2 wires!' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-lcd1602-i2c', label: 'I2C LCD Display', qty: 1 },
      { type: 'openhw-dht22', label: 'DHT11 Sensor', qty: 1 },
    ],
    starterCode: `#include <LiquidCrystal_I2C.h>
#include <DHT.h>
LiquidCrystal_I2C lcd(0x27,16,2);
DHT dht(2,DHT11);
void setup() { lcd.init(); lcd.backlight(); dht.begin(); lcd.print("Weather Station"); delay(2000); }
void loop() {
  delay(2000);
  float h=dht.readHumidity(), t=dht.readTemperature();
  if(isnan(h)||isnan(t)) return;
  lcd.clear();
  lcd.setCursor(0,0); lcd.print("Temp: "); lcd.print(t,1); lcd.print("C");
  lcd.setCursor(0,1); lcd.print("Hum:  "); lcd.print(h,1); lcd.print("%");
}`,
    concepts: ['LiquidCrystal_I2C', 'I2C (SDA=A4, SCL=A5)', 'lcd.setCursor()'],
    kidFriendlyTip: 'If screen is blank, adjust the contrast knob on the back of the module!',
    evaluation: { passingThreshold: 70, evaluationCriteria: {
      components: { description: 'LCD placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }] },
      wiringAccuracy: { description: 'I2C wiring', weight: 0.3, requiredConnections: [] },
      codeFunctionality: { description: 'Text on LCD', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
    }},
    badge: { id: 'badge_lcd', name: 'Display Wizard', description: 'Showed live data on LCD!', icon: '🖥️', rarity: 'epic' },
  },

  // ── World 5: Advanced Components ─────────────────────────────────────────────
  {
    id: 'relay-control', slug: 'relay-control', number: 15, prerequisite: 'lcd-display',
    title: 'Relay Switch', subtitle: 'Control real-world devices!',
    description: 'Use a relay module to switch devices on/off. Learn electrical isolation and build a smart timer.',
    difficulty: 'intermediate', difficultyLabel: 'Intermediate', estimatedTime: '25 min', xpReward: 200,
    color: '#ef4444', icon: '🔌', world: 5, tags: ['relay', 'switch', 'automation'],
    startingComponents: ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor'],
    rewardComponents: [{ type: 'openhw-relay-module', name: 'Relay Module', icon: '🔌', description: 'Control high-voltage devices safely!' }],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-relay-module', label: 'Relay Module', qty: 1 },
      { type: 'openhw-led', label: 'LED', qty: 1 },
      { type: 'openhw-resistor', label: '220 Ohm Resistor', qty: 1 },
    ],
    starterCode: `const int RELAY_PIN = 7;
void setup() { pinMode(RELAY_PIN, OUTPUT); digitalWrite(RELAY_PIN, HIGH); Serial.begin(9600); }
void loop() {
  Serial.println("ON"); digitalWrite(RELAY_PIN, LOW); delay(3000);
  Serial.println("OFF"); digitalWrite(RELAY_PIN, HIGH); delay(2000);
}`,
    concepts: ['Relay module', 'Active LOW', 'Electrical isolation'],
    kidFriendlyTip: 'Most relays are active LOW - HIGH = OFF, LOW = ON!',
    evaluation: { passingThreshold: 70, evaluationCriteria: {
      components: { description: 'Relay placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }] },
      wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
      codeFunctionality: { description: 'Relay toggles', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
    }},
    badge: { id: 'badge_relay', name: 'Power Switcher', description: 'Controlled a relay!', icon: '🔌', rarity: 'rare' },
  },
  {
    id: 'oled-graphics', slug: 'oled-graphics', number: 16, prerequisite: 'relay-control',
    title: 'OLED Graphics Display', subtitle: 'Draw anything on a screen!',
    description: 'Use the SSD1306 OLED to draw text, shapes, and animations.',
    difficulty: 'intermediate', difficultyLabel: 'Intermediate', estimatedTime: '30 min', xpReward: 230,
    color: '#6366f1', icon: '🎨', world: 5, tags: ['OLED', 'SSD1306', 'I2C', 'graphics'],
    startingComponents: ['openhw-arduino-uno'],
    rewardComponents: [{ type: 'openhw-ssd1306', name: 'OLED Display (SSD1306)', icon: '🎨', description: '128x64 pixel display with just 2 wires!' }],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-ssd1306', label: 'SSD1306 OLED', qty: 1 },
    ],
    starterCode: `#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
Adafruit_SSD1306 display(128, 64, &Wire, -1);
void setup() {
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  display.clearDisplay();
  display.setTextSize(2); display.setTextColor(SSD1306_WHITE);
  display.setCursor(10,10); display.println("OpenHW");
  display.drawLine(0,30,127,30,SSD1306_WHITE);
  display.setTextSize(1); display.setCursor(0,40); display.println("128x64 OLED Demo");
  display.display();
}
void loop() {
  static int x=0,y=48,dx=2,dy=1;
  display.fillCircle(x,y,3,SSD1306_BLACK);
  x+=dx; y+=dy;
  if(x>=128||x<=0) dx=-dx;
  if(y>=60||y<=30) dy=-dy;
  display.fillCircle(x,y,3,SSD1306_WHITE);
  display.display(); delay(30);
}`,
    concepts: ['Adafruit SSD1306', 'Adafruit GFX', 'fillCircle', 'display.display()'],
    kidFriendlyTip: 'Always call display.display() after drawing - nothing shows until you do!',
    evaluation: { passingThreshold: 70, evaluationCriteria: {
      components: { description: 'OLED placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }] },
      wiringAccuracy: { description: 'I2C wiring', weight: 0.3, requiredConnections: [] },
      codeFunctionality: { description: 'Content on OLED', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
    }},
    badge: { id: 'badge_oled', name: 'Pixel Artist', description: 'Drew graphics on OLED!', icon: '🎨', rarity: 'rare' },
  },
  {
    id: 'neopixel-effects', slug: 'neopixel-effects', number: 17, prerequisite: 'oled-graphics',
    title: 'NeoPixel Light Show', subtitle: 'RGB magic with one wire!',
    description: 'Control WS2812B NeoPixels. Build rainbow and chaser animations.',
    difficulty: 'intermediate', difficultyLabel: 'Intermediate', estimatedTime: '30 min', xpReward: 240,
    color: '#ec4899', icon: '🌈', world: 5, tags: ['neopixel', 'WS2812B', 'RGB'],
    startingComponents: ['openhw-arduino-uno'],
    rewardComponents: [
      { type: 'openhw-neopixel-ring', name: 'NeoPixel Ring', icon: '🌈', description: 'Addressable RGB LEDs!' },
      { type: 'openhw-neopixel-matrix', name: 'NeoPixel Matrix', icon: '🌈', description: 'WS2812B LED matrix!' },
      { type: 'openhw-ws2812b', name: 'WS2812B Strip', icon: '🌈', description: 'WS2812B LED strip!' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-neopixel-ring', label: 'NeoPixel Ring (12 LEDs)', qty: 1 },
    ],
    starterCode: `#include <Adafruit_NeoPixel.h>
#define LED_PIN 6
#define LED_COUNT 12
Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);
void setup() { strip.begin(); strip.setBrightness(80); strip.show(); }
void loop() {
  for (long hue = 0; hue < 5*65536; hue += 256) {
    strip.rainbow(hue); strip.show(); delay(10);
  }
}`,
    concepts: ['Adafruit NeoPixel', 'strip.show()', 'rainbow()', 'setBrightness()'],
    kidFriendlyTip: 'Keep brightness below 100 on USB power! Use external 5V for >8 LEDs.',
    evaluation: { passingThreshold: 70, evaluationCriteria: {
      components: { description: 'NeoPixel placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }] },
      wiringAccuracy: { description: 'Data wire correct', weight: 0.3, requiredConnections: [] },
      codeFunctionality: { description: 'NeoPixels animate', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
    }},
    badge: { id: 'badge_neopixel', name: 'Light Artist', description: 'Created NeoPixel animations!', icon: '🌈', rarity: 'epic' },
  },
  {
    id: 'keypad-lock', slug: 'keypad-lock', number: 18, prerequisite: 'neopixel-effects',
    title: 'Keypad Security Lock', subtitle: 'Build a PIN entry system!',
    description: 'Wire a 4x4 membrane keypad and build a PIN-protected lock.',
    difficulty: 'intermediate', difficultyLabel: 'Intermediate', estimatedTime: '35 min', xpReward: 260,
    color: '#0ea5e9', icon: '⌨️', world: 5, tags: ['keypad', 'matrix', 'PIN'],
    startingComponents: ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor'],
    rewardComponents: [{ type: 'openhw-membrane-keypad', name: 'Membrane Keypad', icon: '⌨️', description: '16 keys with just 8 wires!' }],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-membrane-keypad', label: '4x4 Keypad', qty: 1 },
      { type: 'openhw-led', label: 'Green LED', qty: 1 },
      { type: 'openhw-led', label: 'Red LED', qty: 1 },
      { type: 'openhw-resistor', label: '220 Ohm Resistors', qty: 2 },
    ],
    starterCode: `#include <Keypad.h>
const byte ROWS=4,COLS=4;
char keys[4][4]={{'1','2','3','A'},{'4','5','6','B'},{'7','8','9','C'},{'*','0','#','D'}};
byte rP[4]={2,3,4,5},cP[4]={6,7,8,9};
Keypad keypad=Keypad(makeKeymap(keys),rP,cP,ROWS,COLS);
const String PIN="1234";
String entered="";
const int G=11,R=12;
void setup(){pinMode(G,OUTPUT);pinMode(R,OUTPUT);Serial.begin(9600);}
void loop(){
  char k=keypad.getKey(); if(!k) return;
  if(k=='#'){
    if(entered==PIN){digitalWrite(G,HIGH);delay(2000);digitalWrite(G,LOW);}
    else{for(int i=0;i<3;i++){digitalWrite(R,HIGH);delay(200);digitalWrite(R,LOW);delay(200);}}
    entered="";
  } else if(k=='*') entered="";
  else entered+=k;
}`,
    concepts: ['Keypad library', 'Matrix scanning', 'PIN entry'],
    kidFriendlyTip: 'Press * to clear, # to confirm. Change PIN to your own secret code!',
    evaluation: { passingThreshold: 70, evaluationCriteria: {
      components: { description: 'Keypad placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }] },
      wiringAccuracy: { description: 'Row/col wiring', weight: 0.3, requiredConnections: [] },
      codeFunctionality: { description: 'PIN entry works', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
    }},
    badge: { id: 'badge_keypad', name: 'Security Expert', description: 'Built a PIN entry system!', icon: '🔐', rarity: 'rare' },
  },
  {
    id: 'rotary-menu', slug: 'rotary-menu', number: 19, prerequisite: 'keypad-lock',
    title: 'Rotary Encoder Menu', subtitle: 'Navigate with a knob!',
    description: 'Combine rotary encoder with OLED to build a scrollable menu. Turn to navigate, click to select!',
    difficulty: 'advanced', difficultyLabel: 'Advanced', estimatedTime: '40 min', xpReward: 300,
    color: '#8b5cf6', icon: '🎛️', world: 5, tags: ['rotary encoder', 'menu', 'OLED'],
    startingComponents: ['openhw-arduino-uno', 'openhw-ssd1306'],
    rewardComponents: [{ type: 'openhw-rotary-encoder', name: 'Rotary Encoder', icon: '🎛️', description: 'Infinite-turn knob with click button!' }],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-rotary-encoder', label: 'Rotary Encoder', qty: 1 },
      { type: 'openhw-ssd1306', label: 'SSD1306 OLED', qty: 1 },
    ],
    starterCode: `#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
Adafruit_SSD1306 display(128,64,&Wire,-1);
#define CLK 2
#define DT  3
#define SW  4
const char* menu[]={"LED Blink","Servo Sweep","Buzzer","Settings","About"};
volatile int pos=0;
int lastCLK,sel=0;
void onChange(){int c=digitalRead(CLK);if(c!=lastCLK){pos+=(digitalRead(DT)!=c)?1:-1;lastCLK=c;}}
void draw(){
  display.clearDisplay(); display.setTextSize(1);
  for(int i=0;i<5;i++){
    if(i==sel){display.fillRect(0,i*12,128,12,SSD1306_WHITE);display.setTextColor(SSD1306_BLACK);}
    else display.setTextColor(SSD1306_WHITE);
    display.setCursor(4,i*12+2);display.print(menu[i]);
  }
  display.display();
}
void setup(){
  pinMode(CLK,INPUT_PULLUP);pinMode(DT,INPUT_PULLUP);pinMode(SW,INPUT_PULLUP);
  lastCLK=digitalRead(CLK);
  attachInterrupt(digitalPinToInterrupt(CLK),onChange,CHANGE);
  display.begin(SSD1306_SWITCHCAPVCC,0x3C); draw();
}
void loop(){
  if(pos!=0){sel=(sel+pos+5)%5;pos=0;draw();}
}`,
    concepts: ['attachInterrupt()', 'volatile', 'OLED menu', 'Rotary quadrature'],
    kidFriendlyTip: 'Always use volatile for interrupt-shared variables - the compiler may cache non-volatile ones!',
    evaluation: { passingThreshold: 70, evaluationCriteria: {
      components: { description: 'Encoder + OLED placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }] },
      wiringAccuracy: { description: 'CLK on interrupt pin', weight: 0.3, requiredConnections: [] },
      codeFunctionality: { description: 'Menu scrolls', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
    }},
    badge: { id: 'badge_rotary', name: 'UI Builder', description: 'Built a scrollable menu!', icon: '🎛️', rarity: 'epic' },
  },
  {
    id: 'seven-segment-clock', slug: 'seven-segment-clock', number: 20, prerequisite: 'rotary-menu',
    title: '7-Segment Stopwatch', subtitle: 'Display digits with LEDs!',
    description: 'Use TM1637 4-digit display to build a stopwatch with start/stop and reset buttons.',
    difficulty: 'intermediate', difficultyLabel: 'Intermediate', estimatedTime: '30 min', xpReward: 240,
    color: '#f97316', icon: '🔢', world: 5, tags: ['7segment', 'TM1637', 'stopwatch'],
    startingComponents: ['openhw-arduino-uno', 'openhw-pushbutton'],
    rewardComponents: [{ type: 'openhw-tm1637-7segment', name: 'TM1637 7-Segment', icon: '🔢', description: '4-digit LED display with just 2 wires!' }],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-tm1637-7segment', label: 'TM1637 Display', qty: 1 },
      { type: 'openhw-pushbutton', label: 'Start/Stop Button', qty: 1 },
      { type: 'openhw-pushbutton', label: 'Reset Button', qty: 1 },
    ],
    starterCode: `#include <TM1637Display.h>
TM1637Display display(6,7);
bool running=false;
unsigned long startTime=0,elapsed=0;
void setup(){display.setBrightness(5);display.showNumberDec(0,true);pinMode(2,INPUT_PULLUP);pinMode(3,INPUT_PULLUP);}
void loop(){
  if(digitalRead(2)==LOW){delay(50);if(digitalRead(2)==LOW){running=!running;if(running)startTime=millis()-elapsed;while(digitalRead(2)==LOW);}}
  if(digitalRead(3)==LOW){running=false;elapsed=0;display.showNumberDec(0,true);while(digitalRead(3)==LOW);}
  if(running){elapsed=millis()-startTime;int s=(elapsed/1000)%60,m=(elapsed/60000)%60;display.showNumberDecEx(m*100+s,0x40,true);}
}`,
    concepts: ['TM1637Display', 'showNumberDecEx()', 'Colon 0x40', 'millis()'],
    kidFriendlyTip: '0x40 bitmask enables the colon for MM:SS display!',
    evaluation: { passingThreshold: 70, evaluationCriteria: {
      components: { description: 'TM1637 placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }] },
      wiringAccuracy: { description: 'CLK and DIO wired', weight: 0.3, requiredConnections: [] },
      codeFunctionality: { description: 'Stopwatch counts', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
    }},
    badge: { id: 'badge_7seg', name: 'Digit Master', description: 'Built a working stopwatch!', icon: '🔢', rarity: 'rare' },
  },
  {
    id: 'stepper-motor', slug: 'stepper-motor', number: 21, prerequisite: 'seven-segment-clock',
    title: 'Stepper Motor Control', subtitle: 'Precise motor positioning!',
    description: 'Control a stepper motor with an A4988 driver. Rotate to exact angles like 3D printers do!',
    difficulty: 'advanced', difficultyLabel: 'Advanced', estimatedTime: '40 min', xpReward: 320,
    color: '#64748b', icon: '⚙️', world: 5, tags: ['stepper', 'A4988', 'precise'],
    startingComponents: ['openhw-arduino-uno'],
    rewardComponents: [
      { type: 'openhw-stepper-motor', name: 'Stepper Motor', icon: '⚙️', description: 'Precise angular control!' },
      { type: 'openhw-a4988', name: 'A4988 Driver', icon: '⚙️', description: 'Stepper driver chip.' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-stepper-motor', label: 'NEMA17 Stepper', qty: 1 },
      { type: 'openhw-a4988', label: 'A4988 Driver', qty: 1 },
    ],
    starterCode: `#define STEP 3
#define DIR  4
#define SPR  200
void setup(){pinMode(STEP,OUTPUT);pinMode(DIR,OUTPUT);Serial.begin(9600);}
void stepMotor(int steps,int us=1500){for(int i=0;i<abs(steps);i++){digitalWrite(STEP,HIGH);delayMicroseconds(us);digitalWrite(STEP,LOW);delayMicroseconds(us);}}
void rotate(float deg,bool cw=true){digitalWrite(DIR,cw?HIGH:LOW);stepMotor((int)(deg/360.0*SPR));delay(200);}
void loop(){rotate(90);delay(500);rotate(90,false);delay(500);rotate(360);delay(1000);}`,
    concepts: ['STEP/DIR pins', 'Steps per revolution', 'delayMicroseconds()'],
    kidFriendlyTip: 'Add a 100uF capacitor across VMOT and GND to protect the A4988 driver!',
    evaluation: { passingThreshold: 70, evaluationCriteria: {
      components: { description: 'Stepper + driver placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }] },
      wiringAccuracy: { description: 'Coils wired', weight: 0.3, requiredConnections: [] },
      codeFunctionality: { description: 'Motor rotates', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
    }},
    badge: { id: 'badge_stepper', name: 'Precision Engineer', description: 'Controlled a stepper motor!', icon: '⚙️', rarity: 'epic' },
  },
  {
    id: 'mpu6050-tilt', slug: 'mpu6050-tilt', number: 22, prerequisite: 'stepper-motor',
    title: 'MPU6050 Tilt Detector', subtitle: 'Detect motion and tilt!',
    description: 'Read data from the MPU6050 6-axis IMU. Calculate tilt angles and build a tilt-controlled LED.',
    difficulty: 'advanced', difficultyLabel: 'Advanced', estimatedTime: '45 min', xpReward: 360,
    color: '#14b8a6', icon: '🛸', world: 5, tags: ['MPU6050', 'gyroscope', 'accelerometer'],
    startingComponents: ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor'],
    rewardComponents: [{ type: 'openhw-mpu6050', name: 'MPU6050 IMU', icon: '🛸', description: '6-axis motion sensor used in drones!' }],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-mpu6050', label: 'MPU6050', qty: 1 },
      { type: 'openhw-led', label: 'LED', qty: 1 },
      { type: 'openhw-resistor', label: '220 Ohm Resistor', qty: 1 },
    ],
    starterCode: `#include <Wire.h>
#include <MPU6050.h>
MPU6050 mpu;
const int LED=13;
void setup(){Serial.begin(9600);Wire.begin();mpu.initialize();pinMode(LED,OUTPUT);}
void loop(){
  int16_t ax,ay,az,gx,gy,gz;
  mpu.getMotion6(&ax,&ay,&az,&gx,&gy,&gz);
  float axg=ax/16384.0,ayg=ay/16384.0,azg=az/16384.0;
  float pitch=atan2(ayg,azg)*180.0/PI;
  float roll=atan2(-axg,azg)*180.0/PI;
  Serial.print("Pitch:"); Serial.print(pitch,1);
  Serial.print(" Roll:"); Serial.println(roll,1);
  digitalWrite(LED,(abs(pitch)>20||abs(roll)>20)?HIGH:LOW);
  delay(100);
}`,
    concepts: ['MPU6050 library', 'getMotion6()', 'atan2() tilt angle', 'g-force'],
    kidFriendlyTip: 'atan2() converts X/Y/Z acceleration into degrees of tilt. Used in every drone and phone!',
    evaluation: { passingThreshold: 70, evaluationCriteria: {
      components: { description: 'MPU6050 placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }] },
      wiringAccuracy: { description: 'I2C wiring', weight: 0.3, requiredConnections: [] },
      codeFunctionality: { description: 'Tilt detected', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
    }},
    badge: { id: 'badge_mpu6050', name: 'Motion Master', description: 'Read a 6-axis IMU!', icon: '🛸', rarity: 'legendary' },
  },
  // ══════════════════════════════════════════════════════════════════════════════
  // ── ESP32 Journey ─────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  // ── World 1: ESP32 Basics ────────────────────────────────────────────────────

  {
    id: 'esp32-blink',
    slug: 'esp32-blink',
    number: 1,
    prerequisite: null,
    title: 'ESP32 LED Blink',
    subtitle: 'Your first ESP32 program',
    description: 'Make an LED blink using the ESP32. Learn the difference between Arduino Uno and ESP32 pin numbering.',
    difficulty: 'beginner', difficultyLabel: 'Beginner', estimatedTime: '15 min', xpReward: 100,
    color: '#22c55e', icon: '🟢', world: 1,
    tags: ['ESP32', 'LED', 'GPIO', 'blink'],
    startingComponents: ['openhw-esp32', 'openhw-led', 'openhw-resistor'],
    rewardComponents: [{ type: 'openhw-esp32', name: 'ESP32 DevKit', icon: '📡', description: 'WiFi+BT microcontroller — unlocks the whole ESP32 journey!' }],
    components: [
      { type: 'openhw-esp32', label: 'ESP32 DevKit', qty: 1 },
      { type: 'openhw-led', label: 'LED', qty: 1 },
      { type: 'openhw-resistor', label: '220Ω Resistor', qty: 1, attrs: { value: '220' } },
    ],
    wiring: [
      { from: 'ESP32 GPIO 2 (built-in LED)', to: 'LED anode (+)' },
      { from: 'LED cathode (−)', to: '220Ω resistor' },
      { from: 'Resistor', to: 'ESP32 GND' },
    ],
    starterCode: `// ESP32 LED Blink
#define LED_PIN 2  // GPIO 2 = built-in LED on most ESP32 boards

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  Serial.println("ESP32 Blink started!");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  Serial.println("LED ON");
  delay(1000);
  digitalWrite(LED_PIN, LOW);
  Serial.println("LED OFF");
  delay(1000);
}`,
    concepts: ['GPIO numbering on ESP32', 'Serial.begin(115200)', 'Built-in LED on GPIO 2'],
    kidFriendlyTip: '📡 ESP32 uses GPIO numbers, not pin numbers. GPIO 2 is the built-in blue LED!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'ESP32 + LED placed', weight: 0.3, required: [{ type: 'esp32', count: 1 }, { type: 'led', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [
          { from: { component: 'esp32', pin: '2' }, to: { component: 'led', terminal: 'A' } },
          { from: { component: 'led', terminal: 'K' }, to: { component: 'resistor', terminal: '1' } },
          { from: { component: 'resistor', terminal: '2' }, to: { component: 'esp32', pin: 'GND' } },
        ]},
        codeFunctionality: { description: 'Code blinks LED', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: { id: 'badge_esp32_blink', name: 'ESP32 Starter', description: 'Ran your first ESP32 program!', icon: '🟢', rarity: 'common' },
  },

  {
    id: 'esp32-analog',
    slug: 'esp32-analog',
    number: 2,
    prerequisite: 'esp32-blink',
    title: 'ESP32 Analog Read',
    subtitle: 'Read sensors with ADC',
    description: 'Use the ESP32\'s 12-bit ADC to read a potentiometer. Learn how ESP32 ADC differs from Arduino\'s 10-bit ADC.',
    difficulty: 'beginner', difficultyLabel: 'Beginner', estimatedTime: '20 min', xpReward: 120,
    color: '#22c55e', icon: '🎚️', world: 1,
    tags: ['ESP32', 'ADC', 'analog', 'potentiometer'],
    startingComponents: ['openhw-esp32', 'openhw-potentiometer'],
    rewardComponents: [{ type: 'openhw-dht22', name: 'DHT22 Sensor', icon: '🌡️', description: 'Temperature & humidity sensor — great for IoT weather stations!' }],
    components: [
      { type: 'openhw-esp32', label: 'ESP32 DevKit', qty: 1 },
      { type: 'openhw-potentiometer', label: 'Potentiometer 10kΩ', qty: 1 },
    ],
    wiring: [
      { from: 'Potentiometer VCC', to: 'ESP32 3V3' },
      { from: 'Potentiometer GND', to: 'ESP32 GND' },
      { from: 'Potentiometer signal (middle pin)', to: 'ESP32 GPIO 34 (ADC)' },
    ],
    starterCode: `// ESP32 Analog Read — 12-bit ADC (0-4095)
#define POT_PIN 34  // GPIO 34 is input-only, perfect for analog

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);  // ESP32: set 12-bit resolution (0-4095)
}

void loop() {
  int raw = analogRead(POT_PIN);
  float voltage = raw * (3.3 / 4095.0);
  int percent = map(raw, 0, 4095, 0, 100);

  Serial.print("Raw: "); Serial.print(raw);
  Serial.print("  Voltage: "); Serial.print(voltage, 2); Serial.print("V");
  Serial.print("  Position: "); Serial.print(percent); Serial.println("%");
  delay(200);
}`,
    concepts: ['12-bit ADC (0-4095)', 'analogReadResolution()', 'map()', 'GPIO 34 input-only'],
    kidFriendlyTip: '📊 ESP32 reads analog values from 0-4095 (12-bit), while Arduino only goes 0-1023 (10-bit). More precision!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'ESP32 + potentiometer', weight: 0.3, required: [{ type: 'esp32', count: 1 }] },
        wiringAccuracy: { description: 'Pot wired to ADC pin', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'Reads analog value', weight: 0.4, requiredFunctions: ['setup', 'loop', 'analogRead'] },
      },
    },
    badge: { id: 'badge_esp32_analog', name: 'ADC Pro', description: 'Used the ESP32\'s 12-bit ADC!', icon: '🎚️', rarity: 'common' },
  },

  {
    id: 'esp32-pwm',
    slug: 'esp32-pwm',
    number: 3,
    prerequisite: 'esp32-analog',
    title: 'ESP32 PWM & LED Dimming',
    subtitle: 'Smooth LED control with LEDC',
    description: 'Use the ESP32\'s LEDC hardware PWM to smoothly dim an LED. ESP32 has 16 PWM channels — much more powerful than Arduino.',
    difficulty: 'beginner', difficultyLabel: 'Beginner', estimatedTime: '25 min', xpReward: 140,
    color: '#22c55e', icon: '💡', world: 1,
    tags: ['ESP32', 'PWM', 'LEDC', 'LED dimming'],
    startingComponents: ['openhw-esp32', 'openhw-led', 'openhw-resistor'],
    rewardComponents: [{ type: 'openhw-servo', name: 'Servo Motor', icon: '⚙️', description: 'Control servo position using ESP32 PWM channels!' }],
    components: [
      { type: 'openhw-esp32', label: 'ESP32 DevKit', qty: 1 },
      { type: 'openhw-led', label: 'LED', qty: 1 },
      { type: 'openhw-resistor', label: '220Ω Resistor', qty: 1, attrs: { value: '220' } },
    ],
    wiring: [
      { from: 'ESP32 GPIO 16', to: 'LED anode (+)' },
      { from: 'LED cathode (−)', to: '220Ω resistor' },
      { from: 'Resistor', to: 'ESP32 GND' },
    ],
    starterCode: `// ESP32 PWM with LEDC API
const int LED_PIN    = 16;
const int PWM_CHAN   = 0;   // 16 channels available (0-15)
const int PWM_FREQ   = 5000; // 5kHz
const int PWM_RES    = 8;   // 8-bit: 0-255

void setup() {
  ledcSetup(PWM_CHAN, PWM_FREQ, PWM_RES);
  ledcAttachPin(LED_PIN, PWM_CHAN);
  Serial.begin(115200);
}

void loop() {
  // Fade in
  for (int duty = 0; duty <= 255; duty += 5) {
    ledcWrite(PWM_CHAN, duty);
    delay(15);
  }
  // Fade out
  for (int duty = 255; duty >= 0; duty -= 5) {
    ledcWrite(PWM_CHAN, duty);
    delay(15);
  }
}`,
    concepts: ['ledcSetup()', 'ledcAttachPin()', 'ledcWrite()', 'PWM channels', 'Duty cycle'],
    kidFriendlyTip: '💡 ESP32 uses ledcWrite() instead of analogWrite(). It has 16 independent PWM channels — you can control 16 LEDs/servos at once!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'ESP32 + LED placed', weight: 0.3, required: [{ type: 'esp32', count: 1 }, { type: 'led', count: 1 }] },
        wiringAccuracy: { description: 'LED wired to GPIO', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'LED fades smoothly', weight: 0.4, requiredFunctions: ['setup', 'loop', 'ledcWrite'] },
      },
    },
    badge: { id: 'badge_esp32_pwm', name: 'PWM Master', description: 'Used ESP32 LEDC PWM channels!', icon: '💡', rarity: 'uncommon' },
  },

  // ── World 2: WiFi & Web ───────────────────────────────────────────────────────

  {
    id: 'esp32-wifi-scan',
    slug: 'esp32-wifi-scan',
    number: 4,
    prerequisite: 'esp32-pwm',
    title: 'WiFi Scanner',
    subtitle: 'Discover nearby networks',
    description: 'Use the ESP32 to scan and list all nearby WiFi networks, showing their SSID, signal strength (RSSI), and encryption type.',
    difficulty: 'intermediate', difficultyLabel: 'Intermediate', estimatedTime: '20 min', xpReward: 160,
    color: '#3b82f6', icon: '📶', world: 2,
    tags: ['ESP32', 'WiFi', 'RSSI', 'scanning'],
    startingComponents: ['openhw-esp32'],
    rewardComponents: [{ type: 'openhw-esp32', name: 'WiFi Unlocked', icon: '📶', description: 'Your ESP32 can now connect to the internet!' }],
    components: [{ type: 'openhw-esp32', label: 'ESP32 DevKit', qty: 1 }],
    wiring: [],
    starterCode: `#include <WiFi.h>

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  Serial.println("WiFi Scanner ready!");
}

void loop() {
  Serial.println("Scanning...");
  int n = WiFi.scanNetworks();

  if (n == 0) {
    Serial.println("No networks found.");
  } else {
    Serial.println(String(n) + " networks found:");
    for (int i = 0; i < n; i++) {
      Serial.print(i + 1);
      Serial.print(": ");
      Serial.print(WiFi.SSID(i));
      Serial.print(" (");
      Serial.print(WiFi.RSSI(i));
      Serial.print(" dBm) ");
      Serial.println(WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "Open" : "Secured");
    }
  }
  delay(5000);
}`,
    concepts: ['WiFi.h library', 'WiFi.scanNetworks()', 'RSSI signal strength', 'WiFi.SSID()', 'WIFI_STA mode'],
    kidFriendlyTip: '📶 RSSI is signal strength — closer to 0 is stronger. -30 dBm is excellent, -90 dBm is barely usable.',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'ESP32 present', weight: 0.3, required: [{ type: 'esp32', count: 1 }] },
        wiringAccuracy: { description: 'No wiring needed', weight: 0.1, requiredConnections: [] },
        codeFunctionality: { description: 'Scans networks', weight: 0.6, requiredFunctions: ['setup', 'loop', 'scanNetworks'] },
      },
    },
    badge: { id: 'badge_esp32_wifi', name: 'WiFi Explorer', description: 'Scanned WiFi networks with ESP32!', icon: '📶', rarity: 'uncommon' },
  },

  {
    id: 'esp32-web-server',
    slug: 'esp32-web-server',
    number: 5,
    prerequisite: 'esp32-wifi-scan',
    title: 'ESP32 Web Server',
    subtitle: 'Control LED from a browser',
    description: 'Host a mini web page on the ESP32. Connect your phone or laptop to control an LED by clicking a button in the browser.',
    difficulty: 'intermediate', difficultyLabel: 'Intermediate', estimatedTime: '35 min', xpReward: 200,
    color: '#3b82f6', icon: '🌐', world: 2,
    tags: ['ESP32', 'WiFi', 'WebServer', 'HTML', 'IoT'],
    startingComponents: ['openhw-esp32', 'openhw-led', 'openhw-resistor'],
    rewardComponents: [{ type: 'openhw-esp32', name: 'Web Server Pro', icon: '🌐', description: 'Your ESP32 is now a web server!' }],
    components: [
      { type: 'openhw-esp32', label: 'ESP32 DevKit', qty: 1 },
      { type: 'openhw-led', label: 'LED', qty: 1 },
      { type: 'openhw-resistor', label: '220Ω Resistor', qty: 1 },
    ],
    wiring: [
      { from: 'ESP32 GPIO 2', to: 'LED anode via resistor' },
      { from: 'LED cathode', to: 'ESP32 GND' },
    ],
    starterCode: `#include <WiFi.h>
#include <WebServer.h>

const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const int   LED_PIN  = 2;

WebServer server(80);
bool ledState = false;

void handleRoot() {
  String html = "<html><body style='font-family:sans-serif;text-align:center;padding:40px'>";
  html += "<h1>ESP32 LED Control</h1>";
  html += "<p>LED is: <b>" + String(ledState ? "ON" : "OFF") + "</b></p>";
  html += "<a href='/toggle'><button style='padding:20px 40px;font-size:20px;border-radius:10px;background:" +
          String(ledState ? "#ef4444" : "#22c55e") + ";color:white;border:none;cursor:pointer'>";
  html += ledState ? "Turn OFF" : "Turn ON";
  html += "</button></a></body></html>";
  server.send(200, "text/html", html);
}

void handleToggle() {
  ledState = !ledState;
  digitalWrite(LED_PIN, ledState ? HIGH : LOW);
  server.sendHeader("Location", "/");
  server.send(302);
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\\nIP: " + WiFi.localIP().toString());
  server.on("/", handleRoot);
  server.on("/toggle", handleToggle);
  server.begin();
}

void loop() { server.handleClient(); }`,
    concepts: ['WebServer library', 'server.on()', 'server.handleClient()', 'WiFi.localIP()', 'HTML responses'],
    kidFriendlyTip: '🌐 Your ESP32 gets an IP address on your WiFi. Open that IP in any browser on the same network to see your web page!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'ESP32 + LED', weight: 0.3, required: [{ type: 'esp32', count: 1 }, { type: 'led', count: 1 }] },
        wiringAccuracy: { description: 'LED wired correctly', weight: 0.2, requiredConnections: [] },
        codeFunctionality: { description: 'Web server serves HTML', weight: 0.5, requiredFunctions: ['setup', 'loop', 'server'] },
      },
    },
    badge: { id: 'badge_esp32_webserver', name: 'Web Developer', description: 'Hosted a website on ESP32!', icon: '🌐', rarity: 'rare' },
  },

  {
    id: 'esp32-http-client',
    slug: 'esp32-http-client',
    number: 6,
    prerequisite: 'esp32-web-server',
    title: 'HTTP Client & APIs',
    subtitle: 'Fetch data from the internet',
    description: 'Use the ESP32 as an HTTP client to fetch JSON data from a public API. Display live weather or time data on the Serial Monitor.',
    difficulty: 'intermediate', difficultyLabel: 'Intermediate', estimatedTime: '30 min', xpReward: 200,
    color: '#3b82f6', icon: '☁️', world: 2,
    tags: ['ESP32', 'HTTP', 'API', 'JSON', 'WiFi'],
    startingComponents: ['openhw-esp32'],
    rewardComponents: [{ type: 'openhw-oled', name: 'OLED Display', icon: '🖥️', description: 'Show your API data on a tiny display!' }],
    components: [{ type: 'openhw-esp32', label: 'ESP32 DevKit', qty: 1 }],
    wiring: [],
    starterCode: `#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\\nConnected! Fetching time...");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin("http://worldtimeapi.org/api/ip");
    int code = http.GET();

    if (code == 200) {
      String payload = http.getString();
      DynamicJsonDocument doc(2048);
      deserializeJson(doc, payload);
      Serial.print("Time: ");
      Serial.println(doc["datetime"].as<String>());
      Serial.print("Timezone: ");
      Serial.println(doc["timezone"].as<String>());
    } else {
      Serial.println("HTTP Error: " + String(code));
    }
    http.end();
  }
  delay(10000);
}`,
    concepts: ['HTTPClient', 'GET requests', 'ArduinoJson', 'deserializeJson()', 'REST APIs'],
    kidFriendlyTip: '☁️ APIs are like restaurants for data. You send a GET request (your order), and the server sends back JSON (your meal)!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'ESP32 present', weight: 0.2, required: [{ type: 'esp32', count: 1 }] },
        wiringAccuracy: { description: 'No wiring needed', weight: 0.1, requiredConnections: [] },
        codeFunctionality: { description: 'HTTP GET + JSON parse', weight: 0.7, requiredFunctions: ['setup', 'loop', 'http'] },
      },
    },
    badge: { id: 'badge_esp32_http', name: 'API Ninja', description: 'Fetched live data from the internet!', icon: '☁️', rarity: 'rare' },
  },

  // ── World 3: IoT & Connectivity ───────────────────────────────────────────────

  {
    id: 'esp32-mqtt',
    slug: 'esp32-mqtt',
    number: 7,
    prerequisite: 'esp32-http-client',
    title: 'MQTT Messaging',
    subtitle: 'IoT pub/sub communication',
    description: 'Use MQTT to send and receive messages between ESP32 devices. The protocol behind millions of smart home devices.',
    difficulty: 'advanced', difficultyLabel: 'Advanced', estimatedTime: '40 min', xpReward: 240,
    color: '#f97316', icon: '📨', world: 3,
    tags: ['ESP32', 'MQTT', 'IoT', 'pub/sub', 'broker'],
    startingComponents: ['openhw-esp32', 'openhw-led'],
    rewardComponents: [{ type: 'openhw-esp32', name: 'IoT Connected', icon: '📨', description: 'Your device can talk to any MQTT broker!' }],
    components: [
      { type: 'openhw-esp32', label: 'ESP32 DevKit', qty: 1 },
      { type: 'openhw-led', label: 'LED', qty: 1 },
      { type: 'openhw-resistor', label: '220Ω Resistor', qty: 1 },
    ],
    wiring: [{ from: 'ESP32 GPIO 2', to: 'LED via resistor to GND' }],
    starterCode: `#include <WiFi.h>
#include <PubSubClient.h>

const char* ssid       = "YOUR_WIFI_SSID";
const char* password   = "YOUR_WIFI_PASSWORD";
const char* mqttServer = "broker.hivemq.com";  // Free public broker
const int   mqttPort   = 1883;
const char* topic      = "openhw/led/control";

WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);
const int    LED_PIN = 2;

void callback(char* topic, byte* payload, unsigned int len) {
  String msg = String((char*)payload).substring(0, len);
  Serial.println("Received: " + msg);
  if (msg == "ON")  digitalWrite(LED_PIN, HIGH);
  if (msg == "OFF") digitalWrite(LED_PIN, LOW);
}

void reconnect() {
  while (!mqtt.connected()) {
    if (mqtt.connect("ESP32Client")) {
      mqtt.subscribe(topic);
      Serial.println("MQTT connected & subscribed to: " + String(topic));
    } else { delay(2000); }
  }
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  mqtt.setServer(mqttServer, mqttPort);
  mqtt.setCallback(callback);
}

void loop() {
  if (!mqtt.connected()) reconnect();
  mqtt.loop();
  // Publish sensor reading every 5 seconds
  static unsigned long last = 0;
  if (millis() - last > 5000) {
    mqtt.publish("openhw/led/status", digitalRead(LED_PIN) ? "ON" : "OFF");
    last = millis();
  }
}`,
    concepts: ['PubSubClient library', 'MQTT broker', 'publish()', 'subscribe()', 'callback functions'],
    kidFriendlyTip: '📨 MQTT is like a group chat. Your ESP32 "publishes" messages to a topic, and any device "subscribed" to that topic instantly receives them!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'ESP32 + LED', weight: 0.3, required: [{ type: 'esp32', count: 1 }] },
        wiringAccuracy: { description: 'LED wired', weight: 0.2, requiredConnections: [] },
        codeFunctionality: { description: 'MQTT connect + callback', weight: 0.5, requiredFunctions: ['setup', 'loop', 'mqtt', 'callback'] },
      },
    },
    badge: { id: 'badge_esp32_mqtt', name: 'IoT Messenger', description: 'Sent messages via MQTT!', icon: '📨', rarity: 'rare' },
  },

  {
    id: 'esp32-ble',
    slug: 'esp32-ble',
    number: 8,
    prerequisite: 'esp32-mqtt',
    title: 'Bluetooth LE Control',
    subtitle: 'Wireless control from your phone',
    description: 'Create a BLE UART service so you can control the ESP32 from your smartphone using nRF Connect or a BLE terminal app.',
    difficulty: 'advanced', difficultyLabel: 'Advanced', estimatedTime: '35 min', xpReward: 240,
    color: '#f97316', icon: '🔵', world: 3,
    tags: ['ESP32', 'BLE', 'Bluetooth', 'wireless', 'UART'],
    startingComponents: ['openhw-esp32', 'openhw-led'],
    rewardComponents: [{ type: 'openhw-esp32', name: 'BLE Enabled', icon: '🔵', description: 'Control your project from any smartphone!' }],
    components: [
      { type: 'openhw-esp32', label: 'ESP32 DevKit', qty: 1 },
      { type: 'openhw-led', label: 'LED', qty: 1 },
      { type: 'openhw-resistor', label: '220Ω Resistor', qty: 1 },
    ],
    wiring: [{ from: 'ESP32 GPIO 2', to: 'LED via 220Ω resistor to GND' }],
    starterCode: `#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define SERVICE_UUID        "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"

const int LED_PIN = 2;
bool deviceConnected = false;

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* s)    { deviceConnected = true;  Serial.println("Phone connected!"); }
  void onDisconnect(BLEServer* s) { deviceConnected = false; Serial.println("Phone disconnected."); }
};

class CharCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) {
    std::string val = c->getValue();
    if (val == "ON")  { digitalWrite(LED_PIN, HIGH); Serial.println("LED ON"); }
    if (val == "OFF") { digitalWrite(LED_PIN, LOW);  Serial.println("LED OFF"); }
  }
};

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  BLEDevice::init("OpenHW-ESP32");
  BLEServer* server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  BLEService* service = server->createService(SERVICE_UUID);
  BLECharacteristic* ch = service->createCharacteristic(CHARACTERISTIC_UUID, BLECharacteristic::PROPERTY_WRITE);
  ch->setCallbacks(new CharCallbacks());
  service->start();
  server->getAdvertising()->start();
  Serial.println("BLE advertising as: OpenHW-ESP32");
}

void loop() { delay(1000); }`,
    concepts: ['BLE GATT services', 'Characteristics', 'Callbacks', 'UUID', 'BLE advertising'],
    kidFriendlyTip: '🔵 Use the free "nRF Connect" app on your phone to find "OpenHW-ESP32", connect, and write "ON" or "OFF" to control the LED!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'ESP32 + LED', weight: 0.3, required: [{ type: 'esp32', count: 1 }] },
        wiringAccuracy: { description: 'LED wired', weight: 0.2, requiredConnections: [] },
        codeFunctionality: { description: 'BLE service created', weight: 0.5, requiredFunctions: ['setup', 'loop', 'BLEDevice'] },
      },
    },
    badge: { id: 'badge_esp32_ble', name: 'Bluetooth Hacker', description: 'Built a BLE device!', icon: '🔵', rarity: 'epic' },
  },

  {
    id: 'esp32-deep-sleep',
    slug: 'esp32-deep-sleep',
    number: 9,
    prerequisite: 'esp32-ble',
    title: 'Deep Sleep & Timer Wake',
    subtitle: 'Ultra-low power IoT',
    description: 'Put the ESP32 into deep sleep (10µA!) and wake it up with a timer. Essential for battery-powered IoT sensors.',
    difficulty: 'advanced', difficultyLabel: 'Advanced', estimatedTime: '30 min', xpReward: 260,
    color: '#f97316', icon: '😴', world: 3,
    tags: ['ESP32', 'deep sleep', 'ULP', 'battery', 'power saving'],
    startingComponents: ['openhw-esp32'],
    rewardComponents: [{ type: 'openhw-dht22', name: 'DHT22', icon: '🌡️', description: 'Build a battery-powered weather sensor that lasts months!' }],
    components: [{ type: 'openhw-esp32', label: 'ESP32 DevKit', qty: 1 }],
    wiring: [],
    starterCode: `#include <Arduino.h>

#define SLEEP_SECONDS 10  // Wake every 10 seconds

// RTC memory survives deep sleep!
RTC_DATA_ATTR int bootCount = 0;

void setup() {
  Serial.begin(115200);
  bootCount++;
  Serial.println("\\n=== Boot #" + String(bootCount) + " ===");

  // Print wake-up reason
  esp_sleep_wakeup_cause_t cause = esp_sleep_get_wakeup_cause();
  if (cause == ESP_SLEEP_WAKEUP_TIMER) {
    Serial.println("Woke up from timer!");
  } else {
    Serial.println("First boot or power-on reset.");
  }

  // Do your work here (read sensor, post to server, etc.)
  Serial.println("Doing work...");
  delay(500);

  // Set wake-up timer and go to sleep
  Serial.println("Going to sleep for " + String(SLEEP_SECONDS) + "s...");
  esp_sleep_enable_timer_wakeup(SLEEP_SECONDS * 1000000ULL);
  esp_deep_sleep_start();
}

void loop() {
  // Never reached — ESP32 resets after deep sleep
}`,
    concepts: ['esp_deep_sleep_start()', 'RTC_DATA_ATTR', 'esp_sleep_enable_timer_wakeup()', 'µA power consumption', 'Boot count'],
    kidFriendlyTip: '😴 In deep sleep, the ESP32 draws only ~10 µA. A 1000mAh battery can power it for YEARS if it sleeps most of the time!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'ESP32 present', weight: 0.2, required: [{ type: 'esp32', count: 1 }] },
        wiringAccuracy: { description: 'No wiring needed', weight: 0.1, requiredConnections: [] },
        codeFunctionality: { description: 'Deep sleep + timer wake', weight: 0.7, requiredFunctions: ['setup', 'esp_deep_sleep_start'] },
      },
    },
    badge: { id: 'badge_esp32_sleep', name: 'Power Saver', description: 'Used ESP32 deep sleep!', icon: '😴', rarity: 'epic' },
  },

  // ── World 4: Smart Systems ────────────────────────────────────────────────────

  {
    id: 'esp32-oled-wifi',
    slug: 'esp32-oled-wifi',
    number: 10,
    prerequisite: 'esp32-deep-sleep',
    title: 'WiFi Info on OLED',
    subtitle: 'Live data on a tiny display',
    description: 'Connect an OLED display and show live WiFi status, IP address, and a counter — a mini IoT dashboard.',
    difficulty: 'advanced', difficultyLabel: 'Advanced', estimatedTime: '40 min', xpReward: 280,
    color: '#a855f7', icon: '🖥️', world: 4,
    tags: ['ESP32', 'OLED', 'SSD1306', 'I2C', 'WiFi', 'dashboard'],
    startingComponents: ['openhw-esp32', 'openhw-oled'],
    rewardComponents: [{ type: 'openhw-esp32-cam', name: 'ESP32-CAM', icon: '📷', description: 'The ultimate ESP32 module with built-in camera!' }],
    components: [
      { type: 'openhw-esp32', label: 'ESP32 DevKit', qty: 1 },
      { type: 'openhw-oled', label: 'OLED 128x64 (SSD1306)', qty: 1 },
    ],
    wiring: [
      { from: 'OLED VCC', to: 'ESP32 3V3' },
      { from: 'OLED GND', to: 'ESP32 GND' },
      { from: 'OLED SDA', to: 'ESP32 GPIO 21' },
      { from: 'OLED SCL', to: 'ESP32 GPIO 22' },
    ],
    starterCode: `#include <WiFi.h>
#include <Wire.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_W 128
#define SCREEN_H  64
#define OLED_ADDR 0x3C

const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

Adafruit_SSD1306 display(SCREEN_W, SCREEN_H, &Wire, -1);
int counter = 0;

void setup() {
  Serial.begin(115200);
  display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
  display.clearDisplay();
  display.setTextSize(1); display.setTextColor(WHITE);
  display.setCursor(0, 0); display.println("Connecting WiFi...");
  display.display();

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }

  Serial.println("IP: " + WiFi.localIP().toString());
}

void loop() {
  display.clearDisplay();
  display.setTextSize(1); display.setTextColor(WHITE);

  display.setCursor(0, 0);  display.println("OpenHW Dashboard");
  display.drawLine(0, 10, 127, 10, WHITE);
  display.setCursor(0, 14); display.print("IP: "); display.println(WiFi.localIP());
  display.setCursor(0, 26); display.print("RSSI: "); display.print(WiFi.RSSI()); display.println(" dBm");
  display.setCursor(0, 38); display.print("Uptime: "); display.print(millis()/1000); display.println("s");
  display.setCursor(0, 50); display.print("Loop #"); display.println(++counter);

  display.display();
  delay(1000);
}`,
    concepts: ['Adafruit SSD1306', 'I2C on ESP32 (GPIO 21/22)', 'display.print()', 'WiFi.RSSI()', 'clearDisplay()'],
    kidFriendlyTip: '🖥️ ESP32 I2C pins are GPIO 21 (SDA) and GPIO 22 (SCL) by default — different from Arduino Uno which uses A4/A5!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'ESP32 + OLED', weight: 0.3, required: [{ type: 'esp32', count: 1 }] },
        wiringAccuracy: { description: 'I2C wired correctly', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'OLED shows WiFi data', weight: 0.4, requiredFunctions: ['setup', 'loop', 'display'] },
      },
    },
    badge: { id: 'badge_esp32_oled', name: 'Dashboard Builder', description: 'Built a live IoT dashboard!', icon: '🖥️', rarity: 'epic' },
  },

  {
    id: 'esp32-sensor-cloud',
    slug: 'esp32-sensor-cloud',
    number: 11,
    prerequisite: 'esp32-oled-wifi',
    title: 'Sensor Data to Cloud',
    subtitle: 'Post data to ThingSpeak',
    description: 'Read a DHT22 temperature/humidity sensor and send data to ThingSpeak every 20 seconds. See your data on a real-time graph.',
    difficulty: 'advanced', difficultyLabel: 'Advanced', estimatedTime: '45 min', xpReward: 300,
    color: '#a855f7', icon: '📊', world: 4,
    tags: ['ESP32', 'cloud', 'ThingSpeak', 'DHT22', 'IoT', 'data logging'],
    startingComponents: ['openhw-esp32', 'openhw-dht22'],
    rewardComponents: [{ type: 'openhw-esp32-cam', name: 'Final Badge', icon: '📊', description: 'You are now an IoT engineer!' }],
    components: [
      { type: 'openhw-esp32', label: 'ESP32 DevKit', qty: 1 },
      { type: 'openhw-dht22', label: 'DHT22 Sensor', qty: 1 },
      { type: 'openhw-resistor', label: '10kΩ Pull-up Resistor', qty: 1, attrs: { value: '10000' } },
    ],
    wiring: [
      { from: 'DHT22 VCC', to: 'ESP32 3V3' },
      { from: 'DHT22 GND', to: 'ESP32 GND' },
      { from: 'DHT22 DATA', to: 'ESP32 GPIO 4 + 10kΩ to 3V3' },
    ],
    starterCode: `#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

const char* ssid       = "YOUR_WIFI_SSID";
const char* password   = "YOUR_WIFI_PASSWORD";
const char* apiKey     = "YOUR_THINGSPEAK_API_KEY";
const char* server     = "http://api.thingspeak.com/update";

#define DHTPIN  4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  dht.begin();
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\\nConnected: " + WiFi.localIP().toString());
}

void loop() {
  float temp = dht.readTemperature();
  float humi = dht.readHumidity();

  if (!isnan(temp) && !isnan(humi)) {
    Serial.printf("Temp: %.1f°C  Humidity: %.1f%%\\n", temp, humi);

    HTTPClient http;
    String url = String(server) + "?api_key=" + apiKey +
                 "&field1=" + String(temp) +
                 "&field2=" + String(humi);
    http.begin(url);
    int code = http.GET();
    Serial.println("ThingSpeak response: " + String(code));
    http.end();
  } else {
    Serial.println("DHT read failed!");
  }
  delay(20000);  // ThingSpeak requires 15s minimum between updates
}`,
    concepts: ['DHT22 library', 'ThingSpeak API', 'HTTP GET with params', 'isnan()', 'Sensor data logging'],
    kidFriendlyTip: '📊 Create a free ThingSpeak account at thingspeak.com, make a channel with 2 fields (temperature + humidity), and grab your Write API Key!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'ESP32 + DHT22', weight: 0.3, required: [{ type: 'esp32', count: 1 }] },
        wiringAccuracy: { description: 'DHT22 wired', weight: 0.2, requiredConnections: [] },
        codeFunctionality: { description: 'Reads sensor + HTTP POST', weight: 0.5, requiredFunctions: ['setup', 'loop', 'dht', 'http'] },
      },
    },
    badge: { id: 'badge_esp32_cloud', name: 'Cloud Engineer', description: 'Sent sensor data to the cloud!', icon: '📊', rarity: 'legendary' },
  },

  {
    id: 'esp32-cam-stream',
    slug: 'esp32-cam-stream',
    number: 12,
    prerequisite: 'esp32-sensor-cloud',
    title: 'ESP32-CAM Video Stream',
    subtitle: 'Build a live camera',
    description: 'Use the ESP32-CAM to host a live MJPEG video stream accessible from any browser on your network. Build a real security camera!',
    difficulty: 'advanced', difficultyLabel: 'Advanced', estimatedTime: '45 min', xpReward: 360,
    color: '#a855f7', icon: '📷', world: 4,
    tags: ['ESP32-CAM', 'camera', 'MJPEG', 'streaming', 'WiFi'],
    startingComponents: ['openhw-esp32-cam'],
    rewardComponents: [{ type: 'openhw-esp32-cam', name: 'Camera Master', icon: '📷', description: 'You completed the full ESP32 journey!' }],
    components: [{ type: 'openhw-esp32-cam', label: 'ESP32-CAM', qty: 1 }],
    wiring: [
      { from: 'GPIO 0', to: 'GND (for programming mode)' },
      { from: 'FTDI TX', to: 'ESP32-CAM RX (GPIO 3)' },
      { from: 'FTDI RX', to: 'ESP32-CAM TX (GPIO 1)' },
      { from: 'FTDI 5V', to: 'ESP32-CAM 5V' },
    ],
    starterCode: `#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"

// AI-Thinker ESP32-CAM pin mapping
#define PWDN_GPIO_NUM   32
#define RESET_GPIO_NUM  -1
#define XCLK_GPIO_NUM    0
#define SIOD_GPIO_NUM   26
#define SIOC_GPIO_NUM   27
#define Y9_GPIO_NUM     35
#define Y8_GPIO_NUM     34
#define Y7_GPIO_NUM     39
#define Y6_GPIO_NUM     36
#define Y5_GPIO_NUM     21
#define Y4_GPIO_NUM     19
#define Y3_GPIO_NUM     18
#define Y2_GPIO_NUM      5
#define VSYNC_GPIO_NUM  25
#define HREF_GPIO_NUM   23
#define PCLK_GPIO_NUM   22

const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

void startCameraServer();  // Defined in camera_httpd.cpp (ESP example)

void setup() {
  Serial.begin(115200);
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM; config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM; config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM; config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM; config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk  = XCLK_GPIO_NUM; config.pin_pclk  = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM; config.pin_href  = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM; config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn  = PWDN_GPIO_NUM;  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size   = FRAMESIZE_VGA;
  config.jpeg_quality = 12;
  config.fb_count     = 1;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) { Serial.printf("Camera init failed: 0x%x\\n", err); return; }

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\\nCamera stream at: http://" + WiFi.localIP().toString() + ":81/stream");
  startCameraServer();
}

void loop() { delay(10000); }`,
    concepts: ['esp_camera.h', 'MJPEG streaming', 'camera_config_t', 'HTTP server', 'ESP32-CAM pinout'],
    kidFriendlyTip: '📷 After uploading, disconnect GPIO 0 from GND, press reset, and open the IP:81/stream URL in your browser to see the live feed!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'ESP32-CAM present', weight: 0.3, required: [{ type: 'esp32', count: 1 }] },
        wiringAccuracy: { description: 'Correct connections', weight: 0.2, requiredConnections: [] },
        codeFunctionality: { description: 'Camera stream code', weight: 0.5, requiredFunctions: ['setup', 'esp_camera_init'] },
      },
    },
    badge: { id: 'badge_esp32_cam', name: 'Camera Engineer', description: 'Built a live video stream!', icon: '📷', rarity: 'legendary' },
  },

];

// Difficulty styling
export const DIFFICULTY_CONFIG = {
  beginner:     { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  label: 'Beginner' },
  intermediate: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Intermediate' },
  advanced:     { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  label: 'Advanced' },
};

// ── Helper: get project status based on completed projects ────────────────────
export function getProjectStatus(projectSlug, completedProjects = []) {
  if (completedProjects.includes(projectSlug)) return 'completed';
  const project = PROJECTS.find(p => p.slug === projectSlug);
  if (!project) return 'available';
  // Any project is always directly startable — no prerequisite blocking
  // Prerequisites are shown as suggestions only (💡 hints in the UI)
  return 'available';
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
