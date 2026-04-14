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

// --- NODES ---
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
      born: false,
      birthTime: 0,
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

// --- BIRTH QUEUE ---
let birthQueue = [];
rings.forEach((count, ringIndex) => {
  const startIndex = rings.slice(0, ringIndex).reduce((a, b) => a + b, 0);
  for (let i = startIndex; i < startIndex + count; i++) {
    birthQueue.push(i);
  }
});

let birthIndex = 0;
let lastBirthTime = 0;
const BIRTH_INTERVAL = 120;

// --- MOUSE ---
const mouse = { x: -9999, y: -9999 };

// --- DRAG / PAN ---
const drag = {
  active: false,
  startX: 0, startY: 0,
  camStartX: 0, camStartY: 0,
  lastX: 0, lastY: 0,
  velX: 0, velY: 0,
};
let hoveredNode = null;

canvas.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
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

canvas.addEventListener('mouseup', () => {
  drag.active = false;
  camera.vx = -drag.velX * 0.3;
  camera.vy = -drag.velY * 0.3;
});

canvas.addEventListener('mouseleave', () => {
  drag.active = false;
  mouse.x = -9999;
  mouse.y = -9999;
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

// --- CLOSEST POINT ON SEGMENT (0..1) ---
function getEdgeT(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0;
  const t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  return Math.max(0, Math.min(1, t));
}

function distToSegment(px, py, ax, ay, bx, by) {
  const t = getEdgeT(px, py, ax, ay, bx, by);
  return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
}

// --- VIEW SCALE ---
function getViewScale(node) {
  if (!node.born) return 0;
  const sx = node.wx - camera.x + CX;
  const sy = node.wy - camera.y + CY;
  const dist = Math.hypot(sx - CX, sy - CY);
  const maxDist = Math.min(canvas.width, canvas.height) * 0.58;
  if (dist > maxDist) return 0;
  const edgeZone = maxDist * 0.15;
  if (dist < maxDist - edgeZone) return 1;
  const t = 1 - (dist - (maxDist - edgeZone)) / edgeZone;
  return t * t * t;
}

// --- POP SCALE ---
function getPopScale(node) {
  if (!node.born) return 0;
  const elapsed = performance.now() - node.birthTime;
  const duration = 400;
  if (elapsed >= duration) return 1;
  const t = elapsed / duration;
  return 1 + Math.sin(t * Math.PI) * 0.3 * (1 - t);
}

// --- UPDATE ---
function update(now) {
  if (birthIndex < birthQueue.length) {
    if (now - lastBirthTime > BIRTH_INTERVAL) {
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

  // edges
  edges.forEach(([i, j]) => {
    const a = nodes[i], b = nodes[j];
    if (!a.born || !b.born) return;
    const scaleA = getViewScale(a);
    const scaleB = getViewScale(b);
    if (scaleA === 0 || scaleB === 0) return;

    const ax = a.wx - camera.x + CX;
    const ay = a.wy - camera.y + CY;
    const bx = b.wx - camera.x + CX;
    const by = b.wy - camera.y + CY;

    const edgeScale = Math.min(scaleA, scaleB);
    const progress = Math.min(1, Math.min(getPopScale(a), getPopScale(b)));
    const ex = ax + (bx - ax) * progress;
    const ey = ay + (by - ay) * progress;

    const dist = distToSegment(mouse.x, mouse.y, ax, ay, ex, ey);
    const near = dist < 12;

    if (near && !drag.active) {
      // t = where along the edge the mouse is closest (0 = node a, 1 = node b)
      const t = getEdgeT(mouse.x, mouse.y, ax, ay, ex, ey);
      const GREEN_REACH = 0.18; // how far green spreads from mouse in each direction

      const greenStart = Math.max(0, t - GREEN_REACH);
      const greenEnd = Math.min(1, t + GREEN_REACH);

      // segment before green
      if (greenStart > 0) {
        ctx.strokeStyle = `rgba(255,255,255,${edgeScale * 0.35})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + (ex - ax) * greenStart, ay + (ey - ay) * greenStart);
        ctx.stroke();
      }

      // green segment — pixelated by drawing as small rects along the line
      const PIXEL = 3;
      const steps = Math.ceil(
        Math.hypot((ex - ax) * (greenEnd - greenStart), (ey - ay) * (greenEnd - greenStart)) / PIXEL
      );
      ctx.fillStyle = `rgba(136,231,136,${edgeScale * 0.9})`;
      for (let s = 0; s <= steps; s++) {
        const st = greenStart + (s / steps) * (greenEnd - greenStart);
        const px = Math.round((ax + (ex - ax) * st) / PIXEL) * PIXEL;
        const py = Math.round((ay + (ey - ay) * st) / PIXEL) * PIXEL;
        ctx.fillRect(px, py, PIXEL, PIXEL);
      }

      // segment after green
      if (greenEnd < 1) {
        ctx.strokeStyle = `rgba(255,255,255,${edgeScale * 0.35})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ax + (ex - ax) * greenEnd, ay + (ey - ay) * greenEnd);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

    } else {
      // normal white edge
      ctx.strokeStyle = `rgba(255,255,255,${edgeScale * 0.35})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
  });

  // nodes
  nodes.forEach(node => {
    if (!node.born) return;
    const viewScale = getViewScale(node);
    if (viewScale === 0) return;
    const popScale = getPopScale(node);
    const isHovered = node === hoveredNode;
    const baseSize = isHovered ? 18 : 12;
    const size = Math.max(1, Math.round(baseSize * viewScale * popScale));
    const sx = Math.round(node.wx - camera.x + CX);
    const sy = Math.round(node.wy - camera.y + CY);
    ctx.globalAlpha = viewScale;
    ctx.fillStyle = isHovered ? '#88E788' : 'white';
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