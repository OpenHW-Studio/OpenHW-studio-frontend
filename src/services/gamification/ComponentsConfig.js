export const COMPONENTS = [
  {
    id: 'led',
    name: 'LED',
    fullName: 'Light-Emitting Diode',
    icon: '💡',
    color: '#f59e0b',
    category: 'Output',
    levelRequired: 1,
    xpReward: 50,
    coinReward: 10,
    description: 'The most fundamental output component. Converts electrical energy into light.',
    usedInProjects: ['blink', 'traffic-light', 'rgb-mixer'],
    theory: {
      readTime: '3 min',
      sections: [
        {
          title: 'What is an LED?',
          content: `An LED (Light-Emitting Diode) is a semiconductor device that emits light when current flows through it. Unlike regular bulbs, LEDs are:
• Energy-efficient (use far less power)
• Long-lasting (up to 50,000 hours)
• Available in many colors (red, green, blue, white, and more)
• Fast switching (can blink millions of times per second)`,
        },
        {
          title: 'Polarity Matters',
          content: `LEDs are polarized — they only work in one direction.
• Anode (+): The longer leg. Connect to positive voltage.
• Cathode (−): The shorter leg. Connect to GND (ground).

If you connect an LED backwards, it won't light up (and won't be damaged in normal conditions). Always check which leg is longer!`,
        },
        {
          title: 'The Current-Limiting Resistor',
          content: `LEDs need a resistor in series to limit current. Without one, too much current flows and the LED burns out instantly.

Formula: R = (Vcc − Vf) / If
• Vcc = supply voltage (5V on Arduino)
• Vf = LED forward voltage (~2V for red, ~3.3V for blue)
• If = desired current (~20mA = 0.02A)

Example (red LED): R = (5 − 2) / 0.02 = 150Ω → use 220Ω (next standard value up)`,
        },
        {
          title: 'Arduino Connection',
          content: `Connect an LED to Arduino like this:
1. Connect the anode (+, long leg) to a digital pin (e.g. pin 13)
2. Connect a 220Ω resistor between the cathode and GND
3. Use digitalWrite(13, HIGH) to turn on, LOW to turn off
4. Use analogWrite(pin, 0-255) on PWM pins (~) to control brightness`,
        },
      ],
    },
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: 'led_q1',
          question: 'Which leg of an LED is the anode (positive)?',
          options: ['The shorter leg', 'The longer leg', 'Both legs are the same', 'It depends on the LED color'],
          correct: 1,
          explanation: 'The longer leg is the anode (+). The shorter leg is the cathode (−).',
        },
        {
          id: 'led_q2',
          question: 'Why do we use a resistor with an LED?',
          options: [
            'To make it brighter',
            'To change the color',
            'To limit current and prevent burning out',
            'To increase voltage',
          ],
          correct: 2,
          explanation: 'Without a current-limiting resistor, excess current destroys the LED immediately.',
        },
        {
          id: 'led_q3',
          question: 'Arduino supply voltage is 5V. Red LED Vf = 2V, If = 20mA. What resistor value?',
          options: ['100Ω', '150Ω', '220Ω', '470Ω'],
          correct: 1,
          explanation: 'R = (5−2)/0.02 = 150Ω. 150Ω is the exact value; 220Ω is also acceptable as it\'s the next standard value up.',
        },
        {
          id: 'led_q4',
          question: 'Which Arduino function controls LED brightness?',
          options: ['digitalWrite()', 'analogWrite()', 'ledWrite()', 'setBrightness()'],
          correct: 1,
          explanation: 'analogWrite() outputs PWM (0–255) on PWM-capable pins (~) to vary brightness.',
        },
        {
          id: 'led_q5',
          question: 'What happens if you connect an LED backwards?',
          options: [
            'It explodes',
            'It gets very bright',
            'It won\'t light up but usually isn\'t damaged',
            'It changes color',
          ],
          correct: 2,
          explanation: 'A reversed LED simply blocks current and stays off. It\'s not damaged under normal Arduino voltages.',
        },
      ],
    },
  },

  {
    id: 'resistor',
    name: 'Resistor',
    fullName: 'Fixed Resistor',
    icon: '⚡',
    color: '#8b5cf6',
    category: 'Passive',
    levelRequired: 1,
    xpReward: 40,
    coinReward: 8,
    description: 'Fundamental passive component that limits current flow using Ohm\'s Law.',
    usedInProjects: ['blink', 'button-input', 'traffic-light'],
    theory: {
      readTime: '4 min',
      sections: [
        {
          title: 'What is a Resistor?',
          content: `A resistor is a passive two-terminal component that opposes the flow of electric current. It's the most common electronic component and appears in virtually every circuit.

Measured in Ohms (Ω), resistors come in values from fractions of an ohm to millions of ohms (MΩ).`,
        },
        {
          title: 'Ohm\'s Law',
          content: `The fundamental law of electronics:
  V = I × R

Where:
• V = Voltage in Volts (V)
• I = Current in Amperes (A)  
• R = Resistance in Ohms (Ω)

Rearranged:
• I = V / R  (how much current flows)
• R = V / I  (what resistor to use)`,
        },
        {
          title: 'Reading the Color Code',
          content: `Resistors use colored bands to show their value:

4-band resistors: Band1, Band2, Multiplier, Tolerance
Color → Digit: Black=0, Brown=1, Red=2, Orange=3, Yellow=4, Green=5, Blue=6, Violet=7, Gray=8, White=9

Example: Red-Red-Brown-Gold = 2, 2, ×10, ±5% = 220Ω ±5%

Tip: "Bad Boys Race Our Young Girls But Violet Generally Wins" (B,B,R,O,Y,G,B,V,G,W)`,
        },
        {
          title: 'Pull-up and Pull-down Resistors',
          content: `In Arduino circuits, resistors serve a special role with digital inputs:

Pull-up resistor (connects pin to Vcc):
• Keeps the pin HIGH by default
• Button press pulls it LOW
• Value: typically 10kΩ

Pull-down resistor (connects pin to GND):
• Keeps the pin LOW by default
• Button press pulls it HIGH
• Value: typically 10kΩ

Arduino has built-in pull-ups: pinMode(pin, INPUT_PULLUP)`,
        },
      ],
    },
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: 'res_q1',
          question: 'Voltage = 5V, Resistance = 1000Ω. What is the current?',
          options: ['0.005A (5mA)', '5000A', '0.5A', '50A'],
          correct: 0,
          explanation: 'I = V/R = 5/1000 = 0.005A = 5mA',
        },
        {
          id: 'res_q2',
          question: 'What does a pull-down resistor do?',
          options: [
            'Increases voltage to a pin',
            'Keeps a pin LOW when not actively driven HIGH',
            'Keeps a pin HIGH when not actively driven',
            'Limits the number of components',
          ],
          correct: 1,
          explanation: 'A pull-down resistor connects the pin to GND, keeping it LOW unless actively driven HIGH.',
        },
        {
          id: 'res_q3',
          question: 'What color bands represent a 220Ω resistor?',
          options: [
            'Red-Red-Brown',
            'Orange-Orange-Brown',
            'Red-Orange-Brown',
            'Brown-Black-Red',
          ],
          correct: 0,
          explanation: 'Red(2)-Red(2)-Brown(×10) = 220Ω',
        },
        {
          id: 'res_q4',
          question: 'Arduino has built-in pull-up resistors. How do you enable them?',
          options: [
            'pinMode(pin, INPUT)',
            'pinMode(pin, OUTPUT)',
            'pinMode(pin, INPUT_PULLUP)',
            'digitalWrite(pin, PULLUP)',
          ],
          correct: 2,
          explanation: 'INPUT_PULLUP enables the internal ~20–50kΩ pull-up resistor on any digital pin.',
        },
        {
          id: 'res_q5',
          question: 'You need 10mA through a component with 3.3V across it. What resistor?',
          options: ['33Ω', '330Ω', '3.3kΩ', '33kΩ'],
          correct: 1,
          explanation: 'R = V/I = 3.3/0.01 = 330Ω',
        },
      ],
    },
  },

  {
    id: 'button',
    name: 'Push Button',
    fullName: 'Tactile Push Button',
    icon: '🔘',
    color: '#06b6d4',
    category: 'Input',
    levelRequired: 1,
    xpReward: 50,
    coinReward: 10,
    description: 'Basic digital input: reads HIGH or LOW based on press state.',
    usedInProjects: ['button-input', 'traffic-light'],
    theory: {
      readTime: '3 min',
      sections: [
        {
          title: 'How a Push Button Works',
          content: `A tactile push button is a momentary switch — it connects two terminals only while pressed. When released, it returns to its default state.

4-pin buttons have two pairs of internally connected pins. Typically you use one pair diagonally opposite each other.`,
        },
        {
          title: 'Debouncing',
          content: `Physical buttons "bounce" — the contacts rapidly make and break contact many times in milliseconds when pressed. This looks like multiple presses to a microcontroller.

Solutions:
• Software debounce: Check button twice with a small delay (50ms)
• Use millis() instead of delay() for non-blocking debounce
• Hardware debounce: add a 100nF capacitor across the button`,
        },
        {
          title: 'Reading a Button in Arduino',
          content: `Basic button reading:
  pinMode(2, INPUT_PULLUP);  // use internal pull-up

  int state = digitalRead(2);
  // With INPUT_PULLUP: LOW = pressed, HIGH = released

Or with external pull-down (10kΩ to GND):
  pinMode(2, INPUT);
  // HIGH = pressed, LOW = released`,
        },
      ],
    },
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: 'btn_q1',
          question: 'What is "bouncing" in the context of push buttons?',
          options: [
            'The button physically jumping up',
            'Rapid on/off signals during press/release',
            'The voltage bouncing between values',
            'The LED flickering',
          ],
          correct: 1,
          explanation: 'Mechanical bounce causes the contacts to rapidly make/break many times, registering as multiple presses.',
        },
        {
          id: 'btn_q2',
          question: 'With INPUT_PULLUP mode, what does digitalRead() return when button is PRESSED?',
          options: ['HIGH (1)', 'LOW (0)', 'Undefined', '255'],
          correct: 1,
          explanation: 'With INPUT_PULLUP, pressing the button connects the pin to GND, returning LOW.',
        },
        {
          id: 'btn_q3',
          question: 'What value is a typical pull-up/pull-down resistor for a button?',
          options: ['220Ω', '1kΩ', '10kΩ', '1MΩ'],
          correct: 2,
          explanation: '10kΩ is the standard value — large enough to limit current, small enough to pull reliably.',
        },
        {
          id: 'btn_q4',
          question: 'Which approach is better for debouncing in non-blocking code?',
          options: [
            'delay(50) after each read',
            'Using millis() to track time',
            'Reading the button 10 times fast',
            'Using a larger resistor',
          ],
          correct: 1,
          explanation: 'millis()-based debouncing doesn\'t freeze the program like delay() does.',
        },
        {
          id: 'btn_q5',
          question: 'A button connects between pin 4 and GND. What pinMode should you use?',
          options: ['OUTPUT', 'INPUT', 'INPUT_PULLUP', 'ANALOG'],
          correct: 2,
          explanation: 'INPUT_PULLUP keeps the pin HIGH normally; pressing pulls it LOW through GND.',
        },
      ],
    },
  },

  {
    id: 'potentiometer',
    name: 'Potentiometer',
    fullName: 'Rotary Potentiometer',
    icon: '🎛️',
    color: '#10b981',
    category: 'Input',
    levelRequired: 2,
    xpReward: 60,
    coinReward: 12,
    description: 'Variable resistor that outputs analog voltage based on rotary position.',
    usedInProjects: ['analog-input', 'rgb-mixer'],
    theory: {
      readTime: '4 min',
      sections: [
        {
          title: 'What is a Potentiometer?',
          content: `A potentiometer (pot) is a variable resistor with three terminals:
• Left pin → connect to 5V (or GND)
• Right pin → connect to GND (or 5V)
• Middle pin (wiper) → analog output to Arduino

As you rotate the knob, the wiper moves along a resistive element, dividing the voltage between 0V and 5V. This is a voltage divider!`,
        },
        {
          title: 'Reading Analog Values',
          content: `Arduino has a 10-bit ADC (Analog-to-Digital Converter):
• analogRead(A0) returns 0–1023
• 0 = 0V, 1023 = 5V
• Resolution: 5V / 1024 = ~4.9mV per step

To convert to voltage: voltage = (analogRead(A0) / 1023.0) * 5.0

To map to a range (e.g., 0–180 for servo):
  int angle = map(analogRead(A0), 0, 1023, 0, 180);`,
        },
        {
          title: 'The map() Function',
          content: `Arduino's map() function rescales a number from one range to another:
  map(value, fromLow, fromHigh, toLow, toHigh)

Examples:
• map(512, 0, 1023, 0, 255) → ~127 (half brightness)
• map(768, 0, 1023, 0, 100) → ~75%
• map(0, 0, 1023, 180, 0) → inverts direction

Note: map() does integer math, so decimal precision is lost.`,
        },
      ],
    },
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: 'pot_q1',
          question: 'How many terminals does a potentiometer have?',
          options: ['2', '3', '4', '5'],
          correct: 1,
          explanation: 'Three: two outer terminals (power/GND) and one middle wiper.',
        },
        {
          id: 'pot_q2',
          question: 'What is the maximum value returned by analogRead()?',
          options: ['255', '512', '1023', '4096'],
          correct: 2,
          explanation: 'Arduino\'s 10-bit ADC gives 0–1023 (2^10 = 1024 steps).',
        },
        {
          id: 'pot_q3',
          question: 'analogRead(A0) returns 512. What voltage is that (5V system)?',
          options: ['1.25V', '2.5V', '3.3V', '5V'],
          correct: 1,
          explanation: '(512 / 1023) × 5V ≈ 2.5V. 512 is roughly the middle.',
        },
        {
          id: 'pot_q4',
          question: 'map(256, 0, 1023, 0, 100) equals approximately:',
          options: ['10', '25', '50', '75'],
          correct: 1,
          explanation: '256/1023 ≈ 25%, so map() returns ~25.',
        },
        {
          id: 'pot_q5',
          question: 'Which Arduino pins can read analog values?',
          options: ['Digital pins 0–13', 'PWM pins (~)', 'Analog pins A0–A5', 'Only pin 13'],
          correct: 2,
          explanation: 'Pins labeled A0–A5 connect to the ADC and can use analogRead().',
        },
      ],
    },
  },

  {
    id: 'buzzer',
    name: 'Buzzer',
    fullName: 'Passive Piezo Buzzer',
    icon: '🔊',
    color: '#f97316',
    category: 'Output',
    levelRequired: 2,
    xpReward: 55,
    coinReward: 11,
    description: 'Produces sound at frequencies you control using tone().',
    usedInProjects: ['buzzer-alarm', 'piano-keys'],
    theory: {
      readTime: '3 min',
      sections: [
        {
          title: 'Active vs Passive Buzzers',
          content: `Active buzzer: has internal oscillator, only needs power → always same pitch
Passive buzzer: requires external frequency signal → you control the pitch!

We use passive buzzers with Arduino's tone() function to play musical notes and melodies.`,
        },
        {
          title: 'The tone() Function',
          content: `Arduino provides three buzzer functions:

tone(pin, frequency)          // play indefinitely
tone(pin, frequency, duration) // play for duration ms
noTone(pin)                   // stop sound

Frequency determines pitch:
• Middle C = 262 Hz
• A4 (concert A) = 440 Hz
• Higher numbers = higher pitch
• Range: ~20 Hz to 20,000 Hz (human hearing)`,
        },
        {
          title: 'Musical Notes to Frequencies',
          content: `Common note frequencies:
C4=262, D4=294, E4=330, F4=349, G4=392, A4=440, B4=494, C5=523

Example – play "Twinkle":
  tone(8, 262, 400); delay(450); // C
  tone(8, 262, 400); delay(450); // C
  tone(8, 392, 400); delay(450); // G
  tone(8, 392, 400); delay(450); // G

Define notes as constants for cleaner code:
  #define NOTE_C4 262
  #define NOTE_A4 440`,
        },
      ],
    },
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: 'buz_q1',
          question: 'What is the difference between active and passive buzzers?',
          options: [
            'Active is louder',
            'Passive has internal oscillator; active needs external frequency',
            'Active has internal oscillator; passive needs external frequency',
            'There is no difference',
          ],
          correct: 2,
          explanation: 'Active buzzers have built-in oscillators. Passive buzzers need tone() to generate frequency.',
        },
        {
          id: 'buz_q2',
          question: 'What does tone(8, 440, 500) do?',
          options: [
            'Plays 8Hz for 440ms',
            'Plays 440Hz on pin 8 for 500ms',
            'Plays 500Hz on pin 8 for 440ms',
            'Plays 8Hz on pin 440',
          ],
          correct: 1,
          explanation: 'Syntax: tone(pin, frequency, duration_ms). Pin 8, 440Hz (concert A), 500ms.',
        },
        {
          id: 'buz_q3',
          question: 'How do you stop a tone that\'s playing indefinitely?',
          options: ['tone(pin, 0)', 'noTone(pin)', 'digitalWrite(pin, LOW)', 'stopTone(pin)'],
          correct: 1,
          explanation: 'noTone(pin) stops any tone playing on that pin.',
        },
        {
          id: 'buz_q4',
          question: 'A higher frequency produces a:',
          options: ['Lower pitch sound', 'Higher pitch sound', 'Louder sound', 'Longer sound'],
          correct: 1,
          explanation: 'Frequency directly controls pitch. Higher Hz = higher pitched tone.',
        },
        {
          id: 'buz_q5',
          question: 'Middle C (C4) has a frequency of approximately:',
          options: ['131 Hz', '262 Hz', '440 Hz', '523 Hz'],
          correct: 1,
          explanation: 'C4 = 262 Hz. A4 (concert pitch) = 440 Hz. C5 = 523 Hz.',
        },
      ],
    },
  },

  {
    id: 'rgb-led',
    name: 'RGB LED',
    fullName: 'RGB (Red-Green-Blue) LED',
    icon: '🌈',
    color: '#a855f7',
    category: 'Output',
    levelRequired: 2,
    xpReward: 65,
    coinReward: 13,
    description: 'Three LEDs in one package. Mix any color with PWM on 3 pins.',
    usedInProjects: ['rgb-mixer', 'mood-lamp'],
    theory: {
      readTime: '4 min',
      sections: [
        {
          title: 'RGB LED Structure',
          content: `An RGB LED contains three separate LEDs (Red, Green, Blue) in one package with a shared terminal.

Types:
• Common Cathode: shared GND pin. Send HIGH to turn on a color.
• Common Anode: shared Vcc pin. Send LOW to turn on a color.

Most breadboard RGB LEDs are common cathode. The longest pin is the common terminal.

Pins (4 total): R, Common, G, B (or R, G, Common, B — check datasheet)`,
        },
        {
          title: 'Color Mixing with PWM',
          content: `By varying PWM (0–255) on each color channel, you can mix any color:

  analogWrite(redPin,   255); // Red channel 100%
  analogWrite(greenPin, 128); // Green channel 50%
  analogWrite(bluePin,    0); // Blue off
  // Result: warm orange

Color examples:
  Red:     255, 0,   0
  Green:     0, 255, 0
  Blue:      0,   0, 255
  Yellow:  255, 255,   0
  Cyan:      0, 255, 255
  Magenta: 255,   0, 255
  White:   255, 255, 255`,
        },
        {
          title: 'Connecting the RGB LED',
          content: `For Common Cathode:
1. Connect common pin to GND through a single 47Ω resistor
   (or use 3 individual 220Ω resistors, one per color pin)
2. Connect R → PWM pin (e.g. pin 9)
3. Connect G → PWM pin (e.g. pin 10)
4. Connect B → PWM pin (e.g. pin 11)

Important: All three color pins MUST use PWM-capable pins (marked ~ on Arduino).`,
        },
      ],
    },
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: 'rgb_q1',
          question: 'In a Common Cathode RGB LED, how do you turn on the Red channel?',
          options: ['Send LOW to red pin', 'Send HIGH to red pin', 'Send LOW to common pin', 'Connect to 3.3V'],
          correct: 1,
          explanation: 'Common Cathode shares GND. Send HIGH (or use analogWrite) to the color pins to activate them.',
        },
        {
          id: 'rgb_q2',
          question: 'What color results from R=255, G=255, B=0?',
          options: ['Orange', 'Yellow', 'Cyan', 'Magenta'],
          correct: 1,
          explanation: 'Red + Green at full intensity = Yellow. This is additive color mixing.',
        },
        {
          id: 'rgb_q3',
          question: 'Why must RGB LED pins connect to PWM pins?',
          options: [
            'PWM pins are higher voltage',
            'PWM allows analog-like brightness control (0–255)',
            'Normal digital pins are not strong enough',
            'PWM pins have built-in resistors',
          ],
          correct: 1,
          explanation: 'analogWrite() needs PWM capability to vary color intensity between 0–255.',
        },
        {
          id: 'rgb_q4',
          question: 'What color is R=0, G=255, B=255?',
          options: ['White', 'Teal', 'Cyan', 'Lime'],
          correct: 2,
          explanation: 'Green + Blue = Cyan (light blue/turquoise).',
        },
        {
          id: 'rgb_q5',
          question: 'How many PWM pins does an RGB LED require?',
          options: ['1', '2', '3', '4'],
          correct: 2,
          explanation: 'One PWM pin per color channel: Red, Green, Blue = 3 PWM pins.',
        },
      ],
    },
  },

  {
    id: 'dht11',
    name: 'DHT11 Sensor',
    fullName: 'DHT11 Temperature & Humidity Sensor',
    icon: '🌡️',
    color: '#ef4444',
    category: 'Sensor',
    levelRequired: 3,
    xpReward: 80,
    coinReward: 16,
    description: 'Reads temperature (0–50°C) and relative humidity (20–90%) digitally.',
    usedInProjects: ['weather-station', 'climate-monitor'],
    theory: {
      readTime: '5 min',
      sections: [
        {
          title: 'DHT11 Specifications',
          content: `The DHT11 is a basic digital temperature and humidity sensor:
• Temperature: 0–50°C (±2°C accuracy)
• Humidity: 20–90% RH (±5% accuracy)
• Operating voltage: 3.3V to 5V
• Sampling rate: 1 reading per second (1Hz max)
• Communication: single-wire digital protocol

Despite its low accuracy, it's perfect for learning sensor interfacing.`,
        },
        {
          title: 'Wiring the DHT11',
          content: `DHT11 has 4 pins (left to right, facing front):
1. VCC → 5V
2. DATA → Digital pin (e.g. pin 2) + 10kΩ pull-up to 5V
3. NC (not connected)
4. GND → GND

The 10kΩ pull-up resistor on the data line is important for reliable readings. Some modules have it built-in.`,
        },
        {
          title: 'Using the DHT Library',
          content: `Install the "DHT sensor library" by Adafruit in Arduino IDE.

  #include <DHT.h>
  #define DHTPIN 2
  #define DHTTYPE DHT11

  DHT dht(DHTPIN, DHTTYPE);

  void setup() {
    dht.begin();
  }

  void loop() {
    float h = dht.readHumidity();
    float t = dht.readTemperature(); // Celsius
    float f = dht.readTemperature(true); // Fahrenheit
    
    if (isnan(h) || isnan(t)) {
      Serial.println("Read failed!");
      return;
    }
    Serial.print("Temp: "); Serial.print(t); Serial.println("°C");
    Serial.print("Humidity: "); Serial.print(h); Serial.println("%");
    delay(2000); // wait 2s between readings
  }`,
        },
      ],
    },
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: 'dht_q1',
          question: 'What does DHT11 measure?',
          options: ['Light and pressure', 'Temperature and humidity', 'Motion and distance', 'Sound and vibration'],
          correct: 1,
          explanation: 'DHT11 measures temperature (0–50°C) and relative humidity (20–90% RH).',
        },
        {
          id: 'dht_q2',
          question: 'Why is a pull-up resistor needed on the DHT11 data pin?',
          options: [
            'To increase voltage',
            'To ensure the line is HIGH when idle (open-drain protocol)',
            'To protect the sensor',
            'To filter noise',
          ],
          correct: 1,
          explanation: 'DHT11 uses open-drain signaling. The pull-up keeps the line HIGH between transmissions.',
        },
        {
          id: 'dht_q3',
          question: 'How often can you read the DHT11?',
          options: ['Every 100ms', 'Every 500ms', 'Once per second (1Hz max)', 'No limit'],
          correct: 2,
          explanation: 'DHT11 needs at least 1 second between readings. Reading faster returns incorrect data.',
        },
        {
          id: 'dht_q4',
          question: 'dht.readTemperature(true) returns temperature in:',
          options: ['Celsius', 'Kelvin', 'Fahrenheit', 'All three'],
          correct: 2,
          explanation: 'Passing true to readTemperature() returns Fahrenheit instead of the default Celsius.',
        },
        {
          id: 'dht_q5',
          question: 'If isnan(h) returns true, what should you do?',
          options: [
            'Continue normally',
            'Skip the reading — the sensor failed',
            'Multiply h by -1',
            'Restart Arduino',
          ],
          correct: 1,
          explanation: 'isnan() checks for "Not a Number". If true, the DHT read failed and the value is unusable.',
        },
      ],
    },
  },

  {
    id: 'ultrasonic',
    name: 'HC-SR04',
    fullName: 'HC-SR04 Ultrasonic Distance Sensor',
    icon: '📡',
    color: '#3b82f6',
    category: 'Sensor',
    levelRequired: 3,
    xpReward: 85,
    coinReward: 17,
    description: 'Measures distance 2cm–400cm using sound waves.',
    usedInProjects: ['distance-meter', 'obstacle-avoidance'],
    theory: {
      readTime: '5 min',
      sections: [
        {
          title: 'How Ultrasonic Sensing Works',
          content: `The HC-SR04 works like sonar (echolocation):
1. Trigger pin receives a 10µs HIGH pulse
2. Sensor emits 8 ultrasonic pulses at 40kHz
3. Pulses bounce off an object
4. Echo pin goes HIGH for the duration of the return trip
5. Measure Echo pulse duration → calculate distance

Speed of sound ≈ 343 m/s (at 20°C)
Distance = (pulse duration in µs × 0.0343) / 2
(Divide by 2 because sound travels TO object and BACK)`,
        },
        {
          title: 'Wiring HC-SR04',
          content: `4 pins:
• VCC → 5V
• GND → GND
• TRIG → Digital output pin (e.g. pin 9)
• ECHO → Digital input pin (e.g. pin 10)

Note: Echo pin outputs 5V. If using 3.3V Arduino, use a voltage divider on the Echo pin.`,
        },
        {
          title: 'Arduino Code',
          content: `  #define TRIG 9
  #define ECHO 10

  void setup() {
    pinMode(TRIG, OUTPUT);
    pinMode(ECHO, INPUT);
    Serial.begin(9600);
  }

  long measureDistance() {
    // Send trigger pulse
    digitalWrite(TRIG, LOW);  delayMicroseconds(2);
    digitalWrite(TRIG, HIGH); delayMicroseconds(10);
    digitalWrite(TRIG, LOW);
    
    // Measure echo duration
    long duration = pulseIn(ECHO, HIGH);
    
    // Calculate distance in cm
    return duration * 0.0343 / 2;
  }`,
        },
      ],
    },
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: 'us_q1',
          question: 'Why do we divide the echo duration by 2 when calculating distance?',
          options: [
            'To convert from µs to ms',
            'Because sound travels to the object AND back',
            'HC-SR04 measures at half speed',
            'To account for temperature',
          ],
          correct: 1,
          explanation: 'The pulse travels TO the object and returns. We only want ONE-way distance, so divide by 2.',
        },
        {
          id: 'us_q2',
          question: 'What is the measurement range of HC-SR04?',
          options: ['0–100cm', '2cm–400cm', '1cm–2m', '10cm–5m'],
          correct: 1,
          explanation: 'HC-SR04 reliably measures 2cm to 400cm (4 meters).',
        },
        {
          id: 'us_q3',
          question: 'How long should the TRIG pulse be?',
          options: ['1µs', '5µs', '10µs', '100µs'],
          correct: 2,
          explanation: 'The datasheet specifies a minimum 10 microsecond HIGH pulse on TRIG.',
        },
        {
          id: 'us_q4',
          question: 'Which Arduino function measures the duration of the ECHO pulse?',
          options: ['analogRead()', 'pulseIn()', 'timePulse()', 'measureEcho()'],
          correct: 1,
          explanation: 'pulseIn(pin, HIGH) waits for a HIGH pulse and returns its duration in microseconds.',
        },
        {
          id: 'us_q5',
          question: 'HC-SR04 operates at ultrasonic frequency of:',
          options: ['20 kHz', '40 kHz', '80 kHz', '440 Hz'],
          correct: 1,
          explanation: 'HC-SR04 emits at 40kHz, which is above human hearing (>20kHz).',
        },
      ],
    },
  },

  {
    id: 'servo',
    name: 'Servo Motor',
    fullName: 'SG90 Micro Servo Motor',
    icon: '⚙️',
    color: '#84cc16',
    category: 'Actuator',
    levelRequired: 4,
    xpReward: 90,
    coinReward: 18,
    description: 'Precisely position a shaft from 0° to 180° using PWM.',
    usedInProjects: ['servo-sweep', 'robotic-arm'],
    theory: {
      readTime: '5 min',
      sections: [
        {
          title: 'How Servo Motors Work',
          content: `A servo motor is a DC motor with built-in:
• Gearbox (reduces speed, increases torque)
• Position sensor (potentiometer)
• Control circuit (moves to target angle)

The SG90 micro servo rotates 180° and can hold a precise angle.
Torque: ~1.8kg/cm at 5V

Unlike regular DC motors, you specify an ANGLE, not a speed.`,
        },
        {
          title: 'Servo Wiring',
          content: `3-wire connector (color coded):
• Brown/Black → GND
• Red → 5V (use external power for multiple servos)
• Orange/Yellow/White → Signal (PWM pin)

Important: For 2+ servos, use an external 5V power supply. Drawing servo power from Arduino's 5V pin can cause resets.`,
        },
        {
          title: 'Arduino Servo Library',
          content: `  #include <Servo.h>
  Servo myServo;

  void setup() {
    myServo.attach(9); // PWM pin
  }

  void loop() {
    myServo.write(0);   // Move to 0°
    delay(1000);
    myServo.write(90);  // Move to 90°
    delay(1000);
    myServo.write(180); // Move to 180°
    delay(1000);
  }

Map analog input to servo angle:
  int angle = map(analogRead(A0), 0, 1023, 0, 180);
  myServo.write(angle);`,
        },
      ],
    },
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: 'srv_q1',
          question: 'What is the rotation range of a standard servo motor?',
          options: ['90°', '180°', '270°', '360°'],
          correct: 1,
          explanation: 'Standard hobby servos rotate 180°. Continuous rotation servos exist but are different.',
        },
        {
          id: 'srv_q2',
          question: 'What is the signal wire color on most servo motors?',
          options: ['Red', 'Black/Brown', 'Orange/Yellow/White', 'Blue'],
          correct: 2,
          explanation: 'Signal wire is Orange, Yellow, or White. Red = power, Brown/Black = GND.',
        },
        {
          id: 'srv_q3',
          question: 'myServo.write(90) does what?',
          options: ['Rotates 90° more', 'Moves to the 90° position', 'Sets speed to 90RPM', 'Writes 90 to memory'],
          correct: 1,
          explanation: 'write() sets the ABSOLUTE angle (0°–180°), not relative movement.',
        },
        {
          id: 'srv_q4',
          question: 'Why should multiple servos use external power?',
          options: [
            'They need higher voltage',
            'Arduino\'s 5V pin can\'t supply enough current',
            'Servos need AC power',
            'External power is faster',
          ],
          correct: 1,
          explanation: 'Arduino\'s onboard 5V regulator is limited to ~500mA. Multiple servos can draw more, causing resets.',
        },
        {
          id: 'srv_q5',
          question: 'Which library is used for servo control in Arduino?',
          options: ['<Motor.h>', '<PWM.h>', '<Servo.h>', '<Actuator.h>'],
          correct: 2,
          explanation: '#include <Servo.h> — built into Arduino IDE, no install needed.',
        },
      ],
    },
  },

  {
    id: 'lcd',
    name: 'LCD Display',
    fullName: 'I2C 16×2 LCD Display',
    icon: '🖥️',
    color: '#14b8a6',
    category: 'Output',
    levelRequired: 4,
    xpReward: 95,
    coinReward: 19,
    description: '16 columns × 2 rows character display over I2C (only 2 wires).',
    usedInProjects: ['lcd-display', 'weather-station'],
    theory: {
      readTime: '6 min',
      sections: [
        {
          title: 'Why I2C LCD?',
          content: `A raw 16×2 LCD needs 6–10 Arduino pins. The I2C backpack module reduces this to just 2 wires (SDA + SCL) using a PCF8574 I/O expander.

I2C uses only 2 wires regardless of how many devices are connected. Each device has a unique address (default 0x27 or 0x3F for LCD modules).`,
        },
        {
          title: 'Wiring I2C LCD',
          content: `4 pins on the I2C module:
• GND → GND
• VCC → 5V
• SDA → A4 (Arduino Uno) or SDA pin
• SCL → A5 (Arduino Uno) or SCL pin

I2C address: usually 0x27. If it doesn't work, try 0x3F.
Use I2C scanner sketch to find address.`,
        },
        {
          title: 'Using LiquidCrystal_I2C Library',
          content: `Install "LiquidCrystal I2C" by Frank de Brabander.

  #include <LiquidCrystal_I2C.h>
  LiquidCrystal_I2C lcd(0x27, 16, 2); // address, cols, rows

  void setup() {
    lcd.init();
    lcd.backlight();
    lcd.setCursor(0, 0); // column, row
    lcd.print("Hello Arduino!");
    lcd.setCursor(0, 1); // second row
    lcd.print("Line 2 here");
  }

  // Useful methods:
  // lcd.clear()          - clear screen
  // lcd.noBacklight()    - turn off backlight
  // lcd.setCursor(c, r)  - move cursor
  // lcd.print(value)     - print anything`,
        },
      ],
    },
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: 'lcd_q1',
          question: 'Why use an I2C backpack with an LCD?',
          options: [
            'Makes it brighter',
            'Reduces pin usage from ~10 to just 2 wires',
            'Adds color support',
            'Increases refresh rate',
          ],
          correct: 1,
          explanation: 'I2C backpack reduces connections from 6–10 pins to just SDA + SCL (2 wires).',
        },
        {
          id: 'lcd_q2',
          question: 'On Arduino Uno, which pins are SDA and SCL?',
          options: ['D2 and D3', 'A2 and A3', 'A4 and A5', 'D10 and D11'],
          correct: 2,
          explanation: 'Arduino Uno: SDA = A4, SCL = A5. (Also labeled on the board near the power pins.)',
        },
        {
          id: 'lcd_q3',
          question: 'lcd.setCursor(3, 1) positions the cursor at:',
          options: ['Column 1, Row 3', 'Column 3, Row 1 (second row)', 'Row 3, Column 1', 'Position 31'],
          correct: 1,
          explanation: 'setCursor(column, row). Column 3, Row 1 = 4th character on the 2nd line.',
        },
        {
          id: 'lcd_q4',
          question: 'Default I2C address for most LCD modules is:',
          options: ['0x21', '0x27', '0xFF', '0x80'],
          correct: 1,
          explanation: '0x27 is the most common. If it fails, try 0x3F. Use an I2C scanner to confirm.',
        },
        {
          id: 'lcd_q5',
          question: 'A "16×2 LCD" means:',
          options: [
            '16 pixels wide, 2 pixels tall',
            '16 columns of characters, 2 rows',
            '16×2 = 32 total pixels',
            '16-bit color, 2 brightness levels',
          ],
          correct: 1,
          explanation: '16 columns × 2 rows = 32 character positions. Each character is a 5×8 dot matrix.',
        },
      ],
    },
  },
]

// ─── Config helpers ───────────────────────────────────────────────────────────
export const COMPONENT_MAP = Object.fromEntries(COMPONENTS.map(c => [c.id, c]))

export const CATEGORIES = ['All', ...new Set(COMPONENTS.map(c => c.category))]

export function getUnlockedComponents(unlockedIds = []) {
  return COMPONENTS.filter(c => unlockedIds.includes(c.id))
}

export function getLockedComponents(unlockedIds = []) {
  return COMPONENTS.filter(c => !unlockedIds.includes(c.id))
}

export function canStartProject(project, unlockedIds = []) {
  if (!project.requiredComponents) return true
  return project.requiredComponents.every(id => unlockedIds.includes(id))
}

export function getMissingComponents(project, unlockedIds = []) {
  if (!project.requiredComponents) return []
  return project.requiredComponents
    .filter(id => !unlockedIds.includes(id))
    .map(id => COMPONENT_MAP[id])
    .filter(Boolean)
}