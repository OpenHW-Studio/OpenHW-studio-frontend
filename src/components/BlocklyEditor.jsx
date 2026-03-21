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

// ─── CDN ─────────────────────────────────────────────────────────────────────
const BLOCKLY_VER = '10.4.3'
const CDN_SCRIPTS = [
  `https://unpkg.com/blockly@${BLOCKLY_VER}/blockly_compressed.js`,
  `https://unpkg.com/blockly@${BLOCKLY_VER}/blocks_compressed.js`,
  `https://unpkg.com/blockly@${BLOCKLY_VER}/msg/en.js`,
]

// ─── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'basic',     label: 'Basic',     color: '#d95f5f' },
  { id: 'control',   label: 'Control',   color: '#e8861e' },
  { id: 'output',    label: 'Output',    color: '#3a7de0' },
  { id: 'math',      label: 'Math',      color: '#28b463' },
  { id: 'input',     label: 'Input',     color: '#9b59b6' },
  { id: 'variables', label: 'Variables', color: '#e84393' },
]

// ─── Block shape kinds ────────────────────────────────────────────────────────
// hat = event (no prev connection), value = reporter (output), statement = default
const HAT_TYPES = new Set([
  'on_start','forever',
  'on_button_pressed','on_shake','on_pin_pressed',
  'on_pin_changed','on_radio_number','on_radio_string','on_radio_key_value',
])
const VALUE_TYPES = new Set([
  'math_arithmetic_openhw','math_compare','pick_random','map_value',
  'math_abs_of','math_round','math_constrain_block','state_dropdown',
  'read_digital_pin','read_analog_pin','acceleration','rotation',
  'light_level','temperature','compass_heading','analog_pitch_vol_read',
  'button_pressed_bool','digital_pin_is','gesture_is',
  'logic_operation','logic_negate','logic_boolean','math_number',
])
const getShapeKind = (type) =>
  HAT_TYPES.has(type) ? 'hat' : VALUE_TYPES.has(type) ? 'value' : 'statement'

// ─── Category → block list ────────────────────────────────────────────────────
const CATEGORY_BLOCKS = {
  basic: [
    { type: 'clear_screen',       label: 'clear screen'          },
    { type: 'show_icon',          label: 'show icon'             },
    { type: 'show_leds',          label: 'show LEDs'             },
    { type: 'show_number',        label: 'show number'           },
    { type: 'show_string',        label: 'show string'           },
    { type: 'plot_bar_graph',     label: 'plot bar graph'        },
    { type: 'wait_secs',          label: 'wait'                  },
    { type: 'on_button_pressed',  label: 'on button pressed'     },
    { type: 'on_shake',           label: 'on shake'              },
    { type: 'on_pin_pressed',     label: 'on pin pressed'        },
  ],
  control: [
    { type: 'on_start',           label: 'on start'              },
    { type: 'forever',            label: 'forever'               },
    { type: 'wait_secs',          label: 'wait'                  },
    { type: 'repeat_times',       label: 'repeat times'          },
    { type: 'repeat_while',       label: 'repeat while'          },
    { type: 'if_then',            label: 'if then'               },
    { type: 'if_then_else',       label: 'if then else'          },
  ],
  output: [
    { type: 'clear_screen',       label: 'clear screen'          },
    { type: 'plot_x_y',           label: 'plot x y'              },
    { type: 'plot_x_y_brightness',label: 'plot x y brightness'   },
    { type: 'unplot_x_y',         label: 'unplot x y'            },
    { type: 'show_icon',          label: 'show icon'             },
    { type: 'show_leds',          label: 'show LEDs'             },
    { type: 'show_number',        label: 'show number'           },
    { type: 'show_string',        label: 'show string'           },
    { type: 'plot_bar_graph',     label: 'plot bar graph'        },
    { type: 'digital_write_pin',  label: 'digital write pin'     },
    { type: 'write_analog_pin',   label: 'analog write pin'      },
    { type: 'rotate_servo',       label: 'rotate servo'          },
    { type: 'write_servo_pulse',  label: 'write servo pulse'     },
    { type: 'set_pull_pin',       label: 'set pull pin'          },
    { type: 'analog_set_pitch_pin','label': 'set pitch pin'      },
    { type: 'analog_set_pitch_vol','label': 'set pitch volume'   },
    { type: 'analog_pitch',       label: 'analog pitch'          },
    { type: 'radio_set_group',    label: 'radio set group'       },
    { type: 'radio_send_number',  label: 'radio send number'     },
    { type: 'radio_send_string',  label: 'radio send string'     },
    { type: 'radio_send_value',   label: 'radio send value'      },
  ],
  math: [
    { type: 'math_arithmetic_openhw', label: 'arithmetic'        },
    { type: 'math_compare',       label: 'compare'               },
    { type: 'pick_random',        label: 'pick random'           },
    { type: 'math_abs_of',        label: 'math function'         },
    { type: 'math_round',         label: 'round'                 },
    { type: 'map_value',          label: 'map value'             },
    { type: 'math_constrain_block', label: 'constrain'           },
    { type: 'state_dropdown',     label: 'HIGH / LOW'            },
    { type: 'logic_operation',    label: 'and / or'              },
    { type: 'logic_negate',       label: 'not'                   },
    { type: 'logic_boolean',      label: 'true / false'          },
    { type: 'math_number',        label: 'number'                },
  ],
  input: [
    { type: 'read_digital_pin',   label: 'digital read pin'      },
    { type: 'read_analog_pin',    label: 'analog read pin'       },
    { type: 'acceleration',       label: 'acceleration'          },
    { type: 'rotation',           label: 'rotation'              },
    { type: 'light_level',        label: 'light level'           },
    { type: 'temperature',        label: 'temperature'           },
    { type: 'compass_heading',    label: 'compass heading'       },
    { type: 'analog_pitch_vol_read', label: 'pitch volume'       },
    { type: 'on_button_pressed',  label: 'on button pressed'     },
    { type: 'on_shake',           label: 'on shake'              },
    { type: 'on_pin_pressed',     label: 'on pin pressed'        },
    { type: 'on_pin_changed',     label: 'on pin changed'        },
    { type: 'on_radio_number',    label: 'on radio number'       },
    { type: 'on_radio_string',    label: 'on radio string'       },
    { type: 'on_radio_key_value', label: 'on radio key+value'    },
    { type: 'button_pressed_bool',label: 'button pressed ?'      },
    { type: 'digital_pin_is',     label: 'digital pin is ?'      },
    { type: 'gesture_is',         label: 'gesture is ?'          },
    { type: 'set_accel_range',    label: 'set accel range'       },
  ],
}

// ─── Custom block JSON definitions ───────────────────────────────────────────
const BLOCK_DEFS = [
  // ── Shared / Basic ─────────────────────────────────────────────────────────
  { type:'clear_screen', message0:'clear screen',
    previousStatement:null, nextStatement:null, colour:0,
    tooltip:'Turn off all LEDs.' },

  { type:'show_icon', message0:'show icon %1',
    args0:[{ type:'field_dropdown', name:'ICON', options:[
      ['Heart','HEART'],['Happy','HAPPY'],['Sad','SAD'],['Yes','YES'],['No','NO'],
      ['Arrow Up','ARROW_UP'],['Arrow Down','ARROW_DOWN'],['Arrow Left','ARROW_LEFT'],
      ['Arrow Right','ARROW_RIGHT'],['Star','STAR'],['Diamond','DIAMOND'],
      ['Skull','SKULL'],['Music','MUSIC'],['Target','TARGET'],
    ]}],
    previousStatement:null, nextStatement:null, colour:0,
    tooltip:'Display a built-in icon.' },

  { type:'show_leds',
    message0:'LEDs %1 %2 %3 %4 %5 | %6 %7 %8 %9 %10 | %11 %12 %13 %14 %15 | %16 %17 %18 %19 %20 | %21 %22 %23 %24 %25',
    args0: Array.from({length:25},(_,i)=>({type:'field_checkbox',name:`L${i}`,checked:false})),
    previousStatement:null, nextStatement:null, colour:0,
    tooltip:'Draw a 5x5 LED pattern.' },

  { type:'show_number', message0:'show number %1',
    args0:[{type:'input_value',name:'NUM',check:'Number'}],
    inputsInline:true,
    previousStatement:null, nextStatement:null, colour:0,
    tooltip:'Display a number on the LED matrix.' },

  { type:'show_string', message0:'show string %1',
    args0:[{type:'field_input',name:'TEXT',text:'Hello!'}],
    previousStatement:null, nextStatement:null, colour:0,
    tooltip:'Scroll a string on the LED matrix.' },

  { type:'plot_bar_graph', message0:'plot bar graph of %1 up to %2',
    args0:[
      {type:'input_value',name:'VAL',check:'Number'},
      {type:'input_value',name:'MAX',check:'Number'},
    ],
    inputsInline:true,
    previousStatement:null, nextStatement:null, colour:0,
    tooltip:'Plot a bar graph.' },

  { type:'wait_secs', message0:'wait %1 %2',
    args0:[
      {type:'field_number',name:'VAL',value:1,min:0},
      {type:'field_dropdown',name:'UNIT',options:[['secs','SEC'],['ms','MS']]},
    ],
    previousStatement:null, nextStatement:null, colour:0,
    tooltip:'Pause execution.' },

  { type:'on_pin_pressed', message0:'on pin %1 pressed %2 %3',
    args0:[
      {type:'field_dropdown',name:'PIN',options:[['P0','0'],['P1','1'],['P2','2']]},
      {type:'input_dummy'},
      {type:'input_statement',name:'DO'},
    ],
    colour:0, tooltip:'Run on touch pin press.' },

  // ── Control ─────────────────────────────────────────────────────────────────
  { type:'on_start', message0:'on start %1 %2',
    args0:[{type:'input_dummy'},{type:'input_statement',name:'DO'}],
    colour:33, tooltip:'Runs once at startup.' },

  { type:'forever', message0:'forever %1 %2',
    args0:[{type:'input_dummy'},{type:'input_statement',name:'DO'}],
    colour:33, tooltip:'Runs continuously.' },

  { type:'repeat_times', message0:'repeat %1 times %2 %3',
    args0:[
      {type:'input_value',name:'TIMES',check:'Number'},
      {type:'input_dummy'},
      {type:'input_statement',name:'DO'},
    ],
    previousStatement:null, nextStatement:null, colour:33,
    tooltip:'Repeat N times.' },

  { type:'repeat_while', message0:'repeat while %1 %2 %3',
    args0:[
      {type:'input_value',name:'COND',check:'Boolean'},
      {type:'input_dummy'},
      {type:'input_statement',name:'DO'},
    ],
    previousStatement:null, nextStatement:null, colour:33,
    tooltip:'Repeat while condition is true.' },

  { type:'if_then', message0:'if %1 then %2 %3',
    args0:[
      {type:'input_value',name:'COND',check:'Boolean'},
      {type:'input_dummy'},
      {type:'input_statement',name:'DO'},
    ],
    previousStatement:null, nextStatement:null, colour:33,
    tooltip:'Run if condition is true.' },

  { type:'if_then_else',
    message0:'if %1 then %2 %3 else %4 %5',
    args0:[
      {type:'input_value',name:'COND',check:'Boolean'},
      {type:'input_dummy'},
      {type:'input_statement',name:'DO'},
      {type:'input_dummy'},
      {type:'input_statement',name:'ELSE'},
    ],
    previousStatement:null, nextStatement:null, colour:33,
    tooltip:'If/else.' },

  // ── Output ──────────────────────────────────────────────────────────────────
  { type:'plot_x_y', message0:'plot x %1 y %2',
    args0:[
      {type:'input_value',name:'X',check:'Number'},
      {type:'input_value',name:'Y',check:'Number'},
    ],
    inputsInline:true,
    previousStatement:null, nextStatement:null, colour:210,
    tooltip:'Turn on LED at (x,y).' },

  { type:'plot_x_y_brightness', message0:'plot x %1 y %2 brightness %3',
    args0:[
      {type:'input_value',name:'X',check:'Number'},
      {type:'input_value',name:'Y',check:'Number'},
      {type:'input_value',name:'BRIGHT',check:'Number'},
    ],
    inputsInline:true,
    previousStatement:null, nextStatement:null, colour:210,
    tooltip:'Turn on LED at (x,y) with brightness.' },

  { type:'unplot_x_y', message0:'unplot x %1 y %2',
    args0:[
      {type:'input_value',name:'X',check:'Number'},
      {type:'input_value',name:'Y',check:'Number'},
    ],
    inputsInline:true,
    previousStatement:null, nextStatement:null, colour:210,
    tooltip:'Turn off LED at (x,y).' },

  { type:'digital_write_pin', message0:'digital write pin %1 to %2',
    args0:[
      {type:'field_dropdown',name:'PIN',options:[
        ['P0','0'],['P1','1'],['P2','2'],['P3','3'],['P4','4'],['P5','5'],
        ['P6','6'],['P7','7'],['P8','8'],['P9','9'],['P10','10'],
        ['P11','11'],['P12','12'],['P13','13'],
      ]},
      {type:'field_dropdown',name:'STATE',options:[['HIGH','HIGH'],['LOW','LOW']]},
    ],
    previousStatement:null, nextStatement:null, colour:210,
    tooltip:'Set a digital pin HIGH or LOW.' },

  { type:'write_analog_pin', message0:'analog write pin %1 to %2',
    args0:[
      {type:'field_dropdown',name:'PIN',options:[
        ['P0','0'],['P1','1'],['P2','2'],['P3','3'],['P4','4'],['P5','5'],
        ['P6','6'],['P9','9'],['P10','10'],['P11','11'],
      ]},
      {type:'input_value',name:'VAL',check:'Number'},
    ],
    inputsInline:true,
    previousStatement:null, nextStatement:null, colour:210,
    tooltip:'Analog write (0-255).' },

  { type:'rotate_servo', message0:'rotate servo pin %1 to %2 degrees',
    args0:[
      {type:'field_dropdown',name:'PIN',options:[
        ['P0','0'],['P1','1'],['P2','2'],['P3','3'],['P4','4'],['P5','5'],
      ]},
      {type:'input_value',name:'DEG',check:'Number'},
    ],
    inputsInline:true,
    previousStatement:null, nextStatement:null, colour:210,
    tooltip:'Rotate servo (0-180°).' },

  { type:'write_servo_pulse', message0:'write servo pin %1 to pulse %2',
    args0:[
      {type:'field_dropdown',name:'PIN',options:[
        ['P0','0'],['P1','1'],['P2','2'],['P3','3'],['P4','4'],['P5','5'],
      ]},
      {type:'input_value',name:'PULSE',check:'Number'},
    ],
    inputsInline:true,
    previousStatement:null, nextStatement:null, colour:210,
    tooltip:'Write a servo pulse width in microseconds.' },

  { type:'set_pull_pin', message0:'set pull pin %1 to %2',
    args0:[
      {type:'field_dropdown',name:'PIN',options:[
        ['P0','0'],['P1','1'],['P2','2'],['P3','3'],['P4','4'],['P5','5'],
        ['P6','6'],['P7','7'],['P8','8'],['P9','9'],['P10','10'],
        ['P11','11'],['P12','12'],['P13','13'],
      ]},
      {type:'field_dropdown',name:'MODE',options:[['up','UP'],['down','DOWN'],['none','NONE']]},
    ],
    previousStatement:null, nextStatement:null, colour:210,
    tooltip:'Set pull-up/down mode for a pin.' },

  { type:'analog_set_pitch_pin', message0:'analog set pitch pin %1',
    args0:[{type:'field_dropdown',name:'PIN',options:[
      ['P0','0'],['P1','1'],['P2','2'],['P3','3'],['P4','4'],['P5','5'],
    ]}],
    previousStatement:null, nextStatement:null, colour:210,
    tooltip:'Set the analog pitch output pin.' },

  { type:'analog_set_pitch_vol', message0:'analog set pitch volume to %1',
    args0:[{type:'input_value',name:'VOL',check:'Number'}],
    inputsInline:true,
    previousStatement:null, nextStatement:null, colour:210,
    tooltip:'Set analog pitch volume (0-255).' },

  { type:'analog_pitch', message0:'analog pitch %1 for %2 ms',
    args0:[
      {type:'input_value',name:'FREQ',check:'Number'},
      {type:'input_value',name:'MS',check:'Number'},
    ],
    inputsInline:true,
    previousStatement:null, nextStatement:null, colour:210,
    tooltip:'Play a frequency for N milliseconds.' },

  { type:'radio_set_group', message0:'radio set group %1',
    args0:[{type:'field_number',name:'GROUP',value:1,min:0,max:255,precision:1}],
    previousStatement:null, nextStatement:null, colour:210,
    tooltip:'Set radio group (0-255).' },

  { type:'radio_send_number', message0:'radio send number %1',
    args0:[{type:'input_value',name:'NUM',check:'Number'}],
    inputsInline:true,
    previousStatement:null, nextStatement:null, colour:210,
    tooltip:'Broadcast a number over radio.' },

  { type:'radio_send_string', message0:'radio send string %1',
    args0:[{type:'field_input',name:'TEXT',text:'text'}],
    previousStatement:null, nextStatement:null, colour:210,
    tooltip:'Broadcast a string over radio.' },

  { type:'radio_send_value', message0:'radio send value %1 = %2',
    args0:[
      {type:'field_input',name:'KEY',text:'key'},
      {type:'input_value',name:'VAL',check:'Number'},
    ],
    inputsInline:true,
    previousStatement:null, nextStatement:null, colour:210,
    tooltip:'Broadcast a key=value pair over radio.' },

  // ── Math ────────────────────────────────────────────────────────────────────
  { type:'math_arithmetic_openhw', message0:'%1 %2 %3',
    args0:[
      {type:'input_value',name:'A',check:'Number'},
      {type:'field_dropdown',name:'OP',options:[['+','ADD'],['-','SUB'],['x','MUL'],['/','DIV'],['%','MOD']]},
      {type:'input_value',name:'B',check:'Number'},
    ],
    inputsInline:true,
    output:'Number', colour:120,
    tooltip:'Arithmetic.' },

  { type:'math_compare', message0:'%1 %2 %3',
    args0:[
      {type:'input_value',name:'A',check:'Number'},
      {type:'field_dropdown',name:'OP',options:[['=','EQ'],['!=','NEQ'],['>','GT'],['<','LT'],['>=','GTE'],['<=','LTE']]},
      {type:'input_value',name:'B',check:'Number'},
    ],
    inputsInline:true,
    output:'Boolean', colour:120,
    tooltip:'Compare two numbers.' },

  { type:'pick_random', message0:'pick random %1 to %2',
    args0:[
      {type:'field_number',name:'MIN',value:0},
      {type:'field_number',name:'MAX',value:10},
    ],
    output:'Number', colour:120,
    tooltip:'Random integer between min and max.' },

  { type:'math_abs_of', message0:'%1 of %2',
    args0:[
      {type:'field_dropdown',name:'OP',options:[
        ['abs','ABS'],['sqrt','SQRT'],['sin','SIN'],['cos','COS'],
        ['tan','TAN'],['log','LOG'],['exp','EXP'],
      ]},
      {type:'input_value',name:'NUM',check:'Number'},
    ],
    inputsInline:true,
    output:'Number', colour:120,
    tooltip:'Math function.' },

  { type:'math_round', message0:'%1 of %2',
    args0:[
      {type:'field_dropdown',name:'OP',options:[['round','ROUND'],['floor','FLOOR'],['ceil','CEIL']]},
      {type:'input_value',name:'NUM',check:'Number'},
    ],
    inputsInline:true,
    output:'Number', colour:120,
    tooltip:'Round a number.' },

  { type:'map_value', message0:'map %1 from %2—%3 to %4—%5',
    args0:[
      {type:'input_value',name:'VAL',check:'Number'},
      {type:'field_number',name:'FL',value:0},
      {type:'field_number',name:'FH',value:1023},
      {type:'field_number',name:'TL',value:0},
      {type:'field_number',name:'TH',value:255},
    ],
    inputsInline:true,
    output:'Number', colour:120,
    tooltip:'Re-map a value from one range to another.' },

  { type:'math_constrain_block', message0:'constrain %1 from %2 to %3',
    args0:[
      {type:'input_value',name:'VAL',check:'Number'},
      {type:'input_value',name:'LO',check:'Number'},
      {type:'input_value',name:'HI',check:'Number'},
    ],
    inputsInline:true,
    output:'Number', colour:120,
    tooltip:'Constrain a value to a range.' },

  { type:'state_dropdown', message0:'%1',
    args0:[{type:'field_dropdown',name:'STATE',options:[['HIGH','HIGH'],['LOW','LOW']]}],
    output:'Number', colour:120,
    tooltip:'HIGH (1) or LOW (0).' },

  // ── Input ───────────────────────────────────────────────────────────────────
  { type:'on_button_pressed', message0:'on button %1 pressed %2 %3',
    args0:[
      {type:'field_dropdown',name:'BTN',options:[['A','A'],['B','B'],['A+B','A_B']]},
      {type:'input_dummy'},
      {type:'input_statement',name:'DO'},
    ],
    colour:270, tooltip:'Run when button pressed.' },

  { type:'on_shake', message0:'on shake %1 %2',
    args0:[{type:'input_dummy'},{type:'input_statement',name:'DO'}],
    colour:270, tooltip:'Run when board shaken.' },

  { type:'read_digital_pin', message0:'digital read pin %1',
    args0:[{type:'field_dropdown',name:'PIN',options:[
      ['P0','0'],['P1','1'],['P2','2'],['P3','3'],['P4','4'],['P5','5'],
      ['P6','6'],['P7','7'],['P8','8'],['P9','9'],['P10','10'],
      ['P11','11'],['P12','12'],['P13','13'],
    ]}],
    output:'Number', colour:270,
    tooltip:'Read digital state of a pin.' },

  { type:'read_analog_pin', message0:'analog read pin %1',
    args0:[{type:'field_dropdown',name:'PIN',options:[
      ['P0','A0'],['P1','A1'],['P2','A2'],['P3','A3'],['P4','A4'],['P5','A5'],
    ]}],
    output:'Number', colour:270,
    tooltip:'Read analog value (0-1023).' },

  { type:'acceleration', message0:'acceleration ( %1 )',
    args0:[{type:'field_dropdown',name:'AXIS',options:[['x','X'],['y','Y'],['z','Z'],['strength','STRENGTH']]}],
    output:'Number', colour:270,
    tooltip:'Read accelerometer.' },

  { type:'rotation', message0:'rotation ( %1 )',
    args0:[{type:'field_dropdown',name:'AXIS',options:[['pitch','PITCH'],['roll','ROLL']]}],
    output:'Number', colour:270,
    tooltip:'Read rotation angle in degrees.' },

  { type:'light_level', message0:'light level',
    output:'Number', colour:270,
    tooltip:'Read ambient light (0-255).' },

  { type:'temperature', message0:'temperature (C)',
    output:'Number', colour:270,
    tooltip:'Read on-chip temperature.' },

  { type:'compass_heading', message0:'compass heading',
    output:'Number', colour:270,
    tooltip:'Read compass heading (0-360).' },

  { type:'analog_pitch_vol_read', message0:'analog pitch volume',
    output:'Number', colour:270,
    tooltip:'Read current pitch volume.' },

  { type:'on_pin_changed', message0:'on pin %1 changed to %2 %3 %4',
    args0:[
      {type:'field_dropdown',name:'PIN',options:[['P0','0'],['P1','1'],['P2','2'],['P3','3'],['P4','4'],['P5','5']]},
      {type:'field_dropdown',name:'STATE',options:[['HIGH','HIGH'],['LOW','LOW']]},
      {type:'input_dummy'},
      {type:'input_statement',name:'DO'},
    ],
    colour:270, tooltip:'Run when pin changes state.' },

  { type:'on_radio_number', message0:'on radio received number %1 %2',
    args0:[{type:'input_dummy'},{type:'input_statement',name:'DO'}],
    colour:270, tooltip:'Run when a radio number arrives.' },

  { type:'on_radio_string', message0:'on radio received string %1 %2',
    args0:[{type:'input_dummy'},{type:'input_statement',name:'DO'}],
    colour:270, tooltip:'Run when a radio string arrives.' },

  { type:'on_radio_key_value', message0:'on radio received key / value %1 %2',
    args0:[{type:'input_dummy'},{type:'input_statement',name:'DO'}],
    colour:270, tooltip:'Run when a radio key-value arrives.' },

  { type:'button_pressed_bool', message0:'button %1 pressed',
    args0:[{type:'field_dropdown',name:'BTN',options:[['A','A'],['B','B'],['A+B','A_B']]}],
    output:'Boolean', colour:270,
    tooltip:'Returns true if button is currently held.' },

  { type:'digital_pin_is', message0:'digital pin %1 is %2',
    args0:[
      {type:'field_dropdown',name:'PIN',options:[
        ['P0','0'],['P1','1'],['P2','2'],['P3','3'],['P4','4'],['P5','5'],
        ['P6','6'],['P7','7'],['P8','8'],['P9','9'],['P10','10'],
        ['P11','11'],['P12','12'],['P13','13'],
      ]},
      {type:'field_dropdown',name:'STATE',options:[['HIGH','HIGH'],['LOW','LOW']]},
    ],
    output:'Boolean', colour:270,
    tooltip:'True if pin is at given state.' },

  { type:'gesture_is', message0:'gesture is %1',
    args0:[{type:'field_dropdown',name:'GESTURE',options:[
      ['shake','SHAKE'],['logo up','LOGO_UP'],['logo down','LOGO_DOWN'],
      ['face up','FACE_UP'],['face down','FACE_DOWN'],
      ['tilt left','TILT_LEFT'],['tilt right','TILT_RIGHT'],
      ['free fall','FREE_FALL'],['3g','3G'],['6g','6G'],['8g','8G'],
    ]}],
    output:'Boolean', colour:270,
    tooltip:'True if current gesture matches.' },

  { type:'set_accel_range', message0:'set accelerometer range %1',
    args0:[{type:'field_dropdown',name:'RANGE',options:[['1g','1G'],['2g','2G'],['4g','4G'],['8g','8G']]}],
    previousStatement:null, nextStatement:null, colour:270,
    tooltip:'Set accelerometer measurement range.' },
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
  const vc  = (b, name, ord) => gen.valueToCode(b, name, ord) || '0'
  const sc  = (b, name)      => gen.statementToCode(b, name)

  // Shared / Basic
  gen.forBlock['clear_screen']    = () => 'clearScreen();\n'
  gen.forBlock['show_icon']       = b  => `showIcon(${b.getFieldValue('ICON')});\n`
  gen.forBlock['show_leds']       = b  => {
    const bits = Array.from({length:25},(_,i)=>b.getFieldValue(`L${i}`)==='TRUE'?'1':'0')
    const rows = Array.from({length:5},(_,r)=>'{'+bits.slice(r*5,r*5+5).join(',')+'}')
    return `showLEDs({\n  ${rows.join(',\n  ')}\n});\n`
  }
  gen.forBlock['show_number']     = b  => `showNumber(${vc(b,'NUM',gen.ORDER_ATOMIC)});\n`
  gen.forBlock['show_string']     = b  => `showString("${b.getFieldValue('TEXT')}");\n`
  gen.forBlock['plot_bar_graph']  = b  => `plotBarGraph(${vc(b,'VAL',gen.ORDER_ATOMIC)}, ${vc(b,'MAX',gen.ORDER_ATOMIC)});\n`
  gen.forBlock['wait_secs']       = b  => {
    const ms = b.getFieldValue('UNIT')==='SEC'
      ? Math.round(b.getFieldValue('VAL') * 1000) : Math.round(b.getFieldValue('VAL'))
    return `delay(${ms});\n`
  }
  gen.forBlock['on_pin_pressed']  = b  => `void onPinPressed_${b.getFieldValue('PIN')}() {\n${sc(b,'DO')}}\n\n`

  // Control
  gen.forBlock['on_start']        = b  => `void setup() {\n${sc(b,'DO')}}\n\n`
  gen.forBlock['forever']         = b  => `void loop() {\n${sc(b,'DO')}}\n\n`
  gen.forBlock['repeat_times']    = b  => `for (int i=0; i<${vc(b,'TIMES',gen.ORDER_ATOMIC)}; i++) {\n${sc(b,'DO')}}\n`
  gen.forBlock['repeat_while']    = b  => `while (${vc(b,'COND',gen.ORDER_NONE)}) {\n${sc(b,'DO')}}\n`
  gen.forBlock['if_then']         = b  => `if (${vc(b,'COND',gen.ORDER_NONE)}) {\n${sc(b,'DO')}}\n`
  gen.forBlock['if_then_else']    = b  => `if (${vc(b,'COND',gen.ORDER_NONE)}) {\n${sc(b,'DO')}} else {\n${sc(b,'ELSE')}}\n`

  // Output
  gen.forBlock['plot_x_y']            = b => `plot(${vc(b,'X',gen.ORDER_ATOMIC)}, ${vc(b,'Y',gen.ORDER_ATOMIC)});\n`
  gen.forBlock['plot_x_y_brightness'] = b => `plotBrightness(${vc(b,'X',gen.ORDER_ATOMIC)}, ${vc(b,'Y',gen.ORDER_ATOMIC)}, ${vc(b,'BRIGHT',gen.ORDER_ATOMIC)});\n`
  gen.forBlock['unplot_x_y']          = b => `unplot(${vc(b,'X',gen.ORDER_ATOMIC)}, ${vc(b,'Y',gen.ORDER_ATOMIC)});\n`
  gen.forBlock['digital_write_pin']   = b => `digitalWrite(${b.getFieldValue('PIN')}, ${b.getFieldValue('STATE')});\n`
  gen.forBlock['write_analog_pin']    = b => `analogWrite(${b.getFieldValue('PIN')}, ${vc(b,'VAL',gen.ORDER_ATOMIC)});\n`
  gen.forBlock['rotate_servo']        = b => `myServo_${b.getFieldValue('PIN')}.write(${vc(b,'DEG',gen.ORDER_ATOMIC)});\n`
  gen.forBlock['write_servo_pulse']   = b => `myServo_${b.getFieldValue('PIN')}.writeMicroseconds(${vc(b,'PULSE',gen.ORDER_ATOMIC)});\n`
  gen.forBlock['set_pull_pin']        = b => `setPullMode(${b.getFieldValue('PIN')}, ${b.getFieldValue('MODE')});\n`
  gen.forBlock['analog_set_pitch_pin']= b => `analogSetPitchPin(${b.getFieldValue('PIN')});\n`
  gen.forBlock['analog_set_pitch_vol']= b => `analogSetPitchVolume(${vc(b,'VOL',gen.ORDER_ATOMIC)});\n`
  gen.forBlock['analog_pitch']        = b => `analogPitch(${vc(b,'FREQ',gen.ORDER_ATOMIC)}, ${vc(b,'MS',gen.ORDER_ATOMIC)});\n`
  gen.forBlock['radio_set_group']     = b => `radio.setGroup(${b.getFieldValue('GROUP')});\n`
  gen.forBlock['radio_send_number']   = b => `radio.sendNumber(${vc(b,'NUM',gen.ORDER_ATOMIC)});\n`
  gen.forBlock['radio_send_string']   = b => `radio.sendString("${b.getFieldValue('TEXT')}");\n`
  gen.forBlock['radio_send_value']    = b => `radio.sendValue("${b.getFieldValue('KEY')}", ${vc(b,'VAL',gen.ORDER_ATOMIC)});\n`

  // Math
  const AFNS = {ADD:'+',SUB:'-',MUL:'*',DIV:'/',MOD:'%'}
  const CFNS = {EQ:'==',NEQ:'!=',GT:'>',LT:'<',GTE:'>=',LTE:'<='}
  const MFNS = {ABS:'abs',SQRT:'sqrt',SIN:'sin',COS:'cos',TAN:'tan',LOG:'log',EXP:'exp'}
  const RFNS = {ROUND:'round',FLOOR:'floor',CEIL:'ceil'}
  gen.forBlock['math_arithmetic_openhw'] = b => [`(${vc(b,'A',gen.ORDER_ADDITION)} ${AFNS[b.getFieldValue('OP')]} ${vc(b,'B',gen.ORDER_ADDITION)})`, gen.ORDER_ADDITION]
  gen.forBlock['math_compare']           = b => [`(${vc(b,'A',gen.ORDER_RELATIONAL)} ${CFNS[b.getFieldValue('OP')]} ${vc(b,'B',gen.ORDER_RELATIONAL)})`, gen.ORDER_EQUALITY]
  gen.forBlock['pick_random']            = b => [`random(${b.getFieldValue('MIN')}, ${Number(b.getFieldValue('MAX'))+1})`, gen.ORDER_ATOMIC]
  gen.forBlock['math_abs_of']            = b => [`${MFNS[b.getFieldValue('OP')]}(${vc(b,'NUM',gen.ORDER_ATOMIC)})`, gen.ORDER_ATOMIC]
  gen.forBlock['math_round']             = b => [`${RFNS[b.getFieldValue('OP')]}(${vc(b,'NUM',gen.ORDER_ATOMIC)})`, gen.ORDER_ATOMIC]
  gen.forBlock['map_value']              = b => [`map(${vc(b,'VAL',gen.ORDER_ATOMIC)}, ${b.getFieldValue('FL')}, ${b.getFieldValue('FH')}, ${b.getFieldValue('TL')}, ${b.getFieldValue('TH')})`, gen.ORDER_ATOMIC]
  gen.forBlock['math_constrain_block']   = b => [`constrain(${vc(b,'VAL',gen.ORDER_ATOMIC)}, ${vc(b,'LO',gen.ORDER_ATOMIC)}, ${vc(b,'HI',gen.ORDER_ATOMIC)})`, gen.ORDER_ATOMIC]
  gen.forBlock['state_dropdown']         = b => [b.getFieldValue('STATE'), gen.ORDER_ATOMIC]
  gen.forBlock['math_number']            = b => [String(parseFloat(b.getFieldValue('NUM'))), gen.ORDER_ATOMIC]
  gen.forBlock['logic_boolean']          = b => [b.getFieldValue('BOOL')==='TRUE'?'true':'false', gen.ORDER_ATOMIC]
  gen.forBlock['logic_negate']           = b => [`!(${vc(b,'BOOL',gen.ORDER_LOGICAL_NOT)})`, gen.ORDER_LOGICAL_NOT]
  gen.forBlock['logic_operation']        = b => {
    const op = b.getFieldValue('OP')==='AND' ? '&&' : '||'
    const ord = op==='&&' ? gen.ORDER_LOGICAL_AND : gen.ORDER_LOGICAL_OR
    return [`(${vc(b,'A',ord)} ${op} ${vc(b,'B',ord)})`, ord]
  }

  // Input
  gen.forBlock['read_digital_pin']     = b => [`digitalRead(${b.getFieldValue('PIN')})`, gen.ORDER_ATOMIC]
  gen.forBlock['read_analog_pin']      = b => [`analogRead(${b.getFieldValue('PIN')})`, gen.ORDER_ATOMIC]
  gen.forBlock['acceleration']         = b => [`getAccel_${b.getFieldValue('AXIS').toLowerCase()}()`, gen.ORDER_ATOMIC]
  gen.forBlock['rotation']             = b => [`getRotation_${b.getFieldValue('AXIS').toLowerCase()}()`, gen.ORDER_ATOMIC]
  gen.forBlock['light_level']          = () => ['getLightLevel()', gen.ORDER_ATOMIC]
  gen.forBlock['temperature']          = () => ['getTemperature()', gen.ORDER_ATOMIC]
  gen.forBlock['compass_heading']      = () => ['getCompassHeading()', gen.ORDER_ATOMIC]
  gen.forBlock['analog_pitch_vol_read']= () => ['getAnalogVolume()', gen.ORDER_ATOMIC]
  gen.forBlock['on_button_pressed']    = b => {
    const fn = `onButton${b.getFieldValue('BTN').replace('+','_')}`
    return `void ${fn}() {\n${sc(b,'DO')}}\n\n`
  }
  gen.forBlock['on_shake']             = b => `void onShake() {\n${sc(b,'DO')}}\n\n`
  gen.forBlock['on_pin_changed']       = b => `void onPin${b.getFieldValue('PIN')}_to${b.getFieldValue('STATE')}() {\n${sc(b,'DO')}}\n\n`
  gen.forBlock['on_radio_number']      = b => `void onRadioNumber(int value) {\n${sc(b,'DO')}}\n\n`
  gen.forBlock['on_radio_string']      = b => `void onRadioString(String text) {\n${sc(b,'DO')}}\n\n`
  gen.forBlock['on_radio_key_value']   = b => `void onRadioKeyValue(String key, int value) {\n${sc(b,'DO')}}\n\n`
  gen.forBlock['button_pressed_bool']  = b => [`isButtonPressed_${b.getFieldValue('BTN')}()`, gen.ORDER_ATOMIC]
  gen.forBlock['digital_pin_is']       = b => [`(digitalRead(${b.getFieldValue('PIN')})==${b.getFieldValue('STATE')})`, gen.ORDER_EQUALITY]
  gen.forBlock['gesture_is']           = b => [`isGesture(GESTURE_${b.getFieldValue('GESTURE')})`, gen.ORDER_ATOMIC]
  gen.forBlock['set_accel_range']      = b => `setAccelRange(${b.getFieldValue('RANGE')});\n`

  // Variable blocks
  gen.forBlock['variables_get']  = b => [gen.nameDB_.getName(b.getFieldValue('VAR'), B.Names.NameType.VARIABLE), gen.ORDER_ATOMIC]
  gen.forBlock['variables_set']  = b => { const n=gen.nameDB_.getName(b.getFieldValue('VAR'),B.Names.NameType.VARIABLE); return `${n} = ${vc(b,'VALUE',gen.ORDER_ATOMIC)};\n` }
  gen.forBlock['math_change']    = b => { const n=gen.nameDB_.getName(b.getFieldValue('VAR'),B.Names.NameType.VARIABLE); return `${n} += ${vc(b,'DELTA',gen.ORDER_ADDITION)};\n` }

  return gen
}

// ─── Sketch assembler ─────────────────────────────────────────────────────────
function generateSketch(gen, ws) {
  const vars = ws.getAllVariables()
  const varDecl = vars.length ? vars.map(v=>`int ${v.name} = 0;`).join('\n')+'\n\n' : ''
  let setup='', loop_=''; const extras=[]
  ws.getTopBlocks(true).forEach(b => {
    try {
      const code = gen.blockToCode(b)
      if (!code) return
      if (b.type==='on_start') setup += code
      else if (b.type==='forever') loop_ += code
      else extras.push(code)
    } catch(_) {}
  })
  if (!setup) setup='void setup() {\n  // init\n}\n\n'
  if (!loop_) loop_='void loop() {\n  // loop\n}\n\n'
  return `// Generated by OpenHW Studio Block Editor\n\n${varDecl}${extras.join('\n')}${extras.length?'\n':''}${setup}${loop_}`
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

// ─── Block shape SVG preview ──────────────────────────────────────────────────
// Draws a simplified block outline (hat / statement / value) matching Blockly style.
const W = 150, BH = 30, NX = 12, NW = 22, NH = 9, R = 4
function BlockPreview({ label, shapeKind, color, type, onDragStart, varId }) {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', type)
    if (varId) e.dataTransfer.setData('application/x-varId', varId)
    e.dataTransfer.effectAllowed = 'copy'
    onDragStart && onDragStart(type)
  }

  // ── Value (reporter) — oval pill ──────────────────────────────────────────
  if (shapeKind === 'value') {
    const rx = BH / 2
    return (
      <div draggable onDragStart={handleDragStart} style={BPWRAP}>
        <svg width={W} height={BH} viewBox={`0 0 ${W} ${BH}`} aria-hidden style={{display:'block'}}>
          <rect x={0} y={0} width={W} height={BH} rx={rx} ry={rx} fill={color} />
          <text x={W/2} y={BH/2} textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize={10.5} fontWeight="600" fontFamily="inherit">
            {label}
          </text>
        </svg>
      </div>
    )
  }

  // ── Hat (event) block ─────────────────────────────────────────────────────
  if (shapeKind === 'hat') {
    const HH = 14   // hat bump height above main body
    const svgH = HH + BH + NH
    const bx = NX + NW          // x where hat bump ends
    const d = [
      `M 0,${HH + R}`,
      `Q 0,${HH} ${R},${HH}`,
      `H ${NX}`,
      `Q ${NX},${HH/2} ${NX + NW/2},0`,
      `Q ${NX + NW},${HH/2} ${bx + 4},${HH}`,
      `H ${W - R}`,
      `Q ${W},${HH} ${W},${HH + R}`,
      `V ${HH + BH - R}`,
      `Q ${W},${HH + BH} ${W-R},${HH + BH}`,
      `H ${NX + NW}`,
      `V ${HH + BH + NH}`,
      `H ${NX}`,
      `V ${HH + BH}`,
      `H ${R}`,
      `Q 0,${HH + BH} 0,${HH + BH - R}`,
      `V ${HH + R}`,
      `Z`,
    ].join(' ')
    return (
      <div draggable onDragStart={handleDragStart} style={BPWRAP}>
        <svg width={W} height={svgH} viewBox={`0 0 ${W} ${svgH}`} aria-hidden style={{display:'block'}}>
          <path d={d} fill={color} />
          <text x={W/2} y={HH + BH/2} textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize={10.5} fontWeight="600" fontFamily="inherit">
            {label}
          </text>
        </svg>
      </div>
    )
  }

  // ── Statement block (default) — notch top + nub bottom ───────────────────
  const svgH = BH + NH
  const d = [
    `M ${R},0`,
    `H ${NX}`,
    `V ${NH}`,
    `H ${NX + NW}`,
    `V 0`,
    `H ${W - R}`,
    `Q ${W},0 ${W},${R}`,
    `V ${BH - R}`,
    `Q ${W},${BH} ${W-R},${BH}`,
    `H ${NX + NW}`,
    `V ${BH + NH}`,
    `H ${NX}`,
    `V ${BH}`,
    `H ${R}`,
    `Q 0,${BH} 0,${BH - R}`,
    `V ${R}`,
    `Q 0,0 ${R},0`,
    `Z`,
  ].join(' ')
  return (
    <div draggable onDragStart={handleDragStart} style={BPWRAP}>
      <svg width={W} height={svgH} viewBox={`0 0 ${W} ${svgH}`} aria-hidden style={{display:'block'}}>
        <path d={d} fill={color} />
        <text x={W/2} y={BH/2} textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize={10.5} fontWeight="600" fontFamily="inherit">
          {label}
        </text>
      </svg>
    </div>
  )
}
const BPWRAP = { cursor: 'grab', userSelect: 'none', lineHeight: 0, borderRadius: 4 }

// ─── Main component ────────────────────────────────────────────────────────────
export default function BlocklyEditor({ onExportCode }) {
  const wsContainerRef = useRef(null)
  const workspaceRef   = useRef(null)
  const genRef         = useRef(null)
  const blockCountRef  = useRef(0)

  const [loadStatus,     setLoadStatus]     = useState('loading')
  const [errMsg,         setErrMsg]         = useState('')
  const [generatedCode,  setGeneratedCode]  = useState('')
  const [showCode,       setShowCode]       = useState(false)
  const [activeCat,      setActiveCat]      = useState('basic')
  const [variables,      setVariables]      = useState([])
  const [isDark,         setIsDark]         = useState(
    () => document.documentElement.getAttribute('data-theme') !== 'light'
  )

  // ── Track theme changes ────────────────────────────────────────────────────
  useEffect(() => {
    const mo = new MutationObserver(() =>
      setIsDark(document.documentElement.getAttribute('data-theme') !== 'light')
    )
    mo.observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] })
    return () => mo.disconnect()
  }, [])

  useEffect(() => {
    const ws = workspaceRef.current
    if (!ws || !window.Blockly) return
    ws.setTheme(buildTheme(window.Blockly, isDark))
  }, [isDark])

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
      ;(async () => { for (const s of CDN_SCRIPTS) await loadScript(s) })()
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
    B.defineBlocksWithJsonArray(BLOCK_DEFS)
    genRef.current = buildGenerator(B)

    const ws = B.inject(wsContainerRef.current, {
      toolbox: { kind:'flyoutToolbox', contents:[] }, // custom sidebar handles this
      theme:   buildTheme(B, isDark),
      grid:    { spacing:20, length:3, colour: isDark ? '#1e2d47' : '#e2e8f0', snap:true },
      zoom:    { controls:true, wheel:true, startScale:0.9, maxScale:3, minScale:0.3 },
      trashcan: true,
      scrollbars: true,
      sounds: false,
    })
    workspaceRef.current = ws
    setLoadStatus('ready')

    ws.addChangeListener(e => {
      const B2 = window.Blockly
      if (!B2) return
      if ([B2.Events.VAR_CREATE, B2.Events.VAR_DELETE, B2.Events.VAR_RENAME].includes(e.type))
        setVariables([...ws.getAllVariables()])
      if (e.isUiEvent) return
      try { setGeneratedCode(generateSketch(genRef.current, ws)) } catch(_) {}
    })
  }, [isDark]) // eslint-disable-line

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
    const ws  = workspaceRef.current
    const B   = window.Blockly
    const varId = e.dataTransfer.getData('application/x-varId')
    // Convert screen coords → workspace coords
    const screenCoord = new B.utils.Coordinate(e.clientX, e.clientY)
    let wsCoord
    try { wsCoord = B.utils.svgMath.screenToWsCoordinates(ws, screenCoord) }
    catch(_) { wsCoord = new B.utils.Coordinate(60, 60) }
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

  // ─── Theme tokens ─────────────────────────────────────────────────────────
  const tok = isDark ? DARK : LIGHT
  const activeCatDef = CATEGORIES.find(c => c.id === activeCat)
  const catColor = activeCatDef?.color || '#888'

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loadStatus === 'error') {
    return (
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:tok.bg}}>
        <div style={{color:'var(--red)',fontSize:13,padding:24,textAlign:'center'}}>
          <div style={{fontWeight:700,marginBottom:6}}>Blockly failed to load</div>
          <div style={{color:'var(--text3)',fontSize:11}}>{errMsg}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>

      {/* ── Toolbar ── */}
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',flexShrink:0,background:tok.toolbar,borderBottom:`1px solid ${tok.border}`}}>
        <span style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:tok.textMuted}}>Block Editor</span>
        {loadStatus==='loading' && <span style={{fontSize:11,color:tok.textMuted,marginLeft:8}}>Loading...</span>}
        <div style={{flex:1}}/>
        <button
          style={{...BTN, borderColor:tok.border, color:tok.textMuted, ...(showCode?{borderColor:'var(--accent)',color:'var(--accent)'}:{})}}
          onClick={()=>setShowCode(v=>!v)}
        >Preview</button>
        <button
          style={{...BTN, background:'var(--accent)', borderColor:'var(--accent)', color:'#000', fontWeight:700}}
          onClick={handleExport} disabled={loadStatus!=='ready'}
        >Use Code</button>
      </div>

      {/* ── Body ── */}
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* ════ Sidebar ════ */}
        <div style={{width:180,flexShrink:0,display:'flex',flexDirection:'column',overflow:'hidden',background:tok.sidebar,borderRight:`1px solid ${tok.border}`}}>

          {/* Category pills grid */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,padding:'10px 8px',borderBottom:`1px solid ${tok.border}`,flexShrink:0}}>
            {CATEGORIES.map(cat => {
              const active = activeCat === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={()=>setActiveCat(cat.id)}
                  style={{
                    display:'flex', alignItems:'center', gap:5,
                    padding:'5px 8px', borderRadius:20,
                    border: `1px solid ${active ? cat.color : tok.border}`,
                    background: active ? cat.color+'22' : 'transparent',
                    color: active ? cat.color : tok.textMuted,
                    cursor:'pointer', fontFamily:'inherit',
                    fontSize:11, fontWeight: active ? 700 : 400,
                    transition:'all .15s', whiteSpace:'nowrap', overflow:'hidden',
                  }}
                  title={cat.label}
                >
                  <span style={{width:8,height:8,borderRadius:'50%',background:cat.color,flexShrink:0}}/>
                  {cat.label}
                </button>
              )
            })}
          </div>

          {/* Block list */}
          <div className="panel-scroll" style={{flex:1,overflowY:'auto',padding:'10px 8px',display:'flex',flexDirection:'column',gap:8}}>

            {/* Standard categories */}
            {activeCat !== 'variables' && (CATEGORY_BLOCKS[activeCat] || []).map(item => {
              const kind = getShapeKind(item.type)
              return (
                <div
                  key={item.type}
                  onClick={()=>addBlock(item.type)}
                  title={`Add "${item.label}" block`}
                  style={{cursor:'pointer'}}
                >
                  <BlockPreview
                    label={item.label}
                    shapeKind={kind}
                    color={catColor}
                    type={item.type}
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
                  style={{cursor:'pointer'}}
                  title="Create a new variable"
                >
                  <div style={{
                    background: '#e84393',
                    color: '#fff', fontSize:11, fontWeight:700,
                    padding:'7px 12px', borderRadius:6,
                    textAlign:'center', userSelect:'none',
                  }}>
                    + Make a Variable
                  </div>
                </div>

                {variables.length === 0 && (
                  <div style={{fontSize:11,color:tok.textMuted,padding:'8px 4px',textAlign:'center',lineHeight:1.6}}>
                    No variables yet.<br/>Create one above.
                  </div>
                )}

                {variables.map(v => (
                  <div key={v.getId()} style={{display:'flex',flexDirection:'column',gap:8}}>
                    {/* Variable reporter (get) */}
                    <div onClick={()=>addVariableBlock('variables_get',v)} style={{cursor:'pointer'}} title={`Use "${v.name}"`}>
                      <BlockPreview label={v.name} shapeKind="value" color="#e84393" type="variables_get" varId={v.getId()} />
                    </div>
                    {/* set */}
                    <div onClick={()=>addVariableBlock('variables_set',v)} style={{cursor:'pointer'}} title={`set ${v.name}`}>
                      <BlockPreview label={`set ${v.name}`} shapeKind="statement" color="#e84393" type="variables_set" varId={v.getId()} />
                    </div>
                    {/* change */}
                    <div onClick={()=>addVariableBlock('math_change',v)} style={{cursor:'pointer'}} title={`change ${v.name}`}>
                      <BlockPreview label={`change ${v.name}`} shapeKind="statement" color="#e84393" type="math_change" varId={v.getId()} />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ════ Blockly workspace ════ */}
        <div style={{display:'flex',flex:1,overflow:'hidden'}}>
          <div
            ref={wsContainerRef}
            style={{flex: showCode ? '0 0 62%' : '1 1 100%', position:'relative', overflow:'hidden', transition:'flex .2s'}}
            onDragOver={handleWsDragOver}
            onDrop={handleWsDrop}
          />

          {/* Code preview pane */}
          {showCode && (
            <div style={{flex:'0 0 38%',display:'flex',flexDirection:'column',borderLeft:`1px solid ${tok.border}`,background:tok.bg,overflow:'hidden'}}>
              <div style={{padding:'6px 12px',fontSize:10,fontWeight:700,color:tok.textMuted,textTransform:'uppercase',letterSpacing:'.08em',borderBottom:`1px solid ${tok.border}`,flexShrink:0}}>
                Generated Arduino C++
              </div>
              <pre style={{margin:0,padding:12,fontFamily:"'JetBrains Mono',monospace",fontSize:10,lineHeight:1.7,color:tok.text,overflowY:'auto',overflowX:'auto',flex:1,whiteSpace:'pre'}}>
                {generatedCode || '// Add blocks to the canvas...'}
              </pre>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ─── Shared styles ─────────────────────────────────────────────────────────────
const BTN = {
  background:'transparent', border:'1px solid', borderRadius:6,
  padding:'3px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit',
  transition:'all .15s', whiteSpace:'nowrap',
}

// ─── Theme token sets ─────────────────────────────────────────────────────────
const DARK = {
  bg:'#0a0e1a', sidebar:'#0d1525', toolbar:'#0d1525',
  border:'#1e2d47', text:'#e8edf5', textMuted:'#4d6380',
}
const LIGHT = {
  bg:'#f8fafc', sidebar:'#f1f5f9', toolbar:'#f1f5f9',
  border:'#cbd5e1', text:'#0f172a', textMuted:'#64748b',
}
