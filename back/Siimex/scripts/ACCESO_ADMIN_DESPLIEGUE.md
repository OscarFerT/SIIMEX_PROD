# Acceso administrativo y despliegue del frontend

## Evidencia y alcance

- El reporte del navegador muestra errores de carga de modulos JavaScript recibidos
  como text/html y respuestas HTTP 500 de login/verificacion/notificaciones.
- En la revision remota, ambos modulos reportados ya respondieron HTTP 200 con
  application/javascript. La pagina de acceso no tenia Cache-Control definido.
- Una solicitud real de codigo de la cuenta reportada respondio HTTP 200 con
  requiresVerification=true y sin JWT. Las credenciales fueron aceptadas en ese paso.
- Posteriormente, con un codigo nuevo entregado expresamente por el titular, la
  verificacion respondio HTTP 200 y emitio sesion. Registros paginados y el contador
  de notificaciones administrativos tambien respondieron HTTP 200. No se utilizo
  el codigo antiguo del log ni se conservaron JWT/cookies en archivos o Git.
  El codigo de la prueba se consumio; el navegador del titular requiere uno nuevo.
- Las comprobaciones con cuerpos vacios respondieron 400 JSON; un recurso protegido
  sin sesion respondio 401 JSON. Esas solicitudes de diagnostico no envian codigos.
- El log proporcionado muestra arranque correcto y envio por Graph, no la excepcion
  correspondiente al 500. El 500 no se reprodujo en las pruebas reales posteriores;
  no se afirma haber identificado su causa exacta de servidor sin esa respuesta/excepcion.

## Cambios incluidos

- El login distingue fallas de red y 5xx de rechazos de credenciales o permisos.
- Los errores tambien aparecen durante la verificacion del codigo (segundo paso).
- Si falta un modulo del panel se informa la necesidad de recargar, sin eliminar
  roles ni cambiar contrasenas o saltar la verificacion por codigo.
- web.config evita que una peticion a un archivo estatico inexistente se reescriba
  a index.html. El index requiere revalidacion y no se conserva como copia obsoleta.
- IIS conserva los cuerpos de error de la API mediante httpErrors/PassThrough.
  CSP, nosniff y la exigencia de autenticacion permanecen habilitados.

## Publicacion

1. Compilar el frontend de la revision completa y publicar TODO el contenido de
   dist/comecyt-portal/browser, incluyendo chunks, media, assets y web.config.
2. Subir los archivos con hash antes del index.html; publicar el index al final.
   Conservar los archivos con hash de la version anterior mientras haya sesiones
   activas. No eliminar todos los chunks antes de copiar la nueva compilacion.
3. Verificar que los chunks referenciados por el index/main respondan JavaScript,
   no HTML. Verificar que /api conserve respuestas JSON y estados HTTP originales.
4. Recargar la pagina de acceso con Ctrl+F5 y solicitar un codigo nuevo; los codigos
   anteriores pueden haber caducado o invalidarse al reiniciar el backend.

Si un 500 persiste, guardar hora, URL, estado, Content-Type y respuesta de la peticion
fallida, junto con la excepcion del backend en ese instante. Si responde HTML y no
hay excepcion Java, revisar el subestado en los logs de IIS y sus reglas heredadas.
No compartir contrasenas, codigos OTP, cookies, JWT ni el archivo .env.

La contrasena temporal generada por Spring en el arranque no es la contrasena de
las cuentas SIIMEX y no debe usarse para sustituirla.

Fuentes de configuracion IIS:
- https://learn.microsoft.com/en-us/iis/wmi-provider/httperrorssection-class
- https://learn.microsoft.com/en-us/iis/configuration/system.webserver/httpprotocol/customheaders/add
