/* =====================================================================
   CONFIGURACIÓN DE LA CONEXIÓN  |  Es el ÚNICO archivo que tienes que editar
   ---------------------------------------------------------------------
   En Supabase: Project Settings > API (o "Connect")
     1. Project URL            -> pégala en SUPABASE_URL
     2. Publishable key (o la "anon public" key de las claves antiguas)
                               -> pégala en SUPABASE_KEY
   Esa clave es PÚBLICA por diseño: la seguridad la dan las reglas (RLS)
   que ya instaló el archivo 01_esquema.sql. NUNCA pegues aquí la
   "secret key" ni la "service_role key".
   ===================================================================== */
window.GP_CONFIG = {
  SUPABASE_URL: 'https://qpmlcfvftrtggbaviebb.supabase.co',
  SUPABASE_KEY: 'sb_publishable_ccayCsBJvWTQw_FMpesGeg_cMgwnRvx'
};
