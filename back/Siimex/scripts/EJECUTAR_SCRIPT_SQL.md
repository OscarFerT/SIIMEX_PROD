# 📋 Instrucciones para Ejecutar el Script SQL

## 🎯 Objetivo
Cambiar el tipo de dato de las columnas `@Lob` de VARCHAR/TEXT a LONGTEXT para evitar errores de "Data too long".

## 📝 Pasos para Ejecutar

### ⚡ Opción Rápida: Script Batch (Windows)
```bash
# Navegar a la carpeta de scripts
cd Back\back-comecyt\scripts

# Ejecutar el script batch (doble clic o desde terminal)
ejecutar_fix_lob.bat
```

### Opción 1: Usando MySQL Command Line
```bash
# Conectar a MySQL
mysql -u root -p

# Ingresar la contraseña cuando se solicite: 1234

# Ejecutar el script
source Back/back-comecyt/scripts/fix_lob_columns.sql

# O ejecutar directamente:
mysql -u root -p1234 bd_siimex < Back/back-comecyt/scripts/fix_lob_columns.sql
```

### Opción 2: Usando MySQL Workbench o phpMyAdmin
1. Abre MySQL Workbench o phpMyAdmin
2. Conéctate a la base de datos `bd_siimex`
3. Abre el archivo `Back/back-comecyt/scripts/fix_lob_columns.sql`
4. Copia y pega el contenido en el editor SQL
5. Ejecuta el script

### Opción 3: Usando PowerShell (Windows)
```powershell
# Navegar a la carpeta del proyecto
cd "Back\back-comecyt\scripts"

# Ejecutar el script (ajustar la ruta de mysql si es necesario)
mysql -u root -p1234 bd_siimex < fix_lob_columns.sql
```

## ✅ Verificación

Después de ejecutar el script, verifica que los cambios se aplicaron correctamente ejecutando la consulta al final del script SQL o esta:

```sql
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    CASE 
        WHEN DATA_TYPE = 'longtext' THEN '✓ OK'
        ELSE '✗ NECESITA CAMBIO'
    END AS ESTADO
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_SCHEMA = 'bd_siimex'
    AND COLUMN_NAME IN (
        'logros', 
        'nombre_proyecto', 
        'titulo_tesis', 
        'nombre', 
        'interes_descripcion',
        'nombre_evento',
        'titulo_trabajo',
        'titulo',
        'nombre_revista',
        'fondo_programa_nombre'
    )
ORDER BY 
    TABLE_NAME, COLUMN_NAME;
```

Deberías ver que `DATA_TYPE` es `longtext` y `ESTADO` es `✓ OK` para todas estas columnas.

## ⚠️ Notas Importantes

1. **Backup**: Se recomienda hacer un backup de la base de datos antes de ejecutar el script:
   ```bash
   mysqldump -u root -p1234 bd_siimex > backup_bd_siimex_%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%.sql
   ```

2. **Tiempo de ejecución**: El cambio de tipo de columna puede tardar si hay muchos datos en las tablas.

3. **Reiniciar aplicación**: Después de ejecutar el script, **reinicia la aplicación Spring Boot** para que los cambios surtan efecto.

## 🔍 Si hay errores

Si alguna tabla no existe o tiene un nombre diferente, verifica primero:

```sql
SHOW TABLES LIKE '%trayectoria%';
SHOW TABLES LIKE '%estancia%';
SHOW TABLES LIKE '%logro%';
SHOW TABLES LIKE '%interes%';
SHOW TABLES LIKE '%curso%';
SHOW TABLES LIKE '%congreso%';
SHOW TABLES LIKE '%divulgacion%';
SHOW TABLES LIKE '%articulo%';
```

## 📊 Columnas que se modificarán

El script modificará las siguientes columnas:

- `trayectorias_profesionales.logros`
- `estancias.logros`
- `estancias.nombre_proyecto`
- `trayectorias_academicas.titulo_tesis`
- `logros.nombre`
- `intereses_habilidades.interes_descripcion`
- `cursos.nombre`
- `congresos.nombre_evento`
- `congresos.titulo_trabajo`
- `divulgaciones.titulo`
- `articulos.nombre_revista`
- `articulos.titulo`
- `articulos.fondo_programa_nombre`
