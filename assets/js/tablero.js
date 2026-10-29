/* =====================================================================
   Gran Premio Sage | piezas visuales compartidas
   - tablero de clasificación con estelas y buggy 4x4
   - panel de vueltas
   - carrera final con eliminación hasta el podio
   ===================================================================== */
(function () {
'use strict';
const GP = window.GP, U = GP.U, esc = U.esc;
const LOGOS = window.GP_LOGOS || {};
const sty = hex => ' style="--c:' + hex + '"';
GP.sty = sty;
GP.recLogo = id => (LOGOS[id] ? '<img src="' + LOGOS[id] + '" alt="' + esc(((window.GP_DATOS || {}).RECURSOS || {})[id] ? window.GP_DATOS.RECURSOS[id].nombre : id) + '">' : '');
GP.FASE_PUB = { escuderias: 'Preparando el siguiente grupo', registro: 'Registro abierto', preguntas: 'Preguntas', pista: 'En pista', resultado: 'Resultado del turno', final: 'Gran final' };
const unidad = () => Math.min(window.innerHeight / 100, window.innerWidth * 0.005625);

/* ---------- Tablero con estelas ---------- */
GP.crearTablero = (mount, L, opts) => {
  opts = opts || {};
  mount.innerHTML = opts.compact
    ? '<section class="tower"><div class="tt"><h2>Clasificación general</h2><span class="muted" data-b="count"></span></div><div class="trows compact" data-b="rows"></div></section>'
    : '<div class="bv"><section class="tower"><div class="tt"><h2>Clasificación general</h2><span class="muted" data-b="count"></span></div><div class="trows" data-b="rows"></div></section><aside class="sidecol" data-b="side"></aside></div>';
  if (opts.compact) { mount.style.display = 'flex'; mount.style.flexDirection = 'column'; mount.style.minHeight = '0'; }
  const rowsEl = mount.querySelector('[data-b="rows"]'), sideEl = mount.querySelector('[data-b="side"]'), countEl = mount.querySelector('[data-b="count"]');
  const rowMap = new Map(), prev = new Map();
  let sideHtml = '', first = true;

  function sideHTML(list) {
    const t = L.tur(), mx = L.maxV(), escs = L.escT();
    let h = '<section class="pnl"><div class="k">' + U.sepJoin(['Turno ' + t.n, esc(GP.FASE_PUB[t.fase] || '')]) + '</div>';
    const cerrados = escs.filter(e => e.cerrada);
    if (!escs.length) h += '<div class="muted">El siguiente grupo está por empezar.</div>';
    else if (t.fase === 'resultado' || t.fase === 'pista') {
      h += escs.map(e => {
        const r = list.find(x => x.e.id === e.id), laps = L.vueltasDe(e.id).length;
        return '<div class="trw"' + sty(L.colOf(e)) + '><i></i><div><div class="n">' + esc(e.nombre) + '</div><div class="s">' + U.sepJoin([(e.cerrada ? e.vueltas : laps) + ' de ' + mx + ' vueltas', L.aciertos(e) + ' aciertos', r ? U.fmtAdj(r.aj) : '']) + '</div></div><div class="t">' + (r ? U.fmtCs(r.final) : '–') + '</div></div>';
      }).join('');
      if (t.fase === 'resultado' && cerrados.length === escs.length) {
        const a = list.filter(x => escs.some(e => e.id === x.e.id)).sort((p, q) => p.final - q.final);
        if (a.length === 2) h += a[0].final === a[1].final ? '<div class="wincall">Empate en el turno</div>' : '<div class="wincall">Gana ' + esc(a[0].e.nombre) + '<small>por ' + ((a[1].final - a[0].final) / 100).toFixed(2).replace('.', ',') + ' s</small></div>';
        else if (a.length === 1) h += '<div class="wincall">Gana ' + esc(a[0].e.nombre) + '</div>';
      }
    } else {
      h += '<div class="muted">' + esc(escs.map(e => e.nombre).join(' y ')) + '</div>';
    }
    h += '</section>';
    const lead = list[0];
    h += '<section class="pnl"><div class="k">Líder del evento</div>' + (lead ? '<div class="trw"' + sty(L.colOf(lead.e)) + '><i></i><div><div class="n">' + esc(lead.e.nombre) + '</div><div class="s">' + U.sepJoin(['Turno ' + lead.e.turno, lead.laps + ' vueltas']) + '</div></div><div class="t">' + U.fmtCs(lead.final) + '</div></div>' : '<div class="muted">Aún no hay tiempos.</div>') + '</section>';
    return h;
  }

  return {
    update() {
      const list = L.ranking();
      countEl.textContent = list.length + (list.length === 1 ? ' escudería' : ' escuderías');
      const u = unidad(), G = 1.06;
      const avail = rowsEl.clientHeight || 400;
      const rh = Math.max(3.4 * u, Math.min(8.6 * u, avail / (Math.max(list.length, opts.compact ? 6 : 7) * G)));
      const cap = Math.max(1, Math.floor(avail / (rh * G) + 0.001));
      rowsEl.style.setProperty('--rh', rh.toFixed(2) + 'px');
      rowsEl.classList.toggle('big', rh >= 5.6 * u);
      const best = list.length ? Math.max(list[0].final, 100) : 100;
      const keys = new Set(list.map(r => r.e.id));
      list.forEach((r, i) => {
        let el = rowMap.get(r.e.id);
        if (!el) {
          el = document.createElement('div'); el.className = 'trow hide';
          el.innerHTML = '<span class="pos"></span><div class="inf"><span class="nm"><b></b><i></i></span><span class="mt"></span></div><div class="track"><div class="run"><div class="bar"></div>' + GP.buggyHTML() + '</div></div><div class="tm"></div>';
          rowsEl.appendChild(el); rowMap.set(r.e.id, el);
          el.style.transform = 'translateY(calc((var(--rh) * 1.06) * ' + Math.min(i + 1, cap) + '))'; void el.offsetHeight;
        }
        const setT = (s, tx) => { const n = el.querySelector(s); if (n.textContent !== tx) n.textContent = tx; };
        const setH = (s, hh) => { const n = el.querySelector(s); if (n.__h !== hh) { n.__h = hh; n.innerHTML = hh; } };
        setT('.pos', String(r.pos)); setT('.nm b', r.e.nombre); setT('.nm i', r.laps + (r.laps === 1 ? ' vuelta' : ' vueltas'));
        setH('.mt', U.sepJoin([r.laps + (r.laps === 1 ? ' vuelta' : ' vueltas'), 'mejor ' + U.fmtCs(r.mejor), 'ajuste ' + U.fmtAdj(r.aj)])); setT('.tm', U.fmtCs(r.final));
        el.style.setProperty('--c', L.colOf(r.e));
        el.classList.toggle('p1', r.pos === 1); el.classList.toggle('live', r.live);
        const k = Math.max(0.06, Math.min(1, best / Math.max(r.final, 100)));
        el.querySelector('.run').style.setProperty('--k', k.toFixed(4));
        el.style.transform = 'translateY(calc((var(--rh) * 1.06) * ' + i + '))';
        el.classList.toggle('hide', i >= cap);
        const pf = prev.get(r.e.id);
        if (!first && pf != null && pf !== r.final) { el.classList.remove('fresh'); void el.offsetHeight; el.classList.add('fresh'); }
        prev.set(r.e.id, r.final);
      });
      rowMap.forEach((el, k) => { if (!keys.has(k)) { el.remove(); rowMap.delete(k); prev.delete(k); } });
      const emp = rowsEl.querySelector('.tempty');
      if (!list.length) { if (!emp) rowsEl.insertAdjacentHTML('beforeend', '<div class="tempty">Aún no hay tiempos. Los pilotos entran pronto a pista.</div>'); } else if (emp) emp.remove();
      if (sideEl) { const sh = sideHTML(list); if (sh !== sideHtml) { sideHtml = sh; sideEl.innerHTML = sh; } }
      first = false;
    }
  };
};

/* ---------- Panel de vueltas (moderador con captura, o público solo lectura) ---------- */
GP.lapPanelHTML = (L, e, o) => {
  o = o || {};
  const laps = L.vueltasDe(e.id), mx = L.maxV(), full = laps.length >= mx, best = laps.length ? Math.min.apply(null, laps.map(l => l.cs)) : null;
  const adj = L.adjCs(e), fin = best != null ? Math.max(0, best + adj) : null;
  const nq = Math.max(3, (L.tur().qs || []).length);
  const marks = Array.from({ length: nq }, (_, i) => {
    const r = e.resp && e.resp[i];
    return r && typeof r.ok === 'boolean' ? '<span class="mk ' + (r.ok ? '' : 'ko') + '" title="Pregunta ' + (i + 1) + '">' + (r.ok ? '✓' : '✗') + '</span>' : '<span class="mk na">–</span>';
  }).join('');
  let entry = '';
  if (o.entry) {
    const pr = U.parseLap(o.draft);
    const prev = pr.d ? (pr.ok ? U.fmtCs(pr.cs) + '<small>min:seg.cent</small>' : '<span class="bad">Revisa: los segundos van de 00 a 59</span>') : '<span style="opacity:.4">0:00.00</span>';
    entry = '<div class="entry"><label class="lbl" for="lap_' + esc(e.id) + '">Tiempo de la vuelta (solo dígitos: 2430 = 0:24.30)</label>' +
      '<input id="lap_' + esc(e.id) + '" type="text" inputmode="numeric" autocomplete="off" data-lap="' + esc(e.id) + '" value="' + esc(o.draft || '') + '" ' + (full ? 'disabled placeholder="Completó las ' + mx + ' vueltas"' : 'placeholder="Ej. 2430"') + '>' +
      '<div class="prev" aria-live="polite">' + prev + '</div>' +
      '<button class="btn acc" data-act="guardarVuelta" data-esc="' + esc(e.id) + '"' + (full || !pr.ok ? ' disabled' : '') + '>Guardar vuelta</button></div>';
  }
  const lapsHtml = laps.length
    ? '<div class="laps">' + laps.map((l, i) => '<div class="lap' + (l.cs === best ? ' best' : '') + '"><span><small>V' + (i + 1) + '</small>' + U.fmtCs(l.cs) + '</span>' + (o.entry ? '<button data-act="borrarVuelta" data-id="' + esc(l.id) + '" aria-label="Borrar la vuelta ' + (i + 1) + '" title="Borrar">×</button>' : '') + '</div>').join('') + '</div>'
    : (o.entry ? '' : '<div class="none">Esperando la primera vuelta</div>');
  return '<section class="lp"' + sty(L.colOf(e)) + '><div class="lh"><b>' + esc(e.nombre) + '</b><span>' + laps.length + ' de ' + mx + ' vueltas</span></div>' +
    '<div class="marks" aria-label="Respuestas">' + marks + '<span class="muted" style="margin-left:.5em">' + L.aciertos(e) + ' aciertos</span></div>' + entry + lapsHtml +
    '<div class="calc"><span class="k">Mejor vuelta</span><span class="v">' + U.fmtCs(best) + '</span><span class="k">Ajuste por respuestas</span><span class="v ' + (adj < 0 ? 'neg' : adj > 0 ? 'pos' : '') + '">' + U.fmtAdj(adj) + '</span>' +
    '<div class="fin"><span class="k">Tiempo final provisional</span><b>' + U.fmtCs(fin) + '</b></div></div></section>';
};

/* ---------- Carrera final ---------- */
GP.jugarFinal = (mount, L, opts) => {
  opts = opts || {};
  const speed = Number(window.__GP_SPEED) > 0 ? Number(window.__GP_SPEED) : 1;
  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) && !window.__GP_SPEED;
  const list = L.ranking(), N = list.length;
  let raf = 0, dead = false, confT = 0;
  const H = { stop() { dead = true; cancelAnimationFrame(raf); clearTimeout(confT); window.removeEventListener('resize', onResize); } };
  mount.innerHTML = '<div class="final"><div class="fh"><h2>Carrera final</h2><span class="ph" data-ph aria-live="polite"></span></div><div class="road" data-road></div></div>';
  const fin = mount.querySelector('.final'), road = mount.querySelector('[data-road]'), ph = mount.querySelector('[data-ph]');
  if (!N) { road.innerHTML = '<div class="tempty">Aún no hay escuderías clasificadas.</div>'; return H; }

  const lanesOrder = list.slice().sort((a, b) => (a.e.ts || 0) - (b.e.ts || 0) || (a.e.id < b.e.id ? -1 : 1));
  road.innerHTML = '<div class="stt"></div><div class="fin"></div>' + lanesOrder.map((r, i) =>
    '<div class="rlane" style="--c:' + L.colOf(r.e) + ';--i:' + i + '" data-id="' + esc(r.e.id) + '"><div class="rn"><i></i>' + esc(r.e.nombre) + '</div><div class="rail"></div><div class="rtrail"></div><div class="rcar">' + GP.buggyHTML() + '</div></div>').join('');
  const lanes = {};
  road.querySelectorAll('.rlane').forEach(el => { lanes[el.dataset.id] = el; });

  /* calendario de la carrera (en segundos) */
  const M = Math.max(0, N - 3);
  const plan = {};
  list.forEach((r, idx) => {
    const rank = idx + 1;
    if (rank <= 3) plan[r.e.id] = { rank, fin: (N <= 3 ? [8.5, 9.6, 10.7] : [14.5, 15.6, 16.7])[rank - 1] };
    else { const k = N - rank, f = M > 1 ? k / (M - 1) : 0.5; plan[r.e.id] = { rank, stopT: 3 + 8.5 * f, stopX: 0.1 + 0.62 * f }; }
  });
  const tEnd = (N <= 3 ? 10.7 : 16.7) + 0.7;
  const PRE = 1.6;

  let geo = null;
  function medir() {
    const rh = road.clientHeight, u = unidad(), lh = Math.min(rh / N, 13 * u);
    road.style.setProperty('--lh', lh.toFixed(2) + 'px');
    road.style.setProperty('--off', Math.max(0, (rh - lh * N) / 2).toFixed(2) + 'px');
    const car = road.querySelector('.rcar'), stt = road.querySelector('.stt'), finEl = road.querySelector('.fin');
    geo = { travel: Math.max(10, road.clientWidth - stt.offsetLeft - car.offsetWidth - finEl.offsetWidth), carW: car.offsetWidth };
  }
  function onResize() { medir(); pintar(lastT); }
  window.addEventListener('resize', onResize);

  const eased = (r, t) => {
    const p = plan[r.e.id];
    if (p.fin != null) { const s = Math.min(1, t / p.fin); return s * (1.35 - 0.35 * s); }
    const s = Math.min(1, t / p.stopT); return p.stopX * (s * (2 - s));
  };
  let lastT = 0;
  function pintar(t) {
    lastT = t;
    let vivos = 0;
    list.forEach(r => {
      const el = lanes[r.e.id], p = plan[r.e.id];
      const x = Math.max(0, eased(r, t)), px = x * geo.travel;
      el.querySelector('.rcar').style.transform = 'translateX(' + px.toFixed(1) + 'px)';
      el.querySelector('.rtrail').style.width = (px + geo.carW * 0.5).toFixed(1) + 'px';
      const out = p.stopT != null && t >= p.stopT;
      if (out !== el.classList.contains('out')) {
        el.classList.toggle('out', out);
        const nm = el.querySelector('.rn i'); nm.textContent = out ? p.rank + 'º' : '';
      }
      el.classList.toggle('top', p.rank <= 3);
      if (!out) vivos++;
    });
    const txt = t < PRE * 0.5 ? 'Listos' : t < PRE ? 'Arrancan' : vivos > 3 ? 'Siguen ' + vivos + ' en carrera' : 'Los tres mejores van por la victoria';
    if (ph.textContent !== txt) ph.textContent = txt;
  }

  function podio() {
    const top = list.slice(0, Math.min(3, N));
    const pods = [1, 0, 2].filter(i => top[i]).map(i => {
      const r = top[i], ph2 = [22, 15, 10][i];
      return '<div class="pod p' + (i + 1) + '"' + sty(L.colOf(r.e)) + '><div class="pc">' + GP.buggyHTML() + '</div><div class="nm">' + esc(r.e.nombre) + '</div><div class="tm">' + U.fmtCs(r.final) + '</div><div class="blk" style="--ph:' + ph2 + '">' + (i + 1) + '</div></div>';
    }).join('');
    const w = top[0], mem = L.miembros(w.e.id);
    const el = document.createElement('div');
    el.className = 'podio';
    el.innerHTML = '<div class="pod3">' + pods + '</div><div class="win"' + sty(L.colOf(w.e)) + '><span class="k">Campeona del Gran Premio Sage</span><span class="wn">' + esc(w.e.nombre) + '</span><div class="hintline" style="font-size:calc(var(--u)*2.4);color:#fff">' +
      U.sepJoin(['Turno ' + w.e.turno, U.fmtCs(w.final), w.laps + ' vueltas']) + '</div>' +
      '<div class="k" style="margin-top:calc(var(--u)*1)">Integrantes (' + mem.length + ')</div><div class="wlist">' +
      (mem.length ? mem.map(m => '<div class="m"><b>' + esc(m.nombre) + '</b><i>' + esc(m.institucion) + '</i></div>').join('') : '<div class="muted">Sin personas registradas en esta escudería.</div>') + '</div></div>';
    fin.appendChild(el);
    const conf = document.createElement('div'); conf.className = 'conf';
    const cols = ['#08C9C4', '#348AF7', '#D9EEFF', L.colOf(w.e), '#fff'];
    let ch = ''; for (let i = 0; i < 46; i++) ch += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;background:' + cols[i % cols.length] + ';animation-duration:' + (3.5 + Math.random() * 4).toFixed(1) + 's;animation-delay:-' + (Math.random() * 6).toFixed(1) + 's"></i>';
    conf.innerHTML = ch; fin.appendChild(conf);
    confT = setTimeout(() => { conf.remove(); }, 30000);
    ph.textContent = 'Ganó ' + w.e.nombre;
    if (opts.onEnd) opts.onEnd();
  }

  medir();
  if (reduced) { pintar(tEnd + 5); podio(); return H; }
  pintar(0);
  const t0 = performance.now();
  (function paso(now) {
    if (dead) return;
    const t = ((now - t0) / 1000) * speed - PRE;
    if (t < 0) { pintar(0); ph.textContent = (now - t0) / 1000 * speed < PRE * 0.5 ? 'Listos' : 'Arrancan'; raf = requestAnimationFrame(paso); return; }
    pintar(t);
    if (t >= tEnd) { podio(); return; }
    raf = requestAnimationFrame(paso);
  })(t0);
  return H;
};
})();
