
export const PROJECTS = [
  // ── World 1: Circuit Basics ──────────────────────────────────────────────
  {
    id: 'led-blink', slug: 'led-blink', number: 1, prerequisite: null,
    title: 'LED Blink', subtitle: 'The "Hello, World" of hardware',
    description: 'Make an LED blink on and off. This is the very first project every maker builds! You will learn how to turn a light on and off using code.',
    difficulty: 'beginner', difficultyLabel: 'Beginner', estimatedTime: '15 min',
    xpReward: 100, color: '#22c55e', icon: '💡', world: 1,
    tags: ['LED', 'digital output', 'blinking'],
    startingComponents: ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor'],
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
    starterCode: `void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}`,
    concepts: ['pinMode()', 'digitalWrite()', 'delay()', 'Digital output', 'LED polarity'],
    kidFriendlyTip: '💡 Tip: The LED has a long leg (+) and a short leg (−). The long leg goes toward the Arduino!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'led', count: 1 }, { type: 'resistor', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [{ from: { component: 'arduino', pin: '13' }, to: { component: 'led', terminal: 'A' } }, { from: { component: 'led', terminal: 'K' }, to: { component: 'resistor', terminal: '1' } }, { from: { component: 'resistor', terminal: '2' }, to: { component: 'arduino', pin: 'GND.1' } }] },
        codeFunctionality: { description: 'Code blinks LED correctly', weight: 0.4, requiredFunctions: ['setup', 'loop'], expectedBehavior: { pinNumber: 13, pinMode: 'OUTPUT', pattern: 'alternating high/low', blinkDelay: 1000 } },
      },
    },
    badge: { id: 'badge_led_blink', name: 'First Light', description: 'Made your first LED blink!', icon: '💡', rarity: 'common' },
  },

  {
    id: 'rgb-led', slug: 'rgb-led', number: 2, prerequisite: 'led-blink',
    title: 'RGB LED', subtitle: 'Mix any color you want!',
    description: 'Control a special LED that can show ANY color. Red, green, blue — or mix them to make purple, yellow, cyan, and more!',
    difficulty: 'beginner', difficultyLabel: 'Beginner', estimatedTime: '20 min',
    xpReward: 150, color: '#a855f7', icon: '🌈', world: 1,
    tags: ['PWM', 'RGB', 'color mixing'],
    startingComponents: ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor', 'openhw-rgb-led'],
    rewardComponents: [
      { type: 'openhw-buzzer', name: 'Buzzer', icon: '🔔', description: 'Makes sounds and tones — you can even play music with it!' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-rgb-led', label: 'RGB LED', qty: 1 },
      { type: 'openhw-resistor', label: '220Ω Resistor', qty: 3, attrs: { value: '220' } },
    ],
    wiring: [
      { from: 'Arduino pin 9', to: 'RGB LED Red pin' },
      { from: 'Arduino pin 10', to: 'RGB LED Green pin' },
      { from: 'Arduino pin 11', to: 'RGB LED Blue pin' },
      { from: 'Each color pin', to: '220Ω resistor in series' },
      { from: 'RGB LED GND', to: 'Arduino GND' },
    ],
    starterCode: `int redPin = 9, greenPin = 10, bluePin = 11;\n\nvoid setup() {\n  pinMode(redPin, OUTPUT);\n  pinMode(greenPin, OUTPUT);\n  pinMode(bluePin, OUTPUT);\n}\n\nvoid setColor(int r, int g, int b) {\n  analogWrite(redPin, r);\n  analogWrite(greenPin, g);\n  analogWrite(bluePin, b);\n}\n\nvoid loop() {\n  setColor(255, 0, 0); delay(1000);\n  setColor(0, 255, 0); delay(1000);\n  setColor(0, 0, 255); delay(1000);\n  setColor(255, 255, 0); delay(1000);\n}`,
    concepts: ['analogWrite()', 'PWM', 'RGB color model', 'Color mixing'],
    kidFriendlyTip: '🌈 Tip: analogWrite() sends a number from 0 (off) to 255 (full brightness). Mix red, green, and blue to make any color!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'rgb-led', count: 1 }, { type: 'resistor', count: 3 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'Code changes LED color', weight: 0.4, requiredFunctions: ['setup', 'loop', 'setColor'] },
      },
    },
    badge: { id: 'badge_rgb_led', name: 'Rainbow Maker', description: 'Mixed colors with an RGB LED!', icon: '🌈', rarity: 'common' },
  },

  {
    id: 'buzzer', slug: 'buzzer', number: 3, prerequisite: 'rgb-led',
    title: 'Buzzer Music', subtitle: 'Make your Arduino sing!',
    description: 'Use a buzzer to play tones and melodies! You can even program it to play songs like Twinkle Twinkle Little Star.',
    difficulty: 'beginner', difficultyLabel: 'Beginner', estimatedTime: '20 min',
    xpReward: 120, color: '#f59e0b', icon: '🎵', world: 1,
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
    starterCode: `void setup() {}\n\nvoid playNote(int pin, int freq, int duration) {\n  tone(pin, freq, duration);\n  delay(duration + 50);\n}\n\nvoid loop() {\n  int buzzer = 8;\n  playNote(buzzer, 262, 400);\n  playNote(buzzer, 262, 400);\n  playNote(buzzer, 392, 400);\n  playNote(buzzer, 392, 400);\n  playNote(buzzer, 440, 400);\n  playNote(buzzer, 440, 400);\n  playNote(buzzer, 392, 800);\n  delay(2000);\n}`,
    concepts: ['tone()', 'noTone()', 'Sound frequency', 'Musical notes'],
    kidFriendlyTip: '🎵 Tip: Higher frequency = higher-pitched sound. Middle C is 262 Hz!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'buzzer', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'Code plays tones', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: { id: 'badge_buzzer', name: 'Sound Maker', description: 'Played a melody with a buzzer!', icon: '🎵', rarity: 'common' },
  },

  {
    id: 'potentiometer', slug: 'potentiometer', number: 4, prerequisite: 'buzzer',
    title: 'Potentiometer', subtitle: 'Turn a knob, control a light!',
    description: 'A potentiometer is a knob you can turn from 0% to 100%. Turn it → LED gets brighter or dimmer. Learn about analog signals!',
    difficulty: 'beginner', difficultyLabel: 'Beginner', estimatedTime: '20 min',
    xpReward: 130, color: '#06b6d4', icon: '🎛️', world: 1,
    tags: ['analog input', 'potentiometer', 'PWM'],
    startingComponents: ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor', 'openhw-rgb-led', 'openhw-buzzer', 'openhw-potentiometer'],
    rewardComponents: [
      { type: 'openhw-photoresistor', name: 'Light Sensor (LDR)', icon: '🌞', description: 'Detects how bright or dark the room is!' },
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
    starterCode: `void setup() {\n  pinMode(9, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int knobValue = analogRead(A0);\n  int brightness = knobValue / 4;\n  analogWrite(9, brightness);\n  Serial.print("Knob: "); Serial.print(knobValue);\n  Serial.print("  Brightness: "); Serial.println(brightness);\n  delay(100);\n}`,
    concepts: ['analogRead()', 'analogWrite()', 'Analog signals', 'Mapping values', 'Serial.print()'],
    kidFriendlyTip: '🎛️ Tip: analogRead() gives 0–1023. Divide by 4 to get 0–255 for analogWrite.',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'led', count: 1 }, { type: 'potentiometer', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'Knob controls brightness', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: { id: 'badge_potentiometer', name: 'Knob Controller', description: 'Used a potentiometer to control LED brightness!', icon: '🎛️', rarity: 'uncommon' },
  },

  {
    id: 'ldr', slug: 'ldr', number: 5, prerequisite: 'potentiometer',
    title: 'Light Sensor', subtitle: 'See the light!',
    description: 'An LDR changes resistance based on brightness. Dark room → LED ON automatically. Bright room → LED OFF. Just like automatic street lights!',
    difficulty: 'beginner', difficultyLabel: 'Beginner', estimatedTime: '20 min',
    xpReward: 140, color: '#eab308', icon: '🌞', world: 1,
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
    starterCode: `void setup() {\n  pinMode(13, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int lightLevel = analogRead(A0);\n  Serial.print("Light level: "); Serial.println(lightLevel);\n  if (lightLevel < 500) {\n    digitalWrite(13, HIGH);\n  } else {\n    digitalWrite(13, LOW);\n  }\n  delay(200);\n}`,
    concepts: ['analogRead()', 'Voltage divider', 'if/else', 'Light sensors', 'Automatic control'],
    kidFriendlyTip: '🌞 Tip: Cover the LDR with your finger to make it dark — watch the LED turn on!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'photoresistor', count: 1 }, { type: 'led', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'LED responds to light level', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: { id: 'badge_ldr', name: 'Light Chaser', description: 'Built an automatic light sensor circuit!', icon: '🌞', rarity: 'uncommon' },
  },

  // ── World 2: Signal Control ──────────────────────────────────────────────
  {
    id: 'servo-motor', slug: 'servo-motor', number: 6, prerequisite: 'ldr',
    title: 'Servo Motor', subtitle: 'Control a robot arm!',
    description: 'A servo motor turns to any angle you tell it — 0°, 45°, 90°, 180°. Used in robot arms, RC cars, and more!',
    difficulty: 'intermediate', difficultyLabel: 'Intermediate', estimatedTime: '25 min',
    xpReward: 200, color: '#3b82f6', icon: '⚙️', world: 2,
    tags: ['servo', 'motor', 'PWM', 'robotics'],
    startingComponents: ['openhw-arduino-uno', 'openhw-servo', 'openhw-potentiometer'],
    rewardComponents: [
      { type: 'openhw-neopixel-matrix', name: 'NeoPixel LED Strip', icon: '✨', description: 'A strip of colorful LEDs you can control individually!' },
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
    starterCode: `#include <Servo.h>\nServo myServo;\n\nvoid setup() {\n  myServo.attach(9);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int knob = analogRead(A0);\n  int angle = map(knob, 0, 1023, 0, 180);\n  myServo.write(angle);\n  Serial.print("Angle: "); Serial.println(angle);\n  delay(15);\n}`,
    concepts: ['Servo library', 'myServo.write()', 'map()', 'Servo motors', 'PWM signals'],
    kidFriendlyTip: '⚙️ Tip: map(500, 0, 1023, 0, 180) gives ~88 — almost exactly halfway!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'servo', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'Servo moves to correct angle', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: { id: 'badge_servo', name: 'Motion Master', description: 'Controlled a servo motor!', icon: '⚙️', rarity: 'uncommon' },
  },

  {
    id: 'led-strip', slug: 'led-strip', number: 7, prerequisite: 'servo-motor',
    title: 'LED Strip', subtitle: 'NeoPixel light show!',
    description: 'NeoPixel LEDs are individually addressable — control each LED separately! Make rainbow patterns and animations.',
    difficulty: 'intermediate', difficultyLabel: 'Intermediate', estimatedTime: '30 min',
    xpReward: 220, color: '#ec4899', icon: '✨', world: 2,
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
    starterCode: `#include <Adafruit_NeoPixel.h>\n#define PIN 6\n#define NUM_LEDS 8\nAdafruit_NeoPixel strip(NUM_LEDS, PIN, NEO_GRB + NEO_KHZ800);\n\nvoid setup() {\n  strip.begin();\n  strip.show();\n}\n\nvoid loop() {\n  for (int i = 0; i < NUM_LEDS; i++) {\n    strip.clear();\n    strip.setPixelColor(i, strip.Color(255, 0, 0));\n    strip.show();\n    delay(100);\n  }\n}`,
    concepts: ['NeoPixel library', 'strip.setPixelColor()', 'strip.Color()', 'LED arrays', 'Animations'],
    kidFriendlyTip: '✨ Tip: strip.show() actually updates the lights — never forget it!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'neopixel', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'LEDs animate correctly', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: { id: 'badge_led_strip', name: 'Light Show Artist', description: 'Created a NeoPixel animation!', icon: '✨', rarity: 'rare' },
  },

  {
    id: 'button-debounce', slug: 'button-debounce', number: 8, prerequisite: 'led-strip',
    title: 'Button & Debounce', subtitle: 'Clean, reliable button presses',
    description: 'Buttons "bounce" when pressed! Debouncing ignores the bouncing and only counts real presses. Learn millis() — a big upgrade!',
    difficulty: 'intermediate', difficultyLabel: 'Intermediate', estimatedTime: '30 min',
    xpReward: 250, color: '#14b8a6', icon: '🔘', world: 2,
    tags: ['button', 'debounce', 'millis', 'state machine'],
    startingComponents: ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor', 'openhw-pushbutton'],
    rewardComponents: [
      { type: 'openhw-ntc-temperature-sensor', name: 'Temperature Sensor', icon: '🌡️', description: 'Measures how hot or cold it is!' },
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
    starterCode: `const int buttonPin = 2, ledPin = 13;\nbool ledState = false, lastButton = HIGH;\nunsigned long lastDebounceTime = 0;\nconst unsigned long debounceDelay = 50;\n\nvoid setup() {\n  pinMode(buttonPin, INPUT_PULLUP);\n  pinMode(ledPin, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  bool reading = digitalRead(buttonPin);\n  if (reading != lastButton) lastDebounceTime = millis();\n  if ((millis() - lastDebounceTime) > debounceDelay) {\n    if (reading == LOW) {\n      ledState = !ledState;\n      digitalWrite(ledPin, ledState);\n      delay(200);\n    }\n  }\n  lastButton = reading;\n}`,
    concepts: ['millis()', 'debouncing', 'INPUT_PULLUP', 'State machines', 'Boolean toggle'],
    kidFriendlyTip: '🔘 Tip: millis() counts milliseconds since Arduino started — like a stopwatch!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'button', count: 1 }, { type: 'led', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'Button toggles LED reliably', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: { id: 'badge_button_debounce', name: 'Button Ninja', description: 'Mastered button debouncing!', icon: '🔘', rarity: 'rare' },
  },

  {
    id: 'temperature-sensor', slug: 'temperature-sensor', number: 9, prerequisite: 'button-debounce',
    title: 'Temperature Sensor', subtitle: 'Build your own thermometer!',
    description: 'Read the temperature with an NTC sensor and print it to the Serial Monitor. If it gets too hot, trigger an alarm!',
    difficulty: 'intermediate', difficultyLabel: 'Intermediate', estimatedTime: '30 min',
    xpReward: 260, color: '#ef4444', icon: '🌡️', world: 2,
    tags: ['temperature', 'NTC', 'sensor', 'Serial Monitor'],
    startingComponents: ['openhw-arduino-uno', 'openhw-ntc-temperature-sensor', 'openhw-resistor', 'openhw-led', 'openhw-buzzer'],
    rewardComponents: [
      { type: 'openhw-motor', name: 'DC Motor', icon: '🔩', description: 'Spins at any speed you want!' },
      { type: 'openhw-l293d', name: 'Motor Driver (L293D)', icon: '🔌', description: 'Controls the motor safely.' },
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
    starterCode: `const float BETA = 3950;\nconst int ALERT_TEMP = 30;\n\nvoid setup() {\n  pinMode(13, OUTPUT);\n  pinMode(8, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int raw = analogRead(A0);\n  float resistance = 10000.0 * raw / (1023.0 - raw);\n  float tempK = 1.0 / (log(resistance / 10000.0) / BETA + 1.0 / 298.15);\n  float tempC = tempK - 273.15;\n  Serial.print("Temperature: "); Serial.print(tempC, 1); Serial.println(" C");\n  if (tempC > ALERT_TEMP) {\n    digitalWrite(13, HIGH); tone(8, 1000, 200);\n  } else {\n    digitalWrite(13, LOW); noTone(8);\n  }\n  delay(1000);\n}`,
    concepts: ['NTC sensor', 'Voltage divider', 'Temperature conversion', 'Thresholds', 'Alarms'],
    kidFriendlyTip: '🌡️ Tip: Click on the NTC sensor in the simulator and drag a slider to change temperature!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'ntc', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'Temperature reads and alerts correctly', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: { id: 'badge_temperature', name: 'Temperature Detective', description: 'Built a temperature alarm!', icon: '🌡️', rarity: 'rare' },
  },

  // ── World 3: Machines & Sensors ──────────────────────────────────────────
  {
    id: 'dc-motor', slug: 'dc-motor', number: 10, prerequisite: 'temperature-sensor',
    title: 'DC Motor', subtitle: 'Power and speed control!',
    description: 'DC motors are in fans, toy cars, drones, and robots. Use an L293D motor driver to control speed and direction!',
    difficulty: 'advanced', difficultyLabel: 'Advanced', estimatedTime: '40 min',
    xpReward: 300, color: '#f97316', icon: '🔩', world: 3,
    tags: ['motor', 'PWM', 'H-bridge', 'robotics'],
    startingComponents: ['openhw-arduino-uno', 'openhw-motor', 'openhw-l293d', 'openhw-potentiometer'],
    rewardComponents: [
      { type: 'openhw-hc-sr04', name: 'HC-SR04 Ultrasonic', icon: '📡', description: 'Measure distances using ultrasonic sound waves!' },
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
    starterCode: `const int enablePin = 9, in1Pin = 7, in2Pin = 8;\n\nvoid setup() {\n  pinMode(enablePin, OUTPUT);\n  pinMode(in1Pin, OUTPUT);\n  pinMode(in2Pin, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid setMotor(int speed, bool forward) {\n  digitalWrite(in1Pin, forward ? HIGH : LOW);\n  digitalWrite(in2Pin, forward ? LOW : HIGH);\n  analogWrite(enablePin, abs(speed));\n}\n\nvoid loop() {\n  int knob = analogRead(A0);\n  int speed = map(knob, 0, 1023, 0, 255);\n  setMotor(speed, true);\n  Serial.print("Speed: "); Serial.println(speed);\n  delay(100);\n}`,
    concepts: ['H-bridge', 'L293D', 'Motor direction', 'PWM speed control', 'Motor drivers'],
    kidFriendlyTip: '🔩 Tip: An H-bridge lets current flow in two directions — that\'s how you reverse the motor!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'motor', count: 1 }, { type: 'motor-driver', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'Motor speed and direction controlled', weight: 0.4, requiredFunctions: ['setup', 'loop', 'setMotor'] },
      },
    },
    badge: { id: 'badge_dc_motor', name: 'Motor Mechanic', description: 'Controlled a DC motor with an H-bridge!', icon: '🔩', rarity: 'rare' },
  },

  // ── World 4: Smart Sensing ───────────────────────────────────────────────
  {
    id: 'ultrasonic-sensor', slug: 'ultrasonic-sensor', number: 11, prerequisite: 'dc-motor',
    title: 'Ultrasonic Distance', subtitle: 'Measure distance with sound!',
    description: 'Use the HC-SR04 to measure how far away objects are — just like a bat uses echolocation!',
    difficulty: 'intermediate', difficultyLabel: 'Intermediate', estimatedTime: '30 min',
    xpReward: 200, color: '#3b82f6', icon: '📡', world: 4,
    tags: ['ultrasonic', 'HC-SR04', 'distance', 'pulseIn', 'sonar'],
    startingComponents: ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor'],
    rewardComponents: [
      { type: 'openhw-dht11', name: 'DHT11 Sensor', icon: '🌡️', description: 'Measures temperature and humidity with a single wire!' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-hc-sr04', label: 'HC-SR04 Ultrasonic Sensor', qty: 1 },
      { type: 'openhw-led', label: 'LED (proximity indicator)', qty: 1 },
      { type: 'openhw-resistor', label: '220Ω Resistor', qty: 1, attrs: { value: '220' } },
    ],
    wiring: [
      { from: 'HC-SR04 VCC', to: 'Arduino 5V' },
      { from: 'HC-SR04 GND', to: 'Arduino GND' },
      { from: 'HC-SR04 TRIG', to: 'Arduino pin 9' },
      { from: 'HC-SR04 ECHO', to: 'Arduino pin 10' },
      { from: 'Arduino pin 11 (PWM)', to: 'LED anode via 220Ω resistor' },
    ],
    starterCode: `#define TRIG_PIN 9\n#define ECHO_PIN 10\n#define LED_PIN 11\n\nvoid setup() {\n  pinMode(TRIG_PIN, OUTPUT);\n  pinMode(ECHO_PIN, INPUT);\n  pinMode(LED_PIN, OUTPUT);\n  Serial.begin(9600);\n}\n\nlong measureDistance() {\n  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);\n  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);\n  digitalWrite(TRIG_PIN, LOW);\n  long duration = pulseIn(ECHO_PIN, HIGH);\n  return duration * 0.0343 / 2;\n}\n\nvoid loop() {\n  long cm = measureDistance();\n  Serial.print("Distance: "); Serial.print(cm); Serial.println(" cm");\n  int brightness = map(constrain(cm, 5, 50), 50, 5, 0, 255);\n  analogWrite(LED_PIN, brightness);\n  delay(200);\n}`,
    concepts: ['pulseIn()', 'delayMicroseconds()', 'Speed of sound', 'map()', 'constrain()'],
    kidFriendlyTip: '📡 Tip: Sound goes TO the object and BACK — divide by 2 to get one-way distance!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'hc-sr04', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'Measures and prints distance', weight: 0.4, requiredFunctions: ['setup', 'loop', 'measureDistance'] },
      },
    },
    badge: { id: 'badge_ultrasonic', name: 'Sonar Ranger', description: 'Measured distances with ultrasonic sound waves!', icon: '📡', rarity: 'rare' },
  },

  {
    id: 'dht11-sensor', slug: 'dht11-sensor', number: 12, prerequisite: 'ultrasonic-sensor',
    title: 'DHT11 Weather Station', subtitle: 'Read temperature & humidity!',
    description: 'Build a mini weather station! The DHT11 sensor measures both temperature and humidity in one package.',
    difficulty: 'intermediate', difficultyLabel: 'Intermediate', estimatedTime: '25 min',
    xpReward: 220, color: '#ef4444', icon: '🌡️', world: 4,
    tags: ['DHT11', 'temperature', 'humidity', 'sensor', 'library'],
    startingComponents: ['openhw-arduino-uno', 'openhw-resistor'],
    rewardComponents: [
      { type: 'openhw-lcd1602', name: 'I2C LCD Display', icon: '🖥️', description: 'A 16×2 character display that connects with just 2 wires!' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-dht11', label: 'DHT11 Temperature & Humidity Sensor', qty: 1 },
      { type: 'openhw-resistor', label: '10kΩ Pull-up Resistor', qty: 1, attrs: { value: '10000' } },
    ],
    wiring: [
      { from: 'DHT11 VCC (pin 1)', to: 'Arduino 5V' },
      { from: 'DHT11 DATA (pin 2)', to: 'Arduino pin 2 + 10kΩ to 5V' },
      { from: 'DHT11 GND (pin 4)', to: 'Arduino GND' },
    ],
    starterCode: `#include <DHT.h>\n#define DHT_PIN 2\n#define DHT_TYPE DHT11\nDHT dht(DHT_PIN, DHT_TYPE);\n\nvoid setup() {\n  Serial.begin(9600);\n  dht.begin();\n}\n\nvoid loop() {\n  delay(2000);\n  float humidity = dht.readHumidity();\n  float tempC = dht.readTemperature();\n  if (isnan(humidity) || isnan(tempC)) { Serial.println("ERROR: Failed to read!"); return; }\n  Serial.print("Humidity: "); Serial.print(humidity); Serial.println(" %");\n  Serial.print("Temp: "); Serial.print(tempC); Serial.println(" C");\n}`,
    concepts: ['DHT library', 'readTemperature()', 'readHumidity()', 'isnan()', 'Heat index'],
    kidFriendlyTip: '🌡️ Tip: Always wait 2 seconds between readings — DHT11 can only measure once per second!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'dht11', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring with pull-up', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'Reads and prints temp + humidity', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: { id: 'badge_dht11', name: 'Weather Watcher', description: 'Built a working temperature and humidity station!', icon: '🌡️', rarity: 'rare' },
  },

  {
    id: 'lcd-display', slug: 'lcd-display', number: 13, prerequisite: 'dht11-sensor',
    title: 'LCD Display', subtitle: 'Show messages on a screen!',
    description: 'Make your project talk! The I2C LCD shows text on 2 rows of 16 characters. Combine it with DHT11 for a real weather station!',
    difficulty: 'advanced', difficultyLabel: 'Advanced', estimatedTime: '35 min',
    xpReward: 280, color: '#14b8a6', icon: '🖥️', world: 4,
    tags: ['LCD', 'I2C', 'display', 'LiquidCrystal', 'SDA', 'SCL'],
    startingComponents: ['openhw-arduino-uno', 'openhw-dht11', 'openhw-resistor'],
    rewardComponents: [
      { type: 'openhw-analog-joystick', name: 'Analog Joystick', icon: '🕹️', description: 'Two-axis joystick with X/Y analog output and a click button!' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-lcd1602', label: 'I2C 16×2 LCD Display', qty: 1 },
      { type: 'openhw-dht11', label: 'DHT11 Sensor', qty: 1 },
    ],
    wiring: [
      { from: 'LCD GND', to: 'Arduino GND' },
      { from: 'LCD VCC', to: 'Arduino 5V' },
      { from: 'LCD SDA', to: 'Arduino A4 (SDA)' },
      { from: 'LCD SCL', to: 'Arduino A5 (SCL)' },
      { from: 'DHT11 DATA', to: 'Arduino pin 2 + 10kΩ pull-up to 5V' },
    ],
    starterCode: `#include <LiquidCrystal_I2C.h>\n#include <DHT.h>\nLiquidCrystal_I2C lcd(0x27, 16, 2);\n#define DHT_PIN 2\nDHT dht(DHT_PIN, DHT11);\n\nvoid setup() {\n  lcd.init(); lcd.backlight();\n  dht.begin();\n  lcd.setCursor(0, 0); lcd.print("Weather Station");\n  lcd.setCursor(0, 1); lcd.print("   Starting...  ");\n  delay(2000);\n}\n\nvoid loop() {\n  delay(2000);\n  float h = dht.readHumidity(), t = dht.readTemperature();\n  if (isnan(h) || isnan(t)) { lcd.clear(); lcd.print("Sensor Error!"); return; }\n  lcd.clear();\n  lcd.setCursor(0, 0); lcd.print("Temp: "); lcd.print(t, 1); lcd.print((char)223); lcd.print("C");\n  lcd.setCursor(0, 1); lcd.print("Hum:  "); lcd.print(h, 1); lcd.print("%");\n}`,
    concepts: ['LiquidCrystal_I2C', 'I2C protocol', 'lcd.setCursor()', 'lcd.print()', 'Custom characters'],
    kidFriendlyTip: '🖥️ Tip: I2C uses only 2 wires — SDA = A4 and SCL = A5 on Arduino Uno!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'lcd', count: 1 }] },
        wiringAccuracy: { description: 'I2C wiring correct (SDA/SCL)', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'Text displayed on LCD', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: { id: 'badge_lcd', name: 'Display Wizard', description: 'Showed live data on an LCD display!', icon: '🖥️', rarity: 'epic' },
  },

  // ── World 5: Advanced Control ────────────────────────────────────────────
  {
    id: 'joystick-control', slug: 'joystick-control', number: 14, prerequisite: 'lcd-display',
    title: 'Joystick Controller', subtitle: 'Game-style input!',
    description: 'Read X/Y axes and the click button from an analog joystick. Use it to control an LED position, servo, or game character!',
    difficulty: 'intermediate', difficultyLabel: 'Intermediate', estimatedTime: '25 min',
    xpReward: 240, color: '#f43f5e', icon: '🕹️', world: 5,
    tags: ['joystick', 'analog input', 'X/Y axis', 'game controller'],
    startingComponents: ['openhw-arduino-uno', 'openhw-analog-joystick', 'openhw-led', 'openhw-resistor'],
    rewardComponents: [
      // Completing this unlocks ALL remaining components — you're a Circuit Champion!
      { type: '*', name: 'ALL Components Unlocked!', icon: '🏆', description: 'You completed every project! Full component library unlocked!' },
    ],
    components: [
      { type: 'openhw-arduino-uno', label: 'Arduino Uno', qty: 1 },
      { type: 'openhw-analog-joystick', label: 'Analog Joystick Module', qty: 1 },
      { type: 'openhw-led', label: 'Status LED', qty: 1 },
      { type: 'openhw-resistor', label: '220Ω Resistor', qty: 1, attrs: { value: '220' } },
    ],
    wiring: [
      { from: 'Joystick VCC', to: 'Arduino 5V' },
      { from: 'Joystick GND', to: 'Arduino GND' },
      { from: 'Joystick VRx', to: 'Arduino A0' },
      { from: 'Joystick VRy', to: 'Arduino A1' },
      { from: 'Joystick SW (button)', to: 'Arduino pin 2' },
      { from: 'Arduino pin 13', to: 'LED anode → 220Ω → GND' },
    ],
    starterCode: `#define JOY_X A0\n#define JOY_Y A1\n#define JOY_BTN 2\n#define LED_PIN 13\n\nvoid setup() {\n  pinMode(JOY_BTN, INPUT_PULLUP);\n  pinMode(LED_PIN, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int x = analogRead(JOY_X);\n  int y = analogRead(JOY_Y);\n  bool btnPressed = (digitalRead(JOY_BTN) == LOW);\n\n  Serial.print("X: "); Serial.print(x);\n  Serial.print("  Y: "); Serial.print(y);\n  Serial.print("  Button: "); Serial.println(btnPressed ? "PRESSED" : "released");\n\n  // LED on when button pressed\n  digitalWrite(LED_PIN, btnPressed);\n\n  delay(100);\n}`,
    concepts: ['Dual analogRead()', 'Joystick center (512)', 'Button with INPUT_PULLUP', 'Game input', 'XY mapping'],
    kidFriendlyTip: '🕹️ Tip: Center position reads ~512. Move fully in one direction and it reaches 0 or 1023!',
    evaluation: {
      passingThreshold: 70,
      evaluationCriteria: {
        components: { description: 'Correct components placed', weight: 0.3, required: [{ type: 'arduino', count: 1 }, { type: 'joystick', count: 1 }] },
        wiringAccuracy: { description: 'Correct wiring', weight: 0.3, requiredConnections: [] },
        codeFunctionality: { description: 'Reads X/Y and button correctly', weight: 0.4, requiredFunctions: ['setup', 'loop'] },
      },
    },
    badge: { id: 'badge_joystick', name: 'Circuit Champion', description: 'Mastered joystick input — a true maker!', icon: '🏆', rarity: 'legendary' },
  },
];

// Difficulty styling
export const DIFFICULTY_CONFIG = {
  beginner:     { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  label: 'Beginner' },
  intermediate: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Intermediate' },
  advanced:     { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  label: 'Advanced' },
};

export function getProjectStatus(projectSlug, completedProjects = []) {
  if (completedProjects.includes(projectSlug)) return 'completed';
  const project = PROJECTS.find(p => p.slug === projectSlug);
  if (!project) return 'locked';
  if (!project.prerequisite) return 'available';
  if (completedProjects.includes(project.prerequisite)) return 'available';
  return 'locked';
}

export function getUnlockedProjects(completedProjects = []) {
  return PROJECTS.filter(p => getProjectStatus(p.slug, completedProjects) !== 'locked');
}

export function getEarnedComponents(completedProjects = []) {
  const earned = new Set([
    'wokwi-arduino-uno', 'openhw-arduino-uno',
    'wokwi-led', 'openhw-led',
    'wokwi-resistor', 'openhw-resistor',
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

export function getProjectRewardComponents(projectSlug) {
  const project = PROJECTS.find(p => p.slug === projectSlug);
  return project?.rewardComponents || [];
}

export function getLockedProjects(completedProjects = []) {
  return PROJECTS.filter(p => getProjectStatus(p.slug, completedProjects) === 'locked');
}
