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
  'text', 'text_join', 'text_length', 'text_isEmpty',
  'text_changeCase', 'parse_string_block', 'number_to_text',
  'colour_picker', 'colour_random', 'colour_rgb',
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
    ['D11', '11'], ['D12', '12'], ['D13', '13'],
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

  // Variable blocks
  gen.forBlock['variables_get'] = b => [gen.nameDB_.getName(b.getFieldValue('VAR'), B.Names.NameType.VARIABLE), gen.ORDER_ATOMIC]
  gen.forBlock['variables_set'] = b => { const n = gen.nameDB_.getName(b.getFieldValue('VAR'), B.Names.NameType.VARIABLE); return `${n} = ${vc(b, 'VALUE', gen.ORDER_ATOMIC)};\n` }
  gen.forBlock['math_change'] = b => { const n = gen.nameDB_.getName(b.getFieldValue('VAR'), B.Names.NameType.VARIABLE); return `${n} += ${vc(b, 'DELTA', gen.ORDER_ADDITION)};\n` }

  // Typed Variable blocks
  gen.forBlock['variables_get_number'] = b => [gen.nameDB_.getName(b.getFieldValue('VAR'), B.Names.NameType.VARIABLE), gen.ORDER_ATOMIC]
  gen.forBlock['variables_set_number'] = b => { const n = gen.nameDB_.getName(b.getFieldValue('VAR'), B.Names.NameType.VARIABLE); return `${n} = ${vc(b, 'VALUE', gen.ORDER_ATOMIC) || '0'};\n` }
  
  gen.forBlock['variables_get_string'] = b => [gen.nameDB_.getName(b.getFieldValue('VAR'), B.Names.NameType.VARIABLE), gen.ORDER_ATOMIC]
  gen.forBlock['variables_set_string'] = b => { const n = gen.nameDB_.getName(b.getFieldValue('VAR'), B.Names.NameType.VARIABLE); return `${n} = ${vc(b, 'VALUE', gen.ORDER_ATOMIC) || '""'};\n` }
  
  gen.forBlock['variables_get_boolean'] = b => [gen.nameDB_.getName(b.getFieldValue('VAR'), B.Names.NameType.VARIABLE), gen.ORDER_ATOMIC]
  gen.forBlock['variables_set_boolean'] = b => { const n = gen.nameDB_.getName(b.getFieldValue('VAR'), B.Names.NameType.VARIABLE); return `${n} = ${vc(b, 'VALUE', gen.ORDER_ATOMIC) || 'false'};\n` }

  // List blocks
  const genListGet = (b) => {
    const listName = gen.nameDB_.getName(b.getFieldValue('VAR'), B.Names.NameType.VARIABLE);
    const pos = vc(b, 'POS', gen.ORDER_ATOMIC) || '1';
    return [`${listName}[(${pos}) - 1]`, gen.ORDER_ATOMIC];
  };
  const genListSet = (b) => {
    const listName = gen.nameDB_.getName(b.getFieldValue('VAR'), B.Names.NameType.VARIABLE);
    const val = vc(b, 'VALUE', gen.ORDER_ATOMIC) || '0';
    const pos = vc(b, 'POS', gen.ORDER_ATOMIC) || '1';
    return `${listName}[(${pos}) - 1] = ${val};\n`;
  };
  gen.forBlock['list_get_number'] = genListGet;
  gen.forBlock['list_store_number'] = genListSet;
  gen.forBlock['list_get_text'] = genListGet;
  gen.forBlock['list_store_text'] = b => {
    const listName = gen.nameDB_.getName(b.getFieldValue('VAR'), B.Names.NameType.VARIABLE);
    const val = vc(b, 'VALUE', gen.ORDER_ATOMIC) || '""';
    const pos = vc(b, 'POS', gen.ORDER_ATOMIC) || '1';
    return `${listName}[(${pos}) - 1] = ${val};\n`;
  };
  gen.forBlock['list_get_boolean'] = genListGet;
  gen.forBlock['list_store_boolean'] = b => {
    const listName = gen.nameDB_.getName(b.getFieldValue('VAR'), B.Names.NameType.VARIABLE);
    const val = vc(b, 'VALUE', gen.ORDER_ATOMIC) || 'false';
    const pos = vc(b, 'POS', gen.ORDER_ATOMIC) || '1';
    return `${listName}[(${pos}) - 1] = ${val};\n`;
  };
  gen.forBlock['list_get_color'] = genListGet;
  gen.forBlock['list_store_color'] = genListSet;

  return gen
}

// ─── Sketch assembler ─────────────────────────────────────────────────────────
function generateSketch(gen, ws) {
  if (typeof gen.init === 'function') {
    gen.init(ws)
  }
  gen.usedPins = new Map()

  const vars = (ws.getAllVariables() || []).filter(v => v.type === 'Number' || v.type === 'String' || v.type === 'Boolean');
  const varDecl = vars.length ? vars.map(v => {
    let type = 'int';
    let def = '0';
    if (v.type === 'String') { type = 'String'; def = '""'; }
    else if (v.type === 'Boolean') { type = 'bool'; def = 'false'; }
    return `${type} ${v.name} = ${def};`;
  }).join('\n') + '\n\n' : ''
  
  const listVars = (ws.getAllVariables() || []).filter(v => v.type.startsWith('List '));
  const listVarDecl = listVars.length ? listVars.map(v => {
    let type = 'int';
    if (v.type === 'List String') type = 'String';
    else if (v.type === 'List Boolean') type = 'bool';
    else if (v.type === 'List Colour') type = 'long';
    return `${type} ${v.name}[10];`; // Default to size 10
  }).join('\n') + '\n\n' : ''
  
  gen.usedPins = new Map() // Reset/initialize used pins Map for the current generation run

  // Generate code for top-level blocks first so generators can record usedPins, helpers, etc.
  let setup = '', loop_ = ''
  const extras = []
  gen.usedPins = new Map()
  ws.getTopBlocks(true).forEach(b => {
    try {
      const code = gen.blockToCode(b)
      if (!code) return
      if (b.type === 'on_start') {
        setup += code
      } else if (b.type === 'forever') {
        loop_ += code
      } else {
        extras.push(code)
      }
    } catch (err) {
      // Don't let one block break generation for others
      console.warn('Block code gen error:', err)
    }
  })

  // After generating blocks, compute platform setup code (e.g., pinMode) from recorded usage
  let setupCode = ''
  gen.usedPins.forEach((mode, pin) => {
    setupCode += `  pinMode(${pin}, ${mode});\n`
  })

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

  const code = `// Generated by OpenHW Studio Block Editor\n\n${varDecl}${listVarDecl}${helpers}${extras.join('\n')}${extras.length ? '\n' : ''}${setupFunc}${loopFunc}`
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

  const [loadStatus, setLoadStatus] = useState('loading')
  const [errMsg, setErrMsg] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [activeCat, setActiveCat] = useState('basic')
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
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
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

    if (xml) {
      try {
        const dom = parseBlocklyXml(B, xml)
        loadBlocklyXmlIntoWorkspace(B, dom, ws)
      } catch (err) {
        console.error('Failed to load initial XML:', err)
      }
    }
    resetBlocklyHistory(captureWorkspaceXml())
    syncGeneratedCode({ notifyParent: false })

    // Generate initial code so the preview pane shows correct code on load
    try {
      const initialCode = generateSketch(genRef.current, ws)
      setGeneratedCode(initialCode)
      if (onChange) {
        setTimeout(() => {
          onChange(initialCode)
        }, 0)
      }
    } catch (err) {
      console.warn('Failed to generate initial sketch:', err)
    }

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
      if ([B2.Events.VAR_CREATE, B2.Events.VAR_DELETE, B2.Events.VAR_RENAME].includes(e.type))
        setVariables([...ws.getAllVariables()])
      if (!skipHistoryTypes.has(e.type)) scheduleHistoryPush()
      if (e.isUiEvent) return
      syncGeneratedCode({ notifyParent: true, emitXml: true })
    })
  }, [isDark, boardKind, xml, resetBlocklyHistory, captureWorkspaceXml, scheduleHistoryPush, syncGeneratedCode])

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
          left: showSidebar ? sidebarWidth - 14 : 0,
          top: '42%',
          width: 28,
          height: 72,
          background: tok.sidebar,
          border: `1px solid ${tok.border}`,
          borderLeft: showSidebar ? 'none' : `1px solid ${tok.border}`,
          borderRadius: '0 14px 14px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 100,
          padding: 0,
          transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '4px 0 14px rgba(0,0,0,0.12)',
        }}
      >
        <svg
          width="18"
          height="18"
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

        <button
          style={{
            ...BTN,
            borderColor: useBlocklyCode ? 'var(--green)' : tok.border,
            color: useBlocklyCode ? 'var(--green)' : tok.textMuted,
            display: 'flex', alignItems: 'center', gap: 6,
            fontWeight: isMobile ? 800 : 700,
            marginLeft: isMobile ? 4 : 8,
            padding: isMobile ? '4px 8px' : '3px 10px',
            fontSize: isMobile ? 10 : 11
          }}
          onClick={onToggleUseBlocklyCode}
          title={useBlocklyCode ? "System is using Blocks" : "System is using Code"}
        >
          <div style={{ width: isMobile ? 6 : 8, height: isMobile ? 6 : 8, borderRadius: '50%', background: useBlocklyCode ? 'var(--green)' : 'currentColor' }} />
          Use Blocks
        </button>

        <button
          style={{ ...BTN, borderColor: tok.border, color: tok.textMuted, fontSize: 10, padding: '4px 8px', marginLeft: 'auto', flexShrink: 0 }}
          onClick={() => importFileRef.current?.click()}
        >Import</button>

        <button
          style={{ ...BTN, borderColor: tok.border, color: tok.textMuted, fontSize: 10, padding: '4px 8px', flexShrink: 0 }}
          onClick={handleExportPng}
        >Export</button>

        <div style={{ width: 1, height: 16, background: tok.border, margin: '0 2px' }} />

        <button
          style={{
            ...BTN,
            borderColor: showCode ? 'var(--accent)' : tok.border,
            color: showCode ? 'var(--accent)' : tok.textMuted,
            background: showCode ? 'rgba(0,255,255,0.05)' : 'transparent',
            fontSize: isMobile ? 10 : 11,
            padding: isMobile ? '4px 8px' : '3px 10px',
            marginRight: isMobile ? 2 : 0,
            flexShrink: 0,
          }}
          onClick={() => setShowCode(v => !v)}
        >Preview</button>

        <button
          style={{
            ...BTN,
            background: 'var(--accent)',
            borderColor: 'var(--accent)',
            color: '#000',
            fontWeight: 800,
            fontSize: isMobile ? 11 : 11,
            padding: isMobile ? '5px 12px' : '3px 10px',
            boxShadow: isMobile ? '0 2px 8px rgba(0,255,255,0.2)' : 'none',
            flexShrink: 0,
          }}
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

        {/* ════ Sidebar (collapsible) ════ */}
        <div style={{
          width: showSidebar ? sidebarWidth : 0,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
          boxSizing: 'border-box',
          background: isMobile ? 'var(--bg2)' : tok.sidebar,
          borderRight: showSidebar ? `1px solid ${tok.border}` : 'none',
          opacity: showSidebar ? 1 : 0,
          pointerEvents: showSidebar ? 'auto' : 'none',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
        }}>

          {/* Category pills grid - fixed height to prevent CLS */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 6,
            padding: '12px 10px',
            borderBottom: `1px solid ${tok.border}`,
            flexShrink: 0,
            minHeight: 124,
          }}>
            {CATEGORIES.map(cat => {
              const active = activeCat === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(cat.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 5,
                    padding: isMobile ? '7px 10px' : '6px 10px',
                    borderRadius: isMobile ? 12 : 20,
                    border: `1px solid ${active ? cat.color : tok.border}`,
                    background: active ? (isMobile ? 'var(--bg)' : cat.color + '22') : (isMobile ? 'var(--bg3)' : 'transparent'),
                    color: active ? cat.color : tok.textMuted,
                    cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: isMobile ? 10 : 12,
                    fontWeight: active ? 700 : 400,
                    textTransform: isMobile ? 'uppercase' : 'none',
                    letterSpacing: isMobile ? '.05em' : 'normal',
                    transition: 'all .2s', whiteSpace: 'nowrap', overflow: 'hidden',
                    boxShadow: (isMobile && active) ? `0 4px 12px ${cat.color}22` : 'none',
                  }}
                  title={cat.label}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                  {cat.label}
                </button>
              )
            })}
          </div>

          {/* Block list */}
          <div className="panel-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>

            {/* Standard categories */}
            {activeCat !== 'variables' && activeCat !== 'list' && (CATEGORY_BLOCKS[activeCat] || []).map(item => {
              return (
                <div
                  key={item.type}
                  onClick={() => addBlock(item.type)}
                  title={`Add "${item.label}" block`}
                  style={{ cursor: 'pointer', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}
                >
                  <BlockPreview
                    type={item.type}
                    isDark={isDark}
                    blocklyReady={loadStatus === 'ready'}
                    onDragStart={(info) => { draggingRef.current = info }}
                    onDragEnd={() => {
                      if (markerManagerRef.current) {
                        markerManagerRef.current.dispose()
                        markerManagerRef.current = null
                      }
                      safeDisposePreviewBlock()
                      draggingRef.current = null
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
                      onClick={() => handleNewVariable(btn.type)}
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
                    <div onClick={() => addVariableBlock(getType, v)} style={{ cursor: 'pointer', width: '100%', maxWidth: '100%', minWidth: 0 }} title={`Use "${v.name}"`}>
                      <BlockPreview
                        type={getType} varId={v.getId()} varName={v.name} varType={v.type} isDark={isDark} blocklyReady={loadStatus === 'ready'}
                        onDragStart={(info) => { draggingRef.current = info }}
                        onDragEnd={() => {
                          if (markerManagerRef.current) {
                            markerManagerRef.current.dispose()
                            markerManagerRef.current = null
                          }
                          safeDisposePreviewBlock()
                          draggingRef.current = null
                        }}
                      />
                    </div>
                    {/* set */}
                    <div onClick={() => addVariableBlock(setType, v)} style={{ cursor: 'pointer', width: '100%', maxWidth: '100%', minWidth: 0 }} title={`set ${v.name}`}>
                      <BlockPreview
                        type={setType} varId={v.getId()} varName={v.name} varType={v.type} isDark={isDark} blocklyReady={loadStatus === 'ready'}
                        onDragStart={(info) => { draggingRef.current = info }}
                        onDragEnd={() => {
                          if (markerManagerRef.current) {
                            markerManagerRef.current.dispose()
                            markerManagerRef.current = null
                          }
                          safeDisposePreviewBlock()
                          draggingRef.current = null
                        }}
                      />
                    </div>
                    {/* change */}
                    {(!t || t === 'Number') && (
                    <div onClick={() => addVariableBlock('math_change', v)} style={{ cursor: 'pointer', width: '100%', maxWidth: '100%', minWidth: 0 }} title={`change ${v.name}`}>
                      <BlockPreview
                        type="math_change" varId={v.getId()} varName={v.name} varType={v.type} isDark={isDark} blocklyReady={loadStatus === 'ready'}
                        onDragStart={(info) => { draggingRef.current = info }}
                        onDragEnd={() => {
                          if (markerManagerRef.current) {
                            markerManagerRef.current.dispose()
                            markerManagerRef.current = null
                          }
                          safeDisposePreviewBlock()
                          draggingRef.current = null
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
                      onClick={() => handleNewVariable(btn.type)}
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
                    <div onClick={() => addVariableBlock(setType, v)} style={{ cursor: 'pointer', width: '100%', maxWidth: '100%', minWidth: 0 }} title={`Store in "${v.name}"`}>
                      <BlockPreview
                        type={setType} varId={v.getId()} varName={v.name} varType={v.type} isDark={isDark} blocklyReady={loadStatus === 'ready'}
                        onDragStart={(info) => { draggingRef.current = info }}
                        onDragEnd={() => {
                          if (markerManagerRef.current) {
                            markerManagerRef.current.dispose()
                            markerManagerRef.current = null
                          }
                          safeDisposePreviewBlock()
                          draggingRef.current = null
                        }}
                      />
                    </div>

                    {/* Get block */}
                    <div onClick={() => addVariableBlock(getType, v)} style={{ cursor: 'pointer', width: '100%', maxWidth: '100%', minWidth: 0 }} title={`Get from "${v.name}"`}>
                      <BlockPreview
                        type={getType} varId={v.getId()} varName={v.name} varType={v.type} isDark={isDark} blocklyReady={loadStatus === 'ready'}
                        onDragStart={(info) => { draggingRef.current = info }}
                        onDragEnd={() => {
                          if (markerManagerRef.current) {
                            markerManagerRef.current.dispose()
                            markerManagerRef.current = null
                          }
                          safeDisposePreviewBlock()
                          draggingRef.current = null
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
