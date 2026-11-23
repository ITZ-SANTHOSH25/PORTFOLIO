/* ============================================================
   MAIN — interaction, motion, navigation, form
   ============================================================ */
(function () {
  'use strict';

  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined';
  const hasST = hasGSAP && typeof window.ScrollTrigger !== 'undefined';

  if (hasST) gsap.registerPlugin(ScrollTrigger);

  function enableAudio() { /* Audio controls intentionally removed. */ }

  /* ============================================================
     CUSTOM CURSOR
     ============================================================ */
  const cursor = $('#cursor');
  const ring = $('#cursor-ring');
  const dot = $('#cursor-dot');
  const glow = $('#cursor-glow');

  if (finePointer && cursor && !reduced) {
    document.body.classList.add('has-custom-cursor');
    const state = { mx: window.innerWidth / 2, my: window.innerHeight / 2, rx: window.innerWidth / 2, ry: window.innerHeight / 2, gx: window.innerWidth / 2, gy: window.innerHeight / 2 };
    let visible = false;

    window.addEventListener('pointermove', function (e) {
      state.mx = e.clientX;
      state.my = e.clientY;
      if (!visible) {
        visible = true;
        cursor.classList.add('is-visible');
      }
      if (dot) dot.style.transform = 'translate(' + state.mx + 'px,' + state.my + 'px) translate(-50%,-50%)';
    }, { passive: true });

    document.addEventListener('pointerleave', function () {
      visible = false;
      cursor.classList.remove('is-visible');
    });

    function cursorLoop() {
      state.rx += (state.mx - state.rx) * 0.18;
      state.ry += (state.my - state.ry) * 0.18;
      state.gx += (state.mx - state.gx) * 0.075;
      state.gy += (state.my - state.gy) * 0.075;
      if (ring) ring.style.transform = 'translate(' + state.rx + 'px,' + state.ry + 'px) translate(-50%,-50%)';
      if (glow) glow.style.transform = 'translate(' + state.gx + 'px,' + state.gy + 'px) translate(-50%,-50%)';
      requestAnimationFrame(cursorLoop);
    }
    requestAnimationFrame(cursorLoop);

    document.addEventListener('pointerover', function (e) {
      const t = e.target;
      if (t.closest && t.closest('a, button, input, textarea, [data-cursor], .tilt, .film__poster')) {
        cursor.classList.add('is-hover');
      }
    });
    document.addEventListener('pointerout', function (e) {
      const t = e.target;
      if (t.closest && t.closest('a, button, input, textarea, [data-cursor], .tilt, .film__poster')) {
        cursor.classList.remove('is-hover');
      }
    });
    document.addEventListener('pointerdown', function () { cursor.classList.add('is-down'); });
    document.addEventListener('pointerup', function () { cursor.classList.remove('is-down'); });
  }

  /* ============================================================
     NAV / MOBILE MENU
     ============================================================ */
  const nav = $('#nav');
  const burger = $('#burger');
  const mobileMenu = $('#mobile-menu');
  const progressBar = $('#progress-bar');

  function onScroll() {
    const y = window.scrollY;
    if (nav) nav.classList.toggle('is-scrolled', y > 40);
    if (progressBar) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progressBar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function closeMenu() {
    if (!mobileMenu || !burger) return;
    mobileMenu.classList.remove('is-open');
    mobileMenu.setAttribute('aria-hidden', 'true');
    burger.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('menu-open');
  }

  if (burger && mobileMenu) {
    burger.addEventListener('click', function () {
      const open = !mobileMenu.classList.contains('is-open');
      mobileMenu.classList.toggle('is-open', open);
      mobileMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('menu-open', open);
      if (open) {
        $$('.mobile-menu__link').forEach(function (link, i) {
          link.style.transitionDelay = (0.06 * i + 0.08) + 's';
        });
      }
    });
  }

  $$('.mobile-menu__link').forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  // smooth anchor navigation
  $$('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      const top = target.getBoundingClientRect().top + window.scrollY - (window.innerWidth > 980 ? 60 : 50);
      window.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
    });
  });

  // active nav link
  const sections = $$('main section[id]');
  const navLinks = $$('.nav__link');
  if ('IntersectionObserver' in window && sections.length) {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        navLinks.forEach(function (l) {
          l.classList.toggle('is-active', l.getAttribute('href') === '#' + id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* ============================================================
     EMBERS (DOM layer)
     ============================================================ */
  const embers = $('#embers');
  if (embers && !reduced) {
    const count = window.innerWidth < 720 ? 16 : 30;
    for (let i = 0; i < count; i++) {
      const e = document.createElement('span');
      e.className = 'ember';
      const size = 1 + Math.random() * 2.4;
      e.style.left = (Math.random() * 100) + '%';
      e.style.width = size + 'px';
      e.style.height = size + 'px';
      e.style.animationDuration = (12 + Math.random() * 20) + 's';
      e.style.animationDelay = (-Math.random() * 26) + 's';
      e.style.setProperty('--drift', (Math.random() * 160 - 80) + 'px');
      e.style.opacity = 0.3 + Math.random() * 0.6;
      embers.appendChild(e);
    }
  }

  /* ============================================================
     HERO GLITCH
     ============================================================ */
  const heroName = $('.hero__name');
  if (heroName && !reduced) {
    setInterval(function () {
      if (document.hidden) return;
      heroName.classList.add('is-glitching');
      window.setTimeout(function () { heroName.classList.remove('is-glitching'); }, 460);
    }, 6200);
  }

  /* ============================================================
     3D TILT
     ============================================================ */
  function attachTilt(el, max) {
    if (!finePointer || reduced || !hasGSAP) return;
    const strength = max || 7;
    let rect = null;
    let raf = null;
    const rotX = gsap.quickTo(el, 'rotationX', { duration: 0.55, ease: 'power3.out' });
    const rotY = gsap.quickTo(el, 'rotationY', { duration: 0.55, ease: 'power3.out' });
    const tx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
    const ty = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });

    gsap.set(el, { transformPerspective: 1100, transformOrigin: '50% 50%' });

    el.addEventListener('pointerenter', function () {
      rect = el.getBoundingClientRect();
      el.classList.add('is-tilting');
    });

    el.addEventListener('pointermove', function (e) {
      if (!rect) rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        rotY(px * strength * 2);
        rotX(-py * strength * 2);
        tx(px * 10);
        ty(py * 8);
      });
    });

    el.addEventListener('pointerleave', function () {
      rect = null;
      el.classList.remove('is-tilting');
      rotX(0); rotY(0); tx(0); ty(0);
    });
  }

  $$('[data-tilt]').forEach(function (el) {
    attachTilt(el, el.classList.contains('skill') ? 9 : 6);
  });

  /* ============================================================
     SCROLL REVEALS / PARALLAX
     ============================================================ */
  function initMotion() {
    if (!hasGSAP) {
      $$('.reveal').forEach(function (el) { el.style.opacity = 1; el.style.transform = 'none'; });
      return;
    }

    if (hasST) {
      // reveals
      ScrollTrigger.batch('.reveal', {
        start: 'top 90%',
        once: true,
        onEnter: function (batch) {
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            duration: reduced ? 0.01 : 1.05,
            stagger: reduced ? 0 : 0.08,
            ease: 'power3.out',
            overwrite: true
          });
        }
      });

      // Safety net: ScrollTrigger.batch and IntersectionObserver both depend on
      // the rendering pipeline. On a starved GPU (or after an instant jump to a
      // deep section) they can miss elements and leave content at opacity 0.
      // This timer/scroll check runs off the main thread timer queue instead and
      // guarantees that anything inside the viewport becomes visible.
      function revealInView() {
        const vh = window.innerHeight || document.documentElement.clientHeight;
        $$('.reveal').forEach(function (el) {
          if (el.dataset.revealed === '1') return;
          const r = el.getBoundingClientRect();
          if (r.top < vh * 0.94 && r.bottom > 0) {
            el.dataset.revealed = '1';
            if (parseFloat(window.getComputedStyle(el).opacity) < 0.05) {
              el.style.opacity = '1';
              el.style.transform = 'none';
            }
          }
        });
      }
      let revealTick = 0;
      window.addEventListener('scroll', function () {
        if (revealTick) return;
        revealTick = window.setTimeout(function () { revealTick = 0; revealInView(); }, 160);
      }, { passive: true });
      window.setTimeout(revealInView, 700);
      window.setTimeout(revealInView, 2200);

      // background parallax
      gsap.to('#world-bg', {
        yPercent: 7,
        scale: 1.08,
        ease: 'none',
        scrollTrigger: { trigger: '#main', start: 'top top', end: 'bottom bottom', scrub: 1.1 }
      });

      // section heads drift
      $$('.section__head').forEach(function (head) {
        gsap.fromTo(head, { y: 26 }, {
          y: -18,
          ease: 'none',
          scrollTrigger: { trigger: head, start: 'top bottom', end: 'bottom top', scrub: 1.2 }
        });
      });

      // project cards subtle depth on scroll
      $$('.project').forEach(function (card) {
        gsap.fromTo(card, { scale: 0.985 }, {
          scale: 1,
          ease: 'none',
          scrollTrigger: { trigger: card, start: 'top 92%', end: 'top 45%', scrub: 1 }
        });
      });

      // hero content parallax out
      gsap.to('.hero__copy', {
        y: -60,
        opacity: 0.25,
        ease: 'none',
        scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: 1 }
      });
      gsap.to('.hero__visual', {
        y: 70,
        ease: 'none',
        scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: 1 }
      });

      ScrollTrigger.refresh();
    } else {
      $$('.reveal').forEach(function (el) {
        gsap.to(el, { opacity: 1, y: 0, duration: 1, ease: 'power3.out' });
      });
    }

    // counters
    $$('[data-count]').forEach(function (el) {
      const target = Number(el.getAttribute('data-count'));
      if (!hasST) { el.textContent = target; return; }
      ScrollTrigger.create({
        trigger: el,
        start: 'top 92%',
        once: true,
        onEnter: function () {
          const obj = { v: 0 };
          gsap.to(obj, {
            v: target,
            duration: reduced ? 0.01 : 1.6,
            ease: 'power2.out',
            onUpdate: function () { el.textContent = Math.round(obj.v); }
          });
        }
      });
    });
  }

  /* ============================================================
     FILM MODAL
     ============================================================ */
  const modal = $('#trailer-modal');
  const modalVideo = $('#modal-video');
  const YT_ID = 'ATxx1t8d6Aw';
  let lastFocus = null;

  function openModal() {
    if (!modal || !modalVideo) return;
    lastFocus = document.activeElement;
    modalVideo.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + YT_ID +
      '?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="Rewind — short film by Santhosh" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const closeBtn = $('.modal__close', modal);
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (!modal || !modalVideo) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    window.setTimeout(function () { modalVideo.innerHTML = ''; }, 350);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  $$('#play-trailer, #play-trailer-2, #poster').forEach(function (el) {
    el.addEventListener('click', openModal);
  });
  $$('[data-close-modal]').forEach(function (el) {
    el.addEventListener('click', closeModal);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeModal();
      closeMenu();
    }
  });

  /* ============================================================
     CONTACT FORM
     ============================================================ */
  const form = $('#contact-form');
  const success = $('#contact-success');
  const successText = $('#contact-success-text');
  const formStatus = $('#form-status');
  const resetBtn = $('#reset-form');
  const toast = $('#toast');
  let toastTimer = 0;

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.classList.remove('is-visible'); }, 3400);
  }

  function setError(name, msg) {
    const field = $('.field input[name="' + name + '"], .field textarea[name="' + name + '"]');
    if (!field) return;
    const wrap = field.closest('.field');
    const err = $('[data-error-for="' + name + '"]');
    wrap.classList.toggle('has-error', !!msg);
    field.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) {
      err.textContent = msg || '';
      if (msg) {
        if (!err.id) err.id = 'error-' + name;
        field.setAttribute('aria-describedby', err.id);
      } else {
        field.removeAttribute('aria-describedby');
      }
    }
  }

  function validate(data) {
    let ok = true;
    if (!data.name || data.name.trim().length < 2) {
      setError('name', 'Please enter your name.');
      ok = false;
    } else setError('name', '');

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!data.email || !emailRe.test(data.email.trim())) {
      setError('email', 'Please enter a valid email address.');
      ok = false;
    } else setError('email', '');

    if (!data.message || data.message.trim().length < 10) {
      setError('message', 'Please write at least 10 characters.');
      ok = false;
    } else setError('message', '');
    return ok;
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const fd = new FormData(form);
      const data = {
        name: String(fd.get('name') || ''),
        email: String(fd.get('email') || ''),
        message: String(fd.get('message') || '')
      };

      if (!validate(data)) {
        showToast('Please complete the highlighted fields.');
        const firstError = $('.field.has-error input, .field.has-error textarea');
        if (firstError) firstError.focus();
        return;
      }

      const entry = {
        name: data.name.trim(),
        email: data.email.trim(),
        message: data.message.trim(),
        date: new Date().toISOString()
      };

      try {
        const key = 'santhosh_portfolio_messages';
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.push(entry);
        localStorage.setItem(key, JSON.stringify(existing));
      } catch (err) {
        // storage may be unavailable — the confirmation still stands
      }

      if (formStatus) formStatus.textContent = 'TRANSMITTED';
      if (successText) {
        successText.textContent = 'Thank you, ' + entry.name.split(' ')[0] +
          '. Your message has been sealed and saved in this browser. Connect an endpoint to deliver it to the inbox.';
      }
      if (success) success.hidden = false;
      showToast('Message captured — thank you, ' + entry.name.split(' ')[0] + '.');
    });

    $$('input, textarea', form).forEach(function (input) {
      input.addEventListener('input', function () {
        if (input.closest('.field').classList.contains('has-error')) {
          setError(input.name, '');
        }
      });
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      if (success) success.hidden = true;
      if (formStatus) formStatus.textContent = 'STANDBY';
      if (form) {
        form.reset();
        $$('.field', form).forEach(function (f) { f.classList.remove('has-error'); });
        $$('.field__error', form).forEach(function (e) { e.textContent = ''; });
      }
      const nameInput = $('#name');
      if (nameInput) nameInput.focus();
    });
  }

  /* ============================================================
     PLACEHOLDER SOCIAL LINKS
     ============================================================ */
  $$('[data-placeholder]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const which = link.getAttribute('data-placeholder');
      const label = which === 'github' ? 'GitHub' : which === 'linkedin' ? 'LinkedIn' : 'email';
      showToast('Placeholder only — add your ' + label + ' in index.html. No invented profiles.');
    });
  });

  /* ============================================================
     BOOT SEQUENCE
     ============================================================ */
  function startExperience() {
    initMotion();

    if (window.Portfolio3D) {
      // give the intro priority for GPU/CPU, then bring the 3D world online
      window.setTimeout(function () { window.Portfolio3D.init(); }, 120);
    }

    if (hasST) {
      window.setTimeout(function () { ScrollTrigger.refresh(); }, 500);
    }
  }

  let started = false;
  function onIntroComplete() {
    if (started) return;
    started = true;
    startExperience();
  }

  document.addEventListener('intro:complete', onIntroComplete);

  // safety net: if the intro never signals (e.g. script error), start anyway
  window.setTimeout(function () {
    if (!started && (window.__introDone || !document.getElementById('intro'))) {
      onIntroComplete();
    }
  }, 16000);

  // year
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // refresh triggers after images settle
  window.addEventListener('load', function () {
    if (hasST) window.setTimeout(function () { ScrollTrigger.refresh(); }, 300);
  });

  // expose a couple of helpers for debugging / future integration
  window.Portfolio = {
    enableAudio: enableAudio,
    toast: showToast,
    openTrailer: openModal
  };
})();
