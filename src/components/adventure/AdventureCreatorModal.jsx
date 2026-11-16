import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X, Plus, Trash2, ChevronRight, ChevronLeft, Award, Sparkles,
  Layers, Cpu, MapPin, CheckCircle, HelpCircle, FileText, Code,
  Sliders, Palette, ArrowRight, ShieldCheck, Globe, BookOpen,
  Gift, ScrollText, Wrench, UploadCloud, CheckCircle2, AlertTriangle,
  Code2, FileCode, Check, Info, Lock, Image as ImageIcon,
  Compass, ArrowUp, ArrowDown, Eye, RefreshCw
} from 'lucide-react';
import { createAdventureMap, updateAdventureMap } from '../../services/adventureMapService';
import { COMPONENTS } from '../../services/gamification/ComponentsConfig';
import { extractProjectMetaFromPng } from '../../utils/projectCompilerUtils';
import { buildEvaluationCriteriaFromMeta, buildDefaultScoring, generate3EvaluationTasks } from '../../utils/circuitCriteriaUtils';

export const ISLAND_PRESETS = [
  { id: 'island_led', label: 'Circuit Forest', file: '/gamification_images/island_led.png' },
  { id: 'island_rgb', label: 'Prism Crystal', file: '/gamification_images/island_rgb.png' },
  { id: 'island_buzzer', label: 'Sound Spire', file: '/gamification_images/island_buzzer.png' },
  { id: 'island_potentiometer', label: 'Dial Ridge', file: '/gamification_images/island_potentiometer.png' },
  { id: 'island_servo', label: 'Motor Workshop', file: '/gamification_images/island_servo.png' },
  { id: 'island_wifi', label: 'Cyber Tower', file: '/gamification_images/island_wifi.png' },
  { id: 'island_oled', label: 'Display Matrix', file: '/gamification_images/island_oled.png' },
  { id: 'island_relay', label: 'Power Station', file: '/gamification_images/island_relay.png' },
  { id: 'island_ultrasonic', label: 'Echo Valley', file: '/gamification_images/island_ultrasonic.png' },
  { id: 'island_temperature', label: 'Thermal Peak', file: '/gamification_images/island_temperature.png' },
  { id: 'island_esp32', label: 'IoT Outpost', file: '/gamification_images/island_esp32.png' },
  { id: 'island_cloud', label: 'Cloud Gateway', file: '/gamification_images/island_cloud.png' },
];

const PRESET_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];
const PRESET_TAGS = ['sensors', 'arduino', 'esp32', 'robotics', 'iot', 'c++', 'analog', 'pwm', 'i2c/spi', 'displays'];

const DEFAULT_CAMPAIGN = {
  title: '',
  description: '',
  board: 'arduino-uno',
  chipArchitecture: '8-BIT AVR RISC',
  campaignCode: 'COMM-01',
  badgeColor: '#10b981',
  tags: 'sensors, arduino, beginner',
};

const DEFAULT_CERTIFICATION = {
  enabled: true,
  title: 'Certified Embedded Systems Specialist',
  issuerName: 'OpenHW Community Studio',
  description: 'Awarded for exceptional mastery and successful completion of all world missions.',
  accentColor: '#6366f1',
  badgeIcon: 'Award'
};

const DEFAULT_WORLDS = [
  {
    id: 1,
    name: 'World 1: Circuit Basics',
    theme: 'Beginner',
    color: '#22c55e',
    islands: [
      {
        id: 1,
        name: 'LED Blink Island',
        theme: 'Beginner',
        color: '#22c55e',
        islandImage: '/gamification_images/island_led.png',
        missions: [
          {
            id: 'm1',
            slug: 'led-blink-mission',
            title: 'Blink an LED',
            subtitle: 'Hello World of Electronics',
            difficulty: 'beginner',
            xpReward: 100,
            islandImage: '/gamification_images/island_led.png',
            theory: {
              title: 'Introduction to Current and Voltage',
              contentMarkdown: 'Understand how electrons move through a forward-biased PN junction LED. Voltage represents electrical potential, while current is the actual rate of electron flow.',
              keyTakeaways: [
                'Voltage is electrical pressure (measured in Volts)',
                'Current flows from positive (Anode) to negative (Cathode)',
                'Current-limiting resistors protect LEDs from burning out'
              ]
            },
            quizQuestions: [
              {
                question: 'What is the purpose of a current-limiting resistor placed in series with an LED?',
                options: [
                  'Limits excess current to prevent burning out the LED',
                  'Increases circuit voltage to make the LED brighter',
                  'Generates an AC frequency signal for sound',
                  'Inverts the logic polarity of the digital pin'
                ],
                correctAnswer: 0,
                explanation: 'Without a current-limiting resistor, excess current destroys the LED immediately.'
              }
            ],
            componentsToUnlock: ['led', 'resistor'],
            guideSample: {
              title: 'Guided Lab: Wiring Pin 13 to an LED',
              instruction: '1. Connect Arduino Digital Pin 13 to one leg of a 220Ω resistor.\n2. Connect the other end of the resistor to the LED anode (longer leg).\n3. Connect the LED cathode (shorter leg) to Arduino GND pin.\n4. Upload the sample code below to verify.',
              starterCode: 'void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}'
            },
            projectMission: {
              title: 'Final Project: Precision Strobe Beacon',
              prompt: 'Build a circuit with an Arduino and LED that blinks continuously every 500ms. Make sure the LED is protected by a resistor and connected to Digital Pin 13.',
              tasks: [],
              solutionCircuit: {
                circuitPngBase64: '',
                circuitFileName: '',
                components: [],
                wires: [],
                code: '',
                summary: null
              }
            },
            evaluationCriteria: null,
            starterCode: ''
          }
        ]
      },
      {
        id: 2,
        name: 'RGB Light Island',
        theme: 'Beginner',
        color: '#3b82f6',
        islandImage: '/gamification_images/island_rgb.png',
        missions: [
          {
            id: 'm2',
            slug: 'rgb-mixing-mission',
            title: 'Color Mixer',
            subtitle: 'PWM Pulse Width Modulation',
            difficulty: 'beginner',
            xpReward: 120,
            islandImage: '/gamification_images/island_rgb.png',
            theory: {
              title: 'RGB Light Addition & Pulse Width Modulation',
              contentMarkdown: 'By modulating duty cycle frequencies on Red, Green, and Blue channels, any visible color in the optical spectrum can be synthesized.',
              keyTakeaways: [
                'PWM duty cycles range from 0 (0% on) to 255 (100% on)',
                'Combining Red and Green produces Yellow',
                'Common cathode RGB LEDs share a single ground connection'
              ]
            },
            quizQuestions: [
              {
                question: 'Which Arduino function outputs PWM signals on PWM-capable digital pins (~)?',
                options: ['digitalWrite()', 'analogWrite()', 'pwmWrite()', 'pulseOutput()'],
                correctAnswer: 1,
                explanation: 'analogWrite(pin, 0-255) generates PWM signals to control brightness or speed.'
              }
            ],
            componentsToUnlock: ['rgb-led'],
            guideSample: {
              title: 'Guided Lab: Smooth Color Transition',
              instruction: '1. Connect RGB Red pin to Pin 9, Green to Pin 10, and Blue to Pin 11 through 220Ω resistors.\n2. Connect the Common Cathode to GND.\n3. Run analogWrite cycles to test RGB spectrum blending.',
              starterCode: 'void setup() {\n  pinMode(9, OUTPUT);\n  pinMode(10, OUTPUT);\n  pinMode(11, OUTPUT);\n}\n\nvoid loop() {\n  analogWrite(9, 255); // Red\n  analogWrite(10, 0);\n  analogWrite(11, 128); // Purple\n  delay(1000);\n}'
            },
            projectMission: {
              title: 'Final Project: Dynamic RGB Mood Lamp',
              prompt: 'Wire up a Common Cathode RGB LED using pins 9, 10, and 11. Write code to cycle smoothly between red, green, and blue light.',
              tasks: [],
              solutionCircuit: {
                circuitPngBase64: '',
                circuitFileName: '',
                components: [],
                wires: [],
                code: '',
                summary: null
              }
            },
            evaluationCriteria: null,
            starterCode: ''
          }
        ]
      }
    ]
  }
];

export default function AdventureCreatorModal({
  isOpen,
  onClose,
  onCreated,
  onSaveSuccess,
  editingMap = null,
  classrooms = [],
  isTeacher = false,
  defaultClassroomId = '',
  lockClassroom = false
}) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Active navigation tabs in Step 2 & 3
  const [activeWorldTab, setActiveWorldTab] = useState(0);
  const [activeIslandTab, setActiveIslandTab] = useState(0);
  const [activeStageTab, setActiveStageTab] = useState('theory'); // 'theory' | 'quiz' | 'unlock' | 'guide' | 'project'
  const [theoryPreviewMode, setTheoryPreviewMode] = useState(false);
  const [componentSearch, setComponentSearch] = useState('');
  const [componentCategory, setComponentCategory] = useState('all');

  const fileInputRef = useRef(null);
  const guideFileInputRef = useRef(null);

  // Form State
  const [campaign, setCampaign] = useState(DEFAULT_CAMPAIGN);
  const [worlds, setWorlds] = useState(DEFAULT_WORLDS);
  const [certification, setCertification] = useState(DEFAULT_CERTIFICATION);
  const [selectedClassroomId, setSelectedClassroomId] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (editingMap) {
      setCampaign({
        title: editingMap.title || '',
        description: editingMap.description || '',
        board: editingMap.board || 'arduino-uno',
        chipArchitecture: editingMap.chipArchitecture || '8-BIT AVR RISC',
        campaignCode: editingMap.campaignCode || 'COMM-01',
        badgeColor: editingMap.badgeColor || '#10b981',
        tags: Array.isArray(editingMap.tags) ? editingMap.tags.join(', ') : (editingMap.tags || 'sensors, arduino, beginner'),
      });

      if (Array.isArray(editingMap.worlds) && editingMap.worlds.length > 0) {
        setWorlds(editingMap.worlds.map((w, wIdx) => ({
          ...w,
          id: w.id || wIdx + 1,
          name: w.name || `World ${wIdx + 1}`,
          theme: w.theme || 'Beginner',
          color: w.color || '#22c55e',
          islands: (w.islands || []).map((isl, iIdx) => ({
            ...isl,
            id: isl.id || iIdx + 1,
            name: isl.name || `Island ${iIdx + 1}`,
            theme: isl.theme || 'Beginner',
            color: isl.color || '#3b82f6',
            islandImage: isl.islandImage || '/gamification_images/island_led.png',
            missions: (isl.missions && isl.missions.length > 0) ? isl.missions : [
              {
                id: `m_${wIdx}_${iIdx}`,
                slug: `mission-${wIdx + 1}-${iIdx + 1}`,
                title: isl.name || 'Mission Challenge',
                subtitle: isl.theme || '',
                difficulty: 'beginner',
                xpReward: 100,
                islandImage: isl.islandImage || '/gamification_images/island_led.png',
                theory: isl.theory || { title: 'Theory Overview', contentMarkdown: '', keyTakeaways: [] },
                quizQuestions: isl.quizQuestions || [],
                componentsToUnlock: isl.componentsToUnlock || [],
                guideSample: isl.guideSample || { title: 'Guided Lab', instruction: '', starterCode: '', circuitPngBase64: '', circuitFileName: '' },
                projectMission: isl.projectMission || { title: 'Final Project', prompt: '', tasks: [], solutionCircuit: { circuitPngBase64: '', circuitFileName: '', components: [], wires: [], code: '' } },
                evaluationCriteria: isl.evaluationCriteria || null,
                starterCode: isl.starterCode || ''
              }
            ]
          }))
        })));
      } else if (Array.isArray(editingMap.islands) && editingMap.islands.length > 0) {
        setWorlds([
          {
            id: 1,
            name: `${editingMap.title || 'World 1'}`,
            theme: 'Beginner',
            color: editingMap.badgeColor || '#22c55e',
            islands: editingMap.islands.map((isl, iIdx) => ({
              ...isl,
              id: isl.id || iIdx + 1,
              name: isl.name || `Island ${iIdx + 1}`,
              theme: isl.theme || 'Beginner',
              color: isl.color || '#3b82f6',
              islandImage: isl.islandImage || '/gamification_images/island_led.png',
              missions: (isl.missions && isl.missions.length > 0) ? isl.missions : [
                {
                  id: `m_0_${iIdx}`,
                  slug: `mission-1-${iIdx + 1}`,
                  title: isl.name || 'Mission Challenge',
                  subtitle: isl.theme || '',
                  difficulty: 'beginner',
                  xpReward: 100,
                  islandImage: isl.islandImage || '/gamification_images/island_led.png',
                  theory: isl.theory || { title: 'Theory Overview', contentMarkdown: '', keyTakeaways: [] },
                  quizQuestions: isl.quizQuestions || [],
                  componentsToUnlock: isl.componentsToUnlock || [],
                  guideSample: isl.guideSample || { title: 'Guided Lab', instruction: '', starterCode: '', circuitPngBase64: '', circuitFileName: '' },
                  projectMission: isl.projectMission || { title: 'Final Project', prompt: '', tasks: [], solutionCircuit: { circuitPngBase64: '', circuitFileName: '', components: [], wires: [], code: '' } },
                  evaluationCriteria: isl.evaluationCriteria || null,
                  starterCode: isl.starterCode || ''
                }
              ]
            }))
          }
        ]);
      }

      if (editingMap.certification) {
        setCertification({
          enabled: editingMap.certification.enabled !== false,
          title: editingMap.certification.title || 'Certified Embedded Systems Specialist',
          issuerName: editingMap.certification.issuerName || 'OpenHW Community Studio',
          description: editingMap.certification.description || 'Awarded for exceptional mastery and successful completion of all world missions.',
          accentColor: editingMap.certification.accentColor || '#6366f1',
          badgeIcon: editingMap.certification.badgeIcon || 'Award'
        });
      }
      setSelectedClassroomId(editingMap.classroomId ? String(editingMap.classroomId) : (defaultClassroomId ? String(defaultClassroomId) : ''));
      setStep(1);
      setError(null);
      setActiveWorldTab(0);
      setActiveIslandTab(0);
      setActiveStageTab('theory');
    } else {
      setCampaign(DEFAULT_CAMPAIGN);
      setWorlds(DEFAULT_WORLDS);
      setCertification(DEFAULT_CERTIFICATION);
      setSelectedClassroomId(defaultClassroomId ? String(defaultClassroomId) : '');
      setStep(1);
      setError(null);
      setActiveWorldTab(0);
      setActiveIslandTab(0);
      setActiveStageTab('theory');
    }
  }, [isOpen, editingMap, defaultClassroomId]);

  if (!isOpen) return null;

  // Board Architecture auto-mapping
  const handleBoardChange = (board) => {
    let arch = '8-BIT AVR RISC';
    let code = 'AVR-COMM';
    let badgeColor = '#10b981';
    if (board === 'esp32') {
      arch = '32-BIT XTENSA DUAL-CORE';
      code = 'XT-COMM';
      badgeColor = '#f59e0b';
    } else if (board === 'raspberry-pi-pico') {
      arch = 'DUAL-CORE ARM CORTEX-M0+';
      code = 'RP-COMM';
      badgeColor = '#2563eb';
    } else if (board === 'stm32') {
      arch = '32-BIT ARM CORTEX-M4';
      code = 'STM-COMM';
      badgeColor = '#8b5cf6';
    }
    setCampaign({ ...campaign, board, chipArchitecture: arch, campaignCode: code, badgeColor });
  };

  // World helpers
  const addWorld = () => {
    const nextWorldId = worlds.length + 1;
    const defaultColor = nextWorldId === 2 ? '#3b82f6' : nextWorldId === 3 ? '#f97316' : '#8b5cf6';
    const newWorld = {
      id: nextWorldId,
      name: `World ${nextWorldId}: Advanced Circuits`,
      theme: 'Intermediate',
      color: defaultColor,
      islands: [
        {
          id: 1,
          name: 'Stage 1 Island',
          theme: 'Intermediate',
          color: defaultColor,
          islandImage: '/gamification_images/island_servo.png',
          missions: [
            {
              id: `w${nextWorldId}-m1`,
              slug: `world-${nextWorldId}-mission-1`,
              title: 'Module Milestone 1',
              subtitle: 'Hands-on Lab',
              difficulty: 'intermediate',
              xpReward: 150,
              islandImage: '/gamification_images/island_servo.png',
              theory: {
                title: 'Island Briefing',
                contentMarkdown: 'Understand the electronic principles and wiring logic for this milestone.',
                keyTakeaways: ['Always check polarity', 'Common ground connects all modules']
              },
              quizQuestions: [
                {
                  question: 'Why must all connected electronic modules share a common ground (GND)?',
                  options: [
                    'To establish a uniform 0V reference potential',
                    'To increase the system operating voltage',
                    'To reduce microcontroller clock speed',
                    'To invert digital logic states'
                  ],
                  correctAnswer: 0,
                  explanation: 'All voltage measurements are relative to ground (0V).'
                }
              ],
              componentsToUnlock: ['servo'],
              guideSample: {
                title: 'Guided Sample Walkthrough',
                instruction: '1. Connect signal line to digital pin.\n2. Connect power to 5V and ground to GND.\n3. Test with the starter sketch below.',
                starterCode: 'void setup() {\n  // Setup routine\n}\nvoid loop() {\n  // Main loop\n}'
              },
              projectMission: {
                title: 'Milestone Final Challenge',
                prompt: 'Construct the circuit and program your board to pass the verification criteria.',
                solutionCircuit: {
                  circuitPngBase64: '',
                  circuitFileName: '',
                  components: [],
                  wires: [],
                  code: '',
                  summary: null
                }
              },
              evaluationCriteria: null,
              starterCode: ''
            }
          ]
        }
      ]
    };
    setWorlds([...worlds, newWorld]);
    setActiveWorldTab(worlds.length);
    setActiveIslandTab(0);
  };

  const removeWorld = (wIdx) => {
    if (worlds.length <= 1) return;
    const updated = worlds.filter((_, i) => i !== wIdx);
    setWorlds(updated);
    setActiveWorldTab(prev => Math.min(prev, updated.length - 1));
    setActiveIslandTab(0);
  };

  const moveWorld = (wIdx, direction) => {
    const targetIdx = wIdx + direction;
    if (targetIdx < 0 || targetIdx >= worlds.length) return;
    const updated = [...worlds];
    const [moved] = updated.splice(wIdx, 1);
    updated.splice(targetIdx, 0, moved);
    setWorlds(updated);
    setActiveWorldTab(targetIdx);
  };

  const updateWorld = (wIdx, field, value) => {
    const updated = [...worlds];
    updated[wIdx][field] = value;
    setWorlds(updated);
  };

  // Island helpers (strictly up to 6 islands per world)
  const addIslandToWorld = (wIdx) => {
    const currentIslands = worlds[wIdx].islands || [];
    if (currentIslands.length >= 6) {
      setError(`World "${worlds[wIdx].name}" already has the maximum of 6 islands!`);
      return;
    }
    setError(null);
    const nextIslandNum = currentIslands.length + 1;
    const preset = ISLAND_PRESETS[(nextIslandNum - 1) % ISLAND_PRESETS.length];

    const newIsland = {
      id: nextIslandNum,
      name: `Island ${nextIslandNum}`,
      theme: worlds[wIdx].theme || 'Beginner',
      color: worlds[wIdx].color || '#3b82f6',
      islandImage: preset.file,
      missions: [
        {
          id: `w${worlds[wIdx].id}-i${nextIslandNum}-m1`,
          slug: `mission-${worlds[wIdx].id}-${nextIslandNum}-1`,
          title: `Mission ${nextIslandNum}`,
          subtitle: 'Circuit Challenge',
          difficulty: 'beginner',
          xpReward: 100,
          islandImage: preset.file,
          theory: {
            title: `Island ${nextIslandNum} Theory: Concepts & Wiring`,
            contentMarkdown: 'Understand how electronic signals flow through your sensors and actuators.',
            keyTakeaways: ['Verify connections before powering on', 'Use appropriate current limiting']
          },
          quizQuestions: [
            {
              question: 'What is the standard operating voltage for Arduino Uno digital I/O pins?',
              options: ['5 Volts', '12 Volts', '3.3 Volts', '24 Volts'],
              correctAnswer: 0,
              explanation: 'Arduino Uno uses 5V TTL logic levels on all digital pins.'
            }
          ],
          componentsToUnlock: ['potentiometer'],
          guideSample: {
            title: 'Guided Sample Lab',
            instruction: '1. Connect your input component to Analog Pin A0.\n2. Connect power lines to 5V and GND.\n3. Run analogRead() to observe live data.',
            starterCode: 'void setup() {\n  Serial.begin(9600);\n}\nvoid loop() {\n  int val = analogRead(A0);\n  Serial.println(val);\n  delay(200);\n}'
          },
          projectMission: {
            title: `Project: Island ${nextIslandNum} Mission Challenge`,
            prompt: 'Assemble your circuit and program your board to satisfy all mission objectives.',
            solutionCircuit: {
              circuitPngBase64: '',
              circuitFileName: '',
              components: [],
              wires: [],
              code: '',
              summary: null
            }
          },
          evaluationCriteria: null,
          starterCode: ''
        }
      ]
    };

    const updated = [...worlds];
    updated[wIdx].islands = [...currentIslands, newIsland];
    setWorlds(updated);
    setActiveIslandTab(updated[wIdx].islands.length - 1);
  };

  const removeIslandFromWorld = (wIdx, islIdx) => {
    const currentIslands = worlds[wIdx].islands || [];
    if (currentIslands.length <= 1) {
      setError('Each world must have at least 1 island.');
      return;
    }
    setError(null);
    const updated = [...worlds];
    updated[wIdx].islands = currentIslands.filter((_, i) => i !== islIdx);
    setWorlds(updated);
    setActiveIslandTab(prev => Math.min(prev, updated[wIdx].islands.length - 1));
  };

  const updateIslandInWorld = (wIdx, islIdx, field, value) => {
    const updated = [...worlds];
    updated[wIdx].islands[islIdx][field] = value;
    setWorlds(updated);
  };

  // Active mission getter & updater
  const getActiveMission = () => {
    const world = worlds[activeWorldTab];
    if (!world) return null;
    const island = world.islands?.[activeIslandTab];
    if (!island) return null;
    if (!island.missions || island.missions.length === 0) {
      island.missions = [{
        id: `w${world.id}-i${island.id}-m1`,
        slug: `mission-${world.id}-${island.id}-1`,
        title: island.name,
        subtitle: island.theme,
        difficulty: 'beginner',
        xpReward: 100,
        islandImage: island.islandImage,
        theory: { title: '', contentMarkdown: '', keyTakeaways: [] },
        quizQuestions: [],
        componentsToUnlock: [],
        guideSample: { title: '', instruction: '', starterCode: '' },
        projectMission: { title: '', prompt: '', solutionCircuit: {} },
        evaluationCriteria: null
      }];
    }
    return island.missions[0];
  };

  const updateActiveMissionField = (field, value) => {
    const updated = [...worlds];
    const mission = updated[activeWorldTab].islands[activeIslandTab].missions[0];
    mission[field] = value;
    setWorlds(updated);
  };

  const updateActiveMissionNested = (parentField, subField, value) => {
    const updated = [...worlds];
    const mission = updated[activeWorldTab].islands[activeIslandTab].missions[0];
    mission[parentField] = {
      ...(mission[parentField] || {}),
      [subField]: value
    };
    setWorlds(updated);
  };

  // Guide Reference Circuit PNG upload
  const handleGuidePngUpload = async (file) => {
    if (!file) return;
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      let extractedMeta = null;
      try {
        extractedMeta = extractProjectMetaFromPng(arrayBuffer);
      } catch {
        // Regular PNG image without metadata is completely fine too!
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64Url = reader.result;
        const updated = [...worlds];
        const mission = updated[activeWorldTab].islands[activeIslandTab].missions[0];

        const existingGuide = mission.guideSample || {};
        const code = extractedMeta?.code ||
          extractedMeta?.projectFiles?.['sketch.ino']?.content ||
          extractedMeta?.projectFiles?.['sketch.ino'] ||
          '';

        let autoInstructions = existingGuide.instruction;
        if (!autoInstructions && extractedMeta?.connections?.length) {
          autoInstructions = extractedMeta.connections.slice(0, 10).map((conn, idx) => {
            return `${idx + 1}. Connect ${conn.from} → ${conn.to}`;
          }).join('\n');
        }

        mission.guideSample = {
          ...existingGuide,
          circuitPngBase64: base64Url,
          circuitFileName: file.name,
          title: existingGuide.title || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
          instruction: autoInstructions || existingGuide.instruction,
          starterCode: existingGuide.starterCode || code
        };

        setWorlds(updated);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Guide PNG upload error:', err);
      setError('Failed to process guide circuit image.');
    }
  };

  // Teacher Circuit PNG upload decoder
  const handleTeacherPngUpload = async (file) => {
    if (!file) return;
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const meta = extractProjectMetaFromPng(arrayBuffer);
      const criteria = buildEvaluationCriteriaFromMeta(meta);
      const scoring = buildDefaultScoring(criteria);

      const reader = new FileReader();
      reader.onload = () => {
        const base64Url = reader.result;
        const code = meta.code ||
          meta.projectFiles?.['sketch.ino']?.content ||
          meta.projectFiles?.['sketch.ino'] ||
          meta.projectFiles?.['main.ino']?.content ||
          meta.projectFiles?.['main.ino'] ||
          (meta.projectFiles ? Object.values(meta.projectFiles)[0]?.content : '') ||
          '';

        const updated = [...worlds];
        const mission = updated[activeWorldTab].islands[activeIslandTab].missions[0];

        const tasks = generate3EvaluationTasks({
          components: meta.components || [],
          connections: meta.connections || [],
          code,
          prompt: mission.projectMission?.prompt || ''
        });

        mission.projectMission = {
          ...(mission.projectMission || {}),
          tasks,
          solutionCircuit: {
            circuitPngBase64: base64Url,
            circuitFileName: file.name,
            components: meta.components || [],
            wires: meta.connections || [],
            code,
            summary: {
              componentCount: (meta.components || []).length,
              wireCount: (meta.connections || []).length,
              codeLines: code ? code.split('\n').length : 0,
              componentNames: (meta.components || []).map(c => c.type?.replace(/^(?:openhw|wokwi)[-_]/, '')).filter(Boolean)
            }
          }
        };

        mission.evaluationCriteria = { ...criteria, scoring };
        if (code && !mission.starterCode) {
          mission.starterCode = code;
        }

        setWorlds(updated);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('PNG solution extraction error:', err);
      setError('This PNG does not contain OpenHW Studio circuit metadata. Please export the circuit PNG directly from the OpenHW Studio simulator.');
    }
  };

  // Submit Handler
  const handleSubmit = async () => {
    setError(null);
    if (!campaign.title.trim()) {
      setError('Please provide a campaign title.');
      setStep(1);
      return;
    }

    try {
      setSubmitting(true);
      const tagList = campaign.tags
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);

      const sanitizedWorlds = worlds.map(w => ({
        ...w,
        islands: (w.islands || []).map(isl => ({
          ...isl,
          missions: (isl.missions || []).map(m => {
            const sol = m.projectMission?.solutionCircuit;
            const ec = m.evaluationCriteria || {};
            const existingTasks = m.projectMission?.tasks;
            let finalTasks = Array.isArray(existingTasks) && existingTasks.length === 3 ? existingTasks : null;
            if (!finalTasks) {
              finalTasks = generate3EvaluationTasks({
                components: sol?.components || (ec.components?.required || []).map(r => ({ type: r.type, count: r.count })),
                connections: sol?.wires || ec.wiringAccuracy?.requiredConnections || [],
                code: sol?.code || m.starterCode || m.guideSample?.starterCode || '',
                prompt: m.projectMission?.prompt || m.description || ''
              });
            }
            return {
              ...m,
              projectMission: {
                ...(m.projectMission || {}),
                tasks: finalTasks
              }
            };
          })
        }))
      }));

      const flatIslands = [];
      sanitizedWorlds.forEach(w => {
        (w.islands || []).forEach(isl => {
          flatIslands.push(isl);
        });
      });

      const payload = {
        title: campaign.title,
        description: campaign.description,
        board: campaign.board,
        chipArchitecture: campaign.chipArchitecture,
        campaignCode: campaign.campaignCode,
        badgeColor: campaign.badgeColor,
        worlds: sanitizedWorlds,
        islands: flatIslands,
        certification,
        tags: tagList,
        ...(selectedClassroomId
          ? { classroomId: selectedClassroomId, isPublic: false }
          : { isPublic: true }
        ),
      };

      let result;
      if (editingMap && (editingMap._id || editingMap.id)) {
        result = await updateAdventureMap(editingMap._id || editingMap.id, payload);
      } else {
        result = await createAdventureMap(payload);
      }
      setSubmitting(false);
      const savedMap = result.map || result;
      if (onCreated) onCreated(savedMap);
      if (onSaveSuccess) onSaveSuccess(savedMap);
      onClose();
    } catch (err) {
      setSubmitting(false);
      setError(err.message || (editingMap ? 'Failed to update adventure map' : 'Failed to publish adventure map'));
    }
  };

  const currentActiveWorld = worlds[activeWorldTab] || worlds[0];
  const currentActiveIsland = currentActiveWorld?.islands?.[activeIslandTab] || currentActiveWorld?.islands?.[0];
  const currentActiveMission = getActiveMission();

  // Helper to toggle component unlock selection
  const toggleUnlockComponent = (compId) => {
    if (!currentActiveMission) return;
    const currentList = currentActiveMission.componentsToUnlock || [];
    const exists = currentList.includes(compId);
    const updated = exists ? currentList.filter(id => id !== compId) : [...currentList, compId];
    updateActiveMissionField('componentsToUnlock', updated);
  };

  // Calculated metrics
  const totalIslands = useMemo(() => {
    return worlds.reduce((acc, w) => acc + (w.islands?.length || 0), 0);
  }, [worlds]);

  const totalXP = useMemo(() => {
    return worlds.reduce((acc, w) => {
      return acc + (w.islands || []).reduce((iAcc, isl) => {
        return iAcc + (isl.missions?.[0]?.xpReward || 100);
      }, 0);
    }, 0);
  }, [worlds]);

  const filteredComponents = useMemo(() => {
    return COMPONENTS.filter(c => {
      const matchCat = componentCategory === 'all' || (c.category || '').toLowerCase() === componentCategory.toLowerCase();
      const matchQ = !componentSearch.trim() || c.name.toLowerCase().includes(componentSearch.toLowerCase()) || c.id.toLowerCase().includes(componentSearch.toLowerCase());
      return matchCat && matchQ;
    });
  }, [componentCategory, componentSearch]);

  const activeClassroomObj = classrooms.find(c => String(c._id || c.id) === String(selectedClassroomId));
  const classroomTitle = activeClassroomObj ? (activeClassroomObj.name || activeClassroomObj.title) : 'Specific Classroom';

  const stepsList = [
    { num: 1, label: 'Overview', icon: Compass, title: 'Campaign Setup' },
    { num: 2, label: 'Worlds & Islands', icon: Globe, title: 'Worlds & Island Architect' },
    { num: 3, label: '5-Stage Studio', icon: Layers, title: '5-Stage Island Studio' },
    { num: 4, label: 'Certification', icon: Award, title: 'Credential Studio' }
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 99999,
      backgroundColor: 'var(--bg, #f8fafc)',
      color: 'var(--text, #0f172a)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      margin: 0,
      padding: 0
    }}>
      {/* ── 1. STUDIO APP BAR (FULL WIDTH) ── */}
      <header style={{
        flexShrink: 0,
        height: '66px',
        padding: '0 24px',
        backgroundColor: 'var(--card, #ffffff)',
        borderBottom: '1px solid var(--border, #e2e8f0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px',
        zIndex: 10
      }}>
        {/* Left: Exit & Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '280px' }}>
          <button
            type="button"
            onClick={onClose}
            title="Exit Adventure Studio"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg2, #f1f5f9)',
              border: '1px solid var(--border, #cbd5e1)',
              color: 'var(--text, #0f172a)',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'background 0.15s'
            }}
          >
            <ChevronLeft size={16} /> Exit Studio
          </button>

          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border, #cbd5e1)' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '900', color: '#4f46e5', letterSpacing: '0.04em' }}>
                OPENHW STUDIO
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: '800',
                textTransform: 'uppercase',
                padding: '2px 6px',
                borderRadius: '6px',
                backgroundColor: campaign.badgeColor || '#10b981',
                color: '#ffffff'
              }}>
                {campaign.board?.toUpperCase() || 'HARDWARE'}
              </span>
            </div>
            <div style={{
              fontSize: '14px',
              fontWeight: '800',
              color: 'var(--text, #0f172a)',
              maxWidth: '300px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {campaign.title || 'Untitled Adventure Map'}
            </div>
          </div>
        </div>

        {/* Center: Stepper Navigator Tabs */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: 'var(--bg2, #f1f5f9)',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid var(--border, #e2e8f0)'
        }}>
          {stepsList.map(s => {
            const active = step === s.num;
            const completed = step > s.num;
            const Icon = s.icon;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setStep(s.num)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '9px',
                  border: 'none',
                  backgroundColor: active ? 'var(--card, #ffffff)' : 'transparent',
                  color: active ? '#4f46e5' : 'var(--text2, #64748b)',
                  fontWeight: active ? '800' : '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: active ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: active ? '#4f46e5' : completed ? '#10b981' : 'var(--border, #cbd5e1)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: '900'
                }}>
                  {completed ? '✓' : s.num}
                </div>
                <span>{s.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Summary Stats & Fast Publish Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 12px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg2, #f1f5f9)',
            fontSize: '12px',
            fontWeight: '700',
            color: 'var(--text2, #475569)'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Globe size={13} style={{ color: '#6366f1' }} /> {worlds.length} Worlds
            </span>
            <span>•</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Layers size={13} style={{ color: '#0ea5e9' }} /> {totalIslands} Islands
            </span>
            <span>•</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={13} style={{ color: '#eab308' }} /> {totalXP} XP
            </span>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 20px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #059669, #047857)',
              border: 'none',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '800',
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
              transition: 'opacity 0.15s ease'
            }}
          >
            {submitting ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={15} />}
            <span>{submitting ? 'Saving...' : (editingMap ? 'Save & Update' : 'Publish Map')}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Close"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text2, #64748b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* ── 2. ERROR NOTIFICATION ── */}
      {error && (
        <div style={{
          padding: '12px 32px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#dc2626',
          fontSize: '13px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: '800' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── 3. MAIN WORKSPACE VIEWPORT (TOUCHING ALL SIDES) ── */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        backgroundColor: 'var(--bg, #f8fafc)',
        padding: '24px 32px'
      }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', width: '100%' }}>

          {/* ═════════════════════════════════════════════════════════
              STEP 1: CAMPAIGN OVERVIEW (SPACIOUS 2-COLUMN STUDIO)
             ═════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(500px, 1.4fr) minmax(360px, 1fr)',
              gap: '28px',
              alignItems: 'start'
            }}>
              {/* Left Column: Form Configuration */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Card 1: Identity & Board */}
                <div style={{
                  padding: '24px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--card, #ffffff)',
                  border: '1px solid var(--border, #e2e8f0)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px'
                }}>
                  <div style={{ borderBottom: '1px solid var(--border, #f1f5f9)', paddingBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                      Campaign Identity & Hardware Platform
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text2, #64748b)' }}>
                      Set the core title and choose the microcontroller architecture for this learning path.
                    </p>
                  </div>

                  {/* Title */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '8px' }}>
                      Campaign Title *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Master Arduino & Embedded C Architecture"
                      value={campaign.title}
                      onChange={(e) => setCampaign({ ...campaign, title: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg, #f8fafc)',
                        border: '1.5px solid var(--border, #cbd5e1)',
                        color: 'var(--text, #0f172a)',
                        fontSize: '15px',
                        fontWeight: '700',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Hardware Board & Architecture */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '8px' }}>
                        Hardware Board Target
                      </label>
                      <select
                        value={campaign.board}
                        onChange={(e) => handleBoardChange(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--bg, #f8fafc)',
                          border: '1.5px solid var(--border, #cbd5e1)',
                          color: 'var(--text, #0f172a)',
                          fontSize: '13px',
                          fontWeight: '700',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="arduino-uno">Arduino Uno (AVR ATmega328P)</option>
                        <option value="esp32">ESP32 DevKit (Xtensa Dual-Core 240MHz)</option>
                        <option value="raspberry-pi-pico">Raspberry Pi Pico (RP2040 Dual-Core)</option>
                        <option value="stm32">STM32 Nucleo (ARM Cortex-M4)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '8px' }}>
                        Theme Accent Color
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="color"
                          value={campaign.badgeColor}
                          onChange={(e) => setCampaign({ ...campaign, badgeColor: e.target.value })}
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '10px',
                            border: '1px solid var(--border, #cbd5e1)',
                            cursor: 'pointer',
                            padding: '0'
                          }}
                        />
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {PRESET_COLORS.map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setCampaign({ ...campaign, badgeColor: c })}
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '6px',
                                backgroundColor: c,
                                border: campaign.badgeColor === c ? '2px solid #0f172a' : 'none',
                                cursor: 'pointer'
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Narrative & Discovery */}
                <div style={{
                  padding: '24px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--card, #ffffff)',
                  border: '1px solid var(--border, #e2e8f0)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px'
                }}>
                  <div style={{ borderBottom: '1px solid var(--border, #f1f5f9)', paddingBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                      Course Narrative & Tag Discovery
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text2, #64748b)' }}>
                      Provide an engaging summary of what learners will accomplish in this world.
                    </p>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '8px' }}>
                      Campaign Description
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Describe the skills, electronics concepts, and hands-on circuits students will construct in this journey..."
                      value={campaign.description}
                      onChange={(e) => setCampaign({ ...campaign, description: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg, #f8fafc)',
                        border: '1.5px solid var(--border, #cbd5e1)',
                        color: 'var(--text, #0f172a)',
                        fontSize: '13px',
                        lineHeight: '1.5',
                        outline: 'none',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text2, #475569)' }}>
                        Tags (comma separated)
                      </label>
                      <span style={{ fontSize: '11px', color: 'var(--text3, #94a3b8)' }}>Click preset tags below to add</span>
                    </div>

                    <input
                      type="text"
                      placeholder="sensors, robotics, wifi, analog"
                      value={campaign.tags}
                      onChange={(e) => setCampaign({ ...campaign, tags: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg, #f8fafc)',
                        border: '1.5px solid var(--border, #cbd5e1)',
                        color: 'var(--text, #0f172a)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />

                    {/* Quick Tag Pills */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                      {PRESET_TAGS.map(t => {
                        const hasTag = campaign.tags.toLowerCase().includes(t.toLowerCase());
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              if (hasTag) return;
                              const current = campaign.tags.trim();
                              setCampaign({
                                ...campaign,
                                tags: current ? `${current}, ${t}` : t
                              });
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '20px',
                              border: hasTag ? '1px solid #6366f1' : '1px solid var(--border, #cbd5e1)',
                              backgroundColor: hasTag ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg, #f8fafc)',
                              color: hasTag ? '#4f46e5' : 'var(--text2, #64748b)',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            + {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Card 3: Classroom Scoping (Teacher Only) */}
                {isTeacher && (
                  <div style={{
                    padding: '24px',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(99, 102, 241, 0.04)',
                    border: '1.5px solid rgba(99, 102, 241, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(99, 102, 241, 0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#4f46e5'
                        }}>
                          <BookOpen size={18} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                            Classroom Exclusivity (Teacher Feature)
                          </h4>
                          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text2, #64748b)' }}>
                            Restrict this map so only students enrolled in a specific class can see and play it.
                          </p>
                        </div>
                      </div>

                      <span style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        backgroundColor: selectedClassroomId ? '#4f46e5' : 'rgba(99, 102, 241, 0.12)',
                        color: selectedClassroomId ? '#ffffff' : '#4f46e5'
                      }}>
                        {selectedClassroomId ? 'Classroom Exclusive' : 'Public World'}
                      </span>
                    </div>

                    {lockClassroom ? (
                      <div style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(79, 70, 229, 0.08)',
                        border: '1px solid rgba(79, 70, 229, 0.25)',
                        color: 'var(--text, #0f172a)',
                        fontSize: '13px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span>🎓 Classroom: <b>{classroomTitle}</b></span>
                        <span style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 800 }}>🔒 Locked to this class</span>
                      </div>
                    ) : (
                      <select
                        value={selectedClassroomId}
                        onChange={(e) => setSelectedClassroomId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--card, #ffffff)',
                          border: '1.5px solid var(--border, #cbd5e1)',
                          color: 'var(--text, #0f172a)',
                          fontSize: '13px',
                          fontWeight: '700',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">🌐 Public — Visible to all OpenHW learners in explore catalog</option>
                        {classrooms.map((cls) => {
                          const id = cls._id || cls.id;
                          const title = cls.name || cls.title || 'Untitled Classroom';
                          const subject = cls.subject ? ` (${cls.subject})` : '';
                          return (
                            <option key={id} value={id}>
                              🎓 Classroom: {title}{subject}
                            </option>
                          );
                        })}
                      </select>
                    )}

                    {selectedClassroomId && (
                      <p style={{ margin: 0, fontSize: '11px', color: '#4f46e5', fontWeight: '600' }}>
                        📢 An automatic announcement & notification will be sent to all enrolled students when this map is published.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Live Learner View Card Preview */}
              <div style={{
                position: 'sticky',
                top: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--text2, #64748b)',
                  fontSize: '12px',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  <Eye size={15} style={{ color: '#6366f1' }} /> Live Learner Portal Preview
                </div>

                <div style={{
                  padding: '24px',
                  borderRadius: '20px',
                  backgroundColor: 'var(--card, #ffffff)',
                  border: '1.5px solid rgba(99, 102, 241, 0.3)',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  {/* Top Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      backgroundColor: campaign.badgeColor || '#10b981',
                      color: '#ffffff',
                      letterSpacing: '0.5px'
                    }}>
                      {campaign.board?.toUpperCase() || 'HARDWARE'}
                    </span>

                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: selectedClassroomId ? '#4f46e5' : '#0284c7',
                      backgroundColor: selectedClassroomId ? 'rgba(79, 70, 229, 0.1)' : 'rgba(2, 132, 199, 0.1)',
                      padding: '3px 8px',
                      borderRadius: '6px'
                    }}>
                      {selectedClassroomId ? '🔒 Class Exclusive' : '🌐 Public Journey'}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                      {campaign.title || 'Master Arduino & Embedded C Architecture'}
                    </h3>
                    <p style={{
                      margin: 0,
                      fontSize: '13px',
                      color: 'var(--text2, #64748b)',
                      lineHeight: '1.5',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {campaign.description || 'Design circuits, program embedded microcontrollers, and master electronic systems through interactive 5-stage quests.'}
                    </p>
                  </div>

                  {/* Architecture spec */}
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg2, #f1f5f9)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: 'var(--text2, #475569)'
                  }}>
                    <Cpu size={14} style={{ color: campaign.badgeColor || '#10b981' }} />
                    <span>Arch: <b>{campaign.chipArchitecture}</b></span>
                  </div>

                  {/* Stats & Launch Preview */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border, #f1f5f9)'
                  }}>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontWeight: '700', color: 'var(--text2, #64748b)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Layers size={13} style={{ color: '#6366f1' }} /> {worlds.length} Worlds • {totalIslands} Missions
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Sparkles size={13} style={{ color: '#eab308' }} /> {totalXP} XP
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--primary, #4f46e5)',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: '800',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: 0.9,
                      cursor: 'default'
                    }}
                  >
                    🚀 Enter World Expedition
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════
              STEP 2: WORLDS & ISLAND ARCHITECT (WIDE STUDIO 2-COL)
             ═════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '360px 1fr',
              gap: '24px',
              alignItems: 'start'
            }}>
              {/* Left Column: Worlds Navigation Tree */}
              <div style={{
                backgroundColor: 'var(--card, #ffffff)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: '16px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                    Worlds Hierarchy
                  </h3>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#6366f1' }}>
                    {worlds.length} Worlds Total
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text2, #64748b)', lineHeight: '1.4' }}>
                  Each world groups up to <b>6 floating islands</b>. Select a world to edit its details and manage its island fleet.
                </p>

                {/* Worlds Cards List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {worlds.map((w, wIdx) => {
                    const isSelected = activeWorldTab === wIdx;
                    return (
                      <div
                        key={w.id}
                        onClick={() => { setActiveWorldTab(wIdx); setActiveIslandTab(0); setError(null); }}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: isSelected ? '2px solid #4f46e5' : '1px solid var(--border, #e2e8f0)',
                          backgroundColor: isSelected ? 'rgba(79, 70, 229, 0.05)' : 'var(--bg, #f8fafc)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            backgroundColor: w.color || '#22c55e',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: '900',
                            flexShrink: 0
                          }}>
                            {wIdx + 1}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontSize: '13px',
                              fontWeight: '800',
                              color: isSelected ? '#4f46e5' : 'var(--text, #0f172a)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {w.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text2, #64748b)' }}>
                              {w.islands?.length || 0}/6 Islands • {w.theme || 'Beginner'}
                            </div>
                          </div>
                        </div>

                        {/* Order Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            disabled={wIdx === 0}
                            onClick={() => moveWorld(wIdx, -1)}
                            title="Move World Up"
                            style={{
                              padding: '4px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: wIdx === 0 ? 'var(--border, #cbd5e1)' : 'var(--text2, #64748b)',
                              cursor: wIdx === 0 ? 'default' : 'pointer'
                            }}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={wIdx === worlds.length - 1}
                            onClick={() => moveWorld(wIdx, 1)}
                            title="Move World Down"
                            style={{
                              padding: '4px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: wIdx === worlds.length - 1 ? 'var(--border, #cbd5e1)' : 'var(--text2, #64748b)',
                              cursor: wIdx === worlds.length - 1 ? 'default' : 'pointer'
                            }}
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={addWorld}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    border: '1px dashed #6366f1',
                    color: '#4f46e5',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Plus size={15} /> Add Another World
                </button>
              </div>

              {/* Right Column: Active World & Island Fleet */}
              {currentActiveWorld && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* World Configuration Card */}
                  <div style={{
                    padding: '24px',
                    borderRadius: '16px',
                    backgroundColor: 'var(--card, #ffffff)',
                    border: '1px solid var(--border, #e2e8f0)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                        Editing: {currentActiveWorld.name}
                      </h3>
                      {worlds.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeWorld(activeWorldTab)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#ef4444',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Trash2 size={13} /> Delete World
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          World Title
                        </label>
                        <input
                          type="text"
                          value={currentActiveWorld.name}
                          onChange={(e) => updateWorld(activeWorldTab, 'name', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg, #f8fafc)',
                            border: '1px solid var(--border, #cbd5e1)',
                            color: 'var(--text, #0f172a)',
                            fontSize: '13px',
                            fontWeight: '700',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Difficulty Theme
                        </label>
                        <input
                          type="text"
                          value={currentActiveWorld.theme}
                          onChange={(e) => updateWorld(activeWorldTab, 'theme', e.target.value)}
                          placeholder="Beginner / Intermediate"
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg, #f8fafc)',
                            border: '1px solid var(--border, #cbd5e1)',
                            color: 'var(--text, #0f172a)',
                            fontSize: '13px',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          World Color
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="color"
                            value={currentActiveWorld.color || '#22c55e'}
                            onChange={(e) => updateWorld(activeWorldTab, 'color', e.target.value)}
                            style={{ width: '40px', height: '40px', borderRadius: '8px', border: 'none', cursor: 'pointer', padding: '0' }}
                          />
                          <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: '700', color: 'var(--text2, #64748b)' }}>
                            {currentActiveWorld.color}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Islands Fleet Grid */}
                  <div style={{
                    padding: '24px',
                    borderRadius: '16px',
                    backgroundColor: 'var(--card, #ffffff)',
                    border: '1px solid var(--border, #e2e8f0)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '18px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                          Floating Islands in {currentActiveWorld.name}
                        </h4>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text2, #64748b)' }}>
                          Up to 6 islands per world. Each island represents a 5-stage milestone quest.
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          color: (currentActiveWorld.islands?.length || 0) >= 6 ? '#dc2626' : '#4f46e5',
                          backgroundColor: (currentActiveWorld.islands?.length || 0) >= 6 ? 'rgba(239,68,68,0.1)' : 'rgba(79,70,229,0.08)',
                          padding: '4px 10px',
                          borderRadius: '8px'
                        }}>
                          {currentActiveWorld.islands?.length || 0} / 6 Islands Max
                        </span>

                        <button
                          type="button"
                          onClick={() => addIslandToWorld(activeWorldTab)}
                          disabled={(currentActiveWorld.islands?.length || 0) >= 6}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '10px',
                            backgroundColor: (currentActiveWorld.islands?.length || 0) >= 6 ? 'var(--border, #cbd5e1)' : '#4f46e5',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: '800',
                            cursor: (currentActiveWorld.islands?.length || 0) >= 6 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Plus size={15} /> Add Island
                        </button>
                      </div>
                    </div>

                    {/* Island Cards Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: '16px'
                    }}>
                      {currentActiveWorld.islands?.map((island, islIdx) => (
                        <div
                          key={island.id}
                          style={{
                            padding: '16px',
                            borderRadius: '14px',
                            backgroundColor: 'var(--bg, #f8fafc)',
                            border: '1.5px solid var(--border, #e2e8f0)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {/* Island Header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: island.color || '#2563eb',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: '900'
                              }}>
                                {islIdx + 1}
                              </span>
                              <input
                                type="text"
                                value={island.name}
                                onChange={(e) => updateIslandInWorld(activeWorldTab, islIdx, 'name', e.target.value)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  borderBottom: '1px solid var(--border, #cbd5e1)',
                                  color: 'var(--text, #0f172a)',
                                  fontSize: '13px',
                                  fontWeight: '800',
                                  outline: 'none',
                                  width: '150px'
                                }}
                              />
                            </div>

                            {currentActiveWorld.islands?.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeIslandFromWorld(activeWorldTab, islIdx)}
                                title="Remove Island"
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>

                          {/* Island Visual Graphic & Sprite Selector */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <img
                              src={island.islandImage}
                              alt={island.name}
                              style={{
                                width: '56px',
                                height: '56px',
                                objectFit: 'contain',
                                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.12))'
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '4px' }}>
                                3D Island Sprite
                              </label>
                              <select
                                value={island.islandImage}
                                onChange={(e) => updateIslandInWorld(activeWorldTab, islIdx, 'islandImage', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  borderRadius: '8px',
                                  backgroundColor: 'var(--card, #ffffff)',
                                  border: '1px solid var(--border, #cbd5e1)',
                                  color: 'var(--text, #0f172a)',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  outline: 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                {ISLAND_PRESETS.map(p => (
                                  <option key={p.id} value={p.file}>{p.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Shortcut to 5-Stage Studio */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveWorldTab(activeWorldTab);
                              setActiveIslandTab(islIdx);
                              setStep(3);
                            }}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--card, #ffffff)',
                              border: '1px solid var(--border, #cbd5e1)',
                              color: '#4f46e5',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              marginTop: '4px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Layers size={13} /> Edit 5-Stage Curriculum →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════
              STEP 3: 5-STAGE ISLAND STUDIO (SPLIT STUDIO WORKSPACE)
             ═════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '320px 1fr',
              gap: '24px',
              alignItems: 'start'
            }}>
              {/* Left Column: Island Navigator & 5-Stage Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* World & Island Selector Card */}
                <div style={{
                  padding: '20px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--card, #ffffff)',
                  border: '1px solid var(--border, #e2e8f0)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}>
                  <div style={{ borderBottom: '1px solid var(--border, #f1f5f9)', paddingBottom: '10px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '4px' }}>
                      Active World
                    </label>
                    <select
                      value={activeWorldTab}
                      onChange={(e) => {
                        setActiveWorldTab(Number(e.target.value));
                        setActiveIslandTab(0);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg, #f8fafc)',
                        border: '1px solid var(--border, #cbd5e1)',
                        color: 'var(--text, #0f172a)',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      {worlds.map((w, idx) => (
                        <option key={w.id} value={idx}>{w.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                      Select Island in World
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {currentActiveWorld?.islands?.map((isl, idx) => {
                        const isSel = activeIslandTab === idx;
                        return (
                          <button
                            key={isl.id}
                            type="button"
                            onClick={() => setActiveIslandTab(idx)}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '10px',
                              border: isSel ? '2px solid #4f46e5' : '1px solid var(--border, #e2e8f0)',
                              backgroundColor: isSel ? 'rgba(79, 70, 229, 0.08)' : 'var(--bg, #f8fafc)',
                              color: isSel ? '#4f46e5' : 'var(--text, #0f172a)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              fontSize: '12px',
                              fontWeight: isSel ? '800' : '600',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <img src={isl.islandImage} alt={isl.name} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {idx + 1}. {isl.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 5-Stage Progress Checklist */}
                {currentActiveIsland && currentActiveMission && (
                  <div style={{
                    padding: '20px',
                    borderRadius: '16px',
                    backgroundColor: 'var(--card, #ffffff)',
                    border: '1px solid var(--border, #e2e8f0)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                      5-Stage Roadmap Checklist
                    </h4>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text2, #64748b)' }}>
                      Every island must cover all 5 pedagogical stages.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {[
                        { key: 'theory', num: 1, label: 'Theory Briefing', icon: BookOpen, color: '#3b82f6', done: Boolean(currentActiveMission.theory?.contentMarkdown) },
                        { key: 'quiz', num: 2, label: 'Interactive Quiz', icon: HelpCircle, color: '#8b5cf6', done: (currentActiveMission.quizQuestions || []).length > 0 },
                        { key: 'unlock', num: 3, label: 'Unlock Hardware', icon: Gift, color: '#ec4899', done: (currentActiveMission.componentsToUnlock || []).length > 0 },
                        { key: 'guide', num: 4, label: 'Guided Lab Sample', icon: ScrollText, color: '#10b981', done: Boolean(currentActiveMission.guideSample?.starterCode) },
                        { key: 'project', num: 5, label: 'Project Challenge', icon: Wrench, color: '#f59e0b', done: Boolean(currentActiveMission.projectMission?.solutionCircuit?.circuitFileName) }
                      ].map(stg => {
                        const isCurrent = activeStageTab === stg.key;
                        const Icon = stg.icon;
                        return (
                          <button
                            key={stg.key}
                            type="button"
                            onClick={() => setActiveStageTab(stg.key)}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '10px',
                              border: isCurrent ? `2px solid ${stg.color}` : '1px solid var(--border, #e2e8f0)',
                              backgroundColor: isCurrent ? `${stg.color}15` : 'var(--bg, #f8fafc)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '6px',
                                backgroundColor: isCurrent ? stg.color : 'rgba(0,0,0,0.06)',
                                color: isCurrent ? '#ffffff' : 'var(--text2, #64748b)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <Icon size={12} />
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: isCurrent ? '800' : '600', color: isCurrent ? stg.color : 'var(--text, #0f172a)' }}>
                                {stg.num}. {stg.label}
                              </span>
                            </div>

                            {stg.done ? (
                              <CheckCircle2 size={16} color="#10b981" />
                            ) : (
                              <span style={{ fontSize: '10px', color: 'var(--text3, #94a3b8)', fontWeight: '700' }}>Pending</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Stage Content Editor */}
              {currentActiveIsland && currentActiveMission && (
                <div style={{
                  padding: '28px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--card, #ffffff)',
                  border: '1px solid var(--border, #e2e8f0)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px'
                }}>
                  {/* Island Title Banner */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border, #f1f5f9)', paddingBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <img src={currentActiveIsland.islandImage} alt={currentActiveIsland.name} style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                      <div>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                          {currentActiveIsland.name}
                        </h3>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text2, #64748b)' }}>
                          {currentActiveWorld.name} • Island #{activeIslandTab + 1}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text2, #475569)' }}>
                        XP Reward:
                      </label>
                      <input
                        type="number"
                        value={currentActiveMission.xpReward || 100}
                        onChange={(e) => updateActiveMissionField('xpReward', Number(e.target.value))}
                        style={{
                          width: '80px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg, #f8fafc)',
                          border: '1.5px solid var(--border, #cbd5e1)',
                          color: '#ea580c',
                          fontSize: '13px',
                          fontWeight: '800',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  {/* ── STAGE 1: THEORY ── */}
                  {activeStageTab === 'theory' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <BookOpen size={18} color="#3b82f6" />
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                            Stage 1: Electronic Theory & Physics Briefing
                          </h4>
                        </div>

                        <button
                          type="button"
                          onClick={() => setTheoryPreviewMode(!theoryPreviewMode)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            backgroundColor: theoryPreviewMode ? '#3b82f6' : 'var(--bg2, #f1f5f9)',
                            color: theoryPreviewMode ? '#ffffff' : 'var(--text2, #475569)',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Eye size={13} /> {theoryPreviewMode ? 'Edit Mode' : 'Preview Formatted'}
                        </button>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Lesson Briefing Title
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Current, Voltage and LED Polarity Fundamentals"
                          value={currentActiveMission.theory?.title || ''}
                          onChange={(e) => updateActiveMissionNested('theory', 'title', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg, #f8fafc)',
                            border: '1px solid var(--border, #cbd5e1)',
                            color: 'var(--text, #0f172a)',
                            fontSize: '14px',
                            fontWeight: '700',
                            outline: 'none'
                          }}
                        />
                      </div>

                      {theoryPreviewMode ? (
                        <div style={{
                          padding: '16px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--bg, #f8fafc)',
                          border: '1px solid var(--border, #cbd5e1)',
                          minHeight: '160px',
                          lineHeight: '1.6',
                          fontSize: '13px',
                          color: 'var(--text, #0f172a)'
                        }}>
                          {currentActiveMission.theory?.contentMarkdown ? (
                            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                              {currentActiveMission.theory.contentMarkdown}
                            </p>
                          ) : (
                            <span style={{ color: 'var(--text3, #94a3b8)', fontStyle: 'italic' }}>
                              No theory content written yet.
                            </span>
                          )}
                        </div>
                      ) : (
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                            Theory Markdown Content
                          </label>
                          <textarea
                            rows={8}
                            placeholder="Explain what the circuit does, how current flows, and important physics/hardware formulas..."
                            value={currentActiveMission.theory?.contentMarkdown || ''}
                            onChange={(e) => updateActiveMissionNested('theory', 'contentMarkdown', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '12px 14px',
                              borderRadius: '10px',
                              backgroundColor: 'var(--bg, #f8fafc)',
                              border: '1px solid var(--border, #cbd5e1)',
                              color: 'var(--text, #0f172a)',
                              fontSize: '13px',
                              lineHeight: '1.6',
                              outline: 'none',
                              fontFamily: 'monospace'
                            }}
                          />
                        </div>
                      )}

                      {/* Key Takeaways */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)' }}>
                            Key Takeaways Bullet Points
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const takeaways = [...(currentActiveMission.theory?.keyTakeaways || []), ''];
                              updateActiveMissionNested('theory', 'keyTakeaways', takeaways);
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: 'rgba(59,130,246,0.1)',
                              border: 'none',
                              color: '#2563eb',
                              fontSize: '11px',
                              fontWeight: '800',
                              cursor: 'pointer'
                            }}
                          >
                            + Add Bullet
                          </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {(currentActiveMission.theory?.keyTakeaways || []).map((point, ptIdx) => (
                            <div key={ptIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: '14px', color: '#2563eb', fontWeight: '900' }}>•</span>
                              <input
                                type="text"
                                value={point}
                                onChange={(e) => {
                                  const takeaways = [...(currentActiveMission.theory?.keyTakeaways || [])];
                                  takeaways[ptIdx] = e.target.value;
                                  updateActiveMissionNested('theory', 'keyTakeaways', takeaways);
                                }}
                                placeholder="Key concept takeaway point..."
                                style={{
                                  flex: 1,
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  backgroundColor: 'var(--bg, #f8fafc)',
                                  border: '1px solid var(--border, #cbd5e1)',
                                  color: 'var(--text, #0f172a)',
                                  fontSize: '13px'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const takeaways = (currentActiveMission.theory?.keyTakeaways || []).filter((_, i) => i !== ptIdx);
                                  updateActiveMissionNested('theory', 'keyTakeaways', takeaways);
                                }}
                                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '6px' }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── STAGE 2: QUIZ ── */}
                  {activeStageTab === 'quiz' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <HelpCircle size={18} color="#8b5cf6" />
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                            Stage 2: Knowledge Check Quiz Questions
                          </h4>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const newQ = {
                              question: 'New electronic question prompt...',
                              options: ['Option A', 'Option B', 'Option C', 'Option D'],
                              correctAnswer: 0,
                              explanation: 'Explanation for why Option A is correct.'
                            };
                            updateActiveMissionField('quizQuestions', [...(currentActiveMission.quizQuestions || []), newQ]);
                          }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            backgroundColor: '#8b5cf6',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Plus size={14} /> Add Question
                        </button>
                      </div>

                      {(!currentActiveMission.quizQuestions || currentActiveMission.quizQuestions.length === 0) ? (
                        <div style={{
                          padding: '36px',
                          borderRadius: '12px',
                          border: '1.5px dashed var(--border, #cbd5e1)',
                          textAlign: 'center',
                          color: 'var(--text2, #64748b)'
                        }}>
                          <p style={{ margin: '0 0 10px 0', fontSize: '13px' }}>No quiz questions yet for this island.</p>
                          <button
                            type="button"
                            onClick={() => {
                              const newQ = {
                                question: 'What is the standard operating voltage of Arduino Uno?',
                                options: ['5 Volts', '12 Volts', '3.3 Volts', '24 Volts'],
                                correctAnswer: 0,
                                explanation: 'Arduino Uno uses 5V logic.'
                              };
                              updateActiveMissionField('quizQuestions', [newQ]);
                            }}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '8px',
                              backgroundColor: '#8b5cf6',
                              color: '#fff',
                              border: 'none',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            + Add First Question
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {currentActiveMission.quizQuestions.map((q, qIdx) => (
                            <div
                              key={qIdx}
                              style={{
                                padding: '18px',
                                borderRadius: '12px',
                                backgroundColor: 'var(--bg, #f8fafc)',
                                border: '1px solid var(--border, #cbd5e1)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', fontWeight: '900', color: '#8b5cf6' }}>
                                  Question #{qIdx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedQ = currentActiveMission.quizQuestions.filter((_, i) => i !== qIdx);
                                    updateActiveMissionField('quizQuestions', updatedQ);
                                  }}
                                  style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>

                              <input
                                type="text"
                                placeholder="Enter quiz question prompt..."
                                value={q.question}
                                onChange={(e) => {
                                  const updated = [...currentActiveMission.quizQuestions];
                                  updated[qIdx].question = e.target.value;
                                  updateActiveMissionField('quizQuestions', updated);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '10px 14px',
                                  borderRadius: '8px',
                                  backgroundColor: 'var(--card, #ffffff)',
                                  border: '1px solid var(--border, #cbd5e1)',
                                  color: 'var(--text, #0f172a)',
                                  fontSize: '13px',
                                  fontWeight: '700'
                                }}
                              />

                              {/* Options */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                {q.options.map((opt, optIdx) => (
                                  <div
                                    key={optIdx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '8px 12px',
                                      borderRadius: '8px',
                                      backgroundColor: 'var(--card, #ffffff)',
                                      border: q.correctAnswer === optIdx ? '2px solid #10b981' : '1px solid var(--border, #cbd5e1)'
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name={`correct_${qIdx}`}
                                      checked={q.correctAnswer === optIdx}
                                      onChange={() => {
                                        const updated = [...currentActiveMission.quizQuestions];
                                        updated[qIdx].correctAnswer = optIdx;
                                        updateActiveMissionField('quizQuestions', updated);
                                      }}
                                      style={{ cursor: 'pointer' }}
                                    />
                                    <input
                                      type="text"
                                      value={opt}
                                      onChange={(e) => {
                                        const updated = [...currentActiveMission.quizQuestions];
                                        updated[qIdx].options[optIdx] = e.target.value;
                                        updateActiveMissionField('quizQuestions', updated);
                                      }}
                                      placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                                      style={{
                                        flex: 1,
                                        border: 'none',
                                        backgroundColor: 'transparent',
                                        color: 'var(--text, #0f172a)',
                                        fontSize: '12px',
                                        outline: 'none'
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>

                              {/* Explanation */}
                              <input
                                type="text"
                                placeholder="Why is this answer correct? (Explanation shown after submission)"
                                value={q.explanation || ''}
                                onChange={(e) => {
                                  const updated = [...currentActiveMission.quizQuestions];
                                  updated[qIdx].explanation = e.target.value;
                                  updateActiveMissionField('quizQuestions', updated);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  backgroundColor: 'var(--card, #ffffff)',
                                  border: '1px solid var(--border, #cbd5e1)',
                                  color: 'var(--text2, #475569)',
                                  fontSize: '12px'
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── STAGE 3: UNLOCK COMPONENTS ── */}
                  {activeStageTab === 'unlock' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Gift size={18} color="#ec4899" />
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                            Stage 3: Hardware Parts Unlocked on this Island
                          </h4>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#ec4899' }}>
                          {(currentActiveMission.componentsToUnlock || []).length} Parts Selected
                        </span>
                      </div>

                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text2, #64748b)' }}>
                        Select the components students unlock in their inventory when they reach this milestone island.
                      </p>

                      {/* Filter & Search Bar */}
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Search electronic parts..."
                          value={componentSearch}
                          onChange={(e) => setComponentSearch(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg, #f8fafc)',
                            border: '1px solid var(--border, #cbd5e1)',
                            color: 'var(--text, #0f172a)',
                            fontSize: '13px',
                            outline: 'none'
                          }}
                        />

                        <select
                          value={componentCategory}
                          onChange={(e) => setComponentCategory(e.target.value)}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg, #f8fafc)',
                            border: '1px solid var(--border, #cbd5e1)',
                            color: 'var(--text, #0f172a)',
                            fontSize: '13px',
                            fontWeight: '600',
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="all">All Categories</option>
                          <option value="microcontroller">Microcontrollers</option>
                          <option value="sensor">Sensors</option>
                          <option value="actuator">Actuators</option>
                          <option value="display">Displays</option>
                          <option value="passive">Passives</option>
                        </select>
                      </div>

                      {/* Component Chips Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: '10px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        padding: '4px'
                      }}>
                        {filteredComponents.map(comp => {
                          const isUnlocked = (currentActiveMission.componentsToUnlock || []).includes(comp.id);
                          return (
                            <div
                              key={comp.id}
                              onClick={() => toggleUnlockComponent(comp.id)}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                backgroundColor: isUnlocked ? 'rgba(236,72,153,0.08)' : 'var(--bg, #f8fafc)',
                                border: isUnlocked ? '1.5px solid #ec4899' : '1px solid var(--border, #cbd5e1)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <img src={comp.icon} alt={comp.name} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {comp.name}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text2, #64748b)' }}>
                                  {comp.category}
                                </div>
                              </div>
                              {isUnlocked && <Check size={16} color="#ec4899" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── STAGE 4: GUIDED SAMPLE PROJECT ── */}
                  {activeStageTab === 'guide' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ScrollText size={18} color="#10b981" />
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                          Stage 4: Sample Guided Lab & Starter Code Walkthrough
                        </h4>
                      </div>

                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text2, #64748b)' }}>
                        Provide guided step-by-step instructions and sample starter code before the student solves the final challenge.
                      </p>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Guided Lab Title
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Guided Lab: Wiring Up the LED"
                          value={currentActiveMission.guideSample?.title || ''}
                          onChange={(e) => updateActiveMissionNested('guideSample', 'title', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg, #f8fafc)',
                            border: '1px solid var(--border, #cbd5e1)',
                            color: 'var(--text, #0f172a)',
                            fontSize: '14px',
                            fontWeight: '700'
                          }}
                        />
                      </div>

                      {/* Reference Circuit PNG Upload */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Reference Circuit Diagram (.PNG)
                        </label>
                        <input
                          type="file"
                          accept=".png"
                          ref={guideFileInputRef}
                          style={{ display: 'none' }}
                          onChange={(e) => handleGuidePngUpload(e.target.files?.[0])}
                        />

                        {currentActiveMission.guideSample?.circuitPngBase64 ? (
                          <div style={{
                            padding: '14px 18px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <img
                                src={currentActiveMission.guideSample.circuitPngBase64}
                                alt="Guide circuit preview"
                                style={{ width: 64, height: 48, objectFit: 'contain', borderRadius: 8, backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}
                              />
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: '800', color: '#10b981' }}>
                                  ✓ Circuit Diagram Attached
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text2, #64748b)' }}>
                                  {currentActiveMission.guideSample.circuitFileName || 'circuit.png'}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => guideFileInputRef.current?.click()}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '8px',
                                backgroundColor: 'var(--card, #ffffff)',
                                border: '1px solid var(--border, #cbd5e1)',
                                color: 'var(--text, #0f172a)',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              Replace Image
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => guideFileInputRef.current?.click()}
                            style={{
                              width: '100%',
                              padding: '16px',
                              borderRadius: '10px',
                              border: '1.5px dashed #10b981',
                              backgroundColor: 'rgba(16, 185, 129, 0.04)',
                              color: '#059669',
                              fontSize: '13px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px'
                            }}
                          >
                            <UploadCloud size={18} /> Upload Reference Circuit PNG (Optional)
                          </button>
                        )}
                      </div>

                      {/* Instructions */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Lab Instructions (Step-by-step)
                        </label>
                        <textarea
                          rows={4}
                          value={currentActiveMission.guideSample?.instruction || ''}
                          onChange={(e) => updateActiveMissionNested('guideSample', 'instruction', e.target.value)}
                          placeholder="1. Connect Pin 13 to Resistor...&#10;2. Connect Resistor to LED Anode...&#10;3. Connect LED Cathode to GND..."
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg, #f8fafc)',
                            border: '1px solid var(--border, #cbd5e1)',
                            color: 'var(--text, #0f172a)',
                            fontSize: '13px',
                            lineHeight: '1.5',
                            outline: 'none'
                          }}
                        />
                      </div>

                      {/* Starter Code */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Sample Code (C++ / MicroPython)
                        </label>
                        <textarea
                          rows={6}
                          value={currentActiveMission.guideSample?.starterCode || ''}
                          onChange={(e) => updateActiveMissionNested('guideSample', 'starterCode', e.target.value)}
                          placeholder="void setup() { ... }&#10;void loop() { ... }"
                          style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: '10px',
                            backgroundColor: '#0f172a',
                            border: '1px solid #334155',
                            color: '#38bdf8',
                            fontSize: '12px',
                            lineHeight: '1.6',
                            fontFamily: 'monospace',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── STAGE 5: FINAL PROJECT ASSESSMENT ── */}
                  {activeStageTab === 'project' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Wrench size={18} color="#f59e0b" />
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                          Stage 5: Final Project Challenge & Solution Circuit
                        </h4>
                      </div>

                      {/* Anti-cheat banner */}
                      <div style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(79, 70, 229, 0.08)',
                        border: '1px solid rgba(79, 70, 229, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <ShieldCheck size={20} color="#4f46e5" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: '#312e81', fontWeight: '600', lineHeight: '1.5' }}>
                          <b>Anti-Cheat Protected Solution:</b> The solution circuit PNG, wiring, and code you upload here are stored securely on the backend and <b>never exposed to students</b>. Our simulator grading engine automatically validates student circuits against your solution!
                        </span>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Project Challenge Title
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Final Project: Strobe Beacon Challenge"
                          value={currentActiveMission.projectMission?.title || ''}
                          onChange={(e) => updateActiveMissionNested('projectMission', 'title', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg, #f8fafc)',
                            border: '1px solid var(--border, #cbd5e1)',
                            color: 'var(--text, #0f172a)',
                            fontSize: '14px',
                            fontWeight: '700'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Prompt for Students (Challenge Objective) *
                        </label>
                        <textarea
                          rows={3}
                          placeholder="What must the student build? (e.g. 'Build the circuit from scratch using an LED and a 220Ω resistor. Connect the LED to digital pin 13 and make it blink continuously every 500ms.')"
                          value={currentActiveMission.projectMission?.prompt || ''}
                          onChange={(e) => updateActiveMissionNested('projectMission', 'prompt', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg, #f8fafc)',
                            border: '1px solid var(--border, #cbd5e1)',
                            color: 'var(--text, #0f172a)',
                            fontSize: '13px',
                            lineHeight: '1.5',
                            outline: 'none'
                          }}
                        />
                      </div>

                      {/* Solution PNG Upload Dropzone */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Teacher Reference Solution Circuit (.PNG exported from Simulator) *
                        </label>
                        <input
                          type="file"
                          accept=".png"
                          ref={fileInputRef}
                          style={{ display: 'none' }}
                          onChange={(e) => handleTeacherPngUpload(e.target.files?.[0])}
                        />

                        <div
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            padding: '28px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            border: '2px dashed #f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            textAlign: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <UploadCloud size={32} color="#d97706" />
                          <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                            Click to Upload Solution PNG or Drag & Drop
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text2, #64748b)', maxWidth: '420px' }}>
                            Upload the <b>.png</b> circuit exported from OpenHW Studio. We will automatically decode components, wiring connections, and source code!
                          </div>
                        </div>
                      </div>

                      {/* Extracted Solution Preview */}
                      {currentActiveMission.projectMission?.solutionCircuit?.summary && (
                        <div style={{
                          padding: '18px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(34, 197, 94, 0.08)',
                          border: '1.5px solid rgba(34, 197, 94, 0.3)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <CheckCircle2 size={18} color="#16a34a" />
                              <span style={{ fontSize: '13px', fontWeight: '900', color: '#16a34a' }}>
                                Solution Decoded Successfully!
                              </span>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text2, #475569)' }}>
                              {currentActiveMission.projectMission.solutionCircuit.circuitFileName}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--card, #ffffff)', textAlign: 'center' }}>
                              <div style={{ fontSize: '18px', fontWeight: '900', color: '#2563eb' }}>
                                {currentActiveMission.projectMission.solutionCircuit.summary.componentCount}
                              </div>
                              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text2, #64748b)' }}>
                                Components Detected
                              </div>
                            </div>
                            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--card, #ffffff)', textAlign: 'center' }}>
                              <div style={{ fontSize: '18px', fontWeight: '900', color: '#10b981' }}>
                                {currentActiveMission.projectMission.solutionCircuit.summary.wireCount}
                              </div>
                              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text2, #64748b)' }}>
                                Wiring Connections
                              </div>
                            </div>
                            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--card, #ffffff)', textAlign: 'center' }}>
                              <div style={{ fontSize: '18px', fontWeight: '900', color: '#8b5cf6' }}>
                                {currentActiveMission.projectMission.solutionCircuit.summary.codeLines}
                              </div>
                              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text2, #64748b)' }}>
                                Sketch Code Lines
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════
              STEP 4: CERTIFICATION STUDIO (WIDE 2-COLUMN LAYOUT)
             ═════════════════════════════════════════════════════════ */}
          {step === 4 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.1fr 1fr',
              gap: '28px',
              alignItems: 'start'
            }}>
              {/* Left Column: Certificate Settings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{
                  padding: '24px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--card, #ffffff)',
                  border: '1px solid var(--border, #e2e8f0)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border, #f1f5f9)', paddingBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Award size={24} color={certification.enabled ? '#4f46e5' : '#64748b'} />
                      <div>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                          Award Verifiable Course Certificate
                        </h4>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text2, #64748b)' }}>
                          Students receive this credential upon completing all missions across all worlds.
                        </p>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={certification.enabled}
                      onChange={(e) => setCertification({ ...certification, enabled: e.target.checked })}
                      style={{ width: '22px', height: '22px', cursor: 'pointer' }}
                    />
                  </div>

                  {certification.enabled && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Certificate Title
                        </label>
                        <input
                          type="text"
                          value={certification.title}
                          onChange={(e) => setCertification({ ...certification, title: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg, #f8fafc)',
                            border: '1px solid var(--border, #cbd5e1)',
                            color: 'var(--text, #0f172a)',
                            fontSize: '14px',
                            fontWeight: '700'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Issuing Entity / Signature
                        </label>
                        <input
                          type="text"
                          value={certification.issuerName}
                          onChange={(e) => setCertification({ ...certification, issuerName: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg, #f8fafc)',
                            border: '1px solid var(--border, #cbd5e1)',
                            color: 'var(--text, #0f172a)',
                            fontSize: '13px'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Competency Description
                        </label>
                        <textarea
                          rows={3}
                          value={certification.description}
                          onChange={(e) => setCertification({ ...certification, description: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg, #f8fafc)',
                            border: '1px solid var(--border, #cbd5e1)',
                            color: 'var(--text, #0f172a)',
                            fontSize: '13px',
                            lineHeight: '1.5'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Accent Theme Color
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="color"
                            value={certification.accentColor || '#6366f1'}
                            onChange={(e) => setCertification({ ...certification, accentColor: e.target.value })}
                            style={{ width: '40px', height: '40px', borderRadius: '8px', border: 'none', cursor: 'pointer', padding: 0 }}
                          />
                          <span style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: '700', color: 'var(--text2, #64748b)' }}>
                            {certification.accentColor || '#6366f1'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Live Certificate Mockup */}
              <div style={{
                position: 'sticky',
                top: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--text2, #64748b)',
                  fontSize: '12px',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  <Award size={15} style={{ color: '#eab308' }} /> Certificate Diploma Mockup
                </div>

                <div style={{
                  padding: '36px 32px',
                  borderRadius: '20px',
                  backgroundColor: '#ffffff',
                  border: `4px double ${certification.accentColor || '#6366f1'}`,
                  boxShadow: '0 20px 40px -15px rgba(0,0,0,0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '16px',
                  position: 'relative'
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: `${certification.accentColor || '#6366f1'}15`,
                    color: certification.accentColor || '#6366f1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.2)'
                  }}>
                    <Award size={32} />
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#64748b' }}>
                      CERTIFICATE OF COMPLETION
                    </span>
                    <h3 style={{ margin: '8px 0 0 0', fontSize: '20px', fontWeight: '900', color: '#0f172a' }}>
                      {certification.title || 'Certified Embedded Systems Specialist'}
                    </h3>
                  </div>

                  <p style={{ margin: 0, fontSize: '13px', color: '#475569', maxWidth: '380px', lineHeight: '1.5' }}>
                    {certification.description}
                  </p>

                  <div style={{
                    width: '100%',
                    paddingTop: '20px',
                    marginTop: '8px',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: '#64748b'
                  }}>
                    <div>
                      <div style={{ fontWeight: '800', color: '#0f172a' }}>{certification.issuerName}</div>
                      <div style={{ fontSize: '10px' }}>Authorized Instructor</div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '800', color: '#6366f1' }}>OPENHW-VERIFIED</div>
                      <div style={{ fontSize: '10px' }}>Serial: 2026-EXP-001</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── 4. STUDIO BOTTOM APP BAR (FULL WIDTH) ── */}
      <footer style={{
        flexShrink: 0,
        height: '66px',
        padding: '0 32px',
        backgroundColor: 'var(--card, #ffffff)',
        borderTop: '1px solid var(--border, #e2e8f0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10
      }}>
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              backgroundColor: 'var(--card, #ffffff)',
              border: '1.5px solid var(--border, #cbd5e1)',
              color: 'var(--text, #0f172a)',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ChevronLeft size={16} /> Back to Step {step - 1}
          </button>
        ) : (
          <div />
        )}

        {/* Step Indicator dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text2, #64748b)' }}>
            Step {step} of 4: {stepsList[step - 1].title}
          </span>
          <div style={{ display: 'flex', gap: '4px', marginLeft: '6px' }}>
            {stepsList.map(s => (
              <div
                key={s.num}
                onClick={() => setStep(s.num)}
                style={{
                  width: step === s.num ? '20px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  backgroundColor: step === s.num ? '#4f46e5' : 'var(--border, #cbd5e1)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              />
            ))}
          </div>
        </div>

        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
              border: 'none',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
            }}
          >
            Continue to {stepsList[step].label} <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            style={{
              padding: '10px 28px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #059669, #047857)',
              border: 'none',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '800',
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 16px rgba(5, 150, 105, 0.35)'
            }}
          >
            {submitting ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={16} />}
            <span>{submitting ? (editingMap ? 'Saving Changes...' : 'Publishing...') : (editingMap ? 'Save & Update Adventure Map' : 'Publish Adventure Map')}</span>
          </button>
        )}
      </footer>
    </div>
  );
}
