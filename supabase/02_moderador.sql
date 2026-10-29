-- =====================================================================
-- GRAN PREMIO SAGE  |  Paso 2 de 3: dar permisos de moderador a TU cuenta
-- Antes: crea tu usuario en Supabase > Authentication > Users > Add user
--        (marca "Auto Confirm User").
-- Después: cambia el correo de abajo por el que usaste y ejecuta (Run).
-- =====================================================================

insert into public.moderadores (user_id)
select id from auth.users where lower(email) = lower('CAMBIA_ESTE_CORREO@ejemplo.com')
on conflict (user_id) do nothing;

-- Debe mostrar 1 fila. Si sale vacío, el correo no coincide con el usuario creado.
select m.user_id, u.email from public.moderadores m join auth.users u on u.id = m.user_id;
