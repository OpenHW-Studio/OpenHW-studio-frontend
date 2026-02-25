# OpenHW Studio
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Monaco Editor](https://img.shields.io/badge/Monaco_Editor-latest-007ACC?logo=visualstudiocode&logoColor=white)

---

## Tech Stack

| Layer         | Technology                                         |
| ------------- | -------------------------------------------------- |
| **Framework** | React 18                                           |
| **Bundler**   | Vite 7                                             |
| **Styling**   | Vanilla CSS with custom properties (design tokens) |
| **Editor**    | Monaco Editor (`@monaco-editor/react`)             |
| **Font**      | Inter (Google Fonts)                               |

---

## Features

### Toolbar

| Element              | Description                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| **Logo**             | "OpenHW Studio" branding with a gradient hex icon (blue → purple)                               |
| **Run button**       | Green accent button with a play ▶ icon — starts the circuit simulation                          |
| **Reset button**     | Ghost-style button with a circular arrow icon — resets the simulation                            |
| **Code button**      | Blue accent button with `</>` icon — toggles the Monaco code editor panel on the right side     |
| **Block button**     | Ghost-style button with a grid icon — placeholder for block-based (Scratch-like) coding mode    |
| **User profile**     | Circular avatar with a blue-to-purple gradient and a person icon                                |
| **More menu (⋮)**    | Three-dot menu beside the profile; dropdown with **Help & Docs** and **Download project as PNG**|

- The **Code** button shows an active/pressed state when the editor is open
- Ghost buttons (Reset, Block) have a subtle border and darken on hover
- All buttons have a micro scale-on-press animation

### Component Sidebar (Left Panel)

| Element            | Description                                                          |
| ------------------ | -------------------------------------------------------------------- |
| **Title**          | "COMPONENTS" uppercase label                                        |
| **Search bar**     | Real-time filtering — type to instantly filter the component list    |
| **Component cards**| 10 draggable hardware components with icon, name, and description   |

**Available components:**

| Component          | Description           |
| ------------------ | --------------------- |
| Arduino Uno        | Microcontroller board |
| LED                | Light emitting diode  |
| Resistor           | Current limiter       |
| Pushbutton         | Momentary switch      |
| Buzzer             | Sound output          |
| Servo Motor        | Angular actuator      |
| Potentiometer      | Variable resistor     |
| LCD Display        | 16×2 character display|
| Seven Segment      | Numeric display       |
| Ultrasonic Sensor  | Distance sensor       |

- Each card has a **grab cursor** on hover and a **grabbing cursor** on press
- Smooth hover background transition
- Custom thin scrollbar styling
- "No components found" empty state with icon

### Canvas (Center Workspace)

| Element              | Description                                                   |
| -------------------- | ------------------------------------------------------------- |
| **Dot grid**         | 24×24 px repeating radial-gradient dot pattern                |
| **Placeholder**      | Dashed border box with icon + "Drag components here to start" |
| **Fade-in animation**| Placeholder fades in on first load                            |

### Code Editor (Right Panel)

| Element              | Description                                                        |
| -------------------- | ------------------------------------------------------------------ |
| **Header bar**       | Shows `sketch.ino` filename with a code icon and ✕ close button    |
| **Monaco Editor**    | Full-featured code editor with C++ / Arduino syntax highlighting   |
| **Default sketch**   | Pre-loaded Arduino blink example (`setup()` + `loop()`)            |
| **Slide-in animation** | Panel slides in from the right when opened                       |

**Editor settings:**
- Theme: `vs-light`
- Font: JetBrains Mono / Fira Code / Cascadia Code fallback
- Font size: 13px
- Minimap: disabled
- Bracket pair colorization: enabled
- Smooth scrolling and cursor animation
- Word wrap: on
- Panel width: 420px

### More Menu (⋮ Dropdown)

| Action                      | Description                                |
| --------------------------- | ------------------------------------------ |
| **Help & Docs**             | Opens help and documentation               |
| **Download project as PNG** | Export the current circuit view as an image |

- Opens on click, closes on click-outside
- Smooth fade-in animation
- Hover highlight on menu items

---

## Design System

Clean, white-themed UI built on CSS custom properties:

| Token             | Value                        |
| ----------------- | ---------------------------- |
| `--bg`            | `#f8fafc` (page background)  |
| `--surface`       | `#ffffff` (panels)           |
| `--border`        | `#e2e8f0`                    |
| `--text`          | `#1e293b`                    |
| `--text-muted`    | `#94a3b8`                    |
| `--primary`       | `#2563eb` (blue)             |
| `--success`       | `#16a34a` (green)            |
| `--transition`    | `150ms ease`                 |
| `--radius-sm`     | `6px`                        |
| `--radius-full`   | `20px` (pill buttons)        |
| `--shadow-sm`     | `0 1px 3px rgba(0,0,0,0.06)` |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Production build
npm run build
```

The dev server runs at **http://localhost:5173/**

---

## Project Structure

```
src/
├── components/
│   ├── Toolbar.jsx       # Top bar — logo, action buttons, profile, menu
│   ├── Sidebar.jsx       # Left panel — search + component palette
│   ├── Canvas.jsx        # Center — dot-grid workspace
│   └── CodeEditor.jsx    # Right panel — Monaco code editor
├── App.jsx               # Root layout + state management
├── App.css               # (cleared — styles live in index.css)
├── index.css             # Design system + all component styles
└── main.jsx              # Entry point
```
