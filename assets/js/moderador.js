/* =====================================================================
   Gran Premio Sage | Página del MODERADOR (privada, en tu computador)
   Inicia sesión con tu cuenta de Supabase y controla todo el evento.
   ===================================================================== */
(function () {
'use strict';
const GP = window.GP, U = GP.U, esc = U.esc, sty = GP.sty;
const DATOS = window.GP_DATOS, LOGOS = window.GP_LOGOS, LR = DATOS.LR, RECURSOS = DATOS.RECURSOS, NOMBRES_ESC = DATOS.NOMBRES_ESC;
const FASES = ['escuderias', 'registro', 'preguntas', 'pista', 'resultado'];
const STEP_TXT = ['Escuderías', 'Registro', 'Preguntas', 'Pista', 'Resultado'];
const LET = GP.RESPUESTA_LETRAS;
const UI = { ready: false, user: null, err: '', showBoard: false, sett: false, setTab: 'evento', pend: null, modReg: false, equipos: false, finConfirm: false, key: null, dirPrev: null, qEdit: null, busy: '', dirN: null, dirList: null, qStart: Date.now(), qKey: '', loginErr: '' };
const D = {};
let A = null, S = null, L = null, sb = null;
let board = null, mode = '', raceH = null, raceKey = '', pistaBoard = null;
let appEl, rt = null;

const tur = () => L.tur(), cfg = () => L.cfg(), escT = () => L.escT();
const toast = U.toast;
const clone = U.clone;

/* ---------- utilidades de la página ---------- */
function render() { if (rt) return; rt = setTimeout(() => { rt = null; try { doRender(); } catch (e) { console.error(e); toast('Algo falló al dibujar: ' + (e && e.message ? e.message : e)); } }, 0); }
function nombresUsados() { return new Set(Object.values(S.escuderias).map(e => U.norm(e.nombre))); }
function sugerirNombres() {
  const used = nombresUsados();
  let pool = U.shuffle(NOMBRES_ESC.filter(n => !used.has(U.norm(n))));
  if (pool.length < 2) pool = U.shuffle(NOMBRES_ESC);
  return [pool[0], pool[1]];
}
function iniciarBorradorEsc() {
  const n = tur().n, ids = ['t' + n + '-a', 't' + n + '-b'], sug = sugerirNombres();
  [0, 1].forEach(i => {
    const ex = S.escuderias[ids[i]];
    if (D['en' + i] === undefined) D['en' + i] = ex ? ex.nombre : sug[i];
    if (D['ec' + i] === undefined) D['ec' + i] = ex ? ex.color : LR[(n * 3 + i * 5) % LR.length].id;
  });
  if (D.ec0 === D.ec1) D.ec1 = LR[(LR.findIndex(c => c.id === D.ec0) + 5) % LR.length].id;
}
function elegirPreguntas() {
  const rs = U.shuffle(['journals', 'books', 'srm']);
  return rs.map(r => {
    const pool = Object.values(S.preguntas).filter(q => q.recurso === r);
    if (!pool.length) return null;
    const min = Math.min.apply(null, pool.map(q => q.usos || 0));
    const cand = pool.filter(q => (q.usos || 0) === min);
    return cand[Math.floor(Math.random() * cand.length)].id;
  }).filter(Boolean);
}
const nombreEsc = id => (S.escuderias[id] ? S.escuderias[id].nombre : id);
const otraEsc = (escs, id) => escs.find(e => e.id !== id);

/* ---------- clave de administrador ---------- */
function pedirClave(texto) {
  return new Promise(res => { UI.key = { texto, err: '', res }; D.clave = ''; render(); setTimeout(() => { const i = document.getElementById('f_clave'); if (i) i.focus(); }, 60); });
}
function keyHTML() {
  if (!UI.key) return '';
  return '<div class="mdl" role="dialog" aria-modal="true" aria-label="Clave de administrador"><div class="box pnl"><h3>Clave de administrador</h3><p>' + esc(UI.key.texto) + '</p>' +
    '<div class="field"><label for="f_clave">Clave</label><input id="f_clave" type="password" data-d="clave" autocomplete="off" value="' + esc(D.clave || '') + '"></div>' +
    (UI.key.err ? '<div class="warnbox">' + esc(UI.key.err) + '</div>' : '') +
    '<div class="row"><button class="btn" data-act="keyOk">Confirmar</button><button class="btn ghost" data-act="keyCancel">Cancelar</button></div></div></div>';
}

/* ---------- acciones ---------- */
const ACT = {
  /* sesión */
  async login() {
    const email = String(D.lemail || '').trim(), pw = String(D.lpass || '');
    if (!email || !pw) { UI.loginErr = 'Escribe tu correo y tu contraseña.'; render(); return; }
    UI.loginErr = ''; UI.busy = 'Entrando…'; render();
    const r = await sb.auth.signInWithPassword({ email, password: pw });
    UI.busy = '';
    if (r.error) { UI.loginErr = 'Correo o contraseña incorrectos.'; render(); return; }
    D.lpass = '';
    await entrar(r.data.session);
  },
  async salir() { await sb.auth.signOut(); location.reload(); },
  /* navegación */
  tablero() { UI.showBoard = !UI.showBoard; render(); },
  ajustes() { UI.sett = true; UI.pend = null; render(); },
  cerrarAjustes() { UI.sett = false; UI.pend = null; UI.qEdit = null; render(); },
  setTab(d) { UI.setTab = d.v; UI.pend = null; if (d.v === 'dir') dirContar(); render(); },
  ask(d) { UI.pend = d.k; render(); },
  cancel() { UI.pend = null; render(); },
  /* clave */
  async keyOk() {
    const k = UI.key; if (!k) return;
    const clave = String(D.clave || '');
    const r = await A.rpc('verificar_clave_admin', { p_clave: clave });
    if (r.error || r.data !== true) { k.err = 'La clave no es correcta.'; render(); return; }
    UI.key = null; D.clave = ''; render(); k.res(clave);
  },
  keyCancel() { if (UI.key) { const r = UI.key.res; UI.key = null; D.clave = ''; render(); r(null); } },
  /* escuderías */
  sugerir() { const s = sugerirNombres(); D.en0 = s[0]; D.en1 = s[1]; render(); },
  color(d) {
    const i = Number(d.i), o = 1 - i;
    if (D['ec' + o] === d.c) { toast('Esa escudería ya usa ese color.'); return; }
    D['ec' + i] = d.c; render();
  },
  async abrirRegistro() {
    const t = tur(), n = t.n, ids = ['t' + n + '-a', 't' + n + '-b'];
    const nom = [String(D.en0 || '').trim(), String(D.en1 || '').trim()];
    if (nom[0].length < 2 || nom[1].length < 2) { toast('Escribe el nombre de las dos escuderías.'); return; }
    if (U.norm(nom[0]) === U.norm(nom[1])) { toast('Los nombres deben ser distintos.'); return; }
    const filas = ids.map((id, i) => {
      const prev = S.escuderias[id] || { id, turno: n, resp: {}, cerrada: false, ts: Date.now() + i };
      return Object.assign({}, prev, { nombre: nom[i], color: D['ec' + i], orden: i });
    });
    const ok = await A.ponerVarios('escuderias', filas);
    if (!ok) return;
    await A.parchar('turno', null, { fase: 'registro', escIds: ids });
  },
  atrasRegistro() { A.parchar('turno', null, { fase: 'escuderias' }); },
  /* registro asistido */
  async modReg() {
    UI.modReg = true; D.mod_nom = D.mod_ins = D.mod_mail = ''; D.mod_esc = null; render();
    if (!UI.dirList) { const r = await sb.from('directorio').select('*').order('nombre'); if (!r.error) { UI.dirList = r.data || []; render(); } }
  },
  modCerrar() { UI.modReg = false; render(); },
  modEsc(d) { D.mod_esc = d.esc; render(); },
  async modGuardar() {
    const t = tur(), nom = String(D.mod_nom || '').trim(), ins = String(D.mod_ins || '').trim(), mail = String(D.mod_mail || '').trim();
    if (nom.length < 3) { toast('Escribe el nombre completo.'); return; }
    if (ins.length < 2) { toast('Escribe la institución.'); return; }
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { toast('Revisa el correo: parece incompleto.'); return; }
    if (!D.mod_esc || (t.escIds || []).indexOf(D.mod_esc) < 0) { toast('Elige la escudería.'); return; }
    const ex = Object.values(S.inscripciones).find(v => v.turno === t.n && U.norm(v.nombre) === U.norm(nom) && U.norm(v.institucion) === U.norm(ins));
    const id = ex ? ex.id : U.uuid();
    if (ex) await A.parchar('inscripciones', id, { esc: D.mod_esc });
    else await A.insertar('inscripciones', { id, turno: t.n, esc: D.mod_esc, nombre: nom, institucion: ins, origen: 'moderador', ts: Date.now() });
    if (mail) await A.escribirLibre('contactos', () => sb.from('contactos').upsert({ inscripcion_id: id, correo: mail }, { onConflict: 'inscripcion_id' }));
    UI.modReg = false; toast('Persona registrada.'); render();
  },
  equipos() { UI.equipos = true; render(); },
  cerrarEquipos() { UI.equipos = false; render(); },
  async mover(d) {
    const ins = S.inscripciones[d.id]; if (!ins) return;
    let clave = null;
    if (ins.turno !== tur().n) {
      clave = await pedirClave('Esta persona es de un turno anterior. Para moverla se necesita la clave de administrador.');
      if (!clave) return;
    }
    const antes = ins.esc;
    S.inscripciones[d.id] = Object.assign({}, ins, { esc: d.to }); render();
    const r = await A.rpc('mover_inscripcion', { p_id: d.id, p_esc_id: d.to, p_clave: clave });
    if (r.error) { S.inscripciones[d.id] = Object.assign({}, ins, { esc: antes }); toast(GP.errMsg(r.error)); render(); }
    else { toast('Movida a ' + nombreEsc(d.to) + '.'); A.refrescar('inscripciones'); }
  },
  async quitar(d) {
    const ins = S.inscripciones[d.id]; if (!ins) return;
    if (ins.turno !== tur().n) {
      const clave = await pedirClave('Quitar a una persona de un turno anterior requiere la clave de administrador.');
      if (!clave) return;
    }
    await A.borrar('inscripciones', d.id); toast('Persona quitada del registro.');
  },
  /* preguntas */
  async comenzarPreg() {
    const t = tur();
    let qs = t.qs || [];
    if (!qs.length) {
      qs = elegirPreguntas();
      if (!qs.length) { toast('El banco no tiene preguntas.'); return; }
      qs.forEach(id => { const q = S.preguntas[id]; A.parchar('preguntas', id, { usos: (q.usos || 0) + 1 }); });
      await Promise.all(escT().map(e => A.parchar('escuderias', e.id, { resp: {} })));
    }
    UI.qKey = '';
    await A.parchar('turno', null, { fase: 'preguntas', qs, qi: 0, rev: false, reveal: null, pregunta: GP.preguntaPublica(S.preguntas[qs[0]]), qInicio: new Date().toISOString() });
  },
  resp(d) {
    const t = tur(); if (t.rev) return;
    const q = S.preguntas[t.qs[t.qi]], e = S.escuderias[d.esc]; if (!q || !e) return;
    const resp = clone(e.resp || {});
    resp[t.qi] = { op: Number(d.op) };
    A.parchar('escuderias', e.id, { resp });
  },
  async revelar() {
    const t = tur(), q = S.preguntas[t.qs[t.qi]], escs = escT();
    if (!escs.every(e => e.resp && e.resp[t.qi])) { toast('Marca la respuesta de las dos escuderías.'); return; }
    await Promise.all(escs.map(e => {
      const resp = clone(e.resp), op = resp[t.qi].op;
      resp[t.qi] = { op, ok: op >= 0 && op === q.correcta };
      return A.parchar('escuderias', e.id, { resp });
    }));
    await A.parchar('turno', null, { rev: true, reveal: { correcta: q.correcta, dato: q.dato || '' } });
  },
  async siguiente() {
    const t = tur();
    UI.qKey = '';
    if (t.qi < t.qs.length - 1) {
      const q = S.preguntas[t.qs[t.qi + 1]];
      await A.parchar('turno', null, { qi: t.qi + 1, rev: false, reveal: null, pregunta: GP.preguntaPublica(q), qInicio: new Date().toISOString() });
    } else await A.parchar('turno', null, { fase: 'pista', pregunta: null, reveal: null });
  },
  async atrasPreg() {
    const t = tur();
    UI.qKey = '';
    if (t.rev) {
      await Promise.all(escT().map(e => {
        const resp = clone(e.resp || {}); if (resp[t.qi]) resp[t.qi] = { op: resp[t.qi].op };
        return A.parchar('escuderias', e.id, { resp });
      }));
      await A.parchar('turno', null, { rev: false, reveal: null });
    } else if (t.qi > 0) {
      const q = S.preguntas[t.qs[t.qi - 1]];
      await A.parchar('turno', null, { qi: t.qi - 1, rev: false, reveal: null, pregunta: GP.preguntaPublica(q), qInicio: new Date().toISOString() });
    } else await A.parchar('turno', null, { fase: 'registro', pregunta: null, reveal: null });
  },
  async atrasPista() {
    const t = tur(), qi = Math.max(0, (t.qs || []).length - 1), q = S.preguntas[t.qs[qi]];
    UI.qKey = '';
    await A.parchar('turno', null, { fase: 'preguntas', qi, rev: true, pregunta: q ? GP.preguntaPublica(q) : null, reveal: q ? { correcta: q.correcta, dato: q.dato || '' } : null });
  },
  /* pista */
  guardarVuelta(d) {
    const id = d.esc, p = U.parseLap(D['lap_' + id]);
    if (!p.d) return;
    if (!p.ok) { toast('Revisa el tiempo: los segundos van de 00 a 59.'); return; }
    if (L.vueltasDe(id).length >= L.maxV()) { toast('Ya completó las ' + L.maxV() + ' vueltas.'); return; }
    A.insertar('vueltas', { id: U.uuid(), turno: tur().n, esc: id, cs: p.cs, ts: Date.now() });
    D['lap_' + id] = ''; render();
  },
  borrarVuelta(d) { A.borrar('vueltas', d.id); },
  async cerrarClas() {
    const escs = escT();
    if (!escs.some(e => L.vueltasDe(e.id).length)) { toast('Registra al menos una vuelta.'); return; }
    await Promise.all(escs.map(e => A.parchar('escuderias', e.id, L.resumenCierre(e))));
    UI.showBoard = false;
    await A.parchar('turno', null, { fase: 'resultado' });
  },
  async reabrir() { await Promise.all(escT().map(e => A.parchar('escuderias', e.id, { cerrada: false, final: null }))); await A.parchar('turno', null, { fase: 'pista' }); },
  async cerrarTurno() {
    UI.pend = null; UI.showBoard = false; UI.qKey = '';
    ['en0', 'en1', 'ec0', 'ec1'].forEach(k => { delete D[k]; });
    await A.parchar('turno', null, { n: tur().n + 1, fase: 'escuderias', escIds: [], qs: [], qi: 0, rev: false, pregunta: null, reveal: null });
    toast('Turno cerrado. Crea las escuderías del siguiente grupo.');
  },
  /* final de toda la competencia */
  finAsk() { UI.finConfirm = true; render(); setTimeout(() => { const b = document.getElementById('fin-no'); if (b) b.focus(); }, 60); },
  finNo() { UI.finConfirm = false; render(); },
  async finSi() {
    UI.finConfirm = false; UI.showBoard = false; UI.sett = false; UI.equipos = false;
    await A.parchar('turno', null, { fase: 'final', anim: tur().anim + 1, pregunta: null, reveal: null });
  },
  repetir() { A.parchar('turno', null, { anim: tur().anim + 1 }); },
  async reanudar() {
    const cur = escT(), t = tur();
    UI.qKey = '';
    if (cur.length && cur.every(e => e.cerrada)) {
      ['en0', 'en1', 'ec0', 'ec1'].forEach(k => { delete D[k]; });
      await A.parchar('turno', null, { n: t.n + 1, fase: 'escuderias', escIds: [], qs: [], qi: 0, rev: false, pregunta: null, reveal: null });
    } else await A.parchar('turno', null, { fase: cur.length ? 'resultado' : 'escuderias' });
    toast('Competencia reanudada.');
  },
  /* ajustes */
  csv(d) { exportCsv(d.k); },
  addInst() {
    const lines = String(D.instpaste || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const have = new Set(L.instituciones().map(U.norm)), ex = (cfg().institucionesExtra || []).slice();
    lines.forEach(l => { if (!have.has(U.norm(l))) { ex.push(l); have.add(U.norm(l)); } });
    A.parchar('config', null, { institucionesExtra: ex }); D.instpaste = ''; toast('Instituciones actualizadas.');
  },
  dirPreview() { const rows = U.parseDir(D.dirpaste || ''); UI.dirPrev = rows; render(); if (!rows.length) toast('No encontré filas con nombre.'); },
  dirReemplazar() { dirGuardar(UI.dirPrev || U.parseDir(D.dirpaste || ''), true); },
  dirAgregar() { dirGuardar(UI.dirPrev || U.parseDir(D.dirpaste || ''), false); },
  async dirVaciar() { UI.pend = null; await dirGuardar([], true); },
  usarEnlace() { const url = new URL('registro.html', location.href).href; A.parchar('config', null, { enlaceRegistro: url }); toast('Enlace de registro actualizado.'); },
  qnew() { UI.qEdit = { id: null, recurso: 'journals', opciones: [], correcta: 0 }; Object.keys(D).filter(k => k.indexOf('qe_') === 0).forEach(k => delete D[k]); render(); },
  qedit(d) { UI.qEdit = clone(S.preguntas[d.id]); Object.keys(D).filter(k => k.indexOf('qe_') === 0).forEach(k => delete D[k]); render(); },
  qcancel() { UI.qEdit = null; render(); },
  qsave() {
    const q = UI.qEdit, g = (k, d) => (D['qe_' + k] != null ? D['qe_' + k] : d);
    const texto = String(g('texto', q.texto || '')).trim();
    const ops = String(g('opciones', (q.opciones || []).join('\n'))).split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const cor = parseInt(g('correcta', (q.correcta != null ? q.correcta + 1 : 1)), 10) - 1;
    if (!texto) { toast('Escribe la pregunta.'); return; }
    if (ops.length < 2 || ops.length > 6 || !(cor >= 0 && cor < ops.length)) { toast('Necesita de 2 a 6 opciones y la correcta dentro de ellas.'); return; }
    const id = q.id || ('q-' + U.uuid().slice(0, 8));
    A.poner('preguntas', { id, recurso: g('recurso', q.recurso), modulo: String(g('modulo', q.modulo || '')).trim(), texto, opciones: ops, correcta: cor, dato: String(g('dato', q.dato || '')).trim(), usos: (S.preguntas[id] && S.preguntas[id].usos) || 0 });
    UI.qEdit = null; toast('Pregunta guardada.');
  },
  qdel(d) { UI.pend = null; A.borrar('preguntas', d.id); toast('Pregunta eliminada.'); },
  async reiniciar() {
    UI.pend = null;
    const clave = await pedirClave('Reiniciar borra registros, escuderías y vueltas. Escribe la clave de administrador para continuar.');
    if (!clave) return;
    const r = await A.rpc('reiniciar_evento', { p_clave: clave });
    if (r.error) { toast(GP.errMsg(r.error)); return; }
    ['en0', 'en1', 'ec0', 'ec1'].forEach(k => { delete D[k]; });
    UI.showBoard = false; UI.sett = false; UI.qKey = '';
    await A.refrescarTodo(); toast('Evento reiniciado. El directorio y las preguntas se conservan.');
  }
};

async function dirContar() {
  const r = await sb.from('directorio').select('id', { count: 'exact', head: true });
  if (!r.error) { UI.dirN = r.count; render(); }
}
async function dirGuardar(rows, reemplazar) {
  if (!rows.length && !reemplazar) { toast('No hay filas para agregar.'); return; }
  UI.busy = 'Guardando el directorio…'; render();
  try {
    let seen = new Set();
    if (reemplazar) { const r = await sb.from('directorio').delete().not('id', 'is', null); if (r.error) throw r.error; }
    else { const r = await sb.from('directorio').select('*'); if (r.error) throw r.error; (r.data || []).forEach(x => seen.add(x.busqueda)); }
    const nuevas = rows.map(x => ({ nombre: x.nombre, institucion: x.institucion, correo: x.correo || '', busqueda: U.norm(x.nombre + ' ' + x.institucion) }))
      .filter(x => { if (seen.has(x.busqueda)) return false; seen.add(x.busqueda); return true; });
    for (let i = 0; i < nuevas.length; i += 400) { const r = await sb.from('directorio').insert(nuevas.slice(i, i + 400)); if (r.error) throw r.error; }
    UI.dirPrev = null; D.dirpaste = ''; UI.dirList = null;
    toast(nuevas.length ? nuevas.length + ' personas agregadas al directorio.' : 'Directorio actualizado.');
  } catch (e) { console.error(e); toast('No se pudo guardar el directorio: ' + (e && e.message ? e.message : 'error de conexión')); }
  UI.busy = ''; await dirContar(); render();
}
async function exportCsv(k) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (k === 'inscripciones') {
    const r = await sb.from('contactos').select('*'); const mail = {}; (r.data || []).forEach(c => { mail[c.inscripcion_id] = c.correo; });
    const rows = [['Turno', 'Escudería', 'Nombre', 'Institución', 'Correo', 'Origen', 'Hora']].concat(Object.values(S.inscripciones).sort((a, b) => a.turno - b.turno || a.ts - b.ts).map(v => [v.turno, nombreEsc(v.esc), v.nombre, v.institucion, mail[v.id] || '', v.origen, new Date(v.ts).toLocaleString('es-CO')]));
    U.descargar('gran-premio-sage-registro-' + stamp + '.csv', U.csv(rows));
  } else {
    const rk = L.ranking(), pos = {}; rk.forEach(r => { pos[r.e.id] = r.pos; });
    const rows = [['Turno', 'Escudería', 'Color LR', 'Aciertos', 'Ajuste (s)', 'Mejor vuelta', 'Tiempo final', 'Vueltas', 'Posición general', 'Tiempos de las vueltas']]
      .concat(Object.values(S.escuderias).sort((a, b) => a.turno - b.turno || (a.orden || 0) - (b.orden || 0)).map(e => [e.turno, e.nombre, L.lrOf(e.color).nombre, L.aciertos(e), ((e.cerrada ? e.ajuste : L.adjCs(e)) / 100).toFixed(1).replace('.', ','), U.fmtCs(e.cerrada ? e.mejor : L.mejorCs(e.id)), e.cerrada ? U.fmtCs(e.final) : '', L.vueltasDe(e.id).length, pos[e.id] || '', L.vueltasDe(e.id).map(v => U.fmtCs(v.cs)).join(' / ')]));
    U.descargar('gran-premio-sage-resultados-' + stamp + '.csv', U.csv(rows));
  }
}

/* ---------- piezas de pantalla ---------- */
const logoCl = '<img class="lg" src="' + LOGOS.sageWhite + '" alt="Sage">';
function field(key, label, type, extra) {
  return '<div class="field"><label for="f_' + key + '">' + label + '</label><input id="f_' + key + '" type="' + (type || 'text') + '" data-d="' + key + '" value="' + esc(D[key] || '') + '" autocomplete="off" ' + (extra || '') + '></div>';
}
function headerHTML() {
  const t = tur(), fi = t.fase === 'final' ? FASES.length : Math.max(0, FASES.indexOf(t.fase));
  const steps = '<div class="steps" aria-label="Avance del turno"><span class="st turn">Turno ' + t.n + '</span>' + STEP_TXT.map((s, i) => '<span class="st ' + (i === fi ? 'on' : i < fi ? 'done' : '') + '">' + s + '</span>').join('') + (t.fase === 'final' ? '<span class="st on">Final</span>' : '') + '</div>';
  const conn = '<span class="conn ' + (A.estado === 'en línea' ? '' : 'off') + '" title="Estado de la conexión"><i></i>' + esc(A.estado === 'en línea' ? 'En línea' : 'Sin conexión') + '</span>';
  const acts = '<div class="acts">' + conn + '<a class="btn ghost sm" href="pantalla.html" target="_blank" rel="noopener">Pantalla</a><button class="btn ghost sm" data-act="equipos">Equipos</button>' +
    (t.fase === 'final' ? '' : '<button class="btn ghost sm" data-act="tablero">' + (UI.showBoard && t.fase !== 'resultado' ? 'Volver al juego' : 'Tablero') + '</button>') + '<button class="btn ghost sm" data-act="ajustes">Ajustes</button></div>';
  return logoCl + '<div class="tt wide"><b>Gran <span class="hl">Premio</span> Sage</b>' + steps + '</div>' + acts;
}
function finBtn() {
  return '<button class="btn bad" data-act="finAsk">Finalizar toda la competencia</button>';
}
function escuderiasHTML() {
  iniciarBorradorEsc();
  const card = i => {
    const c = L.lrOf(D['ec' + i]);
    return '<section class="pnl team"' + sty(c.hex) + '><div class="lbl">Escudería ' + (i + 1) + U.SEP + (i ? 'Carro 2' : 'Carro 1') + '</div>' +
      '<input type="text" id="en' + i + '" data-d="en' + i + '" value="' + esc(D['en' + i]) + '" maxlength="28" autocomplete="off" aria-label="Nombre de la escudería ' + (i + 1) + '">' +
      '<div class="lbl">Color</div><div class="sws">' + LR.map(x => '<button class="sw ' + (D['ec' + i] === x.id ? 'on' : '') + (D['ec' + (1 - i)] === x.id ? ' taken' : '') + '" style="--c:' + x.hex + '" data-act="color" data-i="' + i + '" data-c="' + x.id + '" title="' + esc(x.nombre) + '" aria-label="' + esc(x.nombre) + '"></button>').join('') + '</div>' +
      '<div class="tpill"' + sty(c.hex) + '>' + esc(D['en' + i] || '…') + '</div></section>';
  };
  const aviso = !cfg().enlaceRegistro ? '<div class="warnbox">Falta el enlace de registro. Ábrelo en Ajustes y pulsa "Usar el enlace de este sitio".</div>' : '';
  return '<div class="qtop"><h2>Turno ' + tur().n + ': crea las dos escuderías</h2></div><p class="sub">Elige un nombre y un color de Learning Resources para cada una. Los directores solo verán estas dos al registrarse. La pantalla pública mientras tanto muestra la clasificación acumulada.</p>' + aviso +
    '<div class="setup">' + card(0) + card(1) + '</div>' +
    '<div class="foot">' + finBtn() + '<button class="btn ghost" data-act="sugerir">Sugerir otros nombres</button><span class="grow"></span><button class="btn lg" data-act="abrirRegistro">Abrir registro →</button></div>';
}
function eqCols(turnoN, escs) {
  return escs.map(e => {
    const m = L.miembros(e.id), otra = otraEsc(escs, e.id);
    return '<section class="pnl team"' + sty(L.colOf(e)) + '><div class="eqhead"><b>' + esc(e.nombre) + '</b><span class="muted">' + m.length + (m.length === 1 ? ' persona' : ' personas') + '</span></div><div class="mlist">' +
      (m.map(x => '<div class="mrow"><div class="who"><b>' + esc(x.nombre) + '</b><i>' + esc(x.institucion) + '</i></div><div class="mv">' +
        (otra ? '<button class="btn ghost sm" data-act="mover" data-id="' + esc(x.id) + '" data-to="' + esc(otra.id) + '" title="Pasarla a ' + esc(otra.nombre) + '">Pasar a ' + esc(otra.nombre) + '</button>' : '') +
        '<button class="btn bad sm" data-act="quitar" data-id="' + esc(x.id) + '" aria-label="Quitar a ' + esc(x.nombre) + '">Quitar</button></div></div>').join('') || '<div class="more muted">Aún no hay nadie en esta escudería.</div>') + '</div></section>';
  }).join('');
}
function registroHTML() {
  const c = cfg(), total = escT().reduce((a, e) => a + L.miembros(e.id).length, 0);
  return '<div class="qtop"><h2>Registro abierto</h2><span class="sub">' + total + (total === 1 ? ' persona registrada' : ' personas registradas') + '. En la pantalla pública está el QR.</span></div>' +
    '<div class="linkline">Enlace de registro: <b>' + esc(c.enlaceRegistro || 'sin definir (Ajustes)') + '</b></div>' +
    '<div class="eqgrid fill" style="overflow:auto">' + eqCols(tur().n, escT()) + '</div>' +
    '<div class="foot"><button class="btn sec" data-act="modReg">+ Registrar persona</button><span class="grow"></span><button class="btn ghost" data-act="atrasRegistro">← Cambiar escuderías</button><button class="btn lg" data-act="comenzarPreg">Comenzar preguntas →</button></div>';
}
function modRegHTML() {
  if (!UI.modReg) return '';
  const names = '<datalist id="dirnames">' + (UI.dirList || []).slice(0, 3000).map(x => '<option value="' + esc(x.nombre) + '"></option>').join('') + '</datalist><datalist id="instlist">' + L.instituciones().map(i => '<option value="' + esc(i) + '"></option>').join('') + '</datalist>';
  const opts = escT().map(e => '<button class="pick' + (D.mod_esc === e.id ? ' on' : '') + '"' + sty(L.colOf(e)) + ' data-act="modEsc" data-esc="' + esc(e.id) + '" aria-pressed="' + (D.mod_esc === e.id) + '">' + esc(e.nombre) + '</button>').join('');
  return '<div class="mdl" role="dialog" aria-modal="true" aria-label="Registrar persona"><div class="box pnl"><h3>Registrar persona</h3>' + names +
    field('mod_nom', 'Nombre completo', 'text', 'list="dirnames" data-fill="1"') + field('mod_ins', 'Institución', 'text', 'list="instlist"') + field('mod_mail', 'Correo (opcional)', 'email') +
    '<div class="lbl">Escudería</div><div class="row">' + opts + '</div>' +
    '<div class="row"><button class="btn" data-act="modGuardar">Agregar</button><button class="btn ghost" data-act="modCerrar">Cancelar</button></div></div></div>';
}
function equiposHTML() {
  if (!UI.equipos) return '';
  const t = tur(), turnos = {};
  Object.values(S.escuderias).forEach(e => { (turnos[e.turno] = turnos[e.turno] || []).push(e); });
  const nums = Object.keys(turnos).map(Number).sort((a, b) => b - a);
  const body = nums.length ? nums.map(n => {
    const escs = turnos[n].sort((a, b) => a.orden - b.orden);
    return '<div class="turnohdr">' + (n === t.n ? 'Turno actual (' + n + '): se mueve sin clave' : 'Turno ' + n + ': pide la clave de administrador') + '</div><div class="eqgrid">' + eqCols(n, escs) + '</div>';
  }).join('') : '<div class="muted">Todavía no hay escuderías.</div>';
  return '<div class="mdl" role="dialog" aria-modal="true" aria-label="Equipos"><div class="box pnl wide"><div class="row sp"><h3>Equipos y personas</h3><button class="btn" data-act="cerrarEquipos">Cerrar</button></div>' +
    '<p class="hintline">Si alguien quedó en la escudería equivocada, pásala a la otra. Los cambios se ven al instante en la pantalla pública.</p>' +
    (['registro', 'preguntas', 'pista'].indexOf(t.fase) >= 0 ? '<div><button class="btn sec sm" data-act="modReg">+ Registrar persona</button></div>' : '') + body + '</div></div>';
}
function preguntasHTML() {
  const t = tur(), q = S.preguntas[t.qs[t.qi]], escs = escT();
  if (!q) return '<div class="note">Cargando la pregunta…</div>';
  const nq = t.qs.length, long = q.texto.length > 150;
  const rem = Math.max(0, Number(cfg().radioSeg) - (Date.now() - UI.qStart) / 1000);
  const tots = escs.map(e => { const a = L.adjCs(e); return '<span class="tot"' + sty(L.colOf(e)) + '><i></i>' + esc(e.nombre) + ' <em class="' + (a < 0 ? 'neg' : a > 0 ? 'pos' : '') + '">' + U.fmtAdj(a) + '</em></span>'; }).join('');
  const opts = q.opciones.map((o, i) => {
    const right = t.rev && i === q.correcta;
    const picks = escs.map(e => {
      const r = e.resp && e.resp[t.qi], on = r && r.op === i;
      const cls = 'pick' + (on ? ' on' : '') + (t.rev && on ? (r.ok ? ' ok' : ' ko') : '');
      return '<button class="' + cls + '"' + sty(L.colOf(e)) + ' data-act="resp" data-esc="' + esc(e.id) + '" data-op="' + i + '"' + (t.rev ? ' disabled' : '') + ' aria-pressed="' + !!on + '" aria-label="' + esc(e.nombre) + ': opción ' + LET[i] + '">' + esc(e.nombre) + '</button>';
    }).join('');
    const clave = !t.rev && i === q.correcta ? '<span class="chip ok" title="Solo la ves tú">✓ Correcta</span>' : '';
    return '<div class="qo' + (right ? ' right' : t.rev ? ' dim' : '') + '"><span class="lt">' + LET[i] + '</span><span class="tx">' + esc(o) + (right ? ' ' + clave : '') + '</span><span class="pk">' + clave + picks + '</span></div>';
  }).join('');
  const lista = escs.every(e => e.resp && e.resp[t.qi]);
  const sinResp = t.rev ? '' : escs.map(e => '<button class="noans" data-act="resp" data-esc="' + esc(e.id) + '" data-op="-1">' + esc(e.nombre) + ': sin respuesta (cuenta como error)</button>').join(' ');
  const res = t.rev ? '<div class="row">' + escs.map(e => { const r = e.resp[t.qi]; return '<span class="tot"' + sty(L.colOf(e)) + '><i></i>' + esc(e.nombre) + ' <em class="' + (r.ok ? 'neg' : 'pos') + '">' + (r.ok ? 'acertó ' : 'falló ') + U.fmtAdj(r.ok ? -L.bonoCs() : L.bonoCs()) + '</em></span>'; }).join('') + '</div>' : '';
  const ult = t.qi >= nq - 1;
  return '<div class="qtop"><span class="qn">Pregunta ' + (t.qi + 1) + ' de ' + nq + '</span><span class="logochip">' + GP.recLogo(q.recurso) + '</span>' + (t.rev ? '' : '<span class="radio" data-radio>' + Math.ceil(rem) + '</span>') + '<div class="tots">' + tots + '</div></div>' +
    '<div class="qtext' + (long ? ' long' : '') + '">' + esc(q.texto) + '</div><div class="qopts">' + opts + '</div>' +
    (t.rev ? res + (q.dato ? '<div class="qdato"><b>Dato clave.</b> ' + esc(q.dato) + '</div>' : '') : '<div class="row">' + sinResp + '</div>') +
    '<div class="foot"><button class="btn ghost" data-act="atrasPreg">← ' + (t.rev ? 'Cambiar respuestas' : t.qi > 0 ? 'Pregunta anterior' : 'Volver al registro') + '</button><span class="grow"></span>' +
    (t.rev ? '<button class="btn lg" data-act="siguiente">' + (ult ? 'Ir a la pista →' : 'Siguiente pregunta →') + '</button>' : '<button class="btn lg" data-act="revelar"' + (lista ? '' : ' disabled') + '>Revelar respuesta</button>') + '</div>';
}
function pistaLanesHTML() { return escT().map(e => GP.lapPanelHTML(L, e, { entry: true, draft: D['lap_' + e.id] || '' })).join(''); }
function pistaFootHTML() {
  const escs = escT(), mx = L.maxV();
  const todas = escs.length && escs.every(e => L.vueltasDe(e.id).length >= mx), alguna = escs.some(e => L.vueltasDe(e.id).length);
  return '<button class="btn ghost" data-act="atrasPista">← Volver a las preguntas</button><span class="grow muted">' + (todas ? 'Las dos completaron sus vueltas.' : '') + '</span><button class="btn lg' + (todas ? ' acc' : '') + '" data-act="cerrarClas"' + (alguna ? '' : ' disabled') + '>Cerrar clasificación →</button>';
}
function resultadoFootHTML() {
  return '<button class="btn ghost" data-act="reabrir">← Reabrir pista</button>' + finBtn() + '<span class="grow"></span>' +
    (UI.pend === 'turno' ? '<button class="btn bad" data-act="cerrarTurno">Sí, cerrar turno</button><button class="btn ghost" data-act="cancel">No</button>' : '<button class="btn lg" data-act="ask" data-k="turno">Cerrar turno →</button>');
}
function finalFootHTML() {
  return '<button class="btn lg" data-act="repetir">↻ Repetir animación</button><span class="grow hintline">La pantalla pública muestra lo mismo.</span><button class="btn ghost" data-act="reanudar">Reanudar la competencia</button>';
}
function confirmFullHTML() {
  if (!UI.finConfirm) return '';
  const n = L.ranking().length;
  return '<div class="confirmfull" role="alertdialog" aria-modal="true" aria-labelledby="cfh"><div class="in"><img src="' + LOGOS.sageWhite + '" alt="Sage" style="height:48px"><h2 id="cfh">¿Finalizar toda la competencia?</h2>' +
    '<p>La pantalla pública pasará a la carrera final con ' + n + (n === 1 ? ' escudería' : ' escuderías') + ' y mostrará el podio con el ganador. Podrás repetir la animación o reanudar la competencia.</p>' +
    '<div class="btns"><button class="btn dang" data-act="finSi">Sí, finalizar toda la competencia</button><button class="btn ghost" id="fin-no" data-act="finNo">No, volver</button></div></div></div>';
}

/* ---------- ajustes ---------- */
function numField(path, label, val, step) { return '<div class="field"><label for="n_' + path + '">' + label + '</label><input id="n_' + path + '" type="number" step="' + (step || 1) + '" min="0" data-chg="cfg" data-path="' + path + '" data-num="1" value="' + esc(val) + '"></div>'; }
function confirmBtn(key, label, act, data, cls) {
  const attrs = Object.keys(data || {}).map(k => ' data-' + k + '="' + esc(data[k]) + '"').join('');
  if (UI.pend === key) return '<span class="row"><button class="btn bad sm" data-act="' + act + '"' + attrs + '>Sí, confirmar</button><button class="btn ghost sm" data-act="cancel">No</button></span>';
  return '<button class="btn ' + (cls || 'ghost') + ' sm" data-act="ask" data-k="' + esc(key) + '">' + label + '</button>';
}
function settingsHTML() {
  const c = cfg();
  const TABS = [['evento', 'Evento y reglas'], ['dir', 'Directorio'], ['banco', 'Preguntas'], ['datos', 'Datos']];
  let b = '';
  if (UI.setTab === 'evento') {
    b = '<div class="cols"><section class="card"><h2>Evento</h2><div class="field"><label for="c_evento">Nombre del evento</label><input id="c_evento" type="text" data-chg="cfg" data-path="evento" value="' + esc(c.evento) + '"></div><p class="muted">Escribe una barra vertical (|) donde quieras el separador con la S de Sage.</p><div class="field"><label for="c_lugar">Lugar</label><input id="c_lugar" type="text" data-chg="cfg" data-path="lugar" value="' + esc(c.lugar) + '"></div>' +
      '<div class="field"><label for="c_enlace">Enlace de registro (el que lleva el QR)</label><input id="c_enlace" type="text" data-chg="cfg" data-path="enlaceRegistro" value="' + esc(c.enlaceRegistro) + '"></div><div class="row"><button class="btn sec sm" data-act="usarEnlace">Usar el enlace de este sitio</button></div><p class="muted">Debe terminar en registro.html. Es siempre el mismo enlace durante todo el evento.</p></section>' +
      '<section class="card"><h2>Reglas</h2><div class="grid2">' + numField('bono', 'Segundos por respuesta (±)', c.bono, .5) + numField('maxVueltas', 'Vueltas por escudería', c.maxVueltas) + numField('radioSeg', 'Segundos de la cuenta regresiva', c.radioSeg) + '</div><p class="muted">Cada acierto resta y cada error suma esos segundos a la mejor vuelta de la escudería.</p></section></div>';
  } else if (UI.setTab === 'dir') {
    const prev = UI.dirPrev;
    b = '<div class="cols"><section class="card"><h2>Directorio de asistentes' + (UI.dirN != null ? ' (' + UI.dirN + ')' : '') + '</h2><p>Con esta lista los directores se buscan por nombre y sus datos se cargan solos. Pega una persona por línea: <b>Nombre; Institución; Correo</b> (el correo es opcional). Desde Excel puedes copiar y pegar las columnas tal cual.</p>' +
      '<textarea id="f_dirpaste" data-d="dirpaste" style="min-height:160px" placeholder="Ana Pérez&#9;Universidad del Norte&#9;ana@correo.com">' + esc(D.dirpaste || '') + '</textarea>' +
      '<div class="row"><input type="file" id="dirfile" accept=".csv,.txt,text/csv,text/plain" data-chg="dirfile"></div>' +
      '<div class="row"><button class="btn sec" data-act="dirPreview">Revisar lista</button>' + (prev ? '<button class="btn" data-act="dirAgregar">Agregar ' + prev.length + '</button><button class="btn ghost" data-act="dirReemplazar">Reemplazar todo con ' + prev.length + '</button>' : '') + '</div>' +
      (prev ? '<div class="note"><strong>' + prev.length + ' personas detectadas.</strong> Primeras: ' + prev.slice(0, 3).map(x => esc(x.nombre) + (x.institucion ? ' (' + esc(x.institucion) + ')' : '')).join('; ') + '</div>' : '') + '</section>' +
      '<section class="card"><h2>Instituciones</h2><p class="muted">' + DATOS.INSTITUCIONES_BASE.length + ' instituciones precargadas' + ((c.institucionesExtra || []).length ? ' y ' + c.institucionesExtra.length + ' agregadas' : '') + '. Se usan para escribir la institución cuando alguien no está en el directorio.</p><textarea id="f_instpaste" data-d="instpaste" placeholder="Universidad de Ejemplo">' + esc(D.instpaste || '') + '</textarea><button class="btn sec" data-act="addInst">Agregar instituciones</button>' +
      '<div>' + confirmBtn('dirvaciar', 'Vaciar directorio', 'dirVaciar', {}, 'bad') + '</div></section></div>';
  } else if (UI.setTab === 'banco') {
    const qs = Object.values(S.preguntas);
    b = '<section class="card"><div class="row sp"><h2>Banco de preguntas (' + qs.length + ')</h2><div class="row"><button class="btn" data-act="qnew">Agregar pregunta</button></div></div>' +
      '<div class="note">Todas son cerradas. Premier y Research Methods salen de los folletos 2026. Reference &amp; Academic Books se basa en la descripción pública del producto: conviene validarlas con el catálogo vigente.</div>' + (UI.qEdit ? qEditor() : '');
    Object.keys(RECURSOS).forEach(r => {
      const list = qs.filter(q => q.recurso === r).sort((a, z) => (a.id < z.id ? -1 : 1));
      b += '<div class="stack"><div class="row"><span class="logochip" style="background:#fff;padding:8px 12px;display:inline-flex">' + (LOGOS[r] ? '<img src="' + LOGOS[r] + '" alt="" style="height:22px">' : '') + '</span><span class="muted">' + list.length + ' preguntas</span></div><ul class="list">' +
        list.map(q => '<li><div class="grow">' + esc(q.texto) + '</div><span class="muted num">usos ' + (q.usos || 0) + '</span><button class="btn ghost sm" data-act="qedit" data-id="' + esc(q.id) + '">Editar</button>' + confirmBtn('qdel' + q.id, 'Eliminar', 'qdel', { id: q.id }, 'ghost') + '</li>').join('') + '</ul></div>';
    });
    b += '</section>';
  } else {
    b = '<div class="cols"><section class="card"><h2>Datos del evento</h2><p class="muted">' + Object.keys(S.inscripciones).length + ' registros, ' + Object.keys(S.escuderias).length + ' escuderías, ' + Object.keys(S.vueltas).length + ' vueltas, turno ' + tur().n + '.</p><div class="row"><button class="btn sec" data-act="csv" data-k="inscripciones">Exportar registro (CSV)</button><button class="btn sec" data-act="csv" data-k="resultados">Exportar resultados (CSV)</button></div></section>' +
      '<section class="card"><h2>Reiniciar</h2><div class="warnbox">Reiniciar borra registros, escuderías y vueltas, y vuelve al turno 1. El directorio y las preguntas se conservan. Pide la clave de administrador. Exporta antes los datos que necesites.</div><div><button class="btn bad sm" data-act="reiniciar">Reiniciar el evento</button></div></section>' +
      '<section class="card"><h2>Sesión</h2><p class="muted">Sesión iniciada como ' + esc((UI.user && UI.user.email) || '') + '.</p><div><button class="btn ghost sm" data-act="salir">Cerrar sesión</button></div></section></div>';
  }
  return '<div class="app"><div class="row sp" style="padding:12px 0"><div class="brand"><img class="lg-light" src="' + LOGOS.sageNavy + '" alt="Sage" style="height:30px"><img class="lg-dark" src="' + LOGOS.sageWhite + '" alt="Sage" style="height:30px"></div><button class="btn" data-act="cerrarAjustes">Cerrar ajustes</button></div>' +
    '<nav class="tabs">' + TABS.map(t => '<button class="tab" data-act="setTab" data-v="' + t[0] + '" aria-selected="' + (UI.setTab === t[0]) + '">' + t[1] + '</button>').join('') + '</nav>' + b + '</div>';
}
function qEditor() {
  const q = UI.qEdit, v = (k, d) => (D['qe_' + k] != null ? D['qe_' + k] : d);
  return '<div class="card" style="background:var(--surface)"><h3>' + (q.id ? 'Editar pregunta' : 'Nueva pregunta') + '</h3><div class="grid2"><div class="field"><label for="qe_recurso">Recurso</label><select id="qe_recurso" data-d="qe_recurso">' + Object.keys(RECURSOS).map(r => '<option value="' + r + '"' + (v('recurso', q.recurso) === r ? ' selected' : '') + '>' + esc(RECURSOS[r].corto) + '</option>').join('') + '</select></div>' +
    '<div class="field"><label for="qe_modulo">Módulo o tema</label><input id="qe_modulo" type="text" data-d="qe_modulo" value="' + esc(v('modulo', q.modulo || '')) + '"></div></div>' +
    '<div class="field"><label for="qe_texto">Pregunta</label><textarea id="qe_texto" data-d="qe_texto">' + esc(v('texto', q.texto || '')) + '</textarea></div>' +
    '<div class="field"><label for="qe_opciones">Opciones (una por línea)</label><textarea id="qe_opciones" data-d="qe_opciones">' + esc(v('opciones', (q.opciones || []).join('\n'))) + '</textarea></div>' +
    '<div class="field"><label for="qe_correcta">Número de la opción correcta (1 = A)</label><input id="qe_correcta" type="number" min="1" max="6" data-d="qe_correcta" value="' + esc(v('correcta', q.correcta != null ? q.correcta + 1 : 1)) + '"></div>' +
    '<div class="field"><label for="qe_dato">Dato para explicar la respuesta</label><textarea id="qe_dato" data-d="qe_dato">' + esc(v('dato', q.dato || '')) + '</textarea></div>' +
    '<div class="row"><button class="btn acc" data-act="qsave">Guardar pregunta</button><button class="btn ghost" data-act="qcancel">Cancelar</button></div></div>';
}

/* ---------- pantallas de acceso ---------- */
function loginHTML() {
  return '<div class="login"><form class="box" id="loginform" autocomplete="on"><img src="' + LOGOS.sageWhite + '" alt="Sage" style="height:40px;align-self:flex-start"><h1>Gran <span class="hl">Premio</span> Sage</h1><p class="muted">Acceso del moderador</p>' +
    '<div class="field"><label for="f_lemail">Correo</label><input id="f_lemail" type="email" data-d="lemail" autocomplete="username" value="' + esc(D.lemail || '') + '"></div>' +
    '<div class="field"><label for="f_lpass">Contraseña</label><input id="f_lpass" type="password" data-d="lpass" autocomplete="current-password" value="' + esc(D.lpass || '') + '"></div>' +
    (UI.loginErr ? '<div class="warnbox" role="alert">' + esc(UI.loginErr) + '</div>' : '') +
    '<button class="btn lg acc" type="submit" data-act="login"' + (UI.busy ? ' disabled' : '') + '>' + (UI.busy ? esc(UI.busy) : 'Entrar') + '</button></form></div>';
}

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
  if (!UI.user) { U.patchInto(appEl, loginHTML()); appEl.__main = false; return; }
  if (!appEl.__main) { appEl.innerHTML = '<div class="stage" id="stage"><header class="sh" id="sh"></header><main class="sm" id="sm"></main></div><div id="mdl"></div><div id="ovl" hidden></div><div id="cfull"></div><div id="kmdl"></div>'; appEl.__main = true; mode = ''; }
  const t = tur(), f = t.fase, key = f + ':' + t.qi;
  if (key !== UI.qKey) { UI.qKey = key; UI.qStart = Date.now(); }
  U.patchInto(document.getElementById('sh'), headerHTML());
  const showBoard = f === 'resultado' || (UI.showBoard && f !== 'final');
  if (f === 'final') {
    const sm = setMode('final', '<div class="fill" id="fm"></div><div class="foot" id="ff"></div>');
    const k = String(t.anim) + ':' + L.ranking().length;
    if (raceKey !== k) { if (raceH) raceH.stop(); raceKey = k; raceH = GP.jugarFinal(document.getElementById('fm'), L, {}); }
    U.patchInto(document.getElementById('ff'), finalFootHTML());
  } else if (showBoard) {
    setMode('board', '<div class="fill" id="bm"></div><div class="foot" id="bf"></div>');
    if (!board) board = GP.crearTablero(document.getElementById('bm'), L, {});
    board.update();
    U.patchInto(document.getElementById('bf'), f === 'resultado' ? resultadoFootHTML() : '<button class="btn ghost" data-act="tablero">← Volver al juego</button>');
  } else if (f === 'pista') {
    setMode('pista', '<div class="qtop"><h2>En pista</h2><span class="sub" id="psub"></span></div><div class="lanes" id="lcol"></div><div class="foot" id="bf"></div>');
    document.getElementById('psub').textContent = 'Cada escudería corre hasta ' + L.maxV() + ' vueltas. Se toma su mejor vuelta y se le aplica el ajuste de las respuestas.';
    U.patchInto(document.getElementById('lcol'), pistaLanesHTML());
    U.patchInto(document.getElementById('bf'), pistaFootHTML());
  } else {
    const sm = setMode('html', '');
    U.patchInto(sm, f === 'escuderias' ? escuderiasHTML() : f === 'registro' ? registroHTML() : preguntasHTML());
  }
  U.patchInto(document.getElementById('mdl'), modRegHTML() + equiposHTML());
  U.patchInto(document.getElementById('kmdl'), keyHTML());
  U.patchInto(document.getElementById('cfull'), confirmFullHTML());
  const ovl = document.getElementById('ovl');
  if (UI.sett) { ovl.hidden = false; U.patchInto(ovl, '<div class="sett">' + settingsHTML() + '</div>'); }
  else { ovl.hidden = true; ovl.__last = ''; ovl.innerHTML = ''; }
  tick();
}
function tick() {
  document.querySelectorAll('[data-radio]').forEach(el => {
    const rem = Math.max(0, Number(cfg().radioSeg) - (Date.now() - UI.qStart) / 1000);
    const txt = String(Math.ceil(rem));
    if (el.textContent !== txt) el.textContent = txt;
    el.classList.toggle('low', rem <= 5);
  });
}

/* ---------- eventos ---------- */
const CHG = {
  cfg(el) {
    const k = el.dataset.path;
    A.parchar('config', null, { [k]: el.dataset.num ? (isNaN(parseFloat(el.value)) ? 0 : parseFloat(el.value)) : el.value });
  },
  dirfile(el) {
    const f = el.files && el.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { D.dirpaste = String(r.result || ''); UI.dirPrev = U.parseDir(D.dirpaste); render(); };
    r.readAsText(f);
  }
};
function bind(root) {
  root.addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b || !root.contains(b) || b.disabled) return;
    const fn = ACT[b.dataset.act];
    if (fn) { ev.preventDefault(); Promise.resolve().then(() => fn(b.dataset, b)).catch(e => { console.error(e); toast('Algo falló: ' + (e && e.message ? e.message : e)); }); }
  });
  root.addEventListener('submit', ev => { ev.preventDefault(); if (ev.target.id === 'loginform') ACT.login(); });
  root.addEventListener('input', ev => {
    const t = ev.target;
    if (!t.dataset) return;
    if (t.dataset.lap) { D['lap_' + t.dataset.lap] = t.value.replace(/\D/g, '').slice(0, 7); render(); return; }
    if (t.dataset.d) { D[t.dataset.d] = t.value; if (/^en[01]$/.test(t.dataset.d) || t.dataset.d === 'mod_nom') render(); }
  });
  root.addEventListener('change', ev => {
    const t = ev.target;
    if (!t.dataset) return;
    if (t.dataset.d) {
      D[t.dataset.d] = t.value;
      if (t.dataset.d === 'mod_nom') { const m = (UI.dirList || []).find(x => U.norm(x.nombre) === U.norm(t.value)); if (m) { D.mod_ins = m.institucion; D.mod_mail = m.correo || ''; render(); } }
    }
    if (t.dataset.chg && CHG[t.dataset.chg]) CHG[t.dataset.chg](t);
  });
  root.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.lap) { ev.preventDefault(); ACT.guardarVuelta({ esc: ev.target.dataset.lap }); }
    if (ev.key === 'Enter' && ev.target.id === 'f_clave') { ev.preventDefault(); ACT.keyOk(); }
  });
}

/* ---------- arranque ---------- */
async function entrar(session) {
  const r = await A_rpcEsMod();
  if (!r) {
    UI.loginErr = 'Esta cuenta no está autorizada como moderador. Revisa el archivo 02_moderador.sql de la guía.';
    await sb.auth.signOut(); UI.user = null; render(); return;
  }
  UI.user = session.user;
  A = GP.crearAlmacen(sb, { moderador: true, sondeo: 4000 });
  S = A.S; L = GP.logica(S);
  window.__GP_TEST__ = { S, D, UI, ACT, A, L };
  A.alCambiar(render);
  await A.iniciar();
  if (!S.turno || !S.config) { UI.err = 'No encontré la configuración del evento en la base de datos. Ejecuta el archivo 01_esquema.sql en Supabase (paso 1 de la guía).'; render(); return; }
  if (!S.config.enlaceRegistro) { try { await A.parchar('config', null, { enlaceRegistro: new URL('registro.html', location.href).href }); } catch (e) {} }
  document.title = 'Gran Premio Sage - Moderador';
  render();
}
async function A_rpcEsMod() {
  try { const r = await sb.rpc('es_moderador'); return !r.error && r.data === true; } catch (e) { return false; }
}
async function boot() {
  U.iniciarTema(); GP.instalarSprites();
  appEl = document.getElementById('app');
  appEl.classList.add('modapp');
  bind(appEl);
  window.addEventListener('resize', () => render());
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') {
      if (UI.key) ACT.keyCancel(); else if (UI.finConfirm) ACT.finNo(); else if (UI.modReg) ACT.modCerrar(); else if (UI.equipos) ACT.cerrarEquipos(); else if (UI.sett) ACT.cerrarAjustes();
    }
  });
  const c = GP.conectar();
  if (c.error) { GP.mensajeConfig(appEl, c.error); return; }
  sb = c.sb;
  const s = await sb.auth.getSession();
  UI.ready = true;
  if (s.data && s.data.session) await entrar(s.data.session); else render();
  setInterval(tick, 200);
}
boot();
})();
