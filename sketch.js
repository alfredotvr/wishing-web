const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
ctx.imageSmoothingEnabled = false;

const CX = canvas.width / 2;
const CY = canvas.height / 2;

// --- CAMERA ---
const camera = { x: 0, y: 0 };

// --- NODES ---
const rings = [1, 6, 12, 18, 13];
const ringRadii = [0, 200, 400, 600, 800];
const nodes = [];

rings.forEach((count, ringIndex) => {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = ringRadii[ringIndex];
    nodes.push({
      wx: Math.cos(angle) * r,
      wy: Math.sin(angle) * r,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      label: `node ${nodes.length + 1}`,
    });
  }
});

// --- EDGES ---
const edges = [];
nodes.forEach((a, i) => {
  let distances = nodes
    .map((b, j) => ({ j, dist: Math.hypot(a.wx - b.wx, a.wy - b.wy) }))
    .filter(d => d.j !== i)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3);
  distances.forEach(d => {
    if (!edges.find(e => (e[0] === d.j && e[1] === i))) {
      edges.push([i, d.j]);
    }
  });
});

// --- DRAG / PAN ---
const drag = { active: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 };
let hoveredNode = null;

canvas.addEventListener('mousedown', e => {
  drag.active = true;
  drag.startX = e.clientX;
  drag.startY = e.clientY;
  drag.camStartX = camera.x;
  drag.camStartY = camera.y;
});

canvas.addEventListener('mousemove', e => {
  if (drag.active) {
    camera.x = drag.camStartX - (e.clientX - drag.startX);
    camera.y = drag.camStartY - (e.clientY - drag.startY);
  }
  hoveredNode = getHoveredNode(e.clientX, e.clientY);
});

canvas.addEventListener('mouseup', () => {
  drag.active = false;
});

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.touches[0];
  drag.active = true;
  drag.startX = t.clientX;
  drag.startY = t.clientY;
  drag.camStartX = camera.x;
  drag.camStartY = camera.y;
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const t = e.touches[0];
  camera.x = drag.camStartX - (t.clientX - drag.startX);
  camera.y = drag.camStartY - (t.clientY - drag.startY);
}, { passive: false });

canvas.addEventListener('touchend', () => { drag.active = false; });

// --- HIT TEST ---
function getHoveredNode(mx, my) {
  return nodes.find(node => {
    const sx = node.wx - camera.x + CX;
    const sy = node.wy - camera.y + CY;
    return Math.hypot(mx - sx, my - sy) < 20;
  });
}

// --- SCALE BY DISTANCE FROM SCREEN CENTER ---
function getScale(node) {
  const sx = node.wx - camera.x + CX;
  const sy = node.wy - camera.y + CY;
  const dist = Math.hypot(sx - CX, sy - CY);
  const maxDist = Math.min(canvas.width, canvas.height) * 0.45;
  return Math.max(0, 1 - dist / maxDist);
}

// --- SETTLE ANIMATION ---
const DAMPING = 0.88;
let settled = false;

function update() {
  if (settled) return;
  let totalSpeed = 0;
  nodes.forEach(node => {
    node.vx *= DAMPING;
    node.vy *= DAMPING;
    node.wx += node.vx;
    node.wy += node.vy;
    totalSpeed += Math.abs(node.vx) + Math.abs(node.vy);
  });
  if (totalSpeed < 0.05) settled = true;
}

// --- DRAW ---
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  edges.forEach(([i, j]) => {
    const a = nodes[i], b = nodes[j];
    const scaleA = getScale(a);
    const scaleB = getScale(b);
    const opacity = Math.min(scaleA, scaleB) * 0.4;
    if (opacity < 0.01) return;
    const ax = a.wx - camera.x + CX;
    const ay = a.wy - camera.y + CY;
    const bx = b.wx - camera.x + CX;
    const by = b.wy - camera.y + CY;
    ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  });

  nodes.forEach(node => {
    const scale = getScale(node);
    if (scale < 0.01) return;
    const isHovered = node === hoveredNode;
    const baseSize = isHovered ? 16 : 12;
    const size = Math.round(baseSize * scale);
    const sx = Math.round(node.wx - camera.x + CX);
    const sy = Math.round(node.wy - camera.y + CY);
    ctx.globalAlpha = scale;
    ctx.fillStyle = 'white';
    ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
    ctx.globalAlpha = 1;
  });
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();