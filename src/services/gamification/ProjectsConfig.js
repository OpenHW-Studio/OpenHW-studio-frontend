export const PROJECTS = [
  {
    id: 'led-blink',
    slug: 'led-blink',
    number: 1,
    title: 'LED Blink',
    subtitle: 'The "Hello, World" of hardware',
    description:
      'Make an LED blink on and off using the Arduino built-in pin 13. ' +
      'Learn about digital output, pinMode, digitalWrite, and delay timing.',
    difficulty: 'beginner',
    difficultyLabel: 'Beginner',
    estimatedTime: '15 min',
    xpReward: 100,
    levelRequired: 1,
    levelUnlocked: 1,
    color: '#22c55e',
    icon: '💡',
    tags: ['digital output', 'LED', 'timing'],
    requiredComponents: ['led', 'resistor'],
    components: [
      { type: 'wokwi-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'wokwi-led',         label: 'LED (any color)', qty: 1 },
      { type: 'wokwi-resistor',    label: '220Ω Resistor', qty: 1, attrs: { value: '220' } },
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
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}`,
    concepts: ['pinMode()', 'digitalWrite()', 'delay()', 'Digital output', 'LED polarity'],
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: {
          description: 'Correct components placed',
          weight: 0.3,
          required: [
            { type: 'arduino', count: 1 },
            { type: 'led',     count: 1 },
            { type: 'resistor',count: 1 },
          ],
        },
        wiringAccuracy: {
          description: 'Correct wiring',
          weight: 0.3,
          requiredConnections: [
            { from: { component: 'arduino', pin: '13' },  to: { component: 'led', terminal: 'A' } },
            { from: { component: 'led',     terminal: 'K' }, to: { component: 'resistor', terminal: '1' } },
            { from: { component: 'resistor', terminal: '2' }, to: { component: 'arduino', pin: 'GND.1' } },
          ],
        },
        codeFunctionality: {
          description: 'Code blinks LED correctly',
          weight: 0.4,
          requiredFunctions: ['setup', 'loop'],
          expectedBehavior: {
            pinNumber: 13,
            pinMode: 'OUTPUT',
            pattern: 'alternating high/low',
            blinkDelay: 1000,
          },
        },
      },
    },
    badge: {
      id: 'badge_led_blink',
      name: 'First Light',
      description: 'Made your first LED blink',
      icon: '💡',
      rarity: 'common',
    },
  },

  {
    id: 'rgb-led',
    slug: 'rgb-led',
    number: 2,
    title: 'RGB LED',
    subtitle: 'Mixing colors with PWM',
    description:
      'Control a common-cathode RGB LED to display any color. ' +
      'Learn about PWM (analogWrite), color mixing, and multi-pin output.',
    difficulty: 'beginner',
    difficultyLabel: 'Beginner',
    estimatedTime: '20 min',
    xpReward: 150,
    levelRequired: 1,
    levelUnlocked: 1,
    color: '#8b5cf6',
    icon: '🌈',
    tags: ['PWM', 'RGB', 'color mixing', 'analogWrite'],
    requiredComponents: ['rgb-led', 'resistor'],
    components: [
      { type: 'wokwi-arduino-uno', label: 'Arduino Uno',    qty: 1 },
      { type: 'wokwi-rgb-led',     label: 'RGB LED',        qty: 1 },
      { type: 'wokwi-resistor',    label: '220Ω Resistor',  qty: 3, attrs: { value: '220' } },
    ],
    wiring: [
      { from: 'Arduino pin 9',  to: 'RGB LED Red pin' },
      { from: 'Arduino pin 10', to: 'RGB LED Green pin' },
      { from: 'Arduino pin 11', to: 'RGB LED Blue pin' },
      { from: 'Each pin',       to: '220Ω resistor in series' },
      { from: 'RGB LED GND',    to: 'Arduino GND' },
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
  setColor(255, 0,   0);
  delay(1000);
  setColor(0,   255, 0);
  delay(1000);
  setColor(0,   0,   255);
  delay(1000);
  setColor(255, 255, 0);
  delay(1000);
}`,
    concepts: ['analogWrite()', 'PWM', 'RGB color model', 'Multi-pin control', 'Color functions'],
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: {
          description: 'Correct components placed',
          weight: 0.3,
          required: [
            { type: 'arduino',  count: 1 },
            { type: 'rgb-led',  count: 1 },
            { type: 'resistor', count: 3 },
          ],
        },
        wiringAccuracy: {
          description: 'RGB pins wired to PWM pins',
          weight: 0.3,
          requiredConnections: [
            { from: { component: 'arduino', pin: '9'  }, to: { component: 'rgb-led', terminal: 'R' } },
            { from: { component: 'arduino', pin: '10' }, to: { component: 'rgb-led', terminal: 'G' } },
            { from: { component: 'arduino', pin: '11' }, to: { component: 'rgb-led', terminal: 'B' } },
          ],
        },
        codeFunctionality: {
          description: 'Code cycles through colors with PWM',
          weight: 0.4,
          requiredFunctions: ['setup', 'loop', 'setColor'],
          expectedBehavior: {
            rgbPins: [9, 10, 11],
            pinMode: 'OUTPUT',
          },
        },
      },
    },
    badge: {
      id: 'badge_rgb_led',
      name: 'Color Mixer',
      description: 'Controlled RGB color with PWM',
      icon: '🌈',
      rarity: 'common',
    },
  },

  {
    id: 'buzzer',
    slug: 'buzzer',
    number: 3,
    title: 'Buzzer',
    subtitle: 'Sound with tone()',
    description:
      'Generate musical tones with a passive buzzer using the Arduino tone() function. ' +
      'Play a scale and understand frequency, duration, and sound output.',
    difficulty: 'beginner',
    difficultyLabel: 'Beginner',
    estimatedTime: '20 min',
    xpReward: 150,
    levelRequired: 1,
    levelUnlocked: 1,
    color: '#f59e0b',
    icon: '🔔',
    tags: ['tone()', 'buzzer', 'sound', 'frequency'],
    requiredComponents: ['buzzer'],
    components: [
      { type: 'wokwi-arduino-uno', label: 'Arduino Uno',       qty: 1 },
      { type: 'wokwi-buzzer',      label: 'Passive Buzzer',    qty: 1 },
    ],
    wiring: [
      { from: 'Arduino pin 8', to: 'Buzzer positive (+)' },
      { from: 'Arduino GND',   to: 'Buzzer negative (−)' },
    ],
    starterCode: `#define BUZZER_PIN 8

#define NOTE_C4  262
#define NOTE_D4  294
#define NOTE_E4  330
#define NOTE_F4  349
#define NOTE_G4  392
#define NOTE_A4  440

void setup() {
  pinMode(BUZZER_PIN, OUTPUT);
}

void loop() {
  tone(BUZZER_PIN, NOTE_C4, 400); delay(500);
  tone(BUZZER_PIN, NOTE_D4, 400); delay(500);
  tone(BUZZER_PIN, NOTE_E4, 400); delay(500);
  tone(BUZZER_PIN, NOTE_F4, 400); delay(500);
  tone(BUZZER_PIN, NOTE_G4, 400); delay(500);
  tone(BUZZER_PIN, NOTE_A4, 400); delay(500);
  noTone(BUZZER_PIN);
  delay(1000);
}`,
    concepts: ['tone()', 'noTone()', '#define', 'Frequency & Hz', 'Sound output'],
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: {
          description: 'Buzzer placed',
          weight: 0.3,
          required: [
            { type: 'arduino', count: 1 },
            { type: 'buzzer',  count: 1 },
          ],
        },
        wiringAccuracy: {
          description: 'Buzzer wired to digital pin',
          weight: 0.3,
          requiredConnections: [
            { from: { component: 'arduino', pin: '8' }, to: { component: 'buzzer', terminal: '1' } },
          ],
        },
        codeFunctionality: {
          description: 'Code plays tones',
          weight: 0.4,
          requiredFunctions: ['setup', 'loop', 'tone'],
          expectedBehavior: {
            pinNumber: 8,
            pinMode: 'OUTPUT',
          },
        },
      },
    },
    badge: {
      id: 'badge_buzzer',
      name: 'Sound Maker',
      description: 'Played your first musical tones',
      icon: '🔔',
      rarity: 'common',
    },
  },

  {
    id: 'led-strip',
    slug: 'led-strip',
    number: 4,
    title: 'LED Strip',
    subtitle: 'Addressable NeoPixels',
    description:
      'Control a NeoPixel LED strip using the Adafruit NeoPixel library. ' +
      'Learn about addressable LEDs, the FastLED protocol, and creating color animations.',
    difficulty: 'intermediate',
    difficultyLabel: 'Intermediate',
    estimatedTime: '30 min',
    xpReward: 200,
    levelRequired: 2,
    levelUnlocked: 2,
    color: '#ec4899',
    icon: '✨',
    tags: ['NeoPixel', 'addressable LED', 'animation', 'library'],
    requiredComponents: [],
    components: [
      { type: 'wokwi-arduino-uno',      label: 'Arduino Uno',   qty: 1 },
      { type: 'wokwi-neopixel-matrix',  label: 'NeoPixel Strip (8)', qty: 1, attrs: { rows: 1, cols: 8 } },
    ],
    wiring: [
      { from: 'Arduino pin 6',  to: 'NeoPixel DIN (data)' },
      { from: 'Arduino 5V',     to: 'NeoPixel VCC' },
      { from: 'Arduino GND',    to: 'NeoPixel GND' },
    ],
    starterCode: `#include <Adafruit_NeoPixel.h>

#define PIN        6
#define NUM_LEDS   8

Adafruit_NeoPixel strip(NUM_LEDS, PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  strip.begin();
  strip.show();
}

void loop() {
  for (int i = 0; i < NUM_LEDS; i++) {
    strip.setPixelColor(i, strip.Color(255, 0, 0));
    strip.show();
    delay(100);
  }
  for (int i = 0; i < NUM_LEDS; i++) {
    strip.setPixelColor(i, 0);
    strip.show();
    delay(100);
  }
}`,
    concepts: ['Adafruit_NeoPixel library', 'setPixelColor()', 'Addressable LEDs', 'strip.show()', 'Color encoding'],
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: {
          description: 'NeoPixel strip placed',
          weight: 0.35,
          required: [
            { type: 'arduino',          count: 1 },
            { type: 'neopixel-matrix',  count: 1 },
          ],
        },
        wiringAccuracy: {
          description: 'Data pin connected',
          weight: 0.25,
          requiredConnections: [
            { from: { component: 'arduino', pin: '6' }, to: { component: 'neopixel-matrix', terminal: 'DIN' } },
          ],
        },
        codeFunctionality: {
          description: 'NeoPixel library used correctly',
          weight: 0.4,
          requiredFunctions: ['setup', 'loop', 'strip.begin', 'strip.setPixelColor', 'strip.show'],
          expectedBehavior: { pinNumber: 6, pinMode: 'OUTPUT' },
        },
      },
    },
    badge: {
      id: 'badge_led_strip',
      name: 'Light Sculptor',
      description: 'Animated a NeoPixel LED strip',
      icon: '✨',
      rarity: 'uncommon',
    },
  },

  {
    id: 'dc-motor',
    slug: 'dc-motor',
    number: 5,
    title: 'DC Motor',
    subtitle: 'Spin & speed control',
    description:
      'Control a DC motor speed and direction with an L293D H-bridge motor driver. ' +
      'Learn about H-bridges, PWM speed control, and motor direction logic.',
    difficulty: 'intermediate',
    difficultyLabel: 'Intermediate',
    estimatedTime: '35 min',
    xpReward: 250,
    levelRequired: 3,
    levelUnlocked: 3,
    color: '#f97316',
    icon: '⚙️',
    tags: ['DC motor', 'H-bridge', 'L293D', 'PWM', 'motor control'],
    requiredComponents: [],
    components: [
      { type: 'wokwi-arduino-uno',  label: 'Arduino Uno',        qty: 1 },
      { type: 'wokwi-motor',        label: 'DC Motor',           qty: 1 },
      { type: 'wokwi-motor-driver', label: 'L293D Motor Driver', qty: 1 },
    ],
    wiring: [
      { from: 'Arduino pin 9 (PWM)', to: 'L293D ENA (enable)' },
      { from: 'Arduino pin 7',       to: 'L293D IN1' },
      { from: 'Arduino pin 8',       to: 'L293D IN2' },
      { from: 'L293D OUT1 & OUT2',   to: 'DC Motor terminals' },
      { from: 'Arduino 5V',          to: 'L293D VCC1' },
      { from: 'Arduino GND',         to: 'L293D GND' },
    ],
    starterCode: `#define ENA  9
#define IN1  7
#define IN2  8

void setup() {
  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
}

void motorForward(int speed) {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  analogWrite(ENA, speed);
}

void motorStop() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  analogWrite(ENA, 0);
}

void loop() {
  motorForward(200);
  delay(2000);
  motorStop();
  delay(1000);
}`,
    concepts: ['H-bridge', 'L293D driver', 'Motor direction logic', 'PWM speed control', 'analogWrite()'],
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: {
          description: 'Motor + driver placed',
          weight: 0.35,
          required: [
            { type: 'arduino',      count: 1 },
            { type: 'motor',        count: 1 },
            { type: 'motor-driver', count: 1 },
          ],
        },
        wiringAccuracy: {
          description: 'Driver wired to Arduino and motor',
          weight: 0.3,
          requiredConnections: [
            { from: { component: 'arduino', pin: '9' }, to: { component: 'motor-driver', terminal: 'ENA' } },
          ],
        },
        codeFunctionality: {
          description: 'PWM and direction pins used',
          weight: 0.35,
          requiredFunctions: ['setup', 'loop', 'motorForward'],
          expectedBehavior: { pinArray: [7, 8, 9], pinMode: 'OUTPUT' },
        },
      },
    },
    badge: {
      id: 'badge_dc_motor',
      name: 'Motor Head',
      description: 'Drove a DC motor with full speed control',
      icon: '⚙️',
      rarity: 'uncommon',
    },
  },

  {
    id: 'servo-motor',
    slug: 'servo-motor',
    number: 6,
    title: 'Servo Motor',
    subtitle: 'Precise angle control',
    description:
      'Control a servo motor to specific angles using the Servo library. ' +
      'Understand PWM signal timing, the 0–180° range, and mechanical actuation.',
    difficulty: 'intermediate',
    difficultyLabel: 'Intermediate',
    estimatedTime: '25 min',
    xpReward: 200,
    levelRequired: 2,
    levelUnlocked: 2,
    color: '#06b6d4',
    icon: '🔩',
    tags: ['servo', 'Servo.h', 'PWM', 'angle', 'actuation'],
    requiredComponents: ['servo'],
    components: [
      { type: 'wokwi-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'wokwi-servo',       label: 'Servo Motor', qty: 1 },
    ],
    wiring: [
      { from: 'Arduino pin 9 (PWM)', to: 'Servo signal (yellow)' },
      { from: 'Arduino 5V',          to: 'Servo VCC (red)' },
      { from: 'Arduino GND',         to: 'Servo GND (brown/black)' },
    ],
    starterCode: `#include <Servo.h>

Servo myServo;
#define SERVO_PIN 9

void setup() {
  myServo.attach(SERVO_PIN);
}

void loop() {
  for (int angle = 0; angle <= 180; angle += 5) {
    myServo.write(angle);
    delay(50);
  }
  for (int angle = 180; angle >= 0; angle -= 5) {
    myServo.write(angle);
    delay(50);
  }
}`,
    concepts: ['Servo.h library', 'myServo.write()', 'myServo.attach()', 'PWM timing', 'Sweep motion'],
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: {
          description: 'Servo placed',
          weight: 0.3,
          required: [
            { type: 'arduino', count: 1 },
            { type: 'servo',   count: 1 },
          ],
        },
        wiringAccuracy: {
          description: 'Servo signal on PWM pin',
          weight: 0.3,
          requiredConnections: [
            { from: { component: 'arduino', pin: '9' }, to: { component: 'servo', terminal: 'signal' } },
          ],
        },
        codeFunctionality: {
          description: 'Servo sweeps using Servo.h',
          weight: 0.4,
          requiredFunctions: ['setup', 'loop', 'myServo.attach', 'myServo.write'],
          expectedBehavior: { pinNumber: 9, delayRange: [30, 100] },
        },
      },
    },
    badge: {
      id: 'badge_servo_motor',
      name: 'Angle Ace',
      description: 'Swept a servo motor through full range',
      icon: '🔩',
      rarity: 'uncommon',
    },
  },

  {
    id: 'potentiometer',
    slug: 'potentiometer',
    number: 7,
    title: 'Potentiometer',
    subtitle: 'Reading analog input',
    description:
      'Read a potentiometer value using analogRead() and map it to control LED brightness. ' +
      'Understand ADC, 10-bit resolution, and the map() function.',
    difficulty: 'beginner',
    difficultyLabel: 'Beginner',
    estimatedTime: '20 min',
    xpReward: 150,
    levelRequired: 1,
    levelUnlocked: 1,
    color: '#a855f7',
    icon: '🎛️',
    tags: ['analogRead()', 'potentiometer', 'ADC', 'map()', 'analog input'],
    requiredComponents: ['potentiometer'],
    components: [
      { type: 'wokwi-arduino-uno',  label: 'Arduino Uno',    qty: 1 },
      { type: 'wokwi-potentiometer',label: 'Potentiometer',  qty: 1 },
      { type: 'wokwi-led',          label: 'LED',            qty: 1 },
      { type: 'wokwi-resistor',     label: '220Ω Resistor',  qty: 1, attrs: { value: '220' } },
    ],
    wiring: [
      { from: 'Potentiometer VCC',   to: 'Arduino 5V' },
      { from: 'Potentiometer GND',   to: 'Arduino GND' },
      { from: 'Potentiometer wiper', to: 'Arduino A0' },
      { from: 'Arduino pin 9 (PWM)', to: 'LED anode via 220Ω' },
      { from: 'LED cathode',         to: 'Arduino GND' },
    ],
    starterCode: `#define POT_PIN  A0
#define LED_PIN  9

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int potValue = analogRead(POT_PIN);
  int brightness = map(potValue, 0, 1023, 0, 255);
  analogWrite(LED_PIN, brightness);

  Serial.print("Pot: ");
  Serial.print(potValue);
  Serial.print(" → Brightness: ");
  Serial.println(brightness);
  delay(50);
}`,
    concepts: ['analogRead()', 'map()', 'ADC 10-bit', 'Serial.print()', 'Voltage divider'],
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: {
          description: 'Potentiometer and LED placed',
          weight: 0.3,
          required: [
            { type: 'arduino',       count: 1 },
            { type: 'potentiometer', count: 1 },
            { type: 'led',           count: 1 },
          ],
        },
        wiringAccuracy: {
          description: 'Pot wiper to A0, LED to PWM pin',
          weight: 0.3,
          requiredConnections: [
            { from: { component: 'potentiometer', terminal: 'SIG' }, to: { component: 'arduino', pin: 'A0' } },
            { from: { component: 'arduino', pin: '9' }, to: { component: 'led', terminal: 'A' } },
          ],
        },
        codeFunctionality: {
          description: 'analogRead mapped to analogWrite',
          weight: 0.4,
          requiredFunctions: ['setup', 'loop', 'analogRead', 'map', 'analogWrite'],
          expectedBehavior: { pinNumber: 'A0', delayRange: [20, 200] },
        },
      },
    },
    badge: {
      id: 'badge_potentiometer',
      name: 'Dial Master',
      description: 'Read analog input and controlled brightness',
      icon: '🎛️',
      rarity: 'common',
    },
  },

  {
    id: 'ldr',
    slug: 'ldr',
    number: 8,
    title: 'LDR (Light Sensor)',
    subtitle: 'Automatic light control',
    description:
      'Use a Light Dependent Resistor (LDR) to automatically turn an LED on in the dark. ' +
      'Learn about voltage dividers, analog thresholding, and conditional logic.',
    difficulty: 'beginner',
    difficultyLabel: 'Beginner',
    estimatedTime: '25 min',
    xpReward: 150,
    levelRequired: 1,
    levelUnlocked: 1,
    color: '#eab308',
    icon: '☀️',
    tags: ['LDR', 'photoresistor', 'analogRead()', 'threshold', 'auto lighting'],
    requiredComponents: [],
    components: [
      { type: 'wokwi-arduino-uno',          label: 'Arduino Uno',    qty: 1 },
      { type: 'wokwi-photoresistor-sensor',  label: 'LDR Sensor',     qty: 1 },
      { type: 'wokwi-led',                  label: 'LED',            qty: 1 },
      { type: 'wokwi-resistor',             label: '220Ω Resistor',  qty: 1, attrs: { value: '220' } },
      { type: 'wokwi-resistor',             label: '10kΩ Pull-down', qty: 1, attrs: { value: '10000' } },
    ],
    wiring: [
      { from: 'Arduino 5V',    to: 'LDR one leg' },
      { from: 'LDR other leg', to: 'Arduino A0 + 10kΩ to GND (voltage divider)' },
      { from: 'Arduino pin 13',to: 'LED anode via 220Ω' },
      { from: 'LED cathode',   to: 'Arduino GND' },
    ],
    starterCode: `#define LDR_PIN  A0
#define LED_PIN  13
#define THRESHOLD 500

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int ldrValue = analogRead(LDR_PIN);
  Serial.print("Light level: ");
  Serial.println(ldrValue);

  if (ldrValue < THRESHOLD) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  delay(200);
}`,
    concepts: ['LDR/photoresistor', 'Voltage divider', 'Threshold logic', 'if/else', 'analogRead()'],
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: {
          description: 'LDR and LED placed',
          weight: 0.3,
          required: [
            { type: 'arduino',             count: 1 },
            { type: 'photoresistor-sensor',count: 1 },
            { type: 'led',                 count: 1 },
          ],
        },
        wiringAccuracy: {
          description: 'LDR to A0, LED to pin 13',
          weight: 0.3,
          requiredConnections: [
            { from: { component: 'photoresistor-sensor', terminal: 'AO' }, to: { component: 'arduino', pin: 'A0' } },
            { from: { component: 'arduino', pin: '13' }, to: { component: 'led', terminal: 'A' } },
          ],
        },
        codeFunctionality: {
          description: 'Threshold logic controls LED',
          weight: 0.4,
          requiredFunctions: ['setup', 'loop', 'analogRead'],
          expectedBehavior: { pinNumber: 13, pinMode: 'OUTPUT' },
        },
      },
    },
    badge: {
      id: 'badge_ldr',
      name: 'Light Chaser',
      description: 'Built an automatic light-sensing circuit',
      icon: '☀️',
      rarity: 'common',
    },
  },

  {
    id: 'temperature-sensor',
    slug: 'temperature-sensor',
    number: 9,
    title: 'Temperature Sensor',
    subtitle: 'Reading real-world data',
    description:
      'Read temperature from an NTC thermistor or DHT11 sensor and display it on the Serial Monitor. ' +
      'Learn about sensor calibration, the Steinhart-Hart equation, and data formatting.',
    difficulty: 'intermediate',
    difficultyLabel: 'Intermediate',
    estimatedTime: '30 min',
    xpReward: 200,
    levelRequired: 2,
    levelUnlocked: 2,
    color: '#ef4444',
    icon: '🌡️',
    tags: ['NTC', 'DHT11', 'temperature', 'Serial Monitor', 'sensor'],
    requiredComponents: ['dht11'],
    components: [
      { type: 'wokwi-arduino-uno',              label: 'Arduino Uno',        qty: 1 },
      { type: 'wokwi-ntc-temperature-sensor',   label: 'NTC Temp Sensor',    qty: 1 },
      { type: 'wokwi-resistor',                 label: '10kΩ Resistor',      qty: 1, attrs: { value: '10000' } },
    ],
    wiring: [
      { from: 'Arduino 5V',      to: 'NTC sensor one leg' },
      { from: 'NTC sensor leg 2',to: 'Arduino A0 + 10kΩ to GND' },
    ],
    starterCode: `#define SENSOR_PIN A0
#define SERIES_RESISTOR 10000
#define NOMINAL_RESISTANCE 10000
#define NOMINAL_TEMPERATURE 25
#define B_COEFFICIENT 3950

void setup() {
  Serial.begin(9600);
}

void loop() {
  int rawADC = analogRead(SENSOR_PIN);
  float resistance = SERIES_RESISTOR / (1023.0 / rawADC - 1.0);

  float steinhart = resistance / NOMINAL_RESISTANCE;
  steinhart = log(steinhart);
  steinhart /= B_COEFFICIENT;
  steinhart += 1.0 / (NOMINAL_TEMPERATURE + 273.15);
  steinhart = 1.0 / steinhart;
  float celsius = steinhart - 273.15;

  Serial.print("Temperature: ");
  Serial.print(celsius);
  Serial.println(" °C");
  delay(1000);
}`,
    concepts: ['NTC thermistor', 'Steinhart-Hart equation', 'log()', 'float arithmetic', 'Serial.println()'],
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: {
          description: 'Temperature sensor placed',
          weight: 0.35,
          required: [
            { type: 'arduino',                count: 1 },
            { type: 'ntc-temperature-sensor', count: 1 },
          ],
        },
        wiringAccuracy: {
          description: 'Sensor to analog pin',
          weight: 0.25,
          requiredConnections: [
            { from: { component: 'ntc-temperature-sensor', terminal: 'AO' }, to: { component: 'arduino', pin: 'A0' } },
          ],
        },
        codeFunctionality: {
          description: 'Temperature calculated and printed to serial',
          weight: 0.4,
          requiredFunctions: ['setup', 'loop', 'analogRead', 'Serial.begin', 'Serial.print'],
          expectedBehavior: { pinNumber: 'A0', delayMs: 1000 },
        },
      },
    },
    badge: {
      id: 'badge_temperature',
      name: 'Temp Tamer',
      description: 'Read and calibrated a temperature sensor',
      icon: '🌡️',
      rarity: 'uncommon',
    },
  },

  {
    id: 'button-debounce',
    slug: 'button-debounce',
    number: 10,
    title: 'Button & Debounce',
    subtitle: 'Clean digital input',
    description:
      'Handle button presses reliably with software debouncing. Toggle an LED on each press ' +
      'without false triggers. Learn about pull-up resistors, edge detection, and millis().',
    difficulty: 'intermediate',
    difficultyLabel: 'Intermediate',
    estimatedTime: '30 min',
    xpReward: 250,
    levelRequired: 2,
    levelUnlocked: 2,
    color: '#14b8a6',
    icon: '🔘',
    tags: ['button', 'debounce', 'millis()', 'edge detection', 'INPUT_PULLUP'],
    requiredComponents: ['button', 'resistor'],
    components: [
      { type: 'wokwi-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'wokwi-pushbutton',  label: 'Push Button', qty: 1 },
      { type: 'wokwi-led',         label: 'LED',         qty: 1 },
      { type: 'wokwi-resistor',    label: '220Ω Resistor', qty: 1, attrs: { value: '220' } },
    ],
    wiring: [
      { from: 'Arduino pin 2',   to: 'Button one side' },
      { from: 'Button other side',to: 'Arduino GND (uses INPUT_PULLUP)' },
      { from: 'Arduino pin 13',  to: 'LED anode via 220Ω' },
      { from: 'LED cathode',     to: 'Arduino GND' },
    ],
    starterCode: `#define BUTTON_PIN  2
#define LED_PIN     13
#define DEBOUNCE_MS 50

bool ledState       = false;
bool lastButtonState = HIGH;
unsigned long lastDebounceTime = 0;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  bool reading = digitalRead(BUTTON_PIN);

  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > DEBOUNCE_MS) {
    if (reading == LOW && lastButtonState == HIGH) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      Serial.println(ledState ? "LED ON" : "LED OFF");
    }
  }
  lastButtonState = reading;
}`,
    concepts: ['INPUT_PULLUP', 'millis()', 'Debouncing', 'Edge detection', 'State toggle'],
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: {
          description: 'Button and LED placed',
          weight: 0.3,
          required: [
            { type: 'arduino',    count: 1 },
            { type: 'pushbutton', count: 1 },
            { type: 'led',        count: 1 },
          ],
        },
        wiringAccuracy: {
          description: 'Button to pin 2, LED to pin 13',
          weight: 0.3,
          requiredConnections: [
            { from: { component: 'arduino', pin: '2' },  to: { component: 'pushbutton', terminal: '1a' } },
            { from: { component: 'arduino', pin: '13' }, to: { component: 'led', terminal: 'A' } },
          ],
        },
        codeFunctionality: {
          description: 'Debounce with millis() implemented',
          weight: 0.4,
          requiredFunctions: ['setup', 'loop', 'digitalRead', 'millis'],
          expectedBehavior: { pinArray: [2, 13], pinMode: 'OUTPUT' },
        },
      },
    },
    badge: {
      id: 'badge_button_debounce',
      name: 'Clean Clicker',
      description: 'Implemented proper software debouncing',
      icon: '🔘',
      rarity: 'uncommon',
    },
  },
];

export function getProject(id) {
  return PROJECTS.find(p => p.id === id || p.slug === id) || null;
}

export function getUnlockedProjects(currentLevel) {
  return PROJECTS.filter(p => p.levelRequired <= currentLevel);
}

export function getLockedProjects(currentLevel) {
  return PROJECTS.filter(p => p.levelRequired > currentLevel);
}

const DIFF_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

export function sortByDifficulty(projects) {
  return [...projects].sort((a, b) => DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty]);
}

export const DIFFICULTY_CONFIG = {
  beginner:     { color: '#22c55e', bg: '#22c55e18', border: '#22c55e44', label: 'Beginner' },
  intermediate: { color: '#f59e0b', bg: '#f59e0b18', border: '#f59e0b44', label: 'Intermediate' },
  advanced:     { color: '#ef4444', bg: '#ef444418', border: '#ef444444', label: 'Advanced' },
};