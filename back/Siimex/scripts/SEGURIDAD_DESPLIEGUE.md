# Actualizacion de seguridad SIIMEX - 2026-11-04

## Antes de desplegar

1. Realizar un respaldo privado de la base de produccion, fuera de Git y del directorio publicado por IIS.
2. Ejecutar `20261104_seguridad_sesiones.sql` sobre la base correcta ANTES de desplegar el backend. Solo agrega `auth_users.session_version` con valor inicial 0; no elimina usuarios, folios, documentos ni catalogos. Es idempotente.
3. Compilar y desplegar frontend y backend de la misma revision. No importar `bd_siimex_limpia_produccion.sql` sobre produccion: ese archivo recrea tablas y no es una migracion.
4. Verificar el `web.config` incluido en el frontend: HTTPS para acceso publico, CSP y cabeceras. Revisar posibles cabeceras heredadas de IIS para evitar entradas duplicadas y probar visualizacion/descarga de PDF.
5. Mantener el puerto de Jetty accesible solo desde el proxy autorizado. La API no debe exponerse por HTTP directamente a Internet.

## Cambios de comportamiento intencionales

- Todos los JWT anteriores al cambio quedan invalidados. Los usuarios deben volver a iniciar sesion; esto no cambia sus contrasenas ni borra informacion guardada.
- `/auth/login` y `/auth/login-admin` responden 410. Los clientes deben usar `/auth/login/request-code` y `/auth/login/verify-code`, como las pantallas actuales. Los administradores siempre pasan por el codigo, incluso si existia un dispositivo recordado.
- Recuperacion: solicitar codigo con `POST /auth/reset-password/request-code` y correo registrado; confirmar con `POST /auth/reset-password` usando correo, codigo y nueva contrasena. Conocer CURP/RFC ya no autoriza un cambio. El mensaje de solicitud no confirma si existe una cuenta.
- Los codigos caducan en cinco minutos, tienen cinco intentos por desafio, reenvio limitado y consumo atomico de un solo uso. Login, diagnostico y recuperacion utilizan espacios separados. Un reinicio invalida los codigos pendientes y se debe solicitar otro.
- Suspension, cambios de roles, contrasena y cierre de sesion invalidan las sesiones. Cerrar sesion revoca todas las sesiones/dispositivos recordados de esa cuenta, no solamente la pestana actual. La revocacion queda persistida en MySQL.
- Directorio (criterio restaurado con autorizacion institucional el 2026-11-05): se listan perfiles con cuenta activa/no bloqueada, tipo de perfil y ausencia de ROLE_ADMIN, independientemente del consentimiento true/false/null. La informacion y los documentos publicos dependen del nivel de visibilidad MINIMA/ESTANDAR/COMPLETA; el consentimiento no sustituye ese nivel ni se modifica en masa en la base.
- Las descargas publicas de foto y CV aplican la misma elegibilidad y el nivel de visibilidad. El titular y el administrador conservan sus rutas autenticadas de documentos privados.
- Solicitudes de modificacion autenticadas solo por cookie requieren `X-SIIMEX-Request: 1` o el token Bearer explicito. El interceptor actual lo agrega solo a solicitudes hacia esta API, no a sitios externos.
- Los datos interpolados en SweetAlert y asignaciones HTML dinamicas se sanitizan centralmente. Se conservaron los campos de formulario utilizados por los modales.
- El build de produccion no genera el manejador inline de carga de CSS critico; esto permite mantener script-src sin unsafe-inline y evita que CSP deje la pagina sin estilos.
- X en la CURP ya no desactiva la comprobacion de todo el nombre/apellidos. Se mantienen las particulas de apellidos compuestos. La validacion de formato no acredita identidad ante RENAPO.

## Proxy y limites

La aplicacion no confia en X-Forwarded-For aportado por el cliente, ni en wrappers que lo conviertan en direccion remota. Los limites HTTP usan la conexion real. Detras de IIS pueden agrupar a varios clientes por la IP del proxy: revisar la capacidad de los limites y complementar con limites por IP en IIS, normalizando los encabezados alli. Los controles por cuenta del login/recuperacion siguen activos. No habilitar confianza indiscriminada en encabezados para resolverlo.

## Credenciales y respaldo versionado

El dump del repositorio deja de incluir registros de autenticacion y sus hashes. Es una plantilla de esquema/catalogos para instalaciones nuevas; no incluye administradores con credenciales predeterminadas. Provisionar el administrador de una instalacion nueva mediante un procedimiento seguro del operador.

Esto NO borra los hashes del historial Git ni revoca credenciales que ya se hayan compartido. Revisar los accesos al repositorio y rotar las credenciales administrativas previamente distribuidas. No se reescribio el historial ni se cambiaron contrasenas reales automaticamente.

## Dependencias y limites de la comprobacion

- Angular 21.2.26, CLI/build 21.2.29, DOMPurify 3.4.17 y jsPDF 4.2.1. Se actualizaron tambien dependencias transitivas compatibles; los overrides de glob/minimatch se verifican con build y pruebas. npm audit completo y de produccion sin alertas en esta revision.
- Spring Boot 3.5.16, Jackson 2.21.8 y Log4j 2.25.5. Se conservaron Java 17 y las APIs actuales.
- OSV todavia marca dos avisos en Spring MVC 6.2.19: CVE-2026-47890 (fragmentos de vistas por SSE) y CVE-2026-47884 (XsltView). No se encontraron esos usos/configuraciones en SIIMEX. No se ocultan las alertas ni se afirma que la dependencia este libre de avisos. El parche 6.2.20 es Enterprise; el parche publico requiere migrar a Spring 7, un cambio mayor que debe planificarse antes de incorporar esas funcionalidades.
- Fuentes oficiales: https://spring.io/security/cve-2026-47890/ y https://spring.io/security/cve-2026-47884/.
- Las pruebas usan correos ficticios, repositorios simulados o H2 en memoria. No verifican entrega real de Microsoft Graph ni equivalencia exacta con la configuracion del servidor de produccion.

## Comprobaciones del operador

Verificacion local realizada: 94 pruebas del backend (suite completa, MySQL sustituido por H2), 50 pruebas del frontend, build de produccion y prueba del build en navegador de escritorio/movil con CSP. Se probaron login 2FA y recuperacion por HTTP, revocacion de JWT, consentimiento, XSS, paginacion sobre 1400 usuarios sinteticos y ZIP de 1400 expedientes/1401 documentos al 100%. No se enviaron correos reales ni se escribio en MySQL.

Tras aplicar la migracion y desplegar, comprobar con cuentas autorizadas: login de usuario/admin por codigo, rechazo de acceso suspendido, cierre de sesion, recuperacion de correo, consentimiento y niveles de visibilidad, documentos privados/publicos y ZIP. Confirmar HTTP a HTTPS, CSP y que el puerto interno no se exponga.

No usar este documento como certificacion de seguridad absoluta; los controles externos, la rotacion de credenciales y el despliegue real requieren validacion en el servidor.
