/* ─────────────────────────────────────────────────────────
   ECHOHAUS AI — app.js
   Lenis smooth scroll + GSAP + canvas frame playback
   ───────────────────────────────────────────────────────── */

'use strict';

/* ── Constants ───────────────────────────────────────── */
const FRAME_COUNT  = 203;
const FRAME_SPEED  = 1.0;   // completes video animation at exactly 100% scroll (slide 4)
const IMAGE_SCALE  = 0.85;  // padded cover: prevents clipping into nav
const FIRST_BATCH  = 12;    // frames to load before showing page

/* ── Module-level state ───────────────────────────────── */
let lenis; // assigned in initPage after initLenis()

/* ── DOM References ───────────────────────────────────── */
const loader       = document.getElementById('loader');
const loaderBar    = document.getElementById('loader-bar');
const loaderPct    = document.getElementById('loader-percent');
const heroSection  = document.getElementById('hero');
const canvasWrap   = document.getElementById('canvas-wrap');
const canvas       = document.getElementById('canvas');
const ctx          = canvas.getContext('2d');
const scrollCont   = document.getElementById('scroll-container');

/* ── State ────────────────────────────────────────────── */
const frames       = new Array(FRAME_COUNT).fill(null);
let loadedCount    = 0;
let currentFrame   = 0;
let bgColor        = '#f8f8f8';
let pageInited     = false;

/* ─────────────────────────────────────────────────────────
   CANVAS SETUP
   ───────────────────────────────────────────────────────── */
function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w   = window.innerWidth;
  const h   = window.innerHeight;

  canvas.width        = w * dpr;
  canvas.height       = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);
}

/* ─────────────────────────────────────────────────────────
   BACKGROUND COLOR SAMPLING
   Reads corner/edge pixels from a frame to determine the
   background fill color → seamlessly fills padded borders
   ───────────────────────────────────────────────────────── */
function sampleBgColor(img) {
  try {
    const tc  = document.createElement('canvas');
    const tcx = tc.getContext('2d');
    const iw  = img.naturalWidth;
    const ih  = img.naturalHeight;
    tc.width  = iw;
    tc.height = ih;
    tcx.drawImage(img, 0, 0);

    const pts = [
      [0, 0], [iw - 1, 0],
      [0, ih - 1], [iw - 1, ih - 1],
      [Math.floor(iw / 2), 0],
      [0, Math.floor(ih / 2)],
    ];

    let r = 0, g = 0, b = 0;
    for (const [x, y] of pts) {
      const d = tcx.getImageData(x, y, 1, 1).data;
      r += d[0]; g += d[1]; b += d[2];
    }
    const n = pts.length;
    return `rgb(${Math.round(r/n)},${Math.round(g/n)},${Math.round(b/n)})`;
  } catch (_) {
    return '#f8f8f8'; // fallback (cross-origin or tainted canvas)
  }
}

/* ─────────────────────────────────────────────────────────
   DRAW FRAME
   Padded cover mode: fills edges with sampled bg color,
   then draws image centered at IMAGE_SCALE of cover size
   ───────────────────────────────────────────────────────── */
function drawFrame(index) {
  const img = frames[index];
  const dpr = window.devicePixelRatio || 1;
  const cw  = canvas.width  / dpr;
  const ch  = canvas.height / dpr;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, cw, ch);

  if (!img || !img.complete || !img.naturalWidth) return;

  const iw    = img.naturalWidth;
  const ih    = img.naturalHeight;
  const scale = Math.max(cw / iw, ch / ih) * IMAGE_SCALE;
  const dw    = iw * scale;
  const dh    = ih * scale;
  const dx    = (cw - dw) / 2;
  const dy    = (ch - dh) / 2;

  ctx.drawImage(img, dx, dy, dw, dh);
}

/* ─────────────────────────────────────────────────────────
   FRAME PRELOADER (two-phase)
   Phase 1: load first FIRST_BATCH frames → show page
   Phase 2: load remaining frames in background
   ───────────────────────────────────────────────────────── */
function loadFrame(i, onDone) {
  const img = new Image();

  img.onload = () => {
    frames[i]   = img;
    loadedCount++;

    // Sample bg color from first frame and every 20th
    if (i === 0 || i % 20 === 0) {
      bgColor = sampleBgColor(img);
    }

    const pct = Math.round((loadedCount / FRAME_COUNT) * 100);
    loaderBar.style.width     = pct + '%';
    loaderPct.textContent     = pct + '%';

    if (onDone) onDone();
  };

  img.onerror = () => {
    loadedCount++;
    if (onDone) onDone();
  };

  img.src = `frames/frame_${String(i + 1).padStart(4, '0')}.webp`;
}

function preloadFrames() {
  const batchSize = Math.min(FIRST_BATCH, FRAME_COUNT);
  let phase1Done  = 0;

  for (let i = 0; i < batchSize; i++) {
    loadFrame(i, () => {
      phase1Done++;

      // After first batch: init page
      if (phase1Done === batchSize && !pageInited) {
        pageInited = true;
        initPage();

        // Phase 2: background load
        for (let j = batchSize; j < FRAME_COUNT; j++) {
          loadFrame(j, () => {
            if (loadedCount >= FRAME_COUNT) {
              hideLoader();
            }
          });
        }
      }
    });
  }
}

function hideLoader() {
  gsap.to('#loader', {
    opacity: 0,
    duration: 0.6,
    ease: 'power2.out',
    onComplete: () => { loader.style.display = 'none'; }
  });
}

/* ─────────────────────────────────────────────────────────
   LENIS SMOOTH SCROLL
   ───────────────────────────────────────────────────────── */
function initLenis() {
  const lenis = new Lenis({
    duration:    1.2,
    easing:      (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

/* ─────────────────────────────────────────────────────────
   HERO ANIMATION
   Word-split stagger on load
   ───────────────────────────────────────────────────────── */
function initHeroAnimation() {
  const eyebrow  = heroSection.querySelector('.hero-eyebrow');
  const words    = heroSection.querySelectorAll('.word');
  const tagline  = heroSection.querySelector('.hero-tagline');
  const cta      = heroSection.querySelector('.btn-primary');
  const scrollInd = document.querySelector('.scroll-indicator');

  const tl = gsap.timeline({ delay: 0.15 });

  if (eyebrow) {
    tl.from(eyebrow, {
      y: 10, opacity: 0,
      duration: 0.5, ease: 'power3.out'
    });
  }

  tl.from(words, {
    y: 70, opacity: 0,
    stagger: 0.08,
    duration: 0.9, ease: 'power3.out'
  }, eyebrow ? '-=0.3' : '0')
  .from(tagline, {
    y: 24, opacity: 0,
    duration: 0.65, ease: 'power3.out'
  }, '-=0.4')
  .from(cta, {
    y: 16, opacity: 0,
    duration: 0.5, ease: 'power3.out'
  }, '-=0.3')
  .from(scrollInd, {
    y: 16, opacity: 0,
    duration: 0.5, ease: 'power3.out'
  }, '-=0.25');
}

/* ─────────────────────────────────────────────────────────
   HERO FADE
   Hero content fades as user scrolls — mic visible behind
   ───────────────────────────────────────────────────────── */
function initHeroFade() {
  ScrollTrigger.create({
    trigger:  heroSection,
    start:    'top top',
    end:      'bottom top',
    scrub:    true,
    onUpdate: (self) => {
      heroSection.style.opacity = Math.max(0, 1 - self.progress * 1.8);
    }
  });
}


/* ─────────────────────────────────────────────────────────
   SECTION POSITIONING
   Each section sits at the midpoint of its enter/leave range
   within the scroll container, centered vertically via translateY(-50%)
   ───────────────────────────────────────────────────────── */
function positionSections() {
  const containerH = scrollCont.offsetHeight;

  document.querySelectorAll('.scroll-section').forEach(section => {
    const enter = parseFloat(section.dataset.enter) / 100;
    const leave = parseFloat(section.dataset.leave) / 100;
    const mid   = (enter + leave) / 2;
    section.style.top = (mid * containerH) + 'px';
  });
}

/* ─────────────────────────────────────────────────────────
   MAIN SCROLL TRIGGER
   Drives: frame playback + section visibility + counters
   ───────────────────────────────────────────────────────── */
function initMainScroll() {

  /* ── Collect section data ── */
  const sectionData = [];

  document.querySelectorAll('.scroll-section').forEach(section => {
    const enter   = parseFloat(section.dataset.enter) / 100;
    const leave   = parseFloat(section.dataset.leave) / 100;
    const type    = section.dataset.animation;
    const persist = section.dataset.persist === 'true';

    // Targets: label + heading + subline + main content items
    const label    = section.querySelector('.section-label');
    const heading  = section.querySelector('.section-heading');
    const subline  = section.querySelector('.section-subline');
    const items    = [...section.querySelectorAll(
      '.stat-row, .notif-card, .feature-item, .reach-row'
    )];
    const summary  = section.querySelector('.cards-summary');

    const labelAndHead = [label, heading, subline].filter(Boolean);

    // Build entrance timeline
    const tl = gsap.timeline({ paused: true });

    // Label + heading always fade-up first
    tl.from(labelAndHead, {
      y: 18, opacity: 0,
      stagger: 0.04, duration: 0.4,
      ease: 'power3.out'
    });

    // Main content items — type-specific animation
    switch (type) {
      case 'stagger-up':
        tl.from(items, {
          y: 35, opacity: 0,
          stagger: 0.07, duration: 0.5,
          ease: 'power3.out'
        }, '-=0.2');
        break;

      case 'clip-reveal': {
        const leftCards  = [...section.querySelectorAll('.slide-col-left  .notif-card, .slide-col-left  .reach-row')];
        const rightCards = [...section.querySelectorAll('.slide-col-right .notif-card, .slide-col-right .reach-row')];
        if (leftCards.length || rightCards.length) {
          if (leftCards.length) {
            tl.from(leftCards, { x: -50, y: 20, opacity: 0, stagger: 0.12, duration: 0.75, ease: 'expo.out' }, '-=0.15');
          }
          if (rightCards.length) {
            tl.from(rightCards, { x: 50, y: 20, opacity: 0, stagger: 0.12, duration: 0.75, ease: 'expo.out' }, leftCards.length ? '<' : '-=0.15');
          }
        } else if (items.length) {
          tl.from(items, { y: 60, opacity: 0, stagger: 0.12, duration: 0.75, ease: 'expo.out' }, '-=0.15');
        }
        if (summary) {
          tl.from(summary, { y: 12, opacity: 0, duration: 0.3, ease: 'power3.out' }, '-=0.05');
        }
        break;
      }

      case 'slide-left': {
        const leftFeats  = [...section.querySelectorAll('.slide-col-left  .feature-item')];
        const rightFeats = [...section.querySelectorAll('.slide-col-right .feature-item')];
        if (leftFeats.length || rightFeats.length) {
          if (leftFeats.length) {
            tl.from(leftFeats, { x: -50, opacity: 0, stagger: 0.09, duration: 0.7, ease: 'expo.out' }, '-=0.15');
          }
          if (rightFeats.length) {
            tl.from(rightFeats, { x: 50, opacity: 0, stagger: 0.09, duration: 0.7, ease: 'expo.out' }, leftFeats.length ? '<' : '-=0.15');
          }
        } else {
          tl.from(items, { x: -50, opacity: 0, stagger: 0.09, duration: 0.7, ease: 'expo.out' }, '-=0.15');
        }
        break;
      }
    }

    // Set initial hidden state
    gsap.set(section, { opacity: 0 });

    sectionData.push({
      section, enter, leave, type, persist, tl,
      shown: false
    });
  });

  /* ── Counter setup ── */
  const counterEls = document.querySelectorAll('.stat-number');
  const statsEnter = 0.22;
  const statsLeave = 0.68;
  let countersStarted = false;

  /* ── Main onUpdate handler ── */
  function onScrollUpdate(p) {

    /* Section visibility */
    sectionData.forEach((sd) => {
      const active = p >= sd.enter && (sd.persist || p <= sd.leave);

      if (active && !sd.shown) {
        sd.shown = true;
        gsap.set(sd.section, { opacity: 1 });
        sd.tl.restart();
      } else if (!active && !sd.persist && sd.shown) {
        sd.shown = false;
        gsap.to(sd.section, { opacity: 0, duration: 0.35, ease: 'power2.out' });
        // Reset timeline to start so children are back in their hidden "from" state
        sd.tl.seek(0).pause();
      }
    });

    /* Counter animations — trigger once when stats section enters */
    if (!countersStarted && p >= statsEnter && p <= statsLeave) {
      countersStarted = true;

      counterEls.forEach(el => {
        const target   = parseFloat(el.dataset.value);
        const decimals = parseInt(el.dataset.decimals || '0');
        el.textContent = '0';

        gsap.fromTo(el,
          { textContent: 0 },
          {
            textContent: target,
            duration:    1.3,
            ease:        'power1.out',
            snap:        { textContent: decimals === 0 ? 1 : 0.01 }
          }
        );
      });
    }

    // Reset counter flag when stats section leaves (so they re-animate on re-entry)
    if (countersStarted && (p < statsEnter - 0.02 || p > statsLeave + 0.02)) {
      countersStarted = false;
      counterEls.forEach(el => {
        gsap.killTweensOf(el);
        el.textContent = '0';
      });
    }
  }

  /* ── Attach ScrollTrigger to scroll container ── */
  ScrollTrigger.create({
    trigger:  scrollCont,
    start:    'top top',
    end:      'bottom bottom',
    onUpdate: (self) => onScrollUpdate(self.progress)
  });

  /* ── Frame playback trigger — starts at scroll=250px, ends at bottom of slide 4 ── */
  ScrollTrigger.create({
    trigger:    heroSection,
    start:      'top+=250 top',
    endTrigger: scrollCont,
    end:        'bottom bottom',
    onUpdate: (self) => {
      const accel = Math.min(self.progress * FRAME_SPEED, 1);
      const idx   = Math.min(Math.floor(accel * FRAME_COUNT), FRAME_COUNT - 1);
      if (idx !== currentFrame) {
        currentFrame = idx;
        requestAnimationFrame(() => drawFrame(currentFrame));
      }
    }
  });
}

/* ─────────────────────────────────────────────────────────
   RESIZE HANDLER (debounced)
   ───────────────────────────────────────────────────────── */
let resizeTimer = null;

function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    setupCanvas();
    positionSections();
    drawFrame(currentFrame);
    ScrollTrigger.refresh();
  }, 120);
}

/* ─────────────────────────────────────────────────────────
   INIT PAGE
   Called after first batch of frames loaded
   ───────────────────────────────────────────────────────── */
function initPage() {
  gsap.registerPlugin(ScrollTrigger);
  setupCanvas();

  // Canvas always visible — no circle-wipe
  canvasWrap.style.clipPath = 'none';

  // Draw first frame immediately
  drawFrame(0);

  // Lenis
  lenis = initLenis();

  // Hero entrance
  initHeroAnimation();

  // Hero fade on scroll
  initHeroFade();

  // Nav smooth scroll
  initNavScroll();

  // Section positions
  positionSections();

  // Main scroll (frames + sections + counters)
  initMainScroll();

  // Dark sections (slides 5 & 6)
  initDarkSections();
  initCalculator();
  initDemoAudio();
  initContactForm();

  // Resize
  window.addEventListener('resize', onResize);

  ScrollTrigger.refresh();
}

/* ─────────────────────────────────────────────────────────
   STEP LINE ANIMATION HELPERS (Slide 5)
   ───────────────────────────────────────────────────────── */
function runLineAnim() {
  const lines = document.querySelectorAll('#slide5 .step-line');
  const nodes = document.querySelectorAll('#slide5 .step-node');
  gsap.set(lines, { scaleX: 0, transformOrigin: 'left center' });
  gsap.set(nodes, { opacity: 0, y: 24 });
  const tl = gsap.timeline();
  tl.to(nodes, { opacity: 1, y: 0, stagger: 0.15, duration: 0.5, ease: 'power3.out' })
    .to(lines[0], { scaleX: 1, duration: 0.55, ease: 'power2.inOut' }, '-=0.1')
    .to(lines[1], { scaleX: 1, duration: 0.55, ease: 'power2.inOut' }, '-=0.15');
}

function resetLineAnim() {
  const lines = document.querySelectorAll('#slide5 .step-line');
  const nodes = document.querySelectorAll('#slide5 .step-node');
  gsap.set(lines, { scaleX: 0, transformOrigin: 'left center' });
  gsap.set(nodes, { opacity: 0, y: 24 });
}

/* ─────────────────────────────────────────────────────────
   NAV SCROLL
   ───────────────────────────────────────────────────────── */
function initNavScroll() {
  document.querySelectorAll('.nav-links a[data-scroll]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(link.dataset.scroll);
      if (target) lenis.scrollTo(target, { duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 3) });
    });
  });
}

/* ─────────────────────────────────────────────────────────
   DARK SECTIONS — Slides 5 & 6 entrance animations
   ───────────────────────────────────────────────────────── */
function initDarkSections() {
  // Fade out canvas as slide 5 scrolls in (smooth transition from white → navy)
  ScrollTrigger.create({
    trigger: '#slide5',
    start:   'top bottom',
    end:     'top top',
    scrub:   true,
    onUpdate: (self) => {
      canvasWrap.style.opacity = 1 - self.progress;
    }
  });

  gsap.from('#slide5 .dark-eyebrow, #slide5 .dark-heading', {
    opacity: 0, y: 24, stagger: 0.08, duration: 0.6, ease: 'power3.out',
    scrollTrigger: { trigger: '#slide5', start: 'top 80%' }
  });
  ScrollTrigger.create({
    trigger: '#slide5',
    start: 'top 70%',
    end: 'bottom top',
    onEnter:     runLineAnim,
    onEnterBack: runLineAnim,
    onLeave:     resetLineAnim,
    onLeaveBack: resetLineAnim,
  });
  gsap.from('#slide5 .step-label', {
    opacity: 0, y: 20, stagger: 0.1, duration: 0.5, ease: 'power3.out',
    scrollTrigger: { trigger: '#slide5', start: 'top 60%' }
  });
  gsap.from('.calc-col', {
    opacity: 0, x: -30, duration: 0.7, ease: 'power3.out',
    scrollTrigger: { trigger: '#slide6', start: 'top 75%' }
  });
  gsap.from('.invest-col', {
    opacity: 0, x: 30, duration: 0.7, ease: 'power3.out',
    scrollTrigger: { trigger: '#slide6', start: 'top 75%' }
  });

  // Slide 7 — CTA card + eyebrow
  gsap.from('#slide7 .cta-card', {
    opacity: 0, y: 40, duration: 0.8, ease: 'power3.out',
    scrollTrigger: { trigger: '#slide7', start: 'top 75%' }
  });
  gsap.from('#slide7 .cta-eyebrow, #slide7 .cta-footer-caption', {
    opacity: 0, y: 20, stagger: 0.1, duration: 0.6, ease: 'power3.out',
    scrollTrigger: { trigger: '#slide7', start: 'top 80%' }
  });
}

/* ─────────────────────────────────────────────────────────
   COST CALCULATOR
   ───────────────────────────────────────────────────────── */
function initCalculator() {
  const sliderMissed = document.getElementById('slider-missed');
  const sliderRate   = document.getElementById('slider-rate');
  const inputValue   = document.getElementById('input-value');
  const valMissed    = document.getElementById('val-missed');
  const valRate      = document.getElementById('val-rate');
  const resMonthly   = document.getElementById('result-monthly');
  const resYearly    = document.getElementById('result-yearly');

  function fmt(n) {
    return '€' + Math.round(n).toLocaleString('de-DE');
  }

  function update() {
    const missed  = parseInt(sliderMissed.value, 10);
    const value   = parseFloat(inputValue.value) || 0;
    const rate    = parseInt(sliderRate.value, 10);
    valMissed.textContent = missed;
    valRate.textContent   = rate + ' %';
    const monthly = missed * value * (rate / 100);
    const yearly  = monthly * 12;
    resMonthly.textContent = fmt(monthly);
    resYearly.textContent  = 'Jährlicher Verlust: ' + fmt(yearly);
  }

  sliderMissed.addEventListener('input', update);
  sliderRate.addEventListener('input', update);
  inputValue.addEventListener('input', update);
  update();
}

/* ─────────────────────────────────────────────────────────
   DEMO AUDIO BUTTON
   ───────────────────────────────────────────────────────── */
function initDemoAudio() {
  const btn   = document.getElementById('btn-demo');
  const audio = document.getElementById('demo-audio');
  const label = btn.querySelector('.demo-btn-label');

  btn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play();
      label.textContent = '⏸';
      btn.classList.add('playing');
    } else {
      audio.pause();
      label.textContent = '▶ Demo anhören';
      btn.classList.remove('playing');
    }
  });

  audio.addEventListener('ended', () => {
    label.textContent = '▶ Demo anhören';
    btn.classList.remove('playing');
  });
}

/* ─────────────────────────────────────────────────────────
   CONTACT FORM — Formspree
   ───────────────────────────────────────────────────────── */
function initContactForm() {
  const form   = document.querySelector('.cta-form');
  const status = document.getElementById('form-status');
  if (!form || !status) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('.cta-submit');
    btn.textContent = 'Wird gesendet…';
    btn.disabled = true;

    try {
      const res = await fetch('https://formspree.io/f/xkoqzwnd', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form),
      });

      if (res.ok) {
        form.reset();
        status.textContent = '✓ Nachricht gesendet — wir melden uns innerhalb von 24 Stunden.';
        status.className = 'form-status form-status--ok';
      } else {
        throw new Error('server');
      }
    } catch {
      status.textContent = '✗ Fehler beim Senden. Bitte versuchen Sie es erneut.';
      status.className = 'form-status form-status--err';
    }

    btn.textContent = 'Kontakt aufnehmen →';
    btn.disabled = false;
  });
}

/* ─────────────────────────────────────────────────────────
   START
   ───────────────────────────────────────────────────────── */
preloadFrames();
