// Achica una foto para la carta: WebP, máximo 800 px y unos 200 KB.
// La usan fotos.mjs (OPTIMIZAR-FOTOS.bat) y el editor de la carta.
import sharp from "sharp";

const ANCHO = 800;
const LIMITE = 200 * 1024;

// "Café con Leche.JPG" -> "cafe-con-leche"
export function nombreLimpio(texto) {
  return String(texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "foto";
}

// Recibe la ruta o el contenido de la foto y devuelve el WebP ya achicado.
// La portada se guarda más grande porque se ve de lado a lado: { ancho: 1400, limite: 240 KB }.
export async function optimizarFoto(entrada, { ancho = ANCHO, limite = LIMITE } = {}) {
  let calidad = 80;
  let datos;
  do {
    datos = await sharp(entrada)
      .rotate() // respeta la orientación de la foto del celular
      .resize({ width: ancho, height: ancho, fit: "inside", withoutEnlargement: true })
      .webp({ quality: calidad })
      .toBuffer();
    calidad -= 10;
  } while (datos.length > limite && calidad >= 40);
  return datos;
}
