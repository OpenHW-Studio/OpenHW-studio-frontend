/**
 * Example Projects Block Editor Registry
 * Aggregates individual block editor files for each example project.
 */

import ledBlinkBlock from './led-blink.js';
import buzzerBlock from './buzzer.js';
import rgbLedBlinkBlock from './rgb-led-blink.js';
import trafficLightBlock from './traffic-light.js';
import buttonLedBlock from './button-led.js';
import buttonDebounceBlock from './button-debounce.js';
import rgbLed3ButtonsBlock from './rgb-led-3-buttons.js';
import rgbLedSerialBlock from './rgb-led-serial.js';
import ledPwmBlock from './led-pwm.js';
import temperatureSensorBlock from './temperature-sensor.js';
import potentiometerLedBlock from './potentiometer-led.js';
import ldrAutomaticLightBlock from './ldr-automatic-light.js';
import lcdScrollingTextBlock from './lcd-scrolling-text.js';
import num7SegmentDisplayBlock from './7-segment-display.js';
import upCounterBlock from './up-counter.js';
import upDownCounterBlock from './up-down-counter.js';
import num7SegmentCounterBlock from './7-segment-counter.js';
import temperatureRgbLedBlock from './temperature-rgb-led.js';
import ultrasonicDistanceBlock from './ultrasonic-distance.js';
import motionSensorAlarmBlock from './motion-sensor-alarm.js';
import gasSensorLedBlock from './gas-sensor-led.js';
import dhtLcdBlock from './dht-lcd.js';
import servoMotorBlock from './servo-motor.js';
import servoPotentiometerBlock from './servo-potentiometer.js';
import dcMotorPwmBlock from './dc-motor-pwm.js';
import dcMotorL293dBlock from './dc-motor-l293d.js';
import autoFanSpeedBlock from './auto-fan-speed.js';
import smartStreetLightBlock from './smart-street-light.js';
import waterLevelIndicatorBlock from './water-level-indicator.js';
import smartDustbinBlock from './smart-dustbin.js';
import bluetoothHc05Block from './bluetooth-hc05.js';
import irRemoteControlBlock from './ir-remote-control.js';
import rfRemoteControlBlock from './rf-remote-control.js';
import communicationProtocolsBlock from './communication-protocols.js';
import wifiLedControlBlock from './wifi-led-control.js';
import smartHomeAutomationBlock from './smart-home-automation.js';
import obstacleAvoidingRobotBlock from './obstacle-avoiding-robot.js';
import lineFollowingRobotBlock from './line-following-robot.js';

export const EXAMPLE_BLOCK_MAP = {
  ["led-blink"]: ledBlinkBlock,
  ["buzzer"]: buzzerBlock,
  ["rgb-led-blink"]: rgbLedBlinkBlock,
  ["traffic-light"]: trafficLightBlock,
  ["button-led"]: buttonLedBlock,
  ["button-debounce"]: buttonDebounceBlock,
  ["rgb-led-3-buttons"]: rgbLed3ButtonsBlock,
  ["rgb-led-serial"]: rgbLedSerialBlock,
  ["led-pwm"]: ledPwmBlock,
  ["temperature-sensor"]: temperatureSensorBlock,
  ["potentiometer-led"]: potentiometerLedBlock,
  ["ldr-automatic-light"]: ldrAutomaticLightBlock,
  ["lcd-scrolling-text"]: lcdScrollingTextBlock,
  ["7-segment-display"]: num7SegmentDisplayBlock,
  ["up-counter"]: upCounterBlock,
  ["up-down-counter"]: upDownCounterBlock,
  ["7-segment-counter"]: num7SegmentCounterBlock,
  ["temperature-rgb-led"]: temperatureRgbLedBlock,
  ["ultrasonic-distance"]: ultrasonicDistanceBlock,
  ["motion-sensor-alarm"]: motionSensorAlarmBlock,
  ["gas-sensor-led"]: gasSensorLedBlock,
  ["dht-lcd"]: dhtLcdBlock,
  ["servo-motor"]: servoMotorBlock,
  ["servo-potentiometer"]: servoPotentiometerBlock,
  ["dc-motor-pwm"]: dcMotorPwmBlock,
  ["dc-motor-l293d"]: dcMotorL293dBlock,
  ["auto-fan-speed"]: autoFanSpeedBlock,
  ["smart-street-light"]: smartStreetLightBlock,
  ["water-level-indicator"]: waterLevelIndicatorBlock,
  ["smart-dustbin"]: smartDustbinBlock,
  ["bluetooth-hc05"]: bluetoothHc05Block,
  ["ir-remote-control"]: irRemoteControlBlock,
  ["rf-remote-control"]: rfRemoteControlBlock,
  ["communication-protocols"]: communicationProtocolsBlock,
  ["wifi-led-control"]: wifiLedControlBlock,
  ["smart-home-automation"]: smartHomeAutomationBlock,
  ["obstacle-avoiding-robot"]: obstacleAvoidingRobotBlock,
  ["line-following-robot"]: lineFollowingRobotBlock,
};

/**
 * Retrieve block editor definition for a given project slug.
 * @param {string} slug - Project slug (e.g. 'led-blink')
 * @returns {object|null} Block editor definition or null
 */
export function getExampleBlockData(slug) {
  if (!slug) return null;
  const cleanSlug = String(slug).trim().toLowerCase();
  return EXAMPLE_BLOCK_MAP[cleanSlug] || null;
}

export {
  ledBlinkBlock,
  buzzerBlock,
  rgbLedBlinkBlock,
  trafficLightBlock,
  buttonLedBlock,
  buttonDebounceBlock,
  rgbLed3ButtonsBlock,
  rgbLedSerialBlock,
  ledPwmBlock,
  temperatureSensorBlock,
  potentiometerLedBlock,
  ldrAutomaticLightBlock,
  lcdScrollingTextBlock,
  num7SegmentDisplayBlock,
  upCounterBlock,
  upDownCounterBlock,
  num7SegmentCounterBlock,
  temperatureRgbLedBlock,
  ultrasonicDistanceBlock,
  motionSensorAlarmBlock,
  gasSensorLedBlock,
  dhtLcdBlock,
  servoMotorBlock,
  servoPotentiometerBlock,
  dcMotorPwmBlock,
  dcMotorL293dBlock,
  autoFanSpeedBlock,
  smartStreetLightBlock,
  waterLevelIndicatorBlock,
  smartDustbinBlock,
  bluetoothHc05Block,
  irRemoteControlBlock,
  rfRemoteControlBlock,
  communicationProtocolsBlock,
  wifiLedControlBlock,
  smartHomeAutomationBlock,
  obstacleAvoidingRobotBlock,
  lineFollowingRobotBlock,
};

export default EXAMPLE_BLOCK_MAP;
