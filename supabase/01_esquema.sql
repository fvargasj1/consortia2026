-- =====================================================================
-- GRAN PREMIO SAGE  |  Paso 1 de 3: tablas, seguridad y funciones
-- Cómo usarlo: Supabase > SQL Editor > New query > pegar TODO > Run
-- Es seguro ejecutarlo más de una vez.
-- =====================================================================

-- ---------- Tablas ----------------------------------------------------

-- Ajustes del evento (una sola fila)
create table if not exists public.config (
  id                  int primary key default 1 check (id = 1),
  evento              text    not null default 'Encuentro Anual de Consorcios | Consortia',
  lugar               text    not null default 'Barranquilla',
  bono                numeric not null default 3,      -- segundos por respuesta
  max_vueltas         int     not null default 10,
  radio_seg           int     not null default 20,     -- cuenta regresiva de cada pregunta
  enlace_registro     text    not null default '',     -- dirección de registro.html (para el QR)
  instituciones_extra jsonb   not null default '[]'::jsonb
);

-- Estado del turno actual (una sola fila). Lo escribe el moderador; lo leen las 3 páginas.
create table if not exists public.turno (
  id        int primary key default 1 check (id = 1),
  n         int  not null default 1,
  fase      text not null default 'escuderias'
            check (fase in ('escuderias','registro','preguntas','pista','resultado','final')),
  esc_ids   text[] not null default '{}',
  qs        text[] not null default '{}',   -- las 3 preguntas del turno
  qi        int  not null default 0,        -- pregunta actual
  rev       boolean not null default false, -- ¿ya se reveló la respuesta?
  pregunta  jsonb,                          -- pregunta visible al público (SIN la respuesta)
  reveal    jsonb,                          -- {correcta, dato}: solo existe cuando rev = true
  q_inicio  timestamptz,
  anim      int  not null default 0,        -- sube 1 para repetir la animación final
  actualizado timestamptz not null default now()
);

create table if not exists public.escuderias (
  id        text primary key,               -- p. ej. t1-a, t1-b
  turno     int  not null,
  nombre    text not null,
  color     text not null,                  -- id del color LR
  orden     int  not null default 0,
  resp      jsonb not null default '{}'::jsonb,   -- respuestas del turno
  cerrada   boolean not null default false,
  mejor_cs  int,
  ajuste_cs int,
  final_cs  int,
  vueltas   int  not null default 0,
  creada    timestamptz not null default now()
);

create table if not exists public.vueltas (
  id     uuid primary key default gen_random_uuid(),
  esc_id text not null references public.escuderias(id) on delete cascade,
  turno  int  not null,
  cs     int  not null check (cs >= 100),   -- centésimas de segundo
  ts     timestamptz not null default now()
);

create table if not exists public.inscripciones (
  id          uuid primary key default gen_random_uuid(),
  turno       int  not null,
  esc_id      text not null references public.escuderias(id) on delete cascade,
  nombre      text not null check (char_length(nombre) between 3 and 120),
  institucion text not null check (char_length(institucion) between 2 and 160),
  origen      text not null default 'celular',
  ts          timestamptz not null default now()
);

-- Los correos viven aparte: el público nunca los puede leer.
create table if not exists public.contactos (
  inscripcion_id uuid primary key references public.inscripciones(id) on delete cascade,
  correo         text not null
);

-- Lista de asistentes que sube el organizador (para buscarse al registrarse)
create table if not exists public.directorio (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  institucion text not null default '',
  correo      text not null default '',
  busqueda    text not null default ''      -- texto normalizado para buscar
);

create table if not exists public.preguntas (
  id       text primary key,
  recurso  text not null check (recurso in ('journals','books','srm')),
  modulo   text not null default '',
  texto    text not null,
  opciones jsonb not null,
  correcta int  not null,
  dato     text not null default '',
  usos     int  not null default 0
);

-- Quién es moderador y claves internas (ninguna es legible desde la web)
create table if not exists public.moderadores (user_id uuid primary key);
create table if not exists public.secretos (nombre text primary key, valor text not null);

-- Filas iniciales
insert into public.config (id) values (1) on conflict (id) do nothing;
insert into public.turno  (id) values (1) on conflict (id) do nothing;
insert into public.secretos (nombre, valor) values ('clave_admin', 'Consortia')
  on conflict (nombre) do nothing;

-- ---------- Funciones de apoyo ---------------------------------------

create or replace function public.es_moderador()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.moderadores m where m.user_id = auth.uid());
$$;

create or replace function public.verificar_clave_admin(p_clave text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_moderador()
     and exists (select 1 from public.secretos s where s.nombre = 'clave_admin' and s.valor = p_clave);
$$;

-- Registro desde el celular (única forma de escribir para el público)
create or replace function public.registrar_persona(
  p_nombre text, p_institucion text, p_correo text, p_esc_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t      public.turno%rowtype;
  v_nom  text := btrim(coalesce(p_nombre, ''));
  v_ins  text := btrim(coalesce(p_institucion, ''));
  v_mail text := btrim(coalesce(p_correo, ''));
  v_id   uuid;
  v_tot  int;
begin
  select * into t from public.turno where id = 1;
  if t.fase <> 'registro' then raise exception 'registro_cerrado'; end if;
  if p_esc_id is null or not (p_esc_id = any (t.esc_ids)) then raise exception 'escuderia_invalida'; end if;
  if char_length(v_nom) < 3 or char_length(v_nom) > 120 then raise exception 'nombre_invalido'; end if;
  if char_length(v_ins) < 2 or char_length(v_ins) > 160 then raise exception 'institucion_invalida'; end if;
  if v_mail <> '' and (char_length(v_mail) > 160 or v_mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'correo_invalido';
  end if;

  select id into v_id from public.inscripciones
   where turno = t.n and lower(nombre) = lower(v_nom) and lower(institucion) = lower(v_ins) limit 1;

  if v_id is null then
    select count(*) into v_tot from public.inscripciones where turno = t.n;
    if v_tot >= 60 then raise exception 'cupo_lleno'; end if;
    insert into public.inscripciones (turno, esc_id, nombre, institucion, origen)
    values (t.n, p_esc_id, v_nom, v_ins, 'celular') returning id into v_id;
  else
    update public.inscripciones set esc_id = p_esc_id where id = v_id;
  end if;

  if v_mail <> '' then
    insert into public.contactos (inscripcion_id, correo) values (v_id, v_mail)
    on conflict (inscripcion_id) do update set correo = excluded.correo;
  end if;

  return jsonb_build_object('id', v_id, 'esc_id', p_esc_id, 'nombre', v_nom, 'institucion', v_ins);
end $$;

-- Búsqueda en el directorio: devuelve máximo 8 personas y nunca el correo
create or replace function public.buscar_asistente(p_tokens text[])
returns table (id uuid, nombre text, institucion text)
language sql stable security definer set search_path = public as $$
  select d.id, d.nombre, d.institucion
    from public.directorio d
   where coalesce(array_length(p_tokens, 1), 0) between 1 and 6
     and (select coalesce(sum(char_length(x)), 0) from unnest(p_tokens) x) >= 3
     and not exists (
           select 1 from unnest(p_tokens) x
            where char_length(x) < 1
               or d.busqueda not like '%' || replace(replace(replace(x, '\', '\\'), '%', '\%'), '_', '\_') || '%')
   order by d.nombre
   limit 8;
$$;

-- Datos de UNA persona elegida (para precargar el formulario)
create or replace function public.datos_asistente(p_id uuid)
returns table (nombre text, institucion text, correo text)
language sql stable security definer set search_path = public as $$
  select d.nombre, d.institucion, d.correo from public.directorio d where d.id = p_id;
$$;

-- Mover a una persona a la otra escudería del mismo turno.
-- Turno actual: libre. Turnos anteriores: exige la clave de administrador.
create or replace function public.mover_inscripcion(p_id uuid, p_esc_id text, p_clave text default null)
returns void language plpgsql security definer set search_path = public as $$
declare i public.inscripciones%rowtype; e public.escuderias%rowtype; t public.turno%rowtype;
begin
  if not public.es_moderador() then raise exception 'no_autorizado'; end if;
  select * into i from public.inscripciones where id = p_id;
  if not found then raise exception 'inscripcion_no_existe'; end if;
  select * into e from public.escuderias where id = p_esc_id;
  if not found or e.turno <> i.turno then raise exception 'escuderia_invalida'; end if;
  select * into t from public.turno where id = 1;
  if i.turno <> t.n and not public.verificar_clave_admin(p_clave) then raise exception 'clave_invalida'; end if;
  update public.inscripciones set esc_id = p_esc_id where id = p_id;
end $$;

-- Borrar todo el avance del evento (conserva directorio y preguntas)
create or replace function public.reiniciar_evento(p_clave text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.verificar_clave_admin(p_clave) then raise exception 'clave_invalida'; end if;
  delete from public.escuderias where true;   -- arrastra vueltas, inscripciones y contactos
  update public.preguntas set usos = 0 where true;
  update public.turno set n = 1, fase = 'escuderias', esc_ids = '{}', qs = '{}', qi = 0, rev = false,
         pregunta = null, reveal = null, q_inicio = null, anim = 0, actualizado = now() where id = 1;
end $$;

-- ---------- Seguridad por filas (RLS) --------------------------------

alter table public.config        enable row level security;
alter table public.turno         enable row level security;
alter table public.escuderias    enable row level security;
alter table public.vueltas       enable row level security;
alter table public.inscripciones enable row level security;
alter table public.contactos     enable row level security;
alter table public.directorio    enable row level security;
alter table public.preguntas     enable row level security;
alter table public.moderadores   enable row level security;
alter table public.secretos      enable row level security;

do $$
declare t text;
begin
  -- Lectura pública: lo que necesitan la pantalla y el registro
  foreach t in array array['config','turno','escuderias','vueltas','inscripciones'] loop
    execute format('drop policy if exists %I on public.%I', t || '_lectura', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_lectura', t);
  end loop;
  -- Solo el moderador escribe (y lee lo privado)
  foreach t in array array['config','turno','escuderias','vueltas','inscripciones','contactos','directorio','preguntas'] loop
    execute format('drop policy if exists %I on public.%I', t || '_moderador', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.es_moderador()) with check (public.es_moderador())', t || '_moderador', t);
  end loop;
end $$;

-- ---------- Permisos -------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.config, public.turno, public.escuderias, public.vueltas, public.inscripciones to anon;
grant select, insert, update, delete on
  public.config, public.turno, public.escuderias, public.vueltas, public.inscripciones,
  public.contactos, public.directorio, public.preguntas to authenticated;

revoke all on function public.es_moderador()                              from public;
revoke all on function public.verificar_clave_admin(text)                  from public;
revoke all on function public.registrar_persona(text, text, text, text)    from public;
revoke all on function public.buscar_asistente(text[])                     from public;
revoke all on function public.datos_asistente(uuid)                        from public;
revoke all on function public.mover_inscripcion(uuid, text, text)          from public;
revoke all on function public.reiniciar_evento(text)                       from public;

grant execute on function public.registrar_persona(text, text, text, text) to anon, authenticated;
grant execute on function public.buscar_asistente(text[])                  to anon, authenticated;
grant execute on function public.datos_asistente(uuid)                     to anon, authenticated;
grant execute on function public.es_moderador()                            to authenticated;
grant execute on function public.verificar_clave_admin(text)               to authenticated;
grant execute on function public.mover_inscripcion(uuid, text, text)       to authenticated;
grant execute on function public.reiniciar_evento(text)                    to authenticated;

-- ---------- Tiempo real ----------------------------------------------

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['config','turno','escuderias','vueltas','inscripciones'] loop
      if not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
