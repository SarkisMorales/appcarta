// Muestra la carta en tu notebook y en tu celular (mismo WiFi) antes de publicarla.
// Uso: doble clic en VER-CARTA.bat (o "npm run ver"). Abre solo el navegador con el QR para el celular.
// También atiende al editor (EDITAR-CARTA.bat), que solo funciona desde esta misma notebook.
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { RAIZ, revisarMenu, urlPublica } from "./revisar-menu.mjs";
import { publicar } from "./publicar.mjs";

const PUERTO = Number(process.env.PUERTO) || 8080;
// Qué se abre en el navegador al arrancar: el QR (VER-CARTA.bat) o el editor (EDITAR-CARTA.bat).
const PAGINA_INICIAL = `http://localhost:${PUERTO}${process.env.ABRIR || "/qr"}`;
const MENU = path.join(RAIZ, "menu.json");
const MAX_FOTO = 30 * 1024 * 1024;

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// Primero el WiFi/cable de verdad; las redes virtuales (WSL, VirtualBox, VPN) al final o afuera.
function ipsLocales() {
  const virtual = /vethernet|virtual|vmware|vbox|hyper-v|wsl|loopback|tailscale|zerotier|vpn/i;
  const reales = [];
  const otras = [];
  for (const [nombre, lista] of Object.entries(os.networkInterfaces())) {
    for (const red of lista || []) {
      if (red.family !== "IPv4" || red.internal) continue;
      (virtual.test(nombre) ? otras : reales).push(red.address);
    }
  }
  return reales.length ? reales : otras;
}

function abrirNavegador(url) {
  if (process.platform !== "win32") return;
  spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
}

async function qrSvg(texto) {
  try {
    const QR = (await import("qrcode")).default;
    return await QR.toString(texto, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
  } catch {
    return ""; // sin la herramienta de QR instalada: se usa la dirección escrita
  }
}

function esc(texto) {
  return String(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// El editor y sus funciones solo responden a esta notebook: ni el celular en el WiFi
// ni otras páginas web abiertas en el navegador pueden cambiar la carta.
function esDeEstaNotebook(req) {
  const ip = req.socket.remoteAddress || "";
  const local = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
  const host = req.headers.host || "";
  return local && (host === `localhost:${PUERTO}` || host === `127.0.0.1:${PUERTO}`);
}

function responderJson(res, codigo, datos) {
  res.writeHead(codigo, { "Content-Type": TIPOS[".json"], "Cache-Control": "no-store" });
  res.end(JSON.stringify(datos));
}

async function leerCuerpo(req, limite) {
  const partes = [];
  let total = 0;
  for await (const parte of req) {
    total += parte.length;
    if (total > limite) throw new Error("El archivo es demasiado grande (máximo 30 MB).");
    partes.push(parte);
  }
  return Buffer.concat(partes);
}

function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function existe(archivo) {
  return fs.stat(archivo).then(() => true, () => false);
}

async function api(req, res, ruta, url) {
  // Otras páginas web no pueden mandar este encabezado sin permiso, así que no pueden usar el editor.
  if (req.method !== "GET" && req.headers["x-editor-carta"] !== "1") return responderJson(res, 403, { error: "No permitido." });

  if (ruta === "/api/menu" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": TIPOS[".json"], "Cache-Control": "no-store" });
    res.end(await fs.readFile(MENU, "utf8"));
    return;
  }

  if (ruta === "/api/menu" && req.method === "POST") {
    let datos;
    try {
      datos = JSON.parse((await leerCuerpo(req, 5 * 1024 * 1024)).toString("utf8"));
    } catch {
      return responderJson(res, 400, { error: "Los datos llegaron mal. Probá guardar de nuevo." });
    }
    if (!datos || typeof datos !== "object" || !Array.isArray(datos.categorias)) {
      return responderJson(res, 400, { error: "Los datos de la carta están incompletos." });
    }
    datos.actualizado = hoy();
    // Copia de lo que había antes, por si hace falta volver atrás (no se publica).
    await fs.copyFile(MENU, path.join(RAIZ, "menu.anterior.json")).catch(() => {});
    await fs.writeFile(MENU, JSON.stringify(datos, null, 2) + "\n");
    console.log("  ✓ Cambios guardados desde el editor.");
    return responderJson(res, 200, { ok: true, actualizado: datos.actualizado });
  }

  if (ruta === "/api/foto" && req.method === "POST") {
    try {
      const { nombreLimpio, optimizarFoto } = await import("./optimizar.mjs");
      const datos = await optimizarFoto(await leerCuerpo(req, MAX_FOTO));
      const base = nombreLimpio(url.searchParams.get("nombre"));
      await fs.mkdir(path.join(RAIZ, "fotos"), { recursive: true });
      // No pisa una foto que ya exista con el mismo nombre.
      let nombre = base + ".webp";
      for (let n = 2; await existe(path.join(RAIZ, "fotos", nombre)); n++) nombre = `${base}-${n}.webp`;
      await fs.writeFile(path.join(RAIZ, "fotos", nombre), datos);
      return responderJson(res, 200, { foto: "fotos/" + nombre, kb: Math.round(datos.length / 1024) });
    } catch (e) {
      const msg = /unsupported image format|heif|input buffer/i.test(String(e.message))
        ? "No puedo leer esa foto. Si es del iPhone (HEIC), abrila y guardala como JPG primero."
        : e.message;
      return responderJson(res, 400, { error: msg });
    }
  }

  if (ruta === "/api/publicar" && req.method === "POST") {
    const informe = [];
    const ok = await publicar((linea) => informe.push(linea), false);
    console.log(informe.join("\n"));
    return responderJson(res, 200, { ok, informe: informe.join("\n").trim() });
  }

  responderJson(res, 404, { error: "No encontrado." });
}

async function tarjeta(titulo, url, nota) {
  return `<section class="tarjeta">
    <h2>${esc(titulo)}</h2>
    <div class="qr">${await qrSvg(url)}</div>
    <a class="url" href="${esc(url)}" target="_blank">${esc(url)}</a>
    <p>${nota}</p>
  </section>`;
}

async function paginaQr() {
  const tarjetas = [];
  const publica = await urlPublica();
  if (publica) {
    tarjetas.push(await tarjeta("Carta publicada", publica,
      'Esta es la que imprimís. Funciona desde cualquier celular, con datos o cualquier WiFi.<br><a href="/qr/carta-qr.png" download>Descargar QR para imprimir</a>'));
  }
  for (const ip of ipsLocales()) {
    tarjetas.push(await tarjeta("Prueba en tu celular", `http://${ip}:${PUERTO}`,
      "Solo funciona si el celular está en el mismo WiFi que la notebook y esta ventana negra sigue abierta. Sirve para ver cambios <b>antes</b> de publicar."));
  }
  if (!tarjetas.length) tarjetas.push('<section class="tarjeta"><p>La notebook no está conectada a ninguna red WiFi.</p></section>');

  return `<!doctype html>
<html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>QR de la carta</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #FFF8F0; color: #2B1408; }
  header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; padding: 20px 28px; }
  h1 { margin: 0; font-size: 26px; }
  nav { display: flex; gap: 10px; flex-wrap: wrap; }
  .boton { background: #502314; color: #FFF8F0; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-weight: 700; }
  main { display: flex; flex-wrap: wrap; gap: 24px; justify-content: center; padding: 8px 24px 40px; }
  .tarjeta { background: #fff; border-radius: 20px; padding: 24px; width: 360px; box-shadow: 0 4px 18px rgba(80, 35, 20, .12); text-align: center; }
  .tarjeta h2 { margin: 0 0 12px; font-size: 20px; }
  .qr svg { width: 100%; height: auto; display: block; }
  .url { display: block; margin: 10px 0; font-weight: 700; color: #502314; word-break: break-all; }
  .tarjeta p { margin: 0; font-size: 14px; line-height: 1.45; }
  .tarjeta p a { color: #502314; font-weight: 700; }
  ${publica ? "" : ".aviso { max-width: 760px; margin: 0 auto 24px; padding: 0 24px; font-size: 14px; }"}
</style></head>
<body>
  <header><h1>Escaneá con el celular</h1><nav><a class="boton" href="/" target="_blank">Abrir la carta</a><a class="boton" href="/editar">Editar la carta</a></nav></header>
  ${publica ? "" : '<p class="aviso">Todavía no hay carta publicada en internet: cuando esté en GitHub, acá va a aparecer también el QR definitivo.</p>'}
  <main>${tarjetas.join("\n")}</main>
</body></html>`;
}

const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    let ruta = decodeURIComponent(url.pathname);
    if (ruta === "/editar" || ruta.startsWith("/editar/") || ruta.startsWith("/api/")) {
      if (!esDeEstaNotebook(req)) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("El editor solo se puede usar desde la notebook de la carta.");
        return;
      }
      if (ruta.startsWith("/api/")) return await api(req, res, ruta, url);
      // Con la barra final, el editor encuentra sus archivos (editor.js, editor.css) al lado.
      if (ruta === "/editar") {
        res.writeHead(302, { Location: "/editar/" });
        res.end();
        return;
      }
      ruta = "/herramientas/editor/" + ruta.slice("/editar/".length);
    }
    if (ruta === "/qr" || ruta === "/qr/") {
      res.writeHead(200, { "Content-Type": TIPOS[".html"], "Cache-Control": "no-cache" });
      res.end(await paginaQr());
      return;
    }
    if (ruta.endsWith("/")) ruta += "index.html";
    const archivo = path.join(RAIZ, path.normalize(ruta));
    if (!archivo.startsWith(RAIZ) || archivo.includes("node_modules")) throw new Error("fuera");
    const contenido = await fs.readFile(archivo);
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(archivo).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(contenido);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("No encontrado");
  }
});

servidor.listen(PUERTO, "0.0.0.0", async () => {
  await revisarMenu();
  console.log("\n  Carta funcionando. Dejá esta ventana abierta mientras la mirás.\n");
  console.log(`  En esta notebook:   http://localhost:${PUERTO}`);
  for (const ip of ipsLocales()) console.log(`  En el celular:      http://${ip}:${PUERTO}`);
  console.log(`\n  Se abrió el navegador en ${PAGINA_INICIAL}`);
  console.log(`  Editor de la carta: http://localhost:${PUERTO}/editar  (solo desde esta notebook)`);
  console.log("  Para cortar: cerrá esta ventana o apretá Ctrl + C.\n");
  abrirNavegador(PAGINA_INICIAL);
});

servidor.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    // Ya hay otra ventana de la carta abierta: se usa esa.
    console.log(`\n  La carta ya estaba abierta en otra ventana. Uso esa.\n`);
    abrirNavegador(PAGINA_INICIAL);
  } else {
    console.log(e);
    process.exitCode = 1;
  }
});
