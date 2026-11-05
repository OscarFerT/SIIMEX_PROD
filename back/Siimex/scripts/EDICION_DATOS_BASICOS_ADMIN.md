# Correccion de datos basicos desde Registros

En Administracion > Registros, seleccionar una persona y usar "Editar datos basicos".
Permite corregir nombre, apellidos, correo, telefono, CURP, fecha de nacimiento,
genero y entidad federativa de nacimiento. Se solicita un motivo y confirmacion
de cotejo de la documentacion. No se envia correo automaticamente por esta accion.

## Seguridad y compatibilidad

- GET/PATCH `/api/admin/registros/{id}/datos-basicos`: exclusivos de ROLE_ADMIN.
- El PATCH verifica tambien que el administrador siga activo y no bloqueado.
- Validaciones de formato, longitudes, duplicados de correo/username y CURP.
- Al corregir identidad se valida coincidencia de CURP con nombres, fecha, genero
  y entidad mediante las reglas existentes, incluidos apellidos compuestos.
  No es una consulta ni certificacion de RENAPO.
- Un contacto puede corregirse sin exigir reemplazar una CURP historica que no cambio.
- Si el username era el correo anterior, se sincroniza; un username personalizado
  se conserva. Cuando se sincroniza, el correo debe caber en la columna de 80 caracteres.
- Al cambiar correo o identidad se revocan sesiones y dispositivos recordados.
  Al cambiar correo tambien se eliminan enlaces de verificacion anteriores.
- Se conservan estados de activacion/bloqueo, roles, consentimiento y visibilidad.
  No se modifican contrasenas, IDs, folios, documentos ni postulaciones existentes.
- La bitacora guarda administrador, registro, campos modificados y motivo; no copia
  la CURP al detalle de auditoria. Correccion y bitacora comparten transaccion.
- Una revision del estado original y bloqueo de escritura evitan que dos formularios
  de esta funcion se sobrescriban. Una revision vencida devuelve 412; duplicados,
  409. El frontend conserva el borrador ante fallos de validacion o conexion.
- No hay migracion de esquema. Desplegar backend y frontend juntos. Esta accion no
  cambia consentimientos ni desbloquea cuentas de forma automatica.

## Verificacion

- `mvn test`: 116 pruebas backend, incluidos permisos HTTP y persistencia H2 aislada.
- `npm test -- --watch=false --browsers=ChromeHeadless`: 58 pruebas frontend.
- `npm run build`: compilacion de produccion.
- Pruebas visuales del modal en escritorio y movil con API simulada; no se editan
  cuentas reales ni se envian mensajes para estas pruebas.

Para comprobar visualmente la imagen autorizada se desbloqueo unicamente la cuenta
local `demo.directorio.siimex01@example.test`; las otras 15 siguen bloqueadas.
Este estado local no se exporta ni se incluye como SQL de produccion.
