# Visual and scientific sources

## Imagery

No online photographs are used in the vessel sequence. The final brain overview uses the externally sourced 3D anatomy described below. The active cutaway, cells and bleed are 3D geometry and shader effects in brain3d.js. app.js retains a schematic Canvas fallback for devices without WebGL.

The picnic photograph assets/meadow-centered.png was edited using the built-in image generation tool from the original project asset assets/meadow.png; it has no external photo source URL.

## Scientific references

- Vessel wall structure: University of Leeds Histology Guide, common structure ? https://histology.leeds.ac.uk/home/circulatory/circ_common_str/
- Hemorrhagic stroke mechanism: NIH / NHLBI, stroke causes ? https://www.nhlbi.nih.gov/health/stroke/causes
- Stroke awareness guidance: Stroke Foundation ? https://strokefoundation.org.au/about-stroke/learn/signs-of-stroke

The vessel is a simplified longitudinal arterial cutaway. Wall layers, cell dimensions, motion and blood-collection growth are illustrative, not to scale or a physiological simulation. The animation depicts blood escaping through a localized wall breach into surrounding tissue.

## Brain overview

- Cerebral surface vessels and branching: The Cerebral Circulation, Anatomy and Ultrastructure ? https://www.ncbi.nlm.nih.gov/books/NBK53086/
- Bleeding within brain tissue: NINDS stroke overview ? https://www.ninds.nih.gov/health-information/stroke/stroke-overview

The fallback brain illustration is an original schematic Canvas drawing. The vessel close-up and its transition location are illustrative and do not correspond to a patient-specific lesion.

## 3D anatomy asset and attribution

- Model source: Brain Project ? https://github.com/itayinbarr/brainproject
- Downloaded model: https://github.com/itayinbarr/brainproject/blob/main/brain-atlas/models/brain.glb
- Model origin: Z-Anatomy contributors and BodyParts3D / DBCLS.
- Asset license: Creative Commons Attribution-ShareAlike 4.0 ? https://creativecommons.org/licenses/by-sa/4.0/
- Upstream license: https://github.com/itayinbarr/brainproject/blob/main/LICENSE (local copy: assets/brain-model-LICENSE.txt).
- Adaptation: selected cortical, cerebellar, brainstem, arterial and venous meshes were decoded into assets/brain-meshes.js; original anatomical geometry was retained, with presentation colors, normalization and lighting adjusted. The adapted mesh data remains under CC BY-SA 4.0. The retained original is assets/brain-source.glb.
- Accessed: 2026-10-02.

## Rendering library

- Three.js ? https://threejs.org/ and https://github.com/mrdoob/three.js
- MIT license retained in assets/three-LICENSE.txt and the bundled library.

The 3D overview uses anatomical mesh geometry rather than an image generated to look three-dimensional. It is an educational presentation, not patient imaging. Geometry is bundled locally to support file:// previews without cross-origin model fetches.

## 3D rupture and vessel connection

The close-up uses the **Superior sagittal sinus** mesh (a dural venous sinus) from the anatomical model itself. A visible point is selected by raycasting and its local center and long axis are estimated from neighboring vertices. A local shader viewing window exposes a thin inset lining; another local shader opening creates the rupture in that same vessel mesh. Cell centers follow the mesh's local curved centerline. The inner lining, biconcave red-cell meshes and transparent blood collection are original procedural additions. One scene and orthographic camera render the close-up and whole brain; there is no separate vessel illustration blended onto the brain in the WebGL path.

The selected anatomical mesh remains an adaptation under CC BY-SA 4.0. Added lining thickness, cells, opening and blood accumulation are educational, not quantitative or patient-specific. A superior sagittal sinus breach is not presented as the typical cause of spontaneous intracerebral hemorrhage.

Renderer documentation:
- https://threejs.org/docs/pages/Material.html
- https://threejs.org/docs/pages/InstancedMesh.html
- https://threejs.org/docs/pages/MeshStandardMaterial.html
