# Asset provenance

Updated 2026-11-10. All assets are served locally; no production model or texture is hotlinked.

## Planet artwork

| Local asset                      | Origin                                                                                                           | Credit / terms                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `public/assets/planets/mars.jpg` | [threex.planets mirror](https://github.com/jeromeetienne/threex.planets/blob/master/images/marsmap1k.jpg)        | James Hastings-Trew, Planetary Pixel Emporium; game rendering use                                   |
| `mars-bump.jpg`                  | [threex.planets mirror](https://github.com/jeromeetienne/threex.planets/blob/master/images/marsbump1k.jpg)       | James Hastings-Trew; game rendering use                                                             |
| `sun.jpg`                        | [threex.planets mirror](https://github.com/jeromeetienne/threex.planets/blob/master/images/sunmap.jpg)           | James Hastings-Trew; game rendering use                                                             |
| `earth.jpg`                      | [Three.js examples](https://github.com/mrdoob/three.js/blob/dev/examples/textures/planets/earth_atmos_2048.jpg)  | Three.js example asset, [upstream MIT license](https://github.com/mrdoob/three.js/blob/dev/LICENSE) |
| `earth-clouds.png`               | [Three.js examples](https://github.com/mrdoob/three.js/blob/dev/examples/textures/planets/earth_clouds_1024.png) | Three.js example asset, upstream MIT license                                                        |

The maps were actually fetched through the connected GitHub file tools, decoded, and checked as JPEG/PNG files. Direct terminal downloads were unavailable. Git LFS pointers encountered in alternative repositories were rejected and are not included.

[Planetary Pixel Emporium usage terms](https://planetpixelemporium.com/planets.html) explicitly describe a simulator/game using maps as rendering resources as acceptable. These maps are integrated for game rendering, not offered as a standalone texture collection. Copyright remains with James Hastings-Trew. The [upstream extension README](https://github.com/jeromeetienne/threex.planets) identifies their origin. These artistic composite maps improve appearance; they are not live observations or a validated scientific elevation dataset. Local rover terrain is still fictional and procedurally generated.

## Original local artwork

The six-wheel solar rover, lander, detailed fictional launch vehicle, hangar, surface terrain, rock geometry, tracks, dust, starfield, sky shader, planet atmosphere shaders, SVG logo and PWA PNG icons are created locally from code. Sand grain/ripple maps are deterministic procedural textures. Synthesized mission audio starts only after user interaction.

The playable rover is an original fictional design, not Perseverance. No NASA model has been downloaded or integrated. NASA's [3D library](https://science.nasa.gov/3d-resources/), [Perseverance page](https://science.nasa.gov/3d-resources/mars-2020-perseverance-rover/) and [media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) were inspected earlier. No NASA insignia or implied sponsorship is used.

Scientific sources are credited separately in Science & Sources and SCIENCE.md. Software dependencies retain their licenses: React, Three.js, React Three Fiber, Drei, Zustand, Tailwind, Vite and Vitest (MIT); Lucide (ISC).

## Destination expansion

The additional local maps were fetched from the same credited rendering-resource repository and checked as actual JPEG files:

- `moon.jpg`: [moonmap1k.jpg](https://github.com/jeromeetienne/threex.planets/blob/master/images/moonmap1k.jpg), blob `189211967d4ad9d8c5c9a3b37be71e00c5724e77`.
- `jupiter.jpg`: [jupitermap.jpg](https://github.com/jeromeetienne/threex.planets/blob/master/images/jupitermap.jpg), blob `69107dfe6c975e54c50d7be8f62b1abbc45aaec1`.
- `saturn.jpg`: [saturnmap.jpg](https://github.com/jeromeetienne/threex.planets/blob/master/images/saturnmap.jpg), blob `cc9de41988376282d38e74a367f98936d4defb3d`.
- `venus.jpg`: [venusmap.jpg](https://github.com/jeromeetienne/threex.planets/blob/master/images/venusmap.jpg), blob `699f2804e25bab00686fa746c9b90c356d659e40`.

Credit: James Hastings-Trew, Planetary Pixel Emporium. The simulator/game rendering example in the linked usage terms applies. These are game rendering resources, not a separate texture-download product. The Venus source image is surface artwork; the normal preview uses an opaque, locally generated cloud shell rather than presenting that surface map as a visible-light photograph. Saturn rings, asteroid shape, workshop components, fairing cutaway, separation animation and lunar ground material are original procedural geometry/artwork. The asteroid is fictional and does not reproduce an actual mapped body. No new NASA 3D model was downloaded.

## Procedural launch catalogue and thumbnails

Vydex Scout, Pioneer and Titan are original fictional procedural models in `src/scenes/Rocket.tsx`. The same model generates local WebGL catalogue thumbnails and the hangar/countdown/ascent/separation/fairing sequence. Component thumbnails use the actual `PartGeometry` shared with the spacecraft. Images are generated in memory; no stock rocket imagery, external catalogue image requests or real-vehicle reference claims are used. VYDEX models, minimap, fairing envelope, emissive vacuum exhaust and inspection controls are project-created. Existing planet texture provenance above remains unchanged.

## Imported NASA 3D models (public/models)

Copied unchanged from NASA 3D Resources downloads (https://science.nasa.gov/3d-resources/); NASA media are generally not copyrighted, see https://www.nasa.gov/nasa-brand-center/images-and-media/. Use does not imply NASA endorsement.

| File | Source model | Used in |
| --- | --- | --- |
| `perseverance.glb` | Mars 2020 Perseverance Rover | Rover in assembly (rover part), landing payload, Mars/Moon/Mercury surface |
| `apollo-lm.glb` | Apollo Lunar Module | Lander for Moon and Mercury (powered descent + landed station) |
| `calipso.glb` | CALIPSO | Deployed Earth-orbit satellite |
| `ace.glb` | Advanced Composition Explorer | Orbiter for Venus–Neptune entry-probe missions |

Draco decoder files in `public/draco` come from three.js (MIT).
