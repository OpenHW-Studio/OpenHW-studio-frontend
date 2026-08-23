export const COMPONENTS = [
  {
    id: 'led',
    name: 'LED',
    fullName: 'Light-Emitting Diode',
    icon: '/components_examples/LED.png',
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
    icon: '/components_examples/Resistor.png',
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
    icon: '/components_examples/6mm_Push_button.png',
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
    id: 'analog-joystick',
    name: 'Analog Joystick',
    fullName: '2-Axis Analog Joystick',
    icon: '/components_examples/Analog_JoyStick.png',
    color: '#f43f5e',
    category: 'Input',
    levelRequired: 3,
    xpReward: 70,
    coinReward: 15,
    description: 'Provides two analog outputs (X/Y) and one digital button output.',
    usedInProjects: ['game-controller', 'robot-arm'],
    theory: {
      readTime: '3 min',
      sections: [
        {
          title: 'What is an Analog Joystick?',
          content: `An analog joystick is essentially two potentiometers (one for the X-axis and one for the Y-axis) and a tactile push button combined into one module.\n\nMoving the stick changes the resistance of the potentiometers, which alters the voltage sent to the Arduino's analog pins. Pressing down on the stick activates the button.`,
        },
        {
          title: 'Reading the Joystick',
          content: `To read the joystick, you need to read two analog pins and one digital pin:\n\n1. Read the X-axis using analogRead(A0)\n2. Read the Y-axis using analogRead(A1)\n3. Read the button using digitalRead(2) (with INPUT_PULLUP enabled)\n\nThe analog readings will range from 0 to 1023, with the center position resting at approximately 512.`,
        }
      ],
    },
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: 'joy_q1',
          question: 'What is the resting value of the analog X/Y pins when the joystick is in the center?',
          options: ['0', '512', '1023', 'It fluctuates constantly'],
          correct: 1,
          explanation: 'Since the potentiometers act as voltage dividers between 5V and GND, the center position rests at half voltage, which is roughly 512 on the Arduino\'s 10-bit ADC.',
        },
        {
          id: 'joy_q2',
          question: 'How do you read the push button on the joystick?',
          options: ['Using analogRead()', 'Using digitalRead() with INPUT_PULLUP', 'Wait for an interrupt', 'Measure the resistance'],
          correct: 1,
          explanation: 'The push button simply connects the switch pin to ground. Using digitalRead() with the internal pull-up resistor keeps it HIGH normally, and goes LOW when pressed.',
        }
      ],
    },
  },

  {
    id: 'potentiometer',
    name: 'Potentiometer',
    fullName: 'Rotary Potentiometer',
    icon: '/components_examples/Rotary_Potentiometer.png',
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
    icon: '/components_examples/Buzzer.png',
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
    icon: '/components_examples/RBG_LED_4pin.png',
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
    icon: '/components_examples/DHT22.png',
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
    icon: '/components_examples/Ultrasonic_Sensor.png',
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
    icon: '/components_examples/Servo_Motor.png',
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
    icon: '/components_examples/LCD_16x2_I2C.png',
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
  
  // Registry-generated components (from emulator palette)
  {
    id: 'a4988',
    name: 'A4988',
    fullName: 'A4988',
    icon: '/components_examples/A4988_Stepper_Driver.png',
    color: '#f97316',
    category: 'Actuator',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: A4988.',
    usedInProjects: [],
  },

  {
    id: 'arduino-mega',
    name: 'Arduino Mega',
    fullName: 'Arduino Mega',
    icon: '/components_examples/MEGA.png',
    color: '#0ea5e9',
    category: 'Board',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Arduino Mega.',
    usedInProjects: [],
  },

  {
    id: 'arduino-nano',
    name: 'Arduino Nano',
    fullName: 'Arduino Nano',
    icon: '/components_examples/Nano.png',
    color: '#0ea5e9',
    category: 'Board',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Arduino Nano.',
    usedInProjects: [],
  },

  {
    id: 'arduino-uno',
    name: 'Arduino Uno',
    fullName: 'Arduino Uno',
    icon: '/components_examples/UNO.png',
    color: '#0ea5e9',
    category: 'Board',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Arduino Uno.',
    usedInProjects: [],
  },

  {
    id: 'battery',
    name: 'Battery',
    fullName: 'Battery',
    icon: '/components_examples/Li_ion_Battery.png',
    color: '#f59e0b',
    category: 'Power',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Battery.',
    usedInProjects: [],
  },

  {
    id: 'cd74hc4067',
    name: 'Cd74hc4067',
    fullName: 'Cd74hc4067',
    icon: '/components_examples/16_Channel_Mux_HP4067.png',
    color: '#3b82f6',
    category: 'Module',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Cd74hc4067.',
    usedInProjects: [],
  },

  {
    id: 'dht-22',
    name: 'DHT 22',
    fullName: 'DHT 22',
    icon: '/components_examples/DHT22.png',
    color: '#8b5cf6',
    category: 'Sensor',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: DHT 22.',
    usedInProjects: [],
  },

  {
    id: 'dht22',
    name: 'Dht22',
    fullName: 'Dht22',
    icon: '/components_examples/DHT22.png',
    color: '#8b5cf6',
    category: 'Sensor',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Dht22.',
    usedInProjects: [],
  },

  {
    id: 'diode',
    name: 'Diode',
    fullName: 'Diode',
    icon: '/components_examples/Diode.png',
    color: '#fb7185',
    category: 'Passive',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Diode.',
    usedInProjects: [],
  },

  {
    id: 'ds18b20',
    name: 'Ds18b20',
    fullName: 'Ds18b20',
    icon: '/components_examples/DS18B20_Temperature_Module.png',
    color: '#8b5cf6',
    category: 'Sensor',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Ds18b20.',
    usedInProjects: [],
  },

// ── ESP32 ────────────────────────────────────────────────────────────────────
  { id: 'esp32', name: 'ESP32 DevKit', category: 'Board', icon: '/components_examples/ESP32.png', color: '#e74c3c',
    difficulty: 'intermediate', wokwiType: 'wokwi-esp32-devkit-v1',
    description: 'A powerful WiFi+Bluetooth microcontroller with 38 GPIO pins. The go-to board for IoT projects.',
    tags: ['esp32', 'WiFi', 'Bluetooth', 'IoT', 'dual-core'],
    realWorldUses: ['Smart home devices', 'Weather stations', 'Remote sensors', 'BLE beacons'],
    funFact: 'The ESP32 has two CPU cores running at 240MHz — faster than most desktop PCs from the year 2000!',
    pinout: [
      { pin: 'GPIO 0-39', description: 'General purpose I/O (some input-only)' },
      { pin: '3V3', description: '3.3V power output' },
      { pin: 'VIN', description: '5V input (USB power)' },
      { pin: 'GND', description: 'Ground' },
    ],
    quiz: { totalQuestions: 3, questions: [
      { id: 'esp32_q1', question: 'What wireless protocols does the ESP32 support?', options: ['Only WiFi', 'Only Bluetooth', 'Both WiFi and Bluetooth', 'Neither'], correct: 2, explanation: 'The ESP32 has built-in 2.4GHz WiFi (802.11 b/g/n) AND Bluetooth 4.2/BLE — both on the same chip!' },
      { id: 'esp32_q2', question: 'What voltage do ESP32 GPIO pins operate at?', options: ['5V', '3.3V', '1.8V', '12V'], correct: 1, explanation: 'ESP32 GPIO pins are 3.3V logic. Connecting 5V signals directly can damage the chip — always use a level shifter with 5V sensors.' },
      { id: 'esp32_q3', question: 'How many CPU cores does the ESP32 have?', options: ['1', '2', '4', '8'], correct: 1, explanation: 'The ESP32 has a dual-core Xtensa LX6 processor. One core typically runs your code, the other handles WiFi/Bluetooth stack.' },
    ]},
  },

  { id: 'esp32-cam', name: 'ESP32-CAM', category: 'Board', icon: '/components_examples/ESP32_CAM.png', color: '#e74c3c',
    difficulty: 'advanced', wokwiType: 'wokwi-esp32-cam',
    description: 'An ESP32 with a built-in camera module. Stream live video over WiFi or use it for face detection.',
    tags: ['esp32', 'camera', 'WiFi', 'video streaming', 'OV2640'],
    realWorldUses: ['Security cameras', 'Baby monitors', 'Face recognition', 'Time-lapse photography'],
    funFact: 'The ESP32-CAM costs under $5 and can stream live MJPEG video over WiFi — the same technology used in security cameras!',
    pinout: [
      { pin: 'GPIO 0', description: 'Boot mode + camera timing signal' },
      { pin: 'GPIO 4', description: 'Flash LED (built-in)' },
      { pin: '5V', description: '5V power input (needs 500mA+)' },
      { pin: 'GND', description: 'Ground' },
    ],
    quiz: { totalQuestions: 3, questions: [
      { id: 'esp32cam_q1', question: 'What camera sensor does the ESP32-CAM use?', options: ['OV7670', 'OV2640', 'IMX219', 'HM01B0'], correct: 1, explanation: 'The OV2640 is a 2-megapixel sensor. It supports JPEG compression in hardware, so the ESP32 can stream video without running out of RAM.' },
      { id: 'esp32cam_q2', question: 'Why does the ESP32-CAM need a separate USB-TTL adapter to program it?', options: ['It has no USB port', 'Its USB is broken', 'WiFi is faster', 'It uses I2C programming'], correct: 0, explanation: 'Unlike regular ESP32 boards, the ESP32-CAM has no built-in USB-to-serial chip. You need a separate FTDI/CH340 adapter connected to its TX/RX pins.' },
      { id: 'esp32cam_q3', question: 'What does MJPEG streaming mean?', options: ['A single high-res photo', 'A series of JPEG frames sent continuously to simulate video', 'Compressed audio', 'Encrypted WiFi'], correct: 1, explanation: 'MJPEG (Motion JPEG) sends a rapid sequence of JPEG images. Each frame is independently compressed — simple and works on any browser.' },
    ]},
  },


  {
    id: 'ili9341',
    name: 'Ili9341',
    fullName: 'Ili9341',
    icon: '/components_examples/ILI9341_2.8_TFT_LCD.png',
    color: '#ef4444',
    category: 'Output',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Ili9341.',
    usedInProjects: [],
  },

  {
    id: 'ir-receiver',
    name: 'IR Receiver',
    fullName: 'IR Receiver',
    icon: '/components_examples/IR_Receiver.png',
    color: '#8b5cf6',
    category: 'Sensor',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: IR Receiver.',
    usedInProjects: [],
  },

  {
    id: 'l293d',
    name: 'L293d',
    fullName: 'L293d',
    icon: '/components_examples/Motor_Driver_L293D.png',
    color: '#f97316',
    category: 'Actuator',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: L293d.',
    usedInProjects: [],
  },

  {
    id: 'lcd1602',
    name: 'Lcd1602',
    fullName: 'Lcd1602',
    icon: '/components_examples/LCD_16x2_Parallel.png',
    color: '#ef4444',
    category: 'Output',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Lcd1602.',
    usedInProjects: [],
  },

  {
    id: 'lcd1602-i2c',
    name: 'Lcd1602 I2C',
    fullName: 'Lcd1602 I2C',
    icon: '/components_examples/LCD_16x2_I2C.png',
    color: '#ef4444',
    category: 'Output',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Lcd1602 I2C.',
    usedInProjects: [],
  },

  {
    id: 'lcd2004-i2c',
    name: 'Lcd2004 I2C',
    fullName: 'Lcd2004 I2C',
    icon: '/components_examples/LCD_16x2_I2C.png',
    color: '#ef4444',
    category: 'Output',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Lcd2004 I2C.',
    usedInProjects: [],
  },

  {
    id: 'logic-analyzer',
    name: 'Logic Analyzer',
    fullName: 'Logic Analyzer',
    icon: '/components_examples/8_ch_logic_Analyzer.png',
    color: '#0f766e',
    category: 'Logic',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Logic Analyzer.',
    usedInProjects: [],
  },

  {
    id: 'logic-clock-generator',
    name: 'Logic Clock Generator',
    fullName: 'Logic Clock Generator',
    icon: '/components_examples/Clock.png',
    color: '#0f766e',
    category: 'Logic',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Logic Clock Generator.',
    usedInProjects: [],
  },

  {
    id: 'logic-d-flipflop',
    name: 'Logic D Flipflop',
    fullName: 'Logic D Flipflop',
    icon: '/components_examples/D_Flip_Flop.png',
    color: '#0f766e',
    category: 'Logic',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Logic D Flipflop.',
    usedInProjects: [],
  },

  {
    id: 'logic-d-flipflop-dsr',
    name: 'Logic D Flipflop Dsr',
    fullName: 'Logic D Flipflop Dsr',
    icon: '/components_examples/D_Flip_Flop_set_Reset.png',
    color: '#0f766e',
    category: 'Logic',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Logic D Flipflop Dsr.',
    usedInProjects: [],
  },

  {
    id: 'logic-d-flipflop-r',
    name: 'Logic D Flipflop R',
    fullName: 'Logic D Flipflop R',
    icon: '/components_examples/D_Flip_Flop_reset.png',
    color: '#0f766e',
    category: 'Logic',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Logic D Flipflop R.',
    usedInProjects: [],
  },

  {
    id: 'logic-ic-74xx',
    name: 'Logic IC 74xx',
    fullName: 'Logic IC 74xx',
    icon: '/components_examples/Logic_IC.png',
    color: '#0f766e',
    category: 'Logic',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Logic IC 74xx.',
    usedInProjects: [],
  },

  {
    id: 'logic-mux-2to1',
    name: 'Logic Mux 2to1',
    fullName: 'Logic Mux 2to1',
    icon: '/components_examples/MUX_2:1.png',
    color: '#0f766e',
    category: 'Logic',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Logic Mux 2to1.',
    usedInProjects: [],
  },

  {
    id: 'max7219',
    name: 'Max7219',
    fullName: 'Max7219',
    icon: '/components_examples/MAX7219_Dot_Matrix.png',
    color: '#ef4444',
    category: 'Output',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Max7219.',
    usedInProjects: [],
  },

  {
    id: 'membrane-keypad',
    name: 'Membrane Keypad',
    fullName: 'Membrane Keypad',
    icon: '/components_examples/Membrane_Keypad.png',
    color: '#22c55e',
    category: 'Input',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Membrane Keypad.',
    usedInProjects: [],
  },

  {
    id: 'mfrc522',
    name: 'Mfrc522',
    fullName: 'Mfrc522',
    icon: '/components_examples/MFRC5522_RFID_Reader.png',
    color: '#8b5cf6',
    category: 'Sensor',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Mfrc522.',
    usedInProjects: [],
  },

  {
    id: 'motor',
    name: 'Motor',
    fullName: 'Motor',
    icon: '/components_examples/DC_Motor.png',
    color: '#f97316',
    category: 'Actuator',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Motor.',
    usedInProjects: [],
  },

  {
    id: 'motor-driver',
    name: 'Motor Driver',
    fullName: 'Motor Driver',
    icon: '/components_examples/L298N_Motor_Driver.png',
    color: '#f97316',
    category: 'Actuator',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Motor Driver.',
    usedInProjects: [],
  },

  {
    id: 'mq-2 gas sensor',
    name: 'MQ 2 gas sensor',
    fullName: 'MQ 2 gas sensor',
    icon: '/components_examples/MQ2_Gas_Sensor.png',
    color: '#8b5cf6',
    category: 'Sensor',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: MQ 2 gas sensor.',
    usedInProjects: [],
  },

  {
    id: 'mq2-gas-sensor',
    name: 'Mq2 Gas Sensor',
    fullName: 'Mq2 Gas Sensor',
    icon: '/components_examples/MQ2_Gas_Sensor.png',
    color: '#8b5cf6',
    category: 'Sensor',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Mq2 Gas Sensor.',
    usedInProjects: [],
  },

  {
    id: 'neopixel-matrix',
    name: 'Neopixel Matrix',
    fullName: 'Neopixel Matrix',
    icon: '/components_examples/MAX7219_Dot_Matrix.png',
    color: '#f97316',
    category: 'Actuator',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Neopixel Matrix.',
    usedInProjects: [],
  },

  {
    id: 'neopixel-ring',
    name: 'Neopixel Ring',
    fullName: 'Neopixel Ring',
    icon: '/components_examples/NeoPixel_Ring.png',
    color: '#f97316',
    category: 'Actuator',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Neopixel Ring.',
    usedInProjects: [],
  },

  {
    id: 'nokia-5110',
    name: 'Nokia 5110',
    fullName: 'Nokia 5110',
    icon: '/components_examples/Nokia_5510_Screen.png',
    color: '#ef4444',
    category: 'Output',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Nokia 5110.',
    usedInProjects: [],
  },

  {
    id: 'npn-transistor',
    name: 'Npn Transistor',
    fullName: 'Npn Transistor',
    icon: '/components_examples/NPN_Transistor.png',
    color: '#fb7185',
    category: 'Passive',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Npn Transistor.',
    usedInProjects: [],
  },

  {
    id: 'pca9685',
    name: 'Pca9685',
    fullName: 'Pca9685',
    icon: '/components_examples/Servo_Pi_hat.png',
    color: '#3b82f6',
    category: 'Module',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Pca9685.',
    usedInProjects: [],
  },

  {
    id: 'pca9865',
    name: 'Pca9865',
    fullName: 'Pca9865',
    icon: '/components_examples/Servo_Pi_hat.png',
    color: '#3b82f6',
    category: 'Module',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Pca9865.',
    usedInProjects: [],
  },

  {
    id: 'photodiode',
    name: 'Photodiode',
    fullName: 'Photodiode',
    icon: '/components_examples/Photodiode.png',
    color: '#8b5cf6',
    category: 'Sensor',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Photodiode.',
    usedInProjects: [],
  },

  {
    id: 'pico',
    name: 'Pico',
    fullName: 'Pico',
    icon: '/components_examples/PI Pico.png',
    color: '#0ea5e9',
    category: 'Board',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Pico.',
    usedInProjects: [],
  },

  {
    id: 'pico-w',
    name: 'Pico W',
    fullName: 'Pico W',
    icon: '/components_examples/PI Pico w.png',
    color: '#0ea5e9',
    category: 'Board',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Pico W.',
    usedInProjects: [],
  },

  {
    id: 'pir-motion-sensor',
    name: 'PIR Motion Sensor',
    fullName: 'PIR Motion Sensor',
    icon: '/components_examples/PIR_Motion_Sensor.png',
    color: '#8b5cf6',
    category: 'Sensor',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: PIR Motion Sensor.',
    usedInProjects: [],
  },

  {
    id: 'power-supply',
    name: 'Power Supply',
    fullName: 'Power Supply',
    icon: '/components_examples/Power_Supply.png',
    color: '#f59e0b',
    category: 'Power',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Power Supply.',
    usedInProjects: [],
  },

  {
    id: 'pushbutton',
    name: 'Pushbutton',
    fullName: 'Pushbutton',
    icon: '/components_examples/Push_button.png',
    color: '#22c55e',
    category: 'Input',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Pushbutton.',
    usedInProjects: [],
  },

  {
    id: 'raindrop-module',
    name: 'Raindrop Module',
    fullName: 'Raindrop Module',
    icon: '/components_examples/Raindrop_Module.png',
    color: '#8b5cf6',
    category: 'Sensor',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Raindrop Module.',
    usedInProjects: [],
  },

  {
    id: 'raindrop-pad',
    name: 'Raindrop Pad',
    fullName: 'Raindrop Pad',
    icon: '/components_examples/Raindrop_Pad.png',
    color: '#8b5cf6',
    category: 'Sensor',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Raindrop Pad.',
    usedInProjects: [],
  },

  {
    id: 'raspberry-pi-pico',
    name: 'Raspberry Pi Pico',
    fullName: 'Raspberry Pi Pico',
    icon: '/components_examples/PI Pico.png',
    color: '#0ea5e9',
    category: 'Board',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Raspberry Pi Pico.',
    usedInProjects: [],
  },

  {
    id: 'raspberry-pi-pico-w',
    name: 'Raspberry Pi Pico W',
    fullName: 'Raspberry Pi Pico W',
    icon: '/components_examples/PI Pico w.png',
    color: '#0ea5e9',
    category: 'Board',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Raspberry Pi Pico W.',
    usedInProjects: [],
  },

  {
    id: 'rotary-encoder',
    name: 'Rotary Encoder',
    fullName: 'Rotary Encoder',
    icon: '/components_examples/Rotary_Encoder.png',
    color: '#22c55e',
    category: 'Input',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Rotary Encoder.',
    usedInProjects: [],
  },

  {
    id: 'sd-card',
    name: 'SD Card',
    fullName: 'SD Card',
    icon: '/components_examples/MicroSD_Card.png',
    color: '#3b82f6',
    category: 'Module',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: SD Card.',
    usedInProjects: [],
  },

  {
    id: 'shift_register',
    name: 'Shift Register',
    fullName: 'Shift Register',
    icon: '/components_examples/74HC595_Shift_Register.png',
    color: '#3b82f6',
    category: 'Module',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Shift Register.',
    usedInProjects: [],
  },

  {
    id: 'simulation-monitor',
    name: 'Simulation Monitor',
    fullName: 'Simulation Monitor',
    icon: '/components_examples/Simulation Monitor.png',
    color: '#0f766e',
    category: 'Logic',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Simulation Monitor.',
    usedInProjects: [],
  },

  {
    id: 'slide-potentiometer',
    name: 'Slide Potentiometer',
    fullName: 'Slide Potentiometer',
    icon: '/components_examples/Linear_Potentiometer.png',
    color: '#22c55e',
    category: 'Input',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Slide Potentiometer.',
    usedInProjects: [],
  },

  {
    id: 'soil-moisture-sensor',
    name: 'Soil Moisture Sensor',
    fullName: 'Soil Moisture Sensor',
    icon: '/components_examples/Soil_Moisture.png',
    color: '#8b5cf6',
    category: 'Sensor',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Soil Moisture Sensor.',
    usedInProjects: [],
  },

  {
    id: 'sph0645',
    name: 'Sph0645',
    fullName: 'Sph0645',
    icon: '/components_examples/I2S_Mems_MicroPhone_SPH0645.png',
    color: '#8b5cf6',
    category: 'Sensor',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Sph0645.',
    usedInProjects: [],
  },

  {
    id: 'ssd1306',
    name: 'Ssd1306',
    fullName: 'Ssd1306',
    icon: '/components_examples/SSD1306_Oled_128x64.png',
    color: '#ef4444',
    category: 'Output',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Ssd1306.',
    usedInProjects: [],
  },

  {
    id: 'stepper-motor',
    name: 'Stepper Motor',
    fullName: 'Stepper Motor',
    icon: '/components_examples/Stepper_Motor_Bipolar.png',
    color: '#f97316',
    category: 'Actuator',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Stepper Motor.',
    usedInProjects: [],
  },

  {
    id: 'tm1637-7segment',
    name: 'Tm1637 7segment',
    fullName: 'Tm1637 7segment',
    icon: '/components_examples/Seven_Segment_Display_TM1637.png',
    color: '#ef4444',
    category: 'Output',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Tm1637 7segment.',
    usedInProjects: [],
  },

  {
    id: 'ws2812b',
    name: 'Ws2812b',
    fullName: 'Ws2812b',
    icon: '/components_examples/WS2812B_RGB_LED.png',
    color: '#f97316',
    category: 'Actuator',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Ws2812b.',
    usedInProjects: [],
  },

  {
    id: 'ws2821b',
    name: 'Ws2821b',
    fullName: 'Ws2821b',
    icon: '/components_examples/WS2812B_RGB_LED.png',
    color: '#f97316',
    category: 'Actuator',
    levelRequired: 1,
    xpReward: 10,
    coinReward: 5,
    description: 'Simulator component from OpenHW emulator: Ws2821b.',
    usedInProjects: [],
  },

  // ── Raspberry Pi Pico ────────────────────────────────────────────────────────
  { id: 'pico', name: 'Raspberry Pi Pico', category: 'Board', icon: '/components_examples/PI Pico.png', color: '#a855f7',
    difficulty: 'intermediate', wokwiType: 'wokwi-raspberry-pi-pico',
    description: 'A dual-core microcontroller board from Raspberry Pi, programmable in MicroPython or C/C++.',
    tags: ['pico', 'RP2040', 'MicroPython', 'microcontroller'],
    realWorldUses: ['IoT projects', 'Education', 'Wearables', 'Robotics'],
    funFact: 'The Pico uses the RP2040 chip designed by Raspberry Pi — their first custom silicon!',
    pinout: [{ pin: 'GPIO 0-28', description: 'General purpose I/O pins' }, { pin: '3V3', description: '3.3V power out' }, { pin: 'VSYS', description: 'Input voltage (1.8V-5.5V)' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'pico_q1', question: 'What language is commonly used to program the Raspberry Pi Pico?', options: ['Java', 'MicroPython or C/C++', 'JavaScript', 'Swift'], correct: 1, explanation: 'The Pico supports MicroPython and C/C++ officially, plus Arduino IDE with a community core.' },
      { id: 'pico_q2', question: 'What chip does the Raspberry Pi Pico use?', options: ['ESP8266', 'ATmega328P', 'RP2040', 'STM32'], correct: 2, explanation: 'The RP2040 is a dual-core ARM Cortex-M0+ chip designed by Raspberry Pi themselves.' },
      { id: 'pico_q3', question: 'How many GPIO pins does the Pico have?', options: ['14', '26', '40', '54'], correct: 1, explanation: 'The Pico has 26 GPIO pins, with many supporting PWM, I2C, SPI, and UART.' },
    ]},
  },
  { id: 'pico-w', name: 'Raspberry Pi Pico W', category: 'Board', icon: '/components_examples/PI Pico w.png', color: '#a855f7',
    difficulty: 'intermediate', wokwiType: 'wokwi-raspberry-pi-pico-w',
    description: 'The Pico with built-in WiFi and Bluetooth for wireless IoT projects.',
    tags: ['pico', 'WiFi', 'Bluetooth', 'RP2040', 'IoT'],
    realWorldUses: ['WiFi sensors', 'Web servers', 'Smart home', 'IoT dashboards'],
    funFact: 'The Pico W uses a CYW43439 chip for WiFi — the same chip used in many laptops!',
    pinout: [{ pin: 'GPIO 0-28', description: 'General purpose I/O' }, { pin: 'WL_GPIO0', description: 'WiFi LED indicator' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'picow_q1', question: 'What extra feature does the Pico W have over the standard Pico?', options: ['More GPIO pins', 'Built-in WiFi and Bluetooth', 'Faster processor', 'More RAM'], correct: 1, explanation: 'The W variant adds WiFi 802.11n and Bluetooth 5.2 via the CYW43439 chip.' },
      { id: 'picow_q2', question: 'What protocol does the Pico W use for WiFi?', options: ['Zigbee', '802.11n (2.4GHz)', '5G', 'LoRa'], correct: 1, explanation: 'The Pico W supports 802.11n single-band 2.4GHz WiFi.' },
      { id: 'picow_q3', question: 'Can the Pico W run a web server?', options: ['No', 'Yes, using MicroPython socket library', 'Only with shields', 'Only with cloud services'], correct: 1, explanation: 'Yes! MicroPython on Pico W can run a simple HTTP web server using the socket library.' },
    ]},
  },
  // ── ESP32 ────────────────────────────────────────────────────────────────────
  { id: 'esp32', name: 'ESP32 DevKit', category: 'Board', icon: '/components_examples/ESP32.png', color: '#e74c3c',
    difficulty: 'intermediate', wokwiType: 'wokwi-esp32-devkit-v1',
    description: 'A powerful dual-core microcontroller with built-in WiFi and Bluetooth — the go-to board for IoT projects.',
    tags: ['esp32', 'WiFi', 'Bluetooth', 'dual-core', 'IoT'],
    realWorldUses: ['Smart home', 'Web servers', 'MQTT IoT', 'BLE devices'],
    funFact: 'The ESP32 has two cores running at 240MHz — more computing power than early desktop computers!',
    pinout: [{ pin: 'GPIO 0-39', description: '34 programmable GPIO pins' }, { pin: '3V3', description: '3.3V regulated output' }, { pin: 'EN', description: 'Reset/enable pin' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'esp32_q1', question: 'What wireless protocols does the ESP32 support?', options: ['Only WiFi', 'Only Bluetooth', 'Both WiFi and Bluetooth', 'Zigbee only'], correct: 2, explanation: 'ESP32 has both WiFi (802.11 b/g/n) and Bluetooth (Classic + BLE 4.2) built in.' },
      { id: 'esp32_q2', question: 'How many cores does the ESP32 processor have?', options: ['1', '2', '4', '8'], correct: 1, explanation: 'ESP32 has dual Xtensa LX6 cores running at up to 240MHz — great for multitasking.' },
      { id: 'esp32_q3', question: 'At what voltage does the ESP32 operate?', options: ['5V', '3.3V', '1.8V', '12V'], correct: 1, explanation: 'ESP32 is a 3.3V device. Using 5V logic directly on its pins can damage it!' },
    ]},
  },
  { id: 'esp32-cam', name: 'ESP32-CAM', category: 'Board', icon: '/components_examples/ESP32_CAM.png', color: '#e74c3c',
    difficulty: 'advanced', wokwiType: 'wokwi-esp32-cam',
    description: 'An ESP32 with an OV2640 camera module — stream video over WiFi and do face recognition.',
    tags: ['esp32', 'camera', 'WiFi', 'OV2640', 'video'],
    realWorldUses: ['Security cameras', 'Face recognition', 'QR scanning', 'Time-lapse'],
    funFact: 'The ESP32-CAM can do face recognition using only its built-in hardware — no external AI chip needed!',
    pinout: [{ pin: 'GPIO 0', description: 'Boot mode / Flash button' }, { pin: 'GPIO 4', description: 'Built-in flash LED' }, { pin: 'GPIO 33', description: 'Red status LED' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'esp32cam_q1', question: 'What camera module does the ESP32-CAM typically use?', options: ['Raspberry Pi Camera', 'OV2640', 'USB webcam', 'GoPro'], correct: 1, explanation: 'The OV2640 is a 2MP camera that can capture JPEG images and video at various resolutions.' },
      { id: 'esp32cam_q2', question: 'What is unique about the ESP32-CAM compared to regular ESP32?', options: ['More RAM', 'Built-in camera + SD card slot', 'Faster WiFi', 'More GPIO pins'], correct: 1, explanation: 'It includes an OV2640 camera connector, an SD card slot for storage, and built-in flash LED.' },
      { id: 'esp32cam_q3', question: 'How do you program the ESP32-CAM?', options: ['USB-C directly', 'Via USB-to-serial adapter with GPIO 0 grounded', 'Bluetooth OTA only', 'Via SD card only'], correct: 1, explanation: 'ESP32-CAM has no USB port. Connect GPIO 0 to GND and use a USB-to-serial adapter (CH340/FTDI) to flash.' },
    ]},
  },
  // ── Sensors ──────────────────────────────────────────────────────────────────
  { id: 'pir-motion-sensor', name: 'PIR Motion Sensor', category: 'Sensor', icon: '/components_examples/PIR_Motion_Sensor.png', color: '#f59e0b',
    difficulty: 'beginner', wokwiType: 'wokwi-pir-motion-sensor',
    description: 'Detects human movement by sensing infrared heat changes. Used in security systems and automatic lights.',
    tags: ['PIR', 'motion', 'infrared', 'HC-SR501'],
    realWorldUses: ['Security alarms', 'Auto lights', 'Intruder detection', 'Smart switches'],
    funFact: 'PIR stands for Passive Infrared — it detects the difference in infrared heat between you and the background!',
    pinout: [{ pin: 'VCC', description: '5V-12V power' }, { pin: 'GND', description: 'Ground' }, { pin: 'OUT', description: 'HIGH when motion detected, LOW otherwise' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'pir_q1', question: 'What does PIR stand for?', options: ['Programmable Infrared', 'Passive Infrared', 'Photoelectric Infrared Relay', 'Pulsed IR'], correct: 1, explanation: 'PIR = Passive Infrared. It passively detects IR radiation from warm bodies without emitting any signal.' },
      { id: 'pir_q2', question: 'What does the PIR sensor output when motion is detected?', options: ['Analog voltage', 'HIGH digital signal', 'PWM signal', 'I2C data'], correct: 1, explanation: 'PIR output goes HIGH (usually 3.3V or 5V) when motion is detected and stays HIGH for an adjustable duration.' },
      { id: 'pir_q3', question: 'How do you adjust sensitivity on a PIR sensor?', options: ['Code only', 'Two onboard potentiometers for sensitivity and time delay', 'Fixed, cannot adjust', 'Via I2C commands'], correct: 1, explanation: 'Most HC-SR501 PIR sensors have two potentiometers: one for detection range (sensitivity) and one for output duration.' },
    ]},
  },
  { id: 'ir-receiver', name: 'IR Receiver', category: 'Sensor', icon: '/components_examples/IR_Receiver.png', color: '#dc2626',
    difficulty: 'beginner', wokwiType: 'wokwi-ir-receiver',
    description: 'Receives infrared signals from TV remotes and other IR transmitters. Decode remote control commands!',
    tags: ['infrared', 'IR', 'remote', 'receiver', 'NEC protocol'],
    realWorldUses: ['TV remote control', 'Device control', 'Home automation', 'Robot control'],
    funFact: 'Most TV remotes use the NEC protocol — a pattern of 38kHz pulses that encode button codes!',
    pinout: [{ pin: 'VCC', description: '3.3V-5V power' }, { pin: 'GND', description: 'Ground' }, { pin: 'OUT', description: 'Signal output to Arduino' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'ir_q1', question: 'What frequency do most IR remotes modulate at?', options: ['10kHz', '38kHz', '100kHz', '2.4GHz'], correct: 1, explanation: '38kHz is the standard carrier frequency for IR remote controls, including the NEC and RC5 protocols.' },
      { id: 'ir_q2', question: 'Which Arduino library is commonly used to decode IR signals?', options: ['Wire.h', 'IRremote.h', 'SPI.h', 'Servo.h'], correct: 1, explanation: 'The IRremote library by Ken Shirriff decodes NEC, Sony, RC5, and many other IR protocols.' },
      { id: 'ir_q3', question: 'What is the IRremote library function to receive a code?', options: ['IR.read()', 'irrecv.decode(&results)', 'analogRead(IR_PIN)', 'Serial.read()'], correct: 1, explanation: 'irrecv.decode(&results) returns true when a complete IR code has been received, with the value in results.value.' },
    ]},
  },
  { id: 'mfrc522', name: 'RFID Reader (MFRC522)', category: 'Sensor', icon: '/components_examples/MFRC5522_RFID_Reader.png', color: '#6366f1',
    difficulty: 'intermediate', wokwiType: 'wokwi-mfrc522',
    description: 'Read and write RFID cards and key fobs. Used in access control, attendance systems, and smart lockers.',
    tags: ['RFID', 'MFRC522', 'NFC', 'SPI', 'card'],
    realWorldUses: ['Door access control', 'Student attendance', 'Smart lockers', 'Payments'],
    funFact: 'The MFRC522 operates at 13.56MHz — the same frequency as contactless credit cards!',
    pinout: [{ pin: 'SDA/NSS', description: 'SPI chip select' }, { pin: 'SCK', description: 'SPI clock' }, { pin: 'MOSI', description: 'SPI data in' }, { pin: 'MISO', description: 'SPI data out' }, { pin: 'RST', description: 'Reset pin' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'rfid_q1', question: 'What frequency does the MFRC522 RFID reader operate at?', options: ['125kHz', '13.56MHz', '2.4GHz', '433MHz'], correct: 1, explanation: '13.56MHz is the HF RFID frequency used by Mifare cards, NFC cards, and contactless payments.' },
      { id: 'rfid_q2', question: 'What communication protocol does the MFRC522 use with Arduino?', options: ['I2C', 'UART', 'SPI', 'OneWire'], correct: 2, explanation: 'The MFRC522 uses SPI (MOSI, MISO, SCK, SS) for fast data transfer with Arduino.' },
      { id: 'rfid_q3', question: 'Each RFID card has a unique identifier called:', options: ['MAC address', 'UID (Unique ID)', 'Serial number', 'IP address'], correct: 1, explanation: 'Every Mifare/NFC card has a factory-set UID (4 or 7 bytes) that you read to identify the card.' },
    ]},
  },
  { id: 'ds18b20', name: 'DS18B20 Temperature Sensor', category: 'Sensor', icon: '/components_examples/DS18B20_Temperature_Module.png', color: '#ef4444',
    difficulty: 'beginner', wokwiType: 'wokwi-ds18b20',
    description: 'A waterproof digital temperature sensor using the OneWire protocol. Chain multiple sensors on one wire!',
    tags: ['DS18B20', 'temperature', 'OneWire', 'waterproof'],
    realWorldUses: ['Water temperature', 'Weather stations', 'Food safety', 'Aquariums'],
    funFact: 'You can connect up to 127 DS18B20 sensors on a single wire — each has a unique 64-bit address!',
    pinout: [{ pin: 'VDD', description: '3.0V-5.5V power' }, { pin: 'GND', description: 'Ground' }, { pin: 'DQ', description: 'OneWire data (needs 4.7k pull-up)' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'ds18_q1', question: 'What protocol does the DS18B20 use?', options: ['I2C', 'SPI', 'OneWire', 'UART'], correct: 2, explanation: 'The DS18B20 uses the 1-Wire protocol — one data wire handles both power and communication.' },
      { id: 'ds18_q2', question: 'What pull-up resistor does the DS18B20 data line need?', options: ['220 ohm', '1k ohm', '4.7k ohm', '10k ohm'], correct: 2, explanation: 'A 4.7k ohm pull-up resistor on DQ to VDD is required for proper OneWire communication.' },
      { id: 'ds18_q3', question: 'What is the temperature accuracy of the DS18B20?', options: ['+/-5°C', '+/-2°C', '+/-0.5°C', '+/-0.1°C'], correct: 2, explanation: 'The DS18B20 is accurate to +/-0.5°C in the range of -10°C to +85°C.' },
    ]},
  },
  { id: 'mq2-gas-sensor', name: 'MQ-2 Gas Sensor', category: 'Sensor', icon: '/components_examples/MQ2_Gas_Sensor.png', color: '#f59e0b',
    difficulty: 'beginner', wokwiType: 'wokwi-mq2-gas-sensor',
    description: 'Detects flammable gases (LPG, propane, methane) and smoke. Used in gas leak alarms and air quality monitors.',
    tags: ['MQ2', 'gas', 'smoke', 'LPG', 'analog'],
    realWorldUses: ['Gas leak alarm', 'Smoke detector', 'Air quality', 'Safety systems'],
    funFact: 'The MQ-2 sensor heats a tin oxide element — gas molecules change its resistance, which is read as a voltage!',
    pinout: [{ pin: 'VCC', description: '5V power (heater needs power)' }, { pin: 'GND', description: 'Ground' }, { pin: 'AOUT', description: 'Analog output (gas concentration)' }, { pin: 'DOUT', description: 'Digital output (threshold exceeded)' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'mq2_q1', question: 'What gases can the MQ-2 sensor detect?', options: ['Oxygen and nitrogen', 'LPG, propane, methane, and smoke', 'Only carbon dioxide', 'Water vapor only'], correct: 1, explanation: 'MQ-2 detects flammable gases like LPG, propane, methane, hydrogen, and also smoke particles.' },
      { id: 'mq2_q2', question: 'Why does the MQ-2 need a warm-up time of 20-30 seconds?', options: ['To calibrate the screen', 'Its heating element needs to reach operating temperature', 'To connect to WiFi', 'To charge its battery'], correct: 1, explanation: 'MQ-type sensors use a heated metal oxide element. It must reach ~300°C before readings are stable.' },
      { id: 'mq2_q3', question: 'How does the MQ-2 measure gas concentration?', options: ['By counting molecules', 'Gas changes the resistance of a metal oxide, read as voltage', 'Optical laser scanning', 'Sound waves'], correct: 1, explanation: 'Gas molecules adsorb onto the SnO2 surface, reducing its resistance. Lower resistance = higher voltage = more gas.' },
    ]},
  },
  { id: 'bmp180', name: 'BMP180 Pressure Sensor', category: 'Sensor', icon: '/components_examples/BMP180_Pressure_Sensor_Breakout.png', color: '#3b82f6',
    difficulty: 'intermediate', wokwiType: 'wokwi-bmp180',
    description: 'Measures atmospheric pressure and temperature. Calculate altitude from pressure changes!',
    tags: ['BMP180', 'pressure', 'altitude', 'I2C', 'weather'],
    realWorldUses: ['Weather stations', 'Altitude measurement', 'Drones', 'GPS altitude assist'],
    funFact: 'Atmospheric pressure drops ~12 Pa for every 1 meter of altitude gain — the BMP180 can detect you climbing stairs!',
    pinout: [{ pin: 'VCC', description: '1.8V-3.6V (use 3.3V)' }, { pin: 'GND', description: 'Ground' }, { pin: 'SDA', description: 'I2C data — A4' }, { pin: 'SCL', description: 'I2C clock — A5' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'bmp_q1', question: 'What does the BMP180 measure?', options: ['Humidity only', 'Atmospheric pressure and temperature', 'CO2 levels', 'UV radiation'], correct: 1, explanation: 'BMP180 measures barometric pressure (hPa) and temperature (°C). Pressure data lets you calculate altitude.' },
      { id: 'bmp_q2', question: 'What protocol does BMP180 use?', options: ['SPI', 'OneWire', 'I2C', 'UART'], correct: 2, explanation: 'BMP180 uses I2C with address 0x77. Connect SDA to A4 and SCL to A5 on Arduino Uno.' },
      { id: 'bmp_q3', question: 'What voltage does the BMP180 require?', options: ['5V', '3.3V (NOT 5V tolerant!)', '12V', '1.2V'], correct: 1, explanation: 'BMP180 is a 3.3V device — applying 5V directly can damage it! Always use a level shifter with Arduino.' },
    ]},
  },
  { id: 'soil-moisture-sensor', name: 'Soil Moisture Sensor', category: 'Sensor', icon: '/components_examples/Soil_Moisture.png', color: '#22c55e',
    difficulty: 'beginner', wokwiType: 'wokwi-soil-moisture-sensor',
    description: 'Measures soil moisture level by conductivity between two probes. Perfect for automatic plant watering systems!',
    tags: ['soil', 'moisture', 'plants', 'analog', 'garden'],
    realWorldUses: ['Auto plant watering', 'Greenhouse monitoring', 'Agriculture', 'Science projects'],
    funFact: 'Wet soil conducts electricity better than dry soil — the sensor measures this conductivity to determine moisture!',
    pinout: [{ pin: 'VCC', description: '3.3V-5V power' }, { pin: 'GND', description: 'Ground' }, { pin: 'AOUT', description: 'Analog output (0=wet, 1023=dry)' }, { pin: 'DOUT', description: 'Digital threshold output' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'soil_q1', question: 'How does a soil moisture sensor measure moisture?', options: ['By weighing the soil', 'By measuring electrical conductivity between probes', 'Using infrared light', 'Via capacitance only'], correct: 1, explanation: 'Water in soil enables current flow between the two probes. More moisture = lower resistance = lower analog reading.' },
      { id: 'soil_q2', question: 'What analog reading typically means DRY soil?', options: ['0 (low)', '512 (mid)', '1023 (high)', 'Negative value'], correct: 2, explanation: 'Dry soil is a poor conductor — high resistance means less current, giving a HIGH analog reading (near 1023).' },
      { id: 'soil_q3', question: 'Why should you not leave the sensor powered constantly in soil?', options: ['It heats up', 'Electrolysis corrodes the probes over time', 'It drains battery too fast', 'It gives wrong readings when powered'], correct: 1, explanation: 'Constant current through the probes causes electrolysis, corroding them. Power the sensor only when reading!' },
    ]},
  },
  { id: 'raindrop-module', name: 'Raindrop Sensor', category: 'Sensor', icon: '/components_examples/Raindrop_Module.png', color: '#3b82f6',
    difficulty: 'beginner', wokwiType: 'wokwi-raindrop-module',
    description: 'Detects raindrops or water on its surface using conductivity. Trigger actions when it starts raining!',
    tags: ['rain', 'water', 'moisture', 'analog', 'weather'],
    realWorldUses: ['Auto car wipers', 'Smart windows', 'Weather stations', 'Plant watering'],
    funFact: 'The raindrop sensor works exactly like the soil moisture sensor — water bridges two copper traces and changes resistance!',
    pinout: [{ pin: 'VCC', description: '3.3V-5V power' }, { pin: 'GND', description: 'Ground' }, { pin: 'AOUT', description: 'Analog output' }, { pin: 'DOUT', description: 'Digital output (wet/dry)' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'rain_q1', question: 'How does the raindrop sensor detect water?', options: ['Optical sensor', 'Water bridges conductive traces changing resistance', 'Weight sensor', 'Ultrasonic'], correct: 1, explanation: 'Water on the PCB bridges the copper traces, reducing resistance — this is read as a low analog value.' },
      { id: 'rain_q2', question: 'The digital output (DOUT) of the raindrop sensor goes LOW when:', options: ['It is dry', 'Water is detected (threshold exceeded)', 'Power is applied', 'It is calibrated'], correct: 1, explanation: 'Most rain sensor modules output LOW on DOUT when the moisture threshold (set by potentiometer) is exceeded.' },
      { id: 'rain_q3', question: 'What adjustment is available on most raindrop sensor modules?', options: ['Sensitivity potentiometer', 'Color filter', 'Temperature compensation', 'Nothing'], correct: 0, explanation: 'A potentiometer on the module sets the threshold for the digital output — turn it to adjust rain sensitivity.' },
    ]},
  },
  // ── Displays ──────────────────────────────────────────────────────────────────
  { id: 'ili9341', name: 'ILI9341 TFT Display', category: 'Display', icon: '/components_examples/ILI9341_2.8_TFT_LCD.png', color: '#3b82f6',
    difficulty: 'advanced', wokwiType: 'wokwi-ili9341',
    description: 'A 240x320 color TFT LCD display with SPI interface. Draw graphics, images, and UI on a 2.8" screen!',
    tags: ['ILI9341', 'TFT', 'SPI', 'color', 'display', '240x320'],
    realWorldUses: ['Graphical UI', 'Oscilloscopes', 'Weather dashboards', 'Game displays'],
    funFact: 'The ILI9341 can display 65,536 colors (16-bit RGB565) and update the full screen 60 times per second!',
    pinout: [{ pin: 'VCC', description: '3.3V power' }, { pin: 'GND', description: 'Ground' }, { pin: 'CS', description: 'SPI chip select' }, { pin: 'RST', description: 'Reset' }, { pin: 'DC', description: 'Data/Command select' }, { pin: 'MOSI', description: 'SPI data' }, { pin: 'CLK', description: 'SPI clock' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'ili_q1', question: 'What resolution does the ILI9341 TFT display have?', options: ['128x64', '240x320', '800x480', '1920x1080'], correct: 1, explanation: '240 pixels wide × 320 pixels tall = 76,800 total pixels in 65K colors.' },
      { id: 'ili_q2', question: 'What communication protocol does ILI9341 use?', options: ['I2C', 'UART', 'SPI', 'OneWire'], correct: 2, explanation: 'ILI9341 uses SPI (MOSI, MISO, CLK, CS, DC) for fast pixel updates.' },
      { id: 'ili_q3', question: 'Which library controls the ILI9341 on Arduino?', options: ['LiquidCrystal', 'Adafruit_ILI9341 + Adafruit_GFX', 'Wire.h', 'SPI.h only'], correct: 1, explanation: 'Adafruit_ILI9341 provides drawing functions, and Adafruit_GFX adds text, shapes, and bitmap support.' },
    ]},
  },
  { id: 'nokia-5110', name: 'Nokia 5110 LCD', category: 'Display', icon: '/components_examples/Nokia_5510_Screen.png', color: '#6366f1',
    difficulty: 'intermediate', wokwiType: 'wokwi-nokia-5110',
    description: 'The iconic 84x48 pixel monochrome LCD from Nokia phones. Low power, SPI interface, classic maker display!',
    tags: ['Nokia 5110', 'PCD8544', 'LCD', 'SPI', '84x48'],
    realWorldUses: ['Simple displays', 'Retro projects', 'Low-power IoT', 'Data loggers'],
    funFact: 'The Nokia 5110 was used in the famous Nokia 3310 phone — one of the most sold phones of all time with 126 million units!',
    pinout: [{ pin: 'VCC', description: '3.3V (MAX — do not use 5V!)' }, { pin: 'GND', description: 'Ground' }, { pin: 'CLK', description: 'SPI clock' }, { pin: 'DIN', description: 'SPI data' }, { pin: 'DC', description: 'Data/Command' }, { pin: 'CE', description: 'Chip enable' }, { pin: 'RST', description: 'Reset' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'nokia_q1', question: 'What resolution does the Nokia 5110 LCD have?', options: ['128x64', '84x48', '128x32', '240x320'], correct: 1, explanation: '84 columns × 48 rows = 4,032 pixels arranged in 6 rows of 8 pixels each (text mode).' },
      { id: 'nokia_q2', question: 'What voltage does the Nokia 5110 require?', options: ['5V', '3.3V only', '12V', '1.5V'], correct: 1, explanation: 'The Nokia 5110 uses 3.3V ONLY — applying 5V will damage it! Use a voltage divider or level shifter.' },
      { id: 'nokia_q3', question: 'Which Arduino library controls the Nokia 5110?', options: ['Adafruit_PCD8544', 'LiquidCrystal', 'Wire.h', 'Nokia5110.h'], correct: 0, explanation: 'Adafruit_PCD8544 (named after the LCD driver chip) controls the Nokia 5110 display.' },
    ]},
  },
  { id: 'max7219', name: 'MAX7219 LED Matrix', category: 'Display', icon: '/components_examples/MAX7219_Dot_Matrix.png', color: '#f59e0b',
    difficulty: 'intermediate', wokwiType: 'wokwi-max7219',
    description: 'Drive up to 64 LEDs (8x8 matrix) or 8 seven-segment digits using just 3 SPI wires. Chain multiple modules!',
    tags: ['MAX7219', 'LED matrix', 'SPI', '8x8', 'scrolling'],
    realWorldUses: ['Scrolling text signs', 'Score displays', 'Notification panels', 'Art installations'],
    funFact: 'You can chain MAX7219 modules together — 4 modules = 32x8 scrolling display using the same 3 Arduino pins!',
    pinout: [{ pin: 'VCC', description: '5V power' }, { pin: 'GND', description: 'Ground' }, { pin: 'DIN', description: 'SPI data in' }, { pin: 'CS', description: 'Chip select' }, { pin: 'CLK', description: 'SPI clock' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'max_q1', question: 'How many LEDs can one MAX7219 drive?', options: ['16', '32', '64 (8x8)', '128'], correct: 2, explanation: 'The MAX7219 drives 64 LEDs arranged in an 8x8 matrix, or 8 seven-segment digits with decimal points.' },
      { id: 'max_q2', question: 'How many Arduino pins does the MAX7219 need?', options: ['8 (one per row)', '3 (DIN, CLK, CS)', '2 (I2C)', '16'], correct: 1, explanation: 'MAX7219 uses SPI with just 3 pins — DIN (data), CLK (clock), and CS (chip select). Chain multiple modules on the same 3 pins!' },
      { id: 'max_q3', question: 'Which library is commonly used for the MAX7219 LED matrix?', options: ['Wire.h', 'LedControl or MD_Parola', 'SPI.h only', 'Adafruit_GFX'], correct: 1, explanation: 'LedControl by Eberhard Fahle is the classic library. MD_Parola adds scrolling text effects.' },
    ]},
  },
  // ── Interface / Protocol ──────────────────────────────────────────────────────
  { id: 'sd-card', name: 'SD Card Module', category: 'Storage', icon: '/components_examples/MicroSD_Card.png', color: '#64748b',
    difficulty: 'intermediate', wokwiType: 'wokwi-sd-card',
    description: 'Read and write files to an SD card using SPI. Log sensor data, play audio files, or store configuration!',
    tags: ['SD card', 'SPI', 'storage', 'FAT32', 'data logging'],
    realWorldUses: ['Data logging', 'Configuration files', 'Audio playback', 'Image storage'],
    funFact: 'The SD card module converts the 5V Arduino SPI signals to 3.3V for the SD card — never connect an SD card directly to 5V!',
    pinout: [{ pin: 'VCC', description: '5V or 3.3V' }, { pin: 'GND', description: 'Ground' }, { pin: 'MISO', description: 'SPI data out' }, { pin: 'MOSI', description: 'SPI data in' }, { pin: 'SCK', description: 'SPI clock' }, { pin: 'CS', description: 'Chip select (any digital pin)' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'sd_q1', question: 'What file system does the Arduino SD library support?', options: ['NTFS', 'ext4', 'FAT16 and FAT32', 'exFAT only'], correct: 2, explanation: 'The Arduino SD library supports FAT16 and FAT32. Format your SD card as FAT32 for cards up to 32GB.' },
      { id: 'sd_q2', question: 'What communication protocol does the SD card module use?', options: ['I2C', 'SPI', 'UART', 'OneWire'], correct: 1, explanation: 'SD cards use SPI — MOSI, MISO, SCK, and CS pins. On Arduino Uno: MOSI=11, MISO=12, SCK=13.' },
      { id: 'sd_q3', question: 'What is the maximum file name length for FAT32 on Arduino SD library?', options: ['256 characters (long names)', '8 characters (8.3 format)', '32 characters', 'No limit'], correct: 1, explanation: 'The basic Arduino SD library only supports 8.3 file names (e.g., DATA.TXT). Use SDFat library for long names.' },
    ]},
  },
  { id: 'rtc', name: 'DS1307 RTC Module', category: 'Module', icon: '/components_examples/DS1307_RTC_Module.png', color: '#8b5cf6',
    difficulty: 'intermediate', wokwiType: 'wokwi-ds1307-rtc',
    description: 'A real-time clock module that keeps accurate time even when Arduino is off. Add a coin cell battery for backup!',
    tags: ['RTC', 'DS1307', 'I2C', 'real-time clock', 'time', 'battery'],
    realWorldUses: ['Digital clocks', 'Data loggers with timestamps', 'Alarms', 'Schedulers'],
    funFact: 'The DS1307 RTC only needs a 3V coin cell (CR2032) to keep time for 10+ years when the main power is off!',
    pinout: [{ pin: 'VCC', description: '5V power' }, { pin: 'GND', description: 'Ground' }, { pin: 'SDA', description: 'I2C data — A4' }, { pin: 'SCL', description: 'I2C clock — A5' }, { pin: 'SQW', description: 'Square wave output (optional)' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'rtc_q1', question: 'Why does the RTC module have a coin cell battery?', options: ['To power the Arduino', 'To keep time when main power is off', 'For Bluetooth', 'To charge the main battery'], correct: 1, explanation: 'The DS1307 keeps time using its coin cell (CR2032) backup even when Arduino is powered off — time never resets!' },
      { id: 'rtc_q2', question: 'What library is used to control the DS1307 RTC?', options: ['Wire.h only', 'RTClib by Adafruit', 'Time.h', 'DS1307.h'], correct: 1, explanation: 'RTClib by Adafruit provides easy functions: RTC.now() returns a DateTime object with year, month, day, hour, minute, second.' },
      { id: 'rtc_q3', question: 'What communication protocol does DS1307 use?', options: ['SPI', 'UART', 'I2C', 'OneWire'], correct: 2, explanation: 'DS1307 uses I2C with address 0x68. Connect SDA to A4 and SCL to A5 on Arduino Uno.' },
    ]},
  },
  // ── Motor Drivers ─────────────────────────────────────────────────────────────
  { id: 'l293d', name: 'L293D Motor Driver', category: 'Motor', icon: '/components_examples/Motor_Driver_L293D.png', color: '#64748b',
    difficulty: 'intermediate', wokwiType: 'wokwi-l293d',
    description: 'A dual H-bridge motor driver IC that controls 2 DC motors or 1 stepper motor. Control direction and speed!',
    tags: ['L293D', 'motor driver', 'H-bridge', 'DC motor', 'PWM'],
    realWorldUses: ['Robot cars', 'DC motor control', 'Stepper motors', 'Fans'],
    funFact: 'The L293D has 4 diodes built in to protect against back-EMF (voltage spikes) when motors suddenly stop!',
    pinout: [{ pin: 'Enable 1,2', description: 'PWM speed control for motor 1' }, { pin: 'Input 1-4', description: 'Direction control' }, { pin: 'Output 1-4', description: 'Connect to motor terminals' }, { pin: 'VS', description: 'Motor supply voltage (4.5V-36V)' }, { pin: 'VSS', description: 'Logic supply (5V)' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'l293_q1', question: 'What is an H-bridge?', options: ['A type of bridge circuit for power', 'A circuit that lets you reverse motor direction by switching current flow', 'A WiFi bridge', 'A type of sensor'], correct: 1, explanation: 'An H-bridge has 4 switches arranged like an H. By activating different pairs, current flows in either direction through the motor.' },
      { id: 'l293_q2', question: 'How many DC motors can the L293D control?', options: ['1', '2', '4', '8'], correct: 1, explanation: 'L293D has two H-bridges — it can control 2 DC motors independently, or 1 stepper motor (needs 2 coils).' },
      { id: 'l293_q3', question: 'How do you control motor speed with L293D?', options: ['Resistors', 'PWM on the Enable pin', 'Changing voltage', 'Mechanical gears'], correct: 1, explanation: 'Send PWM to the Enable pin (EN1,2) to control speed (0-255 = 0-100%). Direction is set by Input pins.' },
    ]},
  },
  { id: 'pca9685', name: 'PCA9685 Servo Driver', category: 'Module', icon: '/components_examples/Servo_Pi_hat.png', color: '#6366f1',
    difficulty: 'advanced', wokwiType: 'wokwi-pca9685',
    description: 'A 16-channel I2C PWM driver — control 16 servos or LEDs with just 2 wires! Perfect for robot arms.',
    tags: ['PCA9685', 'I2C', 'PWM', 'servo', '16-channel'],
    realWorldUses: ['16-DOF robot arms', 'LED drivers', 'Pan-tilt systems', 'Animatronics'],
    funFact: 'You can chain 62 PCA9685 boards together on one I2C bus — that is 992 servos from 2 Arduino pins!',
    pinout: [{ pin: 'VCC', description: '3.3V-5V logic power' }, { pin: 'V+', description: 'Servo power (5V-6V)' }, { pin: 'SDA/SCL', description: 'I2C bus' }, { pin: 'OE', description: 'Output enable (active LOW)' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'pca_q1', question: 'How many PWM channels does the PCA9685 have?', options: ['8', '16', '32', '64'], correct: 1, explanation: '16 independent 12-bit PWM channels — each can drive a servo, LED, or any PWM device.' },
      { id: 'pca_q2', question: 'What protocol does the PCA9685 use?', options: ['SPI', 'UART', 'I2C', 'OneWire'], correct: 2, explanation: 'PCA9685 uses I2C with a default address of 0x40. Address pins allow up to 62 boards on one bus.' },
      { id: 'pca_q3', question: 'Why use PCA9685 instead of Arduino PWM pins for servos?', options: ['It is cheaper', 'Arduino has limited PWM pins and CPU load; PCA9685 handles PWM in hardware for 16 channels', 'Servos need I2C', 'It is faster'], correct: 1, explanation: 'Arduino has only 6 PWM pins and software PWM uses CPU time. PCA9685 generates hardware PWM for 16 channels independently.' },
    ]},
  },
  // ── Power ─────────────────────────────────────────────────────────────────────
  { id: 'battery', name: 'Battery', category: 'Power', icon: '/components_examples/Li_ion_Battery.png', color: '#22c55e',
    difficulty: 'beginner', wokwiType: 'wokwi-battery',
    description: 'A portable power source for your circuits. Learn about voltage, capacity (mAh), and battery types.',
    tags: ['battery', 'power', 'portable', 'voltage'],
    realWorldUses: ['Portable devices', 'Robots', 'Remote sensors', 'Wearables'],
    funFact: 'mAh (milliamp-hours) tells you battery capacity. A 2000mAh battery can supply 2000mA for 1 hour, or 200mA for 10 hours!',
    pinout: [{ pin: '+', description: 'Positive terminal' }, { pin: '-', description: 'Negative terminal (GND)' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'bat_q1', question: 'What does mAh stand for?', options: ['Mega amp hours', 'Milliamp-hours (capacity)', 'Minimum ampere handling', 'Motor amp hours'], correct: 1, explanation: 'mAh = milliamp-hours. A 1000mAh battery can deliver 1000mA (1A) for 1 hour, or 500mA for 2 hours.' },
      { id: 'bat_q2', question: 'What is the voltage of a standard 18650 Li-Ion battery?', options: ['1.5V', '3.7V (nominal)', '9V', '12V'], correct: 1, explanation: '18650 Li-Ion cells have a nominal voltage of 3.7V (full = 4.2V, empty = 3.0V).' },
      { id: 'bat_q3', question: 'What does polarity mean for a battery?', options: ['Its chemical composition', 'The + and - terminals must be connected correctly', 'The physical size', 'The brand name'], correct: 1, explanation: 'Polarity means the + and - terminals. Reverse polarity can damage or destroy your circuit!' },
    ]},
  },
  { id: 'power-supply', name: 'Power Supply Module', category: 'Power', icon: '/components_examples/Power_Supply.png', color: '#f59e0b',
    difficulty: 'beginner', wokwiType: 'wokwi-power-supply',
    description: 'Provides regulated 5V and 3.3V power from a 12V input. Used to power breadboard circuits independently.',
    tags: ['power supply', 'regulated', '5V', '3.3V', 'breadboard'],
    realWorldUses: ['Breadboard projects', 'Bench power', 'Multiple voltage rails', 'Lab testing'],
    funFact: 'A linear voltage regulator wastes extra voltage as heat — a 12V-to-5V regulator at 1A generates 7 watts of heat!',
    pinout: [{ pin: '12V IN', description: 'DC barrel jack input' }, { pin: '5V OUT', description: '5V regulated rail' }, { pin: '3.3V OUT', description: '3.3V regulated rail' }, { pin: 'GND', description: 'Common ground' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'psu_q1', question: 'What is a voltage regulator?', options: ['A component that stores voltage', 'A circuit that outputs a stable voltage regardless of input fluctuations', 'A type of resistor', 'A battery charger'], correct: 1, explanation: 'A voltage regulator takes a higher (or varying) input voltage and outputs a stable fixed voltage (e.g., 5V or 3.3V).' },
      { id: 'psu_q2', question: 'Why can the power supply module get hot?', options: ['It is broken', 'Linear regulators dissipate extra voltage as heat (P = V_drop × I)', 'It needs cooling fan', 'It is charging'], correct: 1, explanation: 'Linear regulators convert voltage difference to heat. High current + high voltage drop = very hot! Use heatsinks.' },
      { id: 'psu_q3', question: 'What advantage does a switching power supply have over linear?', options: ['Simpler circuit', 'Much higher efficiency (up to 95% vs 30-60%)', 'Lower cost', 'Less noise'], correct: 1, explanation: 'Switching regulators use rapidly switching transistors — much more efficient than linear regulators which waste energy as heat.' },
    ]},
  },
  { id: 'npn-transistor', name: 'NPN Transistor', category: 'Component', icon: '/components_examples/NPN_Transistor.png', color: '#64748b',
    difficulty: 'intermediate', wokwiType: 'wokwi-npn-transistor',
    description: 'A fundamental electronic switch and amplifier. Control high currents with small signals from Arduino.',
    tags: ['transistor', 'NPN', 'BJT', 'switch', 'amplifier', '2N2222'],
    realWorldUses: ['Motor control', 'LED driver', 'Signal amplifier', 'Logic gates'],
    funFact: 'The transistor was invented in 1947 at Bell Labs — it replaced vacuum tubes and made modern electronics possible!',
    pinout: [{ pin: 'Base (B)', description: 'Control input from Arduino' }, { pin: 'Collector (C)', description: 'Connect to load positive' }, { pin: 'Emitter (E)', description: 'Connect to GND' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'npn_q1', question: 'In an NPN transistor, current flows from:', options: ['Base to Collector', 'Emitter to Collector (when Base is HIGH)', 'Collector to Emitter (when Base is HIGH)', 'Base to Emitter only'], correct: 2, explanation: 'In NPN, applying current to the Base allows current to flow from Collector to Emitter (conventional current direction).' },
      { id: 'npn_q2', question: 'Why use a transistor to control a motor instead of Arduino pin directly?', options: ['Transistors are cheaper', 'Arduino pins can only supply ~40mA; transistors switch much higher currents', 'Motors need AC', 'Transistors are faster'], correct: 1, explanation: 'Arduino GPIO can source/sink only ~40mA. A transistor like 2N2222 can handle 600mA collector current — enough for small motors.' },
      { id: 'npn_q3', question: 'What resistor is typically placed between Arduino and the transistor Base?', options: ['Not needed', '1k-10k ohm current-limiting resistor', '0.1 ohm shunt', '1M ohm pull-down'], correct: 1, explanation: 'A 1k-10k base resistor limits current into the base to a safe level. Without it, you could damage the Arduino output.' },
    ]},
  },
  { id: 'analog-joystick', name: 'Analog Joystick', category: 'Input', icon: '/components_examples/Analog_JoyStick.png', color: '#8b5cf6',
    difficulty: 'beginner', wokwiType: 'wokwi-analog-joystick',
    description: 'A 2-axis analog joystick with a push button. Read X and Y position with analogRead() — perfect for games and robots!',
    tags: ['joystick', 'analog', 'X Y axis', 'potentiometer', 'game'],
    realWorldUses: ['Robot control', 'Games', 'Camera gimbals', 'RC cars', 'Drones'],
    funFact: 'A joystick is just two potentiometers at 90 degrees to each other — twist them and the resistance changes!',
    pinout: [{ pin: 'VCC', description: '3.3V-5V power' }, { pin: 'GND', description: 'Ground' }, { pin: 'VRX', description: 'X-axis analog output (A0)' }, { pin: 'VRY', description: 'Y-axis analog output (A1)' }, { pin: 'SW', description: 'Push button (press joystick down)' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'joy_q1', question: 'What does a joystick center position read on a 10-bit ADC?', options: ['0', '512 (approximately)', '1023', '255'], correct: 1, explanation: 'Center position outputs ~2.5V which reads as ~512 on a 10-bit ADC (0-1023 range). Move the stick to change the value.' },
      { id: 'joy_q2', question: 'How many potentiometers are inside an analog joystick?', options: ['1', '2 (one per axis)', '3', '4'], correct: 1, explanation: 'Two potentiometers — one for X-axis and one for Y-axis. Moving the joystick rotates both simultaneously.' },
      { id: 'joy_q3', question: 'The joystick push button (SW) works like:', options: ['An analog sensor', 'A normal digital push button (INPUT_PULLUP)', 'An I2C device', 'A PWM output'], correct: 1, explanation: 'SW is a simple push button. Use INPUT_PULLUP — reads HIGH normally, LOW when joystick is pressed down.' },
    ]},
  },
  { id: 'logic-analyzer', name: 'Logic Analyzer', category: 'Tool', icon: '/components_examples/8_ch_logic_Analyzer.png', color: '#64748b',
    difficulty: 'advanced', wokwiType: 'wokwi-logic-analyzer',
    description: 'Captures and displays digital signals over time. Debug SPI, I2C, UART, and other protocols visually.',
    tags: ['logic analyzer', 'debugging', 'SPI', 'I2C', 'UART', 'protocol'],
    realWorldUses: ['Protocol debugging', 'Signal timing', 'Hardware troubleshooting', 'Education'],
    funFact: 'A logic analyzer is like an oscilloscope for digital signals — it shows HIGH/LOW states over time at very high speeds!',
    pinout: [{ pin: 'CH0-CH7', description: '8 digital input channels' }, { pin: 'GND', description: 'Common ground' }, { pin: 'CLK', description: 'External clock (optional)' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'la_q1', question: 'What does a logic analyzer do?', options: ['Measures voltage', 'Captures and displays digital signal timing', 'Programs microcontrollers', 'Tests resistors'], correct: 1, explanation: 'A logic analyzer samples digital signals at high speed and displays their HIGH/LOW patterns over time.' },
      { id: 'la_q2', question: 'Which protocols can a logic analyzer decode?', options: ['Only UART', 'SPI, I2C, UART, CAN, and many others', 'Only analog signals', 'Only PWM'], correct: 1, explanation: 'Logic analyzers with protocol decoders can interpret SPI, I2C, UART, CAN, 1-Wire, and other serial protocols.' },
      { id: 'la_q3', question: 'What is sampling rate in a logic analyzer?', options: ['How often it charges', 'How many times per second it reads the input signals', 'Its memory size', 'Its display refresh rate'], correct: 1, explanation: 'Sampling rate is samples per second (e.g., 24MHz). Higher = captures faster signals. Must be at least 4x the signal frequency.' },
    ]},
  },
  { id: 'ssd1306', name: 'SSD1306 OLED Display', category: 'Display', icon: '/components_examples/SSD1306_Oled_128x64.png', color: '#6366f1',
    difficulty: 'intermediate', wokwiType: 'wokwi-ssd1306-oled',
    description: 'A crisp 128x64 pixel monochrome OLED display using I2C. Same as the "oled" component — alternate ID.',
    tags: ['oled', 'SSD1306', 'I2C', 'display', 'graphics'],
    realWorldUses: ['Wearables', 'IoT status', 'Data display', 'Instruments'],
    funFact: 'OLED pixels emit their own light — truly black pixels are completely off, giving infinite contrast ratio!',
    pinout: [{ pin: 'VCC', description: '3.3V or 5V' }, { pin: 'GND', description: 'Ground' }, { pin: 'SDA', description: 'I2C data — A4' }, { pin: 'SCL', description: 'I2C clock — A5' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'ssd_q1', question: 'What is the I2C address of the SSD1306 OLED?', options: ['0x27', '0x3C or 0x3D', '0x40', '0x68'], correct: 1, explanation: 'Most SSD1306 modules use address 0x3C. Some have address select resistors allowing 0x3D.' },
      { id: 'ssd_q2', question: 'How many pixels does the SSD1306 display have?', options: ['4,032', '8,192', '16,384', '65,536'], correct: 1, explanation: '128 × 64 = 8,192 individually addressable pixels.' },
      { id: 'ssd_q3', question: 'Why must you call display.display() after drawing?', options: ['To save power', 'Drawing writes to a RAM buffer; display() sends it to the physical screen', 'To clear the screen', 'Required for I2C protocol'], correct: 1, explanation: 'Adafruit GFX draws to an internal RAM buffer. display.display() transfers the entire buffer to the OLED in one I2C burst.' },
    ]},
  },
  { id: 'ws2812b', name: 'WS2812B LED Strip', category: 'Output', icon: '/components_examples/WS2812B_RGB_LED.png', color: '#ec4899',
    difficulty: 'intermediate', wokwiType: 'wokwi-ws2812b',
    description: 'Individual WS2812B addressable RGB LEDs — same as NeoPixels. Control any number with one data wire.',
    tags: ['WS2812B', 'neopixel', 'addressable', 'RGB', 'LED strip'],
    realWorldUses: ['Room lighting', 'Animations', 'Indicators', 'Cosplay'],
    funFact: 'The WS2812B timing is so precise that the data wire needs no clock — the pulse widths encode 0s and 1s!',
    pinout: [{ pin: 'DIN', description: 'Data input' }, { pin: '5V', description: 'Power (external for >8 LEDs)' }, { pin: 'GND', description: 'Ground' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'ws_q1', question: 'WS2812B LEDs are often called:', options: ['RGB pixels', 'NeoPixels (Adafruit brand name)', 'Smart LEDs', 'All of the above'], correct: 3, explanation: "WS2812B is the chip name; NeoPixel is Adafruit's brand name for them. They are also called smart LEDs or addressable LEDs." },
      { id: 'ws_q2', question: 'What is the power rule for WS2812B LEDs?', options: ['Max 10mA each', 'Up to 60mA each at full white; use external 5V for >8 LEDs', '1A total always', 'Unlimited from USB'], correct: 1, explanation: 'At full RGB brightness (255,255,255), each WS2812B draws ~60mA. 10 LEDs = 600mA — more than USB can provide safely.' },
      { id: 'ws_q3', question: 'Add a 300-500 ohm resistor on the data line because:', options: ['It reduces brightness', 'It protects against signal reflections and voltage spikes that can damage the first LED', 'It is required for I2C', 'It sets the color'], correct: 1, explanation: 'A 300-500 ohm resistor on DIN close to the first LED reduces signal reflections and protects against ESD/voltage spikes.' },
    ]},
  },
  { id: 'neopixel-ring', name: 'NeoPixel Ring', category: 'Output', icon: '/components_examples/NeoPixel_Ring.png', color: '#ec4899',
    difficulty: 'intermediate', wokwiType: 'wokwi-neopixel-ring',
    description: 'WS2812B LEDs arranged in a ring shape. Create circular animations, clock faces, and level meters!',
    tags: ['neopixel', 'WS2812B', 'ring', 'RGB', 'circular'],
    realWorldUses: ['Clock displays', 'Loading spinners', 'Level meters', 'Decorative lighting'],
    funFact: 'NeoPixel rings come in 12, 16, 24, and 60 LED variants — the 60 LED version is perfect for a seconds clock!',
    pinout: [{ pin: 'DIN', description: 'Data input' }, { pin: '5V', description: 'Power' }, { pin: 'GND', description: 'Ground' }, { pin: 'DOUT', description: 'Data output (chain to next ring)' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'nr_q1', question: 'What is a NeoPixel ring?', options: ['A WiFi antenna', 'WS2812B LEDs arranged in a circle', 'A type of resistor', 'An IR sensor'], correct: 1, explanation: 'NeoPixel rings are WS2812B addressable RGB LEDs soldered in a circular PCB — controlled the same way as a strip.' },
      { id: 'nr_q2', question: 'How would you make a spinner animation on a 12-LED ring?', options: ['Use digitalWrite on each pin', 'Light one LED at a time and advance the index with modulo (%)  ', 'Use PWM only', 'Use I2C commands'], correct: 1, explanation: 'Light pixel i, turn off pixel (i-1), increment i, use i % NUM_PIXELS to wrap around — classic spinner!' },
      { id: 'nr_q3', question: 'Can you chain multiple NeoPixel rings together?', options: ['No', 'Yes — connect DOUT of ring 1 to DIN of ring 2', 'Only 2 rings max', 'Only with extra Arduino'], correct: 1, explanation: 'Connect DOUT of ring 1 to DIN of ring 2. All rings are addressed sequentially as one strip in your Adafruit NeoPixel setup.' },
    ]},
  },
  { id: 'neopixel-matrix', name: 'NeoPixel Matrix', category: 'Output', icon: '/components_examples/MAX7219_Dot_Matrix.png', color: '#ec4899',
    difficulty: 'intermediate', wokwiType: 'wokwi-neopixel-matrix',
    description: 'WS2812B LEDs in an 8x8 (or larger) grid. Display patterns, scrolling text, and pixel art!',
    tags: ['neopixel', 'WS2812B', 'matrix', 'RGB', '8x8'],
    realWorldUses: ['Pixel art displays', 'Scrolling signs', 'Games', 'Mood lighting'],
    funFact: 'An 8x8 NeoPixel matrix has 64 LEDs × 60mA = 3.84 amps at full white — always use external power!',
    pinout: [{ pin: 'DIN', description: 'Data input' }, { pin: '5V', description: 'External 5V power required' }, { pin: 'GND', description: 'Ground' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'nm_q1', question: 'An 8x8 NeoPixel matrix has how many LEDs?', options: ['8', '32', '64', '128'], correct: 2, explanation: '8 rows × 8 columns = 64 LEDs. Each is an individual WS2812B addressable RGB LED.' },
      { id: 'nm_q2', question: 'Why MUST you use external power for an 8x8 matrix?', options: ['I2C requirement', '64 LEDs at 60mA = 3.84A — far more than Arduino or USB can provide', 'It needs 12V', 'Arduino pins cannot output enough frequency'], correct: 1, explanation: 'At full brightness, 64 LEDs × 60mA = 3,840mA (3.84A). USB provides 500mA max. Always use a 5V 4A+ power supply!' },
      { id: 'nm_q3', question: 'To convert row/column to pixel index on an 8x8 matrix:', options: ['index = row + col', 'index = row * 8 + col (for simple row-by-row layout)', 'index = col * 8 + row', 'Depends on the matrix wiring (serpentine or sequential)'], correct: 3, explanation: 'It depends! Some matrices wire sequentially (row by row), others serpentine (alternating direction). Check your matrix datasheet.' },
    ]},
  },
  { id: 'membrane-keypad', name: 'Membrane Keypad', category: 'Input', icon: '/components_examples/Membrane_Keypad.png', color: '#0ea5e9',
    difficulty: 'intermediate', wokwiType: 'wokwi-membrane-keypad',
    description: 'Same as the keypad component — 4x4 matrix membrane keypad. 16 keys with only 8 wires using matrix scanning.',
    tags: ['keypad', 'matrix', '4x4', 'input', 'password'],
    realWorldUses: ['PIN entry', 'Door locks', 'Calculators', 'Control panels'],
    funFact: 'Membrane keypads use thin flexible circuits — they have a limited press lifetime of about 1 million keystrokes per key!',
    pinout: [{ pin: 'R1-R4', description: 'Row pins' }, { pin: 'C1-C4', description: 'Column pins' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'mk_q1', question: 'How does a membrane keypad differ from mechanical switches?', options: ['It uses light', 'It uses flexible printed circuit layers that make contact when pressed', 'It uses capacitive sensing', 'It requires calibration'], correct: 1, explanation: 'Membrane keypads have a flexible top layer that presses conductive areas together when pushed — simpler and cheaper than mechanical.' },
      { id: 'mk_q2', question: 'What is the main limitation of membrane keypads?', options: ['No key labels', 'Limited tactile feedback and lower press lifetime vs mechanical', 'Cannot detect multiple keys', 'Requires 12V'], correct: 1, explanation: 'Membrane keys have poor tactile feedback (no satisfying click) and wear out faster than mechanical switches.' },
      { id: 'mk_q3', question: 'The Keypad library function to get a pressed key is:', options: ['keypad.read()', 'keypad.getKey()', 'digitalRead()', 'analogRead()'], correct: 1, explanation: 'keypad.getKey() returns the character of the pressed key, or NO_KEY (0) if nothing is pressed. Call it in loop().' },
    ]},
  },
  { id: 'pushbutton', name: 'Push Button', category: 'Input', icon: '/components_examples/Push_button.png', color: '#06b6d4',
    difficulty: 'beginner', wokwiType: 'wokwi-pushbutton',
    description: 'Same as the button component — a momentary push button that connects a circuit when pressed.',
    tags: ['button', 'push', 'digital input', 'INPUT_PULLUP'],
    realWorldUses: ['User input', 'Reset buttons', 'Game controllers', 'Start/stop'],
    funFact: 'Most Arduino buttons use INPUT_PULLUP — the pin reads HIGH normally and LOW when pressed, which seems backwards but prevents floating pin issues!',
    pinout: [{ pin: 'Pin 1 & 2', description: 'One side of button' }, { pin: 'Pin 3 & 4', description: 'Other side of button' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'pb_q1', question: 'What is a "floating" pin and why is it a problem?', options: ['A pin not connected to GND', 'An unconnected digital pin that randomly reads HIGH or LOW due to electrical noise', 'A pin at exactly 2.5V', 'A broken pin'], correct: 1, explanation: 'A floating pin has no defined voltage — it picks up electrical noise and randomly reads HIGH or LOW, causing unreliable button detection.' },
      { id: 'pb_q2', question: 'INPUT_PULLUP enables an internal resistor that pulls the pin to:', options: ['GND (LOW)', 'VCC (HIGH) by default', '2.5V always', 'PWM output'], correct: 1, explanation: 'INPUT_PULLUP connects the pin to VCC through ~20-50kΩ — reads HIGH when unconnected, LOW when button connects pin to GND.' },
      { id: 'pb_q3', question: 'Button "debouncing" solves:', options: ['Slow response', 'Mechanical bounce causing multiple triggers from one press', 'High power consumption', 'Wrong voltage'], correct: 1, explanation: 'When pressed, physical contacts bounce 5-50 times in <10ms. Debouncing (millis() or delay) ignores bounces to detect one clean press.' },
    ]},
  },

  // ── Aliases and stubs for WOKWI_TO_COMP_ID short IDs ──────────────────────────
  { id: 'uno', name: 'Arduino Uno', category: 'Board', icon: '/components_examples/UNO.png', color: '#00979d', difficulty: 'beginner',
    wokwiType: 'wokwi-arduino-uno', description: 'The classic Arduino board — always unlocked as your starting board.',
    tags: ['arduino', 'uno', 'beginner', 'microcontroller'],
    realWorldUses: ['Learning electronics', 'Prototyping', 'Robotics', 'IoT'],
    funFact: 'Arduino Uno is the worlds most popular microcontroller board with over 10 million sold!',
    pinout: [{ pin: 'Digital 0-13', description: '14 digital I/O pins (6 PWM)' }, { pin: 'Analog A0-A5', description: '6 analog input pins' }, { pin: '5V/3.3V/GND', description: 'Power pins' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'uno_q1', question: 'What microcontroller chip is on the Arduino Uno?', options: ['ESP8266', 'ATmega328P', 'RP2040', 'STM32'], correct: 1, explanation: 'Arduino Uno uses the ATmega328P — an 8-bit AVR microcontroller running at 16MHz.' },
      { id: 'uno_q2', question: 'How many PWM pins does Arduino Uno have?', options: ['2', '4', '6', '8'], correct: 2, explanation: 'Arduino Uno has 6 PWM pins: 3, 5, 6, 9, 10, 11. Use analogWrite() to output PWM.' },
      { id: 'uno_q3', question: 'What voltage does Arduino Uno operate at?', options: ['3.3V', '5V', '12V', '1.8V'], correct: 1, explanation: 'Arduino Uno is a 5V board. Its GPIO pins output 5V — use level shifters when connecting 3.3V devices.' },
    ]},
  },
  { id: 'nano', name: 'Arduino Nano', category: 'Board', icon: '/components_examples/Nano.png', color: '#00979d', difficulty: 'beginner',
    wokwiType: 'wokwi-arduino-nano', description: 'A compact version of Arduino Uno — same ATmega328P but smaller for tight spaces.',
    tags: ['arduino', 'nano', 'compact', 'breadboard'],
    realWorldUses: ['Compact projects', 'Wearables', 'Breadboard prototyping'],
    funFact: 'The Arduino Nano is only 18mm × 43mm — small enough to embed inside a thick book!',
    pinout: [{ pin: 'D2-D13', description: 'Digital I/O (D3,D5,D6,D9,D10,D11 = PWM)' }, { pin: 'A0-A7', description: '8 analog inputs' }, { pin: 'VIN', description: 'Input voltage 7-12V' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'nano_q1', question: 'How does Arduino Nano differ from Uno?', options: ['Different processor', 'Same processor (ATmega328P) but smaller form factor', 'More I/O pins', 'Wireless built in'], correct: 1, explanation: 'Both use ATmega328P. The Nano is smaller and has a mini-USB/micro-USB port instead of full-size USB.' },
      { id: 'nano_q2', question: 'What is an advantage of the Arduino Nano?', options: ['More RAM', 'Fits directly in a breadboard', 'Has WiFi', 'Runs at 32MHz'], correct: 1, explanation: 'The Nano can plug directly into a breadboard thanks to its DIP-style pins — great for prototyping.' },
      { id: 'nano_q3', question: 'How many analog inputs does the Arduino Nano have?', options: ['4', '6', '8', '10'], correct: 2, explanation: 'Arduino Nano has 8 analog inputs (A0-A7), compared to 6 on the Uno.' },
    ]},
  },
  { id: 'mega', name: 'Arduino Mega', category: 'Board', icon: '/components_examples/MEGA.png', color: '#00979d', difficulty: 'intermediate',
    wokwiType: 'wokwi-arduino-mega', description: 'The big Arduino — 54 digital pins, 16 analog inputs, and 4 serial ports for complex projects.',
    tags: ['arduino', 'mega', 'ATmega2560', 'advanced'],
    realWorldUses: ['3D printers (RAMPS)', 'CNC machines', 'Large LED projects', 'Complex robots'],
    funFact: 'The Arduino Mega is the brain of most RepRap 3D printers via the RAMPS shield!',
    pinout: [{ pin: 'Digital 0-53', description: '54 digital I/O (15 PWM)' }, { pin: 'Analog A0-A15', description: '16 analog inputs' }, { pin: 'Serial 0-3', description: '4 hardware serial ports' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'mega_q1', question: 'How many digital I/O pins does the Arduino Mega have?', options: ['14', '20', '54', '40'], correct: 2, explanation: 'Arduino Mega has 54 digital I/O pins, compared to 14 on the Uno — great for complex projects.' },
      { id: 'mega_q2', question: 'What chip does the Arduino Mega use?', options: ['ATmega328P', 'ATmega2560', 'ESP32', 'RP2040'], correct: 1, explanation: 'Arduino Mega uses ATmega2560 with 256KB flash, 8KB SRAM, and 4KB EEPROM.' },
      { id: 'mega_q3', question: 'How many hardware serial ports does Arduino Mega have?', options: ['1', '2', '4', '6'], correct: 2, explanation: '4 hardware UARTs (Serial, Serial1, Serial2, Serial3) — great for connecting multiple serial devices.' },
    ]},
  },
  { id: 'breadboard', name: 'Breadboard', category: 'Tool', icon: '/components_examples/BreadBoard_full.png', color: '#64748b', difficulty: 'beginner',
    wokwiType: 'wokwi-breadboard', description: 'A solderless prototyping board for building circuits without permanent connections.',
    tags: ['breadboard', 'prototyping', 'beginner', 'tool'],
    realWorldUses: ['Circuit prototyping', 'Learning electronics', 'Testing ideas'],
    funFact: 'The name "breadboard" comes from the 1970s when people literally used wooden breadboards with nails to test circuits!',
    pinout: [{ pin: 'Power rails', description: 'Red (+) and Blue (-) rails along the sides' }, { pin: 'Terminal strips', description: 'Rows a-e and f-j connected horizontally' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'bb_q1', question: 'How are breadboard holes connected internally?', options: ['All connected together', 'Rows connected horizontally; power rails connected vertically', 'Randomly', 'Columns connected vertically only'], correct: 1, explanation: 'Terminal strip rows (a-e, f-j) connect horizontally. Power rails (+ and -) connect vertically along the edges.' },
      { id: 'bb_q2', question: 'Why is there a gap in the middle of a breadboard?', options: ['For decoration', 'To fit DIP ICs — the gap separates the two sides so each pin is isolated', 'For a power bus', 'For the reset button'], correct: 1, explanation: 'The center gap fits DIP (Dual In-line Package) chips. Each leg of the IC is on a different row, keeping them isolated.' },
      { id: 'bb_q3', question: 'What does breadboard "breadboard-friendly" mean for a module?', options: ['It tastes good', 'The module pins are spaced 2.54mm apart to fit standard breadboard holes', 'It is waterproof', 'It runs on bread'], correct: 1, explanation: 'Standard breadboard holes are 2.54mm (0.1 inch) apart. "Breadboard-friendly" modules match this spacing.' },
    ]},
  },
  { id: 'ldr-module', name: 'LDR Light Sensor', category: 'Sensor', icon: '/components_examples/LDR_Sensor_Module.png', color: '#f59e0b', difficulty: 'beginner',
    wokwiType: 'wokwi-photoresistor-sensor', description: 'A light-dependent resistor module that detects ambient light levels. Resistance decreases when light increases!',
    tags: ['LDR', 'light', 'photoresistor', 'analog'],
    realWorldUses: ['Auto night lights', 'Smart curtains', 'Light-activated alarms', 'Solar tracking'],
    funFact: 'LDR resistance can change from 1M ohm in darkness to 100 ohm in bright sunlight — a 10,000x change!',
    pinout: [{ pin: 'VCC', description: '5V power' }, { pin: 'GND', description: 'Ground' }, { pin: 'AOUT', description: 'Analog output (bright = low, dark = high)' }, { pin: 'DOUT', description: 'Digital threshold output' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'ldr_q1', question: 'LDR stands for:', options: ['Light Data Relay', 'Light Dependent Resistor', 'Low Digital Resistance', 'Laser Detection Range'], correct: 1, explanation: 'LDR = Light Dependent Resistor. Its resistance changes based on how much light hits it.' },
      { id: 'ldr_q2', question: 'What happens to an LDR resistance in bright light?', options: ['Increases dramatically', 'Decreases (becomes less resistive)', 'Stays the same', 'Goes to zero instantly'], correct: 1, explanation: 'In bright light, LDR resistance drops (can be as low as 100 ohms). In darkness it rises to 1M+ ohms.' },
      { id: 'ldr_q3', question: 'To read an LDR with Arduino, use:', options: ['digitalRead()', 'analogRead() via a voltage divider', 'Serial.read()', 'tone()'], correct: 1, explanation: 'LDR changes resistance, not voltage directly. Use a voltage divider (LDR + fixed resistor) and analogRead() to measure.' },
    ]},
  },
  { id: '7segment', name: '7-Segment Display (Single)', category: 'Display', icon: '/components_examples/7-Segment_Display.png', color: '#f97316', difficulty: 'intermediate',
    wokwiType: 'wokwi-7segment', description: 'A single-digit 7-segment LED display. Show digits 0-9 and some letters by controlling 7 LED segments.',
    tags: ['7segment', 'display', 'digits', 'LED'],
    realWorldUses: ['Digit displays', 'Counters', 'Basic meters'],
    funFact: 'A 7-segment display needs up to 7 Arduino pins for one digit — use a shift register to save pins!',
    pinout: [{ pin: 'a-g', description: '7 segment pins (a=top, b=top-right, ... g=middle)' }, { pin: 'dp', description: 'Decimal point' }, { pin: 'COM', description: 'Common anode (+) or cathode (-)' }],
    quiz: { totalQuestions: 3, questions: [
      { id: '7s_q1', question: 'Which segments light up to show the digit "7"?', options: ['a, b, c', 'a, b, c, d, e', 'a, f, g', 'b, c, f, g'], correct: 0, explanation: 'Digit 7 = segments a (top) + b (top-right) + c (bottom-right). A simple L-shape!' },
      { id: '7s_q2', question: 'What is the difference between common anode and common cathode?', options: ['No difference', 'Common anode shares + supply; segments turn ON with LOW signal. Common cathode shares GND; ON with HIGH.', 'Only the color differs', 'Common anode is brighter'], correct: 1, explanation: 'Common anode: all anodes tied to VCC, segments activated by LOW. Common cathode: all cathodes tied to GND, activated by HIGH.' },
      { id: '7s_q3', question: 'To display all digits 0-9 efficiently, use:', options: ['7 individual Arduino pins', 'TM1637 driver chip or shift register', 'I2C LCD instead', 'One analog pin'], correct: 1, explanation: 'Direct control needs 7 pins per digit. TM1637 controls 4 digits with 2 pins. Shift register frees Arduino pins.' },
    ]},
  },
  { id: 'keypad', name: 'Keypad (alias)', category: 'Input', icon: '/components_examples/Membrane_Keypad.png', color: '#0ea5e9', difficulty: 'intermediate',
    wokwiType: 'wokwi-membrane-keypad', description: 'Alias for membrane-keypad — 4x4 matrix keypad.',
    tags: ['keypad', 'input', 'matrix'], realWorldUses: ['PIN entry', 'Control panels'],
    funFact: 'Matrix keypads save pins by scanning rows and columns!',
    pinout: [{ pin: 'R1-R4', description: 'Row pins' }, { pin: 'C1-C4', description: 'Column pins' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'kpalias_q1', question: 'How many pins does a 4x4 keypad use?', options: ['4', '8', '16', '2'], correct: 1, explanation: '4 rows + 4 columns = 8 pins for 16 keys.' },
      { id: 'kpalias_q2', question: 'Which library handles 4x4 keypad scanning?', options: ['Wire.h', 'Keypad.h', 'SPI.h', 'EEPROM.h'], correct: 1, explanation: 'Keypad library by Mark Stanley handles matrix scanning automatically.' },
      { id: 'kpalias_q3', question: 'getKey() returns what when no key is pressed?', options: ['0', 'NO_KEY (null char)', '-1', 'ERROR'], correct: 1, explanation: 'keypad.getKey() returns NO_KEY (which is 0/null) when nothing is pressed.' },
    ]},
  },
  { id: 'relay', name: 'Relay Module (alias)', category: 'Output', icon: '/components_examples/Relay_Module.png', color: '#ef4444', difficulty: 'intermediate',
    wokwiType: 'wokwi-relay-module', description: 'Alias for relay-module — electrically controlled switch.',
    tags: ['relay', 'switch', 'automation'], realWorldUses: ['Home automation', 'AC control'],
    funFact: 'Relays click when switching — the sound of the electromagnet moving the metal contact!',
    pinout: [{ pin: 'IN', description: 'Control (LOW=ON for most)' }, { pin: 'NO/NC/COM', description: 'Switch terminals' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'ralias_q1', question: 'Most relay modules activate when input is:', options: ['HIGH', 'LOW (active LOW)', 'Analog mid', 'PWM'], correct: 1, explanation: 'Most Arduino relay modules are active LOW — LOW signal turns relay ON.' },
      { id: 'ralias_q2', question: 'NO stands for:', options: ['Not On', 'Normally Open', 'New Output', 'Node Output'], correct: 1, explanation: 'NO = Normally Open. Circuit is open (disconnected) when relay is OFF.' },
      { id: 'ralias_q3', question: 'Why use a relay instead of a transistor for AC devices?', options: ['Relays are faster', 'Relay provides physical isolation from AC mains voltage', 'Transistors cannot switch', 'Cost'], correct: 1, explanation: 'Relays physically separate the Arduino circuit from high-voltage AC — no electrical connection between them.' },
    ]},
  },
  { id: 'oled', name: 'OLED Display (alias)', category: 'Display', icon: '/components_examples/SSD1306_Oled_128x64.png', color: '#6366f1', difficulty: 'intermediate',
    wokwiType: 'wokwi-ssd1306-oled', description: 'Alias for ssd1306 — 128x64 OLED display via I2C.',
    tags: ['oled', 'SSD1306', 'I2C', 'display'], realWorldUses: ['Status displays', 'Instruments'],
    funFact: 'OLED pixels emit their own light — no backlight needed, giving true blacks!',
    pinout: [{ pin: 'SDA', description: 'I2C data — A4' }, { pin: 'SCL', description: 'I2C clock — A5' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'oalias_q1', question: 'OLED resolution is:', options: ['64x32', '128x64', '320x240', '480x320'], correct: 1, explanation: '128 columns × 64 rows = 8,192 individually addressable pixels.' },
      { id: 'oalias_q2', question: 'I2C address of SSD1306:', options: ['0x27', '0x3C', '0x40', '0x68'], correct: 1, explanation: 'Most SSD1306 OLEDs use I2C address 0x3C (some use 0x3D).' },
      { id: 'oalias_q3', question: 'display.display() is needed because:', options: ['To set I2C address', 'Sends the RAM buffer to physical screen pixels', 'To clear screen', 'Required by I2C spec'], correct: 1, explanation: 'Drawing functions write to a RAM buffer. display.display() transfers the buffer to the OLED panel.' },
    ]},
  },
  { id: 'stepper', name: 'Stepper Motor (alias)', category: 'Motor', icon: '/components_examples/Stepper_Motor_Bipolar.png', color: '#64748b', difficulty: 'advanced',
    wokwiType: 'wokwi-stepper-motor', description: 'Alias for stepper-motor — precise angular positioning motor.',
    tags: ['stepper', 'motor', 'precise', 'A4988'], realWorldUses: ['3D printers', 'CNC', 'Robots'],
    funFact: '200 steps per revolution = 1.8 degrees per step for standard NEMA17!',
    pinout: [{ pin: 'A+/A-', description: 'Coil A' }, { pin: 'B+/B-', description: 'Coil B' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'stalias_q1', question: 'Steps per revolution for 1.8° stepper:', options: ['100', '180', '200', '360'], correct: 2, explanation: '360 / 1.8 = 200 steps per full revolution.' },
      { id: 'stalias_q2', question: 'STEP pin on A4988 receives:', options: ['Analog signal', 'One pulse per step', 'PWM for speed', 'I2C data'], correct: 1, explanation: 'Each HIGH pulse on STEP advances the motor one step. Pulse frequency = speed.' },
      { id: 'stalias_q3', question: 'DIR pin controls:', options: ['Speed', 'Rotation direction (HIGH=CW, LOW=CCW)', 'Step size', 'Power'], correct: 1, explanation: 'DIR HIGH = clockwise, DIR LOW = counterclockwise (or vice versa depending on wiring).' },
    ]},
  },
  { id: 'neopixel', name: 'NeoPixel (alias)', category: 'Output', icon: '/components_examples/WS2812B_RGB_LED.png', color: '#ec4899', difficulty: 'intermediate',
    wokwiType: 'wokwi-neopixel', description: 'Alias for WS2812B — individually addressable RGB LED.',
    tags: ['neopixel', 'WS2812B', 'RGB', 'addressable'], realWorldUses: ['LED strips', 'Animations'],
    funFact: 'One wire controls hundreds of LEDs — each has its own chip inside!',
    pinout: [{ pin: 'DIN', description: 'Data input' }, { pin: '5V', description: 'Power' }, { pin: 'GND', description: 'Ground' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'npalias_q1', question: 'strip.show() does what?', options: ['Shows strip info', 'Sends color data to LEDs', 'Tests all pixels', 'Resets'], correct: 1, explanation: 'setPixelColor() updates RAM; show() transmits data to physical LEDs.' },
      { id: 'npalias_q2', question: 'Max current per WS2812B at full white:', options: ['10mA', '20mA', '60mA', '200mA'], correct: 2, explanation: 'Each WS2812B draws up to 60mA at R+G+B full brightness.' },
      { id: 'npalias_q3', question: 'Which library controls NeoPixels?', options: ['Wire.h', 'Adafruit_NeoPixel or FastLED', 'SPI.h', 'Servo.h'], correct: 1, explanation: 'Adafruit NeoPixel and FastLED are the two main libraries.' },
    ]},
  },
  { id: 'shield', name: 'Arduino Sensor Shield', category: 'Module', icon: '/components_examples/Arduino_Sensor_Shield_v5.0.png', color: '#64748b', difficulty: 'beginner',
    wokwiType: 'wokwi-arduino-sensor-shield', description: 'A shield that expands Arduino pins into easy 3-pin (VCC/GND/SIG) sensor connectors — no breadboard needed!',
    tags: ['shield', 'sensor', 'expansion', 'pins'],
    realWorldUses: ['Quick sensor connections', 'Robot projects', 'Education kits'],
    funFact: 'Sensor shields save time by providing VCC and GND next to each signal pin — no wiring mistakes!',
    pinout: [{ pin: 'Signal/VCC/GND', description: 'Each Arduino pin expanded to 3-pin servo-style connector' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'shield_q1', question: 'What does an Arduino sensor shield provide?', options: ['WiFi connectivity', '3-pin (VCC/GND/SIG) headers for each Arduino pin', 'More processing power', 'Bluetooth'], correct: 1, explanation: 'Sensor shields break out each Arduino pin into 3 pins: power, ground, and signal — perfect for connecting sensors.' },
      { id: 'shield_q2', question: 'Can you still access Arduino digital pins through a sensor shield?', options: ['No', 'Yes — the shield passes through all Arduino pins', 'Only analog pins', 'Only PWM pins'], correct: 1, explanation: 'Shields stack on top of Arduino — all pins are still accessible through the shield connectors.' },
      { id: 'shield_q3', question: 'Sensor shields are especially useful for:', options: ['Adding WiFi', 'Quickly connecting servo motors and sensors without breadboard', 'Increasing clock speed', 'Adding more RAM'], correct: 1, explanation: 'The 3-pin connectors match servo and most sensor module pinouts — plug and play without loose wires.' },
    ]},
  },

  { id: 'mpu6050', name: 'MPU6050 (Gyro + Accel)', category: 'Sensor', icon: '/components_examples/MPU6050_IMU_Sensor.png', color: '#14b8a6',
    difficulty: 'advanced', wokwiType: 'wokwi-mpu6050',
    description: '6-axis IMU with 3-axis gyroscope and 3-axis accelerometer. Detect tilt, rotation, and motion!',
    tags: ['mpu6050','gyroscope','accelerometer','IMU','I2C'],
    realWorldUses: ['Drones','Self-balancing robots','Phone rotation','Step counters'],
    funFact: 'MPU6050 measures rotation 1000x per second — the sensor keeping every drone level!',
    pinout: [{ pin: 'SDA', description: 'I2C data — A4' },{ pin: 'SCL', description: 'I2C clock — A5' },{ pin: 'INT', description: 'Interrupt output' }],
    quiz: { totalQuestions: 3, questions: [
      { id: 'mpu_a1', question: 'What does the MPU6050 combine?', options: ['Temp + humidity','3-axis gyro + 3-axis accelerometer','GPS + compass','Mic + speaker'], correct: 1, explanation: 'MPU6050 is a 6-DOF IMU — gyro measures rotation speed, accelerometer measures linear acceleration.' },
      { id: 'mpu_a2', question: 'MPU6050 I2C default address:', options: ['0x3C','0x27','0x68','0x40'], correct: 2, explanation: 'Default address is 0x68. AD0 pin HIGH changes it to 0x69.' },
      { id: 'mpu_a3', question: 'What does atan2() do with accelerometer data?', options: ['Measures speed','Converts X/Y/Z acceleration to tilt angle in degrees','Calibrates the sensor','Sets range'], correct: 1, explanation: 'atan2(ay,az)*180/PI gives pitch angle; atan2(-ax,az)*180/PI gives roll — tilt detection!' },
    ]},
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