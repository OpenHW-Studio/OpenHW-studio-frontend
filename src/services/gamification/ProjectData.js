// Project Data - Centralized data for all project phases
// This file contains flashcards, quiz questions, and component unlock data for each project
// Designed for easy teacher editing via future UI

// Component type mapping for backward compatibility
export const ID_TO_OPENHW = {
  'arduino': 'openhw-arduino-uno',
  'led': 'openhw-led',
  'resistor': 'openhw-resistor',
  'rgb-led': 'openhw-rgb-led',
  'button': 'openhw-pushbutton',
  'buzzer': 'openhw-buzzer',
  'potentiometer': 'openhw-potentiometer',
  'servo': 'openhw-servo',
  'dht11': 'openhw-ntc-temperature-sensor',
  'ultrasonic': 'openhw-hc-sr04',
  'lcd': 'openhw-lcd1602',
  'analog-joystick': 'openhw-analog-joystick',
  'wire': 'openhw-wire',
  'neopixel': 'openhw-neopixel-matrix',
  'ntc': 'openhw-ntc-temperature-sensor',
  'motor': 'openhw-motor',
  'motor-driver': 'openhw-motor-driver',
  'ldr': 'openhw-photoresistor',
  'relay': 'openhw-relay',
  'oled': 'openhw-ssd1306',
  'keypad': 'openhw-membrane-keypad',
  'rotary': 'openhw-rotary-encoder',
  '7segment': 'openhw-seven-segment',
  'stepper': 'openhw-stepper-motor',
  'mpu6050': 'openhw-mpu6050',
}

export const PROJECT_DATA = {
  // ===== LED BLINK =====
  'led-blink': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/LED.png',
        image: '/components_examples/LED.png',
        front: 'What is an LED?',
        simple: 'An LED is like a tiny magic light that NEVER burns out — and it runs on very little electricity!',
        detail: 'LED = Light Emitting Diode. When electricity enters the + side and exits the − side, it makes light! Unlike old bulbs, LEDs are super small, cool, and last for 100,000 hours.',
        funFact: '🌟 Cool fact: The screens on your phone use millions of microscopic LEDs!',
        quiz: {
          question: 'What does LED stand for?',
          options: ['Light Emitting Diode', 'Large Electric Device', 'Laser Energy Display', 'Low Electric Detector'],
          correctAnswer: 0
        }
      },
      {
        id: 2,
        emoji: '/components_examples/Resistor.png',
        image: '/components_examples/Resistor.png',
        front: 'Why do we NEED a resistor?',
        simple: 'A resistor is like a speed bump for electricity — without it, the LED gets TOO much power and DIES instantly!',
        detail: 'An LED needs only about 20mA of current. Arduino\'s pin gives 40mA — double! The resistor (220Ω) reduces it to the safe amount. It\'s like turning a fire hose into a garden hose.',
        funFact: '💥 Without a resistor: your LED burns out in less than 1 second. Always use one!',
        quiz: {
          question: 'What happens if you skip the resistor?',
          options: ['LED glows brighter', 'LED burns out!', 'Nothing changes', 'LED blinks faster'],
          correctAnswer: 1
        }
      },
      {
        id: 3,
        emoji: '/components_examples/UNO.png',
        image: '/components_examples/UNO.png',
        front: 'What does Arduino do?',
        simple: 'Arduino is a tiny computer that LISTENS to your code and does exactly what you say!',
        detail: 'Arduino has 14 digital pins. You can make them HIGH (5V = electricity) or LOW (0V = no electricity). Pin 13 is special — it has a tiny LED already built into the board!',
        funFact: '🤖 Arduino can control robots, alarms, displays, sensors and more — all from your code!',
        quiz: {
          question: 'When you set a pin to HIGH, what happens?',
          options: ['Pin turns off', '5 volts goes OUT from that pin', 'Arduino restarts', 'Nothing'],
          correctAnswer: 1
        }
      },
      {
        id: 4,
        emoji: '/components_examples/LED.png',
        image: '/components_examples/LED.png',
        front: 'LED legs — which is + and which is −?',
        simple: 'LEDs have TWO legs: a LONG one (+) and a SHORT one (−). Connect them the right way or it won\'t light up!',
        detail: 'The LONG leg (called "anode") connects to the positive side (through the resistor to Pin 13). The SHORT leg (called "cathode") connects to GND (ground = negative).',
        funFact: '💡 Memory trick: LONG = LIVE electricity | SHORT = GND (ground)',
        quiz: {
          question: 'Which leg of an LED connects to the resistor/Pin 13?',
          options: ['Short leg (−)', 'Either leg', 'Long leg (+)', 'No leg — just balance it'],
          correctAnswer: 2
        }
      },
      {
        id: 5,
        emoji: '/components_examples/Clock.png',
        image: '/components_examples/Clock.png',
        front: 'How does BLINK work in code?',
        simple: 'We say: Turn ON, wait 1 second, Turn OFF, wait 1 second, repeat FOREVER!',
        detail: 'void loop() {\n  digitalWrite(13, HIGH);  // ON\n  delay(1000);              // wait 1 sec\n  digitalWrite(13, LOW);   // OFF  \n  delay(1000);              // wait 1 sec\n}\nThe loop() function runs again and again — making your LED blink!',
        funFact: '⚡ Change delay(1000) to delay(100) and the LED blinks 10× faster! Try it!',
        quiz: {
          question: 'What does delay(500) do in Arduino?',
          options: ['Wait 500 minutes', 'Wait 0.5 seconds (500ms)', 'Blink 500 times', 'Set speed to 500'],
          correctAnswer: 1
        }
      }
    ],
    // Components that unlock when this project is completed
    unlockComponents: [
      { type: 'openhw-arduino-uno', name: 'Arduino Uno', icon: '/components_examples/UNO.png', color: '#22c55e', desc: 'Your project\'s BRAIN! It reads your code and follows every instruction.' },
      { type: 'openhw-led', name: 'LED', icon: '/components_examples/LED.png', color: '#f59e0b', desc: 'A tiny light that turns ON when electricity flows through it. Works forever unlike old bulbs!' },
      { type: 'openhw-resistor', name: '220Ω Resistor', icon: '/components_examples/Resistor.png', color: '#92400e', desc: 'A speed-bump for electricity. Keeps the LED safe from getting too much power!' },
      { type: 'openhw-wire', name: 'Wire', icon: '/components_examples/BreadBoard_full.png', color: '#64748b', desc: 'Connects all your parts together — like roads for electricity!' },
    ]
  },

  // ===== RGB LED =====
  'rgb-led': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/RBG_LED_4pin.png',
        image: '/components_examples/RBG_LED_4pin.png',
        front: 'How does an RGB LED work?',
        simple: 'An RGB LED is 3 LEDs in one tiny package — Red, Green, and Blue. Mix them to make ANY color!',
        detail: 'By controlling how bright each of R, G, B is (0–255), you can create 16 million colors! This is exactly how phone screens work.',
        funFact: '🎨 Red + Green = Yellow! Green + Blue = Cyan! All three = White!',
        quiz: {
          question: 'How many colors can an RGB LED make?',
          options: ['3 colors', '256 colors', '16 million colors', 'Only rainbow colors'],
          correctAnswer: 2
        }
      },
      {
        id: 2,
        emoji: '/components_examples/RBG_LED_4pin.png',
        image: '/components_examples/RBG_LED_4pin.png',
        front: 'How do you control RGB LED colors?',
        simple: 'Use analogWrite() with values from 0 (off) to 255 (full brightness) for each color!',
        detail: 'Each color pin needs its own resistor and Arduino pin. Red=9, Green=10, Blue=11. Use analogWrite(pin, 0-255) to set brightness.',
        funFact: '⚡ Start with (255,0,0) for red, then experiment!',
        quiz: {
          question: 'What value range does analogWrite() use?',
          options: ['0-1', '0-100', '0-255', '0-1024'],
          correctAnswer: 2
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-rgb-led', name: 'RGB LED', icon: '/components_examples/RBG_LED_4pin.png', color: '#a855f7', desc: 'Makes 16 million colors! Mix red, green, blue to create any color.' },
    ]
  },

  // ===== BUZZER =====
  'buzzer': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/Buzzer.png',
        image: '/components_examples/Buzzer.png',
        front: 'What is a buzzer?',
        simple: 'A buzzer makes sound! It vibrates when electricity flows through it.',
        detail: 'Buzzers have a positive (+) and negative (−) side. Connect to Arduino and use tone() to make different sounds.',
        funFact: '🎵 You can play songs with the right code!',
        quiz: {
          question: 'What function makes the buzzer produce sound?',
          options: ['play()', 'sound()', 'tone()', 'beep()'],
          correctAnswer: 2
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-buzzer', name: 'Buzzer', icon: '/components_examples/Buzzer.png', color: '#f97316', desc: 'Makes beeps and sounds! You can even play music with it.' },
    ]
  },

  // ===== BUTTON =====
  'button': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/Push_button.png',
        image: '/components_examples/Push_button.png',
        front: 'How does a button work?',
        simple: 'Buttons are simple switches — they connect or disconnect wires when you press them!',
        detail: 'Buttons need a resistor (pull-down) to work with Arduino. When pressed, the pin reads HIGH. When released, it reads LOW.',
        funFact: '💡 Use internal pull-up resistor for cleaner circuits!',
        quiz: {
          question: 'When pressed, what does digitalRead() return?',
          options: ['0', '1', 'HIGH', 'LOW'],
          correctAnswer: 2
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-pushbutton', name: 'Push Button', icon: '/components_examples/Push_button.png', color: '#3b82f6', desc: 'Control things with a press! Make your projects interactive.' },
    ]
  },

  // ===== POTENTIOMETER =====
  'potentiometer': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/Rotary_Potentiometer.png',
        image: '/components_examples/Rotary_Potentiometer.png',
        front: 'What is a potentiometer?',
        simple: 'A potentiometer is a tunable resistor — like a volume knob you can turn!',
        detail: 'It has 3 pins: left=0V, right=5V, middle=variable output. Use analogRead() to get values 0-1023.',
        funFact: '🎛️ Great for controlling LED brightness or motor speed!',
        quiz: {
          question: 'What range does analogRead() return for potentiometer?',
          options: ['0-5', '0-255', '0-1023', '0-100'],
          correctAnswer: 2
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-potentiometer', name: 'Potentiometer', icon: '/components_examples/Rotary_Potentiometer.png', color: '#14b8a6', desc: 'A tunable knob — control values from 0 to max!' },
    ]
  },

  // ===== SERVO MOTOR =====
  'servo': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/Servo_Motor.png',
        image: '/components_examples/Servo_Motor.png',
        front: 'What is a servo motor?',
        simple: 'A servo is a motor that can rotate to EXACT positions you tell it to!',
        detail: 'Servos rotate 0-180 degrees. Use the Servo library with attach() and write() to control exact angle.',
        funFact: '🤖 Used in robots, drones, and RC cars!',
        quiz: {
          question: 'How many degrees can a standard servo rotate?',
          options: ['90', '180', '360', '270'],
          correctAnswer: 1
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-servo', name: 'Servo Motor', icon: '/components_examples/Servo_Motor.png', color: '#8b5cf6', desc: 'A motor that turns to exact positions!' },
    ]
  },

  // ===== LDR (Light Dependent Resistor) =====
  'ldr': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/Phtoresistor_LDR.png',
        image: '/components_examples/Phtoresistor_LDR.png',
        front: 'What is an LDR?',
        simple: 'An LDR is a light sensor — it gets LESS resistance when it\'s brighter!',
        detail: 'LDR = Light Dependent Resistor. More light = lower resistance = higher voltage to Arduino analog pin.',
        funFact: '🌙 Use it to make automatic night lights!',
        quiz: {
          question: 'When it gets brighter, LDR resistance...',
          options: ['Increases', 'Decreases', 'Stays same', 'Fluctuates'],
          correctAnswer: 1
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-photoresistor', name: 'LDR Sensor', icon: '/components_examples/Phtoresistor_LDR.png', color: '#eab308', desc: 'A light sensor — lower resistance when brighter!' },
    ],
  },

  // ===== SERVO MOTOR (project: servo-motor) =====
  'servo-motor': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/Servo_Motor.png',
        image: '/components_examples/Servo_Motor.png',
        front: 'What is a servo motor?',
        simple: 'A servo is a motor that can rotate to EXACT positions you tell it to!',
        detail: 'Servos rotate 0-180 degrees. Use the Servo library with attach() and write() to control exact angle.',
        funFact: '🤖 Used in robots, robotic arms, drones, and RC cars!',
        quiz: {
          question: 'How many degrees can a standard servo rotate?',
          options: ['90°', '180°', '360°', '270°'],
          correctAnswer: 1
        }
      },
      {
        id: 2,
        emoji: '/components_examples/Servo_Motor.png',
        image: '/components_examples/Servo_Motor.png',
        front: 'How do you wire a servo?',
        simple: 'A servo has 3 wires: Power (+5V, red), Ground (GND, brown/black), and Signal (PWM pin, yellow/orange).',
        detail: 'Connect Signal to an Arduino digital pin (e.g. Pin 9). The Arduino sends pulse-width modulation (PWM) signals to command the target angle.',
        funFact: '⚡ The width of the pulse tells the servo what angle to hold!',
        quiz: {
          question: 'Which wire sends position instructions to the servo?',
          options: ['Power (Red)', 'Ground (Brown)', 'Signal (Yellow/Orange)', 'None'],
          correctAnswer: 2
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-servo', name: 'Servo Motor', icon: '/components_examples/Servo_Motor.png', color: '#8b5cf6', desc: 'A motor that turns to exact angular positions!' },
    ],
  },

  // ===== LED STRIP (project: led-strip) =====
  'led-strip': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/WS2812B_RGB_LED.png',
        image: '/components_examples/WS2812B_RGB_LED.png',
        front: 'What makes NeoPixel strips special?',
        simple: 'Each LED has a built-in microchip! You can set every single LED to a different color using just ONE data pin.',
        detail: 'Addressable RGB LEDs (WS2812B) chain together. Arduino sends data down the line, and each LED reads its own color instruction.',
        funFact: '🌈 You can control thousands of LEDs with a single Arduino pin!',
        quiz: {
          question: 'How many data pins are needed to control a WS2812B LED strip?',
          options: ['1 pin', '3 pins (R, G, B)', '12 pins', 'One pin per LED'],
          correctAnswer: 0
        }
      },
      {
        id: 2,
        emoji: '/components_examples/WS2812B_RGB_LED.png',
        image: '/components_examples/WS2812B_RGB_LED.png',
        front: 'What is Data In (DIN) and Data Out (DOUT)?',
        simple: 'Data travels in ONE direction along the strip — always connect Arduino to DIN!',
        detail: 'Arrows printed on the strip show the direction electricity and data travel. If you connect to DOUT by mistake, the strip will stay dark.',
        funFact: '💡 Tip: Always connect GND first to protect the strip controller.',
        quiz: {
          question: 'Which pin on the NeoPixel strip connects to your Arduino output?',
          options: ['DOUT', 'DIN', 'GND only', 'Either side'],
          correctAnswer: 1
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-neopixel-matrix', name: 'NeoPixel LED Strip', icon: '/components_examples/WS2812B_RGB_LED.png', color: '#ec4899', desc: 'Individually addressable RGB LEDs on a flexible strip.' },
    ],
  },

  // ===== BUTTON DEBOUNCE (project: button-debounce) =====
  'button-debounce': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/Push_button.png',
        image: '/components_examples/Push_button.png',
        front: 'What is button bouncing?',
        simple: 'When you press a mechanical button, metal contacts bounce microscopically for milliseconds, causing fake multiple presses!',
        detail: 'In the microscopic world, pressing a switch looks like dozens of rapid ON/OFF cycles. Microcontrollers are fast enough to detect all of them!',
        funFact: '⏱️ Debouncing waits 20-50 milliseconds to let the metal settle before reading the state.',
        quiz: {
          question: 'What causes button bounce?',
          options: ['Weak battery', 'Microscopic mechanical vibration of contacts', 'Wrong code', 'Hot wires'],
          correctAnswer: 1
        }
      },
      {
        id: 2,
        emoji: '/components_examples/Clock.png',
        image: '/components_examples/Clock.png',
        front: 'How does software debouncing work?',
        simple: 'We use millis() to record the time of the last press and ignore any changes that happen too quickly!',
        detail: 'By checking if (current_time - last_time > debounce_delay), code ensures only real, intentional presses trigger actions.',
        funFact: '⏱️ millis() returns the number of milliseconds since your Arduino started!',
        quiz: {
          question: 'What Arduino function measures elapsed time without pausing code?',
          options: ['delay()', 'millis()', 'timer()', 'clock()'],
          correctAnswer: 1
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-pushbutton', name: 'Debounced Push Button', icon: '/components_examples/Push_button.png', color: '#14b8a6', desc: 'Tactile switch with hardware and software debouncing.' },
    ],
  },

  // ===== TEMPERATURE SENSOR (project: temperature-sensor) =====
  'temperature-sensor': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/Temperature_Sensor_NTC.png',
        image: '/components_examples/Temperature_Sensor_NTC.png',
        front: 'How does an NTC thermistor work?',
        simple: 'An NTC thermistor changes resistance based on temperature — hotter temperatures mean LOWER electrical resistance!',
        detail: 'NTC = Negative Temperature Coefficient. As heat excites electrons in the semiconductor material, electricity flows more easily.',
        funFact: '🔥 Used in 3D printers, car engines, and home air conditioners!',
        quiz: {
          question: 'When an NTC thermistor gets hotter, what happens to its resistance?',
          options: ['It increases', 'It drops lower', 'It stays zero', 'It doubles'],
          correctAnswer: 1
        }
      },
      {
        id: 2,
        emoji: '/components_examples/Resistor.png',
        image: '/components_examples/Resistor.png',
        front: 'What is a voltage divider?',
        simple: 'A circuit with two resistors that divides voltage so Arduino analog pins can read sensor resistance!',
        detail: 'Arduino can only read voltage (0-5V), not raw resistance. A 10kΩ fixed resistor paired with the thermistor produces a voltage proportional to heat.',
        funFact: '📐 Voltage dividers are the secret weapon for almost every analog sensor!',
        quiz: {
          question: 'Why do we need a 10kΩ resistor with the thermistor?',
          options: ['To light it up', 'To form a voltage divider circuit', 'To stop fire', 'To store memory'],
          correctAnswer: 1
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-ntc-temperature-sensor', name: 'NTC Temperature Sensor', icon: '/components_examples/Temperature_Sensor_NTC.png', color: '#ef4444', desc: 'Precision temperature sensor for thermal monitoring.' },
    ],
  },

  // ===== DC MOTOR (project: dc-motor) =====
  'dc-motor': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/DC_Motor.png',
        image: '/components_examples/DC_Motor.png',
        front: 'Why can\'t Arduino pins power a motor directly?',
        simple: 'DC motors are power-hungry! Arduino pins can only supply 40mA, but motors need 200mA to 2000mA!',
        detail: 'Connecting a motor directly to an Arduino pin can permanently fry the microcontroller chip. We always use an external driver circuit.',
        funFact: '⚡ Motors also generate reverse voltage spikes (flyback EMF) when stopped!',
        quiz: {
          question: 'What happens if you power a high-current motor directly from an Arduino digital pin?',
          options: ['Runs at lightspeed', 'Damages the Arduino microcontroller', 'Battery charges up', 'Nothing happens'],
          correctAnswer: 1
        }
      },
      {
        id: 2,
        emoji: '/components_examples/Motor_Driver_L293D.png',
        image: '/components_examples/Motor_Driver_L293D.png',
        front: 'What is an H-Bridge motor driver?',
        simple: 'An H-Bridge allows you to run a DC motor forward, backward, and control its speed using PWM!',
        detail: 'Chips like the L293D or L298N use 4 internal switches arranged like the letter H to reverse current direction through the motor coils.',
        funFact: '🚗 Every remote control car and combat robot uses an H-Bridge!',
        quiz: {
          question: 'How do you reverse a DC motor with an H-Bridge?',
          options: ['Turn the battery upside down', 'Reverse the polarity of current through the motor', 'Shake the motor', 'Send negative frequency'],
          correctAnswer: 1
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-motor', name: 'DC Motor', icon: '/components_examples/DC_Motor.png', color: '#f97316', desc: 'Rotary DC motor for robotic wheels and propellers.' },
      { type: 'openhw-motor-driver', name: 'L293D Motor Driver', icon: '/components_examples/Motor_Driver_L293D.png', color: '#78716c', desc: 'Dual H-Bridge chip to control motor direction and speed safely.' },
    ],
  },

  // ===== PUSH BUTTON (project: push-button) =====
  'push-button': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/Push_button.png',
        image: '/components_examples/Push_button.png',
        front: 'What is INPUT_PULLUP?',
        simple: 'Arduino has secret built-in resistors! pinMode(pin, INPUT_PULLUP) keeps the pin HIGH until you press the button to GND.',
        detail: 'Without a pull-up or pull-down resistor, an input pin "floats" in the air and picks up random static noise from the room!',
        funFact: '💡 Using INPUT_PULLUP eliminates the need for an external resistor on your breadboard.',
        quiz: {
          question: 'When using INPUT_PULLUP, what does digitalRead() return when pressed to GND?',
          options: ['HIGH (1)', 'LOW (0)', '255', 'Random noise'],
          correctAnswer: 1
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-pushbutton', name: 'Push Button', icon: '/components_examples/Push_button.png', color: '#06b6d4', desc: 'Read user button presses and trigger hardware events!' },
    ],
  },

  // ===== ULTRASONIC SENSOR (project: ultrasonic-sensor) =====
  'ultrasonic-sensor': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/Ultrasonic_Sensor.png',
        image: '/components_examples/Ultrasonic_Sensor.png',
        front: 'How does ultrasonic distance sensing work?',
        simple: 'It uses echolocation like bats! It sends a high-frequency sound wave and measures how long it takes to bounce back.',
        detail: 'The HC-SR04 Trig pin sends a 40kHz acoustic burst. The Echo pin stays HIGH for the exact duration until the reflection returns.',
        funFact: '🦇 Bats, dolphins, and submarines all navigate using the exact same physics principle!',
        quiz: {
          question: 'What type of waves does an ultrasonic sensor emit?',
          options: ['Infrared light', 'High-frequency sound waves', 'X-rays', 'Radio waves'],
          correctAnswer: 1
        }
      },
      {
        id: 2,
        emoji: '/components_examples/Ultrasonic_Sensor.png',
        image: '/components_examples/Ultrasonic_Sensor.png',
        front: 'How do you calculate distance in code?',
        simple: 'Distance = (Travel Time × Speed of Sound) / 2!',
        detail: 'Sound travels at ~343 meters per second (0.0343 cm per microsecond). We divide by 2 because the sound goes to the object AND comes back.',
        funFact: '🎯 The HC-SR04 can measure objects accurately from 2cm to 400cm!',
        quiz: {
          question: 'Why do we divide the pulse duration by 2 when calculating distance?',
          options: ['Because Arduino has 2 cores', 'Sound travels to target AND echoes back', 'To convert to inches', 'For safety'],
          correctAnswer: 1
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-hc-sr04', name: 'HC-SR04 Ultrasonic', icon: '/components_examples/Ultrasonic_Sensor.png', color: '#3b82f6', desc: 'Measures distances from 2cm to 400cm with acoustic sonar!' },
    ],
  },

  // ===== DHT11 SENSOR (project: dht11-sensor) =====
  'dht11-sensor': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/DHT22.png',
        image: '/components_examples/DHT22.png',
        front: 'What does a DHT11 sensor measure?',
        simple: 'It measures both relative humidity and ambient temperature at the same time!',
        detail: 'Inside the blue plastic housing is a capacitive humidity sensing element, a thermistor, and a tiny chip that calibrates and digitizes the signal.',
        funFact: '🌿 Perfect for automated greenhouses and weather forecast stations!',
        quiz: {
          question: 'What two climate variables does DHT11 measure?',
          options: ['Wind and rain', 'Humidity and temperature', 'Pressure and altitude', 'Light and sound'],
          correctAnswer: 1
        }
      },
      {
        id: 2,
        emoji: '/components_examples/DHT22.png',
        image: '/components_examples/DHT22.png',
        front: 'How does DHT11 transmit data?',
        simple: 'It sends a digital 40-bit packet over a single wire with checksum verification!',
        detail: 'The sensor transmits 16 bits of humidity data, 16 bits of temperature data, and an 8-bit checksum byte to prevent reading corrupted values.',
        funFact: '⏱️ DHT11 can be sampled once every 1-2 seconds.',
        quiz: {
          question: 'How is data transmitted from the DHT11 to Arduino?',
          options: ['Analog voltage', 'Single-wire digital protocol', 'WiFi', 'Bluetooth'],
          correctAnswer: 1
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-dht22', name: 'DHT11 Sensor', icon: '/components_examples/DHT22.png', color: '#10b981', desc: 'Digital sensor for relative humidity and ambient temperature.' },
    ],
  },

  // ===== LCD DISPLAY (project: lcd-display) =====
  'lcd-display': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/LCD_16x2_I2C.png',
        image: '/components_examples/LCD_16x2_I2C.png',
        front: 'What does "16x2 LCD" mean?',
        simple: 'It can display 2 rows of text with 16 characters in each row — 32 characters total!',
        detail: 'Each character is rendered on a 5x8 grid of liquid crystal dots. It contains a built-in character ROM chip for standard ASCII letters and numbers.',
        funFact: '👾 You can create up to 8 custom pixel characters like hearts, pacman, or battery icons!',
        quiz: {
          question: 'How many characters can a 16x2 LCD display simultaneously?',
          options: ['16', '32', '64', '128'],
          correctAnswer: 1
        }
      },
      {
        id: 2,
        emoji: '/components_examples/LCD_16x2_I2C.png',
        image: '/components_examples/LCD_16x2_I2C.png',
        front: 'Why use an I2C adapter for LCD?',
        simple: 'Standard LCDs require 16 pins, but with an I2C backpack adapter you only need 2 pins (SDA & SCL)!',
        detail: 'The I2C chip (PCF8574) converts serial data into 8-bit parallel signals for the display, leaving almost all your Arduino pins free for sensors.',
        funFact: '📡 I2C allows multiple different devices to share the exact same two pins!',
        quiz: {
          question: 'How many data pins does an I2C LCD need from Arduino?',
          options: ['2 pins (SDA & SCL)', '8 pins', '16 pins', 'None'],
          correctAnswer: 0
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-lcd1602', name: '16x2 I2C LCD', icon: '/components_examples/LCD_16x2_I2C.png', color: '#6366f1', desc: 'Crisp alphanumeric display module for status text and menus.' },
    ],
  },

  // ===== RELAY CONTROL (project: relay-control) =====
  'relay-control': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/Relay_Module.png',
        image: '/components_examples/Relay_Module.png',
        front: 'What is an electromechanical relay?',
        simple: 'A relay is an electrically operated switch that lets a 5V Arduino safely turn on heavy 120V/240V appliances!',
        detail: 'Arduino sends 5V to energize an internal magnetic coil. The electromagnet physically pulls an iron armature to snap contacts shut with a click.',
        funFact: '🔊 That satisfying "click" sound you hear is the mechanical switch snapping closed!',
        quiz: {
          question: 'What physically closes the contacts inside an electromechanical relay?',
          options: ['A tiny motor', 'An electromagnet coil', 'A heating element', 'Air pressure'],
          correctAnswer: 1
        }
      },
      {
        id: 2,
        emoji: '/components_examples/Relay_Module.png',
        image: '/components_examples/Relay_Module.png',
        front: 'What are NO and NC terminals?',
        simple: 'NO = Normally Open (off until triggered). NC = Normally Closed (on until triggered).',
        detail: 'COM is the common power wire. When the relay is unpowered, COM is connected to NC. When activated, COM switches to NO.',
        funFact: '🛡️ Optical isolators on relay boards protect your Arduino from dangerous power surges.',
        quiz: {
          question: 'Which terminal connects power only when you send a HIGH signal from Arduino?',
          options: ['NC (Normally Closed)', 'NO (Normally Open)', 'GND', 'VCC'],
          correctAnswer: 1
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-relay', name: '5V Relay Module', icon: '/components_examples/Relay_Module.png', color: '#ef4444', desc: 'Safely switches high-voltage and high-current AC/DC circuits.' },
    ],
  },

  // ===== OLED GRAPHICS (project: oled-graphics) =====
  'oled-graphics': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/SSD1306_Oled_128x64.png',
        image: '/components_examples/SSD1306_Oled_128x64.png',
        front: 'What makes OLED displays superior to LCDs?',
        simple: 'Every single pixel on an OLED creates its own light! There is no backlight, making blacks pure black and contrast incredible.',
        detail: 'OLED = Organic Light Emitting Diode. With 128x64 resolution, you have 8,192 individual micro-LEDs that can be controlled over I2C.',
        funFact: '🕶️ When displaying black pixels, an OLED draws almost zero electric power!',
        quiz: {
          question: 'Why do OLED displays have such deep black levels?',
          options: ['Black paint on glass', 'Black pixels are completely turned off', 'Extra dark backlight', 'Polarized filter'],
          correctAnswer: 1
        }
      },
      {
        id: 2,
        emoji: '/components_examples/SSD1306_Oled_128x64.png',
        image: '/components_examples/SSD1306_Oled_128x64.png',
        front: 'How do graphics libraries render images?',
        simple: 'You draw lines, circles, and text into Arduino memory first, then call display() to paint it all onto the screen!',
        detail: 'The frame buffer holds the complete 128x64 bitmap in RAM. Calling display() pushes the buffered pixels over I2C in one quick burst.',
        funFact: '👾 You can create retro games like Pong and Snake right on an Arduino with OLED!',
        quiz: {
          question: 'What function sends the drawn graphics from memory to the physical screen?',
          options: ['display()', 'paint()', 'flush()', 'draw()'],
          correctAnswer: 0
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-ssd1306', name: 'SSD1306 OLED Display', icon: '/components_examples/SSD1306_Oled_128x64.png', color: '#38bdf8', desc: '128x64 monochrome graphics display for animations and telemetry.' },
    ],
  },

  // ===== NEOPIXEL EFFECTS (project: neopixel-effects) =====
  'neopixel-effects': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/NeoPixel_Ring.png',
        image: '/components_examples/NeoPixel_Ring.png',
        front: 'How do rainbow animations work?',
        simple: 'We cycle through the color wheel using HSV (Hue, Saturation, Value) math to produce smooth rainbow waves!',
        detail: 'By shifting the hue value slightly for each adjacent LED on each frame loop, you create moving rainbow and pulse effects.',
        funFact: '🎆 Hollywood movies and concerts use thousands of addressable LEDs for stage lighting!',
        quiz: {
          question: 'What color space is easiest for calculating smooth rainbow transitions?',
          options: ['RGB', 'HSV (Hue, Saturation, Value)', 'CMYK', 'Grayscale'],
          correctAnswer: 1
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-neopixel-matrix', name: 'NeoPixel Matrix', icon: '/components_examples/MAX7219_Dot_Matrix.png', color: '#ec4899', desc: 'Grid of addressable RGB LEDs for animations and sprite graphics.' },
    ],
  },

  // ===== KEYPAD LOCK (project: keypad-lock) =====
  'keypad-lock': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/Membrane_Keypad.png',
        image: '/components_examples/Membrane_Keypad.png',
        front: 'How does a matrix keypad read 16 buttons with only 8 wires?',
        simple: 'It arranges buttons into 4 Rows and 4 Columns! Arduino scans one row at a time and checks which column connects.',
        detail: 'If every button had its own wire, 16 keys would need 17 pins! Multiplexing rows and columns reduces the required pins to 4 + 4 = 8.',
        funFact: '🔐 Used in ATMs, security doors, calculators, and telephone keypads!',
        quiz: {
          question: 'How many pins are saved by multiplexing a 4x4 keypad instead of separate wires for each key?',
          options: ['0 pins', '8 pins saved', '1 pin saved', '4 pins saved'],
          correctAnswer: 1
        }
      },
      {
        id: 2,
        emoji: '/components_examples/Membrane_Keypad.png',
        image: '/components_examples/Membrane_Keypad.png',
        front: 'How does a PIN code verification work in code?',
        simple: 'Store each entered key in an array, and check if it matches the secret password when the user presses Enter (#)!',
        detail: 'If a match occurs, Arduino triggers an action (like energizing a relay or turning on a green LED). If incorrect, it clears the buffer and alerts.',
        funFact: '🛡️ Adding a lockout delay after 3 failed attempts prevents brute-force guessing!',
        quiz: {
          question: 'What character is commonly used as the "Enter" key on standard telephone keypads?',
          options: ['*', '#', '0', 'A'],
          correctAnswer: 1
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-membrane-keypad', name: '4x4 Matrix Keypad', icon: '/components_examples/Membrane_Keypad.png', color: '#8b5cf6', desc: '16-button input panel for numeric passcodes and navigation.' },
    ],
  },

  // ===== ROTARY MENU (project: rotary-menu) =====
  'rotary-menu': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/Rotary_Encoder.png',
        image: '/components_examples/Rotary_Encoder.png',
        front: 'How is a rotary encoder different from a potentiometer?',
        simple: 'A rotary encoder spins continuously forever without stops! It outputs digital quadrature pulses as you turn it.',
        detail: 'Potentiometers have physical start and end limits. Encoders can spin infinitely in either direction, perfect for scrolling through endless UI menus.',
        funFact: '🏎️ The clicky scroll wheel on your computer mouse is a rotary encoder!',
        quiz: {
          question: 'Can a rotary encoder spin 360 degrees continuously?',
          options: ['No, only 180 degrees', 'Yes, it turns infinitely in both directions', 'Only clockwise', 'Only when powered off'],
          correctAnswer: 1
        }
      },
      {
        id: 2,
        emoji: '/components_examples/Rotary_Encoder.png',
        image: '/components_examples/Rotary_Encoder.png',
        front: 'How does Arduino know which way you turned?',
        simple: 'It reads two pins (CLK and DT). Whichever pin changes state first tells the microcontroller whether you turned Clockwise or Counter-Clockwise!',
        detail: 'This 90-degree phase shift is called quadrature encoding. An integrated push button on the shaft lets you click to select items.',
        funFact: '🕹️ Rotary encoders are used on luxury car volume dials and medical equipment.',
        quiz: {
          question: 'What allows code to determine the direction of rotation?',
          options: ['Voltage level', 'Phase timing difference between CLK and DT pins', 'Heat sensor', 'Motor feedback'],
          correctAnswer: 1
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-rotary-encoder', name: 'Rotary Encoder', icon: '/components_examples/Rotary_Encoder.png', color: '#0ea5e9', desc: 'Continuous rotary dial with tactile steps and push-button select.' },
    ],
  },

  // ===== SEVEN SEGMENT CLOCK (project: seven-segment-clock) =====
  'seven-segment-clock': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/Seven_Segment_Display_TM1637.png',
        image: '/components_examples/Seven_Segment_Display_TM1637.png',
        front: 'How do seven segment displays form numbers?',
        simple: '7 LED segments arranged in a figure-8 shape light up in patterns to form digits 0 through 9!',
        detail: 'The segments are labeled A through G (plus DP for decimal point). Lighting A, B, C, D, and G forms the digit 3.',
        funFact: '📟 Invented in 1908, 7-segment displays are still the most legible numeric displays under bright sunlight!',
        quiz: {
          question: 'How many LED bars form each numeric digit?',
          options: ['5', '7', '8', '10'],
          correctAnswer: 1
        }
      },
      {
        id: 2,
        emoji: '/components_examples/Seven_Segment_Display_TM1637.png',
        image: '/components_examples/Seven_Segment_Display_TM1637.png',
        front: 'What is persistence of vision (POV)?',
        simple: 'Displays flicker each digit on and off so fast (100+ times a second) that human eyes see all 4 digits lit simultaneously!',
        detail: 'Multiplexing saves dozens of wires. A TM1637 controller chip automates this high-speed multiplexing and communicates with Arduino using only 2 pins.',
        funFact: '🎬 Movies work the same way — 24 still pictures per second look like fluid movement!',
        quiz: {
          question: 'What human eye phenomenon makes multiplexed flashing digits look steady?',
          options: ['Color blindness', 'Persistence of vision', 'Tunnel vision', 'Pupil dilation'],
          correctAnswer: 1
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-seven-segment', name: 'TM1637 4-Digit Display', icon: '/components_examples/Seven_Segment_Display_TM1637.png', color: '#f59e0b', desc: '4-digit LED clock display with center colon indicator.' },
    ],
  },

  // ===== STEPPER MOTOR (project: stepper-motor) =====
  'stepper-motor': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/Stepper_Motor_Bipolar.png',
        image: '/components_examples/Stepper_Motor_Bipolar.png',
        front: 'What is a stepper motor?',
        simple: 'A motor that moves in tiny, exact steps (e.g. 1.8° per step) without needing position feedback sensors!',
        detail: 'A standard 200-step motor divides a full circle into 200 precise positions. Send 50 step pulses and it rotates exactly 90 degrees.',
        funFact: '🖨️ 3D printers, CNC mills, and robotic surgery arms rely on stepper motors for millimeter precision!',
        quiz: {
          question: 'Why are stepper motors used in 3D printers?',
          options: ['They spin at 10,000 RPM', 'They can move to precise, repeatable step angles', 'They use solar power', 'They are silent'],
          correctAnswer: 1
        }
      },
      {
        id: 2,
        emoji: '/components_examples/A4988_Stepper_Driver.png',
        image: '/components_examples/A4988_Stepper_Driver.png',
        front: 'How do stepper coils produce motion?',
        simple: 'Electromagnets arranged in a circle are energized one after another to pull an iron rotor tooth forward!',
        detail: 'Drivers like the A4988 take simple STEP and DIR pulses from Arduino and handle energizing the motor coils with high voltage and current.',
        funFact: '⚡ Stepper motors have maximum holding torque when stationary holding a position.',
        quiz: {
          question: 'What signals does a standard stepper driver need from Arduino?',
          options: ['Step and Direction (DIR)', 'Analog 0-5V', 'Serial string', 'WiFi'],
          correctAnswer: 0
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-stepper-motor', name: 'Bipolar Stepper Motor', icon: '/components_examples/Stepper_Motor_Bipolar.png', color: '#10b981', desc: 'Precision angle control motor for 3D printers and robotics.' },
    ],
  },

  // ===== MPU6050 TILT SENSOR (project: mpu6050-tilt) =====
  'mpu6050-tilt': {
    flashcards: [
      {
        id: 1,
        emoji: '/components_examples/MPU6050_IMU_Sensor.png',
        image: '/components_examples/MPU6050_IMU_Sensor.png',
        front: 'What is an IMU sensor?',
        simple: 'IMU = Inertial Measurement Unit. It combines a 3-axis accelerometer and a 3-axis gyroscope on a single silicon chip!',
        detail: 'The accelerometer senses gravity and acceleration (X, Y, Z). The gyroscope measures rotational velocity (degrees per second).',
        funFact: '📱 Your smartphone uses an IMU to rotate the screen when you turn your phone sideways!',
        quiz: {
          question: 'What two instruments are combined inside the MPU6050?',
          options: ['Compass and GPS', 'Accelerometer and Gyroscope', 'Barometer and Thermometer', 'Microphone and Speaker'],
          correctAnswer: 1
        }
      },
      {
        id: 2,
        emoji: '/components_examples/MPU6050_IMU_Sensor.png',
        image: '/components_examples/MPU6050_IMU_Sensor.png',
        front: 'How does motion tracking calculate orientation?',
        simple: 'By combining gravity readings with gyro rotation rates, math formulas calculate exact Roll, Pitch, and Yaw angles!',
        detail: 'Drones and rockets use sensor fusion (Complementary or Kalman filters) on MPU6050 data to stay balanced in the air thousands of times every second.',
        funFact: '🚀 Drones cannot fly without an IMU calculating tilt every few milliseconds!',
        quiz: {
          question: 'What communication protocol does the MPU6050 use with Arduino?',
          options: ['I2C (SDA & SCL)', 'Ethernet', 'Parallel 8-bit', 'Morse code'],
          correctAnswer: 0
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-mpu6050', name: 'MPU6050 IMU Sensor', icon: '/components_examples/MPU6050_IMU_Sensor.png', color: '#6366f1', desc: '6-Degrees-of-Freedom motion sensor with 3-axis gyro and 3-axis accelerometer.' },
    ],
  },

  // ===== ALL UNLOCKED =====
  'all-unlocked': {
    flashcards: [],
    unlockComponents: [
      { type: '*', name: 'ALL Components Unlocked!', icon: '/components_examples/UNO.png', color: '#fbbf24', desc: 'You completed every project! Build anything!' },
    ],
  },
}

// Default flashcards for projects not in the data
export const DEFAULT_FLASHCARDS = [
  {
    id: 1,
    emoji: '/components_examples/UNO.png',
    image: '/components_examples/UNO.png',
    front: 'What is this component?',
    simple: 'This component is essential for your project. It helps complete the circuit and works with your Arduino!',
    detail: 'Components are the building blocks of electronics. Each has a specific purpose and connects to your Arduino to create amazing projects.',
    funFact: '🔧 Every expert started by learning about individual components first!',
    quiz: {
      question: 'Why is it important to understand this component?',
      options: ['To break it', 'To use it correctly in circuits', 'To sell it', 'To ignore it'],
      correctAnswer: 1
    }
  },
  {
    id: 2,
    emoji: '/components_examples/BreadBoard_full.png',
    image: '/components_examples/BreadBoard_full.png',
    front: 'How do you connect it?',
    simple: 'Connect the component legs to the correct Arduino pins following the circuit diagram.',
    detail: 'Always double-check your connections. The wrong pin or reversed polarity can prevent your circuit from working.',
    funFact: '🔍 Tip: Always verify connections before powering on!',
    quiz: {
      question: 'What should you check before powering your circuit?',
      options: ['Nothing', 'All connections', 'Only the code', 'Only the battery'],
      correctAnswer: 1
    }
  }
]

// Default components for projects not in the data
export const DEFAULT_UNLOCK_COMPONENTS = [
  { id: 'arduino', name: 'Arduino Uno', icon: '/components_examples/UNO.png', color: '#22c55e', desc: 'Your project\'s brain!' },
  { id: 'component', name: 'Component', icon: '/components_examples/LED.png', color: '#3b82f6', desc: 'Essential for your project.' },
]

// Helper function to get flashcards for a project
export function getProjectFlashcards(projectSlug) {
  let cards = PROJECT_DATA[projectSlug]?.flashcards;
  if ((!cards || cards.length === 0) && projectSlug === 'servo-motor') {
    cards = PROJECT_DATA['servo']?.flashcards;
  }
  return (cards && cards.length > 0) ? cards : DEFAULT_FLASHCARDS;
}

// Helper function to get quiz questions for a project
export function getProjectQuizzes(projectSlug) {
  const flashcards = getProjectFlashcards(projectSlug)
  return flashcards.map(card => ({
    id: card.id,
    front: card.front,
    quiz: card.quiz
  }))
}

// Helper function to get unlock components for a project
export function getUnlockComponents(projectSlug) {
  if (PROJECT_DATA[projectSlug]?.unlockComponents?.length > 0) {
    return PROJECT_DATA[projectSlug].unlockComponents;
  }
  if (projectSlug === 'servo-motor' && PROJECT_DATA['servo']?.unlockComponents?.length > 0) {
    return PROJECT_DATA['servo'].unlockComponents;
  }
  return DEFAULT_UNLOCK_COMPONENTS;
}

// Helper function to get openhw type for a component
export function getOpenhwType(componentId) {
  return ID_TO_OPENHW[componentId] || null
}