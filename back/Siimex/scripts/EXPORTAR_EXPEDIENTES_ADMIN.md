# Expedientes ZIP de administracion

En Registros hay tres opciones: usuario seleccionado, usuarios marcados para ZIP
y todos los resultados de los filtros actuales. Sin filtros, la tercera opcion
incluye todos los usuarios del listado. Las marcas se conservan al cambiar de
pagina y se borran al cambiar filtros. Son independientes de las acciones de
editar, suspender o eliminar un usuario.

## Contenido

Cada ZIP tiene un indice CSV y una carpeta por usuario con `ficha.html`,
`datos.json` y sus documentos originales organizados por tipo. La ficha puede
abrirse e imprimirse sin conexion. Incluye datos de registro, cuenta, perfil,
instituciones, areas, trayectorias y demas rubros del perfil, mas todos los
documentos vinculados a ese usuario en la tabla `documentos`.

No es un respaldo SQL ni una exportacion de tablas de postulaciones. Nunca
incluye hashes de contrasena, tokens de sesion o codigos de verificacion.
Los archivos originales pueden contener datos personales sensibles: resguardar
el ZIP y compartirlo solo con personal autorizado. El ZIP no esta cifrado.

## Progreso Y Descarga

El backend fija la seleccion de IDs y genera el ZIP en segundo plano. El
porcentaje avanza segun usuarios y documentos terminados, y llega a 100 solo
cuando el ZIP esta cerrado y listo. Se puede cancelar o reanudar la consulta
de progreso si falla la conexion. Volver a la vista recupera el trabajo guardado
en la sesion del navegador.

La transferencia final la realiza el administrador de descargas del navegador,
sin mantener todo el ZIP en un Blob de JavaScript. Su avance se ve en las
descargas del navegador; el 100% de la pagina significa "archivo preparado",
no "transferencia terminada".

Gestionar trabajos exige `ROLE_ADMIN` y cada trabajo pertenece al administrador
que lo solicito. Para la transferencia nativa, un POST autenticado emite una
cookie HttpOnly, SameSite=Strict, con ruta exacta, de un solo uso y 90 segundos
de vigencia. Solo el GET del archivo admite ese permiso temporal, y vuelve a
comprobar que la cuenta conserve privilegios administrativos. El JWT nunca va
en enlaces ni en el ZIP. Se registra el inicio de la exportacion en auditoria.

## Operacion

Un trabajador y una cola de dos tareas limitan la carga. Hay un trabajo activo
por administrador. Cada documento se lee y comprime por separado; no se cargan
los BLOBs de todos los usuarios en memoria ni se mantiene una transaccion larga.
Los perfiles se consultan durante la generacion: no es una instantanea
transaccional. Si un usuario o archivo desaparece, el trabajo falla sin ofrecer
un ZIP parcial y puede solicitarse de nuevo.

Los ZIP listos vencen despues de 30 minutos; los trabajos en curso tienen un
limite de dos horas. La limpieza revisa cada minuto. Al reiniciar el backend hay
que regenerar las exportaciones; los usuarios y documentos fuente no cambian.
Los restos de un cierre anormal se eliminan cuando tienen mas de dos horas.
Esta implementacion es para una instancia de backend; multiples replicas
necesitarian almacenamiento y coordinacion compartidos o afinidad de sesion.

Configuracion opcional (no se modifico ningun `.env`):

| Propiedad | Predeterminado |
| --- | --- |
| `app.admin.exportaciones.directorio` | `${java.io.tmpdir}/siimex-admin-exportaciones` |
| `app.admin.exportaciones.max-bytes` | `21474836480` (20 GiB por ZIP) |
| `app.admin.exportaciones.retencion-minutos` | `30` |

El directorio debe quedar fuera de la raiz web y ser escribible por el servicio
Java. Se restringen sus permisos al propietario (POSIX o ACL de Windows). Si no
puede prepararse, solo la exportacion devuelve un error; no bloquea el arranque,
el registro ni el acceso del resto del sistema. Si se alcanza el limite del ZIP
o el disco queda con menos de 100 MiB libres, se informa el error y se elimina
el archivo parcial; usar entonces selecciones o filtros mas pequenos.

## Verificacion Y Despliegue

Las pruebas crean datos ficticios exclusivamente en H2 en memoria y archivos en
un directorio temporal de pruebas. Validan ZIP de 1400 usuarios y 1401 documentos,
selecciones mayores de 10, filtros globales, integridad de documentos, ausencia
de credenciales, nombres seguros, cancelacion, vencimiento, limites y permisos.

```powershell
# back/Siimex
mvn '-Dtest=AdminExportacionServiceTest,AdminRegistrosPaginationTest,AdminRegistrosPaginationHttpTest' test
# front/Siimex (CHROME_BIN debe apuntar a Chrome o Chromium)
npm test -- --watch=false --browsers=ChromeHeadless --include=src/app/pages/admin/admin-registros.component.spec.ts
npm run build
```

Desplegar primero backend y despues frontend. No requiere importar SQL ni cambiar
la estructura de la base. Antes de publicar, validar con MySQL, el proxy del
servidor, los permisos del directorio temporal y una descarga real en HTTPS.
