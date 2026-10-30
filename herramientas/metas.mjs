// Completa en index.html lo que se ve al compartir el link de la carta por WhatsApp, Instagram o Facebook:
// nombre del local, una descripción y una foto (fotos/compartir.jpg, 1200 × 630).
// También avisa al celular que baje la foto de portada apenas abre la carta (carga más rápido).
// Lo usan el editor al guardar y PUBLICAR, así siempre coincide con la carta.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { RAIZ, urlPublica } from "./revisar-menu.mjs";

const INICIO = "<!-- PARA-COMPARTIR: lo completa solo el editor al guardar (nombre, foto y descripción que se ven al pasar el link por WhatsApp) -->";
const FIN = "<!-- /PARA-COMPARTIR -->";
const FOTO = "fotos/compartir.jpg";

function esc(texto) {
  return String(texto ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function existe(relativa) {
  return relativa ? fs.stat(path.join(RAIZ, relativa)).then(() => true, () => false) : false;
}

// La mejor foto para la vista previa: portada, un recomendado, una oferta, el logo o cualquier producto.
async function elegirFoto(datos) {
  const n = datos.negocio || {};
  const productos = (datos.categorias || []).filter((c) => c.disponible !== false).flatMap((c) => c.productos || []);
  const candidatas = [
    [n.portada, false],
    ...productos.filter((p) => p.destacado && p.disponible !== false).map((p) => [p.foto, false]),
    ...(datos.ofertas || []).filter((o) => o.activa !== false).map((o) => [o.foto, false]),
    [n.logo, true],
    ...productos.filter((p) => p.disponible !== false).map((p) => [p.foto, false]),
  ];
  for (const [foto, esLogo] of candidatas) if (await existe(foto)) return { foto, esLogo };
  return null;
}

async function armarFoto(elegida) {
  const sharp = (await import("sharp")).default;
  const origen = path.join(RAIZ, elegida.foto);
  const imagen = elegida.esLogo
    ? sharp(origen).resize(1200, 630, { fit: "contain", background: "#2B1408" })
    : sharp(origen).resize(1200, 630, { fit: "cover", position: "attention" });
  const datos = await imagen.flatten({ background: "#2B1408" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  await fs.writeFile(path.join(RAIZ, FOTO), datos);
  return crypto.createHash("sha1").update(datos).digest("hex").slice(0, 8);
}

export async function actualizarMetas() {
  const archivoHtml = path.join(RAIZ, "index.html");
  const html = await fs.readFile(archivoHtml, "utf8");
  const i = html.indexOf(INICIO);
  const f = html.indexOf(FIN);
  if (i === -1 || f === -1) return false;

  const datos = JSON.parse(await fs.readFile(path.join(RAIZ, "menu.json"), "utf8"));
  const n = datos.negocio || {};
  const nombre = String(n.nombre || "Carta").trim();
  const titulo = `${nombre} · Carta`;
  const quien = [n.subtitulo, n.direccion].filter(Boolean).join(" · ");
  const hayOfertas = (datos.ofertas || []).some((o) => o.activa !== false);
  const descripcion = `${quien ? quien + ". " : ""}Mirá la carta con fotos y precios actualizados${hayOfertas ? ", y las ofertas del día" : ""}.`;
  const base = await urlPublica();

  let foto = null;
  const elegida = await elegirFoto(datos);
  if (elegida) {
    try {
      foto = `${FOTO}?v=${await armarFoto(elegida)}`;
    } catch (e) {
      console.log("  (No pude preparar la foto para compartir: " + e.message + ")");
    }
  }

  const lineas = [
    INICIO,
    `<title>${esc(titulo)}</title>`,
    `<meta name="description" content="${esc(descripcion)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="es_AR">`,
    `<meta property="og:site_name" content="${esc(nombre)}">`,
    `<meta property="og:title" content="${esc(titulo)}">`,
    `<meta property="og:description" content="${esc(descripcion)}">`,
  ];
  if (base) lineas.push(`<meta property="og:url" content="${esc(base)}">`);
  if (base && foto) {
    lineas.push(
      `<meta property="og:image" content="${esc(base + foto)}">`,
      `<meta property="og:image:width" content="1200">`,
      `<meta property="og:image:height" content="630">`,
      `<meta property="og:image:alt" content="${esc(nombre)}">`,
      `<meta name="twitter:card" content="summary_large_image">`);
  }
  // La portada es lo más grande de la pantalla: que el celular empiece a bajarla de entrada.
  if (await existe(n.portada)) lineas.push(`<link rel="preload" as="image" href="${esc(n.portada)}" fetchpriority="high">`);
  lineas.push(FIN);
  const nuevo = html.slice(0, i) + lineas.join("\n  ") + html.slice(f + FIN.length);
  if (nuevo !== html) await fs.writeFile(archivoHtml, nuevo);
  return true;
}
