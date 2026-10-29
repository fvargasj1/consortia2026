/* =====================================================================
   Gran Premio Sage | núcleo compartido por las tres páginas
   - utilidades (tiempos, texto, separador S)
   - conexión con Supabase y almacén de datos en tiempo real
   - lógica del juego (ajustes por respuesta, clasificación)
   ===================================================================== */
(function () {
'use strict';
const GP = (window.GP = window.GP || {});
const DATOS = window.GP_DATOS || {};
const LOGOS = window.GP_LOGOS || {};
const LR = DATOS.LR || [];

/* ---------- utilidades ---------- */
const U = (GP.U = {});
U.$ = (s, r) => (r || document).querySelector(s);
U.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
U.clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
U.norm = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
U.shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
U.uuid = () => {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); });
};
U.lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
U.lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

/* Separador: el símbolo S de Sage, pequeño y en un color distinto al del texto (nunca el punto medio) */
U.SEP = '<i class="ssep" aria-hidden="true"></i>';
U.txt = s => U.esc(s).replace(/\s*[|\u00b7]\s*/g, U.SEP);          // texto del usuario -> html con separador
U.sepJoin = parts => parts.filter(x => x !== '' && x != null).join(U.SEP); // partes ya en html
U.plano = s => String(s == null ? '' : s).replace(/\s*[|\u00b7]\s*/g, ' - ');
U.iniciarTema = () => {
  if (LOGOS.sSymbol) document.documentElement.style.setProperty('--s-symbol', 'url("' + LOGOS.sSymbol + '")');
};

/* Tiempos: se guardan en centésimas (entero). 2430 = 0:24.30 */
U.fmtCs = cs => {
  if (cs == null || isNaN(cs)) return '–';
  cs = Math.round(cs);
  const m = Math.floor(cs / 6000), r = cs % 6000, s = Math.floor(r / 100), c = r % 100;
  return m + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0');
};
U.fmtAdj = cs => (cs > 0 ? '+' : cs < 0 ? '−' : '±') + (Math.abs(cs) / 100).toFixed(1).replace('.', ',') + ' s';
/* "11025" -> 1:10.25 ; los dos últimos dígitos son centésimas, los dos anteriores segundos */
U.parseLap = raw => {
  const d = String(raw || '').replace(/\D/g, '').slice(0, 7);
  if (!d) return { d: '', cs: null, ok: false };
  const c = parseInt(d.slice(-2), 10);
  const s = d.length > 2 ? parseInt(d.slice(-4, -2), 10) : 0;
  const m = d.length > 4 ? parseInt(d.slice(0, -4), 10) : 0;
  const cs = m * 6000 + s * 100 + c;
  return { d, cs, ok: s < 60 && cs >= 100 };
};


/* Reemplaza el contenido de un elemento solo si cambió, conservando el foco y el cursor */
U.patchInto = (el, html) => {
  if (el.__last === html) return;
  const a = document.activeElement;
  let fid = null, fk = null, ss = null, se = null;
  if (a && el.contains(a)) { fid = a.id; fk = a.dataset && a.dataset.d; try { ss = a.selectionStart; se = a.selectionEnd; } catch (e) {} }
  const sy = el.scrollTop, wy = window.scrollY;
  el.__last = html; el.innerHTML = html;
  if (fid || fk) {
    const n = (fid && document.getElementById(fid)) || (fk && (el.querySelector('[data-d="' + fk + '"]:checked') || el.querySelector('[data-d="' + fk + '"]')));
    if (n && n.focus) { n.focus(); try { if (ss != null && n.setSelectionRange) n.setSelectionRange(ss, se); } catch (e) {} }
  }
  el.scrollTop = sy; window.scrollTo(0, wy);
};
/* Archivos descargables (CSV) */
U.csv = rows => '﻿' + rows.map(r => r.map(v => { v = v == null ? '' : String(v); return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';')).join('\r\n');
U.descargar = (nombre, texto) => {
  const b = new Blob([texto], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = nombre; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
};
/* Lista de asistentes: una persona por línea (Nombre; Institución; Correo). Acepta tabulador, ; | o coma */
U.parseDir = text => {
  const out = [];
  String(text || '').split(/\r?\n/).forEach(line => {
    line = line.trim(); if (!line) return;
    let p;
    if (/[\t;|]/.test(line)) p = line.split(/[\t;|]/).map(x => x.trim());
    else {
      const q = line.split(','), last = q[q.length - 1].trim();
      if (q.length >= 3 && (last === '' || /@/.test(last))) p = [q[0].trim(), q.slice(1, -1).join(',').trim(), last];
      else if (q.length >= 2) p = [q[0].trim(), q.slice(1).join(',').trim(), ''];
      else p = [q[0].trim(), '', ''];
    }
    if (!p[0]) return;
    if (/^nombre/i.test(p[0]) && /instituci/i.test(p[1] || '')) return;
    out.push({ nombre: p[0].slice(0, 120), institucion: (p[1] || '').slice(0, 160), correo: /@/.test(p[2] || '') ? p[2].slice(0, 160) : '' });
  });
  return out;
};
/* Mensajes claros para los errores de la base de datos */
GP.errMsg = e => {
  const m = String((e && (e.message || e)) || '');
  const t = {
    registro_cerrado: 'El registro está cerrado por ahora. Espera la indicación del moderador.',
    escuderia_invalida: 'Elige una de las escuderías.',
    nombre_invalido: 'Escribe tu nombre completo.',
    institucion_invalida: 'Elige o escribe tu institución.',
    correo_invalido: 'Revisa el correo: parece incompleto.',
    cupo_lleno: 'Se alcanzó el límite de personas de este turno. Avisa al moderador.',
    clave_invalida: 'La clave de administrador no es correcta.',
    no_autorizado: 'Esta cuenta no tiene permiso de moderador.',
    inscripcion_no_existe: 'Esa persona ya no está registrada.'
  };
  const k = Object.keys(t).find(x => m.indexOf(x) >= 0);
  return k ? t[k] : 'No se pudo completar. Revisa la conexión a internet e inténtalo de nuevo.';
};

let toastT = null;
U.toast = msg => {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3800);
};

/* Código QR (librería qrcode-generator, cargada desde la CDN) */
const qrCache = {};
U.qrSvg = url => {
  if (!url || !window.qrcode) return '';
  if (qrCache[url]) return qrCache[url];
  try {
    const q = window.qrcode(0, 'M'); q.addData(url); q.make();
    const n = q.getModuleCount(); let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + c + ' ' + r + 'h1v1h-1z';
    return (qrCache[url] = '<svg viewBox="-2 -2 ' + (n + 4) + ' ' + (n + 4) + '" shape-rendering="crispEdges" role="img" aria-label="Código QR del registro"><rect x="-2" y="-2" width="' + (n + 4) + '" height="' + (n + 4) + '" fill="#fff"/><path d="' + d + '" fill="#001A69"/></svg>');
  } catch (e) { return ''; }
};

GP.sty = hex => ' style="--c:' + hex + '"';

/* ---------- Buggy 4x4 (dibujo propio) ---------- */
GP.buggyHTML = () => '<svg class="buggy" viewBox="0 0 150 80" aria-hidden="true" focusable="false"><use href="#gp-buggy"></use></svg>';
GP.instalarSprites = () => {
  if (document.getElementById('gp-sprites')) return;
  const d = document.createElement('div');
  d.id = 'gp-sprites'; d.setAttribute('aria-hidden', 'true'); d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  d.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"><symbol id="gp-buggy" viewBox="0 0 150 80">' +
      /* amortiguadores */
      '<path d="M40 52 L46 36 M110 52 L104 36" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none"/>' +
      /* carrocería baja */
      '<path d="M26 44 C26 38 32 35 40 35 L62 33 L66 26 L84 26 L90 33 L112 35 C122 36 128 40 128 47 L128 53 L26 53 Z" style="fill:var(--c)" stroke="#001A69" stroke-width="2" stroke-linejoin="round"/>' +
      /* jaula antivuelco */
      '<path d="M50 35 L58 11 L92 11 L100 35 M58 11 L66 33 M92 11 L84 33" stroke="#fff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
      /* piloto con casco */
      '<circle cx="75" cy="21" r="7.5" fill="#fff"/><path d="M75 17.5 H83 A7.5 7.5 0 0 1 80 26 H75 Z" style="fill:var(--c)" opacity=".9"/>' +
      /* defensa delantera y faro */
      '<path d="M128 49 L140 51" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="125" cy="42" r="3" fill="#fff"/>' +
      /* ruedas con taco (llanta) */
      '<g><circle cx="38" cy="58" r="19" fill="#0A1030" stroke="#fff" stroke-width="3.2"/><circle cx="38" cy="58" r="22.2" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="5 5"/><circle cx="38" cy="58" r="8" style="fill:var(--c)" stroke="#fff" stroke-width="2"/></g>' +
      '<g><circle cx="113" cy="58" r="19" fill="#0A1030" stroke="#fff" stroke-width="3.2"/><circle cx="113" cy="58" r="22.2" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="5 5"/><circle cx="113" cy="58" r="8" style="fill:var(--c)" stroke="#fff" stroke-width="2"/></g>' +
    '</symbol></svg>';
  document.body.appendChild(d);
};

/* ---------- Conexión con Supabase ---------- */
GP.conectar = () => {
  const cfg = window.GP_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_KEY || /TU-PROYECTO|TU_CLAVE|PEGA_AQUI/i.test(cfg.SUPABASE_URL + cfg.SUPABASE_KEY)) return { error: 'config' };
  if (!window.supabase || !window.supabase.createClient) return { error: 'libreria' };
  try {
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    return { sb };
  } catch (e) { return { error: 'libreria', detalle: e && e.message }; }
};
GP.mensajeConfig = (el, tipo) => {
  el.innerHTML = '<div class="aviso-config"><img src="' + (LOGOS.sageWhite || '') + '" alt="Sage" style="height:40px"><h1>Falta conectar con Supabase</h1><p>' +
    (tipo === 'libreria' ? 'No se pudo cargar la librería de Supabase. Revisa que el equipo tenga internet.' :
      'Abre el archivo <b>assets/js/config.js</b> y pega la dirección (URL) y la clave pública de tu proyecto de Supabase. La guía paso a paso explica dónde encontrarlas.') + '</p></div>';
};

/* ---------- Valores por defecto y conversión fila <-> objeto ---------- */
const DEF = {
  config: { evento: 'Encuentro Anual de Consorcios | Consortia', lugar: 'Barranquilla', bono: 3, maxVueltas: 10, radioSeg: 20, enlaceRegistro: '', institucionesExtra: [] },
  turno: { n: 1, fase: 'escuderias', escIds: [], qs: [], qi: 0, rev: false, pregunta: null, reveal: null, qInicio: null, anim: 0 }
};
GP.DEF = DEF;
const FROM = {
  config: r => ({ evento: r.evento, lugar: r.lugar, bono: Number(r.bono), maxVueltas: r.max_vueltas, radioSeg: r.radio_seg, enlaceRegistro: r.enlace_registro || '', institucionesExtra: r.instituciones_extra || [] }),
  turno: r => ({ n: r.n, fase: r.fase, escIds: r.esc_ids || [], qs: r.qs || [], qi: r.qi || 0, rev: !!r.rev, pregunta: r.pregunta || null, reveal: r.reveal || null, qInicio: r.q_inicio || null, anim: r.anim || 0 }),
  escuderias: r => ({ id: r.id, turno: r.turno, nombre: r.nombre, color: r.color, orden: r.orden || 0, resp: r.resp || {}, cerrada: !!r.cerrada, mejor: r.mejor_cs, ajuste: r.ajuste_cs, final: r.final_cs, vueltas: r.vueltas || 0, ts: Date.parse(r.creada) || 0 }),
  vueltas: r => ({ id: r.id, esc: r.esc_id, turno: r.turno, cs: r.cs, ts: Date.parse(r.ts) || 0 }),
  inscripciones: r => ({ id: r.id, turno: r.turno, esc: r.esc_id, nombre: r.nombre, institucion: r.institucion, origen: r.origen, ts: Date.parse(r.ts) || 0 }),
  preguntas: r => ({ id: r.id, recurso: r.recurso, modulo: r.modulo || '', texto: r.texto, opciones: r.opciones || [], correcta: r.correcta, dato: r.dato || '', usos: r.usos || 0 })
};
const KEYMAP = {
  config: { maxVueltas: 'max_vueltas', radioSeg: 'radio_seg', enlaceRegistro: 'enlace_registro', institucionesExtra: 'instituciones_extra' },
  turno: { escIds: 'esc_ids', qInicio: 'q_inicio' },
  escuderias: { mejor: 'mejor_cs', ajuste: 'ajuste_cs', final: 'final_cs' },
  vueltas: { esc: 'esc_id' },
  inscripciones: { esc: 'esc_id' },
  preguntas: {}
};
const SKIP = { escuderias: ['ts'], inscripciones: [], vueltas: [], config: [], turno: [], preguntas: [] };
function aFila(tabla, obj) {
  const out = {};
  Object.keys(obj).forEach(k => {
    if (obj[k] === undefined || (SKIP[tabla] || []).indexOf(k) >= 0) return;
    let v = obj[k];
    if (k === 'ts') v = new Date(v).toISOString();
    out[(KEYMAP[tabla] || {})[k] || k] = v;
  });
  return out;
}
const SINGLE = { config: 1, turno: 1 };

/* ---------- Almacén de datos con tiempo real ---------- */
GP.crearAlmacen = (sb, opts) => {
  opts = opts || {};
  const tablas = ['config', 'turno', 'escuderias', 'vueltas', 'inscripciones'].concat(opts.moderador ? ['preguntas'] : []);
  const S = { config: null, turno: null, escuderias: {}, vueltas: {}, inscripciones: {}, preguntas: {} };
  const A = { S, sb, estado: 'conectando', cargado: {}, errores: 0 };
  const oyentes = [];
  let wv = 0, pend = 0, timer = null, canal = null;
  const avisar = () => oyentes.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  A.alCambiar = f => oyentes.push(f);
  A.avisar = avisar;

  async function refrescar(t) {
    if (!FROM[t]) return true;        // tablas que no se guardan en el estado (contactos, directorio)
    const w0 = wv;
    let q = sb.from(t).select('*');
    if (t === 'vueltas' || t === 'inscripciones') q = q.order('ts', { ascending: true });
    const { data, error } = await q;
    if (error) { A.errores++; if (A.estado !== 'sin conexión') { A.estado = 'sin conexión'; avisar(); } return false; }
    if (w0 !== wv || pend > 0) { setTimeout(() => refrescar(t), 350); return false; }   // hubo escrituras en curso: reintentar
    if (A.estado !== 'en línea') { A.estado = 'en línea'; }
    const f = FROM[t];
    if (SINGLE[t]) S[t] = data && data[0] ? f(data[0]) : null;
    else { const m = {}; (data || []).forEach(r => { m[r.id] = f(r); }); S[t] = m; }
    A.cargado[t] = true;
    avisar();
    return true;
  }
  A.refrescar = refrescar;
  A.refrescarTodo = () => Promise.all(tablas.map(refrescar));
  const progra = t => { clearTimeout(progra['_' + t]); progra['_' + t] = setTimeout(() => refrescar(t), 120); };

  A.iniciar = async () => {
    await A.refrescarTodo();
    try {
      canal = sb.channel('gran-premio-' + Math.random().toString(36).slice(2, 7));
      tablas.forEach(t => canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => progra(t)));
      canal.subscribe(st => {
        if (st === 'SUBSCRIBED') { if (A.estado !== 'en línea') { A.estado = 'en línea'; avisar(); } A.refrescarTodo(); }
        else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') { A.estado = 'reconectando'; avisar(); }
      });
    } catch (e) { console.error(e); }
    clearInterval(A._poll);
    A._poll = setInterval(() => { if (!document.hidden) A.refrescarTodo(); }, opts.sondeo || 5000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) A.refrescarTodo(); });
    window.addEventListener('online', () => A.refrescarTodo());
  };

  /* Escrituras: se aplican de inmediato en pantalla y se confirman con la base de datos */
  async function escribir(t, op) {
    wv++; pend++;
    let res;
    try { res = await op(); } catch (e) { res = { error: e }; }
    pend--; wv++;
    if (res && res.error) {
      console.error(t, res.error);
      U.toast('No se pudo guardar: ' + (res.error.message || 'error de conexión'));
      refrescar(t);
      return false;
    }
    setTimeout(() => refrescar(t), 250);
    return res || true;
  }
  A.parchar = (t, id, patch) => {
    if (SINGLE[t]) S[t] = Object.assign({}, S[t] || DEF[t], patch);
    else if (S[t][id]) S[t][id] = Object.assign({}, S[t][id], patch);
    avisar();
    const fila = aFila(t, patch);
    return escribir(t, () => sb.from(t).update(fila).eq('id', SINGLE[t] ? 1 : id));
  };
  A.poner = (t, obj) => {      // upsert por id
    S[t][obj.id] = obj; avisar();
    return escribir(t, () => sb.from(t).upsert(aFila(t, obj), { onConflict: 'id' }));
  };
  A.ponerVarios = (t, objs) => {
    objs.forEach(o => { S[t][o.id] = o; }); avisar();
    return escribir(t, () => sb.from(t).upsert(objs.map(o => aFila(t, o)), { onConflict: 'id' }));
  };
  A.insertar = (t, obj) => {
    S[t][obj.id] = obj; avisar();
    return escribir(t, () => sb.from(t).insert(aFila(t, obj)));
  };
  A.borrar = (t, id) => {
    delete S[t][id]; avisar();
    return escribir(t, () => sb.from(t).delete().eq('id', id));
  };
  A.rpc = async (nombre, args) => {
    wv++; pend++;
    let res;
    try { res = await sb.rpc(nombre, args || {}); } catch (e) { res = { error: e }; }
    pend--; wv++;
    return res;
  };
  A.escribirLibre = escribir;
  return A;
};

/* ---------- Lógica del juego (a partir del estado) ---------- */
GP.logica = S => {
  const L = {};
  L.cfg = () => S.config || DEF.config;
  L.tur = () => S.turno || DEF.turno;
  L.lrOf = id => LR.find(c => c.id === id) || LR[0];
  L.colOf = e => L.lrOf(e && e.color).hex;
  L.escT = () => (L.tur().escIds || []).map(id => S.escuderias[id]).filter(Boolean).sort((a, b) => a.orden - b.orden);
  L.bonoCs = () => Math.round((Number(L.cfg().bono) || 0) * 100);
  L.maxV = () => Math.max(1, Number(L.cfg().maxVueltas) || 10);
  L.vueltasDe = id => Object.values(S.vueltas).filter(v => v.esc === id).sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : 1));
  L.mejorCs = id => { const l = L.vueltasDe(id); return l.length ? Math.min.apply(null, l.map(v => v.cs)) : null; };
  /* Cada respuesta revelada resta (acierto) o suma (error) el bono a la mejor vuelta */
  L.adjCs = e => {
    if (!e || !e.resp) return 0;
    return Object.keys(e.resp).reduce((a, k) => {
      const r = e.resp[k];
      return typeof r.ok === 'boolean' ? a + (r.ok ? -L.bonoCs() : L.bonoCs()) : a;
    }, 0);
  };
  L.aciertos = e => (e && e.resp ? Object.values(e.resp).filter(r => r.ok === true).length : 0);
  L.miembros = escId => Object.values(S.inscripciones).filter(v => v.esc === escId).sort((a, b) => a.ts - b.ts);
  L.resumenCierre = e => {
    const laps = L.vueltasDe(e.id), m = laps.length ? Math.min.apply(null, laps.map(v => v.cs)) : null, aj = L.adjCs(e);
    return { cerrada: true, mejor: m, ajuste: aj, final: m != null ? Math.max(0, m + aj) : null, vueltas: laps.length };
  };
  /* Clasificación general: escuderías cerradas + las dos que están en pista (provisional) */
  L.ranking = () => {
    const t = L.tur(), cur = new Set(t.escIds || []), list = [];
    Object.values(S.escuderias).forEach(e => {
      let final = null, live = false;
      if (e.cerrada && e.final != null) final = e.final;
      else if (cur.has(e.id) && t.fase === 'pista') { const m = L.mejorCs(e.id); if (m != null) { final = Math.max(0, m + L.adjCs(e)); live = true; } }
      if (final == null) return;
      list.push({ e, final, live, laps: e.cerrada ? (e.vueltas || 0) : L.vueltasDe(e.id).length, mejor: e.cerrada ? e.mejor : L.mejorCs(e.id), aj: e.cerrada ? (e.ajuste || 0) : L.adjCs(e) });
    });
    list.sort((a, b) => a.final - b.final || (a.e.ts || 0) - (b.e.ts || 0));
    list.forEach((r, i) => { r.pos = i + 1; });
    return list;
  };
  L.instituciones = () => {
    const set = new Set((DATOS.INSTITUCIONES_BASE || []).concat(L.cfg().institucionesExtra || []));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  };
  return L;
};

/* Pregunta que ve el público: sin la respuesta correcta */
GP.preguntaPublica = q => ({ id: q.id, recurso: q.recurso, modulo: q.modulo, texto: q.texto, opciones: q.opciones });
GP.RESPUESTA_LETRAS = ['A', 'B', 'C', 'D', 'E', 'F'];
GP.FASE_TXT = { escuderias: 'Creando escuderías', registro: 'Registro abierto', preguntas: 'Preguntas', pista: 'En pista', resultado: 'Resultado', final: 'Final' };

})();
