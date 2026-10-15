/**
 * Static simulator content tables, lifted verbatim from SimulatorPage.jsx.
 *
 * COMPONENT_DESCRIPTIONS: human-readable blurbs per component type for the
 * description panel. WOKWI_TO_COMP_ID: canonical gamification ids per
 * palette type (memoized — same empty dep array as the original).
 */
import { useMemo } from "react";

export const COMPONENT_DESCRIPTIONS = {
      "wokwi-led":
        "Light-emitting diode. Emits light when current flows through it. Supports multiple colors.",
      "openhw-led":
        "Light-emitting diode. Emits light when current flows through it. Supports multiple colors.",
      "wokwi-arduino-uno":
        "ATmega328P-based microcontroller board. 14 digital I/O pins, 6 analog inputs, USB connectivity.",
      "openhw-arduino-uno":
        "ATmega328P-based microcontroller board. 14 digital I/O pins, 6 analog inputs, USB connectivity.",
      "wokwi-arduino-mega":
        "ATmega2560-based microcontroller board. 54 digital I/O pins, 16 analog inputs, 4 UARTs.",
      "openhw-arduino-mega":
        "ATmega2560-based microcontroller board. 54 digital I/O pins, 16 analog inputs, 4 UARTs.",
      "wokwi-arduino-nano":
        "Compact ATmega328P-based board. Similar to Uno but in a breadboard-friendly form factor.",
      "openhw-arduino-nano":
        "Compact ATmega328P-based board. Similar to Uno but in a breadboard-friendly form factor.",
      "wokwi-attiny85":
        "Small 8-pin microcontroller. Perfect for simple, low-power projects.",
      "openhw-attiny85":
        "Small 8-pin microcontroller. Perfect for simple, low-power projects.",
      "wokwi-raspberry-pi-pico":
        "Dual-core ARM Cortex-M0+ microcontroller. High performance and flexible digital interfaces.",
      "openhw-pico":
        "Dual-core ARM Cortex-M0+ microcontroller. High performance and flexible digital interfaces.",
      "wokwi-breadboard":
        "Full-size solderless breadboard. 830 tie points for prototyping circuits.",
      "openhw-breadboard":
        "Full-size solderless breadboard. 830 tie points for prototyping circuits.",
      "wokwi-breadboard-half":
        "Half-size solderless breadboard. 400 tie points for smaller circuits.",
      "openhw-breadboard-half":
        "Half-size solderless breadboard. 400 tie points for smaller circuits.",
      "wokwi-breadboard-mini":
        "Mini solderless breadboard. 170 tie points for very compact prototypes.",
      "openhw-breadboard-mini":
        "Mini solderless breadboard. 170 tie points for very compact prototypes.",
      "wokwi-resistor":
        "Passive two-terminal component. Limits current flow. Configurable resistance value.",
      "openhw-resistor":
        "Passive two-terminal component. Limits current flow. Configurable resistance value.",
      "wokwi-pushbutton":
        "Momentary tactile push button. Connects circuit while pressed, opens when released.",
      "openhw-pushbutton":
        "Momentary tactile push button. Connects circuit while pressed, opens when released.",
      "wokwi-power-supply":
        "Provides stable DC power to the circuit. Configurable voltage output.",
      "openhw-power-supply":
        "Provides stable DC power to the circuit. Configurable voltage output.",
      "wokwi-neopixel-matrix":
        "Addressable RGB LED matrix. Individually controllable pixels via single data line.",
      "openhw-neopixel-matrix":
        "Addressable RGB LED matrix. Individually controllable pixels via single data line.",
      "wokwi-buzzer":
        "Piezoelectric buzzer. Generates audio tones when driven by PWM or digital signals.",
      "openhw-buzzer":
        "Piezoelectric buzzer. Generates audio tones when driven by PWM or digital signals.",
      "wokwi-motor":
        "DC motor. Converts electrical energy to rotational motion. Controlled via H-bridge.",
      "openhw-motor":
        "DC motor. Converts electrical energy to rotational motion. Controlled via H-bridge.",
      "wokwi-servo":
        "Hobby servo motor. Precise angular position control via PWM signal (0–180°).",
      "openhw-servo":
        "Hobby servo motor. Precise angular position control via PWM signal (0–180°).",
      "wokwi-motor-driver":
        "Dual H-bridge motor driver (L293D). Controls speed and direction of two DC motors.",
      "openhw-motor-driver":
        "Dual H-bridge motor driver (L293D). Controls speed and direction of two DC motors.",
      "wokwi-slide-potentiometer":
        "Linear slide potentiometer. Provides variable analog voltage via sliding knob.",
      "openhw-slide-potentiometer":
        "Linear slide potentiometer. Provides variable analog voltage via sliding knob.",
      "wokwi-potentiometer":
        "Rotary potentiometer. Variable resistor providing analog voltage proportional to rotation.",
      "openhw-potentiometer":
        "Rotary potentiometer. Variable resistor providing analog voltage proportional to rotation.",
      "wokwi-analog-joystick":
        "2-axis analog joystick. Provides X and Y axis voltage limits along with a push button.",
      "openhw-analog-joystick":
        "2-axis analog joystick. Provides X and Y axis voltage limits along with a push button.",
      shift_register:
        "74HC595 8-bit serial-in, parallel-out shift register. Expands digital outputs.",
      "wokwi-membrane-keypad":
        "4x4 Membrane Keypad. Provides a matrix of 16 buttons for code input or navigation.",
      "openhw-membrane-keypad":
        "4x4 Membrane Keypad. Provides a matrix of 16 buttons for code input or navigation.",
      "wokwi-rgb-led": "RGB LED. Emits red, green, blue, or mixed colors.",
      "openhw-rgb-led": "RGB LED. Emits red, green, blue, or mixed colors.",
      "wokwi-nokia-5110":
        "Nokia 5110 LCD Screen. 84x48 monochrome graphic display.",
      "openhw-nokia-5110":
        "Nokia 5110 LCD Screen. 84x48 monochrome graphic display.",
      "wokwi-soil-moisture-sensor":
        "Soil moisture sensor module. Outputs analog/digital moisture level.",
      "openhw-soil-moisture-sensor":
        "Soil moisture sensor module. Outputs analog/digital moisture level.",
      "wokwi-logic-analyzer":
        "8-channel logic analyzer for debugging digital signals.",
      "openhw-logic-analyzer":
        "8-channel logic analyzer for debugging digital signals.",
      "wokwi-sd-card": "MicroSD card module for SPI data logging and storage.",
      "openhw-sd-card": "MicroSD card module for SPI data logging and storage.",
      "wokwi-ldr-module":
        "Light-dependent resistor module with digital and analog outputs.",
      "openhw-ldr-module":
        "Light-dependent resistor module with digital and analog outputs.",
      "wokwi-tm1637-7segment": "TM1637 4-digit 7-segment display module.",
      "openhw-tm1637-7segment": "TM1637 4-digit 7-segment display module.",
      "wokwi-cd74hc4067": "CD74HC4067 16-channel analog/digital multiplexer.",
      "openhw-cd74hc4067": "CD74HC4067 16-channel analog/digital multiplexer.",
      "wokwi-7segment": "7-segment LED display.",
      "openhw-7segment": "7-segment LED display.",
      "wokwi-a4988": "A4988 stepper motor driver.",
      "openhw-a4988": "A4988 stepper motor driver.",
      "wokwi-bmp180": "BMP180 barometric pressure and temperature sensor.",
      "openhw-bmp180": "BMP180 barometric pressure and temperature sensor.",
      "wokwi-bmp180-breakout":
        "BMP180 barometric pressure and temperature sensor breakout.",
      "openhw-bmp180-breakout":
        "BMP180 barometric pressure and temperature sensor breakout.",
      "wokwi-ds1307-rtc": "DS1307 Real-Time Clock module.",
      "openhw-ds1307-rtc": "DS1307 Real-Time Clock module.",
      "wokwi-hc-sr04": "HC-SR04 ultrasonic distance sensor.",
      "openhw-hc-sr04": "HC-SR04 ultrasonic distance sensor.",
      "wokwi-ili9341": "ILI9341 2.8 inch TFT LCD display.",
      "openhw-ili9341": "ILI9341 2.8 inch TFT LCD display.",
      "wokwi-l293d": "L293D motor driver IC.",
      "openhw-l293d": "L293D motor driver IC.",
      "wokwi-lcd1602-i2c": "16x2 LCD display with I2C backpack.",
      "openhw-lcd1602-i2c": "16x2 LCD display with I2C backpack.",
      "wokwi-lcd2004-i2c": "20x4 LCD display with I2C backpack.",
      "openhw-lcd2004-i2c": "20x4 LCD display with I2C backpack.",
      "wokwi-max7219": "MAX7219 8x8 LED matrix module.",
      "openhw-max7219": "MAX7219 8x8 LED matrix module.",
      "wokwi-mpu6050": "MPU6050 6-axis accelerometer and gyroscope.",
      "openhw-mpu6050": "MPU6050 6-axis accelerometer and gyroscope.",
      "wokwi-nlsf595": "NLSF595 tri-state shift register.",
      "openhw-nlsf595": "NLSF595 tri-state shift register.",
      "wokwi-pca9685": "PCA9685 16-channel 12-bit PWM/servo driver.",
      "openhw-pca9685": "PCA9685 16-channel 12-bit PWM/servo driver.",
      "wokwi-pca9865": "PCA9865 16-channel PWM module.",
      "openhw-pca9865": "PCA9865 16-channel PWM module.",
      "wokwi-relay-module": "Relay module for controlling high-power devices.",
      "openhw-relay-module": "Relay module for controlling high-power devices.",
      "wokwi-ssd1306-oled": "SSD1306 128x64 OLED display.",
      "openhw-ssd1306-oled": "SSD1306 128x64 OLED display.",
      "wokwi-stepper-motor": "Bipolar stepper motor.",
      "openhw-stepper-motor": "Bipolar stepper motor.",
};


export function useWokwiToCompId() {
  return useMemo(
    () => ({
          "wokwi-led": "led",
          "openhw-led": "led",
          "wokwi-resistor": "resistor",
          "openhw-resistor": "resistor",
          "wokwi-pushbutton": "button",
          "openhw-pushbutton": "button",
          "wokwi-potentiometer": "potentiometer",
          "openhw-potentiometer": "potentiometer",
          "wokwi-slide-potentiometer": "potentiometer",
          "openhw-slide-potentiometer": "potentiometer",
          "wokwi-buzzer": "buzzer",
          "openhw-buzzer": "buzzer",
          "wokwi-rgb-led": "rgb-led",
          "openhw-rgb-led": "rgb-led",
          "wokwi-ntc-temperature-sensor": "dht11",
          "openhw-ntc-temperature-sensor": "dht11",
          "wokwi-dht22": "dht22",
          "openhw-dht22": "dht22",
          "wokwi-hc-sr04": "ultrasonic",
          "openhw-hc-sr04": "ultrasonic",
          "wokwi-servo": "servo",
          "openhw-servo": "servo",
          "wokwi-lcd1602": "lcd",
          "wokwi-lcd1602-i2c": "lcd",
          "openhw-lcd1602-i2c": "lcd",
          "wokwi-lcd2004-i2c": "lcd",
          "openhw-lcd2004-i2c": "lcd",
          "wokwi-analog-joystick": "analog-joystick",
          "openhw-analog-joystick": "analog-joystick",
          "wokwi-membrane-keypad": "keypad",
          "openhw-membrane-keypad": "keypad",
          "wokwi-rotary-encoder": "rotary-encoder",
          "openhw-rotary-encoder": "rotary-encoder",
          "wokwi-nokia-5110": "nokia-5110",
          "openhw-nokia-5110": "nokia-5110",
          "wokwi-soil-moisture-sensor": "soil-moisture-sensor",
          "openhw-soil-moisture-sensor": "soil-moisture-sensor",
          "wokwi-logic-analyzer": "logic-analyzer",
          "openhw-logic-analyzer": "logic-analyzer",
          "wokwi-sd-card": "sd-card",
          "openhw-sd-card": "sd-card",
          "wokwi-ldr-module": "ldr-module",
          "openhw-ldr-module": "ldr-module",
          "wokwi-tm1637-7segment": "tm1637-7segment",
          "openhw-tm1637-7segment": "tm1637-7segment",
          "wokwi-cd74hc4067": "cd74hc4067",
          "openhw-cd74hc4067": "cd74hc4067",
          "wokwi-7segment": "7segment",
          "openhw-7segment": "7segment",
          "wokwi-a4988": "a4988",
          "openhw-a4988": "a4988",
          "wokwi-bmp180": "bmp180",
          "openhw-bmp180": "bmp180",
          "wokwi-bmp180-breakout": "bmp180",
          "openhw-bmp180-breakout": "bmp180",
          "wokwi-ds1307-rtc": "rtc",
          "openhw-ds1307-rtc": "rtc",
          "wokwi-ili9341": "ili9341",
          "openhw-ili9341": "ili9341",
          "wokwi-l293d": "l293d",
          "openhw-l293d": "l293d",
          "wokwi-max7219": "max7219",
          "openhw-max7219": "max7219",
          "wokwi-mpu6050": "mpu6050",
          "openhw-mpu6050": "mpu6050",
          "wokwi-nlsf595": "nlsf595",
          "openhw-nlsf595": "nlsf595",
          "wokwi-pca9685": "pca9685",
          "openhw-pca9685": "pca9685",
          "wokwi-pca9865": "pca9865",
          "openhw-pca9865": "pca9865",
          "wokwi-relay-module": "relay",
          "openhw-relay-module": "relay",
          "wokwi-ssd1306-oled": "oled",
          "openhw-ssd1306-oled": "oled",
          "wokwi-stepper-motor": "stepper",
          "openhw-stepper-motor": "stepper",
          "wokwi-arduino-uno": "uno",
          "openhw-arduino-uno": "uno",
          "wokwi-arduino-mega": "mega",
          "openhw-arduino-mega": "mega",
          "wokwi-arduino-nano": "nano",
          "openhw-arduino-nano": "nano",
          "wokwi-attiny85": "attiny85",
          "openhw-attiny85": "attiny85",
          "wokwi-raspberry-pi-pico": "pico",
          "openhw-pico": "pico",
          "wokwi-raspberry-pi-pico-w": "pico-w",
          "openhw-pico-w": "pico-w",
          "wokwi-power-supply": "power-supply",
          "openhw-power-supply": "power-supply",
          "wokwi-battery": "battery",
          "openhw-battery": "battery",
          "wokwi-charger": "charger",
          "openhw-charger": "charger",
          "wokwi-breadboard": "breadboard",
          "openhw-breadboard": "breadboard",
          "wokwi-breadboard-half": "breadboard",
          "openhw-breadboard-half": "breadboard",
          "wokwi-breadboard-mini": "breadboard",
          "openhw-breadboard-mini": "breadboard",
          "wokwi-neopixel-matrix": "neopixel",
          "openhw-neopixel-matrix": "neopixel",
          "wokwi-neopixel-ring": "neopixel",
          "openhw-neopixel-ring": "neopixel",
          "wokwi-arduino-sensor-shield": "shield",
          "openhw-arduino-sensor-shield": "shield",
    }),
    [],
  );
}
