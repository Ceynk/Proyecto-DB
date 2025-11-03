# Catálogo de Inventario - Vista de Materiales

## Funcionalidad Implementada

Se ha implementado una vista especial tipo **catálogo de productos** para la sección de **Inventario**, mostrando todos los materiales disponibles con sus fotos, información y estado de disponibilidad.

## Características

### Vista de Tarjetas
- **Diseño tipo catálogo**: Similar a tiendas online (Amazon, MercadoLibre, etc.)
- **Tarjetas visuales**: Cada material se muestra en una tarjeta con:
  - Foto del material (con imagen placeholder si no tiene foto)
  - Nombre del material
  - Cantidad disponible en inventario
  - Costo unitario
  - Tipo de material
  - Cantidad de movimientos registrados
  - Estado visual (Disponible/Agotado)

### Header Informativo
- **Estadísticas generales**:
  - Total de materiales
  - Materiales disponibles
  - Materiales agotados

### Funcionalidades
1. **Búsqueda**: Busca por nombre, tipo o costo del material
2. **Filtrado automático**: Solo muestra materiales que coinciden con la búsqueda
3. **Responsive**: Se adapta a móviles, tablets y desktop
4. **Interactivo**: Click en "Ver detalles" para seleccionar un material

### Cálculo de Inventario
El sistema calcula automáticamente la cantidad disponible:
- **Entradas**: Suman a la cantidad
- **Salidas**: Restan de la cantidad
- **Total**: Muestra la cantidad real disponible

### Diseño Visual
- **Colores del sistema**: Mantiene la paleta de colores oscura del diseño actual
- **Badges de estado**: 
  - Verde para "Disponible" (cantidad > 0)
  - Amarillo para "Agotado" (cantidad = 0)
- **Hover effects**: Las tarjetas se elevan al pasar el mouse
- **Transiciones suaves**: Animaciones fluidas en todos los elementos

## Uso

### Para Administradores:
1. Ir a la sección **Inventario** en el menú lateral
2. Ver el catálogo completo de materiales
3. Usar la barra de búsqueda para filtrar materiales
4. Click en "Ver detalles" para seleccionar un material y editarlo

### Gestión de Fotos:
- Las fotos se pueden subir desde la sección de **Material** (no Inventario)
- Subir foto → seleccionar material por ID → subir imagen
- Las fotos se muestran automáticamente en el catálogo de inventario

## Archivos Modificados

1. **public/script.js**:
   - Nueva función `renderizarInventarioCatalogo()`
   - Lógica de cálculo de inventario
   - Filtrado de búsqueda
   - Función `seleccionarMaterialInventario()`

2. **public/style.css**:
   - Estilos `.catalogo-inventario`
   - Estilos `.material-card` y componentes
   - Estilos `.catalogo-header` y estadísticas
   - Responsive design para móviles

3. **server.js**:
   - Columna `idMaterial` agregada a la consulta de inventario

4. **public/default-material.svg**:
   - Imagen placeholder para materiales sin foto

## Estructura de Datos

El catálogo consume datos de dos fuentes:
1. **Tabla `materials`**: Información base de materiales (nombre, foto, costo, tipo)
2. **Tabla `inventarios`**: Movimientos de entrada/salida

El sistema cruza ambas tablas para mostrar:
- Todos los materiales existentes
- Cantidad calculada según movimientos
- Información completa con fotos

## Responsive Design

- **Desktop**: Grid de 3-4 columnas
- **Tablet**: Grid de 2-3 columnas
- **Mobile**: 1 columna (tarjetas full-width)

Todos los elementos se adaptan automáticamente al tamaño de pantalla.

## Próximas Mejoras Sugeridas

1. **Exportar a PDF/Excel**: Reporte del inventario
2. **Gráficos**: Visualización de materiales más usados
3. **Alertas**: Notificación cuando un material esté por agotarse
4. **Historial**: Ver movimientos individuales de cada material
5. **Ordenamiento**: Por cantidad, costo, nombre, etc.
