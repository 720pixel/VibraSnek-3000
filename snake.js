(() => {
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const stateTitle = document.getElementById('stateTitle');
  const stateSub = document.getElementById('stateSub');
  const pauseBtn = document.getElementById('pauseBtn');
  const restartBtn = document.getElementById('restartBtn');
  const overlayRestartBtn = document.getElementById('overlayRestartBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const speedInput = document.getElementById('speed');
  const gridSelect = document.getElementById('grid');

  const clamp = (n, a, b) => Math.max(a, Math.min(n, b));
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  let grid = parseInt(gridSelect.value, 10); // cells per row/col
  let cell; // computed size
  let targetSize = 600; // canvas logical size (square)
  canvas.width = canvas.height = targetSize;

  // Game state
  let snake, dir, nextDir, food, score, best, speed, tickMs, lastTick, running, gameOver;

  // Colors
  const col = {
    head: '#7cffc0',
    body: '#49d6a3',
    food: '#ff7b7b',
    grid: '#12202f',
  };

  function resize() {
    // Keep canvas square but fit container size via CSS; logical size fixed
    // Nothing needed here since CSS scales; keep for future DPI handling
  }

  function placeFood() {
    let p;
    do {
      p = { x: randInt(0, grid - 1), y: randInt(0, grid - 1) };
    } while (snake.some(s => s.x === p.x && s.y === p.y));
    food = p;
  }

  function reset() {
    grid = parseInt(gridSelect.value, 10);
    cell = targetSize / grid;
    speed = parseInt(speedInput.value, 10);
    tickMs = clamp(Math.round(280 - speed * 12), 40, 240);
    score = 0;
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    const start = { x: Math.floor(grid / 3), y: Math.floor(grid / 2) };
    snake = [start, { x: start.x - 1, y: start.y }, { x: start.x - 2, y: start.y }];
    placeFood();
    running = true;
    gameOver = false;
    lastTick = 0;
    scoreEl.textContent = score;
    stateTitle.textContent = 'Paused';
    stateSub.textContent = 'Press Space to continue';
    overlay.classList.add('hidden');
    pauseBtn.textContent = 'Pause';
    pauseBtn.setAttribute('aria-pressed', 'false');
  }

  function setBest(v) {
    best = Math.max(best || 0, v);
    localStorage.setItem('snake.best', String(best));
    bestEl.textContent = best;
  }

  function init() {
    best = parseInt(localStorage.getItem('snake.best') || '0', 10) || 0;
    bestEl.textContent = best;
    reset();
    requestAnimationFrame(loop);
  }

  function turn(nx, ny) {
    // disallow reversing
    if (nx === -dir.x && ny === -dir.y) return;
    nextDir = { x: nx, y: ny };
  }

  function hitWall(p) {
    return p.x < 0 || p.y < 0 || p.x >= grid || p.y >= grid;
  }

  function hitSelf(p) {
    return snake.some((s, i) => i !== 0 && s.x === p.x && s.y === p.y);
  }

  function step() {
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (hitWall(head) || hitSelf(head)) {
      running = false;
      gameOver = true;
      overlay.classList.remove('hidden');
      stateTitle.textContent = 'Game Over';
      stateSub.textContent = 'Press R to restart';
      setBest(score);
      return;
    }
    const ate = head.x === food.x && head.y === food.y;
    snake.unshift(head);
    if (ate) {
      score += 10;
      scoreEl.textContent = score;
      setBest(score);
      placeFood();
    } else {
      snake.pop();
    }
  }

  function clear() {
    ctx.clearRect(0, 0, targetSize, targetSize);
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < grid; i++) {
      const p = Math.round(i * cell) + 0.5;
      ctx.moveTo(p, 0); ctx.lineTo(p, targetSize);
      ctx.moveTo(0, p); ctx.lineTo(targetSize, p);
    }
    ctx.stroke();
  }

  function roundedRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawSnake() {
    // body
    for (let i = snake.length - 1; i >= 1; i--) {
      const s = snake[i];
      const t = i / (snake.length - 1);
      const c = lerpColor(col.body, col.head, Math.pow(1 - t, 2));
      const pad = Math.max(2, Math.min(6, 8 - i * 0.2));
      ctx.fillStyle = c;
      roundedRect(s.x * cell + pad, s.y * cell + pad, cell - pad * 2, cell - pad * 2, 6);
      ctx.fill();
    }
    // head with eyes
    const h = snake[0];
    ctx.fillStyle = col.head;
    roundedRect(h.x * cell + 2, h.y * cell + 2, cell - 4, cell - 4, 8);
    ctx.fill();
    // eyes
    const eye = Math.max(2, Math.floor(cell * 0.09));
    const off = Math.max(2, Math.floor(cell * 0.18));
    ctx.fillStyle = '#00130a';
    ctx.beginPath();
    ctx.arc(h.x * cell + off + eye, h.y * cell + off + eye, eye, 0, Math.PI * 2);
    ctx.arc(h.x * cell + cell - off - eye, h.y * cell + off + eye, eye, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFood() {
    const x = food.x * cell + cell / 2;
    const y = food.y * cell + cell / 2;
    const r = Math.max(4, cell * 0.25);
    const grd = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
    grd.addColorStop(0, '#ffd1d1');
    grd.addColorStop(1, col.food);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function lerpColor(a, b, t) {
    const pa = hexToRgb(a), pb = hexToRgb(b);
    const r = Math.round(pa.r + (pb.r - pa.r) * t);
    const g = Math.round(pa.g + (pb.g - pa.g) * t);
    const bl = Math.round(pa.b + (pb.b - pa.b) * t);
    return `rgb(${r}, ${g}, ${bl})`;
  }
  function hexToRgb(hex) {
    const h = hex.replace('#','');
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function draw() {
    clear();
    drawGrid();
    drawFood();
    drawSnake();
  }

  function loop(ts) {
    if (!lastTick) lastTick = ts;
    const elapsed = ts - lastTick;
    if (running && elapsed >= tickMs) {
      lastTick = ts;
      step();
    }
    draw();
    requestAnimationFrame(loop);
  }

  // Controls
  function pause(v) {
    if (gameOver) return;
    running = v === undefined ? !running : !v; // if v=true => pause
    const isPaused = !running;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    pauseBtn.setAttribute('aria-pressed', String(isPaused));
    overlay.classList.toggle('hidden', !isPaused);
    stateTitle.textContent = 'Paused';
    stateSub.textContent = 'Press Space to continue';
  }

  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') turn(0, -1);
    else if (k === 'arrowdown' || k === 's') turn(0, 1);
    else if (k === 'arrowleft' || k === 'a') turn(-1, 0);
    else if (k === 'arrowright' || k === 'd') turn(1, 0);
    else if (k === 'p' || k === ' ') pause();
    else if (k === 'r') { reset(); }
  });

  pauseBtn.addEventListener('click', () => pause());
  restartBtn.addEventListener('click', () => reset());
  overlayRestartBtn.addEventListener('click', () => reset());
  resumeBtn.addEventListener('click', () => pause(false));
  speedInput.addEventListener('input', () => { tickMs = clamp(Math.round(280 - parseInt(speedInput.value,10) * 12), 40, 240); });
  gridSelect.addEventListener('change', () => reset());

  // Touch controls
  document.querySelectorAll('.dpad').forEach(btn => {
    btn.addEventListener('click', () => {
      const [x, y] = btn.dataset.dir.split(',').map(Number);
      turn(x, y);
    });
  });

  window.addEventListener('resize', resize);
  resize();
  init();
})();

