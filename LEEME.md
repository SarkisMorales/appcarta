# Carta digital

Carta para celular que se abre escaneando un QR. Sitio estático: no tiene servidor ni base de datos.

## Uso de todos los días (accesos del escritorio)

1. **Editar carta**: abre el editor en el navegador. Cambiás precios, fotos, productos agotados, etc. y tocás **Guardar**.
2. Tocás **Ver carta** (arriba en el editor) para mirar cómo quedó.
3. Tocás **Publicar**: en 1 o 2 minutos la ve todo el mundo.

El editor solo funciona en esta notebook. La carta publicada en internet es solo de lectura: los clientes no pueden cambiar nada,
y el celular conectado al WiFi del local tampoco puede abrir el editor.
Antes de cada guardado queda una copia de lo anterior en `menu.anterior.json` (no se publica).

## Herramientas para vender más (todo desde el editor)

- **Ofertas y combos** (bloque 🔥 del editor): salen arriba de todo, grandes y con foto, con el sello de descuento
  (ej. "-20%") y el precio normal tachado. Elegís **días**, **horario** y **fechas**: se prenden y apagan solas.
  Antes de que empiecen se ven con "Hoy desde las 16 h". Se pueden **pausar** sin borrarlas.
- **Precio antes** en un producto: sale tachado, con el sello de descuento, y el producto aparece también en Ofertas.
- **⭐ Recomendado**: el producto se ve en grande, primero en su categoría. Usalo para lo que más te conviene vender
  (mejor uno por categoría).
- **Mi pedido**: los clientes tocan "+" y arman su pedido con el total. Lo pueden mostrar al mozo en pantalla grande.
  La carta les sugiere sumar algo más ("Va bien con…", "¿Le sumás algo?").
- **Pedir por WhatsApp** (Datos del local → Pedidos): el pedido te llega escrito a tu WhatsApp, con nombre, total
  y aclaraciones. Si hacés envíos, también pide la dirección. Viene apagado: lo prendés cuando quieras.
- **Portada, logo y medios de pago**: en Datos del local.
- **Al compartir el link** por WhatsApp o Instagram aparece una tarjeta con foto, nombre y descripción. Se arma sola al guardar.
- **Buscador** (lupa) y botón **Compartir** en la carta.

Para ver cómo se ve la carta en otro momento (por ejemplo, a la hora de una oferta), agregá al final de la dirección
`?ahora=2026-11-02T18:30` (año-mes-día, T, hora:minutos).

Las fotos que empiezan con `prueba-` (en `fotos/`) son fotos de uso libre (CC0) para probar cómo se ve.
Cuando puedas, cambialas por fotos de tus productos: la gente compra lo que ve.

## Respaldo

Hay una copia de cómo estaba todo antes de la mejora del 30/10/2026: en GitHub (versión
`respaldo-antes-de-mejoras-2026-10-30`), en OneDrive (`Documentos\Respaldos carta digital`) y en `C:\appcarta\respaldos`.
Ahí mismo está `COMO-RESTAURAR.txt` con los pasos para volver atrás.

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
- `"destacado": true` lo muestra en grande, primero en su categoría (⭐ Recomendado).
- Tamaños con distinto precio: en lugar de `precio`, usá
  `"variantes": [ { "nombre": "Jarrito", "precio": 2500 }, { "nombre": "Taza grande", "precio": 3200 } ]`
- Cuando cambies precios, cambiá también `"actualizado": "AAAA-MM-DD"`, que es la fecha que aparece al pie.

Una oferta (en `"ofertas": [ ... ]`, arriba de las categorías) se escribe así. Todo es opcional menos `titulo` y `precio`;
`dias` usa `lun mar mie jue vie sab dom`; `desde`/`hasta` son horas y `inicio`/`fin` fechas; `"activa": false` la pausa:

```json
{ "titulo": "Desayuno completo", "descripcion": "Café con leche + 2 medialunas", "precio": 6500, "precio_anterior": 7700,
  "foto": "fotos/desayuno.webp", "etiqueta": "Combo", "dias": ["lun", "mar", "mie", "jue", "vie"],
  "desde": "08:00", "hasta": "11:30", "inicio": "2026-11-01", "fin": "2026-11-30" }
```

**Reglas que rompen todo si te olvidás:** cada producto va entre `{ }`, separado del siguiente por una coma,
y no lleva coma después del último. Los textos van entre comillas `" "`.
Si algo queda mal, la carta muestra un aviso con el número de línea a revisar, y `VER-CARTA.bat` también te avisa.
