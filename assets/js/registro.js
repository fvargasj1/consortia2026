/* =====================================================================
   Gran Premio Sage | REGISTRO (celulares de los directores)
   Siempre es el mismo enlace. Solo está abierto mientras el moderador
   mantiene la fase "Registro". Se actualiza sola.
   ===================================================================== */
(function () {
'use strict';
const GP = window.GP, U = GP.U, esc = U.esc, sty = GP.sty;
const LOGOS = window.GP_LOGOS;
const UI = { ready: false, err: '', step: 'buscar', formErr: '', buscando: false, res: null, done: null, enviando: false };
const D = { reg_q: '', reg_nom: '', reg_ins: '', reg_mail: '', reg_esc: null };
let A = null, S = null, L = null, sb = null, appEl, rt = null, qTimer = null, qSeq = 0;

const tur = () => L.tur(), cfg = () => L.cfg(), escT = () => L.escT();
function render() { if (rt) return; rt = setTimeout(() => { rt = null; try { doRender(); } catch (e) { console.error(e); } }, 0); }

const brand = '<div class="brand"><img class="lg-light" src="' + LOGOS.sageNavy + '" alt="Sage"><img class="lg-dark" src="' + LOGOS.sageWhite + '" alt="Sage"></div>';
function field(key, label, type, extra) {
  return '<div class="field"><label for="f_' + key + '">' + label + '</label><input id="f_' + key + '" type="' + (type || 'text') + '" data-d="' + key + '" value="' + esc(D[key] || '') + '" ' + (extra || '') + '></div>';
}
function intro() {
  const c = cfg();
  return brand + '<span class="sage-tag" style="font-size:18px;align-self:flex-start">' + esc(c.lugar) + '</span><h1>Gran <span class="hl">Premio</span> Sage</h1><p class="sub">' + U.sepJoin([U.txt(c.evento)]) + '</p>';
}
function cerradoHTML() {
  const t = tur();
  let h, p;
  if (t.fase === 'escuderias') { h = 'Todavía no hay escuderías abiertas'; p = 'Cuando el moderador abra el registro, esta pantalla se actualiza sola y podrás inscribirte.'; }
  else if (t.fase === 'final') { h = 'La competencia terminó'; p = 'Gracias por participar en el Gran Premio Sage.'; }
  else { h = 'El registro de este grupo ya cerró'; p = 'Estamos en plena carrera. Cuando se abra el registro del siguiente grupo, esta pantalla se actualiza sola.'; }
  return '<div class="regpage">' + intro() + '<div class="note" role="status" style="display:flex;gap:14px;align-items:flex-start"><span class="cerrado-ic" aria-hidden="true">i</span><div><strong>' + h + '.</strong><br>' + p + '</div></div></div>';
}
function listoHTML() {
  const p = UI.done, e = S.escuderias[p.esc_id];
  return '<div class="regpage">' + brand + '<span class="sage-tag" style="font-size:20px;align-self:flex-start">¡Listo!</span><h1>' + esc(p.nombre.split(' ')[0]) + ', ya estás en la <span class="hl">pista</span></h1>' +
    '<div class="escpick on"' + sty(e ? L.colOf(e) : '#08C9C4') + '><span><b>' + esc(e ? e.nombre : '') + '</b><small>' + esc(p.institucion) + '</small></span></div>' +
    '<div class="note">Quédate con tu escudería y espera la indicación del moderador. Si te equivocaste de escudería, registra tu nombre otra vez y elige la correcta.</div>' +
    '<button class="btn sec" data-act="otra">Registrar a otra persona</button></div>';
}
function buscarHTML() {
  const q = String(D.reg_q || ''), toks = U.norm(q).split(/\s+/).filter(Boolean);
  const largo = toks.join('').length >= 3;
  let lista;
  if (!largo) lista = '<p class="muted">Escribe al menos tres letras de tu nombre o de tu institución.</p>';
  else if (UI.buscando && !UI.res) lista = '<p class="muted">Buscando…</p>';
  else if (UI.res && UI.res.length) lista = '<div class="stack">' + UI.res.map(r => '<button class="pickrow" data-act="elegir" data-id="' + esc(r.id) + '"><b>' + esc(r.nombre) + '</b><span>' + esc(r.institucion) + '</span></button>').join('') + '</div>';
  else lista = '<p class="muted">No encontramos ese nombre.</p>';
  return '<div class="regpage">' + intro() + '<section class="card"><h2>Busca tu nombre</h2>' + field('reg_q', 'Tu nombre o tu institución', 'text', 'autocomplete="off" autocapitalize="words"') + lista +
    '<button class="btn ghost" data-act="nuevo">No estoy en la lista</button></section></div>';
}
function datosHTML() {
  const dl = '<datalist id="instlist">' + L.instituciones().map(i => '<option value="' + esc(i) + '"></option>').join('') + '</datalist>';
  const cnt = id => L.miembros(id).length;
  const opts = escT().map(e => '<label class="escpick' + (D.reg_esc === e.id ? ' on' : '') + '"' + sty(L.colOf(e)) + '><input type="radio" name="reg_esc" value="' + esc(e.id) + '" data-d="reg_esc"' + (D.reg_esc === e.id ? ' checked' : '') + '><span><b>' + esc(e.nombre) + '</b><small>' + cnt(e.id) + (cnt(e.id) === 1 ? ' persona' : ' personas') + '</small></span></label>').join('');
  return '<div class="regpage">' + intro() + '<form class="card" id="regform" autocomplete="on"><h2>Confirma tus datos</h2>' +
    field('reg_nom', 'Nombre completo', 'text', 'autocomplete="name"') + field('reg_ins', 'Institución', 'text', 'list="instlist" autocomplete="organization"') + dl + field('reg_mail', 'Correo (opcional)', 'email', 'autocomplete="email" inputmode="email"') +
    '<div class="stack"><div class="lbl" id="lblesc">Elige tu escudería</div><div class="escpicks" role="radiogroup" aria-labelledby="lblesc">' + opts + '</div></div>' +
    '<p class="consent">Si dejas tu correo, aceptas que Sage lo use para enviarte información sobre los recursos presentados en este encuentro. Puedes dejarlo en blanco.</p>' +
    '<button class="btn lg acc" type="submit" data-act="enviar"' + (UI.enviando ? ' disabled' : '') + '>' + (UI.enviando ? 'Enviando…' : 'Registrarme') + '</button>' + (UI.formErr ? '<div class="warnbox" role="alert">' + esc(UI.formErr) + '</div>' : '') +
    '<button class="btn ghost" type="button" data-act="volver">← Buscar de nuevo</button></form></div>';
}
function doRender() {
  if (!UI.ready) { appEl.innerHTML = '<div class="regpage"><p class="muted">Cargando…</p></div>'; return; }
  if (UI.err) { appEl.innerHTML = '<div class="regpage">' + brand + '<h1>Falta un paso</h1><div class="warnbox">' + esc(UI.err) + '</div></div>'; return; }
  const t = tur(), abierto = t.fase === 'registro' && (t.escIds || []).length >= 2 && escT().length >= 2;
  let html;
  if (UI.step === 'listo' && UI.done) html = listoHTML();
  else if (!abierto) html = cerradoHTML();
  else html = UI.step === 'datos' ? datosHTML() : buscarHTML();
  U.patchInto(appEl, html);
  document.title = 'Gran Premio Sage - Registro';
}

/* ---------- acciones ---------- */
function buscar() {
  clearTimeout(qTimer);
  const toks = U.norm(D.reg_q).split(/\s+/).filter(Boolean).slice(0, 6);
  if (toks.join('').length < 3) { UI.res = null; UI.buscando = false; render(); return; }
  UI.buscando = true; render();
  qTimer = setTimeout(async () => {
    const mi = ++qSeq;
    const r = await sb.rpc('buscar_asistente', { p_tokens: toks });
    if (mi !== qSeq) return;
    UI.buscando = false; UI.res = r.error ? [] : (r.data || []); render();
  }, 280);
}
const ACT = {
  async elegir(d) {
    const r = await sb.rpc('datos_asistente', { p_id: d.id });
    const x = !r.error && r.data && r.data[0];
    if (!x) { UI.formErr = 'No se pudo cargar tu información. Escríbela a mano.'; }
    else { D.reg_nom = x.nombre; D.reg_ins = x.institucion || ''; D.reg_mail = x.correo || ''; UI.formErr = ''; }
    UI.step = 'datos'; render();
  },
  nuevo() { D.reg_nom = String(D.reg_q || '').trim(); D.reg_ins = ''; D.reg_mail = ''; UI.formErr = ''; UI.step = 'datos'; render(); },
  volver() { UI.step = 'buscar'; UI.formErr = ''; render(); },
  async enviar() {
    if (UI.enviando) return;
    const t = tur(), nom = String(D.reg_nom || '').trim(), ins = String(D.reg_ins || '').trim(), mail = String(D.reg_mail || '').trim();
    let msg = '';
    if (t.fase !== 'registro') msg = 'El registro está cerrado por ahora. Espera la indicación del moderador.';
    else if (nom.length < 3) msg = 'Escribe tu nombre completo.';
    else if (!ins) msg = 'Elige o escribe tu institución.';
    else if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) msg = 'Revisa el correo: parece incompleto.';
    else if (!D.reg_esc || (t.escIds || []).indexOf(D.reg_esc) < 0) msg = 'Elige una de las escuderías.';
    if (msg) { UI.formErr = msg; render(); return; }
    UI.enviando = true; UI.formErr = ''; render();
    const r = await sb.rpc('registrar_persona', { p_nombre: nom, p_institucion: ins, p_correo: mail, p_esc_id: D.reg_esc });
    UI.enviando = false;
    if (r.error) { UI.formErr = GP.errMsg(r.error); render(); return; }
    UI.done = r.data; UI.step = 'listo'; render();
  },
  otra() { UI.step = 'buscar'; UI.done = null; UI.res = null; UI.formErr = ''; D.reg_q = ''; D.reg_nom = D.reg_ins = D.reg_mail = ''; D.reg_esc = null; render(); }
};
function bind(root) {
  root.addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b || !root.contains(b) || b.disabled) return;
    const fn = ACT[b.dataset.act];
    if (fn) { ev.preventDefault(); Promise.resolve().then(() => fn(b.dataset, b)).catch(e => console.error(e)); }
  });
  root.addEventListener('submit', ev => { ev.preventDefault(); });
  root.addEventListener('input', ev => {
    const t = ev.target;
    if (!t.dataset || !t.dataset.d) return;
    D[t.dataset.d] = t.value;
    if (t.dataset.d === 'reg_q') buscar();
  });
  root.addEventListener('change', ev => {
    const t = ev.target;
    if (t.dataset && t.dataset.d) { D[t.dataset.d] = t.value; if (t.dataset.d === 'reg_esc') render(); }
  });
}
async function boot() {
  U.iniciarTema();
  appEl = document.getElementById('app');
  const c = GP.conectar();
  if (c.error) { GP.mensajeConfig(appEl, c.error); return; }
  sb = c.sb;
  A = GP.crearAlmacen(sb, { sondeo: 4000 });
  S = A.S; L = GP.logica(S);
  window.__GP_TEST__ = { S, A, L, UI, D, ACT };
  A.alCambiar(render);
  bind(appEl);
  UI.ready = true; render();
  await A.iniciar();
  if (!S.turno || !S.config) { UI.err = 'No encontré la configuración del evento. Avisa al organizador.'; render(); return; }
  render();
}
boot();
})();
