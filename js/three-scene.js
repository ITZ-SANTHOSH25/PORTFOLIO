/* ============================================================
   THREE.JS SCENES
   1. World scene  : drifting red embers + procedural volumetric fog
   2. Hero scene   : a dark "mirror core" orbited by glass shards,
                     lit in blood red, reactive to pointer + scroll
   Both scenes degrade gracefully and pause when off-screen.
   ============================================================ */
(function () {
  'use strict';

  const hasThree = typeof window.THREE !== 'undefined';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 760px)').matches;

  /* ---------- shared helpers ---------- */
  function radialTexture(size, inner, outer) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, inner);
    grd.addColorStop(0.35, outer);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', function (e) {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  let scrollNorm = 0;
  window.addEventListener('scroll', function () {
    const max = document.body.scrollHeight - window.innerHeight;
    scrollNorm = max > 0 ? window.scrollY / max : 0;
  }, { passive: true });

  /* ============================================================
     1. WORLD — embers + fog
     ============================================================ */
  function initWorld() {
    if (!hasThree) return;
    const canvas = document.getElementById('world-canvas');
    if (!canvas) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
    } catch (e) {
      canvas.style.display = 'none';
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 10);

    /* --- embers --- */
    const COUNT = isMobile ? 260 : 620;
    const positions = new Float32Array(COUNT * 3);
    const speeds = new Float32Array(COUNT);
    const sizes = new Float32Array(COUNT);
    const phases = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 26;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 9 - 1;
      speeds[i] = 0.08 + Math.random() * 0.32;
      sizes[i] = 0.03 + Math.random() * 0.11;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const sprite = radialTexture(64, 'rgba(255,235,230,1)', 'rgba(255,43,69,0.55)');
    const mat = new THREE.PointsMaterial({
      size: 0.16,
      map: sprite,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xff4a5e,
      sizeAttenuation: true
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    /* --- second, larger soft ember layer for depth --- */
    const bigMat = mat.clone();
    bigMat.size = 0.42;
    bigMat.opacity = 0.25;
    bigMat.color = new THREE.Color(0xff1f3a);
    const bigPoints = new THREE.Points(geo, bigMat);
    bigPoints.position.z = -2.5;
    scene.add(bigPoints);

    /* --- procedural fog planes --- */
    const fogVert = [
      'varying vec2 vUv;',
      'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
    ].join('\n');

    const fogFrag = [
      'precision mediump float;',
      'uniform float uTime;',
      'uniform float uOpacity;',
      'uniform vec3 uColorA;',
      'uniform vec3 uColorB;',
      'varying vec2 vUv;',
      'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }',
      'float noise(vec2 p){',
      '  vec2 i = floor(p); vec2 f = fract(p);',
      '  vec2 u = f*f*(3.0-2.0*f);',
      '  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x),',
      '             mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);',
      '}',
      'float fbm(vec2 p){',
      '  float v = 0.0; float a = 0.5;',
      '  for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.02; a *= 0.5; }',
      '  return v;',
      '}',
      'void main(){',
      '  vec2 uv = vUv * 2.6;',
      '  uv.x += uTime * 0.018;',
      '  uv.y += uTime * 0.006;',
      '  float n = fbm(uv + fbm(uv * 1.6 + uTime * 0.02));',
      '  float a = smoothstep(0.34, 0.92, n) * uOpacity;',
      '  vec3 col = mix(uColorA, uColorB, n);',
      '  gl_FragColor = vec4(col, a);',
      '}'
    ].join('\n');

    const fogGroup = new THREE.Group();
    const fogLayers = [];

    for (let i = 0; i < 3; i++) {
      const w = 40 + i * 10;
      const h = 24 + i * 6;
      const material = new THREE.ShaderMaterial({
        vertexShader: fogVert,
        fragmentShader: fogFrag,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0.16 - i * 0.025 },
          uColorA: { value: new THREE.Color(0x2a0409) },
          uColorB: { value: new THREE.Color(0x8c1020) }
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
      plane.position.set((i - 1) * 2.5, (i % 2 ? 1.2 : -1.4), -2 - i * 2.2);
      fogGroup.add(plane);
      fogLayers.push(plane);
    }
    scene.add(fogGroup);

    let running = true;
    let raf = 0;
    const clock = new THREE.Clock();

    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      renderer.setSize(w, h, false);
    }
    window.addEventListener('resize', resize);

    function frame() {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const t = clock.getElapsedTime();

      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;

      const pos = geo.attributes.position.array;
      for (let i = 0; i < COUNT; i++) {
        const iy = i * 3 + 1;
        pos[iy] += speeds[i] * 0.012;
        pos[i * 3] += Math.sin(t * 0.35 + phases[i]) * 0.0016;
        if (pos[iy] > 9) {
          pos[iy] = -9;
          pos[i * 3] = (Math.random() - 0.5) * 26;
        }
      }
      geo.attributes.position.needsUpdate = true;

      points.rotation.y = pointer.x * 0.06;
      points.rotation.x = pointer.y * 0.04;
      bigPoints.rotation.y = pointer.x * 0.03;

      fogLayers.forEach(function (plane, i) {
        plane.material.uniforms.uTime.value = t + i * 12;
        plane.position.x = (i - 1) * 2.5 + Math.sin(t * 0.05 + i) * 1.4 + pointer.x * (0.5 + i * 0.3);
        plane.position.y = (i % 2 ? 1.2 : -1.4) + Math.cos(t * 0.04 + i) * 0.5 - pointer.y * (0.3 + i * 0.2) - scrollNorm * (0.6 + i * 0.4);
      });

      camera.position.x = pointer.x * 0.55;
      camera.position.y = -pointer.y * 0.35 + scrollNorm * 0.8;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }

    resize();
    frame();

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        frame();
      }
    });
  }

  /* ============================================================
     2. HERO — mirror core + orbiting shards
     ============================================================ */
  function initHero() {
    if (!hasThree) return;
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      canvas.style.display = 'none';
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 6.2);

    const root = new THREE.Group();
    scene.add(root);

    /* --- core --- */
    const coreGeo = new THREE.IcosahedronGeometry(1.15, 5);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x160609,
      metalness: 0.95,
      roughness: 0.22,
      emissive: 0x5a0812,
      emissiveIntensity: 0.85,
      flatShading: true
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    root.add(core);

    // faceted wire shell
    const wireGeo = new THREE.IcosahedronGeometry(1.24, 1);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xff2b45,
      wireframe: true,
      transparent: true,
      opacity: 0.22
    });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    root.add(wire);

    // inner glow shell
    const glowGeo = new THREE.SphereGeometry(1.32, 32, 32);
    const glowMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xff2b45) } },
      vertexShader: [
        'varying vec3 vNormal; varying vec3 vView;',
        'void main(){',
        '  vNormal = normalize(normalMatrix * normal);',
        '  vec4 mv = modelViewMatrix * vec4(position,1.0);',
        '  vView = normalize(-mv.xyz);',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime; uniform vec3 uColor;',
        'varying vec3 vNormal; varying vec3 vView;',
        'void main(){',
        '  float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.6);',
        '  float pulse = 0.72 + 0.28 * sin(uTime * 1.6);',
        '  gl_FragColor = vec4(uColor, fres * 0.55 * pulse);',
        '}'
      ].join('\n'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    root.add(glow);

    /* --- orbiting glass shards --- */
    const shardGroup = new THREE.Group();
    root.add(shardGroup);
    const shards = [];
    const SHARD_COUNT = isMobile ? 11 : 18;

    for (let i = 0; i < SHARD_COUNT; i++) {
      const geoShard = new THREE.TetrahedronGeometry(0.16 + Math.random() * 0.22, 0);
      const matShard = new THREE.MeshStandardMaterial({
        color: 0x2b1218,
        metalness: 1,
        roughness: 0.14,
        emissive: 0x8c0f1d,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.92,
        flatShading: true
      });
      const mesh = new THREE.Mesh(geoShard, matShard);
      const radius = 1.75 + Math.random() * 0.95;
      const angle = (i / SHARD_COUNT) * Math.PI * 2 + Math.random() * 0.5;
      const height = (Math.random() - 0.5) * 1.9;
      mesh.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      mesh.userData = {
        radius: radius,
        angle: angle,
        height: height,
        speed: 0.12 + Math.random() * 0.22,
        spin: 0.3 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2
      };
      shardGroup.add(mesh);
      shards.push(mesh);
    }

    /* --- particles --- */
    const P_COUNT = isMobile ? 140 : 320;
    const pPos = new Float32Array(P_COUNT * 3);
    for (let i = 0; i < P_COUNT; i++) {
      const r = 1.6 + Math.random() * 2.4;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pPos[i * 3 + 1] = r * Math.cos(ph) * 0.8;
      pPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.055,
      color: 0xff3b52,
      transparent: true,
      opacity: 0.75,
      map: radialTexture(32, 'rgba(255,255,255,1)', 'rgba(255,43,69,0.6)'),
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const particles = new THREE.Points(pGeo, pMat);
    root.add(particles);

    /* --- glow sprite behind core --- */
    const spriteMat = new THREE.SpriteMaterial({
      map: radialTexture(256, 'rgba(255,80,95,0.85)', 'rgba(160,10,30,0.35)'),
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(5.4, 5.4, 1);
    sprite.position.z = -1.2;
    root.add(sprite);

    /* --- lights --- */
    const key = new THREE.PointLight(0xff2b45, 26, 12, 2);
    key.position.set(0.8, 1.2, 2.4);
    scene.add(key);

    const rim = new THREE.PointLight(0x3a6bff, 9, 14, 2);
    rim.position.set(-3, -1.5, -2);
    scene.add(rim);

    const fill = new THREE.PointLight(0xff6a3a, 8, 10, 2);
    fill.position.set(2.5, -2, 1.5);
    scene.add(fill);

    scene.add(new THREE.AmbientLight(0x2a0a10, 1.2));

    /* --- resize --- */
    function resize() {
      const w = canvas.clientWidth || 420;
      const h = canvas.clientHeight || 420;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    if (window.ResizeObserver) {
      new ResizeObserver(resize).observe(canvas);
    }
    window.addEventListener('resize', resize);

    /* --- animate --- */
    const clock = new THREE.Clock();
    let raf = 0;
    let running = true;
    let visible = true;

    function frame() {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const t = clock.getElapsedTime();

      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      const targetRotY = pointer.x * 0.55 + t * 0.12 + scrollNorm * 1.4;
      const targetRotX = pointer.y * 0.32 + Math.sin(t * 0.25) * 0.06;
      root.rotation.y += (targetRotY - root.rotation.y) * 0.06;
      root.rotation.x += (targetRotX - root.rotation.x) * 0.06;

      core.rotation.y = t * 0.18;
      core.rotation.x = Math.sin(t * 0.22) * 0.12;
      wire.rotation.y = -t * 0.22;
      wire.rotation.z = t * 0.08;

      glowMat.uniforms.uTime.value = t;
      glow.rotation.y = -t * 0.05;

      shards.forEach(function (mesh) {
        const d = mesh.userData;
        const a = d.angle + t * d.speed;
        mesh.position.x = Math.cos(a) * d.radius;
        mesh.position.z = Math.sin(a) * d.radius;
        mesh.position.y = d.height + Math.sin(t * 0.6 + d.phase) * 0.22;
        mesh.rotation.x += 0.0025 * d.spin;
        mesh.rotation.y += 0.0035 * d.spin;
        mesh.rotation.z += 0.0018 * d.spin;
      });

      particles.rotation.y = t * 0.06;
      particles.rotation.x = -t * 0.03;

      key.intensity = 22 + Math.sin(t * 1.5) * 6;
      sprite.material.opacity = 0.42 + Math.sin(t * 1.2) * 0.12;

      camera.position.x = pointer.x * 0.42;
      camera.position.y = -pointer.y * 0.32;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }

    resize();
    frame();

    // pause when hero is off-screen
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          visible = entry.isIntersecting;
          if (visible && !running) {
            running = true;
            frame();
          } else if (!visible && running) {
            running = false;
            cancelAnimationFrame(raf);
          }
        });
      }, { threshold: 0.01 }).observe(canvas);
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (visible) {
        running = true;
        frame();
      }
    });
  }

  window.Portfolio3D = {
    init: function () {
      if (reduced) {
        // still show the scenes, just far calmer (handled by CSS + no heavy motion)
      }
      initWorld();
      initHero();
    }
  };
})();
