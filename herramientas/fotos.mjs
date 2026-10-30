// Achica las fotos para la carta: WebP, máximo 800 px de ancho y unos 200 KB.
// Poné las fotos originales (JPG, PNG o WebP) en la carpeta "fotos-originales"
// y hacé doble clic en OPTIMIZAR-FOTOS.bat (o "npm run fotos"). Quedan en "fotos".
// (Desde el editor de la carta no hace falta: ahí las fotos se achican solas.)
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nombreLimpio, optimizarFoto } from "./optimizar.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENTRADA = path.join(RAIZ, "fotos-originales");
const SALIDA = path.join(RAIZ, "fotos");

await fs.mkdir(SALIDA, { recursive: true });
const archivos = (await fs.readdir(ENTRADA)).filter((a) => /\.(jpe?g|png|webp)$/i.test(a));

if (!archivos.length) {
  console.log('\n  No hay fotos en "fotos-originales". Copiá ahí las fotos (JPG, PNG o WebP) y volvé a probar.');
  console.log("  Las fotos HEIC del iPhone: abrilas y guardalas como JPG primero.\n");
  process.exit(0);
}

for (const archivo of archivos) {
  const nombre = nombreLimpio(path.parse(archivo).name);
  const destino = path.join(SALIDA, nombre + ".webp");
  const datos = await optimizarFoto(path.join(ENTRADA, archivo));
  await fs.writeFile(destino, datos);
  console.log(`  ✓ ${archivo}  →  fotos/${path.basename(destino)}  (${Math.round(datos.length / 1024)} KB)`);
}
console.log('\n  En menu.json poné, por ejemplo:  "foto": "fotos/' + nombreLimpio(path.parse(archivos[0]).name) + '.webp"\n');
