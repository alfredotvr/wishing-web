const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
ctx.imageSmoothingEnabled = false;

const CX = canvas.width / 2;
const CY = canvas.height / 2;

// --- SHOWER THOUGHTS ---
const showerThoughts = [
  "If you're waiting for the waiter, you become the waiter.",
  "Your future self is watching you right now through memories.",
  "Blind people dream in whatever sense they've experienced the world.",
  "The first person to ever eat a mushroom had no idea if they'd survive.",
  "Every number you've ever counted to felt like the highest number at the time.",
  "Somewhere, someone is having the best day of their life right now.",
  "Your skeleton has never seen sunlight.",
  "The word 'bed' actually looks like a bed.",
  "We have more photos of the moon than of most of our ancestors.",
  "Technically, you've never actually touched anything. Just electron repulsion.",
  "Your birth was the only event you attended but can't remember.",
  "Every single person you walk past has a whole life as vivid as yours.",
  "Pizza is just an open-faced sandwich wearing a hat.",
  "The ocean is just a giant soup with all the ingredients still alive.",
  "If 2 people dream of each other, whose dream are they both in?",
  "Somewhere there's a oldest fish alive that has survived everything.",
  "The word 'queue' is just the letter Q followed by four silent letters.",
  "You can't hum while holding your nose closed.",
  "At some point your parents put you down and never picked you up again.",
  "Humans are the only animals that pay to live on earth.",
  "Nothing is on fire, fire is on things.",
  "If you drop soap on the floor, is the floor clean or the soap dirty?",
  "Archaeologists in the future will find Tupperware and be very confused.",
  "Your age is the number of times you've orbited around a giant ball of fire.",
  "Every time you shuffle a deck of cards, that order has likely never existed before.",
  "We are all just trying to find someone whose weird matches our weird.",
  "Somewhere right now it is the most perfect weather anyone has ever felt.",
  "The people who designed cities never actually had to live in them.",
  "Dogs think you abandon them every time you leave the house.",
  "Crows can recognize human faces and hold grudges for years.",
  "If you slowly replaced every part of a ship, is it still the same ship?",
  "We've been to the moon but have explored less than 20% of the ocean.",
  "Sand is just tiny rocks that used to be big rocks having an existential crisis.",
  "Your body replaces most of its cells every 7 years. You are basically a sequel.",
  "The last time you did something for the first time was the last time forever.",
  "Fonts are just someone's handwriting that got really famous.",
  "Every expert was once a complete beginner who refused to quit.",
  "You've probably walked past your soulmate in a grocery store.",
  "Rocks are just the earth's way of leaving notes to the future.",
  "We call it a 'building' even though it's already been built.",
  "Somewhere there is a word in another language that perfectly describes how you feel right now.",
  "The 'new car smell' is just the smell of chemicals off-gassing from plastics.",
  "Technically, all numbers are imaginary. We made them up.",
  "Your heartbeat is the oldest song you know.",
  "The most expensive real estate on earth is cemetery plots in cities.",
  "Every generation thinks the next one is ruining everything.",
  "If the universe is infinite, then everything is both the center and the edge.",
  "You've already had the best sleep of your life and you don't know it.",
  "Time zones mean somewhere on earth it is always exactly midnight.",
  "The first person to see a mirror must have been completely terrified.",
];

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
      thought: showerThoughts[nodes.length % showerThoughts.length],
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

// --- EXPANDED NODE STATE ---
const expanded = {
  node: null,
  progress: 0,      // 0 = closed, 1 = fully open
  animating: false,
  closing: false,
  originX: 0,
  originY: 0,
};

// --- MOUSE ---
const mouse = { x: -9999, y: -9999 };

// --- DRAG ---
const drag = {
  active: false,
  startX: 0, startY: 0,
  camStartX: 0, camStartY: 0,
  lastX: 0, lastY: 0,
  velX: 0, velY: 0,
  didMove: false,
};
let hoveredNode = null;

canvas.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  if (drag.active) {
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 4) drag.didMove = true;
    drag.velX = e.clientX - drag.lastX;
    drag.velY = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    camera.tx = drag.camStartX - dx;
    camera.ty = drag.camStartY - dy;
  }
  if (!expanded.node) hoveredNode = getHoveredNode(e.clientX, e.clientY);
});

canvas.addEventListener('mousedown', e => {
  drag.active = true;
  drag.didMove = false;
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

canvas.addEventListener('mouseup', e => {
  drag.active = false;
  camera.vx = -drag.velX * 0.3;
  camera.vy = -drag.velY * 0.3;

  if (!drag.didMove) {
    // it's a click, not a drag
    if (expanded.node) {
      // check X button hit
      const R = Math.min(canvas.width, canvas.height) * 0.32;
      const xBtnX = expanded.originX + R * 0.62;
      const xBtnY = expanded.originY - R * 0.62;
      if (Math.hypot(e.clientX - xBtnX, e.clientY - xBtnY) < 20) {
        closeExpanded();
      }
    } else {
      const hit = getHoveredNode(e.clientX, e.clientY);
      if (hit) openExpanded(hit, e.clientX, e.clientY);
    }
  }
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
  drag.didMove = false;
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
  const dx = t.clientX - drag.startX;
  const dy = t.clientY - drag.startY;
  if (Math.hypot(dx, dy) > 4) drag.didMove = true;
  drag.velX = t.clientX - drag.lastX;
  drag.velY = t.clientY - drag.lastY;
  drag.lastX = t.clientX;
  drag.lastY = t.clientY;
  camera.tx = drag.camStartX - dx;
  camera.ty = drag.camStartY - dy;
}, { passive: false });

canvas.addEventListener('touchend', e => {
  drag.active = false;
  camera.vx = -drag.velX * 0.3;
  camera.vy = -drag.velY * 0.3;
  if (!drag.didMove) {
    const t = e.changedTouches[0];
    if (expanded.node) {
      const R = Math.min(canvas.width, canvas.height) * 0.32;
      const xBtnX = expanded.originX + R * 0.62;
      const xBtnY = expanded.originY - R * 0.62;
      if (Math.hypot(t.clientX - xBtnX, t.clientY - xBtnY) < 24) {
        closeExpanded();
      }
    } else {
      const hit = getHoveredNode(t.clientX, t.clientY);
      if (hit) openExpanded(hit, t.clientX, t.clientY);
    }
  }
});

// --- OPEN / CLOSE ---
function openExpanded(node, sx, sy) {
  expanded.node = node;
  expanded.progress = 0;
  expanded.closing = false;
  expanded.animating = true;
  expanded.originX = CX;
  expanded.originY = CY;
}

function closeExpanded() {
  expanded.closing = true;
  expanded.animating = true;
}

// --- HIT TEST ---
function getHoveredNode(mx, my) {
  return nodes.find(node => {
    if (!node.born) return false;
    const sx = node.wx - camera.x + CX;
    const sy = node.wy - camera.y + CY;
    return Math.hypot(mx - sx, my - sy) < 20;
  });
}

// --- EDGE HELPERS ---
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

// --- DRAW PIXELATED CIRCLE ---
function drawPixelCircle(cx, cy, radius, color, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const step = 4; // pixel size
  for (let py = -radius; py <= radius; py += step) {
    for (let px = -radius; px <= radius; px += step) {
      if (px * px + py * py <= radius * radius) {
        ctx.fillRect(
          Math.round((cx + px) / step) * step,
          Math.round((cy + py) / step) * step,
          step, step
        );
      }
    }
  }
  ctx.globalAlpha = 1;
}

// --- WRAP TEXT ---
function wrapText(text, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach(word => {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines;
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

  // animate expanded circle
  if (expanded.animating) {
    const speed = 0.08;
    if (expanded.closing) {
      expanded.progress -= speed;
      if (expanded.progress <= 0) {
        expanded.progress = 0;
        expanded.animating = false;
        expanded.node = null;
        expanded.closing = false;
      }
    } else {
      expanded.progress += speed;
      if (expanded.progress >= 1) {
        expanded.progress = 1;
        expanded.animating = false;
      }
    }
  }

  if (!expanded.node) {
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
}

// --- DRAW ---
function draw(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // blur background when expanded
  const blurring = expanded.node && expanded.progress > 0;
  if (blurring) {
    ctx.filter = `blur(${expanded.progress * 6}px)`;
  }

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
    const near = dist < 12 && !expanded.node;

    if (near && !drag.active) {
      const t = getEdgeT(mouse.x, mouse.y, ax, ay, ex, ey);
      const GREEN_REACH = 0.18;
      const greenStart = Math.max(0, t - GREEN_REACH);
      const greenEnd = Math.min(1, t + GREEN_REACH);

      if (greenStart > 0) {
        ctx.strokeStyle = `rgba(255,255,255,${edgeScale * 0.35})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + (ex - ax) * greenStart, ay + (ey - ay) * greenStart);
        ctx.stroke();
      }

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

      if (greenEnd < 1) {
        ctx.strokeStyle = `rgba(255,255,255,${edgeScale * 0.35})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ax + (ex - ax) * greenEnd, ay + (ey - ay) * greenEnd);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    } else {
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
    const isHovered = node === hoveredNode && !expanded.node;
    const baseSize = isHovered ? 18 : 12;
    const size = Math.max(1, Math.round(baseSize * viewScale * popScale));
    const sx = Math.round(node.wx - camera.x + CX);
    const sy = Math.round(node.wy - camera.y + CY);
    ctx.globalAlpha = viewScale;
    ctx.fillStyle = isHovered ? '#88E788' : 'white';
    ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
    ctx.globalAlpha = 1;
  });

  // reset blur before drawing overlay
  ctx.filter = 'none';

  // expanded node overlay
  if (expanded.node || expanded.animating) {
    const p = expanded.progress;
    // spring easing
    const ease = p < 1
      ? 1 - Math.pow(1 - p, 3)
      : 1;

    const maxR = Math.min(canvas.width, canvas.height) * 0.32;
    const R = maxR * ease;
    const ox = expanded.originX;
    const oy = expanded.originY;

    // draw pixelated green circle
    drawPixelCircle(ox, oy, R, '#88E788', Math.min(1, ease * 1.2));

    // text — only show when mostly open
    if (p > 0.6 && expanded.node) {
      const textAlpha = (p - 0.6) / 0.4;
      const textR = R * 0.72;
      const fontSize = Math.max(10, Math.round(R * 0.085));

      ctx.globalAlpha = textAlpha;
      ctx.fillStyle = '#000000';
      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = 'center';

      const lines = wrapText(expanded.node.thought, textR * 1.6, fontSize * 1.4);
      const totalHeight = lines.length * fontSize * 1.4;
      const startY = oy - totalHeight / 2 + fontSize;

      lines.forEach((line, idx) => {
        ctx.fillText(line, ox, startY + idx * fontSize * 1.4);
      });

      ctx.globalAlpha = 1;

      // X button
      const xBtnX = ox + R * 0.62;
      const xBtnY = oy - R * 0.62;
      const xSize = Math.max(12, R * 0.12);

      ctx.globalAlpha = textAlpha;
      ctx.fillStyle = '#000000';
      ctx.font = `bold ${Math.round(xSize)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✕', xBtnX, xBtnY);
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 1;
    }
  }
}

function loop(now) {
  update(now);
  draw(now);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);