# Gran Premio Sage

Sitio estático (HTML y JavaScript, sin compilación) para el Encuentro Anual de Consorcios.
Se publica en GitHub Pages y guarda los datos en Supabase.

| Página | Archivo | Quién la usa |
| --- | --- | --- |
| Moderador | `moderador.html` | El moderador, en su computador (correo y contraseña) |
| Registro | `registro.html` | Los directores, desde el celular (el enlace del QR) |
| Pantalla pública | `pantalla.html` | iPad u otro computador hacia el público (solo lectura) |

## Contenido

```
index.html            Enlaza las tres páginas
moderador.html
registro.html
pantalla.html
assets/js/config.js   EL ÚNICO ARCHIVO QUE SE EDITA (URL y clave pública de Supabase)
assets/js/*.js        Lógica de las páginas
assets/css/*.css      Estilos y fuentes de Sage
supabase/01_esquema.sql      Paso 1: tablas, seguridad y funciones
supabase/02_moderador.sql    Paso 2: da permisos de moderador a tu cuenta (cambia el correo)
supabase/03_preguntas.sql    Paso 3: las 36 preguntas
```

## Resumen en diez pasos

La guía completa, con la lista de verificación de la prueba general, está en el documento
"Gran Premio Sage: guía paso a paso (GitHub y Supabase)".

1. En supabase.com crea un proyecto (región South America, São Paulo; plan Free).
2. En Authentication, Users, Add user, crea tu usuario con **Auto Confirm User**.
3. En SQL Editor ejecuta `01_esquema.sql` completo.
4. Cambia el correo en `02_moderador.sql` por el de tu usuario y ejecútalo (debe mostrar una fila).
5. Ejecuta `03_preguntas.sql`.
6. En Authentication, Sign In / Providers, desactiva "Allow new users to sign up".
7. Copia la Project URL y la clave publishable (o anon) en `assets/js/config.js`. Nunca uses la secret ni la service_role.
8. Crea un repositorio público en GitHub, sube **el contenido** de esta carpeta y activa Settings, Pages, Deploy from a branch, main, / (root).
9. Abre `https://TU-USUARIO.github.io/TU-REPO/moderador.html`, ingresa, y en Ajustes pulsa "Usar el enlace de este sitio". Carga el directorio de asistentes.
10. Haz la prueba general un día antes y reinicia el evento (Ajustes, Datos) para limpiar los datos de prueba.

## Notas

- La clave publishable es pública por diseño. La seguridad la dan las reglas (RLS) de `01_esquema.sql`.
- Clave de administrador inicial: `Consortia` (mover o quitar personas de turnos cerrados y reiniciar el evento). Para cambiarla:
  `update public.secretos set valor = 'NuevaClave' where nombre = 'clave_admin';`
- Librerías externas que cargan desde internet: `@supabase/supabase-js@2.111.0` y `qrcode-generator@1.4.4`, ambas desde jsDelivr.
- El repositorio público expone los logos y fuentes de Sage de `assets`. Las páginas llevan `noindex`.
