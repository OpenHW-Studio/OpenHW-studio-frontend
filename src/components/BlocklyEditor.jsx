/**
 * BlocklyEditor.jsx  –  OpenHW Studio visual block editor
 *
 * Features:
 *  - Custom React sidebar: category pills (grid) + scrollable SVG block list
 *  - Drag-and-drop blocks from sidebar to Blockly workspace
 *  - Click-to-add fallback
 *  - Dark / light theme (follows data-theme on <html>)
 *  - Arduino C++ code generator with live preview
 *  - 6 categories: Basic · Control · Output · Math · Input · Variables
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import html2canvas from 'html2canvas'
import Prism from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
// ─── CDN ─────────────────────────────────────────────────────────────────────
const BLOCKLY_VER = '10.4.3'
const CDN_SCRIPTS = [
  `https://unpkg.com/blockly@${BLOCKLY_VER}/blockly_compressed.js`,
  `https://unpkg.com/blockly@${BLOCKLY_VER}/blocks_compressed.js`,
  `https://unpkg.com/blockly@${BLOCKLY_VER}/msg/en.js`,
]

// ─── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'basic', label: 'Basic', color: '#d95f5f' },
  { id: 'control', label: 'Control', color: '#e8861e' },
  { id: 'output', label: 'Output', color: '#3a7de0' },
  { id: 'math', label: 'Math', color: '#28b463' },
  { id: 'text', label: 'Text', color: '#5b67a5' },
  { id: 'input', label: 'Input', color: '#9b59b6' },
  { id: 'variables', label: 'Variables', color: '#e84393' },
  { id: 'list', label: 'List', color: '#ff99cc' },
  { id: 'color', label: 'Color', color: '#5463ff' },
  { id: 'message', label: 'Message', color: '#a256c7' },
  { id: 'time', label: 'Time', color: '#a256c7' },
  { id: 'code', label: 'Code', color: '#a256c7' },
  { id: 'addons',  label: 'Add-ons', color: '#e67e22' },
  { id: 'sensors', label: 'Sensors', color: '#1abc9c' },
]

const SUB_CATEGORIES = {
  addons: [
    { id: 'addons_led', label: 'Led' },
    { id: 'addons_rgb_led', label: 'RGB LED' },
    { id: 'addons_motor', label: 'Motor' },
    { id: 'addons_buzzer', label: 'Passive Buzzer' },
    { id: 'addons_lcd', label: 'LCD Screen' },
    { id: 'addons_pins', label: 'Pins' },
    { id: 'addons_stepper', label: 'Stepper Motors' },
    { id: 'addons_servo', label: 'Servo' },
  ],
  sensors: [
    { id: 'sensors_analog', label: 'Analog' },
    { id: 'sensors_button', label: 'Button' },
    { id: 'sensors_digital', label: 'Digital' },
    { id: 'sensors_ir', label: 'IR Remote' },
    { id: 'sensors_temp', label: 'Temp' },
    { id: 'sensors_thermistor', label: 'Thermistor' },
  ]
}

// ─── Block shape kinds ────────────────────────────────────────────────────────
// hat = event (no prev connection), value = reporter (output), statement = default
const HAT_TYPES = new Set([
  'on_start', 'forever',
  'on_button_pressed', 'on_shake', 'on_pin_pressed',
  'on_pin_changed', 'on_radio_number', 'on_radio_string', 'on_radio_key_value',
  'create_block', 'setup_runs_once', 'on_button_sensor_press',
])
const VALUE_TYPES = new Set([
  'math_arithmetic_openhw', 'math_compare', 'pick_random', 'map_value',
  'math_abs_of', 'math_round_openhw', 'math_round', 'math_constrain_block', 'state_dropdown',
  'read_digital_pin', 'read_analog_pin', 'acceleration', 'rotation',
  'light_level', 'temperature', 'compass_heading', 'analog_pitch_vol_read',
  'button_pressed_bool', 'digital_pin_is', 'gesture_is',
  'logic_operation', 'logic_negate', 'logic_boolean', 'math_number',
  'text', 'text_join', 'text_length', 'text_isEmpty',
  'text_changeCase', 'parse_string_block', 'number_to_text',
  'colour_picker', 'colour_random', 'colour_rgb',
  'analog_sensor_read', 'button_is_pressed', 'digital_sensor_read', 'digital_sensor_is_on',
  'ir_remote_has_code', 'ir_remote_get_code', 'temp_sensor_read', 'thermistor_read',
])
const getShapeKind = (type) =>
  HAT_TYPES.has(type) ? 'hat' : VALUE_TYPES.has(type) ? 'value' : 'statement'

// ─── Pin Helpers ─────────────────────────────────────────────────────────────
const GET_DIGITAL_PINS = () => {
  const kind = window.BLOCKLY_BOARD_KIND || 'arduino_uno'
  if (kind === 'rp2040') {
    return Array.from({ length: 29 }, (_, i) => [i === 25 ? `GP25 (LED)` : `GP${i}`, String(i)])
  }
  return [
    ['D0', '0'], ['D1', '1'], ['D2', '2'], ['D3', '3'], ['D4', '4'], ['D5', '5'],
    ['D6', '6'], ['D7', '7'], ['D8', '8'], ['D9', '9'], ['D10', '10'],
    ['D11', '11'], ['D12', '12'], ['D13', '13']
  ]
}
const GET_ANALOG_PINS = () => {
  const kind = window.BLOCKLY_BOARD_KIND || 'arduino_uno'
  if (kind === 'rp2040') {
    return [['GP26 (A0)', '26'], ['GP27 (A1)', '27'], ['GP28 (A2)', '28']]
  }
  return [['A0', 'A0'], ['A1', 'A1'], ['A2', 'A2'], ['A3', 'A3'], ['A4', 'A4'], ['A5', 'A5']]
}
const GET_PWM_PINS = () => {
  const kind = window.BLOCKLY_BOARD_KIND || 'arduino_uno'
  if (kind === 'rp2040') return GET_DIGITAL_PINS()
  return [['P3', '3'], ['P5', '5'], ['P6', '6'], ['P9', '9'], ['P10', '10'], ['P11', '11']]
}

// ─── Category → block list ────────────────────────────────────────────────────
const CATEGORY_BLOCKS = {
  basic: [
    { type: 'clear_screen', label: 'clear screen' },
    { type: 'show_icon', label: 'show icon' },
    { type: 'show_leds', label: 'show LEDs' },
    { type: 'show_number', label: 'show number' },
    { type: 'show_string', label: 'show string' },
    { type: 'plot_bar_graph', label: 'plot bar graph' },
    { type: 'wait_secs', label: 'wait' },
    { type: 'on_button_pressed', label: 'on button pressed' },
    { type: 'on_shake', label: 'on shake' },
    { type: 'on_pin_pressed', label: 'on pin pressed' },
    { type: 'create_block', label: 'create block' },
  ],
  control: [
    { type: 'on_start', label: 'on start' },
    { type: 'forever', label: 'forever' },
    { type: 'wait_secs', label: 'wait' },
    { type: 'repeat_times', label: 'repeat times' },
    { type: 'repeat_while', label: 'repeat while' },
    { type: 'if_then', label: 'if then' },
    { type: 'if_then_else', label: 'if then else' },
    { type: 'loop_with_for', label: 'loop with' },
  ],
  output: [
    { type: 'plot_x_y', label: 'plot x y' },
    { type: 'plot_x_y_brightness', label: 'plot x y brightness' },
    { type: 'unplot_x_y', label: 'unplot x y' },
    { type: 'digital_write_pin', label: 'digital write pin' },
    { type: 'write_analog_pin', label: 'analog write pin' },
    { type: 'rotate_servo', label: 'rotate servo' },
    { type: 'write_servo_pulse', label: 'write servo pulse' },
    { type: 'set_pull_pin', label: 'set pull pin' },
    { type: 'analog_set_pitch_pin', 'label': 'set pitch pin' },
    { type: 'analog_set_pitch_vol', 'label': 'set pitch volume' },
    { type: 'analog_pitch', label: 'analog pitch' },
    { type: 'radio_set_group', label: 'radio set group' },
    { type: 'radio_send_number', label: 'radio send number' },
    { type: 'radio_send_string', label: 'radio send string' },
    { type: 'radio_send_value', label: 'radio send value' },
  ],
  math: [
    { type: 'math_arithmetic_openhw', label: 'arithmetic' },
    { type: 'math_compare', label: 'compare' },
    { type: 'pick_random', label: 'pick random' },
    { type: 'math_abs_of', label: 'math function' },
    { type: 'math_round_openhw', label: 'round' },
    { type: 'map_value', label: 'map value' },
    { type: 'math_constrain_block', label: 'constrain' },
    { type: 'state_dropdown', label: 'HIGH / LOW' },
    { type: 'logic_operation', label: 'and / or' },
    { type: 'logic_negate', label: 'not' },
    { type: 'logic_boolean', label: 'true / false' },
    { type: 'math_number', label: 'number' },
  ],
  color: [
    { type: 'colour_picker', label: 'color' },
    { type: 'colour_random', label: 'random color' },
    { type: 'colour_rgb', label: 'color with red green blue' },
  ],
  input: [
    { type: 'read_digital_pin', label: 'digital read pin' },
    { type: 'read_analog_pin', label: 'analog read pin' },
    { type: 'acceleration', label: 'acceleration' },
    { type: 'rotation', label: 'rotation' },
    { type: 'light_level', label: 'light level' },
    { type: 'temperature', label: 'temperature' },
    { type: 'compass_heading', label: 'compass heading' },
    { type: 'analog_pitch_vol_read', label: 'pitch volume' },
    { type: 'on_button_pressed', label: 'on button pressed' },
    { type: 'on_shake', label: 'on shake' },
    { type: 'on_pin_pressed', label: 'on pin pressed' },
    { type: 'on_pin_changed', label: 'on pin changed' },
    { type: 'on_radio_number', label: 'on radio number' },
    { type: 'on_radio_string', label: 'on radio string' },
    { type: 'on_radio_key_value', label: 'on radio key+value' },
    { type: 'button_pressed_bool', label: 'button pressed ?' },
    { type: 'digital_pin_is', label: 'digital pin is ?' },
    { type: 'gesture_is', label: 'gesture is ?' },
    { type: 'set_accel_range', label: 'set accel range' },
  ],
  text: [
    { type: 'text', label: '" abc "' },
    { type: 'text_join', label: 'create text with' },
    { type: 'text_length', label: 'length of' },
    { type: 'parse_string_block', label: 'get part of text' },
    { type: 'number_to_text', label: 'number to text' },
    { type: 'text_isEmpty', label: 'is empty' },
    { type: 'text_changeCase', label: 'to UPPER / lower' },
  ],
  message: [
    { type: 'message_setup', label: 'Message Setup' },
    { type: 'send_message', label: 'Send message' },
    { type: 'get_message', label: 'Get message' },
    { type: 'message_received', label: 'Message received?' },
  ],
  time: [
    { type: 'setup_time', label: 'Setup Time' },
    { type: 'set_duration', label: 'set duration' },
    { type: 'wait_for_time', label: 'wait for' },
    { type: 'seconds_arduino_on', label: 'seconds arduino been on' },
  ],
  code: [
    { type: 'setup_runs_once', label: 'Setup (runs once)' },
  ],
  addons_led: [
    { type: 'led_turn', label: 'LED turn on/off' },
    { type: 'led_fade', label: 'LED fade' },
  ],
  addons_rgb_led: [
    { type: 'rgb_led_set', label: 'set RGB LED' },
  ],
  addons_servo: [
    { type: 'rotate_servo', label: 'rotate servo' },
    { type: 'write_servo_pulse', label: 'write servo pulse' },
  ],
  addons_motor: [
    { type: 'motor_turn', label: 'motor turn' },
    { type: 'motor_speed', label: 'motor speed' },
  ],
  addons_buzzer: [
    { type: 'buzzer_tone', label: 'buzzer tone' },
    { type: 'buzzer_stop', label: 'buzzer stop' },
  ],
  addons_lcd: [
    { type: 'lcd_setup', label: 'LCD setup' },
    { type: 'lcd_print', label: 'LCD print' },
    { type: 'lcd_clear', label: 'LCD clear' },
    { type: 'lcd_scroll', label: 'LCD scroll' },
    { type: 'lcd_blink', label: 'LCD blink' },
    { type: 'lcd_backlight', label: 'LCD backlight' },
  ],
  addons_pins: [
    { type: 'digital_write_pin', label: 'digital write pin' },
    { type: 'write_analog_pin', label: 'analog write pin' },
    { type: 'pin_set_mode', label: 'set pin mode' },
  ],
  addons_stepper: [
    { type: 'stepper_setup', label: 'stepper setup' },
    { type: 'stepper_rotate', label: 'stepper rotate' },
  ],

  sensors_analog: [
    { type: 'analog_sensor_setup', label: 'analog sensor setup' },
    { type: 'analog_sensor_read', label: 'analog sensor read' },
  ],
  sensors_button: [
    { type: 'button_setup', label: 'button setup' },
    { type: 'button_is_pressed', label: 'button pressed?' },
    { type: 'on_button_sensor_press', label: 'on button press' },
  ],
  sensors_digital: [
    { type: 'digital_sensor_read', label: 'digital sensor read' },
    { type: 'digital_sensor_is_on', label: 'digital sensor on?' },
  ],
  sensors_ir: [
    { type: 'ir_remote_setup', label: 'IR remote setup' },
    { type: 'ir_remote_has_code', label: 'IR has code?' },
    { type: 'ir_remote_get_code', label: 'IR get code' },
  ],
  sensors_temp: [
    { type: 'temp_sensor_setup', label: 'temp sensor setup' },
    { type: 'temp_sensor_read', label: 'temp read' },
  ],
  sensors_thermistor: [
    { type: 'thermistor_setup', label: 'thermistor setup' },
    { type: 'thermistor_read', label: 'thermistor read' },
  ],
}

// ─── Custom block JSON definitions ───────────────────────────────────────────
const BLOCK_DEFS = [
  // ── Typed Variables ───────────────────────────────────────────────────────
  {
    type: 'variables_get_number', message0: '%1',
    args0: [{ type: 'field_variable', name: 'VAR', variable: 'item', variableTypes: ['Number'], defaultType: 'Number' }],
    output: 'Number', colour: '#e84393',
    tooltip: 'Returns the value of this number variable.', helpUrl: ''
  },
  {
    type: 'variables_set_number', message0: 'set number %1 to %2',
    args0: [
      { type: 'field_variable', name: 'VAR', variable: 'item', variableTypes: ['Number'], defaultType: 'Number' },
      { type: 'input_value', name: 'VALUE', check: 'Number' }
    ],
    previousStatement: null, nextStatement: null, colour: '#e84393',
    tooltip: 'Sets this number variable to be equal to the input.', helpUrl: ''
  },
  {
    type: 'variables_get_string', message0: '%1',
    args0: [{ type: 'field_variable', name: 'VAR', variable: 'item', variableTypes: ['String'], defaultType: 'String' }],
    output: 'String', colour: '#e84393',
    tooltip: 'Returns the value of this text variable.', helpUrl: ''
  },
  {
    type: 'variables_set_string', message0: 'set text %1 to %2',
    args0: [
      { type: 'field_variable', name: 'VAR', variable: 'item', variableTypes: ['String'], defaultType: 'String' },
      { type: 'input_value', name: 'VALUE', check: 'String' }
    ],
    previousStatement: null, nextStatement: null, colour: '#e84393',
    tooltip: 'Sets this text variable to be equal to the input.', helpUrl: ''
  },
  {
    type: 'variables_get_boolean', message0: '%1',
    args0: [{ type: 'field_variable', name: 'VAR', variable: 'item', variableTypes: ['Boolean'], defaultType: 'Boolean' }],
    output: 'Boolean', colour: '#e84393',
    tooltip: 'Returns the value of this boolean variable.', helpUrl: ''
  },
  {
    type: 'variables_set_boolean', message0: 'set boolean %1 to %2',
    args0: [
      { type: 'field_variable', name: 'VAR', variable: 'item', variableTypes: ['Boolean'], defaultType: 'Boolean' },
      { type: 'input_value', name: 'VALUE', check: 'Boolean' }
    ],
    previousStatement: null, nextStatement: null, colour: '#e84393',
    tooltip: 'Sets this boolean variable to be equal to the input.', helpUrl: ''
  },

  // ── List ─────────────────────────────────────────────────────────────
  {
    type: 'list_store_number', message0: 'Store number %1 in %2 at position %3',
    args0: [
      { type: 'input_value', name: 'VALUE', check: 'Number' },
      { type: 'field_variable', name: 'VAR', variable: 'numlist', variableTypes: ['List Number'], defaultType: 'List Number' },
      { type: 'input_value', name: 'POS', check: 'Number' },
    ],
    previousStatement: null, nextStatement: null, colour: '#ff99cc',
    tooltip: 'Store a number in the list.', helpUrl: ''
  },
  {
    type: 'list_get_number', message0: 'Get number from %1 at position %2',
    args0: [
      { type: 'field_variable', name: 'VAR', variable: 'numlist', variableTypes: ['List Number'], defaultType: 'List Number' },
      { type: 'input_value', name: 'POS', check: 'Number' },
    ],
    output: 'Number', colour: '#ff99cc', inputsInline: true,
    tooltip: 'Get a number from the list.', helpUrl: ''
  },
  {
    type: 'list_store_text', message0: 'Store text %1 in %2 at position %3',
    args0: [
      { type: 'input_value', name: 'VALUE', check: 'String' },
      { type: 'field_variable', name: 'VAR', variable: 'stringlist', variableTypes: ['List String'], defaultType: 'List String' },
      { type: 'input_value', name: 'POS', check: 'Number' },
    ],
    previousStatement: null, nextStatement: null, colour: '#ff99cc',
    tooltip: 'Store text in the list.', helpUrl: ''
  },
  {
    type: 'list_get_text', message0: 'Get text from %1 at position %2',
    args0: [
      { type: 'field_variable', name: 'VAR', variable: 'stringlist', variableTypes: ['List String'], defaultType: 'List String' },
      { type: 'input_value', name: 'POS', check: 'Number' },
    ],
    output: 'String', colour: '#ff99cc', inputsInline: true,
    tooltip: 'Get text from the list.', helpUrl: ''
  },
  {
    type: 'list_store_boolean', message0: 'Store boolean %1 in %2 at position %3',
    args0: [
      { type: 'input_value', name: 'VALUE', check: 'Boolean' },
      { type: 'field_variable', name: 'VAR', variable: 'boollist', variableTypes: ['List Boolean'], defaultType: 'List Boolean' },
      { type: 'input_value', name: 'POS', check: 'Number' },
    ],
    previousStatement: null, nextStatement: null, colour: '#ff99cc',
    tooltip: 'Store a boolean in the list.', helpUrl: ''
  },
  {
    type: 'list_get_boolean', message0: 'Get boolean from %1 at position %2',
    args0: [
      { type: 'field_variable', name: 'VAR', variable: 'boollist', variableTypes: ['List Boolean'], defaultType: 'List Boolean' },
      { type: 'input_value', name: 'POS', check: 'Number' },
    ],
    output: 'Boolean', colour: '#ff99cc', inputsInline: true,
    tooltip: 'Get a boolean from the list.', helpUrl: ''
  },
  {
    type: 'list_store_color', message0: 'Store color %1 in %2 at position %3',
    args0: [
      { type: 'input_value', name: 'VALUE', check: 'Colour' },
      { type: 'field_variable', name: 'VAR', variable: 'colorlist', variableTypes: ['List Colour'], defaultType: 'List Colour' },
      { type: 'input_value', name: 'POS', check: 'Number' },
    ],
    previousStatement: null, nextStatement: null, colour: '#ff99cc',
    tooltip: 'Store a color in the list.', helpUrl: ''
  },
  {
    type: 'list_get_color', message0: 'Get color from %1 at position %2',
    args0: [
      { type: 'field_variable', name: 'VAR', variable: 'colorlist', variableTypes: ['List Colour'], defaultType: 'List Colour' },
      { type: 'input_value', name: 'POS', check: 'Number' },
    ],
    output: 'Colour', colour: '#ff99cc', inputsInline: true,
    tooltip: 'Get a color from the list.', helpUrl: ''
  },

  // ── Text blocks ─────────────────────────────────────────────────────────────
  {
    type: 'text', message0: '" %1 "',
    args0: [{ type: 'field_input', name: 'TEXT', text: 'abc' }],
    output: 'String', colour: '#5b67a5',
    tooltip: 'A text (string) value.'
  },
  {
    type: 'text_join', message0: 'create text with %1 %2',
    args0: [
      { type: 'input_value', name: 'ADD0', check: ['String', 'Number'] },
      { type: 'input_value', name: 'ADD1', check: ['String', 'Number'] },
    ],
    output: 'String', colour: '#5b67a5', inputsInline: false,
    tooltip: 'Join two or more pieces of text together.'
  },
  {
    type: 'text_length', message0: 'length of %1',
    args0: [{ type: 'input_value', name: 'VALUE', check: 'String' }],
    output: 'Number', colour: '#5b67a5', inputsInline: true,
    tooltip: 'Returns the number of characters in the text.'
  },
  {
    type: 'parse_string_block',
    message0: 'get part of text %1 value %2 separating character %3 position %4',
    args0: [
      { type: 'input_dummy' },
      { type: 'input_value', name: 'VALUE', check: 'String', align: 'RIGHT' },
      { type: 'field_dropdown', name: 'DELIM', options: [
        [',', ','], ['-', '-'], ['*', '*'], [':', ':'], ['#', '#'],
        ['$', '$'], ['^', '^'], ['|', '|'], ['@', '@']
      ]},
      { type: 'input_value', name: 'POSITION', check: 'Number', align: 'RIGHT' },
    ],
    output: 'String', colour: '#5b67a5', inputsInline: false,
    tooltip: 'Split text by a separator and get the part at the given position (1-based).'
  },
  {
    type: 'number_to_text',
    message0: 'decimal places %1 number to text %2',
    args0: [
      { type: 'input_value', name: 'DECIMALS', check: 'Number' },
      { type: 'input_value', name: 'NUM', check: 'Number' },
    ],
    output: 'String', colour: '#5b67a5', inputsInline: false,
    tooltip: 'Convert a number to text with specified decimal places.'
  },
  {
    type: 'text_isEmpty', message0: '" %1 " is empty',
    args0: [{ type: 'input_value', name: 'VALUE', check: 'String' }],
    output: 'Boolean', colour: '#5b67a5', inputsInline: true,
    tooltip: 'Returns true if the text is empty.'
  },
  {
    type: 'text_changeCase', message0: 'to %1 %2',
    args0: [
      { type: 'field_dropdown', name: 'CASE', options: [
        ['UPPER CASE', 'UPPERCASE'], ['lower case', 'LOWERCASE'],
      ]},
      { type: 'input_value', name: 'TEXT', check: 'String' },
    ],
    output: 'String', colour: '#5b67a5', inputsInline: true,
    tooltip: 'Change text to upper case or lower case.'
  },

  // ── Shared / Basic ─────────────────────────────────────────────────────────
  {
    type: 'clear_screen', message0: 'clear screen',
    previousStatement: null, nextStatement: null, colour: 0,
    tooltip: 'Turn off all LEDs.'
  },

  {
    type: 'show_icon', message0: 'show icon %1',
    args0: [{
      type: 'field_dropdown', name: 'ICON', options: [
        ['Heart', 'HEART'], ['Happy', 'HAPPY'], ['Sad', 'SAD'], ['Yes', 'YES'], ['No', 'NO'],
        ['Arrow Up', 'ARROW_UP'], ['Arrow Down', 'ARROW_DOWN'], ['Arrow Left', 'ARROW_LEFT'],
        ['Arrow Right', 'ARROW_RIGHT'], ['Star', 'STAR'], ['Diamond', 'DIAMOND'],
        ['Skull', 'SKULL'], ['Music', 'MUSIC'], ['Target', 'TARGET'],
      ]
    }],
    previousStatement: null, nextStatement: null, colour: 0,
    tooltip: 'Display a built-in icon.'
  },

  {
    type: 'show_leds',
    message0: 'LEDs %1 %2 %3 %4 %5 | %6 %7 %8 %9 %10 | %11 %12 %13 %14 %15 | %16 %17 %18 %19 %20 | %21 %22 %23 %24 %25',
    args0: Array.from({ length: 25 }, (_, i) => ({ type: 'field_checkbox', name: `L${i}`, checked: false })),
    previousStatement: null, nextStatement: null, colour: 0,
    tooltip: 'Draw a 5x5 LED pattern.'
  },

  {
    type: 'show_number', message0: 'show number %1',
    args0: [{ type: 'input_value', name: 'NUM', check: 'Number' }],
    inputsInline: true,
    previousStatement: null, nextStatement: null, colour: 0,
    tooltip: 'Display a number on the LED matrix.'
  },

  {
    type: 'show_string', message0: 'show string %1',
    args0: [{ type: 'field_input', name: 'TEXT', text: 'Hello!' }],
    previousStatement: null, nextStatement: null, colour: 0,
    tooltip: 'Scroll a string on the LED matrix.'
  },

  {
    type: 'plot_bar_graph', message0: 'plot bar graph of %1 up to %2',
    args0: [
      { type: 'input_value', name: 'VAL', check: 'Number' },
      { type: 'input_value', name: 'MAX', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null, colour: 0,
    tooltip: 'Plot a bar graph.'
  },

  {
    type: 'wait_secs', message0: 'wait %1 %2',
    args0: [
      { type: 'field_number', name: 'VAL', value: 1, min: 0 },
      { type: 'field_dropdown', name: 'UNIT', options: [['secs', 'SEC'], ['ms', 'MS']] },
    ],
    previousStatement: null, nextStatement: null, colour: 0,
    tooltip: 'Pause execution.'
  },

  {
    type: 'on_pin_pressed', message0: 'on pin %1 pressed %2 %3',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_DIGITAL_PINS },
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    colour: 0, tooltip: 'Run on touch pin press.'
  },

  {
    type: 'create_block', message0: 'create block %1 %2 %3',
    args0: [
      { type: 'field_input', name: 'NAME', text: 'do something' },
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    colour: '#a256c7', tooltip: 'Create a custom block'
  },

  // ── Code ─────────────────────────────────────────────────────────────────
  {
    type: 'setup_runs_once', message0: 'Setup (runs once) %1 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
    colour: '#a256c7', tooltip: 'Runs once at startup.'
  },

  // ── Control ─────────────────────────────────────────────────────────────────
  {
    type: 'on_start', message0: 'on start %1 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
    colour: 33, tooltip: 'Runs once at startup.'
  },

  {
    type: 'forever', message0: 'forever %1 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
    colour: 33, tooltip: 'Runs continuously.'
  },

  {
    type: 'repeat_times', message0: 'repeat %1 times %2 %3',
    args0: [
      { type: 'input_value', name: 'TIMES', check: 'Number' },
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    previousStatement: null, nextStatement: null, colour: '#a256c7',
    tooltip: 'Repeat N times.'
  },

  {
    type: 'loop_with_for',
    message0: 'loop with %1 from %2 to %3 by adding %4 %5 %6',
    args0: [
      { type: 'field_variable', name: 'VAR', variable: 'i' },
      { type: 'input_value', name: 'FROM', check: 'Number' },
      { type: 'input_value', name: 'TO', check: 'Number' },
      { type: 'field_number', name: 'BY', value: 1 },
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' }
    ],
    previousStatement: null, nextStatement: null, colour: '#a256c7',
    tooltip: 'Loop from a starting number to an ending number.'
  },

  {
    type: 'repeat_while', message0: 'repeat while %1 %2 %3',
    args0: [
      { type: 'input_value', name: 'COND', check: 'Boolean' },
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    previousStatement: null, nextStatement: null, colour: 33,
    tooltip: 'Repeat while condition is true.'
  },

  {
    type: 'if_then', message0: 'if %1 then %2 %3',
    args0: [
      { type: 'input_value', name: 'COND', check: 'Boolean' },
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    previousStatement: null, nextStatement: null, colour: 33,
    tooltip: 'Run if condition is true.'
  },

  {
    type: 'if_then_else',
    message0: 'if %1 then %2 %3 else %4 %5',
    args0: [
      { type: 'input_value', name: 'COND', check: 'Boolean' },
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'ELSE' },
    ],
    previousStatement: null, nextStatement: null, colour: 33,
    tooltip: 'If/else.'
  },

  // ── Output ──────────────────────────────────────────────────────────────────
  {
    type: 'plot_x_y', message0: 'plot x %1 y %2',
    args0: [
      { type: 'input_value', name: 'X', check: 'Number' },
      { type: 'input_value', name: 'Y', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null, colour: 210,
    tooltip: 'Turn on LED at (x,y).'
  },

  {
    type: 'plot_x_y_brightness', message0: 'plot x %1 y %2 brightness %3',
    args0: [
      { type: 'input_value', name: 'X', check: 'Number' },
      { type: 'input_value', name: 'Y', check: 'Number' },
      { type: 'input_value', name: 'BRIGHT', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null, colour: 210,
    tooltip: 'Turn on LED at (x,y) with brightness.'
  },

  {
    type: 'unplot_x_y', message0: 'unplot x %1 y %2',
    args0: [
      { type: 'input_value', name: 'X', check: 'Number' },
      { type: 'input_value', name: 'Y', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null, colour: 210,
    tooltip: 'Turn off LED at (x,y).'
  },

  {
    type: 'digital_write_pin', message0: 'digital write pin %1 to %2',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_DIGITAL_PINS },
      { type: 'field_dropdown', name: 'STATE', options: [['HIGH', 'HIGH'], ['LOW', 'LOW']] },
    ],
    previousStatement: null, nextStatement: null, colour: 210,
    tooltip: 'Set a digital pin HIGH or LOW.'
  },

  {
    type: 'write_analog_pin', message0: 'analog write pin %1 to %2',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_PWM_PINS },
      { type: 'input_value', name: 'VAL', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null, colour: 210,
    tooltip: 'Analog write (0-255).'
  },

  {
    type: 'rotate_servo', message0: 'rotate servo pin %1 to %2 degrees',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_PWM_PINS },
      { type: 'input_value', name: 'DEG', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null, colour: 210,
    tooltip: 'Rotate servo (0-180°).'
  },

  {
    type: 'write_servo_pulse', message0: 'write servo pin %1 to pulse %2',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_PWM_PINS },
      { type: 'input_value', name: 'PULSE', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null, colour: 210,
    tooltip: 'Write a servo pulse width in microseconds.'
  },

  {
    type: 'set_pull_pin', message0: 'set pull pin %1 to %2',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_DIGITAL_PINS },
      { type: 'field_dropdown', name: 'MODE', options: [['up', 'UP'], ['down', 'DOWN'], ['none', 'NONE']] },
    ],
    previousStatement: null, nextStatement: null, colour: 210,
    tooltip: 'Set pull-up/down mode for a pin.'
  },

  {
    type: 'analog_set_pitch_pin', message0: 'analog set pitch pin %1',
    args0: [{ type: 'field_dropdown', name: 'PIN', options: GET_PWM_PINS }],
    previousStatement: null, nextStatement: null, colour: 210,
    tooltip: 'Set the analog pitch output pin.'
  },

  {
    type: 'analog_set_pitch_vol', message0: 'analog set pitch volume to %1',
    args0: [{ type: 'input_value', name: 'VOL', check: 'Number' }],
    inputsInline: true,
    previousStatement: null, nextStatement: null, colour: 210,
    tooltip: 'Set analog pitch volume (0-255).'
  },

  {
    type: 'analog_pitch', message0: 'analog pitch %1 for %2 ms',
    args0: [
      { type: 'input_value', name: 'FREQ', check: 'Number' },
      { type: 'input_value', name: 'MS', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null, colour: 210,
    tooltip: 'Play a frequency for N milliseconds.'
  },

  {
    type: 'radio_set_group', message0: 'radio set group %1',
    args0: [{ type: 'field_number', name: 'GROUP', value: 1, min: 0, max: 255, precision: 1 }],
    previousStatement: null, nextStatement: null, colour: 210,
    tooltip: 'Set radio group (0-255).'
  },

  {
    type: 'radio_send_number', message0: 'radio send number %1',
    args0: [{ type: 'input_value', name: 'NUM', check: 'Number' }],
    inputsInline: true,
    previousStatement: null, nextStatement: null, colour: 210,
    tooltip: 'Broadcast a number over radio.'
  },

  {
    type: 'radio_send_string', message0: 'radio send string %1',
    args0: [{ type: 'field_input', name: 'TEXT', text: 'text' }],
    previousStatement: null, nextStatement: null, colour: 210,
    tooltip: 'Broadcast a string over radio.'
  },

  {
    type: 'radio_send_value', message0: 'radio send value %1 = %2',
    args0: [
      { type: 'field_input', name: 'KEY', text: 'key' },
      { type: 'input_value', name: 'VAL', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null, colour: 210,
    tooltip: 'Broadcast a key=value pair over radio.'
  },

  // ── Math ────────────────────────────────────────────────────────────────────
  {
    type: 'math_arithmetic_openhw', message0: '%1 %2 %3',
    args0: [
      { type: 'input_value', name: 'A', check: 'Number' },
      { type: 'field_dropdown', name: 'OP', options: [['+', 'ADD'], ['-', 'SUB'], ['x', 'MUL'], ['/', 'DIV'], ['%', 'MOD']] },
      { type: 'input_value', name: 'B', check: 'Number' },
    ],
    inputsInline: true,
    output: 'Number', colour: 120,
    tooltip: 'Arithmetic.'
  },

  {
    type: 'math_compare', message0: '%1 %2 %3',
    args0: [
      { type: 'input_value', name: 'A', check: 'Number' },
      { type: 'field_dropdown', name: 'OP', options: [['=', 'EQ'], ['!=', 'NEQ'], ['>', 'GT'], ['<', 'LT'], ['>=', 'GTE'], ['<=', 'LTE']] },
      { type: 'input_value', name: 'B', check: 'Number' },
    ],
    inputsInline: true,
    output: 'Boolean', colour: 120,
    tooltip: 'Compare two numbers.'
  },

  {
    type: 'pick_random', message0: 'pick random %1 to %2',
    args0: [
      { type: 'field_number', name: 'MIN', value: 0 },
      { type: 'field_number', name: 'MAX', value: 10 },
    ],
    output: 'Number', colour: 120,
    tooltip: 'Random integer between min and max.'
  },

  {
    type: 'math_abs_of', message0: '%1 of %2',
    args0: [
      {
        type: 'field_dropdown', name: 'OP', options: [
          ['abs', 'ABS'], ['sqrt', 'SQRT'], ['sin', 'SIN'], ['cos', 'COS'],
          ['tan', 'TAN'], ['log', 'LOG'], ['exp', 'EXP'],
        ]
      },
      { type: 'input_value', name: 'NUM', check: 'Number' },
    ],
    inputsInline: true,
    output: 'Number', colour: 120,
    tooltip: 'Math function.'
  },

  {
    type: 'math_round_openhw', message0: '%1 of %2',
    args0: [
      { type: 'field_dropdown', name: 'OP', options: [['round', 'ROUND'], ['floor', 'FLOOR'], ['ceil', 'CEIL']] },
      { type: 'input_value', name: 'NUM', check: 'Number' },
    ],
    inputsInline: true,
    output: 'Number', colour: 120,
    tooltip: 'Round a number.'
  },

  {
    type: 'map_value', message0: 'map %1 from %2—%3 to %4—%5',
    args0: [
      { type: 'input_value', name: 'VAL', check: 'Number' },
      { type: 'field_number', name: 'FL', value: 0 },
      { type: 'field_number', name: 'FH', value: 1023 },
      { type: 'field_number', name: 'TL', value: 0 },
      { type: 'field_number', name: 'TH', value: 255 },
    ],
    inputsInline: true,
    output: 'Number', colour: 120,
    tooltip: 'Re-map a value from one range to another.'
  },

  {
    type: 'math_constrain_block', message0: 'constrain %1 from %2 to %3',
    args0: [
      { type: 'input_value', name: 'VAL', check: 'Number' },
      { type: 'input_value', name: 'LO', check: 'Number' },
      { type: 'input_value', name: 'HI', check: 'Number' },
    ],
    inputsInline: true,
    output: 'Number', colour: 120,
    tooltip: 'Constrain a value to a range.'
  },

  {
    type: 'state_dropdown', message0: '%1',
    args0: [{ type: 'field_dropdown', name: 'STATE', options: [['HIGH', 'HIGH'], ['LOW', 'LOW']] }],
    output: 'Number', colour: 120,
    tooltip: 'HIGH (1) or LOW (0).'
  },

  // ── Input ───────────────────────────────────────────────────────────────────
  {
    type: 'on_button_pressed', message0: 'on button %1 pressed %2 %3',
    args0: [
      { type: 'field_dropdown', name: 'BTN', options: [['A', 'A'], ['B', 'B'], ['A+B', 'A_B']] },
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    colour: 270, tooltip: 'Run when button pressed.'
  },

  {
    type: 'on_shake', message0: 'on shake %1 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
    colour: 270, tooltip: 'Run when board shaken.'
  },

  {
    type: 'read_digital_pin', message0: 'digital read pin %1',
    args0: [{ type: 'field_dropdown', name: 'PIN', options: GET_DIGITAL_PINS }],
    output: 'Number', colour: 210, tooltip: 'Read digital pin.'
  },

  {
    type: 'read_analog_pin', message0: 'analog read pin %1',
    args0: [{ type: 'field_dropdown', name: 'PIN', options: GET_ANALOG_PINS }],
    output: 'Number', colour: 210, tooltip: 'Read analog pin (0-1023).'
  },

  {
    type: 'acceleration', message0: 'acceleration ( %1 )',
    args0: [{ type: 'field_dropdown', name: 'AXIS', options: [['x', 'X'], ['y', 'Y'], ['z', 'Z'], ['strength', 'STRENGTH']] }],
    output: 'Number', colour: 270,
    tooltip: 'Read accelerometer.'
  },

  {
    type: 'rotation', message0: 'rotation ( %1 )',
    args0: [{ type: 'field_dropdown', name: 'AXIS', options: [['pitch', 'PITCH'], ['roll', 'ROLL']] }],
    output: 'Number', colour: 270,
    tooltip: 'Read rotation angle in degrees.'
  },

  {
    type: 'light_level', message0: 'light level',
    output: 'Number', colour: 270,
    tooltip: 'Read ambient light (0-255).'
  },

  {
    type: 'temperature', message0: 'temperature (C)',
    output: 'Number', colour: 270,
    tooltip: 'Read on-chip temperature.'
  },

  {
    type: 'compass_heading', message0: 'compass heading',
    output: 'Number', colour: 270,
    tooltip: 'Read compass heading (0-360).'
  },

  {
    type: 'analog_pitch_vol_read', message0: 'analog pitch volume',
    output: 'Number', colour: 270,
    tooltip: 'Read current pitch volume.'
  },

  {
    type: 'on_pin_changed', message0: 'on pin %1 changed to %2 %3 %4',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: [['P0', '0'], ['P1', '1'], ['P2', '2'], ['P3', '3'], ['P4', '4'], ['P5', '5']] },
      { type: 'field_dropdown', name: 'STATE', options: [['HIGH', 'HIGH'], ['LOW', 'LOW']] },
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    colour: 270, tooltip: 'Run when pin changes state.'
  },

  {
    type: 'on_radio_number', message0: 'on radio received number %1 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
    colour: 270, tooltip: 'Run when a radio number arrives.'
  },

  {
    type: 'on_radio_string', message0: 'on radio received string %1 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
    colour: 270, tooltip: 'Run when a radio string arrives.'
  },

  {
    type: 'on_radio_key_value', message0: 'on radio received key / value %1 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
    colour: 270, tooltip: 'Run when a radio key-value arrives.'
  },

  {
    type: 'button_pressed_bool', message0: 'button %1 pressed',
    args0: [{ type: 'field_dropdown', name: 'BTN', options: [['A', 'A'], ['B', 'B'], ['A+B', 'A_B']] }],
    output: 'Boolean', colour: 270,
    tooltip: 'Returns true if button is currently held.'
  },

  {
    type: 'digital_pin_is', message0: 'digital pin %1 is %2',
    args0: [
      {
        type: 'field_dropdown', name: 'PIN', options: [
          ['P0', '0'], ['P1', '1'], ['P2', '2'], ['P3', '3'], ['P4', '4'], ['P5', '5'],
          ['P6', '6'], ['P7', '7'], ['P8', '8'], ['P9', '9'], ['P10', '10'],
          ['P11', '11'], ['P12', '12'], ['P13', '13'],
        ]
      },
      { type: 'field_dropdown', name: 'STATE', options: [['HIGH', 'HIGH'], ['LOW', 'LOW']] },
    ],
    output: 'Boolean', colour: 270,
    tooltip: 'True if pin is at given state.'
  },

  {
    type: 'gesture_is', message0: 'gesture is %1',
    args0: [{
      type: 'field_dropdown', name: 'GESTURE', options: [
        ['shake', 'SHAKE'], ['logo up', 'LOGO_UP'], ['logo down', 'LOGO_DOWN'],
        ['face up', 'FACE_UP'], ['face down', 'FACE_DOWN'],
        ['tilt left', 'TILT_LEFT'], ['tilt right', 'TILT_RIGHT'],
        ['free fall', 'FREE_FALL'], ['3g', '3G'], ['6g', '6G'], ['8g', '8G'],
      ]
    }],
    output: 'Boolean', colour: 270,
    tooltip: 'True if current gesture matches.'
  },

  {
    type: 'set_accel_range', message0: 'set accelerometer range %1',
    args0: [{ type: 'field_dropdown', name: 'RANGE', options: [['1g', '1G'], ['2g', '2G'], ['4g', '4G'], ['8g', '8G']] }],
    previousStatement: null, nextStatement: null, colour: 270,
    tooltip: 'Set accelerometer measurement range.'
  },

  // ── Message ─────────────────────────────────────────────────────────────────
  {
    type: 'message_setup',
    message0: 'Message Setup %1 Loop %2 %3 Receiving Message? %4 %5 Message: %6 %7 Copy All: %8',
    args0: [
      { type: 'input_dummy' },
      { type: 'field_dropdown', name: 'LOOP', options: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']] },
      { type: 'input_dummy' },
      { type: 'field_checkbox', name: 'RECEIVING', checked: true },
      { type: 'input_dummy' },
      { type: 'field_input', name: 'MESSAGE', text: 'Hello World :)' },
      { type: 'input_dummy' },
      { type: 'field_checkbox', name: 'COPY_ALL', checked: false }
    ],
    colour: '#a256c7', tooltip: 'Setup message properties'
  },
  {
    type: 'send_message',
    message0: 'Send message %1',
    args0: [
      { type: 'input_value', name: 'MESSAGE', check: 'String' }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#a256c7',
    tooltip: 'Send a message'
  },
  {
    type: 'get_message',
    message0: 'Get message',
    output: 'String',
    colour: '#a256c7',
    tooltip: 'Get the received message'
  },
  {
    type: 'message_received',
    message0: 'Message received?',
    output: 'Boolean',
    colour: '#a256c7',
    tooltip: 'Check if a message was received'
  },

  // ── Time ────────────────────────────────────────────────────────────────────
  {
    type: 'setup_time',
    message0: 'Setup Time %1 How many seconds per loop %2',
    args0: [
      { type: 'input_dummy' },
      { type: 'field_input', name: 'SECONDS', text: '0.1' }
    ],
    colour: '#a256c7', tooltip: 'Setup time'
  },
  {
    type: 'set_duration',
    message0: 'set duration to %1 seconds',
    args0: [
      { type: 'input_value', name: 'TIME', check: 'Number' }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#a256c7', tooltip: 'Set a duration (delay) in seconds'
  },
  {
    type: 'wait_for_time',
    message0: 'wait for %1 seconds',
    args0: [
      { type: 'input_value', name: 'TIME', check: 'Number' }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#a256c7', tooltip: 'Wait for specified seconds'
  },
  {
    type: 'seconds_arduino_on',
    message0: 'seconds arduino been on',
    output: 'Number',
    colour: '#a256c7', tooltip: 'Get seconds since Arduino has been on'
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ── Add-ons ─────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  // ── LED ────────────────────────────────────────────────────────────────────
  {
    type: 'led_turn', message0: 'LED pin %1 turn %2',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_DIGITAL_PINS },
      { type: 'field_dropdown', name: 'STATE', options: [['ON', 'ON'], ['OFF', 'OFF']] },
    ],
    previousStatement: null, nextStatement: null, colour: 30,
    tooltip: 'Turn an LED on or off on a digital pin.'
  },
  {
    type: 'led_fade', message0: 'LED pin %1 fade to %2',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_PWM_PINS },
      { type: 'input_value', name: 'BRIGHTNESS', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null, colour: 30,
    tooltip: 'Fade LED brightness (0-255) on a PWM pin.'
  },

  {
    type: 'rgb_led_set',
    message0: 'set RGB LED pins: R %1  G %2  B %3 \n color values: R %4  G %5  B %6',
    args0: [
      { type: 'field_dropdown', name: 'PIN_R', options: GET_PWM_PINS },
      { type: 'field_dropdown', name: 'PIN_G', options: GET_PWM_PINS },
      { type: 'field_dropdown', name: 'PIN_B', options: GET_PWM_PINS },
      { type: 'input_value', name: 'RED', check: 'Number' },
      { type: 'input_value', name: 'GREEN', check: 'Number' },
      { type: 'input_value', name: 'BLUE', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null, colour: 30,
    tooltip: 'Set RGB LED color using R, G, B values (0-255).'
  },

  // ── Motor ──────────────────────────────────────────────────────────────────
  {
    type: 'motor_turn',
    message0: 'motor pin1 %1 pin2 %2 turn %3',
    args0: [
      { type: 'field_dropdown', name: 'PIN1', options: GET_DIGITAL_PINS },
      { type: 'field_dropdown', name: 'PIN2', options: GET_DIGITAL_PINS },
      { type: 'field_dropdown', name: 'DIR', options: [['clockwise', 'CW'], ['counter-clockwise', 'CCW'], ['stop', 'STOP']] },
    ],
    previousStatement: null, nextStatement: null, colour: 30,
    tooltip: 'Turn DC motor in a direction or stop it.'
  },
  {
    type: 'motor_speed',
    message0: 'motor enable pin %1 speed %2',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_PWM_PINS },
      { type: 'input_value', name: 'SPEED', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null, colour: 30,
    tooltip: 'Set DC motor speed (0-255) on enable pin.'
  },

  // ── Passive Buzzer ─────────────────────────────────────────────────────────
  {
    type: 'buzzer_tone',
    message0: 'buzzer pin %1 \n play tone %2 Hz for %3 ms',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_PWM_PINS },
      { type: 'input_value', name: 'FREQ', check: 'Number' },
      { type: 'input_value', name: 'DUR', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null, colour: 30,
    tooltip: 'Play a tone on a passive buzzer.'
  },
  {
    type: 'buzzer_stop',
    message0: 'buzzer pin %1 stop',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_PWM_PINS },
    ],
    previousStatement: null, nextStatement: null, colour: 30,
    tooltip: 'Stop the buzzer.'
  },

  // ── LCD Screen ─────────────────────────────────────────────────────────────
  {
    type: 'lcd_setup',
    message0: 'LCD setup \n columns %1  rows %2  address %3',
    args0: [
      { type: 'field_dropdown', name: 'COLS', options: [['16', '16'], ['20', '20']] },
      { type: 'field_dropdown', name: 'ROWS', options: [['2', '2'], ['4', '4']] },
      { type: 'field_dropdown', name: 'ADDR', options: [['0x27', '0x27'], ['0x3F', '0x3F']] },
    ],
    previousStatement: null, nextStatement: null, colour: 30,
    tooltip: 'Setup I2C LCD display.'
  },
  {
    type: 'lcd_print',
    message0: 'LCD print %1 at row %2 column %3',
    args0: [
      { type: 'field_input', name: 'TEXT', text: 'Hello!' },
      { type: 'field_number', name: 'ROW', value: 0, min: 0, max: 3, precision: 1 },
      { type: 'field_number', name: 'COL', value: 0, min: 0, max: 19, precision: 1 },
    ],
    previousStatement: null, nextStatement: null, colour: 30,
    tooltip: 'Print text on LCD at position.'
  },
  {
    type: 'lcd_clear', message0: 'LCD clear screen',
    previousStatement: null, nextStatement: null, colour: 30,
    tooltip: 'Clear all text from LCD.'
  },
  {
    type: 'lcd_scroll',
    message0: 'LCD scroll %1',
    args0: [
      { type: 'field_dropdown', name: 'DIR', options: [['left', 'LEFT'], ['right', 'RIGHT']] },
    ],
    previousStatement: null, nextStatement: null, colour: 30,
    tooltip: 'Scroll LCD display content.'
  },
  {
    type: 'lcd_blink',
    message0: 'LCD cursor %1',
    args0: [
      { type: 'field_dropdown', name: 'STATE', options: [['blink', 'BLINK'], ['no blink', 'NOBLINK']] },
    ],
    previousStatement: null, nextStatement: null, colour: 30,
    tooltip: 'Enable or disable cursor blink.'
  },
  {
    type: 'lcd_backlight',
    message0: 'LCD backlight %1',
    args0: [
      { type: 'field_dropdown', name: 'STATE', options: [['on', 'ON'], ['off', 'OFF']] },
    ],
    previousStatement: null, nextStatement: null, colour: 30,
    tooltip: 'Turn LCD backlight on or off.'
  },

  // ── Pins ───────────────────────────────────────────────────────────────────
  {
    type: 'pin_set_mode',
    message0: 'set pin %1 mode %2',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_DIGITAL_PINS },
      { type: 'field_dropdown', name: 'MODE', options: [['OUTPUT', 'OUTPUT'], ['INPUT', 'INPUT'], ['INPUT_PULLUP', 'INPUT_PULLUP']] },
    ],
    previousStatement: null, nextStatement: null, colour: 30,
    tooltip: 'Set pin mode explicitly.'
  },

  // ── Stepper Motors ─────────────────────────────────────────────────────────
  {
    type: 'stepper_setup',
    message0: 'stepper setup  steps/rev %1 \n pins: 1 %2  2 %3  3 %4  4 %5',
    args0: [
      { type: 'field_number', name: 'STEPS', value: 200, min: 1, precision: 1 },
      { type: 'field_dropdown', name: 'PIN1', options: GET_DIGITAL_PINS },
      { type: 'field_dropdown', name: 'PIN2', options: GET_DIGITAL_PINS },
      { type: 'field_dropdown', name: 'PIN3', options: GET_DIGITAL_PINS },
      { type: 'field_dropdown', name: 'PIN4', options: GET_DIGITAL_PINS },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null, colour: 30,
    tooltip: 'Setup a stepper motor with 4 pins.'
  },
  {
    type: 'stepper_rotate',
    message0: 'stepper rotate %1 steps at %2 RPM',
    args0: [
      { type: 'input_value', name: 'STEPS', check: 'Number' },
      { type: 'field_number', name: 'RPM', value: 60, min: 1, precision: 1 },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null, colour: 30,
    tooltip: 'Rotate stepper motor by steps at speed.'
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ── Sensors ─────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  // ── Analog ─────────────────────────────────────────────────────────────────
  {
    type: 'analog_sensor_setup',
    message0: 'setup analog sensor %1 on pin %2',
    args0: [
      { type: 'field_input', name: 'LABEL', text: 'sensor' },
      { type: 'field_dropdown', name: 'PIN', options: GET_ANALOG_PINS },
    ],
    previousStatement: null, nextStatement: null, colour: 160,
    tooltip: 'Setup an analog sensor on a pin.'
  },
  {
    type: 'analog_sensor_read',
    message0: 'read analog sensor on pin %1',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_ANALOG_PINS },
    ],
    output: 'Number', colour: 160,
    tooltip: 'Read analog sensor value (0-1023).'
  },

  // ── Button ─────────────────────────────────────────────────────────────────
  {
    type: 'button_setup',
    message0: 'setup button on pin %1 pull %2',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_DIGITAL_PINS },
      { type: 'field_dropdown', name: 'PULL', options: [['up', 'UP'], ['down', 'DOWN']] },
    ],
    previousStatement: null, nextStatement: null, colour: 160,
    tooltip: 'Setup a push button on a pin.'
  },
  {
    type: 'button_is_pressed',
    message0: 'button on pin %1 pressed?',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_DIGITAL_PINS },
    ],
    output: 'Boolean', colour: 160,
    tooltip: 'Returns true if button is pressed.'
  },
  {
    type: 'on_button_sensor_press',
    message0: 'on button pin %1 pressed %2 %3',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_DIGITAL_PINS },
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    colour: 160,
    tooltip: 'Run code when button is pressed.'
  },

  // ── Digital ────────────────────────────────────────────────────────────────
  {
    type: 'digital_sensor_read',
    message0: 'read digital sensor on pin %1',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_DIGITAL_PINS },
    ],
    output: 'Number', colour: 160,
    tooltip: 'Read digital sensor value (HIGH/LOW).'
  },
  {
    type: 'digital_sensor_is_on',
    message0: 'digital sensor on pin %1 is ON?',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_DIGITAL_PINS },
    ],
    output: 'Boolean', colour: 160,
    tooltip: 'Returns true if digital sensor reads HIGH.'
  },

  // ── IR Remote ──────────────────────────────────────────────────────────────
  {
    type: 'ir_remote_setup',
    message0: 'setup IR receiver on pin %1',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_DIGITAL_PINS },
    ],
    previousStatement: null, nextStatement: null, colour: 160,
    tooltip: 'Setup infrared remote receiver.'
  },
  {
    type: 'ir_remote_has_code',
    message0: 'IR has received code?',
    output: 'Boolean', colour: 160,
    tooltip: 'Returns true if an IR code was received.'
  },
  {
    type: 'ir_remote_get_code',
    message0: 'IR get received code',
    output: 'Number', colour: 160,
    tooltip: 'Get the last received IR code value.'
  },

  // ── Temp ───────────────────────────────────────────────────────────────────
  {
    type: 'temp_sensor_setup',
    message0: 'setup temp sensor on pin %1',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_DIGITAL_PINS },
    ],
    previousStatement: null, nextStatement: null, colour: 160,
    tooltip: 'Setup a digital temperature sensor (e.g. DHT11).'
  },
  {
    type: 'temp_sensor_read',
    message0: 'read temp sensor in %1',
    args0: [
      { type: 'field_dropdown', name: 'UNIT', options: [['°C', 'C'], ['°F', 'F']] },
    ],
    output: 'Number', colour: 160,
    tooltip: 'Read temperature from sensor.'
  },

  // ── Thermistor ─────────────────────────────────────────────────────────────
  {
    type: 'thermistor_setup',
    message0: 'setup thermistor on pin %1',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: GET_ANALOG_PINS },
    ],
    previousStatement: null, nextStatement: null, colour: 160,
    tooltip: 'Setup a thermistor on an analog pin.'
  },
  {
    type: 'thermistor_read',
    message0: 'read thermistor temp in %1',
    args0: [
      { type: 'field_dropdown', name: 'UNIT', options: [['°C', 'C'], ['°F', 'F']] },
    ],
    output: 'Number', colour: 160,
    tooltip: 'Read temperature from thermistor.'
  },
]

// ─── Arduino C++ code generator ───────────────────────────────────────────────
function buildGenerator(B) {
  const gen = new B.Generator('Arduino')
  gen.ORDER_ATOMIC = 0; gen.ORDER_ADDITION = 11; gen.ORDER_RELATIONAL = 9
  gen.ORDER_EQUALITY = 8; gen.ORDER_LOGICAL_NOT = 6
  gen.ORDER_LOGICAL_AND = 5; gen.ORDER_LOGICAL_OR = 4; gen.ORDER_NONE = 99
  gen.usedPins = new Map()

  gen.scrub_ = (block, code, opt) => {
    const nxt = block.nextConnection && block.nextConnection.targetBlock()
    return nxt && !opt ? code + gen.blockToCode(nxt) : code
  }
  const vc = (b, name, ord) => gen.valueToCode(b, name, ord) || '0'
  const sc = (b, name) => gen.statementToCode(b, name)

  // Shared / Basic
  gen.forBlock['clear_screen'] = () => 'clearScreen();\n'
  gen.forBlock['show_icon'] = b => `showIcon(${b.getFieldValue('ICON')});\n`
  gen.forBlock['show_leds'] = b => {
    const bits = Array.from({ length: 25 }, (_, i) => b.getFieldValue(`L${i}`) === 'TRUE' ? '1' : '0')
    const rows = Array.from({ length: 5 }, (_, r) => '{' + bits.slice(r * 5, r * 5 + 5).join(',') + '}')
    return `showLEDs({\n  ${rows.join(',\n  ')}\n});\n`
  }
  gen.forBlock['show_number'] = b => `showNumber(${vc(b, 'NUM', gen.ORDER_ATOMIC)});\n`
  gen.forBlock['show_string'] = b => `showString("${b.getFieldValue('TEXT')}");\n`
  gen.forBlock['plot_bar_graph'] = b => `plotBarGraph(${vc(b, 'VAL', gen.ORDER_ATOMIC)}, ${vc(b, 'MAX', gen.ORDER_ATOMIC)});\n`
  gen.forBlock['wait_secs'] = b => {
    const ms = b.getFieldValue('UNIT') === 'SEC'
      ? Math.round(b.getFieldValue('VAL') * 1000) : Math.round(b.getFieldValue('VAL'))
    return `delay(${ms});\n`
  }
  gen.forBlock['on_pin_pressed'] = b => `void onPinPressed_${b.getFieldValue('PIN')}() {\n${sc(b, 'DO')}}\n\n`
  gen.forBlock['create_block'] = b => {
    const name = (b.getFieldValue('NAME') || '').replace(/[^a-zA-Z0-9_]/g, '_');
    return `void custom_${name}() {\n${sc(b, 'DO')}}\n\n`;
  }

  // Code
  gen.forBlock['setup_runs_once'] = b => sc(b, 'DO')

  // Control
  gen.forBlock['on_start'] = b => sc(b, 'DO')
  gen.forBlock['forever'] = b => sc(b, 'DO')
  gen.forBlock['repeat_times'] = b => `for (int i=0; i<${vc(b, 'TIMES', gen.ORDER_ATOMIC)}; i++) {\n${sc(b, 'DO')}}\n`
  gen.forBlock['repeat_while'] = b => `while (${vc(b, 'COND', gen.ORDER_NONE)}) {\n${sc(b, 'DO')}}\n`
  gen.forBlock['if_then'] = b => `if (${vc(b, 'COND', gen.ORDER_NONE)}) {\n${sc(b, 'DO')}}\n`
  gen.forBlock['if_then_else'] = b => `if (${vc(b, 'COND', gen.ORDER_NONE)}) {\n${sc(b, 'DO')}} else {\n${sc(b, 'ELSE')}}\n`
  gen.forBlock['loop_with_for'] = b => {
    const varName = getSafeVarName(b, 'VAR');
    const fromVal = vc(b, 'FROM', gen.ORDER_ATOMIC) || '1';
    const toVal = vc(b, 'TO', gen.ORDER_ATOMIC) || '10';
    const byVal = b.getFieldValue('BY') || '1';
    return `for (int ${varName} = ${fromVal}; ${varName} <= ${toVal}; ${varName} += ${byVal}) {\n${sc(b, 'DO')}}\n`;
  }

  // Output
  gen.forBlock['plot_x_y'] = b => `plot(${vc(b, 'X', gen.ORDER_ATOMIC)}, ${vc(b, 'Y', gen.ORDER_ATOMIC)});\n`
  gen.forBlock['plot_x_y_brightness'] = b => `plotBrightness(${vc(b, 'X', gen.ORDER_ATOMIC)}, ${vc(b, 'Y', gen.ORDER_ATOMIC)}, ${vc(b, 'BRIGHT', gen.ORDER_ATOMIC)});\n`
  gen.forBlock['unplot_x_y'] = b => `unplot(${vc(b, 'X', gen.ORDER_ATOMIC)}, ${vc(b, 'Y', gen.ORDER_ATOMIC)});\n`
  gen.forBlock['digital_write_pin'] = b => {
    const pin = b.getFieldValue('PIN')
    gen.usedPins.set(pin, 'OUTPUT')
    return `digitalWrite(${pin}, ${b.getFieldValue('STATE')});\n`
  }
  gen.forBlock['write_analog_pin'] = b => {
    const pin = b.getFieldValue('PIN')
    gen.usedPins.set(pin, 'OUTPUT')
    return `analogWrite(${pin}, ${vc(b, 'VAL', gen.ORDER_ATOMIC)});\n`
  }
  gen.forBlock['rotate_servo'] = b => {
    const pin = b.getFieldValue('PIN')
    gen.usedPins.set(pin, 'OUTPUT')
    gen._usedServos.add(pin)
    return `myServo_${pin}.write(${vc(b, 'DEG', gen.ORDER_ATOMIC)});\n`
  }
  gen.forBlock['write_servo_pulse'] = b => {
    const pin = b.getFieldValue('PIN')
    gen.usedPins.set(pin, 'OUTPUT')
    gen._usedServos.add(pin)
    return `myServo_${pin}.writeMicroseconds(${vc(b, 'PULSE', gen.ORDER_ATOMIC)});\n`
  }
  gen.forBlock['set_pull_pin'] = b => {
    const pin = b.getFieldValue('PIN')
    const mode = b.getFieldValue('MODE')
    if (mode === 'UP') gen.usedPins.set(pin, 'INPUT_PULLUP')
    else if (mode === 'DOWN') gen.usedPins.set(pin, 'INPUT_PULLDOWN')
    else gen.usedPins.set(pin, 'INPUT')
    return '// pull set\n'
  }
  gen.forBlock['analog_set_pitch_pin'] = b => {
    const pin = b.getFieldValue('PIN')
    gen.usedPins.set(pin, 'OUTPUT')
    return `analogSetPitchPin(${pin});\n`
  }
  gen.forBlock['analog_set_pitch_vol'] = b => `analogSetPitchVolume(${vc(b, 'VOL', gen.ORDER_ATOMIC)});\n`
  gen.forBlock['analog_pitch'] = b => `analogPitch(${vc(b, 'FREQ', gen.ORDER_ATOMIC)}, ${vc(b, 'MS', gen.ORDER_ATOMIC)});\n`
  gen.forBlock['radio_set_group'] = b => `radio.setGroup(${b.getFieldValue('GROUP')});\n`
  gen.forBlock['radio_send_number'] = b => `radio.sendNumber(${vc(b, 'NUM', gen.ORDER_ATOMIC)});\n`
  gen.forBlock['radio_send_string'] = b => `radio.sendString("${b.getFieldValue('TEXT')}");\n`
  gen.forBlock['radio_send_value'] = b => `radio.sendValue("${b.getFieldValue('KEY')}", ${vc(b, 'VAL', gen.ORDER_ATOMIC)});\n`

  // Math
  const AFNS = { ADD: '+', SUB: '-', MUL: '*', DIV: '/', MOD: '%' }
  const CFNS = { EQ: '==', NEQ: '!=', GT: '>', LT: '<', GTE: '>=', LTE: '<=' }
  const MFNS = { ABS: 'abs', SQRT: 'sqrt', SIN: 'sin', COS: 'cos', TAN: 'tan', LOG: 'log', EXP: 'exp' }
  const RFNS = { ROUND: 'round', FLOOR: 'floor', CEIL: 'ceil' }
  gen.forBlock['math_arithmetic_openhw'] = b => [`(${vc(b, 'A', gen.ORDER_ADDITION)} ${AFNS[b.getFieldValue('OP')]} ${vc(b, 'B', gen.ORDER_ADDITION)})`, gen.ORDER_ADDITION]
  gen.forBlock['math_compare'] = b => [`(${vc(b, 'A', gen.ORDER_RELATIONAL)} ${CFNS[b.getFieldValue('OP')]} ${vc(b, 'B', gen.ORDER_RELATIONAL)})`, gen.ORDER_EQUALITY]
  gen.forBlock['pick_random'] = b => [`random(${b.getFieldValue('MIN')}, ${Number(b.getFieldValue('MAX')) + 1})`, gen.ORDER_ATOMIC]
  gen.forBlock['math_abs_of'] = b => [`${MFNS[b.getFieldValue('OP')]}(${vc(b, 'NUM', gen.ORDER_ATOMIC)})`, gen.ORDER_ATOMIC]
  const roundBlockGenerator = b => [`${RFNS[b.getFieldValue('OP')]}(${vc(b, 'NUM', gen.ORDER_ATOMIC)})`, gen.ORDER_ATOMIC]
  gen.forBlock['math_round_openhw'] = roundBlockGenerator
  // Backward compatibility for projects that already contain math_round in XML.
  gen.forBlock['math_round'] = roundBlockGenerator
  gen.forBlock['map_value'] = b => [`map(${vc(b, 'VAL', gen.ORDER_ATOMIC)}, ${b.getFieldValue('FL')}, ${b.getFieldValue('FH')}, ${b.getFieldValue('TL')}, ${b.getFieldValue('TH')})`, gen.ORDER_ATOMIC]
  gen.forBlock['math_constrain_block'] = b => [`constrain(${vc(b, 'VAL', gen.ORDER_ATOMIC)}, ${vc(b, 'LO', gen.ORDER_ATOMIC)}, ${vc(b, 'HI', gen.ORDER_ATOMIC)})`, gen.ORDER_ATOMIC]
  gen.forBlock['state_dropdown'] = b => [b.getFieldValue('STATE'), gen.ORDER_ATOMIC]
  gen.forBlock['math_number'] = b => [String(parseFloat(b.getFieldValue('NUM'))), gen.ORDER_ATOMIC]
  gen.forBlock['logic_boolean'] = b => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', gen.ORDER_ATOMIC]
  gen.forBlock['logic_negate'] = b => [`!(${vc(b, 'BOOL', gen.ORDER_LOGICAL_NOT)})`, gen.ORDER_LOGICAL_NOT]
  gen.forBlock['logic_operation'] = b => {
    const op = b.getFieldValue('OP') === 'AND' ? '&&' : '||'
    const ord = op === '&&' ? gen.ORDER_LOGICAL_AND : gen.ORDER_LOGICAL_OR
    return [`(${vc(b, 'A', ord)} ${op} ${vc(b, 'B', ord)})`, ord]
  }

  gen.forBlock['colour_picker'] = b => [`0x${String(b.getFieldValue('COLOUR')).replace('#', '')}`, gen.ORDER_ATOMIC]
  gen.forBlock['colour_random'] = () => ['random(0, 0xFFFFFF)', gen.ORDER_ATOMIC]
  gen.forBlock['colour_rgb'] = b => {
    const r = vc(b, 'RED', gen.ORDER_BITWISE_SHIFT) || '0'
    const g = vc(b, 'GREEN', gen.ORDER_BITWISE_SHIFT) || '0'
    const bl = vc(b, 'BLUE', gen.ORDER_BITWISE_SHIFT) || '0'
    return [`((${r} & 0xFF) << 16 | (${g} & 0xFF) << 8 | (${bl} & 0xFF))`, gen.ORDER_BITWISE_OR]
  }

  // Input
  gen.forBlock['read_digital_pin'] = b => {
    const pin = b.getFieldValue('PIN')
    if (!gen.usedPins.has(pin)) gen.usedPins.set(pin, 'INPUT')
    return [`digitalRead(${pin})`, gen.ORDER_ATOMIC]
  }
  gen.forBlock['read_analog_pin'] = b => {
    const pin = b.getFieldValue('PIN')
    if (!gen.usedPins.has(pin)) gen.usedPins.set(pin, 'INPUT')
    return [`analogRead(${pin})`, gen.ORDER_ATOMIC]
  }
  gen.forBlock['acceleration'] = b => [`getAccel_${b.getFieldValue('AXIS').toLowerCase()}()`, gen.ORDER_ATOMIC]
  gen.forBlock['rotation'] = b => [`getRotation_${b.getFieldValue('AXIS').toLowerCase()}()`, gen.ORDER_ATOMIC]
  gen.forBlock['light_level'] = () => ['getLightLevel()', gen.ORDER_ATOMIC]
  gen.forBlock['temperature'] = () => ['getTemperature()', gen.ORDER_ATOMIC]
  gen.forBlock['compass_heading'] = () => ['getCompassHeading()', gen.ORDER_ATOMIC]
  gen.forBlock['analog_pitch_vol_read'] = () => ['getAnalogVolume()', gen.ORDER_ATOMIC]
  gen.forBlock['on_button_pressed'] = b => {
    const fn = `onButton${b.getFieldValue('BTN').replace('+', '_')}`
    return `void ${fn}() {\n${sc(b, 'DO')}}\n\n`
  }
  gen.forBlock['on_shake'] = b => `void onShake() {\n${sc(b, 'DO')}}\n\n`
  gen.forBlock['on_pin_changed'] = b => {
    const pin = b.getFieldValue('PIN')
    if (!gen.usedPins.has(pin)) gen.usedPins.set(pin, 'INPUT')
    return `void onPin${pin}_to${b.getFieldValue('STATE')}() {\n${sc(b, 'DO')}}\n\n`
  }
  gen.forBlock['on_radio_number'] = b => `void onRadioNumber(int value) {\n${sc(b, 'DO')}}\n\n`
  gen.forBlock['on_radio_string'] = b => `void onRadioString(String text) {\n${sc(b, 'DO')}}\n\n`
  gen.forBlock['on_radio_key_value'] = b => `void onRadioKeyValue(String key, int value) {\n${sc(b, 'DO')}}\n\n`
  gen.forBlock['button_pressed_bool'] = b => [`isButtonPressed_${b.getFieldValue('BTN')}()`, gen.ORDER_ATOMIC]
  gen.forBlock['digital_pin_is'] = b => {
    const pin = b.getFieldValue('PIN')
    if (!gen.usedPins.has(pin)) gen.usedPins.set(pin, 'INPUT')
    return [`(digitalRead(${pin})==${b.getFieldValue('STATE')})`, gen.ORDER_EQUALITY]
  }
  gen.forBlock['gesture_is'] = b => [`isGesture(GESTURE_${b.getFieldValue('GESTURE')})`, gen.ORDER_ATOMIC]
  gen.forBlock['set_accel_range'] = b => `setAccelRange(${b.getFieldValue('RANGE')});\n`

  // Text blocks
  gen.forBlock['text'] = b => [`"${b.getFieldValue('TEXT')}"`, gen.ORDER_ATOMIC]
  gen.forBlock['text_join'] = b => {
    const a = vc(b, 'ADD0', gen.ORDER_ATOMIC) || '""'
    const c = vc(b, 'ADD1', gen.ORDER_ATOMIC) || '""'
    return [`String(${a}) + String(${c})`, gen.ORDER_ADDITION]
  }
  gen.forBlock['text_length'] = b => {
    const val = vc(b, 'VALUE', gen.ORDER_ATOMIC) || '""'
    return [`String(${val}).length()`, gen.ORDER_ATOMIC]
  }
  gen.forBlock['parse_string_block'] = b => {
    const val = vc(b, 'VALUE', gen.ORDER_ATOMIC) || '""'
    const delim = b.getFieldValue('DELIM') || ','
    const pos = vc(b, 'POSITION', gen.ORDER_ATOMIC) || '1'
    return [`getSubstringByDelim(String(${val}), '${delim}', ${pos})`, gen.ORDER_ATOMIC]
  }
  gen.forBlock['number_to_text'] = b => {
    const num = vc(b, 'NUM', gen.ORDER_ATOMIC) || '0'
    const dec = vc(b, 'DECIMALS', gen.ORDER_ATOMIC) || '2'
    return [`String(${num}, ${dec})`, gen.ORDER_ATOMIC]
  }
  gen.forBlock['text_isEmpty'] = b => {
    const val = vc(b, 'VALUE', gen.ORDER_ATOMIC) || '""'
    return [`(String(${val}).length() == 0)`, gen.ORDER_EQUALITY]
  }
  gen.forBlock['text_changeCase'] = b => {
    const txt = vc(b, 'TEXT', gen.ORDER_ATOMIC) || '""'
    const mode = b.getFieldValue('CASE')
    if (mode === 'UPPERCASE') {
      return [`toUpperCase(String(${txt}))`, gen.ORDER_ATOMIC]
    }
    return [`toLowerCase(String(${txt}))`, gen.ORDER_ATOMIC]
  }

    const getSafeVarName = (b, fieldName) => {
    const v = b.workspace.getVariableById(b.getFieldValue(fieldName));
    return v ? v.name.replace(/[^a-zA-Z0-9_]/g, '_') : 'unknown';
  };

  // Variable blocks
  gen.forBlock['variables_get'] = b => [getSafeVarName(b, 'VAR'), gen.ORDER_ATOMIC]
  gen.forBlock['variables_set'] = b => { const n = getSafeVarName(b, 'VAR'); return `${n} = ${vc(b, 'VALUE', gen.ORDER_ATOMIC)};\n` }
  gen.forBlock['math_change'] = b => { const n = getSafeVarName(b, 'VAR'); return `${n} += ${vc(b, 'DELTA', gen.ORDER_ADDITION)};\n` }

  // Typed Variable blocks
  gen.forBlock['variables_get_number'] = b => [getSafeVarName(b, 'VAR'), gen.ORDER_ATOMIC]
  gen.forBlock['variables_set_number'] = b => { const n = getSafeVarName(b, 'VAR'); return `${n} = ${vc(b, 'VALUE', gen.ORDER_ATOMIC) || '0'};\n` }
  
  gen.forBlock['variables_get_string'] = b => [getSafeVarName(b, 'VAR'), gen.ORDER_ATOMIC]
  gen.forBlock['variables_set_string'] = b => { const n = getSafeVarName(b, 'VAR'); return `${n} = ${vc(b, 'VALUE', gen.ORDER_ATOMIC) || '""'};\n` }
  
  gen.forBlock['variables_get_boolean'] = b => [getSafeVarName(b, 'VAR'), gen.ORDER_ATOMIC]
  gen.forBlock['variables_set_boolean'] = b => { const n = getSafeVarName(b, 'VAR'); return `${n} = ${vc(b, 'VALUE', gen.ORDER_ATOMIC) || 'false'};\n` }

  // List blocks
  const genListGet = (b) => {
    const listName = getSafeVarName(b, 'VAR');
    const pos = vc(b, 'POS', gen.ORDER_ATOMIC) || '1';
    return [`${listName}[(${pos}) - 1]`, gen.ORDER_ATOMIC];
  };
  const genListSet = (b) => {
    const listName = getSafeVarName(b, 'VAR');
    const val = vc(b, 'VALUE', gen.ORDER_ATOMIC) || '0';
    const pos = vc(b, 'POS', gen.ORDER_ATOMIC) || '1';
    return `${listName}[(${pos}) - 1] = ${val};\n`;
  };
  gen.forBlock['list_get_number'] = genListGet;
  gen.forBlock['list_store_number'] = genListSet;
  gen.forBlock['list_get_text'] = genListGet;
  gen.forBlock['list_store_text'] = b => {
    const listName = getSafeVarName(b, 'VAR');
    const val = vc(b, 'VALUE', gen.ORDER_ATOMIC) || '""';
    const pos = vc(b, 'POS', gen.ORDER_ATOMIC) || '1';
    return `${listName}[(${pos}) - 1] = ${val};\n`;
  };
  gen.forBlock['list_get_boolean'] = genListGet;
  gen.forBlock['list_store_boolean'] = b => {
    const listName = getSafeVarName(b, 'VAR');
    const val = vc(b, 'VALUE', gen.ORDER_ATOMIC) || 'false';
    const pos = vc(b, 'POS', gen.ORDER_ATOMIC) || '1';
    return `${listName}[(${pos}) - 1] = ${val};\n`;
  };
  gen.forBlock['list_get_color'] = genListGet;
  gen.forBlock['list_store_color'] = genListSet;

  gen.forBlock['message_setup'] = b => '// Message setup\n'
  gen.forBlock['send_message'] = b => `// Send message: ${vc(b, 'MESSAGE', gen.ORDER_ATOMIC)}\n`
  gen.forBlock['get_message'] = b => ['"Received message"', gen.ORDER_ATOMIC]
  gen.forBlock['message_received'] = b => ['true', gen.ORDER_ATOMIC]

  gen.forBlock['setup_time'] = b => '// Setup time\n'
  gen.forBlock['set_duration'] = b => `delay(${vc(b, 'TIME', gen.ORDER_ATOMIC)} * 1000);\n`
  gen.forBlock['wait_for_time'] = b => `delay(${vc(b, 'TIME', gen.ORDER_ATOMIC)} * 1000);\n`
  gen.forBlock['seconds_arduino_on'] = b => ['(millis() / 1000.0)', gen.ORDER_ATOMIC]

  // ══════════════════════════════════════════════════════════════════════════
  // ── Generators: Add-ons ─────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  gen.forBlock['led_turn'] = function(b) {
    const pin = b.getFieldValue('PIN')
    const state = b.getFieldValue('STATE') === 'ON' ? 'HIGH' : 'LOW'
    gen.usedPins.set(pin, 'OUTPUT')
    return `digitalWrite(${pin}, ${state});\n`
  }
  gen.forBlock['led_fade'] = function(b) {
    const pin = b.getFieldValue('PIN')
    const val = gen.valueToCode(b, 'BRIGHTNESS', gen.ORDER_NONE) || '0'
    gen.usedPins.set(pin, 'OUTPUT')
    return `analogWrite(${pin}, ${val});\n`
  }
  gen.forBlock['rgb_led_set'] = function(b) {
    const r = b.getFieldValue('PIN_R')
    const g = b.getFieldValue('PIN_G')
    const bl = b.getFieldValue('PIN_B')
    const rv = gen.valueToCode(b, 'RED', gen.ORDER_NONE) || '0'
    const gv = gen.valueToCode(b, 'GREEN', gen.ORDER_NONE) || '0'
    const bv = gen.valueToCode(b, 'BLUE', gen.ORDER_NONE) || '0'
    gen.usedPins.set(r, 'OUTPUT')
    gen.usedPins.set(g, 'OUTPUT')
    gen.usedPins.set(bl, 'OUTPUT')
    return `analogWrite(${r}, ${rv});\nanalogWrite(${g}, ${gv});\nanalogWrite(${bl}, ${bv});\n`
  }
  gen.forBlock['motor_turn'] = function(b) {
    const p1 = b.getFieldValue('PIN1')
    const p2 = b.getFieldValue('PIN2')
    const dir = b.getFieldValue('DIR')
    gen.usedPins.set(p1, 'OUTPUT')
    gen.usedPins.set(p2, 'OUTPUT')
    if (dir === 'CW') return `digitalWrite(${p1}, HIGH);\ndigitalWrite(${p2}, LOW);\n`
    if (dir === 'CCW') return `digitalWrite(${p1}, LOW);\ndigitalWrite(${p2}, HIGH);\n`
    return `digitalWrite(${p1}, LOW);\ndigitalWrite(${p2}, LOW);\n`
  }
  gen.forBlock['motor_speed'] = function(b) {
    const pin = b.getFieldValue('PIN')
    const speed = gen.valueToCode(b, 'SPEED', gen.ORDER_NONE) || '0'
    gen.usedPins.set(pin, 'OUTPUT')
    return `analogWrite(${pin}, ${speed});\n`
  }
  gen.forBlock['buzzer_tone'] = function(b) {
    const pin = b.getFieldValue('PIN')
    const freq = gen.valueToCode(b, 'FREQ', gen.ORDER_NONE) || '1000'
    const dur = gen.valueToCode(b, 'DUR', gen.ORDER_NONE) || '1000'
    gen.usedPins.set(pin, 'OUTPUT')
    return `tone(${pin}, ${freq}, ${dur});\ndelay(${dur});\n`
  }
  gen.forBlock['buzzer_stop'] = function(b) {
    const pin = b.getFieldValue('PIN')
    gen.usedPins.set(pin, 'OUTPUT')
    return `noTone(${pin});\n`
  }
  gen.forBlock['lcd_setup'] = function(b) {
    gen._useLCD = true
    gen._lcdCols = b.getFieldValue('COLS')
    gen._lcdRows = b.getFieldValue('ROWS')
    gen._lcdAddr = b.getFieldValue('ADDR')
    return `lcd.init();\nlcd.backlight();\n`
  }
  gen.forBlock['lcd_print'] = function(b) {
    const text = b.getFieldValue('TEXT')
    const row = b.getFieldValue('ROW')
    const col = b.getFieldValue('COL')
    return `lcd.setCursor(${col}, ${row});\nlcd.print("${text}");\n`
  }
  gen.forBlock['lcd_clear'] = function() { return 'lcd.clear();\n' }
  gen.forBlock['lcd_scroll'] = function(b) {
    return b.getFieldValue('DIR') === 'LEFT' ? 'lcd.scrollDisplayLeft();\n' : 'lcd.scrollDisplayRight();\n'
  }
  gen.forBlock['lcd_blink'] = function(b) {
    return b.getFieldValue('STATE') === 'BLINK' ? 'lcd.blink();\n' : 'lcd.noBlink();\n'
  }
  gen.forBlock['lcd_backlight'] = function(b) {
    return b.getFieldValue('STATE') === 'ON' ? 'lcd.backlight();\n' : 'lcd.noBacklight();\n'
  }
  gen.forBlock['pin_set_mode'] = function(b) {
    const pin = b.getFieldValue('PIN')
    const mode = b.getFieldValue('MODE')
    gen.usedPins.set(pin, mode)
    return `pinMode(${pin}, ${mode});\n`
  }
  gen.forBlock['stepper_setup'] = function(b) {
    gen._useStepper = true
    gen._stepperSteps = b.getFieldValue('STEPS')
    gen._stepperPins = [b.getFieldValue('PIN1'), b.getFieldValue('PIN2'), b.getFieldValue('PIN3'), b.getFieldValue('PIN4')]
    return ''
  }
  gen.forBlock['stepper_rotate'] = function(b) {
    const steps = gen.valueToCode(b, 'STEPS', gen.ORDER_NONE) || '0'
    const rpm = b.getFieldValue('RPM')
    return `myStepper.setSpeed(${rpm});\nmyStepper.step(${steps});\n`
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Generators: Sensors ─────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  gen.forBlock['analog_sensor_setup'] = function(b) { return '' }
  gen.forBlock['analog_sensor_read'] = function(b) {
    const pin = b.getFieldValue('PIN')
    gen.usedPins.set(pin, 'INPUT')
    return [`analogRead(${pin})`, gen.ORDER_ATOMIC]
  }
  gen.forBlock['button_setup'] = function(b) {
    const pin = b.getFieldValue('PIN')
    const pull = b.getFieldValue('PULL') === 'UP' ? 'INPUT_PULLUP' : 'INPUT'
    gen.usedPins.set(pin, pull)
    return ''
  }
  gen.forBlock['button_is_pressed'] = function(b) {
    const pin = b.getFieldValue('PIN')
    const pull = gen.usedPins.get(pin) || 'INPUT'
    const targetState = pull === 'INPUT_PULLUP' ? 'LOW' : 'HIGH'
    gen.usedPins.set(pin, pull) // ensure recorded
    return [`digitalRead(${pin}) == ${targetState}`, gen.ORDER_EQUALITY]
  }
  gen.forBlock['on_button_sensor_press'] = function(b) {
    const pin = b.getFieldValue('PIN')
    const pull = gen.usedPins.get(pin) || 'INPUT'
    const targetState = pull === 'INPUT_PULLUP' ? 'LOW' : 'HIGH'
    const doCode = gen.statementToCode(b, 'DO')
    gen.usedPins.set(pin, pull)
    return `if (digitalRead(${pin}) == ${targetState}) {\n${doCode}}\n`
  }
  gen.forBlock['digital_sensor_read'] = function(b) {
    const pin = b.getFieldValue('PIN')
    gen.usedPins.set(pin, 'INPUT')
    return [`digitalRead(${pin})`, gen.ORDER_ATOMIC]
  }
  gen.forBlock['digital_sensor_is_on'] = function(b) {
    const pin = b.getFieldValue('PIN')
    gen.usedPins.set(pin, 'INPUT')
    return [`digitalRead(${pin}) == HIGH`, gen.ORDER_EQUALITY]
  }
  gen.forBlock['ir_remote_setup'] = function(b) {
    gen._useIR = true
    gen._irPin = b.getFieldValue('PIN')
    return `irrecv.enableIRIn();\n`
  }
  gen.forBlock['ir_remote_has_code'] = function(b) {
    return [`irrecv.decode(&results)`, gen.ORDER_ATOMIC]
  }
  gen.forBlock['ir_remote_get_code'] = function(b) {
    return [`results.value`, gen.ORDER_ATOMIC]
  }
  gen.forBlock['temp_sensor_setup'] = function(b) {
    gen._useDHT = true
    gen._dhtPin = b.getFieldValue('PIN')
    return `dht.begin();\n`
  }
  gen.forBlock['temp_sensor_read'] = function(b) {
    const unit = b.getFieldValue('UNIT') === 'F' ? 'true' : 'false'
    return [`dht.readTemperature(${unit})`, gen.ORDER_ATOMIC]
  }
  gen.forBlock['thermistor_setup'] = function(b) {
    gen._useThermistor = true
    gen._thermistorPin = b.getFieldValue('PIN')
    return ''
  }
  gen.forBlock['thermistor_read'] = function(b) {
    const unit = b.getFieldValue('UNIT')
    const rPin = b.getFieldValue('PIN') || gen._thermistorPin || 'A0'
    const tempVar = unit === 'F' ? `(analogRead(${rPin}) * 0.48828125 * 1.8 + 32)` : `(analogRead(${rPin}) * 0.48828125)`
    gen.usedPins.set(rPin, 'INPUT')
    return [tempVar, gen.ORDER_ATOMIC]
  }

  return gen
}

// ─── Sketch assembler ─────────────────────────────────────────────────────────
function generateSketch(gen, ws) {
  if (typeof gen.init === 'function') {
    gen.init(ws)
  }
  
  // Reset state flags for Add-ons/Sensors
  gen._useLCD = false
  gen._useStepper = false
  gen._useIR = false
  gen._useDHT = false
  gen._useThermistor = false
  gen._lcdAddr = '0x27'
  gen._lcdCols = '16'
  gen._lcdRows = '2'
  gen._stepperSteps = 200
  gen._stepperPins = ['8', '9', '10', '11']
  gen._irPin = '2'
  gen._dhtPin = '2'
  gen._thermistorPin = 'A0'

  gen.usedPins = new Map()
  gen._usedServos = new Set()

  const vars = (ws.getAllVariables() || []).filter(v => v.type === 'Number' || v.type === 'String' || v.type === 'Boolean');
  const varDecl = vars.length ? vars.map(v => {
    let type = 'int';
    let def = '0';
    if (v.type === 'String') { type = 'String'; def = '""'; }
    else if (v.type === 'Boolean') { type = 'bool'; def = 'false'; }
    const safeName = v.name.replace(/[^a-zA-Z0-9_]/g, '_');
    return `${type} ${safeName} = ${def};`;
  }).join('\n') + '\n\n' : ''
  
  const listVars = (ws.getAllVariables() || []).filter(v => v.type.startsWith('List '));
  const listVarDecl = listVars.length ? listVars.map(v => {
    let type = 'int';
    if (v.type === 'List String') type = 'String';
    else if (v.type === 'List Boolean') type = 'bool';
    else if (v.type === 'List Colour') type = 'long';
    const safeName = v.name.replace(/[^a-zA-Z0-9_]/g, '_');
    return `${type} ${safeName}[10];`; // Default to size 10
  }).join('\n') + '\n\n' : ''
  
  gen.usedPins = new Map() // Reset/initialize used pins Map for the current generation run

  // Block types that generate standalone function definitions (placed outside setup/loop)
  const FUNCTION_BLOCK_TYPES = new Set([
    'on_button_pressed', 'on_shake', 'on_pin_pressed', 'on_pin_changed',
    'on_radio_number', 'on_radio_string', 'on_radio_key_value', 'create_block',
  ])

  // Generate code for top-level blocks first so generators can record usedPins, helpers, etc.
  let setup = '', loop_ = ''
  const extras = []
  gen.usedPins = new Map()
  ws.getTopBlocks(true).forEach(b => {
    try {
      const code = gen.blockToCode(b)
      console.log('[generateSketch] block type:', b.type, '| code:', JSON.stringify(code), '| hasInput DO:', !!b.getInput('DO'), '| childBlock:', b.getInputTargetBlock && b.getInputTargetBlock('DO')?.type)
      if (!code) return
      // Skip stray value blocks (they return [code, order] arrays, not strings)
      if (Array.isArray(code)) return
      
      const SETUP_BLOCKS = new Set(['on_start', 'setup_runs_once', 'lcd_setup', 'ir_remote_setup', 'temp_sensor_setup', 'stepper_setup', 'analog_sensor_setup', 'button_setup', 'thermistor_setup'])
      
      if (SETUP_BLOCKS.has(b.type)) {
        setup += code
      } else if (b.type === 'forever') {
        loop_ += code
      } else if (FUNCTION_BLOCK_TYPES.has(b.type)) {
        extras.push(code)
      } else {
        // Any block that is not a root container (setup/loop/function) is an orphaned block on the canvas.
        // We skip generating code for orphaned blocks so floating blocks do not execute!
        console.log('[generateSketch] Skipping orphaned block:', b.type)
      }
    } catch (err) {
      // Don't let one block break generation for others
      console.warn('Block code gen error for', b.type, ':', err.stack || err)
    }
  })

  // After generating blocks, compute platform setup code (e.g., pinMode) from recorded usage
  let setupCode = ''
  gen.usedPins.forEach((mode, pin) => {
    setupCode += `  pinMode(${pin}, ${mode});\n`
  })
  if (gen._usedServos && gen._usedServos.size > 0) {
    gen._usedServos.forEach(pin => {
      setupCode += `  myServo_${pin}.attach(${pin});\n`
    })
  }

  const setupFunc = `void setup() {\n${setupCode}${setup}}\n\n`
  const loopFunc = loop_ ? `void loop() {\n${loop_}}\n\n` : 'void loop() {\n  // loop\n}\n\n'

  // Collect helper functions needed by text blocks
  const allCode = extras.join('\n') + setup + loop_
  let helpers = ''
  if (allCode.includes('getSubstringByDelim(')) {
    helpers += `String getSubstringByDelim(String data, char separator, int index) {
  int found = 0;
  int strIndex[] = {0, -1};
  int maxIndex = data.length() - 1;
  for (int i = 0; i <= maxIndex && found <= index; i++) {
    if (data.charAt(i) == separator || i == maxIndex) {
      found++;
      strIndex[0] = strIndex[1] + 1;
      strIndex[1] = (i == maxIndex) ? i + 1 : i;
    }
  }
  return found > index ? data.substring(strIndex[0], strIndex[1]) : "";
}\n\n`
  }
  if (allCode.includes('toUpperCase(String(')) {
    helpers += `String toUpperCase(String str) {\n  str.toUpperCase();\n  return str;\n}\n\n`
  }
  if (allCode.includes('toLowerCase(String(')) {
    helpers += `String toLowerCase(String str) {\n  str.toLowerCase();\n  return str;\n}\n\n`
  }

  // Handle library includes and global declarations
  let includes = ''
  let globals = ''
  
  if (gen._useLCD) {
    includes += '#include <Wire.h>\n#include <LiquidCrystal_I2C.h>\n'
    globals += `LiquidCrystal_I2C lcd(${gen._lcdAddr}, ${gen._lcdCols}, ${gen._lcdRows});\n`
  }
  if (gen._useStepper) {
    includes += '#include <Stepper.h>\n'
    globals += `Stepper myStepper(${gen._stepperSteps}, ${gen._stepperPins.join(', ')});\n`
  }
  if (gen._useIR) {
    includes += '#include <IRremote.h>\n'
    globals += `IRrecv irrecv(${gen._irPin});\ndecode_results results;\n`
  }
  if (gen._useDHT) {
    includes += '#include <DHT.h>\n'
    globals += `DHT dht(${gen._dhtPin}, DHT11);\n`
  }
  if (gen._usedServos && gen._usedServos.size > 0) {
    includes += '#include <Servo.h>\n'
    gen._usedServos.forEach(pin => {
      globals += `Servo myServo_${pin};\n`
    })
  }
  
  if (includes || globals) {
    globals += '\n'
  }

  const code = `// Generated by OpenHW Studio Block Editor\n\n${includes}${globals}${varDecl}${listVarDecl}${helpers}${extras.join('\n')}${extras.length ? '\n' : ''}${setupFunc}${loopFunc}`
  return typeof gen.finish === 'function' ? gen.finish(code) : code
}

function attachDefaultShadows(ws, block, type) {
  try {
    if (type === 'parse_string_block') {
      if (block.getInput('VALUE')) {
        const valBlock = ws.newBlock('text'); valBlock.setFieldValue('blue,red,green', 'TEXT');
        valBlock.initSvg(); valBlock.render(); valBlock.setShadow(true);
        block.getInput('VALUE').connection.connect(valBlock.outputConnection);
      }
      if (block.getInput('POSITION')) {
        const posBlock = ws.newBlock('math_number'); posBlock.setFieldValue('1', 'NUM');
        posBlock.initSvg(); posBlock.render(); posBlock.setShadow(true);
        block.getInput('POSITION').connection.connect(posBlock.outputConnection);
      }
    } else if (type === 'number_to_text') {
      if (block.getInput('DECIMALS')) {
        const decBlock = ws.newBlock('math_number'); decBlock.setFieldValue('2', 'NUM');
        decBlock.initSvg(); decBlock.render(); decBlock.setShadow(true);
        block.getInput('DECIMALS').connection.connect(decBlock.outputConnection);
      }
      if (block.getInput('NUM')) {
        const numBlock = ws.newBlock('math_number'); numBlock.setFieldValue('5.23', 'NUM');
        numBlock.initSvg(); numBlock.render(); numBlock.setShadow(true);
        block.getInput('NUM').connection.connect(numBlock.outputConnection);
      }
    } else if (type === 'colour_rgb') {
      const attachNum = (name, val) => {
        if (block.getInput(name)) {
          const num = ws.newBlock('math_number'); num.setFieldValue(val, 'NUM');
          num.initSvg(); num.render(); num.setShadow(true);
          block.getInput(name).connection.connect(num.outputConnection);
        }
      }
      attachNum('RED', '100'); attachNum('GREEN', '50'); attachNum('BLUE', '0');
    } else if (type === 'send_message') {
      if (block.getInput('MESSAGE')) {
        const valBlock = ws.newBlock('text'); valBlock.setFieldValue('Hi', 'TEXT');
        valBlock.initSvg(); valBlock.render(); valBlock.setShadow(true);
        block.getInput('MESSAGE').connection.connect(valBlock.outputConnection);
      }
    } else if (type === 'set_duration') {
      if (block.getInput('TIME')) {
        const valBlock = ws.newBlock('math_number'); valBlock.setFieldValue('2', 'NUM');
        valBlock.initSvg(); valBlock.render(); valBlock.setShadow(true);
        block.getInput('TIME').connection.connect(valBlock.outputConnection);
      }
    } else if (type === 'wait_for_time') {
      if (block.getInput('TIME')) {
        const valBlock = ws.newBlock('math_number'); valBlock.setFieldValue('0.2', 'NUM');
        valBlock.initSvg(); valBlock.render(); valBlock.setShadow(true);
        block.getInput('TIME').connection.connect(valBlock.outputConnection);
      }
    } else if (type === 'repeat_times') {
      if (block.getInput('TIMES')) {
        const valBlock = ws.newBlock('math_number'); valBlock.setFieldValue('10', 'NUM');
        valBlock.initSvg(); valBlock.render(); valBlock.setShadow(true);
        block.getInput('TIMES').connection.connect(valBlock.outputConnection);
      }
    } else if (type === 'loop_with_for') {
      if (block.getInput('FROM')) {
        const valBlock = ws.newBlock('math_number'); valBlock.setFieldValue('1', 'NUM');
        valBlock.initSvg(); valBlock.render(); valBlock.setShadow(true);
        block.getInput('FROM').connection.connect(valBlock.outputConnection);
      }
      if (block.getInput('TO')) {
        const valBlock = ws.newBlock('math_number'); valBlock.setFieldValue('10', 'NUM');
        valBlock.initSvg(); valBlock.render(); valBlock.setShadow(true);
        block.getInput('TO').connection.connect(valBlock.outputConnection);
      }
    } else if (type === 'rotate_servo') {
      if (block.getInput('DEG')) {
        const valBlock = ws.newBlock('math_number'); valBlock.setFieldValue('90', 'NUM');
        valBlock.initSvg(); valBlock.render(); valBlock.setShadow(true);
        block.getInput('DEG').connection.connect(valBlock.outputConnection);
      }
    } else if (type === 'write_servo_pulse') {
      if (block.getInput('PULSE')) {
        const valBlock = ws.newBlock('math_number'); valBlock.setFieldValue('1500', 'NUM');
        valBlock.initSvg(); valBlock.render(); valBlock.setShadow(true);
        block.getInput('PULSE').connection.connect(valBlock.outputConnection);
      }
    } else if (type === 'analog_write') {
      if (block.getInput('VAL')) {
        const valBlock = ws.newBlock('math_number'); valBlock.setFieldValue('128', 'NUM');
        valBlock.initSvg(); valBlock.render(); valBlock.setShadow(true);
        block.getInput('VAL').connection.connect(valBlock.outputConnection);
      }
    } else if (type === 'play_tone') {
      if (block.getInput('FREQ')) {
        const valBlock = ws.newBlock('math_number'); valBlock.setFieldValue('440', 'NUM');
        valBlock.initSvg(); valBlock.render(); valBlock.setShadow(true);
        block.getInput('FREQ').connection.connect(valBlock.outputConnection);
      }
      if (block.getInput('MS')) {
        const valBlock = ws.newBlock('math_number'); valBlock.setFieldValue('500', 'NUM');
        valBlock.initSvg(); valBlock.render(); valBlock.setShadow(true);
        block.getInput('MS').connection.connect(valBlock.outputConnection);
      }
    } else if (type === 'math_change') {
      if (block.getInput('DELTA')) {
        const valBlock = ws.newBlock('math_number'); valBlock.setFieldValue('1', 'NUM');
        valBlock.initSvg(); valBlock.render(); valBlock.setShadow(true);
        block.getInput('DELTA').connection.connect(valBlock.outputConnection);
      }
    }

    // Generic fallback: attach '0' math_number shadow block to any remaining unconnected Number inputs
    if (window.Blockly && block.inputList) {
      for (let i = 0; i < block.inputList.length; i++) {
        const input = block.inputList[i];
        if (input.type === window.Blockly.INPUT_VALUE && input.connection && !input.connection.targetConnection) {
          const checks = input.connection.getCheck();
          if (checks && (checks.includes('Number') || checks[0] === 'Number')) {
            const valBlock = ws.newBlock('math_number');
            valBlock.setFieldValue('0', 'NUM');
            valBlock.initSvg(); valBlock.render(); valBlock.setShadow(true);
            input.connection.connect(valBlock.outputConnection);
          }
        }
      }
    }
  } catch (err) { console.error('Failed to attach shadow blocks:', err) }
}

// ─── Blockly theme ────────────────────────────────────────────────────────────
function buildTheme(B, isDark) {
  return B.Theme.defineTheme(isDark ? 'ohw_dark' : 'ohw_light', {
    base: B.Themes.Classic,
    componentStyles: isDark ? {
      workspaceBackgroundColour: '#0a0e1a',
      scrollbarColour: '#1e2d47',
      insertionMarkerColour: '#00d4ff',
      insertionMarkerOpacity: 0.35,
      scrollbarOpacity: 0.5,
      cursorColour: '#00d4ff',
    } : {
      workspaceBackgroundColour: '#f8fafc',
      scrollbarColour: '#94a3b8',
      insertionMarkerColour: '#0284c7',
      insertionMarkerOpacity: 0.35,
      scrollbarOpacity: 0.5,
      cursorColour: '#0284c7',
    },
  })
}

function parseBlocklyXml(B, xmlText) {
  const parse = B?.utils?.xml?.textToDom || B?.Xml?.textToDom
  if (!parse) throw new Error('Blockly XML parser is unavailable')
  return parse(xmlText)
}

function serializeBlocklyXml(B, dom) {
  const serialize = B?.utils?.xml?.domToText || B?.Xml?.domToText
  if (!serialize) throw new Error('Blockly XML serializer is unavailable')
  return serialize(dom)
}

function workspaceToBlocklyDom(B, ws) {
  if (!B?.Xml?.workspaceToDom) throw new Error('Blockly workspaceToDom is unavailable')
  return B.Xml.workspaceToDom(ws)
}

function loadBlocklyXmlIntoWorkspace(B, dom, ws) {
  if (B?.Xml?.clearWorkspaceAndLoadFromXml) {
    B.Xml.clearWorkspaceAndLoadFromXml(dom, ws)
    return
  }
  if (B?.Xml?.domToWorkspace) {
    if (typeof ws.clear === 'function') ws.clear()
    B.Xml.domToWorkspace(dom, ws)
    return
  }
  throw new Error('Blockly XML workspace loader is unavailable')
}

// Scale block previews to fit inside the sidebar — never crop left/right.
function layoutBlockPreview(host, previewWs, block, containerWidth, B) {
  const padX = 10
  const padY = 8
  const width = Math.max(72, Math.round(containerWidth || host.clientWidth || 280))
  const availableW = Math.max(40, width - padX * 2)

  const measured = typeof block.getHeightWidth === 'function' ? block.getHeightWidth() : null
  let contentW = Math.max(24, Math.ceil(measured?.width || 120))
  let contentH = Math.max(20, Math.ceil(measured?.height || 28))
  let originX = 0
  let originY = 0

  const root = typeof block.getSvgRoot === 'function' ? block.getSvgRoot() : null
  if (root?.getBBox) {
    try {
      const bbox = root.getBBox()
      if (bbox.width > 0 && bbox.height > 0) {
        contentW = Math.ceil(bbox.width)
        contentH = Math.ceil(bbox.height)
        originX = bbox.x
        originY = bbox.y
      }
    } catch (_) { /* getBBox can fail before paint */ }
  }

  // Fit entirely inside the panel; slight upscale only when it still fits.
  let scale = availableW / contentW
  scale = Math.min(1.12, Math.max(0.4, scale))
  if (contentW * scale > availableW) scale = availableW / contentW

  const scaledW = contentW * scale
  const scaledH = contentH * scale
  const totalW = width
  const totalH = Math.max(40, Math.ceil(scaledH + padY * 2))

  const canvas = previewWs.getCanvas()
  if (canvas) {
    const tx = Math.round(padX + (availableW - scaledW) / 2 - originX * scale)
    const ty = Math.round(padY + (totalH - scaledH) / 2 - originY * scale)
    canvas.setAttribute('transform', `translate(${tx}, ${ty}) scale(${scale})`)
  }

  const injectionDiv = host.querySelector('.injectionDiv')
  if (injectionDiv) {
    injectionDiv.style.position = 'relative'
    injectionDiv.style.width = `${totalW}px`
    injectionDiv.style.height = `${totalH}px`
    injectionDiv.style.maxWidth = '100%'
    injectionDiv.style.overflow = 'hidden'
    injectionDiv.style.pointerEvents = 'none'
  }

  const svg = host.querySelector('svg.blocklySvg')
  if (svg) {
    svg.setAttribute('width', String(totalW))
    svg.setAttribute('height', String(totalH))
    svg.style.width = `${totalW}px`
    svg.style.height = `${totalH}px`
    svg.style.maxWidth = '100%'
    svg.style.display = 'block'
    svg.style.overflow = 'hidden'
    svg.style.pointerEvents = 'none'
  }

  const mainBg = host.querySelector('.blocklyMainBackground')
  if (mainBg) mainBg.style.display = 'none'

  if (typeof B.svgResize === 'function') B.svgResize(previewWs)
  return totalH
}

// ─── Live Blockly previews in category panel ─────────────────────────────────
const BlockPreview = React.memo(function BlockPreview({ type, onDragStart, onDragEnd, varId, varName, varType, isDark, blocklyReady }) {
  const wrapperRef = useRef(null)
  const hostRef = useRef(null)
  const wsRef = useRef(null)
  const blockRef = useRef(null)
  const [renderError, setRenderError] = useState(false)
  const [renderReady, setRenderReady] = useState(false)
  const [previewHeight, setPreviewHeight] = useState(60)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const measure = () => {
      const w = el.getBoundingClientRect().width
      if (w > 0) setContainerWidth(Math.round(w))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!blocklyReady) {
      setRenderReady(false)
      return
    }

    const B = window.Blockly
    const host = hostRef.current
    if (!B || !host) return

    let disposed = false
    setRenderError(false)
    setRenderReady(false)

    if (wsRef.current) {
      try { wsRef.current.dispose() } catch (_) { }
      wsRef.current = null
      blockRef.current = null
    }
    host.innerHTML = ''

    const previewWs = B.inject(host, {
      renderer: 'zelos',
      theme: buildTheme(B, isDark),
      readOnly: true,
      toolbox: null,
      move: { scrollbars: false, drag: false, wheel: false },
      zoom: { controls: false, wheel: false, pinch: false, startScale: 1, minScale: 1, maxScale: 1 },
      trashcan: false,
      sounds: false,
    })
    wsRef.current = previewWs

    try {
      // Create the variable in the preview workspace so field_variable shows the correct name
      if (varId && varName) {
        previewWs.createVariable(varName, varType || '', varId)
      }
      const block = previewWs.newBlock(type)
      if (varId && block.getField('VAR')) block.getField('VAR').setValue(varId)
      block.initSvg()
      block.render()
      attachDefaultShadows(previewWs, block, type)
      blockRef.current = block
      if (!disposed) setRenderReady(true)
    } catch (err) {
      console.error('Live preview render failed:', err)
      if (!disposed) setRenderError(true)
    }

    return () => {
      disposed = true
      if (wsRef.current) {
        try { wsRef.current.dispose() } catch (_) { }
        wsRef.current = null
        blockRef.current = null
      }
      if (host) host.innerHTML = ''
    }
  }, [type, varId, varName, varType, isDark, blocklyReady])

  useEffect(() => {
    if (!blocklyReady || !wsRef.current || !blockRef.current || !hostRef.current || containerWidth < 1) return
    const B = window.Blockly
    if (!B) return
    try {
      const totalH = layoutBlockPreview(hostRef.current, wsRef.current, blockRef.current, containerWidth, B)
      setPreviewHeight(totalH)
    } catch (err) {
      console.error('Live preview layout failed:', err)
    }
  }, [containerWidth, blocklyReady, type, varId, isDark])

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', type)
    if (varId) e.dataTransfer.setData('application/x-varId', varId)
    e.dataTransfer.effectAllowed = 'copy'

    // Fix the "ghosting" issue by using a transparent drag image.
    // The "real" preview will be rendered in the workspace.
    const img = new Image()
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(img, 0, 0)

    // Calculate grab offset so the block stays under the cursor correctly.
    let offsetX = 0
    let offsetY = 0
    if (hostRef.current) {
      const rect = hostRef.current.getBoundingClientRect()
      offsetX = e.clientX - rect.left
      offsetY = e.clientY - rect.top
    }

    onDragStart && onDragStart({ type, varId, offsetX, offsetY })
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      style={{ cursor: 'grab', userSelect: 'none', lineHeight: 0, padding: '4px 0', width: '100%' }}
    >
      <div
        ref={wrapperRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          minHeight: previewHeight,
          boxSizing: 'border-box',
          background: !renderReady ? (isDark ? '#11182766' : '#f1f5f966') : 'transparent',
          borderRadius: 8,
          overflow: 'hidden',
          transition: 'height 0.2s ease-in-out',
        }}
      >
        <div
          ref={hostRef}
          style={{
            width: '100%',
            maxWidth: '100%',
            height: previewHeight,
            boxSizing: 'border-box',
            overflow: 'hidden',
            pointerEvents: 'none',
            opacity: renderReady && !renderError ? 1 : 0,
            transition: 'opacity 0.2s, height 0.2s ease-in-out',
          }}
        />
        {(!blocklyReady || !renderReady || renderError) && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              minHeight: 24,
              minWidth: 72,
              padding: '4px 8px',
              borderRadius: 6,
              border: `1px solid ${isDark ? '#2a3e60' : '#d8e1ee'}`,
              color: isDark ? '#7f97bc' : '#6b7f9e',
              fontSize: 10,
              fontWeight: 600,
              lineHeight: 1.2,
              textTransform: 'lowercase',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {type.replace(/_/g, ' ')}
          </div>
        )}
      </div>
    </div>
  )
}, (prev, next) => (
  prev.type === next.type
  && prev.varId === next.varId
  && prev.isDark === next.isDark
  && prev.blocklyReady === next.blocklyReady
))

// ─── Global script loader for Blockly ─────────────────────────────────────────
// This cache ensures that multiple instances of BlocklyEditor don't try to 
// load and execute the same scripts concurrently, which avoids 
// "already registered" errors in Blockly's extension system.
const scriptCache = {}

async function loadBlocklyScript(src) {
  if (scriptCache[src]) return scriptCache[src]

  scriptCache[src] = (async () => {
    // Check if script is already in DOM from a previous manual injection
    if (document.querySelector(`script[data-src="${src}"]`)) return

    try {
      const response = await fetch(src)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const scriptText = await response.text()

      // Wrap script to mask 'define' from UMD detection.
      // This ensures Blockly scripts don't attempt to use Monaco's AMD loader (loader.js),
      // but fall back to global assignment (window.Blockly).
      const wrappedScript = `(function(define){${scriptText}\n})(undefined);`
      const blob = new Blob([wrappedScript], { type: 'application/javascript' })
      const blobUrl = URL.createObjectURL(blob)

      return new Promise((res, rej) => {
        const s = document.createElement('script')
        s.src = blobUrl
        s.async = false
        s.dataset.src = src // track original src
        s.onload = () => {
          URL.revokeObjectURL(blobUrl)
          res()
        }
        s.onerror = (e) => {
          URL.revokeObjectURL(blobUrl)
          delete scriptCache[src] // Allow retry on failure
          rej(new Error(`Execution failed: ${src}`))
        }
        document.head.appendChild(s)
      })
    } catch (err) {
      delete scriptCache[src] // Allow retry on failure
      throw new Error(`Fetch failed: ${src} - ${err.message}`)
    }
  })()

  return scriptCache[src]
}


// ── Main component ────────────────────────────────────────────────────────────
const SIDEBAR_WIDTH_DESKTOP = 300;
const SIDEBAR_WIDTH_MOBILE = 260;

const BLOCKLY_HISTORY_LIMIT = 64
const EMPTY_WORKSPACE_XML = '<xml xmlns="https://developers.google.com/blockly/xml"></xml>'

export default function BlocklyEditor({ onExportCode, onChange, xml, onXmlChange, visible, useBlocklyCode, onToggleUseBlocklyCode, boardKind, isMobile = false }) {
  const [showSidebar, setShowSidebar] = useState(true);
  const sidebarWidth = isMobile ? SIDEBAR_WIDTH_MOBILE : SIDEBAR_WIDTH_DESKTOP;
  const wsContainerRef = useRef(null)
  const workspaceRef = useRef(null)
  const importFileRef = useRef(null)
  const draggingRef = useRef(null) // { type, varId, offsetX, offsetY }
  const previewBlockRef = useRef(null)
  const markerManagerRef = useRef(null)
  const genRef = useRef(null)
  const blockCountRef = useRef(0)
  const historyPastRef = useRef([])
  const historyFutureRef = useRef([])
  const applyingHistoryRef = useRef(false)
  const pushHistoryTimerRef = useRef(null)
  // Tracks whether the external XML effect has run at least once after mount.
  // On the very first run (component mount / page refresh), init() has already
  // loaded the XML — we must NOT regenerate code to avoid overwriting the
  // user's manually written text-editor code.
  const isFirstXmlLoadRef = useRef(true)
  // Stable ref to always hold the latest syncGeneratedCode without making it
  // a useEffect dependency (which would re-fire the effect on every parent render).
  const syncGeneratedCodeRef = useRef(null)

  const [loadStatus, setLoadStatus] = useState('loading')
  const [errMsg, setErrMsg] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [activeCat, setActiveCat] = useState('basic')
  const [parentCat, setParentCat] = useState(null)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [showBlocksPanel, setShowBlocksPanel] = useState(false)
  const [variables, setVariables] = useState([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') !== 'light'
  )

  const captureWorkspaceXml = useCallback(() => {
    const B = window.Blockly
    const ws = workspaceRef.current
    if (!B || !ws) return EMPTY_WORKSPACE_XML
    try {
      return serializeBlocklyXml(B, workspaceToBlocklyDom(B, ws))
    } catch (_) {
      return EMPTY_WORKSPACE_XML
    }
  }, [])

  const refreshUndoRedoState = useCallback(() => {
    setCanUndo(historyPastRef.current.length > 1)
    setCanRedo(historyFutureRef.current.length > 0)
  }, [])

  const resetBlocklyHistory = useCallback((snapshot) => {
    const snap = snapshot || EMPTY_WORKSPACE_XML
    historyPastRef.current = [snap]
    historyFutureRef.current = []
    refreshUndoRedoState()
  }, [refreshUndoRedoState])

  const syncGeneratedCode = useCallback(({ notifyParent = true, emitXml = false } = {}) => {
    const B = window.Blockly
    const ws = workspaceRef.current
    const gen = genRef.current
    if (!B || !ws || !gen) return ''
    try {
      const code = generateSketch(gen, ws)
      setGeneratedCode(code)
      if (notifyParent && onChange) onChange(code)
      if (notifyParent && emitXml && onXmlChange) {
        const dom = workspaceToBlocklyDom(B, ws)
        onXmlChange(serializeBlocklyXml(B, dom))
      }
      return code
    } catch (err) {
      console.warn('Failed to generate Blockly code:', err)
      return ''
    }
  }, [onChange, onXmlChange])
  // Keep the ref in sync every render (synchronous, no effect needed).
  syncGeneratedCodeRef.current = syncGeneratedCode

  const scheduleHistoryPush = useCallback(() => {
    if (applyingHistoryRef.current) return
    if (pushHistoryTimerRef.current) clearTimeout(pushHistoryTimerRef.current)
    pushHistoryTimerRef.current = setTimeout(() => {
      pushHistoryTimerRef.current = null
      if (applyingHistoryRef.current) return
      const snap = captureWorkspaceXml()
      const past = historyPastRef.current
      if (past.length > 0 && past[past.length - 1] === snap) return
      past.push(snap)
      if (past.length > BLOCKLY_HISTORY_LIMIT) past.shift()
      historyFutureRef.current = []
      refreshUndoRedoState()
    }, 120)
  }, [captureWorkspaceXml, refreshUndoRedoState])

  const applyWorkspaceXml = useCallback((xmlText, { notifyParent = true } = {}) => {
    const B = window.Blockly
    const ws = workspaceRef.current
    if (!B || !ws || !xmlText) return
    applyingHistoryRef.current = true
    B.Events.disable()
    try {
      const dom = parseBlocklyXml(B, xmlText)
      loadBlocklyXmlIntoWorkspace(B, dom, ws)
      B.svgResize(ws)
      setVariables([...ws.getAllVariables()])
      syncGeneratedCode({ notifyParent, emitXml: notifyParent })
    } catch (err) {
      console.warn('Failed to apply blockly history snapshot:', err)
    } finally {
      B.Events.enable()
      applyingHistoryRef.current = false
    }
  }, [syncGeneratedCode])

  const performBlocklyUndo = useCallback(() => {
    const past = historyPastRef.current
    if (past.length <= 1) return
    const current = captureWorkspaceXml()
    historyFutureRef.current.unshift(current)
    past.pop()
    applyWorkspaceXml(past[past.length - 1])
    refreshUndoRedoState()
  }, [captureWorkspaceXml, applyWorkspaceXml, refreshUndoRedoState])

  const performBlocklyRedo = useCallback(() => {
    const future = historyFutureRef.current
    if (future.length === 0) return
    const next = future.shift()
    applyWorkspaceXml(next)
    historyPastRef.current.push(next)
    refreshUndoRedoState()
  }, [applyWorkspaceXml, refreshUndoRedoState])

  // ── Track theme changes ────────────────────────────────────────────────────
  useEffect(() => {
    const mo = new MutationObserver(() =>
      setIsDark(document.documentElement.getAttribute('data-theme') !== 'light')
    )
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => mo.disconnect()
  }, [])


  useEffect(() => {
    window.BLOCKLY_BOARD_KIND = boardKind || 'arduino_uno'
  }, [boardKind])

  useEffect(() => {
    const ws = workspaceRef.current
    if (!ws || !window.Blockly) return
    ws.setTheme(buildTheme(window.Blockly, isDark))
  }, [isDark])

  // ── Handle visibility / sidebar layout changes ─────────────────────────────
  useEffect(() => {
    if (visible && workspaceRef.current && window.Blockly) {
      window.Blockly.svgResize(workspaceRef.current)
    }
  }, [visible, showSidebar])

  // ── Undo/redo scoped to Blockly while the blocks tab is open ───────────────
  useEffect(() => {
    if (!visible || loadStatus !== 'ready') return

    const onKey = (e) => {
      const target = e.target || document.activeElement
      if (target) {
        const tag = target.tagName?.toUpperCase()
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
        if (target.isContentEditable) return
        if (target.closest && target.closest('.monaco-editor, .monaco-diff-editor, .monaco-editor-background, .right-panel-editor, .code-tab-content, .injectionDiv, .blocklySvg, .blocklyWorkspace, .blocklyWidgetDiv, .blocklyTooltipDiv, .blocklyFlyout, .blocklyToolboxDiv, [class*="blockly"], [class*="monaco"], [role="textbox"], [contenteditable="true"]')) return
      }
      if (document.activeElement) {
        const activeTag = document.activeElement.tagName?.toUpperCase()
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) return
        if (document.activeElement.isContentEditable) return
        if (document.activeElement.closest && document.activeElement.closest('.monaco-editor, .monaco-diff-editor, .monaco-editor-background, .right-panel-editor, .code-tab-content, .injectionDiv, .blocklySvg, .blocklyWorkspace, .blocklyWidgetDiv, .blocklyTooltipDiv, .blocklyFlyout, .blocklyToolboxDiv, [class*="blockly"], [class*="monaco"], [role="textbox"], [contenteditable="true"]')) return
      }
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return

      const isUndo = e.code === 'KeyZ' && !e.shiftKey
      const isRedo = e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey)
      if (!isUndo && !isRedo) return

      e.preventDefault()
      e.stopImmediatePropagation()

      if (isUndo) performBlocklyUndo()
      else performBlocklyRedo()
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [visible, loadStatus, performBlocklyUndo, performBlocklyRedo])

  // ── Load Blockly scripts ───────────────────────────────────────────────────
  useEffect(() => {
    const boot = () => {
      if (window.Blockly) { init(); return }
      ; (async () => {
        for (const s of CDN_SCRIPTS) {
          await loadBlocklyScript(s);
        }
      })()
        .then(init)
        .catch(e => {
          console.error('Blockly Boot Error:', e);
          setErrMsg(e.message);
          setLoadStatus('error');
        })
    }
    boot()
    return () => {
      if (pushHistoryTimerRef.current) clearTimeout(pushHistoryTimerRef.current)
      if (workspaceRef.current) { workspaceRef.current.dispose(); workspaceRef.current = null }
    }
  }, []) // eslint-disable-line

  // ── Initialise workspace ───────────────────────────────────────────────────
  const init = useCallback(() => {
    const B = window.Blockly
    if (!B || !wsContainerRef.current || workspaceRef.current) return

    if (!B._hasPatchedFieldNumber && B.FieldNumber) {
      B._hasPatchedFieldNumber = true
      const origShowEditor = B.FieldNumber.prototype.showEditor_
      B.FieldNumber.prototype.showEditor_ = function() {
        origShowEditor.apply(this, arguments)
        setTimeout(() => {
          const htmlInput = document.querySelector('.blocklyHtmlInput')
          if (htmlInput && !htmlInput._hasNumValidator) {
            htmlInput._hasNumValidator = true
            htmlInput.addEventListener('input', () => {
              const val = htmlInput.value
              const cleaned = val.replace(/[^0-9.\-eE]/g, '')
              if (val !== cleaned) {
                const start = htmlInput.selectionStart
                htmlInput.value = cleaned
                if (start !== null) {
                  const diff = val.length - cleaned.length
                  htmlInput.selectionStart = start > diff ? start - diff : 0
                  htmlInput.selectionEnd = htmlInput.selectionStart
                }
              }
            })
          }
        }, 10)
      }
    }
    const defsToRegister = BLOCK_DEFS.filter((def) => !B.Blocks?.[def.type])
    if (defsToRegister.length > 0) {
      B.defineBlocksWithJsonArray(defsToRegister)
    }
    genRef.current = buildGenerator(B)

    const ws = B.inject(wsContainerRef.current, {
      toolbox: null,
      theme: buildTheme(B, isDark),
      renderer: 'zelos',
      grid: { spacing: 20, length: 3, colour: isDark ? '#1e2d47' : '#e2e8f0', snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 3, minScale: 0.3, pinch: true },
      move: { scrollbars: true, drag: true, wheel: false },
      scrollbars: true,
      trashcan: true,
      sounds: false,
    })
    workspaceRef.current = ws
    setLoadStatus('ready')

    if (B && typeof B.Events?.disableOrphans === 'function') {
      ws.addChangeListener(B.Events.disableOrphans)
    }

    if (xml) {
      // Disable events while loading initial XML so that Blockly does NOT fire
      // BLOCK_CREATE events for each block. Without this, the change listener
      // would treat them as user-made changes and generate code on every mount.
      B.Events.disable()
      try {
        const dom = parseBlocklyXml(B, xml)
        loadBlocklyXmlIntoWorkspace(B, dom, ws)
      } catch (err) {
        console.error('Failed to load initial XML:', err)
      } finally {
        B.Events.enable()
      }
    }
    resetBlocklyHistory(captureWorkspaceXml())
    // NOTE: Do NOT generate code on initial load/mount.
    // Code generation is intentionally deferred until the user actually
    // changes a block. This prevents spurious re-generation on refresh
    // or when the right panel is closed and reopened.

    const skipHistoryTypes = new Set([
      B.Events.CLICK,
      B.Events.SELECTED,
      B.Events.VIEWPORT_CHANGE,
      B.Events.TOOLBOX_ITEM_SELECT,
      B.Events.BUBBLE_OPEN,
      B.Events.BUBBLE_CLOSE,
      B.Events.TRASHCAN_OPEN,
      B.Events.TRASHCAN_CLOSE,
    ])

    ws.addChangeListener(e => {
      const B2 = window.Blockly
      if (!B2) return

      // --- PIN VALIDATION LOGIC ---
      if (e.type === B2.Events.CLICK && e.blockId) {
        const clickedBlock = ws.getBlockById(e.blockId)
        if (clickedBlock && clickedBlock.data && clickedBlock.data.startsWith('origHue:')) {
          let conflictingField = null
          clickedBlock.inputList.forEach(input => {
            input.fieldRow.forEach(field => {
              if (field instanceof B2.FieldDropdown && 
                 (field.name.includes('PIN') || field.name === 'ECHO' || field.name === 'TRIG')) {
                conflictingField = field
              }
            })
          })
          if (conflictingField) {
            const options = conflictingField.getOptions()
            const allUsedPins = new Set()
            ws.getAllBlocks(false).forEach(b => {
              b.inputList.forEach(input => {
                input.fieldRow.forEach(f => {
                  if (f instanceof B2.FieldDropdown && 
                     (f.name.includes('PIN') || f.name === 'ECHO' || f.name === 'TRIG')) {
                    allUsedPins.add(f.getValue())
                  }
                })
              })
            })
            for (const option of options) {
              const val = option[1]
              if (!allUsedPins.has(val)) {
                conflictingField.setValue(val)
                break
              }
            }
          }
        }
      }

      // Run validation for changes
      if (!e.isUiEvent || e.type === B2.Events.CLICK) {
        const blocks = ws.getAllBlocks(false)
        const pinUsage = new Map()

        blocks.forEach(block => {
          const pinFields = []
          block.inputList.forEach(input => {
            input.fieldRow.forEach(field => {
              if (field instanceof B2.FieldDropdown && 
                 (field.name.includes('PIN') || field.name === 'ECHO' || field.name === 'TRIG')) {
                pinFields.push(field)
              }
            })
          })
          pinFields.forEach(field => {
            const pinVal = field.getValue()
            // Also capture the STATE field value (HIGH/LOW/ON/OFF) if present on this block
            let stateVal = null
            block.inputList.forEach(input => {
              input.fieldRow.forEach(f => {
                if (f instanceof B2.FieldDropdown && f.name === 'STATE') {
                  stateVal = f.getValue()
                }
              })
            })
            // Build a composite key: only blocks with the same pin AND same state conflict
            const usageKey = stateVal ? `${pinVal}::${stateVal}` : pinVal
            if (!pinUsage.has(usageKey)) pinUsage.set(usageKey, [])
            pinUsage.get(usageKey).push({ block, field })
          })
        })

        // Clear conflicts for ALL blocks first
        blocks.forEach(block => {
          if (block.data && block.data.startsWith('origHue:')) {
            const hue = parseInt(block.data.split(':')[1], 10)
            if (!isNaN(hue)) block.setColour(hue)
            block.data = null
            block.setWarningText(null, 'pin_conflict')
          }
        })

        // Identify and mark conflicts
        pinUsage.forEach((usages, usageKey) => {
          if (usages.length > 1) {
            usages.forEach(({ block }) => {
              if (!block.data || !block.data.startsWith('origHue:')) {
                block.data = 'origHue:' + block.getHue()
              }
              block.setColour('#A0A0A0')
              block.setWarningText('Pin conflict detected! Click the block to auto-assign a free pin.', 'pin_conflict')
            })
          }
        })
      }
      // --- END PIN VALIDATION LOGIC ---

      if ([B2.Events.VAR_CREATE, B2.Events.VAR_DELETE, B2.Events.VAR_RENAME].includes(e.type))
        setVariables([...ws.getAllVariables()])
      if (!skipHistoryTypes.has(e.type)) scheduleHistoryPush()
      // Only generate code for real structural block changes.
      // Explicitly skip all UI events (clicks, viewport, toolbox, bubbles, etc.)
      // and only allow events that represent actual block mutations.
      if (e.isUiEvent) return
      const STRUCTURAL_EVENTS = new Set([
        B2.Events.BLOCK_CREATE,
        B2.Events.BLOCK_DELETE,
        B2.Events.BLOCK_MOVE,
        B2.Events.BLOCK_CHANGE,
        B2.Events.VAR_CREATE,
        B2.Events.VAR_DELETE,
        B2.Events.VAR_RENAME,
      ])
      if (!STRUCTURAL_EVENTS.has(e.type)) return
      syncGeneratedCode({ notifyParent: true, emitXml: true })
    })
  }, [isDark, boardKind, xml, resetBlocklyHistory, captureWorkspaceXml, scheduleHistoryPush, syncGeneratedCode])

  // Watch for external XML changes (e.g. project import or async project load)
  useEffect(() => {
    const isReady = loadStatus === 'ready';
    if (!isReady || !workspaceRef.current || !window.Blockly) return;

    const currentXml = captureWorkspaceXml();
    // Only load if the XML prop actually differs from what is in the workspace.
    // This handles two cases:
    //   a) init() ran with empty xml (CDN loaded after project data) → workspace
    //      is empty but xml prop now has saved blocks → load them.
    //   b) init() already loaded the xml → currentXml matches xml → skip (no-op).
    if (xml && xml !== currentXml) {
      const B = window.Blockly;
      // Disable events so Blockly doesn't fire BLOCK_CREATE events into the
      // change listener for every block loaded from XML. We call
      // syncGeneratedCode explicitly below only when needed.
      B.Events.disable();
      try {
        const dom = parseBlocklyXml(B, xml);
        loadBlocklyXmlIntoWorkspace(B, dom, workspaceRef.current);
        resetBlocklyHistory(xml);
      } catch (err) {
        console.error('Failed to load external XML:', err);
      } finally {
        B.Events.enable();
      }

      const topBlocks = workspaceRef.current.getTopBlocks(false);
      if (topBlocks.length > 0) {
        // Only push generated code to the parent on SUBSEQUENT loads
        // (genuine project imports). On the first load (mount/refresh) we show
        // the blocks but leave the text editor code untouched.
        if (!isFirstXmlLoadRef.current) {
          syncGeneratedCodeRef.current?.({ notifyParent: true, emitXml: false });
        }
      } else {
        setVariables([...workspaceRef.current.getAllVariables()]);
      }
    }

    // Mark first load as done so future xml changes generate code normally.
    isFirstXmlLoadRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xml, loadStatus, captureWorkspaceXml, resetBlocklyHistory]);
  // ── Resize Blockly when container changes ──────────────────────────────────
  useEffect(() => {
    if (!wsContainerRef.current) return
    const ro = new ResizeObserver(() => {
      if (workspaceRef.current && window.Blockly)
        window.Blockly.svgResize(workspaceRef.current)
    })
    ro.observe(wsContainerRef.current)
    return () => ro.disconnect()
  }, [loadStatus])

  const placeBlock = useCallback((type, wsX, wsY) => {
    const ws = workspaceRef.current
    if (!ws || !window.Blockly) return
    const block = ws.newBlock(type)
    block.initSvg()
    block.render()
    attachDefaultShadows(ws, block, type)
    const fallback = (blockCountRef.current++ % 10) * 18
    block.moveTo(new window.Blockly.utils.Coordinate(
      wsX !== undefined ? wsX : 30 + fallback,
      wsY !== undefined ? wsY : 30 + fallback,
    ))
    window.Blockly.svgResize(ws)
    syncGeneratedCode({ notifyParent: true, emitXml: true })
  }, [])

  const addBlock = useCallback((type) => placeBlock(type), [placeBlock])

  // ── Variable blocks ────────────────────────────────────────────────────────
  const addVariableBlock = useCallback((type, variable) => {
    const ws = workspaceRef.current
    if (!ws || !window.Blockly) return
    const block = ws.newBlock(type)
    if (block.getField('VAR')) block.getField('VAR').setValue(variable.getId())

    // Clean up auto-created 'item' variable that Blockly generates from field_variable defaults
    const allVars = ws.getAllVariables() || []
    allVars.forEach(v => {
      if (v.name === 'item' && v.getId() !== variable.getId()) {
        try { ws.deleteVariableById(v.getId()) } catch (_) { /* in use */ }
      }
    })

    // For typed set blocks, auto-attach a default value block (like ElectroBlocks)
    if (type === 'variables_set_number' && block.getInput('VALUE')) {
      try {
        const valBlock = ws.newBlock('math_number')
        valBlock.setFieldValue('10', 'NUM')
        valBlock.initSvg(); valBlock.render()
        block.getInput('VALUE').connection.connect(valBlock.outputConnection)
      } catch (_) { /* ignore if connection fails */ }
    } else if (type === 'variables_set_string' && block.getInput('VALUE')) {
      try {
        const valBlock = ws.newBlock('text')
        valBlock.setFieldValue('abc', 'TEXT')
        valBlock.initSvg(); valBlock.render()
        block.getInput('VALUE').connection.connect(valBlock.outputConnection)
      } catch (_) { /* ignore if connection fails */ }
    } else if (type === 'variables_set_boolean' && block.getInput('VALUE')) {
      try {
        const valBlock = ws.newBlock('logic_boolean')
        valBlock.initSvg(); valBlock.render()
        block.getInput('VALUE').connection.connect(valBlock.outputConnection)
      } catch (_) { /* ignore if connection fails */ }
    }

    block.initSvg(); block.render()
    attachDefaultShadows(ws, block, type)
    const n = (blockCountRef.current++ % 10) * 18
    block.moveTo(new window.Blockly.utils.Coordinate(30 + n, 30 + n))
    syncGeneratedCode({ notifyParent: true, emitXml: true })
  }, [syncGeneratedCode])

  const handleNewVariable = useCallback((type = '') => {
    const ws = workspaceRef.current
    if (!ws) return
    const typeLabel = type === 'String' ? 'Text' : type || 'Any'
    const name = window.prompt(`${typeLabel} variable name:`)
    if (name && name.trim()) {
      ws.createVariable(name.trim(), type || '')
      setVariables([...ws.getAllVariables()])
    }
  }, [])

  /** Remove drag preview without deleting blocks that were snapped below it. */
  const safeDisposePreviewBlock = useCallback(() => {
    const B = window.Blockly
    const block = previewBlockRef.current
    if (!B || !block) return
    previewBlockRef.current = null
    B.Events.disable()
    try {
      if (block.isDisposed && block.isDisposed()) return
      // Preview inserted on a stack owns the blocks below — heal before dispose.
      if (block.getParent() || block.getNextBlock()) {
        block.unplug(true)
      }
      // Do NOT disconnect all connections here; that orphans the stack and dispose() deletes it.
      block.dispose(false)
    } catch (err) {
      console.warn('Error disposing preview block safely:', err)
    } finally {
      B.Events.enable()
    }
  }, [])

  /** Find nearest compatible connection after the real block is placed. */
  const findSnapConnection = useCallback((block, maxRadius = 48) => {
    const B = window.Blockly
    if (!B || !block) return null
    let bestDist = maxRadius
    let bestPair = null
    block.getConnections_(true).forEach((conn) => {
      if (conn.isConnected()) return
      const candidate = conn.closest(maxRadius, new B.utils.Coordinate(0, 0))
      if (!candidate) return
      const dx = conn.x - candidate.x
      const dy = conn.y - candidate.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < bestDist) {
        bestDist = dist
        bestPair = { source: conn, target: candidate }
      }
    })
    return bestPair
  }, [])

  // ── Drag-and-drop into workspace ───────────────────────────────────────────
  const handleWsDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'

    const ws = workspaceRef.current
    const B = window.Blockly
    if (!ws || !B || !draggingRef.current) return

    const screenCoord = new B.utils.Coordinate(e.clientX, e.clientY)
    let wsCoord
    try {
      wsCoord = B.utils.svgMath.screenToWsCoordinates(ws, screenCoord)
      const scale = ws.scale || 1
      wsCoord.x -= (draggingRef.current.offsetX || 0) / scale
      wsCoord.y -= (draggingRef.current.offsetY || 0) / scale
    } catch (_) { return }

    if (!previewBlockRef.current) {
      const { type, varId } = draggingRef.current

      // Disable events while creating the temporary preview block 
      // to avoid polluting the undo/redo history and causing event errors.
      B.Events.disable()
      try {
        const block = ws.newBlock(type)
        if (varId && block.getField('VAR')) block.getField('VAR').setValue(varId)

        block.initSvg()
        block.render()

        if (block.getSvgRoot()) {
          block.getSvgRoot().setAttribute('opacity', '1')
        }

        previewBlockRef.current = block
        B.svgResize(ws)
      } finally {
        B.Events.enable()
      }
    }

    const block = previewBlockRef.current
    if (block) {
      B.Events.disable()
      try {
        // Keep preview disconnected while dragging — never attach to workspace stacks.
        if (block.getParent() || block.getNextBlock()) {
          block.unplug(true)
        }
        block.moveTo(wsCoord)
      } finally {
        B.Events.enable()
      }
    }
  }, [])

  const handleWsDrop = useCallback((e) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('text/plain')
    const ws = workspaceRef.current
    const B = window.Blockly
    const varId = e.dataTransfer.getData('application/x-varId')
    if (!ws || !B) return

    const screenCoord = new B.utils.Coordinate(e.clientX, e.clientY)
    let wsCoord
    try {
      wsCoord = B.utils.svgMath.screenToWsCoordinates(ws, screenCoord)
      const scale = ws.scale || 1
      if (draggingRef.current) {
        wsCoord.x -= (draggingRef.current.offsetX || 0) / scale
        wsCoord.y -= (draggingRef.current.offsetY || 0) / scale
      }
    } catch (_) { wsCoord = new B.utils.Coordinate(60, 60) }

    if (markerManagerRef.current) {
      try { markerManagerRef.current.dispose() } catch (_) { }
      markerManagerRef.current = null
    }

    safeDisposePreviewBlock()

    const block = ws.newBlock(type)
    if (varId && block.getField('VAR')) block.getField('VAR').setValue(varId)
    block.initSvg()
    block.render()
    attachDefaultShadows(ws, block, type)
    block.moveTo(wsCoord)

    const snap = findSnapConnection(block)
    if (snap?.source && snap?.target) {
      try {
        snap.source.connect(snap.target)
      } catch (err) {
        console.warn('Failed to connect block on drop:', err)
      }
    }

    B.svgResize(ws)
    draggingRef.current = null
    syncGeneratedCode({ notifyParent: true, emitXml: true })
  }, [safeDisposePreviewBlock, findSnapConnection, syncGeneratedCode])

  const handleExport = useCallback(() => {
    const code = generatedCode || '// No blocks yet.\nvoid setup() {}\nvoid loop() {}'
    if (onExportCode) onExportCode(code)
  }, [generatedCode, onExportCode])

  const handleExportPng = async () => {
    if (!workspaceRef.current || !window.Blockly || !wsContainerRef.current) return
    const ws = workspaceRef.current
    const B = window.Blockly

    try {
      // 1. Hide elements that shouldn't be in the PNG
      const toHide = wsContainerRef.current.querySelectorAll(
        '.blocklyTrash, .blocklyZoom, .blocklyScrollbarExternal, .blocklyMarkers, .blocklyGrid, .blocklyMainBackground, [id*="grid"]'
      )
      toHide.forEach(el => {
        el.style.setProperty('display', 'none', 'important')
        el.style.setProperty('visibility', 'hidden', 'important')
      })

      // 2. Capture the full container
      const fullCanvas = await html2canvas(wsContainerRef.current, {
        backgroundColor: isDark ? '#0a0e1a' : '#f8fafc',
        logging: false,
        scale: 2,
      })

      // 3. Restore hidden elements
      toHide.forEach(el => {
        el.style.display = ''
        el.style.visibility = ''
      })

      // 4. Calculate the bounding box of blocks in screen pixels
      const canvasGroup = ws.getCanvas()
      const bbox = canvasGroup.getBBox()
      const scale = ws.getScale()
      const transform = canvasGroup.getAttribute('transform') || ''
      const translateMatch = /translate\(\s*([^\s,)]+)[,\s]+([^\s,)]+)/.exec(transform)
      const tx = translateMatch ? parseFloat(translateMatch[1]) : 0
      const ty = translateMatch ? parseFloat(translateMatch[2]) : 0

      const margin = 50 // Generous padding
      const sourceX = (bbox.x * scale + tx - margin) * 2 // html2canvas scale is 2
      const sourceY = (bbox.y * scale + ty - margin) * 2
      const sourceW = (bbox.width * scale + margin * 2) * 2
      const sourceH = (bbox.height * scale + margin * 2) * 2

      // 5. Create a cropped canvas
      const croppedCanvas = document.createElement('canvas')
      croppedCanvas.width = Math.max(1, sourceW)
      croppedCanvas.height = Math.max(1, sourceH)
      const ctx = croppedCanvas.getContext('2d')

      ctx.drawImage(
        fullCanvas,
        sourceX, sourceY, sourceW, sourceH,
        0, 0, sourceW, sourceH
      )

      // 6. Add metadata and download
      const xml = serializeBlocklyXml(B, workspaceToBlocklyDom(B, ws))
      const MARKER = '\x00BLOCKLY_META\x00'
      const jsonPayload = MARKER + JSON.stringify({ xml, exported: new Date().toISOString() })

      croppedCanvas.toBlob(async (blob) => {
        const pngBuf = await blob.arrayBuffer()
        const pngBytes = new Uint8Array(pngBuf)
        const metaBytes = new TextEncoder().encode(jsonPayload)
        const combined = new Uint8Array(pngBytes.length + metaBytes.length)
        combined.set(pngBytes)
        combined.set(metaBytes, pngBytes.length)

        const finalBlob = new Blob([combined], { type: 'image/png' })
        const url = URL.createObjectURL(finalBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `blocks_${new Date().getTime()}.png`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      }, 'image/png')
    } catch (err) {
      console.error('Blockly PNG Export failed:', err)
      alert('Failed to export blocks as PNG.')
    }
  }

  const handleImportPng = (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.png')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const bytes = new Uint8Array(e.target.result)
        const MARKER = '\x00BLOCKLY_META\x00'
        const markerBytes = new TextEncoder().encode(MARKER)

        let markerByteIdx = -1
        for (let i = bytes.length - markerBytes.length; i >= 0; i--) {
          let ok = true
          for (let j = 0; j < markerBytes.length; j++) {
            if (bytes[i + j] !== markerBytes[j]) { ok = false; break }
          }
          if (ok) { markerByteIdx = i; break }
        }

        if (markerByteIdx === -1) {
          alert('This PNG does not contain Blockly data.')
          return
        }

        const payloadBytes = bytes.slice(markerByteIdx + markerBytes.length)
        const jsonStr = new TextDecoder().decode(payloadBytes)
        const meta = JSON.parse(jsonStr)

        if (meta.xml && window.Blockly && workspaceRef.current) {
          const dom = parseBlocklyXml(window.Blockly, meta.xml)
          loadBlocklyXmlIntoWorkspace(window.Blockly, dom, workspaceRef.current)
        }
      } catch (err) {
        console.error('Blockly PNG Import failed:', err)
        alert('Failed to import blocks: ' + err.message)
      }
      if (importFileRef.current) importFileRef.current.value = ''
    }
    reader.readAsArrayBuffer(file)
  }

  // ─── Theme tokens ─────────────────────────────────────────────────────────
  const tok = isDark ? DARK : LIGHT
  const activeCatDef = CATEGORIES.find(c => c.id === activeCat)
  const catColor = activeCatDef?.color || '#888'

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loadStatus === 'error') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tok.bg, minHeight: 400 }}>
        <div style={{ color: 'var(--red)', fontSize: 13, padding: 24, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Blockly failed to load</div>
          <div style={{ color: 'var(--text3)', fontSize: 11 }}>{errMsg}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative' }}>
      <button
        type="button"
        onClick={() => setShowSidebar((v) => !v)}
        title={showSidebar ? 'Hide blocks panel' : 'Show blocks panel'}
        aria-label={showSidebar ? 'Hide blocks panel' : 'Show blocks panel'}
        aria-expanded={showSidebar}
        style={{
          position: 'absolute',
          left: showSidebar ? (showBlocksPanel ? (isMobile ? 330 : 390) : (isMobile ? 110 : 130)) : 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 24,
          height: 48,
          background: tok.sidebar,
          border: `1px solid ${tok.border}`,
          borderLeft: showSidebar ? 'none' : `1px solid ${tok.border}`,
          borderRadius: '0 8px 8px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 100,
          padding: 0,
          transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '4px 0 12px rgba(0,0,0,0.08)',
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: showSidebar ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s',
            color: 'var(--accent)',
          }}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      {/* Hide Blockly's built-in scrollbars, force opaque markers, and hide zoom in/out */}
      <style>{`
        .blocklyScrollbarHorizontal, .blocklyScrollbarVertical { display: none !important; }
        .panel-scroll .injectionDiv,
        .panel-scroll .blocklySvg {
          max-width: 100% !important;
          overflow: hidden !important;
        }
        .panel-scroll .blocklyBlockCanvas {
          overflow: visible !important;
        }
        .blocklyInsertionMarker .blocklyPath {
          fill-opacity: 1 !important;
          stroke-opacity: 1 !important;
        }
        /* Hide Zoom In and Zoom Out on Mobile, keep Reposition */
        ${isMobile ? `
        .blocklyZoom > image:nth-of-type(1), 
        .blocklyZoom > image:nth-of-type(2) { 
          display: none !important; 
        }
        /* Move zoom controls up slightly to clear any mobile UI quirks */
        .blocklyZoom {
          transform: translateY(-20px);
        }
        ` : ''}
      `}</style>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: isMobile ? 6 : 4,
        padding: isMobile ? '8px 12px' : '6px 10px',
        flexShrink: 0, background: tok.toolbar, borderBottom: `1px solid ${tok.border}`,
        height: isMobile ? 48 : 'auto',
        overflow: 'hidden', minWidth: 0,
      }}>


        <button
          type="button"
          style={{
            ...BTN,
            borderColor: showSidebar ? 'var(--accent)' : tok.border,
            color: showSidebar ? 'var(--accent)' : tok.textMuted,
            fontSize: 10,
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          onClick={() => setShowSidebar((v) => !v)}
          title={showSidebar ? 'Hide blocks panel' : 'Show blocks panel'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showSidebar ? 'rotate(180deg)' : 'none' }}>
            <path d="m9 18 6-6-6-6" />
          </svg>
          Blocks
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 2 }}>
          <button
            type="button"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            disabled={!canUndo || loadStatus !== 'ready'}
            onClick={(e) => { e.preventDefault(); performBlocklyUndo() }}
            style={{
              ...BTN,
              padding: '4px 7px',
              fontSize: 11,
              lineHeight: 1,
              color: canUndo ? tok.text : tok.textMuted,
              borderColor: tok.border,
              opacity: canUndo && loadStatus === 'ready' ? 1 : 0.45,
              cursor: canUndo && loadStatus === 'ready' ? 'pointer' : 'not-allowed',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 14 4 9l5-5" />
              <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
            </svg>
          </button>
          <button
            type="button"
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            disabled={!canRedo || loadStatus !== 'ready'}
            onClick={(e) => { e.preventDefault(); performBlocklyRedo() }}
            style={{
              ...BTN,
              padding: '4px 7px',
              fontSize: 11,
              lineHeight: 1,
              color: canRedo ? tok.text : tok.textMuted,
              borderColor: tok.border,
              opacity: canRedo && loadStatus === 'ready' ? 1 : 0.45,
              cursor: canRedo && loadStatus === 'ready' ? 'pointer' : 'not-allowed',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 14l5-5-5-5" />
              <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ════ Sidebar (collapsible) ════ */}
        <div style={{
          width: showSidebar ? (isMobile ? 110 : 130) : 0,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'visible',
          position: 'relative',
          zIndex: 10,
          minWidth: 0,
          boxSizing: 'border-box',
          background: isMobile ? 'var(--bg2)' : tok.sidebar,
          borderRight: showSidebar ? `1px solid ${tok.border}` : 'none',
          opacity: showSidebar ? 1 : 0,
          pointerEvents: showSidebar ? 'auto' : 'none',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
        }}>

          {/* Category column */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '12px 8px',
            flex: 1,
            overflowY: 'auto',
            background: isMobile ? 'var(--bg2)' : tok.sidebar,
            zIndex: 2,
          }}>
            {parentCat && (
              <div style={{ marginBottom: 8 }}>
                <button
                  onClick={() => {
                    setParentCat(null)
                    setShowBlocksPanel(false)
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px',
                    borderRadius: 12, background: 'transparent',
                    color: CATEGORIES.find(c => c.id === parentCat)?.color || tok.text,
                    border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.05em',
                    width: '100%', justifyContent: 'flex-start'
                  }}
                  title="Go back"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                  {CATEGORIES.find(c => c.id === parentCat)?.label}
                </button>
              </div>
            )}
            
            {(parentCat ? SUB_CATEGORIES[parentCat] : CATEGORIES).map(cat => {
              const isParentNode = !parentCat && SUB_CATEGORIES[cat.id]
              const active = activeCat === cat.id && showBlocksPanel
              const pillColor = parentCat ? CATEGORIES.find(c => c.id === parentCat)?.color : cat.color
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    if (isParentNode) {
                      setParentCat(cat.id)
                      setActiveCat(SUB_CATEGORIES[cat.id][0].id)
                      setShowBlocksPanel(true)
                    } else {
                      setActiveCat(cat.id)
                      setShowBlocksPanel(true)
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: isMobile ? 6 : 8,
                    padding: isMobile ? '8px 10px' : '10px 12px',
                    borderRadius: 12,
                    border: `1px solid ${active && !isParentNode ? pillColor : tok.border}`,
                    background: active && !isParentNode ? (isMobile ? 'var(--bg)' : pillColor + '22') : (isMobile ? 'var(--bg3)' : 'transparent'),
                    color: active && !isParentNode ? pillColor : tok.textMuted,
                    cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: isMobile ? 10 : 12,
                    fontWeight: active && !isParentNode ? 700 : 400,
                    transition: 'all .2s', whiteSpace: 'nowrap', overflow: 'hidden',
                  }}
                  title={cat.label}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: pillColor, flexShrink: 0 }} />
                    {cat.label}
                  </div>
                  {isParentNode && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>

          {/* Block list */}
          <div className="panel-scroll" style={{ 
            position: 'absolute',
            left: '100%',
            top: 0,
            bottom: 0,
            width: isMobile ? 220 : 260,
            background: isMobile ? 'var(--bg2)' : tok.sidebar,
            borderRight: `1px solid ${tok.border}`,
            zIndex: 1,
            transform: showBlocksPanel ? 'translateX(0)' : 'translateX(-100%)',
            opacity: showBlocksPanel ? 1 : 0,
            pointerEvents: showBlocksPanel ? 'auto' : 'none',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            overflowY: 'auto', overflowX: 'hidden', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0,
            boxShadow: showBlocksPanel ? '4px 0 15px rgba(0,0,0,0.1)' : 'none',
          }}>

            {/* Standard categories */}
            {activeCat !== 'variables' && activeCat !== 'list' && (CATEGORY_BLOCKS[activeCat] || []).map(item => {
              return (
                <div
                  key={item.type}
                  onClick={() => { addBlock(item.type); setShowBlocksPanel(false); }}
                  title={`Add "${item.label}" block`}
                  style={{ cursor: 'pointer', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}
                >
                  <BlockPreview
                    type={item.type}
                    isDark={isDark}
                    blocklyReady={loadStatus === 'ready'}
                    onDragStart={(info) => { draggingRef.current = info; }}
                    onDragEnd={() => {
                      if (markerManagerRef.current) {
                        markerManagerRef.current.dispose()
                        markerManagerRef.current = null
                      }
                      safeDisposePreviewBlock()
                      draggingRef.current = null
                      setShowBlocksPanel(false)
                    }}
                  />
                </div>
              )
            })}

            {/* Variables category */}
            {activeCat === 'variables' && (
              <>
                {/* New variable buttons — styled like ElectroBlocks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                  {[
                    { type: 'Number', label: 'Create Number Variable' },
                    { type: 'String', label: 'Create Text Variable' },
                    { type: 'Boolean', label: 'Create Boolean Variable' },
                  ].map(btn => (
                    <div
                      key={btn.type}
                      onClick={() => { handleNewVariable(btn.type); setShowBlocksPanel(false); }}
                      style={{ cursor: 'pointer' }}
                      title={btn.label}
                    >
                      <div style={{
                        background: isDark ? '#2a2a2a' : '#f5f5f5',
                        color: isDark ? '#ddd' : '#333',
                        fontSize: 12, fontWeight: 600,
                        padding: '8px 14px', borderRadius: 6,
                        textAlign: 'center', userSelect: 'none',
                        border: `1.5px solid ${isDark ? '#555' : '#ccc'}`,
                        transition: 'all .15s',
                      }}>
                        {btn.label}
                      </div>
                    </div>
                  ))}
                </div>

                {variables.filter(v => v.type === 'Number' || v.type === 'String' || v.type === 'Boolean').length === 0 && (
                  <div style={{ fontSize: 11, color: tok.textMuted, padding: '8px 4px', textAlign: 'center', lineHeight: 1.6 }}>
                    No variables yet.<br />Create one above.
                  </div>
                )}

                {variables.filter(v => v.type === 'Number' || v.type === 'String' || v.type === 'Boolean').map(v => {
                  const t = v.type;
                  const getType = `variables_get_${t.toLowerCase()}`;
                  const setType = `variables_set_${t.toLowerCase()}`;
                  return (
                  <div key={v.getId()} style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12, borderBottom: `1px solid ${isDark ? '#333' : '#eee'}` }}>
                    <div style={{ fontSize: 11, color: tok.textMuted, fontWeight: 600 }}>{v.name} ({t})</div>
                    {/* Variable reporter (get) */}
                    <div onClick={() => { addVariableBlock(getType, v); setShowBlocksPanel(false); }} style={{ cursor: 'pointer', width: '100%', maxWidth: '100%', minWidth: 0 }} title={`Use "${v.name}"`}>
                      <BlockPreview
                        type={getType} varId={v.getId()} varName={v.name} varType={v.type} isDark={isDark} blocklyReady={loadStatus === 'ready'}
                        onDragStart={(info) => { draggingRef.current = info; }}
                        onDragEnd={() => {
                          if (markerManagerRef.current) {
                            markerManagerRef.current.dispose()
                            markerManagerRef.current = null
                          }
                          safeDisposePreviewBlock()
                          draggingRef.current = null
                          setShowBlocksPanel(false)
                        }}
                      />
                    </div>
                    {/* set */}
                    <div onClick={() => addVariableBlock(setType, v)} style={{ cursor: 'pointer', width: '100%', maxWidth: '100%', minWidth: 0 }} title={`set ${v.name}`}>
                      <BlockPreview
                        type={setType} varId={v.getId()} varName={v.name} varType={v.type} isDark={isDark} blocklyReady={loadStatus === 'ready'}
                        onDragStart={(info) => { draggingRef.current = info; }}
                        onDragEnd={() => {
                          if (markerManagerRef.current) {
                            markerManagerRef.current.dispose()
                            markerManagerRef.current = null
                          }
                          safeDisposePreviewBlock()
                          draggingRef.current = null
                          setShowBlocksPanel(false)
                        }}
                      />
                    </div>
                    {/* change */}
                    {(!t || t === 'Number') && (
                    <div onClick={() => { addVariableBlock('math_change', v); setShowBlocksPanel(false); }} style={{ cursor: 'pointer', width: '100%', maxWidth: '100%', minWidth: 0 }} title={`change ${v.name}`}>
                      <BlockPreview
                        type="math_change" varId={v.getId()} varName={v.name} varType={v.type} isDark={isDark} blocklyReady={loadStatus === 'ready'}
                        onDragStart={(info) => { draggingRef.current = info; }}
                        onDragEnd={() => {
                          if (markerManagerRef.current) {
                            markerManagerRef.current.dispose()
                            markerManagerRef.current = null
                          }
                          safeDisposePreviewBlock()
                          draggingRef.current = null
                          setShowBlocksPanel(false)
                        }}
                      />
                    </div>
                    )}
                  </div>
                )})}
              </>
            )}

            {/* List category */}
            {activeCat === 'list' && (
              <>
                {/* New list buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                  {[
                    { type: 'List Number', label: 'Create a list of number' },
                    { type: 'List String', label: 'Create a list of string' },
                    { type: 'List Boolean', label: 'Create a list of boolean' },
                    { type: 'List Colour', label: 'Create a list of colors' },
                  ].map(btn => (
                    <div
                      key={btn.type}
                      onClick={() => { handleNewVariable(btn.type); setShowBlocksPanel(false); }}
                      style={{ cursor: 'pointer' }}
                      title={btn.label}
                    >
                      <div style={{
                        background: isDark ? '#2a2a2a' : '#f5f5f5',
                        color: isDark ? '#ddd' : '#333',
                        fontSize: 12, fontWeight: 600,
                        padding: '8px 14px', borderRadius: 6,
                        textAlign: 'center', userSelect: 'none',
                        border: `1.5px solid ${isDark ? '#555' : '#ccc'}`,
                        transition: 'all .15s',
                      }}>
                        {btn.label}
                      </div>
                    </div>
                  ))}
                </div>

                {variables.filter(v => v.type.startsWith('List ')).length === 0 && (
                  <div style={{ fontSize: 11, color: tok.textMuted, padding: '8px 4px', textAlign: 'center', lineHeight: 1.6 }}>
                    No lists yet.<br />Create one above.
                  </div>
                )}

                {variables.filter(v => v.type.startsWith('List ')).map(v => {
                  const t = v.type.split(' ')[1].toLowerCase();
                  const t2 = t === 'string' ? 'text' : t === 'colour' ? 'color' : t;
                  const getType = `list_get_${t2}`;
                  const setType = `list_store_${t2}`;
                  return (
                  <div key={v.getId()} style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12, borderBottom: `1px solid ${isDark ? '#333' : '#eee'}` }}>
                    <div style={{ fontSize: 11, color: tok.textMuted, fontWeight: 600 }}>{v.name} ({v.type})</div>
                    
                    {/* Store block */}
                    <div onClick={() => { addVariableBlock(setType, v); setShowBlocksPanel(false); }} style={{ cursor: 'pointer', width: '100%', maxWidth: '100%', minWidth: 0 }} title={`Store in "${v.name}"`}>
                      <BlockPreview
                        type={setType} varId={v.getId()} varName={v.name} varType={v.type} isDark={isDark} blocklyReady={loadStatus === 'ready'}
                        onDragStart={(info) => { draggingRef.current = info; }}
                        onDragEnd={() => {
                          if (markerManagerRef.current) {
                            markerManagerRef.current.dispose()
                            markerManagerRef.current = null
                          }
                          safeDisposePreviewBlock()
                          draggingRef.current = null
                          setShowBlocksPanel(false)
                        }}
                      />
                    </div>

                    {/* Get block */}
                    <div onClick={() => { addVariableBlock(getType, v); setShowBlocksPanel(false); }} style={{ cursor: 'pointer', width: '100%', maxWidth: '100%', minWidth: 0 }} title={`Get from "${v.name}"`}>
                      <BlockPreview
                        type={getType} varId={v.getId()} varName={v.name} varType={v.type} isDark={isDark} blocklyReady={loadStatus === 'ready'}
                        onDragStart={(info) => { draggingRef.current = info; }}
                        onDragEnd={() => {
                          if (markerManagerRef.current) {
                            markerManagerRef.current.dispose()
                            markerManagerRef.current = null
                          }
                          safeDisposePreviewBlock()
                          draggingRef.current = null
                          setShowBlocksPanel(false)
                        }}
                      />
                    </div>
                  </div>
                  )
                })}
              </>
            )}
          </div>
        </div>

        {/* ════ Blockly workspace ════ */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 400 }}>
          <div
            ref={wsContainerRef}
            style={{
              flex: showCode ? '0 0 45%' : '1 1 100%',
              position: 'relative',
              overflow: 'hidden',
              transition: 'flex .2s',
              background: tok.bg // Reserve color to match final look
            }}
            onDragOver={handleWsDragOver}
            onDrop={handleWsDrop}
          />

          {/* Code preview pane */}
          {showCode && (
            <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${tok.border}`, background: tok.bg, overflow: 'hidden' }}>
              <div style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: tok.textMuted, textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: `1px solid ${tok.border}`, flexShrink: 0 }}>
                Generated Arduino C++
              </div>
              <pre
                className="language-cpp"
                style={{ margin: 0, padding: 12, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, lineHeight: 1.7, color: tok.text, overflowY: 'auto', overflowX: 'auto', flex: 1, whiteSpace: 'pre', background: 'transparent' }}
                dangerouslySetInnerHTML={{
                  __html: generatedCode
                    ? Prism.highlight(generatedCode, Prism.languages.cpp, 'cpp')
                    : '<span style="opacity: 0.5">// Add blocks to the canvas...</span>'
                }}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ─── Shared styles ─────────────────────────────────────────────────────────────
const BTN = {
  background: 'transparent', border: '1px solid', borderRadius: 6,
  padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
  transition: 'all .15s', whiteSpace: 'nowrap',
}

// ─── Theme token sets ─────────────────────────────────────────────────────────
const DARK = {
  bg: '#0a0e1a', sidebar: '#0d1525', toolbar: '#0d1525',
  border: '#1e2d47', text: '#e8edf5', textMuted: '#4d6380',
}
const LIGHT = {
  bg: '#f8fafc', sidebar: '#f1f5f9', toolbar: '#f1f5f9',
  border: '#cbd5e1', text: '#0f172a', textMuted: '#64748b',
}
