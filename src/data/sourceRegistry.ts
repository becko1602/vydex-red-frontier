export const sources = {
  venusFacts: {
    title: "NASA Venus Facts (preview context)",
    url: "https://science.nasa.gov/venus/facts/",
  },
  jupiterFacts: {
    title: "NASA Jupiter Facts (preview context)",
    url: "https://science.nasa.gov/jupiter/facts/",
  },
  saturnFacts: {
    title: "NASA Saturn Facts (preview context)",
    url: "https://science.nasa.gov/saturn/facts/",
  },
  moon: {
    title: "NASA Moon Fact Sheet",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html",
  },
  earth: {
    title: "NASA Earth Fact Sheet",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html",
  },
  asteroids: {
    title: "NASA Asteroid Facts",
    url: "https://science.nasa.gov/solar-system/asteroids/facts/",
  },
  planetArt: {
    title: "Planet maps · James Hastings-Trew (rendering artwork)",
    url: "https://planetpixelemporium.com/planets.html",
  },
  earthArt: {
    title: "Earth maps · Three.js examples (artwork)",
    url: "https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets",
  },
  mars: {
    title: "NASA Mars Fact Sheet",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html",
  },
  jpl: {
    title: "JPL Astrodynamic Parameters",
    url: "https://ssd.jpl.nasa.gov/astro_par.html",
  },
  rocket: {
    title: "NASA Glenn · Ideal Rocket Equation",
    url: "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/",
  },
  atmosphere: {
    title: "NASA Glenn · Mars atmosphere (context)",
    url: "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/mars-atmosphere-equation-metric/",
  },
  comms: {
    title: "NASA · Speaking Percy’s Language",
    url: "https://science.nasa.gov/blog/speaking-percys-language-how-to-talk-so-perseverance-will-listen/",
  },
  standard: {
    title: "NIST · Standard acceleration of gravity",
    url: "https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9",
  },
  challenge: {
    title: "Space Apps 2026 challenge index (fetch unavailable)",
    url: "https://www.spaceappschallenge.org/2026/challenges/",
  },
  brief: {
    title: "Official 2026 team page reproducing the challenge brief",
    url: "https://www.spaceappschallenge.org/2026/find-a-team/missionforge/",
  },
  media: {
    title: "NASA media usage guidelines",
    url: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
  },
} as const;
export const retrievalDate = "2026-11-10";
