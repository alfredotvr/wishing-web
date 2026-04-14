const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
ctx.imageSmoothingEnabled = false;

const CX = canvas.width / 2;
const CY = canvas.height / 2;

// --- CAMERA ---
const camera = {
  x: 0, y: 0,
  tx: 0, ty: 0,
  vx: 0, vy: 0,
};

// --- NODES: organic ring placement ---
const rings = [1, 6, 12, 18, 13];
const ringRadii = [0, 160, 320, 480, 640];
const nodes = [];

rings.forEach((count, ringIndex) => {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = ringRadii[ringIndex];
    const jitterAngle = angle + (Math.random() - 0.5) * 0.3;
    const jitterR = r + (Math.random() - 0.5) * 40;
    nodes.push({
      wx: Math.cos(jitterAngle) * jitterR,
      wy: Math.sin(jitterAngle) * jitterR,
      // pop-in state
      born: false,
      birthTime: 0,
      popScale: 0,
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

// --- STAGGERED BIRTH SEQUENCE ---
// nodes pop in one by one, starting from center ring outward
let birthQueue = [];
rings.forEach((count, ringIndex) => {
  const startIndex = rings.slice(0, ringIndex).reduce((a, b) => a + b, 0);
  for (let i = startIndex; i < startIndex + count; i++) {
    birthQueue.push(i);
  }
});

let birthIndex = 0;
let lastBirthTime = 0;
const BIRTH_INTERVAL = 120; // ms between each node popping in

// --- DRAG / PAN ---
const drag = {
  active: false,
  startX: 0, startY: 0,
  camStartX: 0, camStartY: 0,
  lastX: 0, lastY: 0,
  velX: 0, velY: 0,
};
let hoveredNode = null;

canvas.addEventListener('mousedown', e => {
  drag.active = true;
  drag.startX = e.clientX;
  drag.startY = e.clientY;
  drag.lastX = e.clientX;
  drag.lastY = e.clientY;
  drag.camStartX = camera.x;
  drag.camStartY = camera.y;
  drag.velX = 0;
  drag.velY = 0;
  camera.vx = 0;
  camera.vy = 0;
});

canvas.addEventListener('mousemove', e => {
  if (drag.active) {
    drag.velX = e.clientX - drag.lastX;
    drag.velY = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    camera.tx = drag.camStartX - (e.clientX - drag.startX);
    camera.ty = drag.camStartY - (e.clientY - drag.startY);
  }
  hoveredNode = getHoveredNode(e.clientX, e.clientY);
});

canvas.addEventListener('mouseup', () => {
  drag.active = false;
  camera.vx = -drag.velX * 0.3;
  camera.vy = -drag.velY * 0.3;
});

canvas.addEventListener('mouseleave', () => {
  drag.active = false;
});

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.touches[0];
  drag.active = true;
  drag.startX = t.clientX;
  drag.startY = t.clientY;
  drag.lastX = t.clientX;
  drag.lastY = t.clientY;
  drag.camStartX = camera.x;
  drag.camStartY = camera.y;
  drag.velX = 0;
  drag.velY = 0;
  camera.vx = 0;
  camera.vy = 0;
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const t = e.touches[0];
  drag.velX = t.clientX - drag.lastX;
  drag.velY = t.clientY - drag.lastY;
  drag.lastX = t.clientX;
  drag.lastY = t.clientY;
  camera.tx = drag.camStartX - (t.clientX - drag.startX);
  camera.ty = drag.camStartY - (t.clientY - drag.startY);
}, { passive: false });

canvas.addEventListener('touchend', () => {
  drag.active = false;
  camera.vx = -drag.velX * 0.3;
  camera.vy = -drag.velY * 0.3;
});

// --- HIT TEST ---
function getHoveredNode(mx, my) {
  return nodes.find(node => {
    if (!node.born) return false;
    const sx = node.wx - camera.x + CX;
    const sy = node.wy - camera.y + CY;
    return Math.hypot(mx - sx, my - sy) < 20;
  });
}

// --- SCALE: sharp cutoff, no fading ---
function getViewScale(node) {
  if (!node.born) return 0;
  const sx = node.wx - camera.x + CX;
  const sy = node.wy - camera.y + CY;
  const dist = Math.hypot(sx - CX, sy - CY);
  const maxDist = Math.min(canvas.width, canvas.height) * 0.58;
  // hard cutoff — node is either in or out, no gradual fade
  if (dist > maxDist) return 0;
  // only shrink in the last 15% of the radius
  const edgeZone = maxDist * 0.15;
  if (dist < maxDist - edgeZone) return 1;
  const t = 1 - (dist - (maxDist - edgeZone)) / edgeZone;
  return t * t * t; // sharp cubic only in the edge zone
}

// --- POP SCALE: spring overshoot on birth ---
function getPopScale(node) {
  if (!node.born) return 0;
  const elapsed = performance.now() - node.birthTime;
  const duration = 400; // ms for pop animation
  if (elapsed >= duration) return 1;
  const t = elapsed / duration;
  // spring: overshoots slightly then settles
  return 1 + Math.sin(t * Math.PI) * 0.3 * (1 - t);
}

// --- UPDATE ---
function update(now) {
  // birth queue — staggered node pop-ins
  if (birthIndex < birthQueue.length) {
    if (now - lastBirthTime > BIRTH_INTERVAL) {
      // slight randomness in timing for organic feel
      const jitter = Math.random() * 80;
      if (now - lastBirthTime > BIRTH_INTERVAL + jitter) {
        const idx = birthQueue[birthIndex];
        nodes[idx].born = true;
        nodes[idx].birthTime = now;
        birthIndex++;
        lastBirthTime = now;
      }
    }
  }

  // camera
  if (drag.active) {
    camera.x += (camera.tx - camera.x) * 0.2;
    camera.y += (camera.ty - camera.y) * 0.2;
  } else {
    camera.vx *= 0.82;
    camera.vy *= 0.82;
    camera.x += camera.vx;
    camera.y += camera.vy;
  }
}

// --- DRAW ---
function draw(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // edges — only draw if both nodes are born and in view
  edges.forEach(([i, j]) => {
    const a = nodes[i], b = nodes[j];
    if (!a.born || !b.born) return;
    const scaleA = getViewScale(a);
    const scaleB = getViewScale(b);
    if (scaleA === 0 || scaleB === 0) return;

    const edgeScale = Math.min(scaleA, scaleB);
    const popA = getPopScale(a);
    const popB = getPopScale(b);
    const edgePop = Math.min(popA, popB);

    // edge grows from node outward as it pops in
    const ax = a.wx - camera.x + CX;
    const ay = a.wy - camera.y + CY;
    const bx = b.wx - camera.x + CX;
    const by = b.wy - camera.y + CY;

    // lerp the line endpoint based on pop progress
    const progress = Math.min(1, edgePop);
    const ex = ax + (bx - ax) * progress;
    const ey = ay + (by - ay) * progress;

    ctx.strokeStyle = `rgba(255,255,255,${edgeScale * 0.35})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  });

  // nodes
  nodes.forEach(node => {
    if (!node.born) return;
    const viewScale = getViewScale(node);
    if (viewScale === 0) return;

    const popScale = getPopScale(node);
    const isHovered = node === hoveredNode;
    const baseSize = isHovered ? 16 : 12;
    const size = Math.max(1, Math.round(baseSize * viewScale * popScale));

    const sx = Math.round(node.wx - camera.x + CX);
    const sy = Math.round(node.wy - camera.y + CY);

    ctx.globalAlpha = viewScale;
    ctx.fillStyle = 'white';
    ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
    ctx.globalAlpha = 1;
  });
}

function loop(now) {
  update(now);
  draw(now);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);