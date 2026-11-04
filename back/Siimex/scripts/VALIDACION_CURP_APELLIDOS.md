# CURP y apellidos compuestos

La comparacion local de nombres con la CURP ahora usa la primera palabra
significativa de cada apellido. Omite particulas iniciales completas como DE,
LA, DEL, LOS, MC o VAN, sin quitar esas palabras del perfil ni del registro.

Ejemplos:

- `De la Rosa` se compara como `ROSA` (inicial R).
- `Del Rio` se compara como `RIO` (inicial R y vocal interna I).
- `De los Santos` se compara como `SANTOS` (inicial S).
- `Riva Palacio` usa `RIVA`, no la ultima palabra.
- `Delgado`, `Macias` y `Mcgregor` no se recortan: la particula debe ser una palabra completa.

Se aplica al apellido paterno y al materno en las dos funciones existentes de
`CurpValidator`: la booleana y la que devuelve un mensaje. Los mensajes ya no
sugieren que la persona deba cambiar el inicio de su apellido; recuerdan que
debe capturarse completo. El formulario incluye la misma indicacion.

Las particulas utilizadas son las documentadas en el apartado de criterios de
excepcion del [Instructivo Normativo para la Asignacion de la CURP (SEGOB, marzo de 2006)](https://www.ordenjuridico.gob.mx/Federal/PE/APF/APC/SEGOB/Instructivos/InstructivoNormativo.pdf#page=10):
DA, DAS, DE, DEL, DER, DI, DIE, DD, EL, LA, LOS, LAS, LE, LES, MAC, MC, VAN, VON, Y.

Se reconocen mayusculas, minusculas, acentos Unicode compuestos o descompuestos
y espacios repetidos o no separables. La normalizacion es solo para comparar:
el nombre y la CURP proporcionados no se reescriben con una clave calculada.

Este cambio no consulta RENAPO, no acredita la autenticidad de una CURP y no
genera una clave oficial. Se conservan las otras validaciones y el tratamiento
previo de X. No se alteran usuarios existentes, folios, roles, contrasenas ni
verificacion de correo. No requiere SQL ni modificaciones de `.env`.

## Pruebas

Los casos utilizan fechas y sufijos ficticios. No se utilizo la CURP real de la
persona que reporto la incidencia. Los servicios de base de datos y correo del
registro se simulan para estas pruebas: no crean cuentas ni envian mensajes.

```powershell
# back/Siimex
mvn '-Dtest=CurpValidatorTest,AuthServiceCurpTest' test
# front/Siimex, con CHROME_BIN configurado
npm test -- --watch=false --browsers=ChromeHeadless --include=src/app/pages/register/register.component.spec.ts
npm run build
```

Desplegar primero el backend para corregir el rechazo; actualizar despues el
frontend para mostrar la indicacion de captura. Confirmar en el servidor con
los datos del documento oficial de la persona interesada. No pedirle que
abrevie el apellido ni que modifique su CURP para sortear la validacion.
