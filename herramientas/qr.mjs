// Genera el código QR de la carta en PNG (para imprimir) y SVG (calidad infinita, para imprenta).
// La dirección se configura en qr.config.json. Uso: doble clic en GENERAR-QR.bat (o "npm run qr").
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await fs.readFile(path.join(RAIZ, "qr.config.json"), "utf8"));

const url = String(config.url || "").trim();
if (!/^https?:\/\//.test(url)) {
  console.log('\n  ⚠  En qr.config.json, "url" tiene que empezar con https://\n');
  process.exit(1);
}
if (url.includes("TU-USUARIO")) {
  console.log("\n  ⚠  Todavía no cambiaste la dirección de ejemplo en qr.config.json.");
  console.log("     Genero el QR igual para que lo veas, pero NO lo imprimas.\n");
}

const opciones = {
  errorCorrectionLevel: "M", // aguanta manchas o rayones chicos
  margin: 4, // borde blanco necesario para que lo lean bien
  color: { dark: config.color || "#000000", light: "#FFFFFF" },
};

const carpeta = path.join(RAIZ, "qr");
await fs.mkdir(carpeta, { recursive: true });
const png = path.join(carpeta, "carta-qr.png");
const svg = path.join(carpeta, "carta-qr.svg");

await QRCode.toFile(png, url, { ...opciones, type: "png", width: Number(config.tamano_png_px) || 2000 });
await fs.writeFile(svg, await QRCode.toString(url, { ...opciones, type: "svg" }));

console.log("  ✓ QR generado para: " + url);
console.log("    " + png);
console.log("    " + svg);
console.log("\n  Antes de imprimir, escanealo con tu celular y fijate que abra la carta.\n");
