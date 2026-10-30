// Sube los cambios a GitHub: la carta publicada se actualiza sola en 1 o 2 minutos.
// Uso: doble clic en PUBLICAR.bat (o "npm run publicar"), o el botón "Publicar" del editor.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RAIZ, revisarMenu, urlPublica } from "./revisar-menu.mjs";

// Devuelve true si quedó publicado. "escribir" recibe cada línea del informe.
// Con "enVentana" los mensajes de Git se ven en la ventana negra; si no, se juntan en el informe.
export async function publicar(escribir = console.log, enVentana = true) {
  function git(args, mostrar = false) {
    const r = spawnSync("git", args, { cwd: RAIZ, encoding: "utf8", stdio: mostrar && enVentana ? "inherit" : "pipe" });
    if (r.error) throw new Error("No encuentro Git instalado en esta notebook.");
    if (mostrar && !enVentana) escribir(((r.stdout || "") + (r.stderr || "")).trim());
    return r;
  }
  function cortar(mensaje) {
    escribir("\n  ⚠  " + mensaje + "\n");
    return false;
  }

  try {
    if (!(await revisarMenu(escribir))) return cortar("No publico nada hasta que menu.json esté bien escrito.");

    if (git(["remote", "get-url", "origin"]).status !== 0) {
      return cortar("Esta carpeta todavía no está conectada a un repositorio de GitHub.");
    }

    git(["add", "-A"]);
    const cambios = git(["status", "--porcelain"]).stdout.trim();
    if (cambios) {
      const ahora = new Date();
      const dos = (n) => String(n).padStart(2, "0");
      const cuando = `${dos(ahora.getDate())}/${dos(ahora.getMonth() + 1)}/${ahora.getFullYear()} ${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`;
      escribir("\n  Cambios a publicar:");
      escribir(cambios.split("\n").map((l) => "   " + l).join("\n"));
      if (git(["commit", "-q", "-m", `Carta actualizada ${cuando}`]).status !== 0) return cortar("No pude guardar los cambios.");
    } else {
      escribir("\n  No hay cambios nuevos desde la última vez. Me aseguro de que esté todo subido.");
    }

    escribir("\n  Subiendo a GitHub… (la primera vez se abre una ventana para iniciar sesión)\n");
    if (git(["push", "-u", "origin", "HEAD"], true).status !== 0) {
      return cortar("No se pudo subir a GitHub. Revisá que haya internet y volvé a intentar.");
    }
  } catch (e) {
    return cortar(e.message);
  }

  const url = await urlPublica();
  escribir("\n  ✓ Publicado. En 1 o 2 minutos la carta se actualiza" + (url ? " en:\n    " + url : "."));
  escribir("    (Si en el celular ves la versión vieja, recargá la página.)\n");
  return true;
}

// Doble clic en PUBLICAR.bat
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!(await publicar())) process.exitCode = 1;
}
