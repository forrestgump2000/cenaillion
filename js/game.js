(() => {
  'use strict';

  const ROUNDS = 7;
  const SECONDS = 25;
  const TIERS = [
    null,
    { id: 1, name: 'Entrance Ramp', pts: 10, color: '#b8b3d9', emoji: '⬜', desc: 'Popular answer', side: 'l' },
    { id: 2, name: 'On the Apron', pts: 15, color: '#3e9bff', emoji: '🟦', desc: 'Relatively popular', side: 'r' },
    { id: 3, name: 'In the Ring', pts: 30, color: '#2fd17a', emoji: '🟩', desc: 'Kind of popular', side: 'l' },
    { id: 4, name: 'Commentary Desk', pts: 60, color: '#ffcc33', emoji: '🟨', desc: 'Rare answer', side: 'r' },
    { id: 5, name: 'Front Row Seat', pts: 85, color: '#ff7a2f', emoji: '🟧', desc: 'Very rare answer', side: 'l' },
    { id: 6, name: 'In the Stands', pts: 100, color: '#ff3e7f', emoji: '🟥', desc: 'One in a Cenaillion', side: 'r' },
  ];
  // token landing spots (% of the pixel stage)
  const SPOTS = window.Arena.SPOTS.map((p) => (p ? [(p[0] / window.Arena.W) * 100, (p[1] / window.Arena.H) * 100] : null));

  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('cen_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('cen_' + k, JSON.stringify(v)); } catch {} },
  };

  /* ---------------- matching ---------------- */
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/\bjr\b\.?/g, 'jr').replace(/^\s*the\s+/, '')
    .replace(/[^a-z0-9]/g, '');
  const ALIAS = {};
  (window.ALIAS_GROUPS || []).forEach((g) => {
    const c = norm(g[0]);
    g.forEach((a) => { ALIAS[norm(a)] = c; });
  });
  const key = (s) => { const n = norm(s); return ALIAS[n] || n; };
  const words = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[\s\-/.'’]+/).map((w) => w.replace(/[^a-z0-9]/g, '')).filter((w) => w.length >= 3 && w !== 'the' && w !== 'and');

  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  function prepCategory(cat) {
    if (cat._prepped) return;
    cat.answers.forEach((a) => {
      a.keys = [...new Set(a.names.map(key))];
      a.words = [...new Set(a.names.flatMap(words))];
    });
    cat._prepped = true;
  }

  // returns {answer} | {ambiguous:[...]} | null
  function findAnswer(cat, raw) {
    prepCategory(cat);
    const k = key(raw);
    if (!k) return null;
    for (const a of cat.answers) if (a.keys.includes(k)) return { answer: a };
    // fuzzy
    const max = k.length >= 8 ? 2 : k.length >= 5 ? 1 : 0;
    if (max) {
      let best = null, bestD = max + 1;
      for (const a of cat.answers) for (const ak of a.keys) {
        const d = lev(k, ak, max);
        if (d < bestD) { bestD = d; best = a; }
      }
      if (best) return { answer: best };
    }
    // single-word (surname / nickname) match
    const w = words(raw);
    if (w.length === 1) {
      const hits = cat.answers.filter((a) => a.words.includes(w[0]));
      if (hits.length === 1) return { answer: hits[0] };
      if (hits.length > 1) return { ambiguous: hits };
    }
    return null;
  }

  /* ---------------- rng ---------------- */
  function mulberry32(a) {
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const hashStr = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  const CATS = (window.CATS || []).filter((c) => c.answers.length >= 6);
  // Spread each category's tiers across the full 1–6 range so the rarest
  // answers in a short list still reach "In the Stands".
  CATS.forEach((c) => {
    const maxT = Math.max(...c.answers.map((a) => a.tier));
    if (maxT >= 6 || maxT < 2) return;
    c.answers.forEach((a) => { a.tier = Math.round(1 + ((a.tier - 1) * 5) / (maxT - 1)); });
  });

  function pickCats(rand, avoid = []) {
    const avoidSet = new Set(avoid);
    let pool = CATS.filter((c) => !avoidSet.has(c.name));
    if (pool.length < ROUNDS) pool = CATS.slice();
    const out = [];
    const used = new Set();
    while (out.length < ROUNDS && pool.length) {
      const i = Math.floor(rand() * pool.length);
      const c = pool.splice(i, 1)[0];
      if (c.group && used.has(c.group)) continue; // avoid near-duplicate categories in one card
      if (c.group) used.add(c.group);
      out.push(c);
    }
    return out;
  }

  /* ---------------- sound ---------------- */
  let muted = store.get('muted', false);
  let actx = null;
  function beep(freq, dur = 0.08, type = 'square', vol = 0.05, when = 0) {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime + when;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch {}
  }
  const bell = () => { beep(880, 0.5, 'triangle', 0.08); beep(1320, 0.45, 'sine', 0.05, 0.02); };

  /* ---------------- state ---------------- */
  let state = null;
  let timerRAF = null;

  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  }

  function buildLegend(el) {
    el.innerHTML = TIERS.slice(1).reverse().map((t) =>
      `<div class="tier-row"><span class="sw" style="background:${t.color};color:${t.color}"></span><span class="nm" style="color:${t.color}">${t.name.toUpperCase()}<small>${t.desc}</small></span><span class="pt" style="color:${t.color}">+${t.pts}</span></div>`).join('');
  }

  function buildArena() {
    document.querySelectorAll('.zone').forEach((z) => {
      const [x, y, w, h] = window.Arena.ZONES[z.dataset.z];
      Object.assign(z.style, { left: x + '%', top: y + '%', width: w + '%', height: h + '%' });
    });
    $('zoneTags').innerHTML = TIERS.slice(1).map((t) =>
      `<div class="ztag ${t.side}" data-z="${t.id}" style="top:${SPOTS[t.id][1]}%;color:${t.color}"><span>+${t.pts} ${t.name.split(' ').pop().toUpperCase()}</span></div>`).join('');
    window.Arena.start($('bg'), $('stageCanvas'));
    window.addEventListener('resize', fitStage);
    if (window.ResizeObserver) new ResizeObserver(fitStage).observe($('stageWrap'));
  }

  // Scale the 160x200 pixel stage to the biggest whole-ish size that fits.
  function fitStage() {
    const wrap = $('stageWrap'), st = $('arena');
    if (!wrap.offsetParent) return;
    const r = wrap.getBoundingClientRect();
    const k = Math.max(1, Math.min((r.width - 12) / window.Arena.W, (r.height - 12) / window.Arena.H));
    st.style.width = Math.floor(window.Arena.W * k) + 'px';
    st.style.height = Math.floor(window.Arena.H * k) + 'px';
  }

  function resetArena() {
    document.querySelectorAll('.zone').forEach((z) => { z.classList.remove('lit', 'final'); z.style.removeProperty('--zc'); });
    document.querySelectorAll('.ztag').forEach((z) => z.classList.remove('hit'));
    const tok = $('token');
    tok.getAnimations().forEach((a) => a.cancel());
    tok.classList.remove('show');
    tok.style.left = SPOTS[1][0] + '%'; tok.style.top = SPOTS[1][1] + '%';
    const pop = $('landPop'); pop.className = 'land-pop'; pop.innerHTML = '';
    $('arena').classList.remove('flash');
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Token hops zone to zone up to `tier`. Kept short (~0.95s max).
  async function animateTo(tier) {
    resetArena();
    const tok = $('token');
    const zone = (z) => document.querySelector(`.zone[data-z="${z}"]`);
    const tag = (z) => document.querySelector(`.ztag[data-z="${z}"]`);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (tier === 0) {
      const pop = $('landPop');
      pop.style.color = '#9c95c9';
      pop.style.top = '50%';
      $('spotVal').textContent = 'NO SHOW';
      const st = $('arena'); st.classList.remove('shake'); void st.offsetWidth; st.classList.add('shake');
      pop.innerHTML = 'NO SHOW<small>0 PTS</small>';
      pop.classList.add('go');
      beep(140, 0.3, 'sawtooth', 0.05);
      await sleep(350);
      return;
    }
    tok.classList.add('show');
    zone(1).classList.add('lit'); tag(1).classList.add('hit');
    $('spotVal').textContent = TIERS[1].name.toUpperCase();
    beep(330, 0.06);
    const hop = reduce ? 60 : Math.max(120, 170 - tier * 8);
    for (let z = 2; z <= tier; z++) {
      const [x0, y0] = SPOTS[z - 1], [x1, y1] = SPOTS[z];
      const arc = Math.min(10, (y0 - y1) * 0.6);
      const anim = tok.animate([
        { left: x0 + '%', top: y0 + '%', transform: 'translate(-50%,-80%) scale(1,1)' },
        { left: (x0 + x1) / 2 + '%', top: Math.min(y0, y1) - arc + '%', transform: 'translate(-50%,-80%) scale(.9,1.12)', offset: 0.5 },
        { left: x1 + '%', top: y1 + '%', transform: 'translate(-50%,-80%) scale(1.15,.85)' },
      ], { duration: hop, easing: 'ease-in-out', fill: 'forwards' });
      await anim.finished;
      tok.style.left = x1 + '%'; tok.style.top = y1 + '%';
      zone(z - 1).classList.remove('lit');
      zone(z).classList.add('lit'); tag(z).classList.add('hit');
      $('spotVal').textContent = TIERS[z].name.toUpperCase();
      beep(330 * Math.pow(1.19, z), 0.06);
    }
    tok.animate([{ transform: 'translate(-50%,-80%) scale(1.5)' }, { transform: 'translate(-50%,-80%) scale(1)' }], { duration: 220, easing: 'ease-out' });
    const t = TIERS[tier];
    const fz = zone(tier);
    fz.classList.remove('lit'); fz.classList.add('final'); fz.style.setProperty('--zc', t.color);
    const arena = $('arena');
    arena.classList.remove('flash'); void arena.offsetWidth; arena.classList.add('flash');
    const pop = $('landPop');
    pop.style.color = t.color;
    pop.style.top = (tier >= 4 ? Math.min(SPOTS[tier][1] + 20, 60) : SPOTS[tier][1] - 24) + '%';
    pop.innerHTML = `+${t.pts}<small>${tier === 6 ? 'ONE IN A CENAILLION' : t.name.toUpperCase()}</small>`;
    pop.classList.add('go');
    if (tier >= 5) bell(); else beep(660, 0.15, 'triangle', 0.06);
  }

  /* ---------------- game flow ---------------- */
  function startGame(mode) {
    const daily = mode === 'daily';
    if (daily) {
      const done = store.get('daily_' + todayStr(), null);
      if (done) { renderEnd(done, true); return; }
    }
    const rand = daily ? mulberry32(hashStr('cenaillion-' + todayStr())) : Math.random;
    const recent = daily ? [] : store.get('recent', []);
    const cats = pickCats(rand, recent);
    if (!daily) store.set('recent', [...cats.map((c) => c.name), ...recent].slice(0, 120));
    state = { mode, cats, round: 0, score: 0, results: [], locked: false };
    show('screen-game');
    requestAnimationFrame(fitStage);
    renderPips();
    startRound();
  }

  function renderPips() {
    $('pips').innerHTML = state.cats.map((_, i) => {
      const r = state.results[i];
      const bg = r ? (r.tier ? TIERS[r.tier].color : '#3a3366') : '';
      return `<span class="pip ${i === state.round && !r ? 'cur' : ''}" style="${bg ? 'background:' + bg : ''}"></span>`;
    }).join('');
    $('scoreVal').textContent = state.score;
  }

  function startRound() {
    const cat = state.cats[state.round];
    state.locked = false;
    state.tries = [];
    $('roundNum').textContent = state.round + 1;
    $('roundNum2').textContent = state.round + 1;
    $('spotVal').textContent = 'BACKSTAGE';
    $('catName').textContent = cat.name;
    $('catHint').textContent = cat.hint || '';
    $('feedback').textContent = ''; $('feedback').className = 'feedback';
    $('result').hidden = true;
    const inp = $('answerInput');
    inp.value = ''; inp.disabled = false; $('submitBtn').disabled = false;
    $('answerForm').hidden = false;
    resetArena();
    renderPips();
    inp.focus({ preventScroll: true });
    state.deadline = performance.now() + SECONDS * 1000;
    tick();
  }

  function tick() {
    cancelAnimationFrame(timerRAF);
    const left = Math.max(0, state.deadline - performance.now());
    const frac = left / (SECONDS * 1000);
    $('timerFill').style.transform = `scaleX(${frac})`;
    const secs = Math.ceil(left / 1000);
    $('timerText').textContent = secs;
    $('timerText').parentElement.classList.toggle('low', left < 5000);
    if (state.lastSec !== secs && secs <= 3 && secs > 0) beep(520, 0.05, 'square', 0.03);
    state.lastSec = secs;
    if (left <= 0) { lockIn(null); return; }
    if (!state.locked) timerRAF = requestAnimationFrame(tick);
  }

  function rejectInput(msg) {
    const inp = $('answerInput');
    $('feedback').textContent = msg; $('feedback').className = 'feedback bad';
    inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake');
    inp.select();
    beep(160, 0.12, 'sawtooth', 0.04);
  }

  function onSubmit(e) {
    e.preventDefault();
    if (state.locked) return;
    const raw = $('answerInput').value.trim();
    if (!raw) return;
    const cat = state.cats[state.round];
    const res = findAnswer(cat, raw);
    if (!res) { rejectInput(`“${raw}” isn't on our card for this one. Keep swinging!`); return; }
    if (res.ambiguous) {
      rejectInput(`Be more specific — ${res.ambiguous.slice(0, 3).map((a) => a.display).join(' or ')}?`);
      return;
    }
    lockIn(res.answer);
  }

  async function lockIn(answer) {
    if (state.locked) return;
    state.locked = true;
    cancelAnimationFrame(timerRAF);
    $('timerText').parentElement.classList.remove('low');
    const cat = state.cats[state.round];
    const tier = answer ? answer.tier : 0;
    const pts = tier ? TIERS[tier].pts : 0;
    state.score += pts;
    state.results.push({ cat: cat.name, answer: answer ? answer.display : null, tier, pts });
    $('answerInput').disabled = true; $('submitBtn').disabled = true;
    $('answerInput').blur();
    $('feedback').textContent = answer ? '' : "⏰ Time's up — the ref counted to 25.";
    $('feedback').className = 'feedback' + (answer ? '' : ' bad');
    $('answerForm').hidden = !!answer;
    renderPips();
    await animateTo(tier);
    showResult(cat, answer, tier, pts);
  }

  function showResult(cat, answer, tier, pts) {
    const t = TIERS[tier];
    $('resAnswer').textContent = answer ? answer.display : 'No answer';
    $('resTier').innerHTML = tier ? `<span style="color:${t.color}">+${pts} · ${t.name}</span>` : '<span style="color:#9c95c9">0 pts</span>';
    // show some rarer answers
    const rarer = cat.answers.filter((a) => a.tier > tier && a.tier >= 4);
    const target = rarer.length ? rarer : cat.answers.filter((a) => a.tier === 6 && (!answer || a !== answer));
    const sample = shuffle(target.slice()).slice(0, 3).sort((a, b) => b.tier - a.tier);
    $('resMore').innerHTML = sample.length
      ? (tier === 6 ? 'Other answers in the stands: ' : 'Rarer picks: ') +
        sample.map((a) => `<b>${esc(a.display)}</b> <span style="color:${TIERS[a.tier].color}">(+${TIERS[a.tier].pts})</span>`).join(', ')
      : '';
    $('nextBtn').textContent = state.round + 1 >= ROUNDS ? 'FINAL BELL ▶' : 'NEXT MATCH ▶';
    $('result').hidden = false;
    $('nextBtn').focus({ preventScroll: true });
    $('result').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function next() {
    state.round++;
    if (state.round >= ROUNDS) return finish();
    startRound();
  }

  function finish() {
    const summary = { mode: state.mode, date: todayStr(), score: state.score, results: state.results };
    if (state.mode === 'daily') store.set('daily_' + todayStr(), summary);
    const best = store.get('best', 0);
    if (state.score > best) store.set('best', state.score);
    store.set('games', store.get('games', 0) + 1);
    renderEnd(summary, false);
  }

  function rankFor(s) {
    if (s >= 650) return '🏆 One in a Cenaillion — Hall of Famer';
    if (s >= 520) return '🥇 Main Eventer';
    if (s >= 400) return '⭐ Upper Midcarder';
    if (s >= 280) return '💪 Midcard Workhorse';
    if (s >= 160) return '🎽 Enhancement Talent';
    return '🪑 Jobber to the Stars';
  }

  function renderEnd(sum, already) {
    show('screen-end');
    $('finalScore').textContent = sum.score;
    $('rankName').textContent = rankFor(sum.score);
    $('emojiLine').textContent = sum.results.map((r) => (r.tier ? TIERS[r.tier].emoji : '⬛')).join('');
    $('recap').innerHTML = sum.results.map((r) => {
      const c = r.tier ? TIERS[r.tier].color : '#3a3366';
      return `<li style="--c:${c}"><span class="rc">${esc(r.cat)}</span><span class="rp">+${r.pts}</span><span class="ra">${r.answer ? esc(r.answer) : '<i style="color:#9c95c9">no answer</i>'}${r.tier ? ` <small style="color:${c}">· ${TIERS[r.tier].name}</small>` : ''}</span></li>`;
    }).join('');
    $('shareNote').textContent = already ? "You've already played today's Daily Card — come back tomorrow!" : '';
    state = state || {};
    state.summary = sum;
  }

  async function share() {
    const s = state.summary;
    const text = `CENAILLION ${s.mode === 'daily' ? 'Daily ' + s.date : 'Random Match'}\n${s.results.map((r) => (r.tier ? TIERS[r.tier].emoji : '⬛')).join('')}  ${s.score}/700\n${rankFor(s.score)}\n${location.origin}`;
    try {
      if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); $('shareNote').textContent = 'Copied to clipboard!'; }
    } catch { $('shareNote').textContent = 'Could not share — copy manually:\n' + text; }
  }

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function renderHome() {
    show('screen-home');
    const done = store.get('daily_' + todayStr(), null);
    $('dailyNote').textContent = done ? `TODAY: ${done.score}/700` : 'NEW CARD DAILY';
    const best = store.get('best', 0);
    $('bestNote').textContent = best ? `Personal best: ${best}/700` : '';
    $('catCount').textContent = CATS.length;
    if (state) cancelAnimationFrame(timerRAF);
  }

  /* ---------------- init ---------------- */
  buildLegend($('legend'));
  buildLegend($('legend2'));
  buildArena();
  $('soundBtn').textContent = muted ? '🔇' : '🔊';
  $('soundBtn').onclick = () => { muted = !muted; store.set('muted', muted); $('soundBtn').textContent = muted ? '🔇' : '🔊'; };
  $('helpBtn').onclick = () => $('helpDlg').showModal();
  $('closeHelp').onclick = () => $('helpDlg').close();
  $('homeBtn').onclick = () => { if (state && state.locked === false && !confirm('Leave this match?')) return; cancelAnimationFrame(timerRAF); state = null; renderHome(); };
  $('endHomeBtn').onclick = () => { state = null; renderHome(); };
  $('dailyBtn').onclick = () => startGame('daily');
  $('randomBtn').onclick = () => startGame('random');
  $('againBtn').onclick = () => startGame('random');
  $('shareBtn').onclick = share;
  $('answerForm').addEventListener('submit', onSubmit);
  $('answerInput').addEventListener('input', () => { if ($('feedback').classList.contains('bad')) { $('feedback').textContent = ''; $('feedback').className = 'feedback'; } });
  $('nextBtn').onclick = next;
  renderHome();
  if (!store.get('seenHelp', false)) { store.set('seenHelp', true); }

  // debug hook for testing
  window.__cen = { findAnswer, CATS, key };
})();
