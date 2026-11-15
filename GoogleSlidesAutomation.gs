/**
 * VYDEX: RED FRONTIER — Official Google Slides Automated Deck Generator (Executive Edition)
 * 
 * Generates the full 13-slide executive presentation in English with clean white background,
 * high-contrast visual card blocks, planetary watermarks, and scientific engineering telemetry.
 * 
 * HOW TO USE IN GOOGLE APPS SCRIPT:
 * 1. Open https://script.google.com in your browser.
 * 2. Click "New Project".
 * 3. Replace all contents with this code and click Save.
 * 4. Select the function `createVydexPresentationExecutive` and click "Run".
 * 5. Review and accept permissions when prompted.
 * 6. The console Execution Log will output the direct link to the newly generated Google Slides deck.
 */

function createVydexPresentationExecutive() {
  var title = "VYDEX: RED FRONTIER — Executive Presentation (NASA Space Apps 2026)";
  var deck = SlidesApp.create(title);
  
  // Executive Color Palette
  var BG_WHITE = '#FFFFFF';
  var TEXT_DARK = '#0F172A';
  var TEXT_MUTED = '#475569';
  var COLOR_PRIMARY = '#2563EB';   // Cobalt Blue
  var COLOR_AMBER = '#D97706';     // Deep Amber
  var COLOR_EMERALD = '#059669';   // Emerald Green
  var COLOR_ORANGE = '#EA580C';    // Mars Orange
  var COLOR_RED = '#DC2626';       // Crimson
  var CARD_BG = '#F8FAFC';         // Soft Light Slate
  var CARD_BORDER = '#E2E8F0';

  // Base configuration of the 13 presentation slides
  var slidesData = [
    {
      badge: "NASA SPACE APPS CHALLENGE 2026 | MISSIONFORGE",
      title: "VYDEX: RED FRONTIER",
      subtitle: "Interactive Space Mission & Systems Engineering Simulator",
      badgeColor: COLOR_AMBER,
      boxes: [
        { text: "Turning spacecraft manifests into flyable missions: modular 3D assembly, first-principles rocket propulsion, interplanetary transfer, and planetary rover science.", x: 35, y: 120, w: 460, h: 50, color: TEXT_MUTED, size: 11, bold: false },
        { text: "16 MODULES\nFlight-Rated Assemblies", x: 35, y: 185, w: 150, h: 80, color: COLOR_PRIMARY, size: 12, bold: true },
        { text: "3 CARRIERS\nScout, Pioneer & Titan", x: 200, y: 185, w: 150, h: 80, color: COLOR_AMBER, size: 12, bold: true },
        { text: "4 WORLDS\nEarth, Moon, Mars & Asteroid", x: 365, y: 185, w: 150, h: 80, color: COLOR_ORANGE, size: 12, bold: true },
        { text: "86 AUTOMATED TESTS\n100% Deterministic Pass Rate", x: 530, y: 185, w: 155, h: 80, color: COLOR_EMERALD, size: 12, bold: true },
        { text: "KEY HIGHLIGHTS: Progressive Web App (PWA) • Three.js 60 FPS WebGL Engine • First-Principles Rocket Equation • Published NASA NSSDC & JPL Reference Constants", x: 35, y: 285, w: 650, h: 40, color: TEXT_DARK, size: 10, bold: true }
      ],
      notes: "[0:00 - 0:25] Welcome, distinguished judges and audience! Today we present VYDEX: RED FRONTIER — an interactive, physics-grounded space mission engineering simulator built for NASA Space Apps Challenge 2026."
    },
    {
      badge: "PROBLEM & SYSTEM VISION",
      title: "Bridging The Aerospace Education Divide",
      subtitle: "Transforming passive textbook theory into interactive systems engineering agency",
      badgeColor: COLOR_PRIMARY,
      boxes: [
        {
          text: "❌ CURRENT EDUCATIONAL OBSTACLES:\n• Passive Textbook Pedagogy:\n  Students memorize isolated equations without hands-on agency or hardware consequences.\n• Unrealistic Arcade Games:\n  Ignore mass conservation, power decay, and speed-of-light communication delays.\n• Expensive Proprietary Software:\n  Tools like STK have steep learning curves and prohibitive software licensing for schools.\n• Lack of Transparency:\n  Games mix fictional stats with real telemetry, leaving students misinformed.",
          x: 35, y: 120, w: 315, h: 255, color: COLOR_RED, size: 9.5, bold: false
        },
        {
          text: "✨ THE VYDEX SOLUTION: AUTHENTIC FLIGHT:\n• Manifest-to-Flight Architecture:\n  Assemble 16 genuine physical assemblies with explicit dependencies and fairing bounds.\n• First-Principles Physics Engine:\n  Tsiolkovsky delta-v, Kepler transfer, solar irradiance decay, and exponential drag.\n• Intelligent Engineering Advisor:\n  Real-time telemetry and deterministic advice explain why designs fail and how to fix them.\n• Open Scientific Transparency:\n  Every constant and formula cites NASA NSSDC, JPL, and NIST reference standards.",
          x: 370, y: 120, w: 315, h: 255, color: COLOR_EMERALD, size: 9.5, bold: false
        }
      ],
      notes: "[0:25 - 0:50] The existing aerospace education landscape suffers from a critical gap. Vydex bridges this gap by putting students in charge as chief mission architects."
    },
    {
      badge: "MISSION ARCHITECTURE",
      title: "End-to-End 9-Stage Mission Lifecycle",
      subtitle: "A complete systems engineering progression from strategic manifest to science downlink",
      badgeColor: COLOR_PRIMARY,
      boxes: [
        { text: "1. TARGET SELECTION\nEarth, Moon, Mars, Asteroid", x: 35, y: 120, w: 205, h: 70, color: COLOR_PRIMARY, size: 10.5, bold: true },
        { text: "2. SCIENCE OBJECTIVE\nImaging, Mineralogy, Drilling", x: 255, y: 120, w: 205, h: 70, color: COLOR_AMBER, size: 10.5, bold: true },
        { text: "3. LAUNCH CARRIER\nScout (4c), Pioneer (7c), Titan (10c)", x: 475, y: 120, w: 210, h: 70, color: COLOR_ORANGE, size: 10.5, bold: true },
        { text: "4. 3D WORKSHOP\n16 physical modular assemblies", x: 35, y: 205, w: 205, h: 70, color: COLOR_PRIMARY, size: 10.5, bold: true },
        { text: "5. PREFLIGHT GATE\n112-credit budget, mass & fairing", x: 255, y: 205, w: 205, h: 70, color: COLOR_EMERALD, size: 10.5, bold: true },
        { text: "6. MULTISTAGE ASCENT\nStaging & booster jettison", x: 475, y: 205, w: 210, h: 70, color: COLOR_ORANGE, size: 10.5, bold: true },
        { text: "7. TRANSFER BURN\nKepler Hohmann ellipse & correction", x: 35, y: 290, w: 205, h: 70, color: COLOR_PRIMARY, size: 10.5, bold: true },
        { text: "8. POWERED DESCENT\nRetro-thrust & rover traversal", x: 255, y: 290, w: 205, h: 70, color: COLOR_ORANGE, size: 10.5, bold: true },
        { text: "9. SCIENCE DEBRIEF\nTelemetry downlink & mission score", x: 475, y: 290, w: 210, h: 70, color: COLOR_EMERALD, size: 10.5, bold: true }
      ],
      notes: "[0:50 - 1:15] Vydex is structured around a complete 9-phase mission lifecycle from concept to sample return."
    },
    {
      badge: "LAUNCH SYSTEMS CATALOGUE",
      title: "3-Tier Launch Vehicle Family & Delivery Envelopes",
      subtitle: "Balancing launch service fees, usable fairing cylinders, and payload capacity",
      badgeColor: COLOR_ORANGE,
      boxes: [
        {
          text: "LAUNCH CARRIER SPECIFICATIONS:\n• Vydex Scout (4 credits):\n  - Height 24m | Core Ø2.4m | Stages: 2\n  - Fairing Envelope: Ø4.0m × 5.5m\n  - Capacity: LEO 520 kg (Moon/Mars: 0 kg)\n  - Maximizes credits for scientific sensors.\n\n• Vydex Pioneer (7 credits):\n  - Height 36m | Core Ø3.6m | Stages: 2\n  - Fairing Envelope: Ø5.2m × 6.5m\n  - Capacity: Earth 950 kg | Moon 800 kg | Asteroid 700 kg\n  - Optimal carrier for Lunar orbiters & Asteroid probes.\n\n• Vydex Titan (10 credits):\n  - Height 48m | Core Ø4.4m | Stages: 3\n  - Fairing Envelope: Ø6.0m × 8.0m\n  - Capacity: Earth 1800 kg | Moon 1400 kg | Mars 1200 kg\n  - Heavy-lift provider with paired strap-on boosters.",
          x: 35, y: 120, w: 650, h: 260, color: TEXT_DARK, size: 9.5, bold: false
        }
      ],
      notes: "[1:15 - 1:40] To emphasize realistic aerospace trade-offs, we built a 3-tier launch vehicle catalogue: Scout, Pioneer, and Titan."
    },
    {
      badge: "MODULAR SPACECRAFT ENGINEERING",
      title: "Spacecraft Workshop: 16 Flight-Rated Assemblies",
      subtitle: "Modular assembly with physical mounting hierarchies, 3D exploded view, and mass tracking",
      badgeColor: COLOR_PRIMARY,
      boxes: [
        {
          text: "16 PHYSICAL FLIGHT ASSEMBLIES:\n• Structure & Propulsion:\n  Central Bus Platform, Propellant Tanks, Cruise Deck, Cruise Engine (with RCS), Descent Engine, Quad Legs.\n• Power, Avionics & Telecommunications:\n  600 Wh Lithium-Ion Battery, Solar Array Wings (flux-cosine tracking), Navigation Computer (20W), Deep Space Antenna (30W RF downlink).\n• Science Payload & Surface Mobility:\n  Optical Camera, Multi-Spectral APXS, Rotary Core Drill, Sampling Arm, 6-Wheel Exploration Rover.",
          x: 35, y: 120, w: 320, h: 260, color: COLOR_PRIMARY, size: 9.2, bold: false
        },
        {
          text: "INTERACTIVE 3D INSPECTION MODES:\n🔍 Exploded View Technology:\n   Dynamically separates nested internal subsystems for visual inspection of connectors, tanks, and avionics.\n\n🔒 Strict Dependency & Mount Graphs:\n   The cruise engine strictly requires the cruise deck; the drill requires the rover platform. Invalid placements are flagged.\n\n📦 Usable Fairing Envelope Bounds:\n   Visualizes the chosen rocket's protective fairing as a 3D wireframe cylinder. Protruding solar arrays trigger launch aborts.\n\n⚖️ Instant Mass & Financial Accounting:\n   Every module installation updates wet mass, dry mass, center of gravity, delta-v, and remaining credits in real time.",
          x: 370, y: 120, w: 315, h: 260, color: COLOR_ORANGE, size: 9.2, bold: false
        }
      ],
      notes: "[1:40 - 2:05] The spacecraft workshop features 16 physical modules with strict mounting dependencies."
    },
    {
      badge: "MATHEMATICAL & SCIENTIFIC RIGOR",
      title: "First-Principles Physics & Solar Energy Decay",
      subtitle: "Deterministic formulation of propulsion, orbital transfer, and irradiance decay",
      badgeColor: COLOR_AMBER,
      boxes: [
        {
          text: "KEY MATHEMATICAL FORMULATIONS:\n1. Ideal Rocket Equation (Tsiolkovsky):\n   Δv = Isp · g₀ · ln(m_wet / m_dry)\n   Fuel mass flow rate: ṁ = T / (Isp · g₀).\n   Propellant depletion halts thrust instantly.\n\n2. Keplerian Hohmann Interplanetary Transfer:\n   Semi-major axis: a = (r_Earth + r_Mars) / 2\n   Transfer time: T = π · √(a³ / μ_Sun) ≈ 259 days\n   Kepler's Equation: E - e · sin(E) = M solved via Newton iteration.\n\n3. Inverse-Square Solar Flux & Power Decay:\n   Flux = 1361 · (1 AU / r)² W/m²\n   Mars receives ~586 W/m² (43% of Earth).\n   Atmospheric dust factor (0.72) reduces generation to ~57W.",
          x: 35, y: 120, w: 650, h: 260, color: TEXT_DARK, size: 9.5, bold: false
        }
      ],
      notes: "[2:05 - 2:30] Scientific fidelity is the bedrock of Vydex. Trajectory planning solves Kepler's equation using Newton iteration for the transfer ellipse."
    },
    {
      badge: "PLANETARY ENVIRONMENTS",
      title: "4 Distinct Playable Worlds & Environmental Physics",
      subtitle: "Custom gravity, atmospheric drag profiles, and science objectives for each celestial body",
      badgeColor: COLOR_PRIMARY,
      boxes: [
        {
          text: "1. EARTH ORBIT (LEO):\n• Reference: 400 km circular parking orbit\n• Objective: 3-axis attitude stabilization, solar array deployment, 8s optical Earth observation\n• Physics: Reaction wheels avionics control; circular orbital speed preserved\n\n2. MOON SCIENCE LANDING:\n• Reference: Airless lunar regolith datum\n• Objective: Deploy stationary science station, capture high-res panorama & mineral spectrum\n• Physics: g = 1.62 m/s², zero atmospheric drag (100% retro-propulsive deceleration)",
          x: 35, y: 120, w: 315, h: 255, color: COLOR_PRIMARY, size: 9.2, bold: false
        },
        {
          text: "3. MARS ROVER EXPEDITION:\n• Reference: Thin atmosphere & rocky terrain\n• Objective: Hohmann transfer, 500m powered descent, rover deployment, spectral scans & rock drilling\n• Physics: g = 3.73 m/s², exponential drag (ρ=0.016·e^(-h/11000)), speed-of-light comms latency\n\n4. ASTEROID VY-26 RENDEZVOUS:\n• Reference: 8m near-Earth body, 10m safety zone\n• Objective: Approach within 5m at <0.35 m/s, optical scan & contact sample collection\n• Physics: Negligible gravity, zero drag; 3D translation via cruise RCS pulses",
          x: 370, y: 120, w: 315, h: 255, color: COLOR_ORANGE, size: 9.2, bold: false
        }
      ],
      notes: "[2:30 - 2:55] Vydex offers 4 distinct playable environments, each governed by authentic planetary parameters."
    },
    {
      badge: "POWERED DESCENT & SURFACE MOBILITY",
      title: "Terminal Descent Dynamics & Rover Operations",
      subtitle: "Critical 500m powered braking, touchdown gate constraints, and autonomous command queue",
      badgeColor: COLOR_ORANGE,
      boxes: [
        {
          text: "POWERED DESCENT & ROVER SCIENCE:\n• Critical Descent Gate (500m to 0m):\n  - Ignition at 500m datum with initial v_z = -12.0 m/s.\n  - Strict Touchdown Limits:\n    * Vertical velocity: v_z < 3.0 m/s\n    * Horizontal velocity: v_xy < 2.0 m/s\n    * Spacecraft tilt: θ < 12.0°\n  - Braking Assist Controller: Closed-loop velocity feedback trims throttle while consuming actual propellant.\n\n• Autonomous Rover & Earth Command Queue:\n  - Direct Drive Mode: Real-time WASD traversal.\n  - Command Queue Mode: Simulates 3-22 min light-speed delay; commands queued on Earth, executed autonomously.\n  - Energy Accounting: Base (20W) + Heater (8W) + Driving (80W + slope up to 50W) + APXS/Drill + Downlink (30W).",
          x: 35, y: 120, w: 650, h: 260, color: TEXT_DARK, size: 9.5, bold: false
        }
      ],
      notes: "[2:55 - 3:20] Terminal descent is the most intense phase of the Mars mission."
    },
    {
      badge: "AI & DETERMINISTIC ADVISOR",
      title: "Intelligent Engineering Advisor Subsystem",
      subtitle: "Real-time constraint verification, power deficit modeling, and actionable remedies",
      badgeColor: COLOR_PRIMARY,
      boxes: [
        {
          text: "WHAT THE ADVISOR MONITORS IN REAL TIME:\n⚡ Power Generation vs Load:\n   Calculates tracked solar generation at destination orbital radius against base avionics (20W), heater (8W), active scientific instruments, and high-gain transmitter (30W).\n\n🔋 Battery Endurance & Mission Depletion:\n   Computes exact mission endurance hours:\n   Endurance = Battery Wh / (Load - Generation)\n   Identifies potential blackout before launch authorization.\n\n📐 Usable Fairing Clearance:\n   Evaluates 3D geometric bounding cylinder to prevent stowed hardware from colliding with fairing walls.\n\n🚀 Delta-V Maneuver Reserves:\n   Validates cruise correction reserve (120 m/s) and landing engine thrust-to-weight ratio.",
          x: 35, y: 120, w: 315, h: 255, color: COLOR_PRIMARY, size: 9.2, bold: false
        },
        {
          text: "ACTIONABLE REMEDIES & ROOT CAUSE GUIDANCE:\n💡 Budget Overrun:\n   'Replace expensive heavy carrier or remove optional instruments. Reducing propellant frees mass but review delta-v.'\n\n💡 Fairing Envelope Conflict:\n   'Choose a wider or taller carrier fairing. Reducing propellant mass does NOT shrink physical hardware dimensions.'\n\n💡 Power Deficit Warning:\n   'Install solar array wings and high-capacity battery. Mars orbital distance drops irradiance by 57%.'\n\n💡 Inadequate Landing Authority:\n   'Descent engine missing or wet mass exceeds thrust capability. Optimize dry mass or adjust propellant fill.'",
          x: 370, y: 120, w: 315, h: 255, color: COLOR_EMERALD, size: 9.2, bold: false
        }
      ],
      notes: "[3:20 - 3:45] Our newly integrated Intelligent Engineering Advisor acts as an onboard mentor."
    },
    {
      badge: "SOFTWARE ENGINEERING ARCHITECTURE",
      title: "Modern Full-Stack Architecture & High-Performance WebGL",
      subtitle: "Modular React 19 component hierarchy, deterministic physics cores, and zero-latency PWA",
      badgeColor: COLOR_PRIMARY,
      boxes: [
        {
          text: "FRONTEND & 3D RENDERING ENGINE:\n• React 19 & TypeScript 5.9:\n  - Declarative component tree with strict compile-time type verification.\n  - Zero 'any' types across the entire mathematical simulation codebase.\n\n• Three.js, React Three Fiber & Drei:\n  - High-performance 60 FPS WebGL rendering with procedural planetary surfaces.\n  - Dynamic Orbit Controls, exploded assemblies, cutaway inspections, and multi-angle camera rigs.\n  - Adaptive GPU scaling: Low, Medium, and High graphics presets for broad hardware accessibility.\n\n• Tailwind CSS v4 & Lucide Icons:\n  - Sleek telemetry heads-up display (HUD) and responsive control panels.",
          x: 35, y: 120, w: 315, h: 255, color: COLOR_PRIMARY, size: 9.2, bold: false
        },
        {
          text: "DETERMINISTIC SIMULATION & OFFLINE PWA:\n• Zustand Reactive State Machine:\n  - Decoupled mission lifecycle (Destination → Assembly → Cruise → Surface → Debrief).\n  - Version-3 save/load serialization with local storage persistence.\n\n• Pure Function Simulation Cores:\n  - Independent physics, orbital mechanics, and power budgeting modules.\n  - 100% deterministic mathematical execution for reliable reproducible results.\n\n• Progressive Web App (PWA) Offline-First:\n  - Custom Service Worker caches all 3D geometries, textures, and assets.\n  - Fully playable in classrooms, libraries, or remote areas without internet or external servers.",
          x: 370, y: 120, w: 315, h: 255, color: COLOR_AMBER, size: 9.2, bold: false
        }
      ],
      notes: "[3:45 - 4:10] Under the hood, Vydex is engineered with cutting-edge web technologies: React 19, TypeScript 5.9, and Three.js."
    },
    {
      badge: "RIGOROUS VERIFICATION & QA",
      title: "Subsystem Verification & 86 Automated Test Cases",
      subtitle: "Comprehensive unit, integration, and end-to-end regression testing suite",
      badgeColor: COLOR_EMERALD,
      boxes: [
        {
          text: "VERIFICATION & METRICS OVERVIEW:\n• 86 Automated Tests (100% Pass Rate):\n  - Vitest test suite executing across 6 dedicated test suites.\n  - Tsiolkovsky delta-v, staged fuel burn, and gravity calculations verified.\n  - Complete campaign journeys and failure retry recovery tested.\n\n• Architectural Soundness:\n  - Strict TypeScript compilation (tsc -b) ensures zero runtime type discrepancies.\n  - Advisor regression tests verify deterministic remedies across all scenarios.\n\n• Responsive Display Compatibility:\n  - Form factor testing verified from mobile viewports (390×844) to 4K displays.\n  - Playwright browser automation test scripts configured for continuous integration.",
          x: 35, y: 120, w: 650, h: 260, color: TEXT_DARK, size: 9.5, bold: false
        }
      ],
      notes: "[4:10 - 4:35] Reliability and mathematical accuracy are verified through 86 automated unit and integration tests."
    },
    {
      badge: "STRATEGIC EXPANSION ROADMAP",
      title: "Roadmap: From Simulator to Global Aerospace Platform",
      subtitle: "Upcoming milestones for collaborative mission control, deep space worlds, and STEM curriculum",
      badgeColor: COLOR_AMBER,
      boxes: [
        {
          text: "PHASE 1: MULTIPLAYER MISSION CONTROL\n• 4-Player Synchronous Collaborative Flight:\n  - Role-based specialization: Chief Flight Director, Propulsion Engineer, Trajectory Specialist, and Surface Rover Navigator.\n  - Authoritative multi-user mission state with distributed command authorization.\n\nPHASE 2: OUTER SOLAR SYSTEM EXPLORATION\n• Playable Gas Giant & Atmospheric Probe Missions:\n  - Expand educational previews of Venus, Jupiter, and Saturn into full playable orbiter and atmospheric probe missions.\n  - Incorporate radiation belt modeling and gravitational slingshot trajectory planning.",
          x: 35, y: 120, w: 315, h: 255, color: COLOR_PRIMARY, size: 9.2, bold: false
        },
        {
          text: "PHASE 3: STEM CLASSROOM LAB ECOSYSTEM\n• Teacher Dashboard & Lesson Modules:\n  - Ready-made aerospace curriculum modules for physics and engineering educators.\n  - Downloadable post-flight telemetric mission reports with graded student performance metrics.\n\nPHASE 4: WEBXR & NATIVE ECOSYSTEM\n• Spatial Computing & Cross-Platform:\n  - WebXR spatial headset support: inspect and assemble 3D spacecraft modules in augmented reality.\n  - Native packaging for iOS, Android, and Steam via Capacitor and Electron.",
          x: 370, y: 120, w: 315, h: 255, color: COLOR_EMERALD, size: 9.2, bold: false
        }
      ],
      notes: "[4:35 - 5:00] Looking ahead, our roadmap is structured to expand Vydex into a global educational standard."
    },
    {
      badge: "CONCLUSION & DEMONSTRATION",
      title: "VYDEX: Empowering The Next Generation of Explorers",
      subtitle: "Authentic aerospace engineering education, open to every student, everywhere",
      badgeColor: COLOR_PRIMARY,
      boxes: [
        {
          text: "KEY STRATEGIC TAKEAWAYS:\n🚀 Experiential Systems Engineering:\n   Turns abstract orbital equations into tangible 3D hardware assembly, mass trade-offs, and flight consequences.\n\n🔬 Uncompromising Scientific Integrity:\n   Grounds all propulsion, orbital transfer, atmospheric drag, and solar energy models in published NASA NSSDC and JPL standards.\n\n🌐 Democratizing Aerospace Education:\n   100% browser-based, zero-server operational costs, and fully offline-capable for universal global accessibility.",
          x: 35, y: 120, w: 350, h: 255, color: COLOR_PRIMARY, size: 10.0, bold: false
        },
        {
          text: "PROJECT METADATA & LIVE DEMO:\n• Project: VYDEX: RED FRONTIER\n• Event: NASA Space Apps Challenge 2026\n• Category: MissionForge\n• Team: Team Vydex (Mission, Simulation, UX)\n• Stack: React 19, Three.js, Zustand, Vite\n• Quality: 86 Automated Tests Passing\n\n⭐ THANK YOU!\nWe welcome your questions and look forward to demonstrating the live simulator.",
          x: 405, y: 120, w: 280, h: 255, color: COLOR_ORANGE, size: 9.5, bold: false
        }
      ],
      notes: "[5:00 - 5:25] In conclusion, VYDEX: RED FRONTIER demonstrates that complex aerospace engineering can be made accessible, beautiful, and interactive without dumbing down the science."
    }
  ];

  // Remove initial blank slide
  var initialSlides = deck.getSlides();
  
  for (var i = 0; i < slidesData.length; i++) {
    var data = slidesData[i];
    var slide = deck.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    slide.getBackground().setSolidFill(BG_WHITE);

    // Badge Pill
    var badgeBox = slide.insertTextBox(data.badge, 35, 25, 450, 22);
    badgeBox.getText().getTextStyle().setFontSize(10).setBold(true).setForegroundColor(data.badgeColor);

    // Main Title
    var titleBox = slide.insertTextBox(data.title, 35, 47, 640, 40);
    titleBox.getText().getTextStyle().setFontSize(20).setBold(true).setForegroundColor(TEXT_DARK);

    // Subtitle
    if (data.subtitle) {
      var subtitleBox = slide.insertTextBox(data.subtitle, 35, 87, 640, 24);
      subtitleBox.getText().getTextStyle().setFontSize(11).setForegroundColor(TEXT_MUTED);
    }

    // Information Card Blocks
    for (var j = 0; j < data.boxes.length; j++) {
      var box = data.boxes[j];
      var textBox = slide.insertTextBox(box.text, box.x, box.y, box.w, box.h);
      var style = textBox.getText().getTextStyle();
      style.setFontSize(box.size).setForegroundColor(box.color);
      if (box.bold) {
        style.setBold(true);
      }
    }

    // Speaker Notes
    if (data.notes) {
      slide.getNotesPage().getSpeakerNotesShape().getText().setText(data.notes);
    }
  }

  // Remove first initial default slide
  if (initialSlides.length > 0) {
    initialSlides[0].remove();
  }

  Logger.log("🎉 SUCCESS! Presentation created successfully:");
  Logger.log(deck.getUrl());
}
