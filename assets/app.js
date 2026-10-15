/* Exoplanet Atlas — interface script. Loads data/planets.json, then builds every section.
   Requires d3 v7 (loaded by index.html). */
(function () {
  'use strict';

  const META = JSON.parse(document.getElementById('meta-data').textContent);
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TOUCH = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  const METHOD_COLORS = {
    'Transit': '#6cf2ff', 'Radial Velocity': '#ff7aa2', 'Microlensing': '#c599ff', 'Imaging': '#ffd58a',
    'Transit Timing Variations': '#7dffb4', 'Eclipse Timing Variations': '#ffaa66', 'Orbital Brightness Modulation': '#a0a4ff',
    'Pulsar Timing': '#ff9bff', 'Astrometry': '#ffe066', 'Pulsation Timing Variations': '#88e0d0', 'Disk Kinematics': '#bfd4ff'
  };
  const mcolor = m => METHOD_COLORS[m] || '#8896c4';
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (v, d = 2) => v == null ? '—' : (+v).toLocaleString(undefined, { maximumFractionDigits: d });
  const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (html) e.innerHTML = html; return e; };

  /* ───────── Tooltip ───────── */
  const tip = document.getElementById('tooltip');
  function showTip(html, x, y) { tip.innerHTML = html; tip.classList.add('show'); moveTip(x, y); }
  function moveTip(x, y) { tip.style.left = Math.min(x + 14, window.innerWidth - 272) + 'px'; tip.style.top = Math.max(8, y - 12) + 'px'; }
  function hideTip() { tip.classList.remove('show'); }
  const planetTip = p => `<b>${esc(p.n)}</b>` +
    [['Host', p.h], ['Year', p.y], ['Method', p.m], ['Period', p.p != null ? fmt(p.p) + ' d' : null], ['Radius', p.r != null ? fmt(p.r) + ' R⊕' : null],
     ['Mass', p.bm != null ? fmt(p.bm) + ' M⊕' : null], ['Distance', p.d != null ? fmt(p.d) + ' pc' : null]]
      .filter(([, v]) => v != null).map(([k, v]) => `<div class="row"><span>${k}</span><span>${esc(v)}</span></div>`).join('');

  /* Nearest-point hover/tap for an SVG scatter: one transparent rect, a quadtree, one cursor ring. */
  function nearestTip(svg, points, px, py, W, H, label) {
    const tree = d3.quadtree().x(px).y(py).addAll(points);
    const ring = svg.append('circle').attr('r', 6).attr('fill', 'none').attr('stroke', '#fff').attr('stroke-width', 1.5).style('display', 'none').style('pointer-events', 'none');
    const rect = svg.append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', H).attr('fill', 'transparent').style('cursor', 'crosshair');
    const toSvg = ev => { const ctm = svg.node().getScreenCTM(); return [(ev.clientX - ctm.e) / ctm.a, (ev.clientY - ctm.f) / ctm.d]; };
    const handle = ev => {
      const [sx, sy] = toSvg(ev);
      const d = tree.find(sx, sy, 18 / (svg.node().getScreenCTM().a || 1));
      if (!d) { ring.style('display', 'none'); hideTip(); return; }
      ring.style('display', null).attr('cx', px(d)).attr('cy', py(d));
      showTip(label(d), ev.clientX, ev.clientY);
    };
    rect.on('pointermove', handle).on('pointerdown', handle).on('pointerleave', () => { ring.style('display', 'none'); hideTip(); });
  }

  /* ───────── Starfield (paused when hidden, static with reduced motion) ───────── */
  (function starfield() {
    const c = document.getElementById('starfield'), ctx = c.getContext('2d');
    let stars = [], raf = null, scrollY = 0;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = innerWidth * dpr; c.height = innerHeight * dpr; c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px';
      const n = Math.min(320, Math.floor(innerWidth * innerHeight / 5200));
      stars = Array.from({ length: n }, () => ({ x: Math.random() * c.width, y: Math.random() * c.height, r: (Math.random() * 1.3 + 0.2) * dpr, a: Math.random() * .7 + .2, ph: Math.random() * 6.28, sp: .0008 + Math.random() * .0015 }));
      draw(performance.now(), true);
    }
    function draw(t, once) {
      ctx.clearRect(0, 0, c.width, c.height);
      const par = scrollY * 0.12 * (c.width / innerWidth);
      for (const s of stars) {
        const tw = REDUCED ? .8 : .6 + .4 * Math.sin(t * s.sp + s.ph);
        ctx.fillStyle = `rgba(220,230,255,${s.a * tw})`;
        let y = (s.y - par) % c.height; if (y < 0) y += c.height;
        ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, 6.283); ctx.fill();
      }
      if (!once && !REDUCED && !document.hidden) raf = requestAnimationFrame(draw);
    }
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', () => { scrollY = window.scrollY; if (REDUCED) draw(0, true); }, { passive: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !REDUCED && !raf) raf = requestAnimationFrame(draw); if (document.hidden && raf) { cancelAnimationFrame(raf); raf = null; } });
    resize();
    if (!REDUCED) raf = requestAnimationFrame(draw);
  })();

  /* ───────── Nav ───────── */
  (function nav() {
    const nav = document.getElementById('nav'), toggle = document.getElementById('nav-toggle');
    const links = [...document.querySelectorAll('.nav-link')];
    toggle.addEventListener('click', () => { const open = nav.classList.toggle('menu-open'); toggle.setAttribute('aria-expanded', String(open)); });
    links.forEach(l => l.addEventListener('click', () => { nav.classList.remove('menu-open'); toggle.setAttribute('aria-expanded', 'false'); }));
    const targets = links.map(l => document.getElementById(l.dataset.target)).filter(Boolean);
    const onScroll = () => {
      nav.classList.toggle('scrolled', window.scrollY > 20);
      const probe = window.scrollY + 120; let active = null;
      targets.forEach(t => { if (t.offsetTop <= probe) active = t.id; });
      links.forEach(l => { if (l.dataset.target === active) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current'); });
    };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  })();

  /* ───────── Load data, then build ───────── */
  fetch('data/planets.json?v=' + encodeURIComponent(META.fetched)).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(init).catch(err => {
    document.querySelectorAll('.needs-data').forEach(n => { n.innerHTML = `<p class="note"><strong>The planet data could not be loaded</strong> (${esc(err.message)}). If this page was opened from a local file, serve the folder instead: <code>python3 -m http.server</code>.</p>`; });
  });

  function init(PLANETS) {
    const byHost = d3.group(PLANETS, d => d.h);

    /* ───────── 01 Timeline: canvas sky map + scrollytelling ───────── */
    (function timeline() {
      const canvas = document.getElementById('sky'), ctx = canvas.getContext('2d');
      const W = 800, H = 420, PAD = { l: 38, r: 12, t: 12, b: 30 };
      const x = ra => PAD.l + (ra / 360) * (W - PAD.l - PAD.r);
      const y = dec => H - PAD.b - ((dec + 90) / 180) * (H - PAD.t - PAD.b);
      const all = PLANETS.filter(d => d.ra != null && d.dc != null && d.y != null).sort((a, b) => a.y - b.y);
      let dpr = 1;
      function size() { dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
      size();
      let state = { year: 1994, from: 1992, alpha: 1 };
      function draw(progress) {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#04122a'; ctx.fillRect(PAD.l, PAD.t, W - PAD.l - PAD.r, H - PAD.t - PAD.b);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
        for (let ra = 0; ra <= 360; ra += 60) { ctx.beginPath(); ctx.moveTo(x(ra), y(-90)); ctx.lineTo(x(ra), y(90)); ctx.stroke(); }
        for (let dec = -60; dec <= 60; dec += 30) { ctx.beginPath(); ctx.moveTo(x(0), y(dec)); ctx.lineTo(x(360), y(dec)); ctx.stroke(); }
        ctx.fillStyle = '#8d9bb0'; ctx.font = '10px ui-monospace, Menlo, monospace'; ctx.textAlign = 'center';
        for (let ra = 0; ra <= 360; ra += 60) ctx.fillText(ra + '°', x(ra), H - PAD.b + 14);
        ctx.textAlign = 'right';
        for (let dec = -90; dec <= 90; dec += 30) ctx.fillText((dec > 0 ? '+' : '') + dec + '°', PAD.l - 6, y(dec) + 3);
        ctx.textAlign = 'center'; ctx.fillText('RIGHT ASCENSION', W / 2, H - 4);
        ctx.save(); ctx.translate(10, H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('DECLINATION', 0, 0); ctx.restore();
        for (const d of all) {
          if (d.y > state.year) break;
          const fresh = d.y >= state.from;
          ctx.globalAlpha = fresh ? 0.95 * progress : 0.42;
          ctx.fillStyle = mcolor(d.m);
          ctx.beginPath(); ctx.arc(x(d.ra), y(d.dc), fresh ? 2.3 : 1.5, 0, 6.283); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      let anim = null;
      function show(year, from) {
        state = { year, from };
        let total = 0, fresh = 0;
        for (const d of all) { if (d.y <= year) { total++; if (d.y >= from) fresh++; } }
        document.getElementById('yr-now').textContent = year;
        document.getElementById('ct-now').textContent = total.toLocaleString();
        document.getElementById('ct-new').textContent = fresh.toLocaleString();
        if (anim) cancelAnimationFrame(anim);
        if (REDUCED) { draw(1); return; }
        const t0 = performance.now();
        const step = now => { const p = Math.min(1, (now - t0) / 450); draw(p); if (p < 1) anim = requestAnimationFrame(step); };
        anim = requestAnimationFrame(step);
      }
      const steps = [...document.querySelectorAll('.step')];
      let activeStep = null, pending = false;
      function pick() {
        pending = false;
        const mid = window.innerHeight * 0.5;
        let best = steps[0], bestD = Infinity;
        steps.forEach(s => { const r = s.getBoundingClientRect(); const d = r.top > mid ? r.top - mid : r.bottom < mid ? mid - r.bottom : 0; if (d < bestD) { bestD = d; best = s; } });
        if (best !== activeStep) { activeStep = best; steps.forEach(s => s.classList.toggle('active', s === best)); show(+best.dataset.to, +best.dataset.from); }
      }
      window.addEventListener('scroll', () => { if (!pending) { pending = true; requestAnimationFrame(pick); } }, { passive: true });
      window.addEventListener('resize', pick);
      pick();
      const legend = document.getElementById('legend');
      const counts = d3.rollup(PLANETS, v => v.length, d => d.m);
      [...counts].filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1]).forEach(([m, n]) => legend.appendChild(el('span', { class: 'item' }, `<span class="sw" style="background:${mcolor(m)}"></span>${esc(m)} (${n.toLocaleString()})`)));
    })();

    /* ───────── 02 System browser ───────── */
    (function systems() {
      const hosts = Array.from(byHost, ([h, ps]) => ({ h, ps, np: ps.length, sample: ps[0] })).sort((a, b) => b.np - a.np || a.h.localeCompare(b.h));
      const byName = new Map(hosts.map(x => [x.h.toLowerCase(), x]));
      const list = document.getElementById('sys-items');
      let current = null;
      function render(filter) {
        list.innerHTML = '';
        const f = (filter || '').toLowerCase().trim();
        let n = 0;
        for (const host of hosts) {
          if (f && !host.h.toLowerCase().includes(f)) continue;
          if (n >= 400) { list.appendChild(el('div', { class: 'sys-more' }, `Showing the first 400 of ${hosts.filter(x => !f || x.h.toLowerCase().includes(f)).length.toLocaleString()} matches — keep typing to narrow the list.`)); break; }
          const b = el('button', { type: 'button', class: 'sys-item', role: 'option', 'aria-selected': String(host.h === current), 'data-host': host.h });
          const sp = host.sample.sp ? ` · ${esc(host.sample.sp)}` : '';
          const dist = host.sample.d ? ` · ${fmt(host.sample.d, 1)} pc` : '';
          b.innerHTML = `<span class="name">${esc(host.h)}</span><span class="desc">${host.np} planet${host.np > 1 ? 's' : ''}${sp}${dist}</span>`;
          b.addEventListener('click', () => select(host.h, true));
          list.appendChild(b); n++;
        }
        if (!n) list.appendChild(el('div', { class: 'sys-more' }, 'No host star matches that name.'));
      }
      const search = document.getElementById('sys-search');
      search.addEventListener('input', () => render(search.value));
      const svg = d3.select('#sys-svg'), info = document.getElementById('sys-info'), tbl = document.getElementById('sys-table');
      let raf = null;
      const teffColor = t => !t ? '#ffd58a' : t < 3500 ? '#ff7050' : t < 5000 ? '#ffaa66' : t < 6000 ? '#ffe9b0' : t < 7500 ? '#fffced' : t < 10000 ? '#dde7ff' : '#aacaff';
      const planetColor = r => !r ? '#7c89b3' : r < 1.6 ? '#88e0d0' : r < 4 ? '#6cf2ff' : r < 8 ? '#a0a4ff' : '#ffd58a';
      function select(h, scrollTo) {
        const host = byName.get(h.toLowerCase()); if (!host) return;
        current = host.h;
        list.querySelectorAll('.sys-item').forEach(b => b.setAttribute('aria-selected', String(b.dataset.host === host.h)));
        const ps = host.ps.slice().sort((a, b) => (a.a || a.p || 0) - (b.a || b.p || 0));
        draw(host.h, ps);
        if (scrollTo) history.replaceState(null, '', '#system/' + encodeURIComponent(host.h));
        if (scrollTo && window.innerWidth < 900) document.getElementById('sys-stage').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
      }
      function draw(h, ps) {
        svg.selectAll('*').remove(); if (raf) cancelAnimationFrame(raf);
        const node = svg.node(), W = node.clientWidth || 800, H = node.clientHeight || 420;
        svg.attr('viewBox', `0 0 ${W} ${H}`);
        const cx = W / 2, cy = H / 2, star = ps[0];
        const starR = star.sr ? Math.min(32, 14 + Math.log2(star.sr + 1) * 8) : 16;
        const grad = svg.append('defs').append('radialGradient').attr('id', 'star-grad');
        grad.append('stop').attr('offset', '0%').attr('stop-color', '#fff');
        grad.append('stop').attr('offset', '40%').attr('stop-color', teffColor(star.st));
        grad.append('stop').attr('offset', '100%').attr('stop-color', teffColor(star.st)).attr('stop-opacity', 0);
        svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', starR * 4).attr('fill', 'url(#star-grad)').attr('opacity', .18);
        svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', starR).attr('fill', teffColor(star.st));
        const getA = p => p.a ? p.a : (p.p && star.sm) ? Math.cbrt(star.sm * Math.pow(p.p / 365.25, 2)) : p.p ? p.p / 365 : null;
        const valid = ps.filter(p => getA(p) != null);
        const nodes = [];
        if (valid.length) {
          const aVals = valid.map(getA);
          const rOrbit = d3.scaleLog().domain([d3.min(aVals) * .85, d3.max(aVals) * 1.15]).range([starR + 30, Math.min(W * .46, H * .46)]);
          valid.forEach(p => {
            const rr = rOrbit(getA(p));
            svg.append('ellipse').attr('cx', cx).attr('cy', cy).attr('rx', rr).attr('ry', rr * (1 - (p.e || 0) * .4)).attr('fill', 'none').attr('stroke', 'rgba(108,242,255,.22)').attr('stroke-dasharray', '2 4');
            const pr = Math.max(2.5, Math.min(18, p.r ? Math.sqrt(p.r) * 4 : 5));
            const g = svg.append('g');
            const c = g.append('circle').attr('r', pr).attr('fill', planetColor(p.r));
            const l = g.append('text').attr('fill', '#cfd8ff').attr('text-anchor', 'middle').style('font-family', 'ui-monospace, Menlo, monospace').style('font-size', '10px').text(p.n.replace(h, '').trim() || p.n);
            g.on('pointerenter', ev => showTip(planetTip(p), ev.clientX, ev.clientY)).on('pointerleave', hideTip);
            nodes.push({ p, rr, ecc: p.e || 0, period: p.p || 1, c, l, pr, phase: Math.random() * 6.283 });
          });
          const inner = nodes[0].period, t0 = performance.now();
          const place = now => {
            const elapsed = (now - t0) / 1000;
            nodes.forEach(n => {
              const wall = 45 * Math.sqrt(n.period / inner);
              const ph = REDUCED ? n.phase : (elapsed / wall) * 6.283 + n.phase;
              const px = cx + Math.cos(ph) * n.rr, py = cy + Math.sin(ph) * n.rr * (1 - n.ecc * .4);
              n.c.attr('cx', px).attr('cy', py); n.l.attr('x', px).attr('y', py - n.pr - 6);
            });
            if (!REDUCED) raf = requestAnimationFrame(place);
          };
          place(t0);
        }
        info.innerHTML = `<h3>${esc(h)}</h3><div class="sub">${esc(star.sp || 'spectral type not listed')}${star.d ? ' · ' + fmt(star.d, 1) + ' pc' : ''}</div>
          <div class="grid"><div><div class="k">Planets</div><div class="v">${ps.length}</div></div>
          <div><div class="k">Stellar T<sub>eff</sub></div><div class="v">${star.st ? fmt(star.st, 0) + ' K' : '—'}</div></div>
          <div><div class="k">Stellar radius</div><div class="v">${star.sr ? fmt(star.sr) + ' R☉' : '—'}</div></div>
          <div><div class="k">Stellar mass</div><div class="v">${star.sm ? fmt(star.sm) + ' M☉' : '—'}</div></div></div>`;
        tbl.innerHTML = `<table><caption class="sr-only">Planets of ${esc(h)}</caption><thead><tr><th scope="col">Planet</th><th scope="col">Period (d)</th><th scope="col">Radius (R⊕)</th><th scope="col">Mass (M⊕)</th><th scope="col">T<sub>eq</sub> (K)</th><th scope="col">Year</th><th scope="col">Method</th></tr></thead><tbody>` +
          ps.map(p => `<tr><td class="name">${esc(p.n)}</td><td>${fmt(p.p)}</td><td>${fmt(p.r)}</td><td>${fmt(p.bm)}</td><td>${fmt(p.t, 0)}</td><td>${p.y}</td><td>${esc(p.m)}</td></tr>`).join('') + '</tbody></table>';
      }
      document.getElementById('sys-copy').addEventListener('click', async e => {
        const url = location.origin + location.pathname + '#system/' + encodeURIComponent(current || '');
        try { await navigator.clipboard.writeText(url); e.target.textContent = 'Link copied'; setTimeout(() => e.target.textContent = 'Copy link to this system', 1600); } catch { prompt('Copy this link', url); }
      });
      document.querySelectorAll('[data-system]').forEach(a => a.addEventListener('click', ev => { ev.preventDefault(); select(a.dataset.system, true); search.value = ''; render(''); }));
      render('');
      const fromHash = () => { const m = location.hash.match(/^#system\/(.+)$/); if (m) { const h = decodeURIComponent(m[1]); if (byName.has(h.toLowerCase())) { select(h, false); return true; } } return false; };
      if (!fromHash()) select((byName.get('trappist-1') || hosts[0]).h, false);
      window.addEventListener('hashchange', fromHash);
      window.addEventListener('resize', () => { if (current) { const host = byName.get(current.toLowerCase()); draw(host.h, host.ps.slice().sort((a, b) => (a.a || a.p || 0) - (b.a || b.p || 0))); } });
    })();

    /* ───────── 03 TESS ───────── */
    (function tessSection() {
      const tess = PLANETS.filter(p => (p.f || '').includes('TESS'));
      (function sky() {
        const svg = d3.select('#tess-sky'), W = 880, H = 360, PAD = { l: 40, r: 14, t: 14, b: 32 };
        const x = d3.scaleLinear().domain([0, 360]).range([PAD.l, W - PAD.r]), y = d3.scaleLinear().domain([-90, 90]).range([H - PAD.b, PAD.t]);
        const r = d3.scaleSqrt().domain([0, 25]).range([1.2, 7]);
        svg.append('rect').attr('x', PAD.l).attr('y', PAD.t).attr('width', W - PAD.l - PAD.r).attr('height', H - PAD.t - PAD.b).attr('fill', '#04122a');
        const g = svg.append('g').attr('class', 'grid');
        for (let ra = 0; ra <= 360; ra += 60) g.append('line').attr('x1', x(ra)).attr('x2', x(ra)).attr('y1', y(-90)).attr('y2', y(90));
        for (let dec = -60; dec <= 60; dec += 30) g.append('line').attr('x1', x(0)).attr('x2', x(360)).attr('y1', y(dec)).attr('y2', y(dec));
        for (let ra = 0; ra <= 360; ra += 60) svg.append('text').attr('class', 'tick').attr('x', x(ra)).attr('y', H - PAD.b + 14).attr('text-anchor', 'middle').text(ra + '°');
        for (let dec = -90; dec <= 90; dec += 30) svg.append('text').attr('class', 'tick').attr('x', PAD.l - 6).attr('y', y(dec) + 3).attr('text-anchor', 'end').text((dec > 0 ? '+' : '') + dec + '°');
        const pts = tess.filter(p => p.ra != null && p.dc != null);
        svg.append('g').selectAll('circle').data(pts).enter().append('circle').attr('cx', d => x(d.ra)).attr('cy', d => y(d.dc)).attr('r', d => r(d.r || 2)).attr('fill', '#6cf2ff').attr('opacity', .55);
        nearestTip(svg, pts, d => x(d.ra), d => y(d.dc), W, H, planetTip);
      })();
      (function growth() {
        const svg = d3.select('#tess-growth'), W = 540, H = 320, PAD = { l: 48, r: 16, t: 18, b: 36 };
        const byYear = d3.rollup(tess.filter(p => p.y != null), v => v.length, d => d.y);
        const years = [...byYear.keys()].sort((a, b) => a - b); let cum = 0;
        const data = years.map(yv => { cum += byYear.get(yv); return { y: yv, n: byYear.get(yv), cum }; });
        const x = d3.scaleBand().domain(data.map(d => d.y)).range([PAD.l, W - PAD.r]).padding(.18);
        const y = d3.scaleLinear().domain([0, d3.max(data, d => d.cum) * 1.05]).range([H - PAD.b, PAD.t]);
        const yA = d3.scaleLinear().domain([0, d3.max(data, d => d.n) * 2.2]).range([H - PAD.b, PAD.t]);
        const grid = svg.append('g').attr('class', 'grid');
        y.ticks(5).forEach(t => { grid.append('line').attr('x1', PAD.l).attr('x2', W - PAD.r).attr('y1', y(t)).attr('y2', y(t)); svg.append('text').attr('class', 'tick').attr('x', PAD.l - 8).attr('y', y(t) + 3).attr('text-anchor', 'end').text(t.toLocaleString()); });
        const bars = svg.append('g').selectAll('rect').data(data).enter().append('rect').attr('x', d => x(d.y)).attr('y', d => yA(d.n)).attr('width', x.bandwidth()).attr('height', d => Math.max(0, H - PAD.b - yA(d.n))).attr('fill', '#c599ff').attr('opacity', .55).attr('rx', 2);
        bars.append('title').text(d => `${d.y}: ${d.n} planets confirmed, ${d.cum} cumulative`);
        svg.append('path').datum(data).attr('d', d3.line().x(d => x(d.y) + x.bandwidth() / 2).y(d => y(d.cum)).curve(d3.curveMonotoneX)).attr('fill', 'none').attr('stroke', '#6cf2ff').attr('stroke-width', 2);
        svg.append('g').selectAll('circle').data(data).enter().append('circle').attr('cx', d => x(d.y) + x.bandwidth() / 2).attr('cy', d => y(d.cum)).attr('r', 3.5).attr('fill', '#6cf2ff').attr('stroke', '#000b18').attr('stroke-width', 1.5);
        svg.append('g').selectAll('text').data(data).enter().append('text').attr('class', 'tick').attr('x', d => x(d.y) + x.bandwidth() / 2).attr('y', H - PAD.b + 16).attr('text-anchor', 'middle').text(d => d.y);
        const lg = svg.append('g').attr('transform', `translate(${PAD.l + 6}, ${PAD.t + 4})`);
        lg.append('rect').attr('width', 11).attr('height', 11).attr('fill', '#c599ff').attr('opacity', .55).attr('rx', 2);
        lg.append('text').attr('class', 'tick').attr('x', 17).attr('y', 10).text('per year');
        lg.append('line').attr('x1', 86).attr('x2', 110).attr('y1', 6).attr('y2', 6).attr('stroke', '#6cf2ff').attr('stroke-width', 2);
        lg.append('text').attr('class', 'tick').attr('x', 116).attr('y', 10).text('cumulative');
      })();
      const spec = [
        ['TOI-700', 'Habitable-zone Earth-sized', 'A nearby M-dwarf system whose outer planets sit in or near the optimistic habitable zone, a prime target for atmospheric follow-up.'],
        ['AU Mic', 'Young and lively', 'A roughly 22-million-year-old M dwarf still surrounded by a debris disk, whose transiting planets show how young stars sculpt atmospheres.'],
        ['TOI-849', 'Neptune-desert remnant', 'A short-period planet in the Neptune desert, probably the exposed core of a giant whose envelope was stripped away.'],
        ['LHS 1678', 'Tight three-planet system', 'A nearby M dwarf with three small planets in a compact architecture, all small enough to test rocky-versus-water compositions.'],
        ['HD 23472', 'Iron-rich candidates', 'Two of the densest small planets measured, pointing to Mercury-like, iron-dominated interiors.'],
        ['GJ 367', 'Ultra-short period', 'A sub-Earth in a 7.7-hour orbit, under half Earth’s mass and probably an iron core with almost no mantle.']
      ];
      const wrap = document.getElementById('tess-features');
      spec.forEach(([host, tag, blurb]) => {
        const ps = byHost.get(host); if (!ps) return;
        const star = ps[0], rs = ps.map(p => p.r).filter(v => v != null);
        const rr = rs.length ? (Math.min(...rs) === Math.max(...rs) ? `${fmt(rs[0])} R⊕` : `${fmt(Math.min(...rs))}–${fmt(Math.max(...rs))} R⊕`) : '—';
        const card = el('article', { class: 'card feature' }, `<div class="tag">${esc(tag)}</div><h4>${esc(host)}</h4><p>${esc(blurb)}</p>
          <div class="meta"><span><b>${ps.length}</b> planet${ps.length > 1 ? 's' : ''}</span><span>radii <b>${rr}</b></span><span><b>${star.d ? fmt(star.d, 1) + ' pc' : '—'}</b> away</span><span>host <b>${esc(star.sp || (star.st ? fmt(star.st, 0) + ' K' : '—'))}</b></span></div>
          <div class="row"><a class="btn small" href="#system/${encodeURIComponent(host)}" data-system="${esc(host)}">Open system</a></div>`);
        card.querySelector('[data-system]').addEventListener('click', ev => { ev.preventDefault(); document.querySelector(`#sys-items [data-host="${CSS.escape(host)}"]`)?.click() || (location.hash = '#system/' + encodeURIComponent(host)); document.getElementById('systems').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' }); });
        wrap.appendChild(card);
      });
    })();

    /* ───────── 04 Database: scatters + table ───────── */
    (function database() {
      (function massRadius() {
        const svg = d3.select('#mr'), W = 600, H = 380, PAD = { l: 56, r: 16, t: 16, b: 44 };
        const data = PLANETS.filter(p => p.bm > 0 && p.r > 0);
        const x = d3.scaleLog().domain([0.05, 7000]).range([PAD.l, W - PAD.r]), y = d3.scaleLog().domain([0.3, 30]).range([H - PAD.b, PAD.t]);
        svg.append('g').attr('class', 'axis').attr('transform', `translate(0 ${H - PAD.b})`).call(d3.axisBottom(x).ticks(6, '.1~f').tickSize(-(H - PAD.t - PAD.b)).tickPadding(8));
        svg.append('g').attr('class', 'axis').attr('transform', `translate(${PAD.l} 0)`).call(d3.axisLeft(y).ticks(5, '.1~f').tickSize(-(W - PAD.l - PAD.r)).tickPadding(8));
        svg.selectAll('.axis line').attr('stroke', 'rgba(255,255,255,.06)');
        svg.append('text').attr('class', 'axis-title').attr('x', W / 2).attr('y', H - 8).attr('text-anchor', 'middle').text('Planet mass (Earth masses, log)');
        svg.append('text').attr('class', 'axis-title').attr('transform', `translate(14 ${H / 2}) rotate(-90)`).attr('text-anchor', 'middle').text('Planet radius (Earth radii, log)');
        svg.append('g').selectAll('circle').data(data).enter().append('circle').attr('cx', d => x(d.bm)).attr('cy', d => y(d.r)).attr('r', 2.2).attr('fill', d => mcolor(d.m)).attr('opacity', .55);
        [['Earth', 1, 1, '#6cf2ff'], ['Neptune', 17.1, 3.88, '#a0a4ff'], ['Jupiter', 318, 11.21, '#ffd58a']].forEach(([name, m, r, col]) => {
          const cx = x(m), cy = y(r), g = svg.append('g');
          g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 13).attr('fill', 'none').attr('stroke', col).attr('opacity', .5);
          g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 4.5).attr('fill', col).attr('stroke', '#000b18').attr('stroke-width', 1.5);
          g.append('text').attr('class', 'ref-label').attr('x', cx + 18).attr('y', cy - 8).attr('fill', col).text(name);
        });
        svg.append('text').attr('class', 'tick').attr('x', W - 18).attr('y', 28).attr('text-anchor', 'end').text(`${data.length.toLocaleString()} planets with mass and radius`);
        nearestTip(svg, data, d => x(d.bm), d => y(d.r), W, H, planetTip);
      })();
      (function insolation() {
        const svg = d3.select('#ir'), W = 600, H = 380, PAD = { l: 56, r: 16, t: 16, b: 44 };
        const data = PLANETS.filter(p => p.i > 0 && p.r > 0);
        const x = d3.scaleLog().domain([0.005, 50000]).range([PAD.l, W - PAD.r]), y = d3.scaleLog().domain([0.3, 30]).range([H - PAD.b, PAD.t]);
        const hz = [x(1.55), x(0.32)]; // habitable band: 0.32 (Mars-like) to 1.55 (Venus-like) Earth flux; log x runs low→high so 1.55 is to the right
        svg.append('rect').attr('x', Math.min(...hz)).attr('y', PAD.t).attr('width', Math.abs(hz[1] - hz[0])).attr('height', H - PAD.t - PAD.b).attr('fill', '#6cf2ff').attr('opacity', .07);
        svg.append('text').attr('class', 'tick').attr('x', (hz[0] + hz[1]) / 2).attr('y', PAD.t + 14).attr('text-anchor', 'middle').attr('fill', '#6cf2ff').text('habitable band');
        svg.append('g').attr('class', 'axis').attr('transform', `translate(0 ${H - PAD.b})`).call(d3.axisBottom(x).ticks(6, '.2~f').tickSize(-(H - PAD.t - PAD.b)).tickPadding(8));
        svg.append('g').attr('class', 'axis').attr('transform', `translate(${PAD.l} 0)`).call(d3.axisLeft(y).ticks(5, '.1~f').tickSize(-(W - PAD.l - PAD.r)).tickPadding(8));
        svg.selectAll('.axis line').attr('stroke', 'rgba(255,255,255,.06)');
        svg.append('text').attr('class', 'axis-title').attr('x', W / 2).attr('y', H - 8).attr('text-anchor', 'middle').text('Stellar flux received (Earth = 1, log)');
        svg.append('text').attr('class', 'axis-title').attr('transform', `translate(14 ${H / 2}) rotate(-90)`).attr('text-anchor', 'middle').text('Planet radius (Earth radii, log)');
        svg.append('g').selectAll('circle').data(data).enter().append('circle').attr('cx', d => x(d.i)).attr('cy', d => y(d.r)).attr('r', 2.2).attr('fill', d => mcolor(d.m)).attr('opacity', .55);
        svg.append('text').attr('class', 'tick').attr('x', W - 18).attr('y', 28).attr('text-anchor', 'end').text(`${data.length.toLocaleString()} planets with flux and radius`);
        nearestTip(svg, data, d => x(d.i), d => y(d.r), W, H, planetTip);
      })();

      const PAGE = 50; let page = 1, sortK = 'y', sortD = -1, filtered = PLANETS.slice();
      const q = document.getElementById('db-search'), mSel = document.getElementById('db-method'), ySel = document.getElementById('db-year');
      [...new Set(PLANETS.map(p => p.m))].sort().forEach(m => mSel.appendChild(el('option', { value: m }, esc(m))));
      [...new Set(PLANETS.map(p => p.y))].sort((a, b) => b - a).forEach(yv => ySel.appendChild(el('option', { value: yv }, yv)));
      function apply() {
        const s = q.value.toLowerCase().trim(), m = mSel.value, yv = ySel.value;
        filtered = PLANETS.filter(p => (!s || p.n.toLowerCase().includes(s) || p.h.toLowerCase().includes(s)) && (m === 'ALL' || p.m === m) && (yv === 'ALL' || p.y == yv));
        page = 1; render();
      }
      function render() {
        filtered.sort((a, b) => { const av = a[sortK], bv = b[sortK]; if (av == null && bv == null) return 0; if (av == null) return 1; if (bv == null) return -1; return (typeof av === 'string' ? av.localeCompare(bv) : av - bv) * sortD; });
        const tot = filtered.length, pages = Math.max(1, Math.ceil(tot / PAGE)); if (page > pages) page = pages;
        document.getElementById('db-body').innerHTML = filtered.slice((page - 1) * PAGE, page * PAGE).map(p =>
          `<tr><th scope="row">${esc(p.n)}</th><td>${esc(p.h)}</td><td class="dim">${p.y ?? '—'}</td><td><span class="m" style="background:${mcolor(p.m)}"></span>${esc(p.m)}</td><td>${fmt(p.p)}</td><td>${fmt(p.r)}</td><td>${fmt(p.bm)}</td><td>${fmt(p.t, 0)}</td><td>${fmt(p.d, 1)}</td></tr>`).join('');
        document.getElementById('db-count').textContent = `${tot.toLocaleString()} planet${tot === 1 ? '' : 's'}`;
        document.getElementById('pg-info').textContent = `Page ${page} of ${pages}`;
        document.getElementById('pg-prev').disabled = page <= 1; document.getElementById('pg-next').disabled = page >= pages;
        document.querySelectorAll('#db-table thead th').forEach(th => { if (th.dataset.k === sortK) th.setAttribute('aria-sort', sortD > 0 ? 'ascending' : 'descending'); else th.removeAttribute('aria-sort'); });
      }
      q.addEventListener('input', apply); mSel.addEventListener('change', apply); ySel.addEventListener('change', apply);
      document.getElementById('pg-prev').addEventListener('click', () => { if (page > 1) { page--; render(); } });
      document.getElementById('pg-next').addEventListener('click', () => { page++; render(); });
      document.querySelectorAll('#db-table thead th button').forEach(b => b.addEventListener('click', () => { const k = b.parentElement.dataset.k; if (sortK === k) sortD = -sortD; else { sortK = k; sortD = (k === 'n' || k === 'h' || k === 'm') ? 1 : -1; } render(); }));
      apply();
    })();
  }
})();
