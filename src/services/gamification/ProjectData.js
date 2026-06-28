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
}

export const PROJECT_DATA = {
  // ===== LED BLINK =====
  'led-blink': {
    flashcards: [
      {
        id: 1,
        emoji: '💡',
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
        emoji: '🟤',
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
        emoji: '🟩',
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
        emoji: '📌',
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
        emoji: '⏱️',
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
       { type: 'openhw-arduino-uno', name: 'Arduino Uno', icon: '🟩', color: '#22c55e', desc: 'Your project\'s BRAIN! It reads your code and follows every instruction.' },
       { type: 'openhw-led', name: 'LED', icon: '💡', color: '#f59e0b', desc: 'A tiny light that turns ON when electricity flows through it. Works forever unlike old bulbs!' },
       { type: 'openhw-resistor', name: '220Ω Resistor', icon: '🟤', color: '#92400e', desc: 'A speed-bump for electricity. Keeps the LED safe from getting too much power!' },
       { type: 'openhw-wire', name: 'Wire', icon: '〰️', color: '#64748b', desc: 'Connects all your parts together — like roads for electricity!' },
     ]
  },

  // ===== RGB LED =====
  'rgb-led': {
    flashcards: [
      {
        id: 1,
        emoji: '🌈',
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
        emoji: '🔌',
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
       { type: 'openhw-rgb-led', name: 'RGB LED', icon: '🌈', color: '#a855f7', desc: 'Makes 16 million colors! Mix red, green, blue to create any color.' },
     ]
  },

  // ===== BUZZER =====
  'buzzer': {
    flashcards: [
      {
        id: 1,
        emoji: '🔔',
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
       { type: 'openhw-buzzer', name: 'Buzzer', icon: '🔔', color: '#f97316', desc: 'Makes beeps and sounds! You can even play music with it.' },
     ]
  },

  // ===== BUTTON =====
  'button': {
    flashcards: [
      {
        id: 1,
        emoji: '🔘',
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
       { type: 'openhw-pushbutton', name: 'Push Button', icon: '🔘', color: '#3b82f6', desc: 'Control things with a press! Make your projects interactive.' },
     ]
  },

  // ===== POTENTIOMETER =====
  'potentiometer': {
    flashcards: [
      {
        id: 1,
        emoji: '🎚️',
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
       { type: 'openhw-potentiometer', name: 'Potentiometer', icon: '🎚️', color: '#14b8a6', desc: 'A tunable knob — control values from 0 to max!' },
     ]
  },

  // ===== SERVO MOTOR =====
  'servo': {
    flashcards: [
      {
        id: 1,
        emoji: '⚙️',
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
       { type: 'openhw-servo', name: 'Servo Motor', icon: '⚙️', color: '#8b5cf6', desc: 'A motor that turns to exact positions!' },
     ]
  },

  // ===== LDR (Light Dependent Resistor) =====
  'ldr': {
    flashcards: [
      {
        id: 1,
        emoji: '☀️',
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
        { type: 'openhw-photoresistor', name: 'LDR Sensor', icon: '☀️', color: '#eab308', desc: 'A light sensor — lower resistance when brighter!' },
      ]
  },

  // ===== SERVO MOTOR (project: servo-motor) =====
  'servo-motor': {
    flashcards: [],
unlockComponents: [
       { type: 'openhw-neopixel-matrix', name: 'NeoPixel LED Strip', icon: '✨', color: '#ec4899', desc: 'Colorful LEDs you can control individually!' },
     ]
  },

  // ===== LED STRIP (project: led-strip) =====
  'led-strip': {
    flashcards: [],
unlockComponents: [
       { type: 'openhw-pushbutton', name: 'Push Button', icon: '🔘', color: '#14b8a6', desc: 'Press it to trigger things!' },
     ]
  },

  // ===== BUTTON DEBOUNCE (project: button-debounce) =====
  'button-debounce': {
    flashcards: [],
unlockComponents: [
       { type: 'openhw-ntc-temperature-sensor', name: 'Temperature Sensor', icon: '🌡️', color: '#ef4444', desc: 'Measures how hot or cold it is!' },
     ]
  },

  // ===== TEMPERATURE SENSOR (project: temperature-sensor) =====
  'temperature-sensor': {
    flashcards: [],
unlockComponents: [
       { type: 'openhw-motor', name: 'DC Motor', icon: '🔩', color: '#f97316', desc: 'Spins at any speed you want!' },
       { type: 'openhw-motor-driver', name: 'Motor Driver (L293D)', icon: '🔌', color: '#78716c', desc: 'Controls the motor — gives it power!' },
     ]
  },

  // ===== TRAFFIC LIGHT (project: traffic-light) =====
  'traffic-light': {
    flashcards: [
      {
        id: 1,
        emoji: '🚦',
        front: 'What makes a traffic light?',
        simple: 'A traffic light uses 3 LEDs: Red, Yellow, and Green to tell cars what to do!',
        detail: 'In electronics, you can control multiple LEDs by assigning each one to a different digital pin on the Arduino.',
        funFact: '🚗 The first traffic light was invented in 1868 and used gas lamps!',
        quiz: {
          question: 'How many LEDs do you need for a basic traffic light?',
          options: ['1', '2', '3', '4'],
          correctAnswer: 2
        }
      },
      {
        id: 2,
        emoji: '⏱️',
        front: 'How do you control timing?',
        simple: 'We use the delay() function to keep the light on for the right amount of time!',
        detail: 'Red and Green lights stay on longer (e.g. 5000ms), while the Yellow light is just a short warning (e.g. 2000ms).',
        funFact: '⏳ Traffic light engineers spend years perfecting the exact timing of lights to prevent traffic jams.',
        quiz: {
          question: 'Which light typically stays on for the shortest time?',
          options: ['Red', 'Yellow', 'Green', 'Blue'],
          correctAnswer: 1
        }
      }
    ],
    unlockComponents: []
  },

  // ===== LED PWM (project: led-pwm) =====
  'led-pwm': {
    flashcards: [
      {
        id: 1,
        emoji: '🔆',
        front: 'What is PWM?',
        simple: 'PWM stands for Pulse Width Modulation. It is a trick to make a digital pin act like an analog pin, so you can change brightness!',
        detail: 'By turning the pin ON and OFF really fast (hundreds of times a second), the LED looks like it is at half brightness instead of blinking.',
        funFact: '🌟 Arduino UNO pins with a tilde (~) next to them (like ~9, ~10, ~11) support PWM!',
        quiz: {
          question: 'What does PWM do to an LED?',
          options: ['Changes its color', 'Makes it blink slowly', 'Allows you to change its brightness', 'Turns it off permanently'],
          correctAnswer: 2
        }
      },
      {
        id: 2,
        emoji: '🎛️',
        front: 'How to use analogWrite()?',
        simple: 'Instead of HIGH or LOW, analogWrite() uses numbers from 0 (OFF) to 255 (Fully ON).',
        detail: 'analogWrite(9, 127) will turn the LED on at exactly 50% brightness.',
        funFact: '⚡ The number 255 is the maximum value for an 8-bit number (2^8 - 1).',
        quiz: {
          question: 'What value in analogWrite() makes the LED half bright?',
          options: ['0', '127', '255', '50'],
          correctAnswer: 1
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-lcd1602', name: 'LCD Display', icon: '📟', color: '#22c55e', desc: 'A tiny screen to display messages! Unlocked for your next projects.' }
    ]
  },

  // ===== SCROLLING TEXT LCD (project: lcd-scrolling-text) =====
  'lcd-scrolling-text': {
    flashcards: [
      {
        id: 1,
        emoji: '📟',
        front: 'What is an LCD?',
        simple: 'An LCD (Liquid Crystal Display) is a small screen that can show letters and numbers!',
        detail: 'The 16x2 LCD can show 16 characters on the top row, and 16 on the bottom row. You can make text scroll across it using code.',
        funFact: '📺 The screens on early calculators, digital watches, and Game Boys used the same technology!',
        quiz: {
          question: 'How many characters can a 16x2 LCD show at once?',
          options: ['16', '32', '2', '64'],
          correctAnswer: 1
        }
      }
    ],
    unlockComponents: [
      { type: 'openhw-servo', name: 'Servo Motor', icon: '⚙️', color: '#f97316', desc: 'A motor that can turn exactly where you tell it to!' }
    ]
  },

// ===== DC MOTOR (project: dc-motor) =====
   'dc-motor': {
     flashcards: [],
     unlockComponents: [
       { type: '*', name: 'ALL Components Unlocked!', icon: '🏆', color: '#fbbf24', desc: 'You completed every project! Build anything!' },
     ]
   }
}

// Default flashcards for projects not in the data
export const DEFAULT_FLASHCARDS = [
  {
    id: 1,
    emoji: '💡',
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
    emoji: '🔌',
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
  { id: 'arduino', name: 'Arduino Uno', icon: '🟩', color: '#22c55e', desc: 'Your project\'s brain!' },
  { id: 'component', name: 'Component', icon: '🔧', color: '#3b82f6', desc: 'Essential for your project.' },
]

// Helper function to get flashcards for a project
export function getProjectFlashcards(projectSlug) {
  return PROJECT_DATA[projectSlug]?.flashcards || DEFAULT_FLASHCARDS
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
  return PROJECT_DATA[projectSlug]?.unlockComponents || DEFAULT_UNLOCK_COMPONENTS
}

// Helper function to get openhw type for a component
export function getOpenhwType(componentId) {
  return ID_TO_OPENHW[componentId] || null
}