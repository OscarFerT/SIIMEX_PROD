# Configuración del correo 2FA con Microsoft Graph API

La verificación en dos pasos envía códigos por correo usando **Microsoft Graph API** (no SMTP).

## Requisitos en Azure Portal

1. **Registro de aplicación** en Azure AD / Entra ID
2. **Permiso**: `Mail.Send` (aplicación)
3. **Consentimiento de administrador** para ese permiso
4. **Buzón**: Un correo en el tenant desde el cual enviar (ej. `noreply@comecyt.gob.mx`)

## Variables de entorno (NUNCA pongas el secret en código)

| Variable | Descripción |
|----------|-------------|
| `AZURE_CLIENT_ID` | Id. de aplicación (cliente) |
| `AZURE_TENANT_ID` | Id. de directorio (inquilino) |
| `AZURE_CLIENT_SECRET` | Valor del secret (rotar si lo expusiste) |
| `AZURE_SENDER_EMAIL` | Buzón remitente (ej. noreply@comecyt.gob.mx) |

## Ejemplo local (application-local.properties, no subir a Git)

```properties
azure.client-id=TU_CLIENT_ID
azure.tenant-id=TU_TENANT_ID
azure.client-secret=TU_CLIENT_SECRET
azure.sender-email=noreply@comecyt.gob.mx
```

Ejecutar: `mvnw spring-boot:run -Dspring-boot.run.profiles=local`

## Producción (Render, etc.)

Configurar las variables en el panel de tu proveedor.  
**Importante**: Rota el Client Secret si alguna vez lo compartiste o lo pusiste en código.
