/* ============================================================
   INTRO EXPERIENCE
   • Canvas-rendered title: per-letter typing, glitch, mirror sheen
   • Real geometric fragmentation: the rendered title is sliced into
     triangular glass shards, each becoming its own textured canvas
     that flies toward the camera and falls under gravity.
   • Atmospheric dust canvas + cinematic camera push-in.
   ============================================================ */
(function () {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const intro = document.getElementById('intro');
  if (!intro) return;

  const stage = document.getElementById('title-stage');
  const canvas = document.getElementById('title-canvas');
  const ctx = canvas.getContext('2d');
  const shardsLayer = document.getElementById('shards');
  const flash = document.getElementById('title-flash');
  const kicker = document.getElementById('intro-kicker');
  const sub = document.getElementById('intro-sub');
  const skipBtn = document.getElementById('skip-intro');

  const LINES = ['WELCOME TO', 'SANTHOSH', 'PORTFOLIO'];
  const FONT_STACK = 'Cinzel, "Times New Roman", serif';

  let W = 0, H = 0, DPR = 1;
  let fontSize = 60, lineHeight = 70, padTop = 0;
  let letters = [];
  let revealed = 0;
  let phase = 'idle';
  let mirror = 0;
  let sweep = -1;
  let rafId = 0;
  let glitchBurst = 0;
  let done = false;
  let typingTimer = 0;
  let waitTimer = 0;

  /* ---------------- layout ---------------- */
  function layout() {
    const rect = stage.getBoundingClientRect();
    W = Math.max(280, Math.round(rect.width));
    DPR = Math.min(window.devicePixelRatio || 1, 2);

    // measure at a reference size, then scale to fit
    const ref = 100;
    ctx.font = '600 ' + ref + 'px ' + FONT_STACK;
    const trackingRef = ref * 0.055;
    let maxW = 0;
    LINES.forEach(function (line) {
      let w = 0;
      for (const ch of line) w += ctx.measureText(ch).width;
      w += trackingRef * (line.length - 1);
      maxW = Math.max(maxW, w);
    });

    const targetW = W * 0.97;
    let fs = (ref * targetW) / maxW;

    // keep the block within a sane share of the viewport
    const vh = window.innerHeight;
    const maxBlock = Math.min(vh * 0.52, 520);
    const lhRatio = 1.16;
    if (fs * LINES.length * lhRatio > maxBlock) fs = maxBlock / (LINES.length * lhRatio);
    fs = Math.max(26, Math.min(fs, 168));

    fontSize = fs;
    lineHeight = fs * lhRatio;
    padTop = fs * 0.42;

    const reflectionSpace = fs * 0.78;
    H = Math.round(padTop + lineHeight * LINES.length + reflectionSpace);

    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = '100%';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    // build letter positions
    letters = [];
    ctx.font = '600 ' + fs + 'px ' + FONT_STACK;
    const tracking = fs * 0.055;
    let index = 0;
    LINES.forEach(function (line, li) {
      const chars = Array.from(line);
      const widths = chars.map(function (c) { return ctx.measureText(c).width; });
      const total = widths.reduce(function (a, b) { return a + b; }, 0) + tracking * (chars.length - 1);
      let x = (W - total) / 2;
      const y = padTop + li * lineHeight + fs * 0.82;
      chars.forEach(function (ch, ci) {
        letters.push({
          ch: ch,
          x: x,
          y: y,
          line: li,
          index: index++,
          glitchUntil: 0,
          seed: Math.random() * 100
        });
        x += widths[ci] + tracking;
      });
    });

    draw();
  }

  /* ---------------- painting ---------------- */
  function metallicGradient() {
    const g = ctx.createLinearGradient(0, padTop, 0, padTop + lineHeight * LINES.length);
    g.addColorStop(0.00, '#ffffff');
    g.addColorStop(0.16, '#cfc4bf');
    g.addColorStop(0.30, '#8e7f79');
    g.addColorStop(0.42, '#f6efea');
    g.addColorStop(0.55, '#6d5e59');
    g.addColorStop(0.70, '#d8ccc6');
    g.addColorStop(0.84, '#9a8a84');
    g.addColorStop(1.00, '#f3eae4');
    return g;
  }

  function drawLetter(letter, now, fill) {
    const glitching = now < letter.glitchUntil;
    let ox = 0, oy = 0;
    if (glitching) {
      ox = (Math.random() - 0.5) * fontSize * 0.055;
      oy = (Math.random() - 0.5) * fontSize * 0.045;
    }
    if (glitchBurst > 0 && Math.random() < 0.22) {
      ox += (Math.random() - 0.5) * fontSize * 0.04;
    }

    ctx.save();
    ctx.font = '600 ' + fontSize + 'px ' + FONT_STACK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // chromatic ghosts while glitching
    if (glitching) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = 'rgba(0,229,255,.55)';
      ctx.fillText(letter.ch, letter.x + ox - 2, letter.y + oy);
      ctx.fillStyle = 'rgba(255,43,69,.6)';
      ctx.fillText(letter.ch, letter.x + ox + 2, letter.y + oy);
      ctx.globalAlpha = 1;
    }

    ctx.shadowColor = 'rgba(200,16,46,.55)';
    ctx.shadowBlur = fontSize * 0.26;
    ctx.fillStyle = fill;
    ctx.fillText(letter.ch, letter.x + ox, letter.y + oy);
    ctx.shadowBlur = 0;

    if (mirror > 0.05) {
      ctx.globalAlpha = mirror * 0.9;
      ctx.fillStyle = metallicGradient();
      ctx.fillText(letter.ch, letter.x + ox, letter.y + oy);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function draw() {
    const now = performance.now();
    ctx.clearRect(0, 0, W, H);

    const baseFill = '#f1e8e2';
    for (let i = 0; i < letters.length; i++) {
      if (i >= revealed) break;
      drawLetter(letters[i], now, baseFill);
    }

    // mirror reflection on the floor
    if (mirror > 0.35) {
      ctx.save();
      ctx.globalAlpha = 0.14 * mirror;
      ctx.translate(0, padTop + lineHeight * LINES.length + fontSize * 0.1);
      ctx.scale(1, -0.55);
      ctx.filter = 'blur(' + (2 + (1 - mirror) * 4) + 'px)';
      ctx.font = '600 ' + fontSize + 'px ' + FONT_STACK;
      ctx.fillStyle = '#d9c9c3';
      for (let i = 0; i < letters.length; i++) {
        if (i >= revealed) break;
        const l = letters[i];
        ctx.fillText(l.ch, l.x, -l.y + padTop * 2 + lineHeight * LINES.length * 0.06);
      }
      ctx.restore();
      ctx.filter = 'none';
    }

    // specular sweep across the mirror surface
    if (mirror > 0.15 && sweep >= -0.2) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      const sx = sweep * (W + 700) - 350;
      const g = ctx.createLinearGradient(sx - 220, 0, sx + 220, H);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.42, 'rgba(255,255,255,0.05)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.58, 'rgba(255,255,255,0.05)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // faint red edge glow under the whole block
    if (mirror > 0.4) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rg = ctx.createRadialGradient(W / 2, padTop + lineHeight * 1.4, 10, W / 2, padTop + lineHeight * 1.4, W * 0.62);
      rg.addColorStop(0, 'rgba(200,16,46,' + (0.10 * mirror) + ')');
      rg.addColorStop(1, 'rgba(200,16,46,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  function loop() {
    if (phase === 'done') return;
    if (glitchBurst > 0) glitchBurst -= 0.016;
    draw();
    rafId = requestAnimationFrame(loop);
  }

  /* ---------------- typing ---------------- */
  function typeNext() {
    if (phase !== 'typing') return;
    if (revealed >= letters.length) {
      onTypingComplete();
      return;
    }
    const letter = letters[revealed];
    revealed++;
    letter.glitchUntil = performance.now() + 130;

    if (letter.ch !== ' ' && window.audioEngine) window.audioEngine.typeSound();
    draw();

    const base = letter.ch === ' ' ? 40 : 62;
    const jitter = Math.random() * 58;
    const pause = (letter.ch === 'O' || letter.ch === 'S') && Math.random() > 0.6 ? 90 : 0;
    typingTimer = window.setTimeout(typeNext, base + jitter + pause);
  }

  function onTypingComplete() {
    phase = 'holding';
    gsap.to(sub, { opacity: 1, duration: 1.2, ease: 'power2.out' });

    // required ~2s pause, then the mirror reveal
    waitTimer = window.setTimeout(function () {
      if (phase !== 'holding') return;
      toMirror();
    }, prefersReduced ? 900 : 2000);
  }

  function toMirror() {
    phase = 'mirror';
    if (window.audioEngine) window.audioEngine.transition();
    gsap.to(sub, { opacity: 0, duration: 0.6 });

    const state = { m: 0, s: -0.2 };
    gsap.to(state, {
      m: 1,
      duration: prefersReduced ? 0.3 : 1.0,
      ease: 'power2.inOut',
      onUpdate: function () { mirror = state.m; }
    });
    gsap.to(state, {
      s: 1.2,
      duration: prefersReduced ? 0.4 : 1.35,
      delay: 0.15,
      ease: 'power2.inOut',
      onUpdate: function () { sweep = state.s; }
    });

    // slight camera push on the title
    gsap.to(stage, { scale: 1.035, duration: 1.2, ease: 'power2.inOut' });

    waitTimer = window.setTimeout(function () {
      if (phase === 'mirror') shatter();
    }, prefersReduced ? 700 : 1450);
  }

  /* ---------------- shatter ---------------- */
  function buildShards(density) {
    const cols = Math.max(7, Math.round(density));
    const rows = Math.max(4, Math.round(density * 0.52));
    const pts = [];
    const cellW = W / cols;
    const cellH = H / rows;

    for (let r = 0; r <= rows; r++) {
      pts[r] = [];
      for (let c = 0; c <= cols; c++) {
        const jx = (c === 0 || c === cols) ? 0 : (Math.random() - 0.5) * cellW * 0.85;
        const jy = (r === 0 || r === rows) ? 0 : (Math.random() - 0.5) * cellH * 0.85;
        pts[r][c] = { x: c * cellW + jx, y: r * cellH + jy };
      }
    }

    const shards = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = pts[r][c], b = pts[r][c + 1], d = pts[r + 1][c], e = pts[r + 1][c + 1];
        shards.push([a, b, e]);
        shards.push([a, e, d]);
      }
    }
    return shards;
  }

  function makeShardEl(tri, srcCanvas) {
    const xs = tri.map(function (p) { return p.x; });
    const ys = tri.map(function (p) { return p.y; });
    const minX = Math.max(0, Math.floor(Math.min.apply(null, xs)));
    const minY = Math.max(0, Math.floor(Math.min.apply(null, ys)));
    const maxX = Math.min(W, Math.ceil(Math.max.apply(null, xs)));
    const maxY = Math.min(H, Math.ceil(Math.max.apply(null, ys)));
    const w = Math.max(3, maxX - minX);
    const h = Math.max(3, maxY - minY);

    const c = document.createElement('canvas');
    c.width = Math.round(w * DPR);
    c.height = Math.round(h * DPR);
    const cc = c.getContext('2d');
    cc.scale(DPR, DPR);

    cc.save();
    cc.beginPath();
    cc.moveTo(tri[0].x - minX, tri[0].y - minY);
    cc.lineTo(tri[1].x - minX, tri[1].y - minY);
    cc.lineTo(tri[2].x - minX, tri[2].y - minY);
    cc.closePath();
    cc.clip();
    cc.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, -minX, -minY, W, H);
    cc.restore();

    // crisp broken edge
    cc.save();
    cc.beginPath();
    cc.moveTo(tri[0].x - minX, tri[0].y - minY);
    cc.lineTo(tri[1].x - minX, tri[1].y - minY);
    cc.lineTo(tri[2].x - minX, tri[2].y - minY);
    cc.closePath();
    cc.strokeStyle = 'rgba(255,255,255,0.42)';
    cc.lineWidth = 0.8;
    cc.stroke();
    cc.restore();

    const el = document.createElement('div');
    el.className = 'shard';
    el.style.left = minX + 'px';
    el.style.top = minY + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    c.style.width = '100%';
    c.style.height = '100%';
    el.appendChild(c);
    shardsLayer.appendChild(el);

    return { el: el, cx: minX + w / 2, cy: minY + h / 2, w: w, h: h };
  }

  function shatter() {
    if (phase === 'shatter' || phase === 'done') return;
    phase = 'shatter';
    cancelAnimationFrame(rafId);
    window.clearTimeout(typingTimer);
    window.clearTimeout(waitTimer);

    // capture the finished mirror title
    draw();
    const src = document.createElement('canvas');
    src.width = canvas.width;
    src.height = canvas.height;
    src.getContext('2d').drawImage(canvas, 0, 0);

    // sound design
    if (window.audioEngine) {
      window.audioEngine.glassBreak();
      window.setTimeout(function () { window.audioEngine.glassFall(); }, 180);
    }

    // flash + impact shake
    gsap.fromTo(flash, { opacity: 0 }, {
      opacity: 1, duration: 0.07, yoyo: true, repeat: 1, ease: 'power1.in'
    });
    gsap.to(stage, {
      duration: 0.55, ease: 'power2.out',
      keyframes: [
        { x: -14, y: 7, duration: 0.06 },
        { x: 12, y: -6, duration: 0.06 },
        { x: -8, y: 4, duration: 0.07 },
        { x: 6, y: -3, duration: 0.08 },
        { x: 0, y: 0, duration: 0.28 }
      ]
    });

    // camera kick
    gsap.to('.intro__bg', { scale: '+=0.06', duration: 0.5, ease: 'power2.out' });
    gsap.to('.intro__content', { y: -10, duration: 0.6, ease: 'power2.out' });

    canvas.style.opacity = '0';

    // Do not let GSAP's lag smoothing stretch the shatter on slow GPUs.
    gsap.ticker.lagSmoothing(0);

    const density = W < 560 ? 6 : (W < 900 ? 7 : 9);
    const tris = buildShards(density);
    const frags = [];

    tris.forEach(function (tri) {
      const frag = makeShardEl(tri, src);
      if (frag.w < 2 || frag.h < 2) return;
      frags.push(frag);
    });

    // flying glass particles
    for (let i = 0; i < 26; i++) {
      const p = document.createElement('i');
      p.style.cssText =
        'position:absolute;width:' + (1 + Math.random() * 2.4) + 'px;height:' +
        (1 + Math.random() * 2.4) + 'px;background:#fff;border-radius:50%;' +
        'left:' + (W / 2 + (Math.random() - 0.5) * W * 0.8) + 'px;' +
        'top:' + (H / 2 + (Math.random() - 0.5) * H * 0.7) + 'px;' +
        'box-shadow:0 0 8px rgba(255,255,255,.9);opacity:0;pointer-events:none';
      shardsLayer.appendChild(p);
      gsap.to(p, {
        opacity: 1,
        duration: 0.08,
        delay: Math.random() * 0.1,
        onComplete: (function (node) {
          return function () {
            gsap.to(node, {
              x: (Math.random() - 0.5) * W * 1.4,
              y: 300 + Math.random() * 500,
              opacity: 0,
              duration: 1 + Math.random() * 1.2,
              ease: 'power2.in'
            });
          };
        })(p)
      });
    }

    const cx = W / 2;
    const cy = H / 2;

    frags.forEach(function (frag, i) {
      const nx = (frag.cx - cx) / (W / 2);
      const ny = (frag.cy - cy) / (H / 2);
      const delay = Math.random() * 0.16;
      const fly = 0.42 + Math.random() * 0.28;

      gsap.set(frag.el, { transformPerspective: 1000, transformOrigin: '50% 50%' });

      const tl = gsap.timeline({ delay: delay });

      // burst toward the viewer
      tl.to(frag.el, {
        z: 120 + Math.random() * 620,
        x: nx * (90 + Math.random() * 170),
        y: ny * (60 + Math.random() * 110) - 40,
        rotationX: (Math.random() - 0.5) * 170,
        rotationY: (Math.random() - 0.5) * 170,
        rotationZ: (Math.random() - 0.5) * 120,
        duration: fly,
        ease: 'power2.out'
      });

      // gravity fall + fade
      tl.to(frag.el, {
        y: '+=' + (420 + Math.random() * 520),
        z: 520 + Math.random() * 780,
        rotationX: '+=' + (Math.random() - 0.5) * 180,
        rotationY: '+=' + (Math.random() - 0.5) * 180,
        rotationZ: '+=' + (Math.random() - 0.5) * 160,
        opacity: 0,
        duration: 1.05 + Math.random() * 0.9,
        ease: 'power2.in'
      });

      // a few shards catch the light
      if (i % 9 === 0) {
        tl.to(frag.el, { filter: 'brightness(2.2)', duration: 0.1, yoyo: true, repeat: 1 }, 0);
      }
    });

    gsap.to(canvas, { opacity: 0, duration: 0.05 });

    // reveal the portfolio behind the collapsing glass
    window.setTimeout(finish, prefersReduced ? 700 : 1550);
  }

  /* ---------------- finish ---------------- */
  function finish() {
    if (done) return;
    done = true;
    phase = 'done';
    cancelAnimationFrame(rafId);
    window.clearTimeout(typingTimer);
    window.clearTimeout(waitTimer);

    if (window.audioEngine) window.audioEngine.transition();

    // Force the intro away even if the ticker is starved by a slow GPU.
    // Without this, a very low frame rate can leave the overlay on screen.
    function hardFinish() {
      intro.classList.add('is-done');
      intro.style.display = 'none';
      shardsLayer.innerHTML = '';
      gsap.ticker.lagSmoothing(500, 33);
    }
    window.setTimeout(hardFinish, 2400);

    gsap.to(intro, {
      opacity: 0,
      duration: 1.15,
      ease: 'power2.inOut',
      onComplete: hardFinish
    });

    document.body.classList.remove('is-locked');
    window.scrollTo(0, 0);

    document.dispatchEvent(new CustomEvent('intro:complete'));
    window.__introDone = true;
  }

  /* ---------------- dust canvas ---------------- */
  function initDust() {
    const c = document.getElementById('intro-dust');
    if (!c) return;
    const g = c.getContext('2d');
    let w = 0, h = 0, dpr = 1;
    let motes = [];
    let running = true;

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = w < 700 ? 40 : 78;
      motes = [];
      for (let i = 0; i < count; i++) {
        motes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.4 + Math.random() * 1.9,
          vy: -(0.06 + Math.random() * 0.28),
          vx: (Math.random() - 0.5) * 0.18,
          a: 0.06 + Math.random() * 0.34,
          red: Math.random() > 0.55,
          ph: Math.random() * Math.PI * 2
        });
      }
    }

    function frame(t) {
      if (!running) return;
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        m.x += m.vx + Math.sin(t * 0.0004 + m.ph) * 0.12;
        m.y += m.vy;
        if (m.y < -10) { m.y = h + 10; m.x = Math.random() * w; }
        if (m.x < -10) m.x = w + 10;
        if (m.x > w + 10) m.x = -10;
        const flick = 0.7 + Math.sin(t * 0.0016 + m.ph) * 0.3;
        g.beginPath();
        g.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        g.fillStyle = m.red
          ? 'rgba(255,70,90,' + (m.a * flick) + ')'
          : 'rgba(235,225,220,' + (m.a * flick * 0.6) + ')';
        g.shadowColor = m.red ? 'rgba(255,43,69,.8)' : 'rgba(255,255,255,.5)';
        g.shadowBlur = m.red ? 8 : 4;
        g.fill();
      }
      g.shadowBlur = 0;
      requestAnimationFrame(frame);
    }

    size();
    window.addEventListener('resize', size);
    requestAnimationFrame(frame);

    document.addEventListener('intro:complete', function () { running = false; });
  }

  /* ---------------- start ---------------- */
  function begin() {
    if (phase !== 'idle') return;
    layout();
    loop();

    // cinematic camera push toward the creature
    gsap.fromTo('.intro__bg',
      { scale: 1.02, y: 0 },
      { scale: 1.2, y: '-2.2%', duration: 20, ease: 'none' }
    );
    gsap.to(kicker, { opacity: 1, duration: 1.4, delay: 0.35, ease: 'power2.out' });

    phase = 'typing';

    if (prefersReduced) {
      revealed = letters.length;
      draw();
      onTypingComplete();
    } else {
      typingTimer = window.setTimeout(typeNext, 950);
    }
  }

  function skip() {
    if (done) return;
    window.clearTimeout(typingTimer);
    window.clearTimeout(waitTimer);
    revealed = letters.length;
    mirror = 1;
    sweep = 0.6;
    draw();
    if (window.audioEngine) window.audioEngine.transition();
    shatter();
  }

  skipBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    skip();
  });

  // subtle glitch bursts while the title is alive
  window.setInterval(function () {
    if (phase === 'typing' || phase === 'holding' || phase === 'mirror') {
      if (Math.random() > 0.55) glitchBurst = 0.1 + Math.random() * 0.14;
    }
  }, 2600);

  window.addEventListener('resize', function () {
    if (phase === 'idle') return;
    if (phase === 'typing' || phase === 'holding' || phase === 'mirror') {
      const keep = revealed;
      layout();
      revealed = keep;
      draw();
    }
  });

  // pause typing if the tab is hidden, resume when visible
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      window.clearTimeout(typingTimer);
    } else if (phase === 'typing' && revealed < letters.length) {
      typingTimer = window.setTimeout(typeNext, 300);
    }
  });

  window.IntroExperience = { begin: begin, skip: skip, finish: finish };

  function boot() {
    initDust();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { begin(); });
      window.setTimeout(function () { if (phase === 'idle') begin(); }, 900);
    } else {
      begin();
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }
})();
