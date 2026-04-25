
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
    startingComponents: ['wokwi-arduino-uno', 'wokwi-led', 'wokwi-resistor'],
    // What you EARN when you finish this project
    rewardComponents: [
      { type: 'wokwi-rgb-led', name: 'RGB LED', icon: '🌈', description: 'A special LED that can glow red, green, blue, or any mix of colors!' },
    ],
    components: [
      { type: 'wokwi-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'wokwi-led', label: 'LED (any color)', qty: 1 },
      { type: 'wokwi-resistor', label: '220Ω Resistor', qty: 1, attrs: { value: '220' } },
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
    startingComponents: ['wokwi-arduino-uno', 'wokwi-led', 'wokwi-resistor', 'wokwi-rgb-led'],
    rewardComponents: [
      { type: 'wokwi-buzzer', name: 'Buzzer', icon: '🔔', description: 'Makes sounds and tones — you can even play music with it!' },
    ],
    components: [
      { type: 'wokwi-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'wokwi-rgb-led', label: 'RGB LED', qty: 1 },
      { type: 'wokwi-resistor', label: '220Ω Resistor', qty: 3, attrs: { value: '220' } },
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
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'rgb-led', count: 1 }, { type: 'resistor', count: 3 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'Code changes LED color', weight: 0.4, requiredFunctions: ['setup', 'loop', 'setColor'] },
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
    startingComponents: ['wokwi-arduino-uno', 'wokwi-led', 'wokwi-resistor', 'wokwi-rgb-led', 'wokwi-buzzer'],
    rewardComponents: [
      { type: 'wokwi-potentiometer', name: 'Potentiometer', icon: '🎛️', description: 'A knob you can turn! It lets you control things by rotating it.' },
    ],
    components: [
      { type: 'wokwi-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'wokwi-buzzer', label: 'Passive Buzzer', qty: 1 },
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
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
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
    startingComponents: ['wokwi-arduino-uno', 'wokwi-led', 'wokwi-resistor', 'wokwi-rgb-led', 'wokwi-buzzer', 'wokwi-potentiometer'],
    rewardComponents: [
      { type: 'wokwi-photoresistor-sensor', name: 'Light Sensor (LDR)', icon: '🌞', description: 'Detects how bright or dark the room is. Like eyes for your Arduino!' },
    ],
    components: [
      { type: 'wokwi-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'wokwi-led', label: 'LED', qty: 1 },
      { type: 'wokwi-resistor', label: '220Ω Resistor', qty: 1, attrs: { value: '220' } },
      { type: 'wokwi-potentiometer', label: 'Potentiometer', qty: 1 },
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
    startingComponents: ['wokwi-arduino-uno', 'wokwi-led', 'wokwi-resistor', 'wokwi-photoresistor-sensor'],
    rewardComponents: [
      { type: 'wokwi-servo', name: 'Servo Motor', icon: '⚙️', description: 'A motor that can turn to any angle you set — like a robot arm!' },
    ],
    components: [
      { type: 'wokwi-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'wokwi-photoresistor-sensor', label: 'Light Sensor (LDR)', qty: 1 },
      { type: 'wokwi-led', label: 'LED', qty: 1 },
      { type: 'wokwi-resistor', label: '10kΩ Resistor', qty: 1, attrs: { value: '10000' } },
      { type: 'wokwi-resistor', label: '220Ω Resistor', qty: 1, attrs: { value: '220' } },
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
    startingComponents: ['wokwi-arduino-uno', 'wokwi-servo', 'wokwi-potentiometer'],
    rewardComponents: [
      { type: 'wokwi-neopixel-matrix', name: 'NeoPixel LED Strip', icon: '✨', description: 'A strip of colorful LEDs you can control individually — make animations and patterns!' },
    ],
    components: [
      { type: 'wokwi-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'wokwi-servo', label: 'Servo Motor', qty: 1 },
      { type: 'wokwi-potentiometer', label: 'Potentiometer', qty: 1 },
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
    startingComponents: ['wokwi-arduino-uno', 'wokwi-neopixel-matrix'],
    rewardComponents: [
      { type: 'wokwi-pushbutton', name: 'Push Button', icon: '🔘', description: 'Press it to trigger things! Used in almost every electronic device.' },
    ],
    components: [
      { type: 'wokwi-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'wokwi-neopixel-matrix', label: 'NeoPixel Strip (8 LEDs)', qty: 1 },
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
    startingComponents: ['wokwi-arduino-uno', 'wokwi-led', 'wokwi-resistor', 'wokwi-pushbutton'],
    rewardComponents: [
      { type: 'wokwi-ntc-temperature-sensor', name: 'Temperature Sensor', icon: '🌡️', description: 'Measures how hot or cold it is! Used in thermostats, weather stations, and more.' },
    ],
    components: [
      { type: 'wokwi-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'wokwi-pushbutton', label: 'Push Button', qty: 1 },
      { type: 'wokwi-led', label: 'LED', qty: 1 },
      { type: 'wokwi-resistor', label: '220Ω Resistor', qty: 1, attrs: { value: '220' } },
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
    startingComponents: ['wokwi-arduino-uno', 'wokwi-ntc-temperature-sensor', 'wokwi-resistor', 'wokwi-led', 'wokwi-buzzer'],
    rewardComponents: [
      { type: 'wokwi-motor', name: 'DC Motor', icon: '🔩', description: 'Spins at any speed you want! Used in fans, robots, and toy cars.' },
      { type: 'wokwi-l293d', name: 'Motor Driver (L293D)', icon: '🔌', description: 'Controls the motor — gives it the power it needs to spin fast.' },
    ],
    components: [
      { type: 'wokwi-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'wokwi-ntc-temperature-sensor', label: 'NTC Temperature Sensor', qty: 1 },
      { type: 'wokwi-resistor', label: '10kΩ Resistor', qty: 1, attrs: { value: '10000' } },
      { type: 'wokwi-led', label: 'Red Alert LED', qty: 1 },
      { type: 'wokwi-buzzer', label: 'Alarm Buzzer', qty: 1 },
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
    startingComponents: ['wokwi-arduino-uno', 'wokwi-motor', 'wokwi-l293d', 'wokwi-potentiometer'],
    rewardComponents: [
      // Completing this unlocks ALL remaining components — you're a Circuit Champion!
      { type: '*', name: 'ALL Components Unlocked!', icon: '🏆', description: 'You completed every project! You now have access to the full component library!' },
    ],
    components: [
      { type: 'wokwi-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'wokwi-l293d', label: 'L293D Motor Driver', qty: 1 },
      { type: 'wokwi-motor', label: 'DC Motor', qty: 1 },
      { type: 'wokwi-potentiometer', label: 'Potentiometer (speed control)', qty: 1 },
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
    'wokwi-led',
    'wokwi-resistor',
  ]);
  let allUnlocked = false;

  for (const project of PROJECTS) {
    if (completedProjects.includes(project.slug)) {
      for (const reward of (project.rewardComponents || [])) {
        if (reward.type === '*') { allUnlocked = true; break; }
        earned.add(reward.type);
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