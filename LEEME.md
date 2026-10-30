# Carta digital

Carta para celular que se abre escaneando un QR. Sitio estático: no tiene servidor ni base de datos.

## Uso de todos los días (accesos del escritorio)

1. **Editar carta**: abre el editor en el navegador. Cambiás precios, fotos, productos agotados, etc. y tocás **Guardar**.
2. Tocás **Ver carta** (arriba en el editor) para mirar cómo quedó.
3. Tocás **Publicar**: en 1 o 2 minutos la ve todo el mundo.

El editor solo funciona en esta notebook. La carta publicada en internet es solo de lectura: los clientes no pueden cambiar nada,
y el celular conectado al WiFi del local tampoco puede abrir el editor.
Antes de cada guardado queda una copia de lo anterior en `menu.anterior.json` (no se publica).

## Qué es cada archivo

| Archivo | Para qué sirve | ¿Lo tocás? |
|---|---|---|
| `EDITAR-CARTA.bat` | Abre el editor (acceso "Editar carta") | **Doble clic, es lo que más vas a usar** |
| `menu.json` | Productos, precios, fotos, categorías y datos del local | Lo cambia el editor; a mano solo si sabés |
| `fotos/` | Fotos ya optimizadas (WebP, 800 px) | Agregás fotos acá |
| `fotos-originales/` | Dejás acá las fotos del celular para achicarlas | Sí |
| `qr.config.json` | La dirección a la que apunta el QR | Una sola vez |
| `VER-CARTA.bat` | Abre el navegador con el QR para escanear y el botón para ver la carta | Doble clic |
| `PUBLICAR.bat` | Sube los cambios a GitHub: la carta publicada se actualiza en 1-2 minutos | Doble clic |
| `OPTIMIZAR-FOTOS.bat` | Pasa las fotos de `fotos-originales` a `fotos` (WebP, 800 px, ~200 KB). Con el editor no hace falta: ahí se achican solas | Doble clic |
| `GENERAR-QR.bat` | Crea `qr/carta-qr.png` y `qr/carta-qr.svg` | Doble clic |
| `index.html`, `estilos.css`, `carta.js` | El diseño y el funcionamiento | No hace falta |
| `herramientas/` | Los programas que usan los .bat | No |

Necesita Node instalado (ya lo tenés en la notebook por Crystal).

## Cómo escribir un producto en `menu.json` a mano (si no usás el editor)

```json
{
  "nombre": "Tostado de jamón y queso",
  "descripcion": "En pan de miga, bien dorado.",
  "precio": 5200,
  "foto": "fotos/tostado.webp",
  "etiqueta": "Nuevo",
  "precio_anterior": 6000,
  "disponible": false
}
```

- `nombre` y `precio` son obligatorios. El precio va **sin** `$` ni puntos: `5200` se muestra `$ 5.200`.
- `descripcion`, `foto`, `etiqueta` y `precio_anterior` son opcionales. Si no ponés foto, se muestra el emoji de la categoría.
- `"disponible": false` lo oculta sin borrarlo (agotado). Para volver a mostrarlo, borrá esa línea o poné `true`.
- Tamaños con distinto precio: en lugar de `precio`, usá
  `"variantes": [ { "nombre": "Jarrito", "precio": 2500 }, { "nombre": "Taza grande", "precio": 3200 } ]`
- Cuando cambies precios, cambiá también `"actualizado": "AAAA-MM-DD"`, que es la fecha que aparece al pie.

**Reglas que rompen todo si te olvidás:** cada producto va entre `{ }`, separado del siguiente por una coma,
y no lleva coma después del último. Los textos van entre comillas `" "`.
Si algo queda mal, la carta muestra un aviso con el número de línea a revisar, y `VER-CARTA.bat` también te avisa.
