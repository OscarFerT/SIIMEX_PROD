# Paginacion de registros de administracion

El panel usa `GET /admin/registros/paginado` y solicita 10 filas por pagina,
ordenadas por ID ascendente. Los filtros se aplican en la base de datos antes
del limite. El endpoint completo anterior sigue disponible para sus otros
consumidores; no se modifican las altas, contrasenas, folios ni permisos.

El listado nuevo selecciona columnas escalares, no perfiles completos ni
contenido de documentos. Las fotos se descargan solo para las 10 filas visibles
y se liberan al cambiar de pagina. Excel y PDF recuperan todos los resultados
filtrados en lotes de hasta 100, solo al solicitar una exportacion.

## Pruebas reproducibles

Backend, desde `back/Siimex`:

```powershell
mvn '-Dtest=AdminRegistrosPaginationTest,AdminRegistrosPaginationHttpTest' test
```

La prueba crea 1400 cuentas ficticias con fotos en H2 en memoria, nunca en la
base configurada en `.env.properties`. Comprueba las 140 paginas, filtros
combinados, roles, bloqueos, fotos duplicadas, tamanos limite y consultas SQL.
Tambien compara el trabajo del listado anterior. Las pruebas HTTP comprueban
que solo `ROLE_ADMIN` pueda consultar el endpoint, usando `SecurityConfig` real.

Frontend, desde `front/Siimex` (Chrome/Chromium disponible en `CHROME_BIN`):

```powershell
npm test -- --watch=false --browsers=ChromeHeadless --include=src/app/pages/admin/admin-registros.component.spec.ts
npm run build
```

Se prueban renderizado de 10 filas, 140 paginas, busqueda global, filtros,
cancelacion de peticiones antiguas, detalle por ID, reintento, ultima pagina
vacia, exportacion completa y liberacion de fotos.

## Despliegue

Desplegar primero el backend con el endpoint nuevo y despues el frontend.
No requiere importar SQL, borrar usuarios ni cambiar `.env.properties`.
El frontend anterior puede seguir usando el endpoint completo mientras se
actualiza. Validar tambien contra MySQL y la infraestructura de produccion:
los tiempos de H2 local no son una promesa de latencia del servidor.
