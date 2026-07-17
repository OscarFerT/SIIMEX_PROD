# 📋 Cómo Ver los Logs del Backend

## 📍 Ubicación de los Logs

### 1. **Consola/Terminal** (Logs en tiempo real)
Los logs se muestran en la **consola donde ejecutas el servidor Spring Boot**.

**Para ver los logs:**
- Abre la terminal donde ejecutaste `.\mvnw.cmd spring-boot:run` o ejecutaste el JAR
- Los logs aparecen en tiempo real con el formato: `HH:mm:ss.SSS [thread] LEVEL logger - mensaje`

### 2. **Archivo de Log** (Logs guardados)
Los logs también se guardan en un archivo para revisión posterior.

**Ubicación del archivo:**
```
Back/back-comecyt/logs/comecyt-application.log
```

**Características:**
- ✅ Se guarda automáticamente
- ✅ Rotación automática cuando alcanza 10MB
- ✅ Mantiene hasta 30 archivos históricos
- ✅ Formato: `yyyy-MM-dd HH:mm:ss [thread] LEVEL logger - mensaje`

## 🔍 Buscar Errores en los Logs

### En la Consola:
Busca líneas que contengan:
- `ERROR` - Errores críticos
- `WARN` - Advertencias
- `>>> Error` - Errores específicos de migración

### En el Archivo:
1. Abre `Back/back-comecyt/logs/comecyt-application.log`
2. Busca con Ctrl+F:
   - `ERROR`
   - `PerfilMigracionController`
   - `PerfilCompletoService`
   - `>>> Error`

## 📝 Ejemplo de Logs de Error

Cuando hay un error, verás algo como:
```
2026-01-23 10:30:45 [http-nio-8083-exec-1] ERROR c.e.p.d.c.PerfilMigracionController - >>> Error inesperado al procesar perfil: ...
2026-01-23 10:30:45 [http-nio-8083-exec-1] ERROR c.e.p.d.c.PerfilMigracionController - >>> Stack trace completo:
java.lang.NullPointerException
    at com.example.proyecto.demo.controller.PerfilMigracionController.crear(...)
    ...
```

## 🛠️ Ver Logs en Tiempo Real (Windows PowerShell)

```powershell
# Navegar a la carpeta de logs
cd "Back\back-comecyt\logs"

# Ver el archivo de log en tiempo real (similar a tail -f en Linux)
Get-Content comecyt-application.log -Wait -Tail 50
```

## 🛠️ Ver Logs en Tiempo Real (Git Bash o WSL)

```bash
# Navegar a la carpeta de logs
cd Back/back-comecyt/logs

# Ver el archivo de log en tiempo real
tail -f comecyt-application.log
```

## 📊 Niveles de Log Configurados

- **DEBUG**: `PerfilMigracionController`, `PerfilCompletoService`
- **TRACE**: Hibernate SQL queries
- **INFO**: Operaciones normales
- **WARN**: Advertencias
- **ERROR**: Errores

## 🔧 Si No Ves Logs

1. **Verifica que el servidor esté corriendo**
2. **Verifica que la carpeta `logs/` exista** (se crea automáticamente)
3. **Revisa los permisos de escritura** en la carpeta del proyecto
4. **Revisa la consola** donde ejecutaste el servidor
