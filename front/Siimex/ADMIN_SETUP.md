# Configuración del primer administrador

Para acceder al panel de administración (`/login/admin`), un usuario debe tener el rol `ROLE_ADMIN`.

## Asignar rol admin a un usuario existente (MySQL)

Ejecuta en tu base de datos (reemplaza `tu-correo@ejemplo.com` por el email del usuario que será admin):

```sql
INSERT INTO auth_user_roles (auth_user_id, role)
SELECT id, 'ROLE_ADMIN' FROM auth_users WHERE email = 'tu-correo@ejemplo.com' LIMIT 1;
```

Si la tabla usa otro nombre, puede ser `auth_users_roles`. Verifica el nombre de la tabla de roles en la entidad `AuthUser` (CollectionTable).

## Crear un usuario admin desde cero

1. Regístrate normalmente en la aplicación con el correo que quieras usar como admin.
2. Ejecuta el `INSERT` anterior con ese correo.
3. Entra en `/login/admin` con ese correo y tu contraseña.
