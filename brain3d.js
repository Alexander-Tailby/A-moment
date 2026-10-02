import * as THREE from "three";

// Runtime renderer. All mesh data and library code are bundled locally.
function decode(value, Type) {
  const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  return new Type(bytes.buffer);
}

function createBrainModel() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
  } catch {
    return null;
  }
  renderer.setSize(1024, 1024, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  const anatomy = new THREE.Group();
  const model = new THREE.Group();
  model.add(anatomy);
  scene.add(model);
  const materials = {
    cortex: new THREE.MeshStandardMaterial({
      color: 0xd3c3b2,
      roughness: 0.86,
      metalness: 0,
    }),
    cerebellum: new THREE.MeshStandardMaterial({
      color: 0xc4b29e,
      roughness: 0.88,
    }),
    brainstem: new THREE.MeshStandardMaterial({
      color: 0xc5b7a7,
      roughness: 0.9,
    }),
    arteries: new THREE.MeshStandardMaterial({
      color: 0x9a4540,
      roughness: 0.7,
    }),
    veins_sinuses: new THREE.MeshStandardMaterial({
      color: 0x687b89,
      roughness: 0.8,
    }),
  };
  const cortexBounds = new THREE.Box3();
  for (const part of window.BRAIN_MESHES) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(decode(part.positions, Float32Array), 3),
    );
    geometry.setIndex(
      new THREE.BufferAttribute(decode(part.indices, Uint32Array), 1),
    );
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, materials[part.category]);
    mesh.name = part.name;
    anatomy.add(mesh);
    if (part.category === "cortex") cortexBounds.expandByObject(mesh);
  }
  const center = cortexBounds.getCenter(new THREE.Vector3());
  const dimensions = cortexBounds.getSize(new THREE.Vector3());
  const normalize = 460 / Math.max(dimensions.x, dimensions.y, dimensions.z);
  anatomy.position.copy(center).multiplyScalar(-normalize);
  anatomy.scale.setScalar(normalize);
  const camera = new THREE.OrthographicCamera(-300, 300, 300, -300, 1, 3000);
  camera.position.set(0, 190, 800);
  camera.lookAt(0, -15, 0);
  scene.add(new THREE.HemisphereLight(0xfff7ed, 0x786b61, 2.1));
  const key = new THREE.DirectionalLight(0xfff5e8, 3.2);
  key.position.set(-350, 450, 600);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdde7ef, 1.0);
  fill.position.set(400, 80, -200);
  scene.add(fill);
  // Anchor the close-up to a visible point on a real venous mesh.
  const selectedVessel = anatomy.getObjectByName("Superior sagittal sinus");
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const setView = (progress) => {
    model.rotation.y = Math.PI - 0.25 + progress * 0.65;
    model.rotation.x = -0.08 + progress * 0.12;
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
  };
  setView(1);
  let selectedPoint = null;
  let bestScore = Infinity;
  for (let x = -0.35; x <= 0.35; x += 0.025) {
    for (let y = -0.15; y <= 0.6; y += 0.025) {
      pointer.set(x, y);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(anatomy.children, false)[0];
      if (hit?.object !== selectedVessel) continue;
      const score = (x - 0.07) ** 2 + (y - 0.15) ** 2;
      if (score < bestScore) {
        bestScore = score;
        selectedPoint = selectedVessel.worldToLocal(hit.point.clone());
      }
    }
  }
  if (!selectedPoint) {
    selectedVessel.geometry.computeBoundingBox();
    selectedPoint = selectedVessel.geometry.boundingBox.getCenter(
      new THREE.Vector3(),
    );
  }
  // Fit the local long axis of the vessel from nearby mesh vertices.
  const positions = selectedVessel.geometry.attributes.position;
  const points = [];
  const bounds = new THREE.Box3().setFromBufferAttribute(positions);
  const neighborhood = bounds.getSize(new THREE.Vector3()).length() * 0.055;
  for (let i = 0; i < positions.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(positions, i);
    if (point.distanceTo(selectedPoint) < neighborhood) points.push(point);
  }
  const mean = new THREE.Vector3();
  for (const point of points) mean.add(point);
  mean.divideScalar(Math.max(1, points.length));
  let tangent = new THREE.Vector3(0, 1, 0);
  for (let iteration = 0; iteration < 12; iteration++) {
    const next = new THREE.Vector3();
    for (const point of points) {
      const delta = point.clone().sub(mean);
      next.addScaledVector(delta, delta.dot(tangent));
    }
    if (next.lengthSq()) tangent = next.normalize();
  }
  selectedPoint.copy(mean);
  // Build the close-up inside the actual anatomical vessel, not a second tube.
  setView(1);
  const radialDistances = points
    .map((point) => {
      const delta = point.clone().sub(selectedPoint);
      return delta.addScaledVector(tangent, -delta.dot(tangent)).length();
    })
    .sort((a, b) => a - b);
  const radius = radialDistances[Math.floor(radialDistances.length * 0.6)];
  const inverseWorld = selectedVessel.matrixWorld.clone().invert();
  const viewDirection = camera.position
    .clone()
    .sub(new THREE.Vector3(0, -15, 0))
    .normalize();
  const front = viewDirection.clone().transformDirection(inverseWorld);
  front.addScaledVector(tangent, -front.dot(tangent)).normalize();
  const side = new THREE.Vector3().crossVectors(front, tangent).normalize();
  const uniforms = {
    focus: { value: selectedPoint },
    axis: { value: tangent },
    front: { value: front },
    side: { value: side },
    radius: { value: radius },
    cutaway: { value: 1 },
    rupture: { value: 0 },
  };
  function vesselMaterial(color, inside = false) {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.84,
      side: THREE.DoubleSide,
    });
    material.customProgramCacheKey = () => `vessel-study-${inside}`;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader =
        "varying vec3 studyPosition;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nstudyPosition = position;",
      );
      shader.fragmentShader =
        `
        varying vec3 studyPosition;
        uniform vec3 focus, axis, front, side;
        uniform float radius, cutaway, rupture;
      ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <clipping_planes_fragment>",
        `
        #include <clipping_planes_fragment>
        vec3 offset = studyPosition - focus;
        float along = dot(offset, axis);
        vec3 radial = offset - axis * along;
        // The front half is removed only for the close-up viewing window.
        if (cutaway > 0.001 && abs(along) < radius * 18.0 &&
            dot(radial, front) > mix(radius * 2.0, -radius * 0.03, cutaway)) discard;
        // A localized breach remains in the same mesh throughout the pullback.
        float opening = radius * 0.72 * rupture;
        if (rupture > 0.001 && abs(along) < opening * (0.88 + 0.12 * sin(dot(radial, front) / radius * 7.0)) &&
            dot(radial, side) > radius * 0.25 &&
            dot(radial, front) > -radius * 0.8) discard;
        ${inside ? "if (abs(along) > radius * 18.0) discard;" : ""}
      `,
      );
    };
    return material;
  }
  selectedVessel.material = vesselMaterial(0x687b89);
  const innerGeometry = selectedVessel.geometry.clone();
  const innerPositions = innerGeometry.attributes.position;
  const normals = innerGeometry.attributes.normal;
  for (let i = 0; i < innerPositions.count; i++) {
    const vertex = new THREE.Vector3().fromBufferAttribute(innerPositions, i);
    const normal = new THREE.Vector3().fromBufferAttribute(normals, i);
    vertex.addScaledVector(normal, -radius * 0.11);
    innerPositions.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  innerGeometry.computeVertexNormals();
  const innerWall = new THREE.Mesh(
    innerGeometry,
    vesselMaterial(0xc39286, true),
  );
  anatomy.add(innerWall);

  // Small biconcave cells are real meshes, with shading and depth occlusion.
  const cellGeometry = new THREE.SphereGeometry(1, 16, 12);
  const cellPositions = cellGeometry.attributes.position;
  for (let i = 0; i < cellPositions.count; i++) {
    const x = cellPositions.getX(i),
      y = cellPositions.getY(i),
      z = cellPositions.getZ(i);
    const rim = Math.min(1, Math.hypot(x, z));
    cellPositions.setY(i, y * (0.18 + 0.36 * rim ** 2));
  }
  cellGeometry.computeVertexNormals();
  const bloodMaterial = new THREE.MeshStandardMaterial({
    color: 0x9e4945,
    roughness: 0.78,
  });
  const cells = new THREE.InstancedMesh(cellGeometry, bloodMaterial, 52);
  const escapedCells = new THREE.InstancedMesh(cellGeometry, bloodMaterial, 24);
  cells.frustumCulled = escapedCells.frustumCulled = false;
  anatomy.add(cells, escapedCells);
  const collection = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 20),
    new THREE.MeshStandardMaterial({
      color: 0x934b48,
      roughness: 1,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  anatomy.add(collection);
  const centerSamples = [];
  for (let sample = -16; sample <= 16; sample++) {
    const position = new THREE.Vector3();
    let count = 0;
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3().fromBufferAttribute(positions, i);
      const along = vertex.clone().sub(selectedPoint).dot(tangent);
      if (Math.abs(along - sample * radius) < radius * 0.7) {
        position.add(vertex);
        count++;
      }
    }
    centerSamples.push(
      count
        ? position.divideScalar(count)
        : selectedPoint.clone().addScaledVector(tangent, sample * radius),
    );
  }
  const cellCenter = (travel) => {
    const location = Math.max(0, Math.min(31.999, travel / radius + 16));
    const index = Math.floor(location);
    return centerSamples[index]
      .clone()
      .lerp(centerSamples[index + 1], location - index);
  };
  const dummy = new THREE.Object3D();
  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const ease = (value) => {
    value = clamp01(value);
    return value * value * (3 - 2 * value);
  };
  const worldFocus = selectedVessel.localToWorld(selectedPoint.clone());
  const worldRadius = radius * normalize;
  const worldTangent = tangent
    .clone()
    .transformDirection(selectedVessel.matrixWorld);
  const closeDirection = viewDirection
    .clone()
    .applyAxisAngle(worldTangent, 0.22);
  const closeUp = new THREE.Vector3()
    .crossVectors(closeDirection, worldTangent)
    .normalize();
  const orientationCamera = camera.clone();
  orientationCamera.up.copy(closeUp);
  orientationCamera.position
    .copy(worldFocus)
    .addScaledVector(closeDirection, 800);
  orientationCamera.lookAt(worldFocus);
  const closeOrientation = orientationCamera.quaternion.clone();
  const finalOrientation = camera.quaternion.clone();
  const cameraTarget = new THREE.Vector3();
  const originalMeshes = anatomy.children.filter(
    (child) =>
      ![selectedVessel, innerWall, cells, escapedCells, collection].includes(
        child,
      ),
  );
  let lastSequenceFrame = "";

  function renderSequence(context, width, height, progress, time, reduced) {
    const pullback = ease((progress - 0.78) / 0.19);
    const framing = ease((pullback - 0.35) / 0.65);
    const cutaway = 1 - ease((pullback - 0.25) / 0.5);
    const rupture = ease((progress - 0.62) / 0.08);
    const bleed = ease((progress - 0.64) / 0.13);
    const reveal = ease((pullback - 0.04) / 0.38);
    const moving = cutaway > 0 && !reduced;
    const frameKey = `${width},${height},${progress},${moving ? time : 0},${reduced}`;
    if (lastSequenceFrame !== frameKey) {
      setView(1);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const renderWidth = Math.round(width * dpr),
        renderHeight = Math.round(height * dpr);
      if (
        renderer.domElement.width !== renderWidth ||
        renderer.domElement.height !== renderHeight
      ) {
        renderer.setSize(renderWidth, renderHeight, false);
      }
      const aspect = width / height;
      const closeHeight = worldRadius * 4.6;
      const farHeight = Math.max(300, 300 / aspect);
      const zoomProgress = reduced ? (pullback > 0.5 ? 1 : 0) : pullback;
      const halfHeight = Math.exp(
        Math.log(closeHeight) * (1 - zoomProgress) +
          Math.log(farHeight) * zoomProgress,
      );
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      cameraTarget
        .copy(worldFocus)
        .lerp(new THREE.Vector3(0, -15, 0), reduced ? zoomProgress : framing);
      camera.quaternion
        .copy(closeOrientation)
        .slerp(finalOrientation, zoomProgress);
      camera.position
        .copy(cameraTarget)
        .addScaledVector(
          new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
          800,
        );
      camera.updateMatrixWorld(true);
      uniforms.cutaway.value = reduced && zoomProgress === 1 ? 0 : cutaway;
      uniforms.rupture.value = rupture;
      for (const mesh of originalMeshes) mesh.visible = reveal > 0.001;
      for (const material of Object.values(materials)) {
        const transparent = reveal < 0.999;
        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.needsUpdate = true;
        }
        material.opacity = reveal;
        material.depthWrite = !transparent;
      }
      innerWall.visible = cutaway > 0.001;
      cells.visible = cutaway > 0.35;
      escapedCells.visible = bleed > 0;
      const clock = reduced ? 0 : time * 0.000015;
      for (let i = 0; i < 52; i++) {
        const travel = (((i * 0.618 + clock) % 1) - 0.5) * radius * 22;
        dummy.position
          .copy(cellCenter(travel))
          .addScaledVector(side, Math.sin(i * 2.31) * radius * 0.25)
          .addScaledVector(front, Math.cos(i * 4.1) * radius * 0.15);
        dummy.rotation.set(i * 0.8, i * 1.7, i * 0.43);
        dummy.scale.setScalar(radius * (0.115 + (i % 3) * 0.012));
        dummy.updateMatrix();
        cells.setMatrixAt(i, dummy.matrix);
      }
      cells.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < 24; i++) {
        const travel = clamp01(bleed * 1.9 - i * 0.045);
        dummy.position
          .copy(selectedPoint)
          .addScaledVector(
            side,
            radius * (0.55 + travel * (1.1 + (i % 4) * 0.45)),
          )
          .addScaledVector(tangent, Math.sin(i * 3.1) * radius * travel * 1.4)
          .addScaledVector(front, Math.cos(i * 1.8) * radius * travel * 0.7);
        dummy.rotation.set(i, i * 0.6, i * 0.3);
        dummy.scale.setScalar(radius * 0.12 * ease(travel * 6));
        dummy.updateMatrix();
        escapedCells.setMatrixAt(i, dummy.matrix);
      }
      escapedCells.instanceMatrix.needsUpdate = true;
      collection.visible = bleed > 0;
      collection.position
        .copy(selectedPoint)
        .addScaledVector(side, radius * (0.8 + bleed * 1.2));
      collection.scale.set(
        radius * (0.3 + bleed * 1.4),
        radius * (0.3 + bleed * 1.4),
        radius * (0.2 + bleed * 0.9),
      );
      collection.material.opacity = bleed * 0.28;
      renderer.render(scene, camera);
      lastSequenceFrame = frameKey;
    }
    context.drawImage(renderer.domElement, 0, 0, width, height);
  }
  return {
    meshCount: originalMeshes.length + 1,
    renderer,
    renderSequence,
    scene,
    selectedVessel,
    vesselName: selectedVessel.name,
  };
}
window.BrainModel = createBrainModel();
