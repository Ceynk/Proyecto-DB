# 🎯 Guía Rápida - Catálogo de Inventario

## 📦 ¿Qué es?

Una vista visual tipo catálogo/tienda que muestra todos los materiales de construcción con:
- 📸 Fotos de los materiales
- 📊 Cantidad disponible
- 💰 Precio unitario
- 🏷️ Tipo de material
- ✅ Estado (Disponible/Agotado)

## 🚀 Inicio Rápido

### 1️⃣ Iniciar el Servidor
```bash
npm install
npm run dev
```

### 2️⃣ Acceder al Sistema
- Abrir: http://localhost:5175
- Usuario: `admin`
- Contraseña: `admin123`
- Verificar código de email (revisar consola del servidor)

### 3️⃣ Ver el Catálogo
- Click en **"Inventario"** en el menú izquierdo
- ¡Verás el catálogo completo!

## 📝 Agregar Materiales con Foto

### Paso 1: Crear Material
1. Ir a sección **"Material"** (menú lateral)
2. Llenar formulario:
   - Nombre: Ej. "Cemento Portland"
   - Costo unitario: Ej. 25000
   - Tipo: Ej. "Material de construcción"
3. Click en **"Guardar"**

### Paso 2: Subir Foto
1. En la misma sección "Material"
2. Buscar el nuevo material en la lista
3. Click en **"Seleccionar ID"**
4. Scroll hacia abajo
5. En "Imagen (solo Empleado o Material)":
   - Click en "Choose File"
   - Seleccionar imagen JPG/PNG
   - Click en **"Subir imagen"**

### Paso 3: Registrar en Inventario
1. Ir a sección **"Inventario"**
2. En el formulario de crear:
   - Tipo de movimiento: "Entrada"
   - Cantidad: Ej. 50
   - Fecha: Seleccionar fecha
   - idMaterial: Seleccionar el material creado
   - idProyecto: Seleccionar un proyecto
3. Click en **"Guardar"**

### Paso 4: Ver en Catálogo
1. Recargar la vista de Inventario
2. ¡El material aparecerá con su foto y cantidad!

## 🔍 Buscar Materiales

1. En la vista de Inventario (catálogo)
2. Usar la barra de búsqueda arriba
3. Escribir:
   - Nombre del material
   - Tipo de material
   - Precio
4. El catálogo se filtrará automáticamente

## 📊 Entender las Estadísticas

En la parte superior del catálogo verás:

- **Materiales**: Total de materiales diferentes
- **Disponibles**: Materiales con cantidad > 0
- **Agotados**: Materiales con cantidad = 0

## 🏷️ Badges de Estado

Cada tarjeta muestra un badge:
- 🟢 **Verde "Disponible"**: Hay unidades en inventario
- 🟡 **Amarillo "Agotado"**: No hay unidades

## 💡 Datos de Prueba

Para probar rápidamente con datos de ejemplo:

```bash
# En tu cliente MySQL
source datos_prueba.sql
```

Esto creará:
- 10 materiales de ejemplo
- Movimientos de entrada y salida
- Un proyecto de prueba

## 🎨 Características Visuales

- ✅ Tarjetas con hover effect (se elevan)
- ✅ Imágenes con zoom suave
- ✅ Placeholder automático si falta foto
- ✅ Responsive (funciona en móvil)
- ✅ Estadísticas destacadas
- ✅ Colores del sistema

## 📱 Vista Móvil

En celulares y tablets:
- Las tarjetas se ajustan automáticamente
- Grid de 1 columna en móvil
- Todos los elementos son touch-friendly
- Scroll vertical fluido

## ⚡ Tips Rápidos

1. **Para materiales sin foto**: Se muestra un icono de caja automáticamente
2. **Para editar material**: Click en "📋 Ver detalles" en la tarjeta
3. **Para ver movimientos**: Ir a la tabla normal (cambiar a otra entidad y volver)
4. **Para calcular inventario**: Las entradas suman, las salidas restan

## ❓ Solución de Problemas

### No veo el catálogo
- ✅ Verificar que seas Administrador
- ✅ Verificar que existan materiales en la BD
- ✅ Abrir consola del navegador (F12) para ver errores

### No se ven las fotos
- ✅ Verificar que la foto se subió correctamente
- ✅ Verificar carpeta `/uploads/` existe
- ✅ Refrescar la página (F5)

### Las cantidades están mal
- ✅ Verificar los movimientos en la BD
- ✅ Verificar que tipo_movimiento sea "Entrada" o "Salida"
- ✅ Verificar que las cantidades sean números positivos

## 🎯 Siguiente Paso

¡Empieza a agregar tus propios materiales con fotos y gestiona tu inventario visualmente!

---

**Nota**: Esta funcionalidad solo está disponible para usuarios con rol **Administrador**. Los empleados ven una vista diferente con su información personal.
