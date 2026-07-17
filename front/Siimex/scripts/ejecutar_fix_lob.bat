@echo off
REM Script para ejecutar el fix de columnas LOB en MySQL
REM Asegúrate de tener MySQL en el PATH o ajusta la ruta

echo ========================================
echo Ejecutando script SQL para cambiar columnas @Lob a LONGTEXT
echo ========================================
echo.

REM Verificar si MySQL está disponible
where mysql >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: MySQL no está en el PATH
    echo Por favor, ejecuta el script manualmente usando MySQL Workbench o phpMyAdmin
    pause
    exit /b 1
)

REM Ejecutar el script SQL
echo Ejecutando script SQL...
mysql -u root -p1234 bd_siimex < "%~dp0fix_lob_columns.sql"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Script ejecutado exitosamente!
    echo ========================================
    echo.
    echo Las columnas @Lob han sido cambiadas a LONGTEXT.
    echo Reinicia la aplicación Spring Boot para aplicar los cambios.
) else (
    echo.
    echo ========================================
    echo ERROR al ejecutar el script
    echo ========================================
    echo.
    echo Verifica:
    echo 1. Que MySQL esté corriendo
    echo 2. Que la base de datos 'bd_siimex' exista
    echo 3. Que el usuario 'root' tenga permisos
    echo 4. Que la contraseña sea '1234'
)

echo.
pause
