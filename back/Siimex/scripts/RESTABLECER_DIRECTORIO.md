# Publicacion del directorio autorizada

El 2026-11-05 se confirmo la autorizacion para volver a publicar las fichas del
directorio que el filtro de consentimiento habia excluido. No se revierte el resto
de los cambios de seguridad, la paginacion ni la optimizacion de carga del frontend.

- Ficha publica: cuenta activa, no bloqueada, con tipo de perfil, sin ROLE_ADMIN.
- Consentimiento true/false/null: no filtra la ficha ni reemplaza el nivel elegido.
- Se respeta MINIMA/ESTANDAR/COMPLETA. Visibilidad desconocida/null es MINIMA.
- MINIMA no publica contacto, foto, semblanza, trayectoria detallada ni CV;
  ESTANDAR no publica telefono ni CV; COMPLETA conserva los datos publicos existentes.
- Los conteos, resultados, opciones de grado/area y paginacion usan la misma
  elegibilidad. Los filtros se aplican en base de datos antes de paginar.
- Semblanza, idiomas y herramientas no se pueden inferir con palabras clave si
  no se permite publicarlos. Las descargas publicas siguen los mismos permisos.
- No cambia el acceso al sistema: una cuenta bloqueada o suspendida permanece asi.
- No se modifican datos, folios, documentos ni valores de consentimiento en MySQL.

## Despliegue y comprobacion

Compilar y desplegar el backend actualizado. Se conserva el formulario de privacidad
del frontend; el consentimiento no se usa como condicion de listado en el backend.
No se necesita una nueva migracion ni importar un respaldo de base de datos.

El numero 1406 no esta fijado en el codigo: corresponde a los registros que cumplan
los criterios en la base del servidor. Verificar tras desplegar con:

`GET /api/usuarios/investigadores/paginado?page=0&size=8&tipo=INVESTIGADOR`

Revisar `totalInvestigadores`, `totalElements`, `totalPages` y las paginas siguientes.
Los perfiles HIBRIDO aparecen en ambas modalidades; no deben sumarse los dos
contadores para obtener personas unicas.

Las pruebas de regresion usan H2 aislado y 1406 fichas ficticias autorizadas, de las
cuales 306 tienen consentimiento true y 1100 false/null, ademas de cuentas excluidas.
No se valida el total exacto de produccion sin acceso a su base/despliegue.
