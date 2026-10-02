# A moment — stroke-awareness proof of concept

Open index.html in a browser. No installation or build needed. All application code and imagery are local; Google Fonts has system-font fallbacks. The particle effect works when opening the page directly with a file:// URL.

The single-page scroll sequence starts on a picnic scene made from overlapping, variable-density colored particles. It zooms toward the woman's head, disperses the dots, and reveals a 3D cutaway in the brain model's superior sagittal sinus. A local viewing window shows a shaded inner wall and 3D biconcave red-cell meshes. A localized wall breach and blood collection develop with scroll. One WebGL scene and camera then pull back from that same vessel mesh to the complete brain. The viewing window closes while the actual breach remains visible at its original location. There are no visible captions or interface overlays in the vessel and brain sequences. Scroll backwards to reverse the sequence. Reduced-motion preferences freeze continuous cell motion and replace the large camera move with a change of framing. A keyboard skip link leads to the F.A.S.T. section.

This is an educational design concept, not an anatomical simulation. Not all strokes involve bleeding; the page distinguishes haemorrhagic and blocked-vessel strokes. Emergency numbers are explicitly labelled by region.

Medical content sources:
- https://strokefoundation.org.au/about-stroke/learn/signs-of-stroke
- https://strokefoundation.org.au/media/al5pyc4d/factsheet-about-stroke.pdf

Imagery: assets/meadow-centered.png is the active image, edited with the built-in imagegen tool to center the couple. assets/meadow.png retains the original. The vessel is an original animated canvas diagram.

Checked JavaScript syntax and Edge desktop/mobile renders, flow and bleed stages, overlay removal, and reduced-motion behavior. Scientific and visual sources are recorded in SOURCES.md. This deliverable is local, not published online.

Particle colors are pre-sampled from assets/meadow-centered.png and bundled in assets/meadow-centered-colors.js. This avoids canvas pixel reads, which browsers block for local-file images. Keep this color-data file alongside the image when copying the project. Internal links scroll directly to support local-file previews in isolated frames.

The 3D anatomy is adapted from Brain Project / Z-Anatomy / BodyParts3D (CC BY-SA 4.0); full source links and attribution are in SOURCES.md. Three.js and decoded meshes are bundled locally. No server is required for viewing. A schematic fallback is used when WebGL is unavailable.

To rebuild the 3D assets after editing brain3d.js, run npm install, then npm run build:brain. These are development steps only; opening index.html uses the checked-in bundles.
