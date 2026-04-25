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
  { id: 'input', label: 'Input', color: '#9b59b6' },
  { id: 'variables', label: 'Variables', color: '#e84393' },
]

// ─── Block shape kinds ────────────────────────────────────────────────────────
// hat = event (no prev connection), value = reporter (output), statement = default
const HAT_TYPES = new Set([
  'on_start', 'forever',
  'on_button_pressed', 'on_shake', 'on_pin_pressed',
  'on_pin_changed', 'on_radio_number', 'on_radio_string', 'on_radio_key_value',
])
const VALUE_TYPES = new Set([
  'math_arithmetic_openhw', 'math_compare', 'pick_random', 'map_value',
  'math_abs_of', 'math_round_openhw', 'math_round', 'math_constrain_block', 'state_dropdown',
  'read_digital_pin', 'read_analog_pin', 'acceleration', 'rotation',
  'light_level', 'temperature', 'compass_heading', 'analog_pitch_vol_read',
  'button_pressed_bool', 'digital_pin_is', 'gesture_is',
  'logic_operation', 'logic_negate', 'logic_boolean', 'math_number',
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
    ['P0', '0'], ['P1', '1'], ['P2', '2'], ['P3', '3'], ['P4', '4'], ['P5', '5'],
    ['P6', '6'], ['P7', '7'], ['P8', '8'], ['P9', '9'], ['P10', '10'],
    ['P11', '11'], ['P12', '12'], ['P13', '13'],
    ['A0', 'A0'], ['A1', 'A1'], ['A2', 'A2'], ['A3', 'A3'], ['A4', 'A4'], ['A5', 'A5'],
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
  ],
  control: [
    { type: 'on_start', label: 'on start' },
    { type: 'forever', label: 'forever' },
    { type: 'wait_secs', label: 'wait' },
    { type: 'repeat_times', label: 'repeat times' },
    { type: 'repeat_while', label: 'repeat while' },
    { type: 'if_then', label: 'if then' },
    { type: 'if_then_else', label: 'if then else' },
  ],
  output: [
    { type: 'clear_screen', label: 'clear screen' },
    { type: 'plot_x_y', label: 'plot x y' },
    { type: 'plot_x_y_brightness', label: 'plot x y brightness' },
    { type: 'unplot_x_y', label: 'unplot x y' },
    { type: 'show_icon', label: 'show icon' },
    { type: 'show_leds', label: 'show LEDs' },
    { type: 'show_number', label: 'show number' },
    { type: 'show_string', label: 'show string' },
    { type: 'plot_bar_graph', label: 'plot bar graph' },
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
}

// ─── Custom block JSON definitions ───────────────────────────────────────────
const BLOCK_DEFS = [
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
    previousStatement: null, nextStatement: null, colour: 33,
    tooltip: 'Repeat N times.'
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
]

// ─── Arduino C++ code generator ───────────────────────────────────────────────
function buildGenerator(B) {
  const gen = new B.Generator('Arduino')
  gen.ORDER_ATOMIC = 0; gen.ORDER_ADDITION = 11; gen.ORDER_RELATIONAL = 9
  gen.ORDER_EQUALITY = 8; gen.ORDER_LOGICAL_NOT = 6
  gen.ORDER_LOGICAL_AND = 5; gen.ORDER_LOGICAL_OR = 4; gen.ORDER_NONE = 99

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

  // Control
  gen.forBlock['on_start'] = b => sc(b, 'DO')
  gen.forBlock['forever'] = b => sc(b, 'DO')
  gen.forBlock['repeat_times'] = b => `for (int i=0; i<${vc(b, 'TIMES', gen.ORDER_ATOMIC)}; i++) {\n${sc(b, 'DO')}}\n`
  gen.forBlock['repeat_while'] = b => `while (${vc(b, 'COND', gen.ORDER_NONE)}) {\n${sc(b, 'DO')}}\n`
  gen.forBlock['if_then'] = b => `if (${vc(b, 'COND', gen.ORDER_NONE)}) {\n${sc(b, 'DO')}}\n`
  gen.forBlock['if_then_else'] = b => `if (${vc(b, 'COND', gen.ORDER_NONE)}) {\n${sc(b, 'DO')}} else {\n${sc(b, 'ELSE')}}\n`

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
    return `myServo_${pin}.write(${vc(b, 'DEG', gen.ORDER_ATOMIC)});\n`
  }
  gen.forBlock['write_servo_pulse'] = b => {
    const pin = b.getFieldValue('PIN')
    gen.usedPins.set(pin, 'OUTPUT')
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

  // Variable blocks
  gen.forBlock['variables_get'] = b => [gen.nameDB_.getName(b.getFieldValue('VAR'), B.Names.NameType.VARIABLE), gen.ORDER_ATOMIC]
  gen.forBlock['variables_set'] = b => { const n = gen.nameDB_.getName(b.getFieldValue('VAR'), B.Names.NameType.VARIABLE); return `${n} = ${vc(b, 'VALUE', gen.ORDER_ATOMIC)};\n` }
  gen.forBlock['math_change'] = b => { const n = gen.nameDB_.getName(b.getFieldValue('VAR'), B.Names.NameType.VARIABLE); return `${n} += ${vc(b, 'DELTA', gen.ORDER_ADDITION)};\n` }

  return gen
}

// ─── Sketch assembler ─────────────────────────────────────────────────────────
function generateSketch(gen, ws) {
  const vars = ws.getAllVariables()
  const varDecl = vars.length ? vars.map(v => `int ${v.name} = 0;`).join('\n') + '\n\n' : ''
  let setupCode = ''
  gen.usedPins.forEach((mode, pin) => {
    setupCode += `  pinMode(${pin}, ${mode});\n`
  })

  let setup = '', loop_ = ''; const extras = []
  ws.getTopBlocks(true).forEach(b => {
    try {
      const code = gen.blockToCode(b)
      if (!code) return
      if (b.type === 'on_start') {
        // Find the insert point in setup code if we want to merge, but here setup is just the body
        setup += code
      }
      else if (b.type === 'forever') loop_ += code
      else extras.push(code)
    } catch (_) { }
  })
  
  const setupFunc = `void setup() {\n${setupCode}${setup}}\n\n`
  if (!loop_) loop_ = 'void loop() {\n  // loop\n}\n\n'
  return `// Generated by OpenHW Studio Block Editor\n\n${varDecl}${extras.join('\n')}${extras.length ? '\n' : ''}${setupFunc}${loop_}`
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

// ─── Live Blockly previews in category panel ─────────────────────────────────
const BlockPreview = React.memo(function BlockPreview({ type, onDragStart, varId, isDark, blocklyReady }) {
  const hostRef = useRef(null)
  const wsRef = useRef(null)
  const [renderError, setRenderError] = useState(false)
  const [renderReady, setRenderReady] = useState(false)
  const [previewHeight, setPreviewHeight] = useState(30)

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
      const block = previewWs.newBlock(type)
      if (varId && block.getField('VAR')) block.getField('VAR').setValue(varId)
      block.initSvg()
      block.render()

      const measured = typeof block.getHeightWidth === 'function' ? block.getHeightWidth() : null
      const blockW = Math.max(24, Math.ceil(measured?.width || 120))
      const blockH = Math.max(20, Math.ceil(measured?.height || 28))
      const padX = 8
      const padY = 5

      // Keep block centered, but let preview width follow the sidebar width.
      const totalW = Math.max(84, host.clientWidth || (blockW + padX * 2))
      const totalH = Math.max(30, blockH + padY * 2)
      if (!disposed) setPreviewHeight(totalH)

      const canvas = previewWs.getCanvas()
      const pos = typeof block.getRelativeToSurfaceXY === 'function'
        ? block.getRelativeToSurfaceXY()
        : { x: 0, y: 0 }
      if (canvas) {
        const tx = Math.round((totalW - blockW) / 2 - pos.x)
        const ty = Math.round((totalH - blockH) / 2 - pos.y)
        canvas.setAttribute('transform', `translate(${tx}, ${ty})`)
      }

      const injectionDiv = host.querySelector('.injectionDiv')
      if (injectionDiv) {
        injectionDiv.style.position = 'static'
        injectionDiv.style.width = `${totalW}px`
        injectionDiv.style.height = `${totalH}px`
        injectionDiv.style.pointerEvents = 'none'
      }

      const svg = host.querySelector('svg.blocklySvg')
      if (svg) {
        svg.setAttribute('width', String(totalW))
        svg.setAttribute('height', String(totalH))
        svg.style.width = `${totalW}px`
        svg.style.height = `${totalH}px`
        svg.style.display = 'block'
        svg.style.overflow = 'visible'
        svg.style.pointerEvents = 'none'
      }

      const mainBg = host.querySelector('.blocklyMainBackground')
      if (mainBg) mainBg.style.display = 'none'

      if (typeof B.svgResize === 'function') B.svgResize(previewWs)
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
      }
      if (host) host.innerHTML = ''
    }
  }, [type, varId, isDark, blocklyReady])

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', type)
    if (varId) e.dataTransfer.setData('application/x-varId', varId)
    e.dataTransfer.effectAllowed = 'copy'
    onDragStart && onDragStart(type)
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      style={{ cursor: 'grab', userSelect: 'none', lineHeight: 0, padding: '4px 0', display: 'flex', justifyContent: 'center' }}
    >
      <div style={{ position: 'relative', width: '100%', minWidth: 72, minHeight: previewHeight }}>
        <div
          ref={hostRef}
          style={{
            width: '100%',
            minWidth: 72,
            height: previewHeight,
            pointerEvents: 'none',
            opacity: renderReady && !renderError ? 1 : 0,
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

// ─── Main component ────────────────────────────────────────────────────────────
export default function BlocklyEditor({ onExportCode, onChange, xml, onXmlChange, visible, useBlocklyCode, onToggleUseBlocklyCode, boardKind }) {
  const wsContainerRef = useRef(null)
  const workspaceRef = useRef(null)
  const importFileRef = useRef(null)
  const genRef = useRef(null)
  const blockCountRef = useRef(0)

  const [loadStatus, setLoadStatus] = useState('loading')
  const [errMsg, setErrMsg] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [activeCat, setActiveCat] = useState('basic')
  const [variables, setVariables] = useState([])
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') !== 'light'
  )

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

  // ── Handle visibility changes ──────────────────────────────────────────────
  useEffect(() => {
    if (visible && workspaceRef.current && window.Blockly) {
      window.Blockly.svgResize(workspaceRef.current)
    }
  }, [visible])

  // ── Load Blockly scripts ───────────────────────────────────────────────────
  useEffect(() => {
    const loadScript = src => new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return }
      const s = document.createElement('script')
      s.src = src; s.async = false
      s.onload = res; s.onerror = () => rej(new Error(`Load failed: ${src}`))
      document.head.appendChild(s)
    })
    const boot = () => {
      if (window.Blockly) { init(); return }
      ; (async () => { for (const s of CDN_SCRIPTS) await loadScript(s) })()
        .then(init)
        .catch(e => { setErrMsg(e.message); setLoadStatus('error') })
    }
    boot()
    return () => {
      if (workspaceRef.current) { workspaceRef.current.dispose(); workspaceRef.current = null }
    }
  }, []) // eslint-disable-line

  // ── Initialise workspace ───────────────────────────────────────────────────
  const init = useCallback(() => {
    const B = window.Blockly
    if (!B || !wsContainerRef.current || workspaceRef.current) return
    const defsToRegister = BLOCK_DEFS.filter((def) => !B.Blocks?.[def.type])
    if (defsToRegister.length > 0) {
      B.defineBlocksWithJsonArray(defsToRegister)
    }
    genRef.current = buildGenerator(B)

    const ws = B.inject(wsContainerRef.current, {
      toolbox: null, // custom sidebar handles this
      theme: buildTheme(B, isDark),
      renderer: 'zelos', // Scratch-like UI
      grid: { spacing: 20, length: 3, colour: isDark ? '#1e2d47' : '#e2e8f0', snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 3, minScale: 0.3, pinch: true },
      move: { scrollbars: true, drag: true, wheel: true },
      scrollbars: true,
      trashcan: true,
      sounds: false,
    })
    workspaceRef.current = ws
    setLoadStatus('ready')

    if (xml) {
      try {
        const dom = parseBlocklyXml(B, xml)
        loadBlocklyXmlIntoWorkspace(B, dom, ws)
      } catch (err) {
        console.error('Failed to load initial XML:', err)
      }
    }

    ws.addChangeListener(e => {
      const B2 = window.Blockly
      if (!B2) return
      if ([B2.Events.VAR_CREATE, B2.Events.VAR_DELETE, B2.Events.VAR_RENAME].includes(e.type))
        setVariables([...ws.getAllVariables()])
      if (e.isUiEvent) return
      try {
        const code = generateSketch(genRef.current, ws)
        setGeneratedCode(code)
        if (onChange) onChange(code)
        
        if (onXmlChange) {
          const dom = workspaceToBlocklyDom(B2, ws)
          onXmlChange(serializeBlocklyXml(B2, dom))
        }
      } catch (_) { }
    })
  }, [isDark, boardKind]) // eslint-disable-line

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

  // ── Create block and place it at offset ────────────────────────────────────
  const placeBlock = useCallback((type, wsX, wsY) => {
    const ws = workspaceRef.current
    if (!ws || !window.Blockly) return
    const block = ws.newBlock(type)
    block.initSvg()
    block.render()
    const fallback = (blockCountRef.current++ % 10) * 18
    block.moveTo(new window.Blockly.utils.Coordinate(
      wsX !== undefined ? wsX : 30 + fallback,
      wsY !== undefined ? wsY : 30 + fallback,
    ))
    window.Blockly.svgResize(ws)
  }, [])

  const addBlock = useCallback((type) => placeBlock(type), [placeBlock])

  // ── Variable blocks ────────────────────────────────────────────────────────
  const addVariableBlock = useCallback((type, variable) => {
    const ws = workspaceRef.current
    if (!ws || !window.Blockly) return
    const block = ws.newBlock(type)
    if (block.getField('VAR')) block.getField('VAR').setValue(variable.getId())
    block.initSvg(); block.render()
    const n = (blockCountRef.current++ % 10) * 18
    block.moveTo(new window.Blockly.utils.Coordinate(30 + n, 30 + n))
  }, [])

  const handleNewVariable = useCallback(() => {
    const ws = workspaceRef.current
    if (!ws) return
    const name = window.prompt('Variable name:')
    if (name && name.trim()) ws.createVariable(name.trim())
  }, [])

  // ── Drag-and-drop into workspace ───────────────────────────────────────────
  const handleWsDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleWsDrop = useCallback((e) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('text/plain')
    if (!type || !workspaceRef.current || !window.Blockly) return
    const ws = workspaceRef.current
    const B = window.Blockly
    const varId = e.dataTransfer.getData('application/x-varId')
    // Convert screen coords → workspace coords
    const screenCoord = new B.utils.Coordinate(e.clientX, e.clientY)
    let wsCoord
    try { wsCoord = B.utils.svgMath.screenToWsCoordinates(ws, screenCoord) }
    catch (_) { wsCoord = new B.utils.Coordinate(60, 60) }
    // Create block
    const block = ws.newBlock(type)
    if (varId && block.getField('VAR')) block.getField('VAR').setValue(varId)
    block.initSvg()
    block.render()
    block.moveTo(new B.utils.Coordinate(wsCoord.x, wsCoord.y))
    B.svgResize(ws)
  }, [])

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
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tok.bg }}>
        <div style={{ color: 'var(--red)', fontSize: 13, padding: 24, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Blockly failed to load</div>
          <div style={{ color: 'var(--text3)', fontSize: 11 }}>{errMsg}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Hide Blockly's built-in scrollbars */}
      <style>{`.blocklyScrollbarHorizontal, .blocklyScrollbarVertical { display: none !important; }`}</style>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', flexShrink: 0, background: tok.toolbar, borderBottom: `1px solid ${tok.border}` }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: tok.textMuted }}>Block Editor</span>
        {loadStatus === 'loading' && <span style={{ fontSize: 11, color: tok.textMuted, marginLeft: 8 }}>Loading...</span>}

        <button
          style={{ 
            ...BTN, 
            borderColor: useBlocklyCode ? 'var(--green)' : tok.border, 
            color: useBlocklyCode ? 'var(--green)' : tok.textMuted,
            display: 'flex', alignItems: 'center', gap: 6,
            fontWeight: useBlocklyCode ? 700 : 400,
            marginLeft: 8
          }}
          onClick={onToggleUseBlocklyCode}
          title={useBlocklyCode ? "System is using Blocks for compilation" : "System is using Code Panel for compilation"}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: useBlocklyCode ? 'var(--green)' : 'currentColor', opacity: useBlocklyCode ? 1 : 0.4 }} />
          Use Blocks
        </button>

        <div style={{ flex: 1 }} />

        <button
          style={{ ...BTN, borderColor: tok.border, color: tok.textMuted }}
          onClick={() => importFileRef.current?.click()}
        >Import</button>

        <button
          style={{ ...BTN, borderColor: tok.border, color: tok.textMuted }}
          onClick={handleExportPng}
        >Export</button>

        <div style={{ width: 1, height: 16, background: tok.border, margin: '0 4px' }} />

        <button
          style={{ ...BTN, borderColor: tok.border, color: tok.textMuted, ...(showCode ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}
          onClick={() => setShowCode(v => !v)}
        >Preview</button>

        <button
          style={{ ...BTN, background: 'var(--accent)', borderColor: 'var(--accent)', color: '#000', fontWeight: 700 }}
          onClick={handleExport} disabled={loadStatus !== 'ready'}
        >Use Code</button>

        <input
          ref={importFileRef}
          type="file"
          accept="image/png"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files?.[0]) handleImportPng(e.target.files[0])
          }}
        />
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ════ Sidebar ════ */}
        <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: tok.sidebar }}>

          {/* Category pills grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, padding: '10px 8px', borderBottom: `1px solid ${tok.border}`, flexShrink: 0 }}>
            {CATEGORIES.map(cat => {
              const active = activeCat === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(cat.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 8px', borderRadius: 20,
                    border: `1px solid ${active ? cat.color : tok.border}`,
                    background: active ? cat.color + '22' : 'transparent',
                    color: active ? cat.color : tok.textMuted,
                    cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 11, fontWeight: active ? 700 : 400,
                    transition: 'all .15s', whiteSpace: 'nowrap', overflow: 'hidden',
                  }}
                  title={cat.label}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                  {cat.label}
                </button>
              )
            })}
          </div>

          {/* Block list */}
          <div className="panel-scroll" style={{ flex: 1, overflowY: 'auto', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* Standard categories */}
            {activeCat !== 'variables' && (CATEGORY_BLOCKS[activeCat] || []).map(item => {
              return (
                <div
                  key={item.type}
                  onClick={() => addBlock(item.type)}
                  title={`Add "${item.label}" block`}
                  style={{ cursor: 'pointer' }}
                >
                  <BlockPreview
                    type={item.type}
                    isDark={isDark}
                    blocklyReady={loadStatus === 'ready'}
                  />
                </div>
              )
            })}

            {/* Variables category */}
            {activeCat === 'variables' && (
              <>
                {/* New variable button — styled as a hat-like block */}
                <div
                  onClick={handleNewVariable}
                  style={{ cursor: 'pointer' }}
                  title="Create a new variable"
                >
                  <div style={{
                    background: '#e84393',
                    color: '#fff', fontSize: 11, fontWeight: 700,
                    padding: '7px 12px', borderRadius: 6,
                    textAlign: 'center', userSelect: 'none',
                  }}>
                    + Make a Variable
                  </div>
                </div>

                {variables.length === 0 && (
                  <div style={{ fontSize: 11, color: tok.textMuted, padding: '8px 4px', textAlign: 'center', lineHeight: 1.6 }}>
                    No variables yet.<br />Create one above.
                  </div>
                )}

                {variables.map(v => (
                  <div key={v.getId()} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Variable reporter (get) */}
                    <div onClick={() => addVariableBlock('variables_get', v)} style={{ cursor: 'pointer' }} title={`Use "${v.name}"`}>
                      <BlockPreview type="variables_get" varId={v.getId()} isDark={isDark} blocklyReady={loadStatus === 'ready'} />
                    </div>
                    {/* set */}
                    <div onClick={() => addVariableBlock('variables_set', v)} style={{ cursor: 'pointer' }} title={`set ${v.name}`}>
                      <BlockPreview type="variables_set" varId={v.getId()} isDark={isDark} blocklyReady={loadStatus === 'ready'} />
                    </div>
                    {/* change */}
                    <div onClick={() => addVariableBlock('math_change', v)} style={{ cursor: 'pointer' }} title={`change ${v.name}`}>
                      <BlockPreview type="math_change" varId={v.getId()} isDark={isDark} blocklyReady={loadStatus === 'ready'} />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ════ Blockly workspace ════ */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div
            ref={wsContainerRef}
            style={{ flex: showCode ? '0 0 45%' : '1 1 100%', position: 'relative', overflow: 'hidden', transition: 'flex .2s' }}
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
