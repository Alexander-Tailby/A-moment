const $ = (s) => document.querySelector(s),
  clamp = (x) => Math.max(0, Math.min(1, x)),
  smooth = (x) => {
    x = clamp(x);
    return x * x * (3 - 2 * x);
  };
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = $("#vessel"),
  ctx = canvas.getContext("2d"),
  photo = $("#photo");
const particleCanvas = $("#particles"),
  particleContext = particleCanvas.getContext("2d");
// Local images can taint canvases under file://. Read bundled color data
// instead of calling getImageData on a canvas containing the photograph.
const colorMap = window.MEADOW_COLORS;
const colors = colorMap ? atob(colorMap.rgb) : null;
let particles = [];
let camera = { x: 0, y: 0, zoom: 1, scatter: 0 };

// Rebuild the dot positions for the same object-fit crop as the photograph.
function buildParticles() {
  if (!photo.complete || !photo.naturalWidth || !colors) return;
  const spacing = Math.max(7, Math.sqrt((w * h) / 22000));
  const cover = Math.max(w / photo.naturalWidth, h / photo.naturalHeight);
  const left = (w - photo.naturalWidth * cover) / 2;
  const top = (h - photo.naturalHeight * cover) / 2;

  // Seeded, variable-density packing: fine detail in the center, larger
  // circles toward the perimeter, without a visible grid or resize flicker.
  let seed = 12345;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const bucketSize = spacing * 2.65;
  const buckets = new Map();
  const attempts = Math.min(80000, Math.ceil(((w * h) / spacing ** 2) * 6));
  particles = [];
  for (let attempt = 0; attempt < attempts; attempt++) {
    const x = random() * (w + spacing * 2) - spacing;
    const y = random() * (h + spacing * 2) - spacing;
    const distance = Math.min(
      1,
      Math.hypot((x - w * 0.5) / (w * 0.5), (y - h * 0.5) / (h * 0.5)),
    );
    const localSpacing = spacing * (0.55 + 2.1 * distance ** 1.6);
    const bx = Math.floor(x / bucketSize);
    const by = Math.floor(y / bucketSize);
    let crowded = false;
    for (let dx = -1; dx <= 1 && !crowded; dx++) {
      for (let dy = -1; dy <= 1 && !crowded; dy++) {
        for (const other of buckets.get(`${bx + dx},${by + dy}`) || []) {
          const minimum = (localSpacing + other.spacing) * 0.45;
          if ((x - other.x) ** 2 + (y - other.y) ** 2 < minimum ** 2) {
            crowded = true;
            break;
          }
        }
      }
    }
    if (crowded) continue;
    const sampleX = Math.min(
      colorMap.width - 1,
      Math.max(
        0,
        Math.floor(
          ((x - left) / (photo.naturalWidth * cover)) * colorMap.width,
        ),
      ),
    );
    const sampleY = Math.min(
      colorMap.height - 1,
      Math.max(
        0,
        Math.floor(
          ((y - top) / (photo.naturalHeight * cover)) * colorMap.height,
        ),
      ),
    );
    const index = (sampleY * colorMap.width + sampleX) * 3;
    const dot = {
      x,
      y,
      spacing: localSpacing,
      radius: localSpacing * (0.48 + random() * 0.12),
      phase: random() * Math.PI * 2,
      speed: 1.5 + random() * 2,
      color: `rgb(${colors.charCodeAt(index)}, ${colors.charCodeAt(index + 1)}, ${colors.charCodeAt(index + 2)})`,
    };
    particles.push(dot);
    const key = `${bx},${by}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(dot);
  }
  // Keep fine central dots visible where sizes overlap.
  particles.sort((a, b) => b.radius - a.radius);
  $(".photo-layer").classList.add("particles-ready");
}

function drawParticles(time) {
  if (!particles.length || p > 0.51) return;
  const { x: offsetX, y: offsetY, zoom, scatter } = camera;
  const clock = reduced ? 0 : time * 0.001;
  // Oversize the circles at the opening view so neighboring dots overlap.
  // Release that overlap as the camera approaches the individual particles.
  const overlap = 1 + 0.8 * (1 - smooth(Math.log(zoom) / Math.log(6)));
  particleContext.clearRect(0, 0, w, h);
  // The warm dark gaps keep the individual circles visible at a distance.
  particleContext.globalAlpha = 1 - smooth((p - 0.31) / 0.18);
  particleContext.fillStyle = "#291c20";
  particleContext.fillRect(0, 0, w, h);
  particleContext.globalAlpha = 1;
  for (const dot of particles) {
    const vibration = reduced ? 0 : dot.radius * 0.15;
    let x =
      offsetX +
      (dot.x + Math.sin(clock * dot.speed + dot.phase) * vibration) * zoom;
    let y =
      offsetY +
      (dot.y + Math.cos(clock * dot.speed * 1.3 + dot.phase) * vibration) *
        zoom;
    const dx = x - w * 0.5;
    const dy = y - h * 0.43;
    const distance = Math.hypot(dx, dy);
    const angle = distance > 1 ? Math.atan2(dy, dx) : dot.phase;
    const push = scatter * Math.max(w, h) * (0.7 + dot.speed * 0.2);
    x += Math.cos(angle) * push;
    y += Math.sin(angle) * push;
    const radius = dot.radius * zoom * overlap;
    if (x + radius < 0 || x - radius > w || y + radius < 0 || y - radius > h)
      continue;
    particleContext.fillStyle = dot.color;
    particleContext.beginPath();
    particleContext.arc(x, y, radius, 0, Math.PI * 2);
    particleContext.fill();
  }
}
let w = innerWidth,
  h = innerHeight,
  p = 0,
  dirty = true;
const openingCaption = $(".opening");
function caption(el, alpha) {
  el.style.opacity = alpha;
  el.setAttribute("aria-hidden", alpha > 0.35 ? "false" : "true");
}
function layout() {
  w = $(".scene").clientWidth;
  h = $(".scene").clientHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  particleCanvas.width = w * dpr;
  particleCanvas.height = h * dpr;
  particleContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildParticles();
  dirty = true;
}
function update() {
  p = clamp((scrollY - $(".story").offsetTop) / ($(".story").offsetHeight - h));
  // Resolve the actual object-fit crop before targeting the woman's head.
  const iw = photo.naturalWidth || 1672,
    ih = photo.naturalHeight || 941,
    cover = Math.max(w / iw, h / ih);
  const hx = (w - iw * cover) / 2 + iw * 0.45 * cover,
    hy = (h - ih * cover) / 2 + ih * 0.49 * cover;
  const z = smooth((p - 0.06) / 0.38),
    zoom = reduced ? 1 : Math.exp(z * Math.log(24));
  const targetX = hx + (w * 0.5 - hx) * smooth(z * 2),
    targetY = hy + (h * 0.43 - hy) * smooth(z * 2);
  photo.style.transform = `translate(${targetX - hx * zoom}px,${targetY - hy * zoom}px) scale(${zoom})`;
  camera = {
    x: targetX - hx * zoom,
    y: targetY - hy * zoom,
    zoom,
    scatter: reduced ? 0 : smooth((p - 0.25) / 0.23),
  };
  const reveal = smooth((p - 0.3) / 0.18);
  $("#inside").style.opacity = reveal;
  $(".photo-layer").style.opacity = 1 - smooth((p - 0.46) / 0.05);
  caption(openingCaption, 1 - smooth((p - 0.03) / 0.1));
  // Keep the vessel study free of text and interface overlays.
  const showControls = p < 0.28;
  for (const selector of [".topline", ".scene-bottom", ".progress"]) {
    const element = $(selector);
    element.style.opacity = 1 - smooth((p - 0.18) / 0.1);
    element.style.visibility = showControls ? "visible" : "hidden";
    element.inert = !showControls;
  }
  dirty = false;
}
// Schematic venous cutaway, anchored to the superior sagittal sinus mesh. Wall thicknesses, cell sizes,
// flow speed and bleed growth are illustrative rather than quantitative.
const vesselShape = {
  start: -720,
  end: 720,
  lumen: 70,
  ruptureX: 50,
};
const centerline = (x) => 8 * Math.sin(x / 310);

function wallBand(start, end, inner, outer, side, color) {
  ctx.beginPath();
  for (let x = start; x < end; x += 8) {
    ctx.lineTo(x, centerline(x) + side * inner);
  }
  ctx.lineTo(end, centerline(end) + side * inner);
  for (let x = end; x > start; x -= 8) {
    ctx.lineTo(x, centerline(x) + side * outer);
  }
  ctx.lineTo(start, centerline(start) + side * outer);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawCell(x, y, radius, rotation, alpha = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha *= alpha;
  // A restrained biconcave-disc appearance, without glow or glossy highlights.
  ctx.fillStyle = "#a54c49";
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#873d3b";
  ctx.lineWidth = 0.7;
  ctx.stroke();
  ctx.fillStyle = "#ce8880";
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.46, radius * 0.31, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Superior-view brain study. The vessel map is schematic, not a patient scan.
const brainFocus = { x: -110, y: -25 };
const hemisphere = new Path2D(
  "M -12 -230 C -50 -258 -132 -249 -177 -211 " +
    "C -228 -187 -266 -121 -267 -50 C -285 14 -260 110 -221 162 " +
    "C -198 212 -128 247 -69 231 C -36 228 -15 198 -13 157 " +
    "C -5 90 -13 25 -10 -40 C -6 -106 -17 -173 -12 -230 Z",
);
const folds = [
  "M -25 -205 C -79 -218 -108 -185 -106 -153 C -104 -127 -133 -122 -163 -142",
  "M -133 -206 C -158 -182 -191 -182 -206 -150 C -225 -118 -190 -110 -187 -85",
  "M -29 -159 C -63 -157 -72 -128 -57 -104 C -43 -82 -58 -61 -93 -69",
  "M -150 -117 C -141 -94 -170 -72 -202 -68 C -229 -63 -242 -38 -225 -15",
  "M -103 -103 C -110 -73 -132 -57 -119 -33 C -100 -12 -113 6 -151 8",
  "M -25 -58 C -57 -49 -69 -16 -51 4 C -28 27 -47 55 -82 46",
  "M -246 17 C -210 6 -186 24 -187 47 C -186 71 -153 79 -129 58",
  "M -167 -19 C -191 1 -164 26 -149 30 C -131 34 -116 58 -123 89",
  "M -26 82 C -63 64 -92 88 -79 116 C -61 150 -86 172 -118 157",
  "M -220 93 C -186 75 -161 100 -164 126 C -166 151 -146 166 -126 183",
  "M -198 162 C -181 153 -181 185 -157 199 C -139 211 -118 200 -101 203",
  "M -28 180 C -47 168 -57 192 -56 209",
];
const surfaceArteries = [
  [6, "M -14 200 C -21 140 -37 88 -72 40 C -91 10 -110 -12 -140 -27"],
  [4, "M -72 40 C -115 22 -163 3 -211 -17 C -232 -26 -239 -47 -239 -66"],
  [
    3,
    "M -140 -27 C -127 -62 -147 -100 -171 -129 C -189 -153 -183 -178 -176 -192",
  ],
  [2.5, "M -127 -62 C -91 -94 -95 -132 -75 -166 C -63 -187 -55 -204 -57 -222"],
  [2, "M -171 -129 C -202 -124 -220 -102 -241 -99"],
  [2, "M -211 -17 C -221 8 -222 29 -240 51"],
  [3, "M -58 63 C -101 75 -135 114 -175 125 C -195 131 -217 140 -221 162"],
  [2, "M -135 114 C -138 149 -128 177 -140 207"],
  [2, "M -37 115 C -65 135 -89 176 -86 210"],
  [1.5, "M -95 -132 C -125 -152 -133 -171 -133 -205"],
];

function drawBrainFallback(scale, originX, originY, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(originX, originY);
  ctx.scale(scale, scale);
  for (const side of [1, -1]) {
    ctx.save();
    ctx.scale(side, 1);
    const tissue = ctx.createLinearGradient(-270, -210, -5, 180);
    tissue.addColorStop(0, "#d9cec2");
    tissue.addColorStop(0.45, "#e7ddd2");
    tissue.addColorStop(1, "#b9a99a");
    ctx.fillStyle = tissue;
    ctx.fill(hemisphere);
    ctx.strokeStyle = "#a9998a";
    ctx.lineWidth = 1.4;
    ctx.stroke(hemisphere);
    ctx.save();
    ctx.clip(hemisphere);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const fold of folds) {
      const path = new Path2D(fold);
      ctx.strokeStyle = "#a7968680";
      ctx.lineWidth = 9;
      ctx.stroke(path);
      ctx.strokeStyle = "#b4a392";
      ctx.lineWidth = 2.5;
      ctx.stroke(path);
      ctx.save();
      ctx.translate(3, -3);
      ctx.strokeStyle = "#f4eee58c";
      ctx.lineWidth = 2;
      ctx.stroke(path);
      ctx.restore();
    }
    // Branching surface vessels taper towards the outer cortical territories.
    for (const [width, data] of surfaceArteries) {
      const path = new Path2D(data);
      ctx.strokeStyle = "#96514b";
      ctx.lineWidth = width;
      ctx.stroke(path);
      ctx.strokeStyle = "#bf7d71";
      ctx.lineWidth = width * 0.35;
      ctx.stroke(path);
    }
    ctx.restore();
    ctx.restore();
  }
  // A small translucent focus connects the earlier bleed to its brain location.
  ctx.globalAlpha *= smooth(3 / scale);
  ctx.fillStyle = "#99565342";
  ctx.beginPath();
  ctx.ellipse(brainFocus.x, brainFocus.y, 15, 11, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawVessel(time) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#eeebe5";
  ctx.fillRect(0, 0, w, h);
  if (window.BrainModel?.renderSequence) {
    window.BrainModel.renderSequence(ctx, w, h, p, time, reduced);
    return;
  }
  const pullback = smooth((p - 0.78) / 0.19);
  const closeScale = Math.max(w / 1250, Math.min(h / 850, 0.9));
  const anchor = window.BrainModel
    ? window.BrainModel.getAnchor(reduced ? 1 : pullback)
    : { ...brainFocus, angle: 0, width: 3.552 };
  const vesselRatio = Math.max(0.012, Math.min(0.06, anchor.width / 222));
  const brainFit = Math.min((w * 0.82) / 560, (h * 0.76) / 510);
  // One continuous camera move connects the close-up with its brain location.
  const brainScale = reduced
    ? brainFit
    : Math.exp(
        Math.log(closeScale / vesselRatio) * (1 - pullback) +
          Math.log(brainFit) * pullback,
      );
  const framing = smooth((pullback - 0.6) / 0.4);
  const originX = w * 0.5 - anchor.x * brainScale * (1 - framing);
  const originY =
    h * (0.57 - 0.07 * pullback) - anchor.y * brainScale * (1 - framing);
  const brainAlpha = smooth((pullback - 0.12) / 0.45);
  if (brainAlpha > 0 && window.BrainModel) {
    window.BrainModel.draw(
      ctx,
      brainScale,
      originX,
      originY,
      brainAlpha,
      reduced ? 1 : pullback,
    );
  } else if (brainAlpha > 0) {
    drawBrainFallback(brainScale, originX, originY, brainAlpha);
  }
  const detailAlpha = 1 - smooth((pullback - 0.45) / 0.4);
  if (detailAlpha <= 0) return;
  const scale = reduced ? closeScale : brainScale * vesselRatio;
  ctx.save();
  ctx.globalAlpha = detailAlpha;
  ctx.translate(
    reduced ? w * 0.5 : originX + anchor.x * brainScale,
    reduced ? h * 0.57 : originY + anchor.y * brainScale,
  );
  ctx.rotate(reduced ? 0 : anchor.angle * smooth(pullback / 0.25));
  ctx.scale(scale, scale);
  ctx.translate(-vesselShape.ruptureX, 0);
  const { start, end, lumen, ruptureX } = vesselShape;
  const bleed = smooth((p - 0.62) / 0.14);
  const gap = 23 * smooth((p - 0.62) / 0.07);

  // Blood accumulates immediately outside the breached wall, rather than
  // radiating as a decorative burst. The collection grows only with scroll.
  if (bleed > 0) {
    ctx.fillStyle = "#aa65605c";
    ctx.beginPath();
    ctx.ellipse(
      ruptureX + bleed * 25,
      -114 - bleed * 67,
      24 + bleed * 122,
      12 + bleed * 91,
      -0.12,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = "#9a494638";
    ctx.beginPath();
    ctx.ellipse(
      ruptureX + bleed * 16,
      -105 - bleed * 40,
      12 + bleed * 88,
      8 + bleed * 65,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Schematic lumen and connective wall bands, using the same blue-gray
  // palette as the selected venous mesh. These are not arterial muscle layers.
  wallBand(start, end, -lumen, lumen, 1, "#ead7cf");
  const layers = [
    { inner: 93, outer: 111, color: "#b3bec1" },
    { inner: 75, outer: 93, color: "#8f9fa8" },
    { inner: 70, outer: 75, color: "#687b89" },
  ];
  for (const layer of layers) {
    wallBand(start, end, layer.inner, layer.outer, 1, layer.color);
    if (gap > 0) {
      wallBand(
        start,
        ruptureX - gap,
        layer.inner,
        layer.outer,
        -1,
        layer.color,
      );
      wallBand(ruptureX + gap, end, layer.inner, layer.outer, -1, layer.color);
    } else {
      wallBand(start, end, layer.inner, layer.outer, -1, layer.color);
    }
  }

  const clock = reduced ? 0 : time * 0.018;
  for (let i = 0; i < 58; i++) {
    const x = ((i * 137.3 + clock) % (end - start)) + start;
    const y = centerline(x) + Math.sin(i * 7.13) * 49;
    drawCell(x, y, 7 + (i % 4) * 0.7, Math.sin(i * 3.7) * 0.7);
  }

  // A short path through the wall connects the lumen to the external bleed.
  // Cells follow the opening; they do not explode away from the vessel.
  if (bleed > 0) {
    for (let i = 0; i < 22; i++) {
      const travel = clamp(bleed * 2 - i * 0.065);
      if (!travel) continue;
      const x = ruptureX + Math.sin(i * 2.4) * (5 + travel * 95);
      const y = -58 - travel * (76 + (i % 5) * 24);
      drawCell(x, y, 6.5 + (i % 3) * 0.6, i * 0.7, smooth(travel * 8));
    }
  }
  ctx.restore();
}

function draw(time) {
  if (dirty) update();
  drawParticles(time);
  if (p > 0.28) drawVessel(time);
  requestAnimationFrame(draw);
}
addEventListener("scroll", () => (dirty = true), { passive: true });
addEventListener("resize", layout);
// Scroll directly so fragment links also work in isolated file:// frames.
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    if (
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const target = document.getElementById(link.getAttribute("href").slice(1));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: reduced ? "instant" : "smooth" });
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  });
});
photo.addEventListener("load", () => {
  buildParticles();
  dirty = true;
});
layout();
update();
requestAnimationFrame(draw);
