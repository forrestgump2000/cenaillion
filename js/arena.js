// Pixel-art arena: the small game stage (160x200) and the full-screen crowd backdrop.
(() => {
  'use strict';
  const W = 160, H = 200;

  // Token landing spots per tier (stage pixels), and zone highlight boxes (% of stage).
  const SPOTS = [null, [80, 178], [80, 147], [80, 117], [80, 75], [80, 56], [80, 22]];
  const ZONES = {
    6: [0, 0, 100, 23.5],
    5: [6, 24.5, 88, 7],
    4: [31, 33.5, 38, 8],
    3: [26.5, 45, 47, 26],
    2: [23, 71.5, 54, 4.5],
    1: [30, 77, 40, 23],
  };

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const SKIN = ['#f1c7a3', '#e0a77e', '#b97a52', '#8a5536', '#5e3a24', '#f6d5b8'];
  const SHIRT = ['#e8173b', '#ffcc33', '#3ee6ff', '#7a5cff', '#2fd17a', '#ff7a2f', '#f5f5f5', '#222244', '#ff3e7f'];

  // Pre-generate a crowd layout so it is stable between frames.
  function makeCrowd(seed, cols, rows, pitchX, pitchY, offX, offY) {
    const r = rng(seed), people = [];
    for (let row = 0; row < rows; row++) {
      for (let c = 0; c < cols; c++) {
        if (r() < 0.06) continue;
        people.push({
          x: offX + c * pitchX + (row % 2 ? pitchX / 2 : 0) + Math.floor(r() * 2),
          y: offY + row * pitchY,
          skin: SKIN[Math.floor(r() * SKIN.length)],
          shirt: SHIRT[Math.floor(r() * SHIRT.length)],
          sign: r() < 0.05,
          phase: r() * 6.28,
        });
      }
    }
    return people;
  }

  const stageCrowd = makeCrowd(11, 41, 6, 4, 7, 0, 2);
  const frontRow = makeCrowd(5, 19, 1, 8, 0, 8, 51);

  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w, h); }

  function drawStage(ctx, t) {
    // floor / arena darkness
    px(ctx, 0, 0, W, H, '#0b0a1c');
    // stands backdrop gradient bands
    const bands = ['#1a1236', '#181133', '#160f2f', '#140e2b', '#120c27', '#100b23'];
    bands.forEach((c, i) => px(ctx, 0, i * 8, W, 8, c));

    // crowd (zone 6)
    const bounce = (p) => (Math.sin(t * 3 + p.phase) > 0.6 ? -1 : 0);
    for (const p of stageCrowd) {
      const b = bounce(p);
      px(ctx, p.x, p.y + 3 + b, 3, 3, p.shirt);
      px(ctx, p.x + 0.5, p.y + b, 2, 2, p.skin);
      if (p.sign) { px(ctx, p.x - 2, p.y - 4 + b, 7, 4, '#f5f5f5'); px(ctx, p.x - 1, p.y - 3 + b, 5, 1, '#e8173b'); }
    }
    // camera flashes
    const fr = rng(Math.floor(t * 6));
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(fr() * W), y = Math.floor(fr() * 44);
      px(ctx, x - 1, y, 3, 1, '#fff7c2'); px(ctx, x, y - 1, 1, 3, '#fff7c2'); px(ctx, x, y, 1, 1, '#ffffff');
    }
    // railing
    px(ctx, 0, 46, W, 2, '#2b2550'); px(ctx, 0, 48, W, 1, '#8a7cff');

    // front row (zone 5)
    px(ctx, 6, 50, 148, 13, '#1d1840');
    for (const p of frontRow) {
      px(ctx, p.x - 1, p.y + 2, 6, 9, '#3a2f6e');
      px(ctx, p.x, p.y + 5, 4, 4, p.shirt);
      px(ctx, p.x + 1, p.y + 2, 2, 3, p.skin);
    }
    // barricade
    px(ctx, 0, 64, W, 3, '#1b2a6b'); px(ctx, 0, 64, W, 1, '#5d7bff');

    // commentary desk (zone 4)
    px(ctx, 50, 69, 60, 3, '#0e0e1e');
    px(ctx, 50, 72, 60, 9, '#22223e'); px(ctx, 50, 72, 60, 1, '#4a4a7a');
    [56, 76, 96].forEach((x, i) => {
      px(ctx, x, 66, 8, 2, '#111'); px(ctx, x + 1, 67, 6, 3, '#3ee6ff');
      px(ctx, x + 2, 62 + 0, 4, 4, SKIN[(i * 2) % SKIN.length]);
      px(ctx, x + 1, 66, 6, 0, '#000');
    });
    px(ctx, 60, 75, 40, 3, '#e8173b'); // desk logo stripe

    // ringside floor
    px(ctx, 0, 83, W, 72, '#121433');
    for (let y = 84; y < 155; y += 6) px(ctx, 0, y, W, 1, '#15173a');

    // ring apron (zone 2)
    px(ctx, 38, 89, 84, 61, '#1a1a2e');
    px(ctx, 38, 143, 84, 7, '#c8102e');
    for (let x = 42; x < 120; x += 8) px(ctx, x, 145, 4, 3, '#ffcc33'); // apron lettering dashes
    // ring mat (zone 3)
    px(ctx, 43, 92, 74, 50, '#dcd8cc');
    px(ctx, 43, 92, 74, 2, '#ece9df');
    // center logo
    for (let a = 0; a < 6.28; a += 0.12) px(ctx, 80 + Math.cos(a) * 11, 117 + Math.sin(a) * 11, 1, 1, '#c8102e');
    px(ctx, 76, 112, 8, 2, '#c8102e'); px(ctx, 76, 112, 2, 10, '#c8102e'); px(ctx, 76, 120, 8, 2, '#c8102e');
    // ropes
    const rope = (o, c) => { px(ctx, 41 + o, 90 + o, 78 - o * 2, 1, c); px(ctx, 41 + o, 142 - o, 78 - o * 2, 1, c); px(ctx, 41 + o, 90 + o, 1, 53 - o * 2, c); px(ctx, 118 - o, 90 + o, 1, 53 - o * 2, c); };
    rope(0, '#e23b4e'); rope(1, '#f5f5f5'); rope(2, '#3b6cff');
    // turnbuckles
    [[39, 88], [117, 88], [39, 140], [117, 140]].forEach(([x, y]) => { px(ctx, x, y, 4, 4, '#ffcc33'); px(ctx, x + 1, y + 1, 2, 2, '#fff3b0'); });
    // steel steps
    px(ctx, 30, 136, 8, 10, '#7a7f95'); px(ctx, 122, 136, 8, 10, '#7a7f95');

    // ramp (zone 1)
    for (let y = 154; y < 200; y++) {
      const k = (y - 154) / 46;
      const half = 12 + k * 20;
      px(ctx, 80 - half, y, half * 2, 1, y % 2 ? '#2a2352' : '#2e2759');
    }
    // chasing ramp lights
    for (let i = 0; i < 12; i++) {
      const y = 156 + i * 4, k = (y - 154) / 46, half = 12 + k * 20;
      const on = (Math.floor(t * 8) + i) % 3 === 0;
      const c = on ? (i % 2 ? '#ff3e7f' : '#3ee6ff') : '#3a3366';
      px(ctx, 80 - half - 2, y, 2, 2, c); px(ctx, 80 + half, y, 2, 2, c);
    }
    // stage LED strip + pyro posts
    px(ctx, 40, 196, 80, 4, '#0f0f22');
    for (let x = 40; x < 120; x += 2) px(ctx, x, 196, 1, 1, (Math.floor(t * 10) + x) % 7 === 0 ? '#ffffff' : '#ffcc33');
    // spotlight cones
    ctx.globalAlpha = 0.07 + 0.03 * Math.sin(t * 1.5);
    ctx.fillStyle = '#fff7c2';
    ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(28, 0); ctx.lineTo(90, 140); ctx.lineTo(60, 140); ctx.fill();
    ctx.beginPath(); ctx.moveTo(132, 0); ctx.lineTo(140, 0); ctx.lineTo(100, 140); ctx.lineTo(70, 140); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Full-screen crowd backdrop drawn at 1/4 resolution, scaled up crisp.
  let bgCrowd = null, bgW = 0, bgH = 0;
  function sizeBg(canvas) {
    const s = 5;
    bgW = Math.ceil(window.innerWidth / s); bgH = Math.ceil(window.innerHeight / s);
    canvas.width = bgW; canvas.height = bgH;
    bgCrowd = makeCrowd(99, Math.ceil(bgW / 4) + 2, Math.ceil(bgH / 7) + 1, 4, 7, -2, 0);
  }
  function drawBg(ctx, t) {
    const g = ctx.createLinearGradient(0, 0, 0, bgH);
    g.addColorStop(0, '#120b26'); g.addColorStop(1, '#07060f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, bgW, bgH);
    ctx.globalAlpha = 0.22;
    for (const p of bgCrowd) {
      const b = Math.sin(t * 2.5 + p.phase) > 0.7 ? -1 : 0;
      px(ctx, p.x, p.y + 3 + b, 3, 3, p.shirt);
      px(ctx, p.x + 0.5, p.y + b, 2, 2, p.skin);
    }
    ctx.globalAlpha = 1;
    const fr = rng(Math.floor(t * 5));
    for (let i = 0; i < Math.max(4, bgW / 30); i++) {
      const x = Math.floor(fr() * bgW), y = Math.floor(fr() * bgH);
      px(ctx, x, y, 1, 1, '#fff7c2');
    }
    // vignette so foreground stays readable
    const v = ctx.createRadialGradient(bgW / 2, bgH * 0.45, bgH * 0.1, bgW / 2, bgH * 0.45, bgH * 0.8);
    v.addColorStop(0, 'rgba(7,6,15,0.72)'); v.addColorStop(1, 'rgba(7,6,15,0.9)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, bgW, bgH);
  }

  function start(bgCanvas, stageCanvas) {
    const bctx = bgCanvas.getContext('2d'), sctx = stageCanvas.getContext('2d');
    sizeBg(bgCanvas);
    window.addEventListener('resize', () => sizeBg(bgCanvas));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last = 0;
    function frame(ms) {
      if (ms - last > 110) { // ~9fps is plenty for pixel art and cheap on phones
        last = ms;
        const t = reduce ? 0 : ms / 1000;
        drawBg(bctx, t);
        if (stageCanvas.offsetParent) drawStage(sctx, t);
      }
      requestAnimationFrame(frame);
    }
    drawStage(sctx, 0);
    requestAnimationFrame(frame);
  }

  window.Arena = { W, H, SPOTS, ZONES, start };
})();
