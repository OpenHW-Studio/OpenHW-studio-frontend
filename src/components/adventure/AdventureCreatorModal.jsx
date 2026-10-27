import React, { useState, useRef, useEffect } from 'react';
import {
  X, Plus, Trash2, ChevronRight, ChevronLeft, Award, Sparkles,
  Layers, Cpu, MapPin, CheckCircle, HelpCircle, FileText, Code,
  Sliders, Palette, ArrowRight, ShieldCheck, Globe, BookOpen,
  Gift, ScrollText, Wrench, UploadCloud, CheckCircle2, AlertTriangle,
  Code2, FileCode, Check, Info, Lock, Image as ImageIcon
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

export default function AdventureCreatorModal({ isOpen, onClose, onCreated, editingMap = null, classrooms = [], isTeacher = false, defaultClassroomId = '', lockClassroom = false }) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Active navigation tabs in Step 2 & 3
  const [activeWorldTab, setActiveWorldTab] = useState(0);
  const [activeIslandTab, setActiveIslandTab] = useState(0);
  const [activeStageTab, setActiveStageTab] = useState('theory'); // 'theory' | 'quiz' | 'unlock' | 'guide' | 'project'

  const fileInputRef = useRef(null);
  const guideFileInputRef = useRef(null);

  // Form State
  const [campaign, setCampaign] = useState(DEFAULT_CAMPAIGN);
  const [worlds, setWorlds] = useState(DEFAULT_WORLDS);
  const [certification, setCertification] = useState(DEFAULT_CERTIFICATION);
  // Classroom scope — teacher-only feature
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
                  id: `m_1_${iIdx}`,
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
      } else {
        setWorlds(DEFAULT_WORLDS);
      }

      if (editingMap.certification) {
        setCertification({
          enabled: Boolean(editingMap.certification.enabled),
          title: editingMap.certification.title || 'Certified Embedded Systems Specialist',
          issuerName: editingMap.certification.issuerName || 'OpenHW Community Studio',
          description: editingMap.certification.description || 'Awarded for exceptional mastery and successful completion of all world missions.',
          accentColor: editingMap.certification.accentColor || '#6366f1',
          badgeIcon: editingMap.certification.badgeIcon || 'Award'
        });
      }
      // Restore classroom scope if editing a classroom-scoped map, or defaultClassroomId
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
      setSelectedClassroomId(defaultClassroomId ? String(defaultClassroomId) : ''); // default to classroom if locked/provided
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
        // Classroom scope: if a classroom is selected, scope this map to that classroom only
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
      if (onCreated) onCreated(result.map || result);
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

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--card, #ffffff)',
        border: '1px solid var(--border, #cbd5e1)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '960px',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        color: 'var(--text, #0f172a)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 26px',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg2, #f8fafc)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>✨</span>
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, letterSpacing: '0.04em', color: 'var(--text, #0f172a)' }}>
                {editingMap ? 'Edit Adventure Map' : 'Create Your Own Adventure Map'}
              </h2>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text2, #475569)' }}>
              {editingMap ? 'Modify Worlds, Islands, and 5-stage missions for your custom hardware expedition.' : 'Design Worlds (up to 6 Islands each) adhering to the 5-Stage Template: Theory, Quiz, Unlock, Guide & Project.'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg3, #e2e8f0)', border: 'none', borderRadius: '10px',
              width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text, #0f172a)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Indicator */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border, #e2e8f0)',
          backgroundColor: 'var(--bg, #f8fafc)'
        }}>
          {[
            { num: 1, label: 'Campaign Overview' },
            { num: 2, label: 'Worlds & Islands (Max 6)' },
            { num: 3, label: '5-Stage Island Studio' },
            { num: 4, label: 'Certification' },
          ].map(s => {
            const active = step === s.num;
            const completed = step > s.num;
            return (
              <div
                key={s.num}
                onClick={() => setStep(s.num)}
                style={{
                  flex: 1, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '8px',
                  borderBottom: active ? '3px solid #2563eb' : '3px solid transparent',
                  background: active ? 'var(--card, #ffffff)' : 'transparent',
                  cursor: 'pointer', opacity: active || completed ? 1 : 0.65
                }}
              >
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  backgroundColor: completed ? '#10b981' : active ? '#2563eb' : 'var(--border, #cbd5e1)',
                  color: completed || active ? '#ffffff' : 'var(--text2, #475569)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: '900'
                }}>
                  {completed ? '✓' : s.num}
                </div>
                <span style={{ fontSize: '12px', fontWeight: active ? '800' : '600', color: active ? '#2563eb' : 'var(--text, #0f172a)' }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            margin: '12px 24px 0', padding: '10px 14px', borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#dc2626', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <AlertTriangle size={15} /> {error}
          </div>
        )}

        {/* Body Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 26px' }}>

          {/* STEP 1: Campaign Overview */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    backgroundColor: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #cbd5e1)',
                    color: 'var(--text, #0f172a)', fontSize: '14px', fontWeight: '700', outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '8px' }}>
                    Hardware Board
                  </label>
                  <select
                    value={campaign.board}
                    onChange={(e) => handleBoardChange(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '10px',
                      backgroundColor: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #cbd5e1)',
                      color: 'var(--text, #0f172a)', fontSize: '13px', fontWeight: '600', outline: 'none'
                    }}
                  >
                    <option value="arduino-uno">Arduino Uno (AVR ATmega328P)</option>
                    <option value="esp32">ESP32 DevKit (Xtensa Dual-Core)</option>
                    <option value="raspberry-pi-pico">Raspberry Pi Pico (RP2040)</option>
                    <option value="stm32">STM32 Nucleo (ARM Cortex-M4)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '8px' }}>
                    Theme Accent Color
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      value={campaign.badgeColor}
                      onChange={(e) => setCampaign({ ...campaign, badgeColor: e.target.value })}
                      style={{ width: '40px', height: '40px', borderRadius: '8px', border: 'none', cursor: 'pointer', padding: '0' }}
                    />
                    <input
                      type="text"
                      value={campaign.badgeColor}
                      onChange={(e) => setCampaign({ ...campaign, badgeColor: e.target.value })}
                      style={{
                        flex: 1, padding: '10px 14px', borderRadius: '10px',
                        backgroundColor: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #cbd5e1)',
                        color: 'var(--text, #0f172a)', fontSize: '13px', fontFamily: 'monospace'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '8px' }}>
                  Campaign Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the skills and journey students will undertake in this world..."
                  value={campaign.description}
                  onChange={(e) => setCampaign({ ...campaign, description: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    backgroundColor: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #cbd5e1)',
                    color: 'var(--text, #0f172a)', fontSize: '13px', outline: 'none', resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '8px' }}>
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="sensors, robotics, wifi, analog"
                  value={campaign.tags}
                  onChange={(e) => setCampaign({ ...campaign, tags: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    backgroundColor: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #cbd5e1)',
                    color: 'var(--text, #0f172a)', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              {/* Classroom Scope — Teacher Exclusive Feature */}
              {isTeacher && (
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(99, 102, 241, 0.05)',
                  border: '1.5px solid rgba(99, 102, 241, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BookOpen size={16} color="#4f46e5" />
                      <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                        Classroom Scope (Teacher Only)
                      </span>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: selectedClassroomId ? '#4f46e5' : 'rgba(99, 102, 241, 0.15)',
                      color: selectedClassroomId ? '#ffffff' : '#4f46e5'
                    }}>
                      {selectedClassroomId ? 'Classroom Only' : 'Public World'}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text2, #475569)', lineHeight: 1.5 }}>
                    Restrict this adventure so <b>only students inside a specific classroom</b> can view and play it.
                    Leave as <i>"Public (Everyone)"</i> to publish it for the open community.
                  </p>

                  {lockClassroom ? (
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(79, 70, 229, 0.08)',
                      border: '1px solid rgba(79, 70, 229, 0.25)',
                      color: 'var(--text, #0f172a)',
                      fontSize: '13px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>🎓 Classroom Exclusive Map</span>
                      <span style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 700 }}>🔒 Locked to this class</span>
                    </div>
                  ) : (
                    <select
                      value={selectedClassroomId}
                      onChange={(e) => setSelectedClassroomId(e.target.value)}
                      style={{
                        width: '100%',
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
                      <option value="">🌐 Public — Visible to all OpenHW learners</option>
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
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      color: '#4f46e5',
                      fontWeight: '600'
                    }}>
                      <Info size={13} />
                      <span>This world will only appear in the selected classroom module for enrolled students.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Worlds & Islands (Max 6 Islands Per World) */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                    Worlds & Island Architect
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text2, #475569)' }}>
                    Organize Worlds (e.g. <i>"World 1: Circuit Basics"</i>), and inside each World add <b>up to 6 floating Islands</b>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addWorld}
                  style={{
                    padding: '8px 14px', borderRadius: '10px',
                    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
                    color: '#4f46e5', fontSize: '12px', fontWeight: '800', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Plus size={14} /> + Add Another World
                </button>
              </div>

              {/* Worlds Tab Selector */}
              <div style={{
                display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px',
                borderBottom: '1px solid var(--border, #e2e8f0)'
              }}>
                {worlds.map((w, wIdx) => (
                  <button
                    key={w.id}
                    onClick={() => { setActiveWorldTab(wIdx); setActiveIslandTab(0); setError(null); }}
                    style={{
                      padding: '8px 16px', borderRadius: '10px', border: 'none',
                      background: activeWorldTab === wIdx ? 'linear-gradient(135deg, #1e40af, #2563eb)' : 'var(--bg2, #e2e8f0)',
                      color: activeWorldTab === wIdx ? '#fbbf24' : 'var(--text2, #475569)',
                      fontSize: '12px', fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <span>{w.name}</span>
                    <span style={{
                      fontSize: '10px', padding: '1px 6px', borderRadius: '6px',
                      background: activeWorldTab === wIdx ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.06)',
                      color: activeWorldTab === wIdx ? '#fff' : 'var(--text3, #64748b)'
                    }}>
                      {w.islands?.length || 0}/6
                    </span>
                  </button>
                ))}
              </div>

              {/* Active World Config Card */}
              {currentActiveWorld && (
                <div style={{
                  padding: '18px', borderRadius: '16px',
                  backgroundColor: 'var(--bg2, #f8fafc)', border: '1px solid var(--border, #e2e8f0)',
                  display: 'flex', flexDirection: 'column', gap: '16px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '12px', alignItems: 'center' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)' }}>
                        World Title
                      </label>
                      <input
                        type="text"
                        value={currentActiveWorld.name}
                        onChange={(e) => updateWorld(activeWorldTab, 'name', e.target.value)}
                        style={{
                          width: '100%', marginTop: '4px', padding: '8px 12px', borderRadius: '8px',
                          backgroundColor: 'var(--card, #ffffff)', border: '1px solid var(--border, #cbd5e1)',
                          color: 'var(--text, #0f172a)', fontSize: '13px', fontWeight: '700'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)' }}>
                        Theme Subtitle
                      </label>
                      <input
                        type="text"
                        value={currentActiveWorld.theme}
                        onChange={(e) => updateWorld(activeWorldTab, 'theme', e.target.value)}
                        style={{
                          width: '100%', marginTop: '4px', padding: '8px 12px', borderRadius: '8px',
                          backgroundColor: 'var(--card, #ffffff)', border: '1px solid var(--border, #cbd5e1)',
                          color: 'var(--text, #0f172a)', fontSize: '13px'
                        }}
                      />
                    </div>
                    {worlds.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeWorld(activeWorldTab)}
                        style={{
                          marginTop: '16px', padding: '8px 12px', borderRadius: '8px',
                          background: 'rgba(239, 68, 68, 0.1)', border: 'none',
                          color: '#dc2626', fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                        }}
                      >
                        Delete World
                      </button>
                    )}
                  </div>

                  {/* Islands in this World */}
                  <div style={{ borderTop: '1px solid var(--border, #e2e8f0)', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                          Islands in {currentActiveWorld.name}
                        </h4>
                        <span style={{
                          fontSize: '11px', fontWeight: '800', color: currentActiveWorld.islands?.length >= 6 ? '#dc2626' : '#2563eb',
                          backgroundColor: currentActiveWorld.islands?.length >= 6 ? 'rgba(239,68,68,0.1)' : 'rgba(37,99,235,0.08)',
                          padding: '2px 8px', borderRadius: '12px'
                        }}>
                          {currentActiveWorld.islands?.length || 0} / 6 Islands Max
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => addIslandToWorld(activeWorldTab)}
                        disabled={currentActiveWorld.islands?.length >= 6}
                        style={{
                          padding: '6px 12px', borderRadius: '8px',
                          background: currentActiveWorld.islands?.length >= 6 ? 'var(--border, #cbd5e1)' : '#2563eb',
                          color: currentActiveWorld.islands?.length >= 6 ? '#94a3b8' : '#fff',
                          border: 'none', fontSize: '11px', fontWeight: '800',
                          cursor: currentActiveWorld.islands?.length >= 6 ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        <Plus size={13} /> Add Island
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                      {currentActiveWorld.islands?.map((island, islIdx) => (
                        <div
                          key={island.id}
                          style={{
                            padding: '14px', borderRadius: '12px',
                            backgroundColor: 'var(--card, #ffffff)', border: '1px solid var(--border, #e2e8f0)',
                            display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                width: '22px', height: '22px', borderRadius: '50%',
                                backgroundColor: island.color || '#2563eb', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '11px', fontWeight: '900'
                              }}>
                                {islIdx + 1}
                              </span>
                              <input
                                type="text"
                                value={island.name}
                                onChange={(e) => updateIslandInWorld(activeWorldTab, islIdx, 'name', e.target.value)}
                                style={{
                                  background: 'transparent', border: 'none', borderBottom: '1px solid var(--border, #cbd5e1)',
                                  color: 'var(--text, #0f172a)', fontSize: '12px', fontWeight: '800', outline: 'none',
                                  width: '150px'
                                }}
                              />
                            </div>
                            {currentActiveWorld.islands?.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeIslandFromWorld(activeWorldTab, islIdx)}
                                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img
                              src={island.islandImage}
                              alt={island.name}
                              style={{ width: '44px', height: '44px', objectFit: 'contain' }}
                            />
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)' }}>
                                3D Sprite Node
                              </label>
                              <select
                                value={island.islandImage}
                                onChange={(e) => updateIslandInWorld(activeWorldTab, islIdx, 'islandImage', e.target.value)}
                                style={{
                                  width: '100%', padding: '4px 6px', borderRadius: '6px',
                                  backgroundColor: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #cbd5e1)',
                                  color: 'var(--text, #0f172a)', fontSize: '11px', fontWeight: '600'
                                }}
                              >
                                {ISLAND_PRESETS.map(p => (
                                  <option key={p.id} value={p.file}>{p.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: 5-Stage Island Studio */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                  5-Stage Island Learning Studio
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text2, #475569)' }}>
                  Every island adheres strictly to the 5-stage roadmap: <b>Theory</b>, <b>Quiz</b>, <b>Unlock</b>, <b>Guide</b>, and <b>Project</b> with teacher circuit solution grading.
                </p>
              </div>

              {/* World Selector */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', borderBottom: '1px solid var(--border, #e2e8f0)', paddingBottom: '4px' }}>
                {worlds.map((w, wIdx) => (
                  <button
                    key={w.id}
                    onClick={() => { setActiveWorldTab(wIdx); setActiveIslandTab(0); }}
                    style={{
                      padding: '6px 14px', borderRadius: '8px', border: 'none',
                      background: activeWorldTab === wIdx ? '#2563eb' : 'var(--bg2, #e2e8f0)',
                      color: activeWorldTab === wIdx ? '#fff' : 'var(--text2, #475569)',
                      fontSize: '11px', fontWeight: '800', cursor: 'pointer'
                    }}
                  >
                    {w.name}
                  </button>
                ))}
              </div>

              {/* Island Selector within Active World */}
              <div style={{
                display: 'flex', gap: '10px', overflowX: 'auto', padding: '6px 2px',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', letterSpacing: '0.05em' }}>
                  Select Island:
                </span>
                {currentActiveWorld?.islands?.map((isl, islIdx) => (
                  <button
                    key={isl.id}
                    onClick={() => setActiveIslandTab(islIdx)}
                    style={{
                      padding: '6px 12px', borderRadius: '10px',
                      background: activeIslandTab === islIdx ? 'linear-gradient(135deg, #4338ca, #3b82f6)' : 'var(--card, #ffffff)',
                      color: activeIslandTab === islIdx ? '#fff' : 'var(--text, #0f172a)',
                      border: activeIslandTab === islIdx ? 'none' : '1px solid var(--border, #cbd5e1)',
                      fontSize: '12px', fontWeight: '800', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px',
                      boxShadow: activeIslandTab === islIdx ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
                    }}
                  >
                    <img src={isl.islandImage} alt={isl.name} style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                    <span>{islIdx + 1}. {isl.name}</span>
                  </button>
                ))}
              </div>

              {/* Active Island Stages Container */}
              {currentActiveIsland && currentActiveMission && (
                <div style={{
                  padding: '18px', borderRadius: '16px',
                  backgroundColor: 'var(--bg2, #f8fafc)', border: '1px solid var(--border, #e2e8f0)',
                  display: 'flex', flexDirection: 'column', gap: '16px'
                }}>
                  {/* Island Header Banner */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img src={currentActiveIsland.islandImage} alt={currentActiveIsland.name} style={{ width: '42px', height: '42px', objectFit: 'contain' }} />
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '900', color: 'var(--text, #0f172a)' }}>
                          {currentActiveIsland.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text2, #475569)', fontWeight: '600' }}>
                          {currentActiveWorld.name} • Island #{activeIslandTab + 1}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text2, #475569)' }}>XP Reward:</span>
                        <input
                          type="number"
                          value={currentActiveMission.xpReward || 100}
                          onChange={(e) => updateActiveMissionField('xpReward', Number(e.target.value))}
                          style={{
                            width: '70px', padding: '4px 8px', borderRadius: '6px',
                            backgroundColor: 'var(--card, #ffffff)', border: '1px solid var(--border, #cbd5e1)',
                            color: '#ea580c', fontSize: '12px', fontWeight: '800'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5-Stage Step Bar (Matching the student roadmap) */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px',
                    backgroundColor: 'var(--card, #ffffff)', padding: '6px', borderRadius: '12px',
                    border: '1px solid var(--border, #cbd5e1)'
                  }}>
                    {[
                      { key: 'theory', num: 1, label: 'Theory', icon: BookOpen, color: '#3b82f6' },
                      { key: 'quiz', num: 2, label: 'Quiz', icon: HelpCircle, color: '#8b5cf6' },
                      { key: 'unlock', num: 3, label: 'Unlock', icon: Gift, color: '#ec4899' },
                      { key: 'guide', num: 4, label: 'Guide', icon: ScrollText, color: '#10b981' },
                      { key: 'project', num: 5, label: 'Project', icon: Wrench, color: '#f59e0b' },
                    ].map(stg => {
                      const isSel = activeStageTab === stg.key;
                      const Icon = stg.icon;
                      return (
                        <button
                          key={stg.key}
                          type="button"
                          onClick={() => setActiveStageTab(stg.key)}
                          style={{
                            padding: '10px 8px', borderRadius: '8px', border: 'none',
                            background: isSel ? `${stg.color}15` : 'transparent',
                            outline: isSel ? `2px solid ${stg.color}` : 'none',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                            cursor: 'pointer', transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: isSel ? stg.color : 'var(--bg2, #f1f5f9)',
                            color: isSel ? '#ffffff' : 'var(--text2, #475569)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            <Icon size={14} />
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: isSel ? stg.color : 'var(--text, #0f172a)' }}>
                            {stg.num}. {stg.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* STAGE 1: Theory Content */}
                  {activeStageTab === 'theory' && (
                    <div style={{
                      backgroundColor: 'var(--card, #ffffff)', padding: '16px', borderRadius: '12px',
                      border: '1px solid var(--border, #cbd5e1)', display: 'flex', flexDirection: 'column', gap: '14px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BookOpen size={16} color="#3b82f6" />
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                          Stage 1: Theory & Concept Briefing
                        </h4>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Theory Lesson Title
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Current, Voltage and LED Polarity Fundamentals"
                          value={currentActiveMission.theory?.title || ''}
                          onChange={(e) => updateActiveMissionNested('theory', 'title', e.target.value)}
                          style={{
                            width: '100%', padding: '8px 12px', borderRadius: '8px',
                            backgroundColor: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #cbd5e1)',
                            color: 'var(--text, #0f172a)', fontSize: '13px', fontWeight: '600'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Theory Markdown Content
                        </label>
                        <textarea
                          rows={5}
                          placeholder="Explain what the circuit does, how current flows, and important physics/hardware formulas..."
                          value={currentActiveMission.theory?.contentMarkdown || ''}
                          onChange={(e) => updateActiveMissionNested('theory', 'contentMarkdown', e.target.value)}
                          style={{
                            width: '100%', padding: '10px 12px', borderRadius: '8px',
                            backgroundColor: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #cbd5e1)',
                            color: 'var(--text, #0f172a)', fontSize: '12px', lineHeight: '1.6', outline: 'none'
                          }}
                        />
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)' }}>
                            Key Takeaways
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const takeaways = [...(currentActiveMission.theory?.keyTakeaways || []), ''];
                              updateActiveMissionNested('theory', 'keyTakeaways', takeaways);
                            }}
                            style={{
                              padding: '2px 8px', borderRadius: '6px',
                              background: 'rgba(59,130,246,0.1)', border: 'none',
                              color: '#2563eb', fontSize: '10px', fontWeight: '800', cursor: 'pointer'
                            }}
                          >
                            + Add Bullet
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(currentActiveMission.theory?.keyTakeaways || []).map((point, ptIdx) => (
                            <div key={ptIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: '800' }}>•</span>
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
                                  flex: 1, padding: '6px 10px', borderRadius: '6px',
                                  backgroundColor: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #cbd5e1)',
                                  color: 'var(--text, #0f172a)', fontSize: '12px'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const takeaways = (currentActiveMission.theory?.keyTakeaways || []).filter((_, i) => i !== ptIdx);
                                  updateActiveMissionNested('theory', 'keyTakeaways', takeaways);
                                }}
                                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STAGE 2: Quiz Based on Theory */}
                  {activeStageTab === 'quiz' && (
                    <div style={{
                      backgroundColor: 'var(--card, #ffffff)', padding: '16px', borderRadius: '12px',
                      border: '1px solid var(--border, #cbd5e1)', display: 'flex', flexDirection: 'column', gap: '14px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <HelpCircle size={16} color="#8b5cf6" />
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                            Stage 2: Quiz Based on Theory
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newQ = {
                              question: 'What is the correct configuration for this circuit?',
                              options: ['Option A', 'Option B', 'Option C', 'Option D'],
                              correctAnswer: 0,
                              explanation: 'Review the theory notes to verify this concept.'
                            };
                            updateActiveMissionField('quizQuestions', [...(currentActiveMission.quizQuestions || []), newQ]);
                          }}
                          style={{
                            padding: '4px 10px', borderRadius: '6px',
                            background: '#8b5cf6', border: 'none',
                            color: '#fff', fontSize: '11px', fontWeight: '800', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <Plus size={13} /> Add Question
                        </button>
                      </div>

                      {(!currentActiveMission.quizQuestions || currentActiveMission.quizQuestions.length === 0) ? (
                        <div style={{
                          padding: '24px', textAlign: 'center', borderRadius: '8px',
                          backgroundColor: 'var(--bg, #f8fafc)', border: '1px dashed var(--border, #cbd5e1)',
                          color: 'var(--text2, #475569)', fontSize: '12px'
                        }}>
                          No questions added yet. Click "+ Add Question" to test students on this island's theory.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          {currentActiveMission.quizQuestions.map((q, qIdx) => (
                            <div key={qIdx} style={{
                              padding: '12px', borderRadius: '8px',
                              backgroundColor: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #cbd5e1)',
                              display: 'flex', flexDirection: 'column', gap: '10px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', fontWeight: '900', color: '#8b5cf6' }}>
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
                                  <Trash2 size={13} />
                                </button>
                              </div>

                              <input
                                type="text"
                                placeholder="Enter question..."
                                value={q.question}
                                onChange={(e) => {
                                  const updated = [...currentActiveMission.quizQuestions];
                                  updated[qIdx].question = e.target.value;
                                  updateActiveMissionField('quizQuestions', updated);
                                }}
                                style={{
                                  padding: '8px 10px', borderRadius: '6px',
                                  backgroundColor: 'var(--card, #ffffff)', border: '1px solid var(--border, #cbd5e1)',
                                  color: 'var(--text, #0f172a)', fontSize: '12px', fontWeight: '700'
                                }}
                              />

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {q.options.map((opt, optIdx) => (
                                  <div key={optIdx} style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '4px 8px', borderRadius: '6px',
                                    backgroundColor: q.correctAnswer === optIdx ? 'rgba(34, 197, 94, 0.1)' : 'var(--card, #ffffff)',
                                    border: q.correctAnswer === optIdx ? '1px solid #22c55e' : '1px solid var(--border, #cbd5e1)'
                                  }}>
                                    <input
                                      type="radio"
                                      name={`q-${activeWorldTab}-${activeIslandTab}-${qIdx}`}
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
                                        flex: 1, border: 'none', background: 'transparent',
                                        color: 'var(--text, #0f172a)', fontSize: '11px', outline: 'none'
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>

                              <input
                                type="text"
                                placeholder="Explanation for correct answer..."
                                value={q.explanation || ''}
                                onChange={(e) => {
                                  const updated = [...currentActiveMission.quizQuestions];
                                  updated[qIdx].explanation = e.target.value;
                                  updateActiveMissionField('quizQuestions', updated);
                                }}
                                style={{
                                  padding: '6px 10px', borderRadius: '6px',
                                  backgroundColor: 'var(--card, #ffffff)', border: '1px solid var(--border, #cbd5e1)',
                                  color: 'var(--text2, #475569)', fontSize: '11px'
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* STAGE 3: Unlock Component */}
                  {activeStageTab === 'unlock' && (
                    <div style={{
                      backgroundColor: 'var(--card, #ffffff)', padding: '16px', borderRadius: '12px',
                      border: '1px solid var(--border, #cbd5e1)', display: 'flex', flexDirection: 'column', gap: '14px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Gift size={16} color="#ec4899" />
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                            Stage 3: Component Unlocks
                          </h4>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#ec4899', backgroundColor: 'rgba(236,72,153,0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                          {(currentActiveMission.componentsToUnlock || []).length} Components Selected
                        </span>
                      </div>

                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text2, #475569)' }}>
                        Select which hardware components students unlock in their simulator inventory upon clearing this stage:
                      </p>

                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: '8px',
                        maxHeight: '260px', overflowY: 'auto', padding: '4px'
                      }}>
                        {COMPONENTS.slice(0, 32).map(comp => {
                          const isUnlocked = (currentActiveMission.componentsToUnlock || []).includes(comp.id);
                          return (
                            <div
                              key={comp.id}
                              onClick={() => toggleUnlockComponent(comp.id)}
                              style={{
                                padding: '8px', borderRadius: '8px', cursor: 'pointer',
                                backgroundColor: isUnlocked ? 'rgba(236,72,153,0.08)' : 'var(--bg, #f8fafc)',
                                border: isUnlocked ? '1.5px solid #ec4899' : '1px solid var(--border, #cbd5e1)',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <img src={comp.icon} alt={comp.name} style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {comp.name}
                                </div>
                                <div style={{ fontSize: '9px', color: 'var(--text2, #475569)' }}>
                                  {comp.category}
                                </div>
                              </div>
                              {isUnlocked && <Check size={14} color="#ec4899" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* STAGE 4: Guide a Sample Project */}
                  {activeStageTab === 'guide' && (
                    <div style={{
                      backgroundColor: 'var(--card, #ffffff)', padding: '16px', borderRadius: '12px',
                      border: '1px solid var(--border, #cbd5e1)', display: 'flex', flexDirection: 'column', gap: '14px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ScrollText size={16} color="#10b981" />
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                          Stage 4: Sample Guided Project (Tutorial Walkthrough)
                        </h4>
                      </div>

                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text2, #475569)' }}>
                        Provide guided step-by-step instructions and sample starter code before the final project assessment challenge.
                      </p>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Guided Project Title
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Guided Lab: Wiring Up the LED"
                          value={currentActiveMission.guideSample?.title || ''}
                          onChange={(e) => updateActiveMissionNested('guideSample', 'title', e.target.value)}
                          style={{
                            width: '100%', padding: '8px 12px', borderRadius: '8px',
                            backgroundColor: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #cbd5e1)',
                            color: 'var(--text, #0f172a)', fontSize: '13px', fontWeight: '600'
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
                            padding: '12px 14px', borderRadius: '10px',
                            backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <img
                                src={currentActiveMission.guideSample.circuitPngBase64}
                                alt="Guide circuit preview"
                                style={{ width: 56, height: 44, objectFit: 'contain', borderRadius: 6, backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}
                              />
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: '800', color: '#10b981' }}>
                                  ✓ Circuit Diagram Uploaded
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text2, #475569)' }}>
                                  {currentActiveMission.guideSample.circuitFileName || 'circuit.png'}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => guideFileInputRef.current?.click()}
                                style={{
                                  padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border, #cbd5e1)',
                                  backgroundColor: 'var(--card, #ffffff)', fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                                }}
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateActiveMissionNested('guideSample', 'circuitPngBase64', '');
                                  updateActiveMissionNested('guideSample', 'circuitFileName', '');
                                }}
                                style={{
                                  padding: '6px 10px', borderRadius: '6px', border: 'none',
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626',
                                  fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => guideFileInputRef.current?.click()}
                            style={{
                              padding: '16px', borderRadius: '10px', cursor: 'pointer',
                              border: '2px dashed #10b981', backgroundColor: 'rgba(16, 185, 129, 0.05)',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                              gap: '6px', textAlign: 'center', transition: 'all 0.15s ease'
                            }}
                          >
                            <UploadCloud size={24} color="#059669" />
                            <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                              Click to Upload Reference Circuit PNG
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text2, #475569)' }}>
                              Upload the circuit diagram image or exported simulator PNG for students to see in the guide window
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Step-by-Step Walkthrough Instructions
                        </label>
                        <textarea
                          rows={4}
                          placeholder="1. Connect Pin 13 to the resistor...\n2. Connect resistor to the LED...\n3. Connect LED to GND..."
                          value={currentActiveMission.guideSample?.instruction || ''}
                          onChange={(e) => updateActiveMissionNested('guideSample', 'instruction', e.target.value)}
                          style={{
                            width: '100%', padding: '10px 12px', borderRadius: '8px',
                            backgroundColor: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #cbd5e1)',
                            color: 'var(--text, #0f172a)', fontSize: '12px', lineHeight: '1.6', outline: 'none'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Sample Code Walkthrough (C++ Arduino)
                        </label>
                        <textarea
                          rows={5}
                          placeholder="void setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}"
                          value={currentActiveMission.guideSample?.starterCode || ''}
                          onChange={(e) => updateActiveMissionNested('guideSample', 'starterCode', e.target.value)}
                          style={{
                            width: '100%', padding: '10px 12px', borderRadius: '8px',
                            backgroundColor: '#0f172a', border: '1px solid var(--border, #cbd5e1)',
                            color: '#a5f3fc', fontSize: '12px', fontFamily: 'monospace', lineHeight: '1.6', outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* STAGE 5: Project & Teacher Solution PNG Upload */}
                  {activeStageTab === 'project' && (
                    <div style={{
                      backgroundColor: 'var(--card, #ffffff)', padding: '16px', borderRadius: '12px',
                      border: '1px solid var(--border, #cbd5e1)', display: 'flex', flexDirection: 'column', gap: '14px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Wrench size={16} color="#f59e0b" />
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                            Stage 5: Final Project Challenge & Teacher PNG Solution
                          </h4>
                        </div>
                        <span style={{
                          fontSize: '11px', fontWeight: '900', color: '#16a34a',
                          backgroundColor: 'rgba(22,163,74,0.1)', padding: '2px 8px', borderRadius: '12px'
                        }}>
                          Auto-Graded out of 100
                        </span>
                      </div>

                      {/* Anti-cheat banner */}
                      <div style={{
                        padding: '10px 14px', borderRadius: '8px',
                        backgroundColor: 'rgba(79, 70, 229, 0.08)', border: '1px solid rgba(79, 70, 229, 0.25)',
                        display: 'flex', alignItems: 'center', gap: '10px'
                      }}>
                        <ShieldCheck size={18} color="#4f46e5" />
                        <span style={{ fontSize: '11px', color: '#312e81', fontWeight: '600', lineHeight: '1.4' }}>
                          <b>Anti-Cheat Protected:</b> The solution circuit PNG, wiring, and code you upload here are stored securely on the backend and <b>never sent to students</b>. Students only see your Challenge Prompt below, and our simulator engine automatically grades their live submission out of 100 against your solution.
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
                            width: '100%', padding: '8px 12px', borderRadius: '8px',
                            backgroundColor: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #cbd5e1)',
                            color: 'var(--text, #0f172a)', fontSize: '13px', fontWeight: '700'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Prompt for Students (Challenge Instructions) *
                        </label>
                        <textarea
                          rows={3}
                          placeholder="What must the student build? (e.g. 'Build the circuit from scratch using an LED and a 220Ω resistor. Connect the LED to digital pin 13 and make it blink every 500ms.')"
                          value={currentActiveMission.projectMission?.prompt || ''}
                          onChange={(e) => updateActiveMissionNested('projectMission', 'prompt', e.target.value)}
                          style={{
                            width: '100%', padding: '10px 12px', borderRadius: '8px',
                            backgroundColor: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #cbd5e1)',
                            color: 'var(--text, #0f172a)', fontSize: '12px', lineHeight: '1.5', outline: 'none'
                          }}
                        />
                      </div>

                      {/* Solution PNG Upload Dropzone */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '6px' }}>
                          Teacher Reference Circuit (.PNG exported from OpenHW Studio) *
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
                            padding: '20px', borderRadius: '12px', cursor: 'pointer',
                            border: '2px dashed #f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.05)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            gap: '8px', textAlign: 'center', transition: 'all 0.15s ease'
                          }}
                        >
                          <UploadCloud size={28} color="#d97706" />
                          <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                            Click to Upload Solution PNG or Drag & Drop
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text2, #475569)' }}>
                            Upload the <b>.png</b> circuit exported from our simulator. We will automatically decode components, wiring connections, and code!
                          </div>
                        </div>
                      </div>

                      {/* Extracted Solution Preview */}
                      {currentActiveMission.projectMission?.solutionCircuit?.summary && (
                        <div style={{
                          padding: '14px', borderRadius: '10px',
                          backgroundColor: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.3)',
                          display: 'flex', flexDirection: 'column', gap: '10px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <CheckCircle2 size={16} color="#16a34a" />
                              <span style={{ fontSize: '12px', fontWeight: '900', color: '#16a34a' }}>
                                Solution Decoded Successfully!
                              </span>
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text2, #475569)' }}>
                              {currentActiveMission.projectMission.solutionCircuit.circuitFileName}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: 'var(--card, #ffffff)', textAlign: 'center' }}>
                              <div style={{ fontSize: '16px', fontWeight: '900', color: '#2563eb' }}>
                                {currentActiveMission.projectMission.solutionCircuit.summary.componentCount}
                              </div>
                              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text2, #475569)' }}>
                                Components Detected
                              </div>
                            </div>
                            <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: 'var(--card, #ffffff)', textAlign: 'center' }}>
                              <div style={{ fontSize: '16px', fontWeight: '900', color: '#10b981' }}>
                                {currentActiveMission.projectMission.solutionCircuit.summary.wireCount}
                              </div>
                              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text2, #475569)' }}>
                                Wiring Connections
                              </div>
                            </div>
                            <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: 'var(--card, #ffffff)', textAlign: 'center' }}>
                              <div style={{ fontSize: '16px', fontWeight: '900', color: '#8b5cf6' }}>
                                {currentActiveMission.projectMission.solutionCircuit.summary.codeLines}
                              </div>
                              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text2, #475569)' }}>
                                Sketch Code Lines
                              </div>
                            </div>
                          </div>

                          {/* 3 Student Evaluation Tasks Preview */}
                          {currentActiveMission.projectMission?.tasks?.length === 3 && (
                            <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ fontSize: '11px', fontWeight: '900', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                3 Student Evaluation Tasks (Extracted & Auto-Graded):
                              </div>
                              {currentActiveMission.projectMission.tasks.map((task, tIdx) => (
                                <div key={tIdx} style={{
                                  padding: '10px 12px', borderRadius: '8px',
                                  backgroundColor: 'var(--card, #ffffff)', border: '1px solid rgba(34, 197, 94, 0.25)',
                                  display: 'flex', flexDirection: 'column', gap: '4px'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                                      {task.title}
                                    </span>
                                    <span style={{
                                      fontSize: '10px', fontWeight: '800', textTransform: 'uppercase',
                                      color: task.phase === 'components' ? '#8b5cf6' : task.phase === 'wire' ? '#10b981' : '#3b82f6',
                                      backgroundColor: task.phase === 'components' ? 'rgba(139, 92, 246, 0.1)' : task.phase === 'wire' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                      padding: '2px 8px', borderRadius: '10px'
                                    }}>
                                      {task.phase}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text2, #475569)', whiteSpace: 'pre-line', maxHeight: '70px', overflowY: 'auto' }}>
                                    {task.instruction}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {currentActiveMission.projectMission.solutionCircuit.code && (
                            <details style={{ fontSize: '11px', color: 'var(--text2, #475569)', cursor: 'pointer' }}>
                              <summary style={{ fontWeight: '800' }}>View Decoded Solution Code Preview</summary>
                              <pre style={{
                                marginTop: '6px', padding: '10px', borderRadius: '6px',
                                backgroundColor: '#0f172a', color: '#a5f3fc',
                                fontSize: '11px', maxHeight: '120px', overflowY: 'auto'
                              }}>
                                {currentActiveMission.projectMission.solutionCircuit.code}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Certification Setup */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{
                padding: '16px', borderRadius: '12px',
                backgroundColor: certification.enabled ? 'rgba(99,102,241,0.08)' : 'var(--bg2, #f8fafc)',
                border: certification.enabled ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border, #cbd5e1)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Award size={24} color={certification.enabled ? '#4f46e5' : '#64748b'} />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>
                      Award Verifiable Course Certificate
                    </h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--text2, #475569)' }}>
                      Students receive this credential upon completing all missions across all worlds.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={certification.enabled}
                  onChange={(e) => setCertification({ ...certification, enabled: e.target.checked })}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
              </div>

              {certification.enabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '8px' }}>
                      Certificate Title
                    </label>
                    <input
                      type="text"
                      value={certification.title}
                      onChange={(e) => setCertification({ ...certification, title: e.target.value })}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '8px',
                        backgroundColor: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #cbd5e1)',
                        color: 'var(--text, #0f172a)', fontSize: '13px', fontWeight: '700'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '8px' }}>
                      Issuing Entity / Signature
                    </label>
                    <input
                      type="text"
                      value={certification.issuerName}
                      onChange={(e) => setCertification({ ...certification, issuerName: e.target.value })}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '8px',
                        backgroundColor: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #cbd5e1)',
                        color: 'var(--text, #0f172a)', fontSize: '13px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text2, #475569)', marginBottom: '8px' }}>
                      Competency Description
                    </label>
                    <textarea
                      rows={2}
                      value={certification.description}
                      onChange={(e) => setCertification({ ...certification, description: e.target.value })}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '8px',
                        backgroundColor: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #cbd5e1)',
                        color: 'var(--text, #0f172a)', fontSize: '13px'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div style={{
          padding: '16px 28px',
          borderTop: '1px solid var(--border, #e2e8f0)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: 'var(--bg2, #f8fafc)'
        }}>
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              style={{
                padding: '10px 18px', borderRadius: '10px',
                background: 'var(--card, #ffffff)', border: '1px solid var(--border, #cbd5e1)',
                color: 'var(--text, #0f172a)', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <ChevronLeft size={16} /> Back
            </button>
          ) : <div />}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              style={{
                padding: '10px 22px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #4f46e5, #4338ca)', border: 'none',
                color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
              }}
            >
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              style={{
                padding: '10px 26px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #059669, #047857)', border: 'none',
                color: '#fff', fontSize: '13px', fontWeight: '800', cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '0 4px 16px rgba(5, 150, 105, 0.35)'
              }}
            >
              <Sparkles size={16} /> {submitting ? (editingMap ? 'Saving Changes...' : 'Publishing...') : (editingMap ? 'Save & Update Map' : 'Publish Adventure Map')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
