// Revisa menu.json para avisar errores antes de mirar o publicar la carta.
// La usan servidor.mjs y publicar.mjs.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Devuelve false si menu.json está mal escrito (la carta no cargaría).
// "escribir" recibe cada línea del informe (por defecto, la ventana negra).
export async function revisarMenu(escribir = console.log) {
  const texto = await fs.readFile(path.join(RAIZ, "menu.json"), "utf8");
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch (e) {
    const pos = /position (\d+)/.exec(e.message);
    const linea = pos ? texto.slice(0, Number(pos[1])).split("\n").length : "?";
    escribir(`\n  ⚠  menu.json tiene un error de escritura cerca de la línea ${linea}.`);
    escribir("     Revisá comas, comillas y llaves. La carta no va a cargar hasta corregirlo.\n");
    return false;
  }
  const avisos = [];
  async function revisarFoto(foto, quien) {
    if (!foto) return;
    try {
      const { size } = await fs.stat(path.join(RAIZ, foto));
      if (size > 250 * 1024) avisos.push(`La foto de "${quien}" pesa ${Math.round(size / 1024)} KB (ideal: menos de 200 KB).`);
    } catch {
      avisos.push(`No encuentro la foto de "${quien}": ${foto} (se va a ver sin foto).`);
    }
  }
  for (const o of datos.ofertas || []) {
    if (!o.titulo) avisos.push("Hay una oferta sin nombre (no se muestra).");
    else if (o.precio == null) avisos.push(`La oferta "${o.titulo}" no tiene precio.`);
    await revisarFoto(o.foto, o.titulo || "oferta sin nombre");
  }
  for (const s of datos.sugerencias || []) {
    if (!s.nombre) avisos.push("Hay algo sin nombre en \"¿Le sumás algo?\" (no se muestra).");
    else if (s.precio == null) avisos.push(`"${s.nombre}" (en ¿Le sumás algo?) no tiene precio: no se muestra.`);
    await revisarFoto(s.foto, s.nombre || "agregado sin nombre");
  }
  const n = datos.negocio || {};
  await revisarFoto(n.portada, "portada");
  await revisarFoto(n.logo, "logo");
  for (const c of datos.categorias || []) {
    for (const p of c.productos || []) {
      if (!p.nombre) avisos.push(`Un producto de "${c.nombre}" no tiene nombre.`);
      if (p.precio == null && !(p.variantes || []).length) avisos.push(`"${p.nombre}" no tiene precio (va a decir "Consultar").`);
      await revisarFoto(p.foto, p.nombre);
    }
  }
  if (avisos.length) {
    escribir("\n  Avisos sobre menu.json:");
    for (const a of avisos) escribir("   - " + a);
  } else {
    escribir("\n  ✓ menu.json está bien escrito.");
  }
  return true;
}

// La dirección pública de la carta (qr.config.json), o "" si todavía es la de ejemplo.
export async function urlPublica() {
  try {
    const config = JSON.parse(await fs.readFile(path.join(RAIZ, "qr.config.json"), "utf8"));
    const url = String(config.url || "").trim();
    return /^https?:\/\//.test(url) && !url.includes("TU-USUARIO") ? url : "";
  } catch {
    return "";
  }
}
