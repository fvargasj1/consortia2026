/* =====================================================================
   Gran Premio Sage | PANTALLA PÚBLICA (iPad, otro laptop o proyector)
   Solo lee: no necesita iniciar sesión. Se actualiza sola.
   QR de registro -> pregunta -> resultado de la pregunta -> pista ->
   totales -> (otra vuelta del ciclo) -> carrera final y podio.
   ===================================================================== */
(function () {
'use strict';
const GP = window.GP, U = GP.U, esc = U.esc, sty = GP.sty;
const LOGOS = window.GP_LOGOS;
const LET = GP.RESPUESTA_LETRAS;
const UI = { ready: false, err: '', qStart: Date.now(), qKey: '', offlineSince: 0 };
let A = null, S = null, L = null, appEl, rt = null;
let mode = '', board = null, pistaBoard = null, raceH = null, raceKey = '', wake = null;

const tur = () => L.tur(), cfg = () => L.cfg(), escT = () => L.escT();
function render() { if (rt) return; rt = setTimeout(() => { rt = null; try { doRender(); } catch (e) { console.error(e); } }, 0); }

/* ---------- piezas ---------- */
function headerHTML() {
  const t = tur(), c = cfg();
  const off = A.estado !== 'en línea' && UI.offlineSince && Date.now() - UI.offlineSince > 6000;
  return '<img class="lg" src="' + LOGOS.sageWhite + '" alt="Sage"><div class="tt"><b>Gran <span class="hl">Premio</span> Sage</b><span>' + U.sepJoin([U.txt(c.evento), esc(c.lugar)]) + '</span></div><div class="steps"></div>' +
    '<div class="acts"><span class="conn off" ' + (off ? '' : 'hidden') + '><i></i>Reconectando…</span><span class="chip" aria-label="Turno">Turno ' + t.n + '</span></div>';
}
function registroHTML() {
  const c = cfg(), url = c.enlaceRegistro, svg = U.qrSvg(url);
  const cols = escT().map(e => {
    const m = L.miembros(e.id);
    return '<section class="pnl team tcol"' + sty(L.colOf(e)) + '><div class="th"><b>' + esc(e.nombre) + '</b><span>' + m.length + (m.length === 1 ? ' persona' : ' personas') + '</span></div><div class="mlist">' +
      (m.slice(-12).reverse().map(x => '<div class="m"><b>' + esc(x.nombre) + '</b><i>' + esc(x.institucion) + '</i></div>').join('') || '<div class="more">Aún no hay nadie en esta escudería.</div>') +
      (m.length > 12 ? '<div class="more">+ ' + (m.length - 12) + ' más</div>' : '') + '</div></section>';
  }).join('');
  return '<div class="regv pub-reg"><section class="pnl qrbox"><h2>Regístrate</h2><div class="qr">' + (svg || '<span style="font-size:calc(var(--u)*1.8)">' + (url ? 'No se pudo dibujar el QR. Abre la dirección de abajo.' : 'Falta el enlace de registro') + '</span>') + '</div><div class="sub">Escanea, busca tu nombre y elige tu escudería.</div><div class="lk">' + esc(url) + '</div></section><div class="teams">' + cols + '</div></div>';
}
function preguntaHTML() {
  const t = tur(), q = t.pregunta, escs = escT();
  if (!q) return '<div class="waitbig">Preparando la siguiente pregunta…</div>';
  const nq = (t.qs || []).length || 3, long = q.texto.length > 150;
  const rem = Math.max(0, Number(cfg().radioSeg) - (Date.now() - UI.qStart) / 1000);
  const correcta = t.rev && t.reveal ? t.reveal.correcta : -1;
  const tots = escs.map(e => { const a = L.adjCs(e); return '<span class="tot"' + sty(L.colOf(e)) + '><i></i>' + esc(e.nombre) + ' <em class="' + (a < 0 ? 'neg' : a > 0 ? 'pos' : '') + '">' + U.fmtAdj(a) + '</em></span>'; }).join('');
  const opts = q.opciones.map((o, i) => {
    const right = t.rev && i === correcta;
    return '<div class="qo' + (right ? ' right' : t.rev ? ' dim' : '') + '"><span class="lt">' + LET[i] + '</span><span class="tx">' + esc(o) + '</span>' + (right ? '<span class="okb">✓ Correcta</span>' : '<span></span>') + '</div>';
  }).join('');
  let res = '';
  if (t.rev) {
    res = '<div class="resrow">' + escs.map(e => {
      const r = e.resp && e.resp[t.qi];
      if (!r || typeof r.ok !== 'boolean') return '<div class="rbig"' + sty(L.colOf(e)) + '><div class="wh"><b>' + esc(e.nombre) + '</b><small>Calculando…</small></div></div>';
      const v = r.ok ? -L.bonoCs() : L.bonoCs();
      return '<div class="rbig"' + sty(L.colOf(e)) + '><span class="ic" aria-hidden="true">' + (r.ok ? '✓' : '✗') + '</span><div class="wh"><b>' + esc(e.nombre) + '</b><small>' + (r.ok ? 'Acertó: resta tiempo' : 'No acertó: suma tiempo') + '</small></div><span class="v">' + U.fmtAdj(v) + '</span></div>';
    }).join('') + '</div>' + (t.reveal && t.reveal.dato ? '<div class="qdato"><b>Dato clave.</b> ' + esc(t.reveal.dato) + '</div>' : '');
  }
  return '<div class="pubq" style="display:flex;flex-direction:column;gap:calc(var(--u)*2.2);flex:1;min-height:0"><div class="qtop"><span class="qn">Pregunta ' + (t.qi + 1) + ' de ' + nq + '</span><span class="logochip">' + GP.recLogo(q.recurso) + '</span>' + (t.rev ? '' : '<span class="radio" data-radio>' + Math.ceil(rem) + '</span>') + '<div class="tots">' + tots + '</div></div>' +
    '<div class="qtext' + (long ? ' long' : '') + '">' + esc(q.texto) + '</div><div class="qopts">' + opts + '</div>' + res + '</div>';
}
function pistaLanesHTML() { return escT().map(e => GP.lapPanelHTML(L, e, { entry: false })).join(''); }

/* ---------- pintado ---------- */
function setMode(m, skel) {
  const sm = document.getElementById('sm');
  if (mode !== m) {
    if (raceH) { raceH.stop(); raceH = null; raceKey = ''; }
    board = null; pistaBoard = null; mode = m; sm.__last = ''; sm.innerHTML = skel;
  }
  return sm;
}
function doRender() {
  if (!UI.ready) { appEl.innerHTML = '<div class="aviso-config"><p>Conectando…</p></div>'; return; }
  if (UI.err) { appEl.innerHTML = '<div class="aviso-config"><img src="' + LOGOS.sageWhite + '" alt="Sage" style="height:40px"><h1>Falta un paso</h1><p>' + esc(UI.err) + '</p></div>'; return; }
  if (!appEl.__main) { appEl.innerHTML = '<div class="stage kiosk" id="stage"><header class="sh" id="sh"></header><main class="sm" id="sm"></main><div class="wm" id="wm" hidden>F: pantalla completa</div></div>'; appEl.__main = true; mode = ''; }
  if (A.estado === 'en línea') UI.offlineSince = 0; else if (!UI.offlineSince) UI.offlineSince = Date.now();
  const t = tur(), f = t.fase, key = f + ':' + t.qi;
  if (key !== UI.qKey) { UI.qKey = key; UI.qStart = Date.now(); }
  U.patchInto(document.getElementById('sh'), headerHTML());
  if (f === 'final') {
    setMode('final', '<div class="fill" id="fm"></div>');
    const k = String(t.anim) + ':' + L.ranking().length;
    if (raceKey !== k) { if (raceH) raceH.stop(); raceKey = k; raceH = GP.jugarFinal(document.getElementById('fm'), L, {}); }
  } else if (f === 'registro') {
    U.patchInto(setMode('html', ''), registroHTML());
  } else if (f === 'preguntas') {
    U.patchInto(setMode('html', ''), preguntaHTML());
  } else if (f === 'pista') {
    setMode('pista', '<div class="qtop"><h2>En pista</h2></div><div class="pistav"><div class="lcol" id="lcol"></div><div id="bm" class="fill"></div></div>');
    U.patchInto(document.getElementById('lcol'), pistaLanesHTML());
    if (!pistaBoard) pistaBoard = GP.crearTablero(document.getElementById('bm'), L, { compact: true });
    pistaBoard.update();
  } else {   // 'escuderias' y 'resultado': solo los totales acumulados
    setMode('board', '<div class="fill" id="bm"></div>');
    if (!board) board = GP.crearTablero(document.getElementById('bm'), L, {});
    board.update();
  }
  tick();
}
function tick() {
  document.querySelectorAll('[data-radio]').forEach(el => {
    const rem = Math.max(0, Number(cfg().radioSeg) - (Date.now() - UI.qStart) / 1000);
    const txt = String(Math.ceil(rem));
    if (el.textContent !== txt) el.textContent = txt;
    el.classList.toggle('low', rem <= 5);
  });
  const hdr = document.querySelector('.sh .conn');
  if (hdr) { const off = A.estado !== 'en línea' && UI.offlineSince && Date.now() - UI.offlineSince > 6000; if (hdr.hidden === off) hdr.hidden = !off; }
}

/* mantener la pantalla encendida y pantalla completa */
async function pedirWake() { try { if (navigator.wakeLock && document.visibilityState === 'visible') wake = await navigator.wakeLock.request('screen'); } catch (e) {} }
function alternarPantallaCompleta() { try { const d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else if (d.requestFullscreen) d.requestFullscreen(); else if (d.webkitRequestFullscreen) d.webkitRequestFullscreen(); } catch (e) {} }

async function boot() {
  U.iniciarTema(); GP.instalarSprites();
  appEl = document.getElementById('app');
  const c = GP.conectar();
  if (c.error) { GP.mensajeConfig(appEl, c.error); return; }
  A = GP.crearAlmacen(c.sb, { sondeo: 5000 });
  S = A.S; L = GP.logica(S);
  window.__GP_TEST__ = { S, A, L, UI };
  A.alCambiar(render);
  window.addEventListener('resize', () => render());
  document.addEventListener('visibilitychange', pedirWake);
  document.addEventListener('keydown', ev => { if ((ev.key === 'f' || ev.key === 'F') && !/input|textarea|select/i.test((ev.target.tagName || ''))) alternarPantallaCompleta(); });
  document.addEventListener('dblclick', alternarPantallaCompleta);
  document.addEventListener('click', pedirWake, { once: true });
  pedirWake();
  UI.ready = true; render();
  await A.iniciar();
  if (!S.turno || !S.config) { UI.err = 'No encontré la configuración del evento. Revisa que el archivo 01_esquema.sql se haya ejecutado en Supabase.'; render(); return; }
  document.title = 'Gran Premio Sage - Pantalla';
  setInterval(tick, 200);
  render();
  const wm = () => { const e = document.getElementById('wm'); if (e && (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)) { e.hidden = false; setTimeout(() => { e.hidden = true; }, 9000); } };
  setTimeout(wm, 500);
}
boot();
})();
