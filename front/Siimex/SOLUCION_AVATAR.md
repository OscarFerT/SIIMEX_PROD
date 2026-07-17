# 🔧 Solución: Error "Cannot GET /assets/img/default-avatar.png"

## ✅ Cambios Realizados

1. **Ruta absoluta**: Cambiado de `'assets/img/default-avatar.png'` a `'/assets/img/default-avatar.png'` (con `/` al inicio)
2. **Constante reutilizable**: Agregada constante `DEFAULT_AVATAR` para evitar duplicación
3. **Manejo de errores mejorado**: Agregado fallback con SVG base64 si la imagen aún falla

## 🔍 Verificaciones Necesarias

### 1. Verificar que la imagen existe
La imagen debe estar en: `Front/front-comecyt/src/assets/img/default-avatar.png`

### 2. Reiniciar el servidor de desarrollo
```bash
# Detener el servidor (Ctrl+C)
# Luego reiniciar:
cd Front/front-comecyt
npm start
# o
ng serve
```

### 3. Limpiar caché del navegador
- Presiona `Ctrl + Shift + R` (o `Cmd + Shift + R` en Mac) para hacer un hard refresh
- O abre las herramientas de desarrollador (F12) → pestaña Network → marca "Disable cache"

### 4. Verificar la configuración de assets
El archivo `angular.json` debe tener:
```json
"assets": [
  {
    "glob": "**/*",
    "input": "src/assets",
    "output": "assets"
  }
]
```

### 5. Verificar que la imagen sea válida
- Abre `src/assets/img/default-avatar.png` en un visor de imágenes
- Asegúrate de que sea un archivo PNG válido

## 🚨 Si el problema persiste

### Opción 1: Verificar en la consola del navegador
1. Abre las herramientas de desarrollador (F12)
2. Ve a la pestaña "Network"
3. Intenta cargar la página
4. Busca la petición a `/assets/img/default-avatar.png`
5. Revisa el código de estado HTTP (debe ser 200, no 404)

### Opción 2: Verificar la ruta en tiempo de ejecución
Agrega un `console.log` temporal en `getFotoUrl()`:
```typescript
getFotoUrl(investigador: Investigador): string | SafeResourceUrl {
  if (investigador.fotoUrl) {
    return investigador.fotoUrl;
  }
  console.log('Usando avatar por defecto:', this.DEFAULT_AVATAR);
  return this.DEFAULT_AVATAR;
}
```

### Opción 3: Usar una imagen alternativa
Si la imagen sigue sin funcionar, puedes:
1. Reemplazar `default-avatar.png` con otra imagen
2. O usar el placeholder SVG base64 que ya está implementado como fallback

## 📝 Notas

- La ruta `/assets/img/default-avatar.png` es absoluta desde la raíz del servidor
- En desarrollo, Angular sirve los assets desde `src/assets/` como `/assets/`
- En producción, los assets se copian a `dist/comecyt-portal/assets/`
