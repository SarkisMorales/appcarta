// Editor de la carta: cambia menu.json desde el navegador, sin bloc de notas.
// Solo funciona abierto desde la notebook (acceso "Editar carta"): en internet la carta es solo de lectura.
"use strict";

const ETIQUETAS = ["Nuevo", "Promo", "Más pedido", "Recomendado", "Sin TACC", "Vegano"];
const EMOJIS = ["☕", "🥐", "🥤", "🧃", "🍰", "🧁", "🍪", "🍫", "🍦", "🥪", "🍕", "🍔", "🌭", "🥗", "🍝", "🥟", "🌮", "🍳", "🍺", "🍷", "🛒", "🍽️"];

const $ = (selector) => document.querySelector(selector);

let datos = null;
let sinGuardar = false;
let guardando = false;
let negocioAbierto = false;
let porEnfocar = null; // producto recién agregado: se pone el cursor en su nombre
const abiertos = new Set(); // productos con todos los datos desplegados

// ---------- Utilidades ----------

// el("div", { class: "x", onclick: fn }, hijo1, hijo2…)
function el(tag, props = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [clave, valor] of Object.entries(props)) {
    if (valor == null || valor === false) continue;
    if (clave.startsWith("on")) e.addEventListener(clave.slice(2), valor);
    else if (clave === "class") e.className = valor;
    else if (clave in e && clave !== "list") e[clave] = valor;
    else e.setAttribute(clave, valor === true ? "" : valor);
  }
  for (const h of hijos.flat()) if (h != null && h !== false) e.append(h);
  return e;
}

// 5200 -> "5.200"
function pesos(n) {
  return n == null || n === "" ? "" : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// "$ 5.200" -> 5200 ; "" -> null
function leerPrecio(texto) {
  const digitos = String(texto).replace(/\D/g, "");
  return digitos ? Number(digitos) : null;
}

async function pedir(url, opciones = {}) {
  let r;
  try {
    r = await fetch(url, { ...opciones, cache: "no-store", headers: { "X-Editor-Carta": "1", ...(opciones.headers || {}) } });
  } catch {
    throw new Error("No me puedo comunicar con la notebook. ¿Cerraste la ventana negra de la carta? Volvé a abrir “Editar carta”.");
  }
  let cuerpo = null;
  try { cuerpo = await r.json(); } catch { /* respuesta sin datos */ }
  if (!r.ok) throw new Error((cuerpo && cuerpo.error) || "Algo salió mal. Probá de nuevo.");
  return cuerpo;
}

let temporizadorAviso = null;
function avisar(texto, tipo = "") {
  const aviso = $("#aviso");
  aviso.textContent = texto;
  aviso.className = "aviso visible " + tipo;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { aviso.className = "aviso " + tipo; }, tipo === "error" ? 7000 : 3500);
}

function mostrarDialogo(titulo, ...contenido) {
  $("#dialogo-titulo").textContent = titulo;
  $("#dialogo-cuerpo").replaceChildren(...contenido);
  const d = $("#dialogo");
  if (!d.open) d.showModal();
}

// ---------- Estado de guardado ----------

function marcar() {
  sinGuardar = true;
  actualizarEstado();
}

function actualizarEstado() {
  const estado = $("#estado");
  if (guardando) {
    estado.textContent = "Guardando…";
    estado.className = "estado";
  } else if (sinGuardar) {
    estado.textContent = "Cambios sin guardar";
    estado.className = "estado pendiente";
  } else {
    estado.textContent = "✓ Todo guardado";
    estado.className = "estado listo";
  }
  $("#guardar").disabled = !sinGuardar || guardando;
}

// ---------- Campos ----------

function campoTexto(etiqueta, obj, clave, opciones = {}) {
  const props = {
    value: obj[clave] ?? "",
    placeholder: opciones.placeholder || "",
    class: opciones.enfocar ? "enfocar" : null,
    oninput: (e) => {
      const v = e.target.value;
      if (v.trim() || opciones.guardarVacio) obj[clave] = v;
      else delete obj[clave];
      marcar();
      if (opciones.alCambiar) opciones.alCambiar(v);
    },
  };
  const control = opciones.largo
    ? el("textarea", { ...props, rows: 2 })
    : el("input", { type: "text", ...props, list: opciones.lista });
  return el("label", { class: "campo" },
    el("span", {}, etiqueta),
    control,
    opciones.ayuda ? el("small", {}, opciones.ayuda) : null);
}

function campoPrecio(etiqueta, obj, clave, opciones = {}) {
  const input = el("input", {
    type: "text",
    inputmode: "numeric",
    value: pesos(obj[clave]),
    placeholder: opciones.placeholder || "Precio",
    "aria-label": etiqueta || opciones.placeholder || "Precio",
    oninput: (e) => {
      const n = leerPrecio(e.target.value);
      if (n == null) delete obj[clave];
      else obj[clave] = n;
      marcar();
    },
    onblur: (e) => { e.target.value = pesos(obj[clave]); },
  });
  return el("label", { class: "campo precio" },
    etiqueta ? el("span", {}, etiqueta) : null,
    el("div", { class: "con-signo" }, el("b", {}, "$"), input));
}

function interruptor(encendido, texto, alCambiar, titulo) {
  return el("label", { class: "interruptor", title: titulo },
    el("input", { type: "checkbox", checked: encendido, onchange: (e) => alCambiar(e.target.checked) }),
    el("span", { class: "pista" }),
    el("span", { class: "texto" }, texto));
}

function botonesMover(lista, i) {
  const mover = (destino) => {
    const [item] = lista.splice(i, 1);
    lista.splice(destino, 0, item);
    marcar();
    dibujar();
  };
  return el("span", { class: "mover" },
    el("button", { type: "button", class: "icono", title: "Subir", disabled: i === 0, onclick: () => mover(i - 1) }, "↑"),
    el("button", { type: "button", class: "icono", title: "Bajar", disabled: i === lista.length - 1, onclick: () => mover(i + 1) }, "↓"));
}

// Foto de un producto o logo del local: se achica sola en la notebook y queda en la carpeta fotos.
function bloqueFoto(obj, clave, nombreSugerido, alternativa, rotulo) {
  const estado = el("small", { class: "estado-foto" }, obj[clave] ? "" : "Sin foto: se muestra el emoji.");

  async function subir(archivo) {
    if (!archivo) return;
    if (!archivo.type.startsWith("image/") && !/\.(heic|heif)$/i.test(archivo.name)) {
      estado.textContent = "Eso no es una foto.";
      return;
    }
    estado.textContent = "Achicando y guardando la foto…";
    try {
      const nombre = nombreSugerido() || archivo.name.replace(/\.[^.]+$/, "");
      const r = await pedir("/api/foto?nombre=" + encodeURIComponent(nombre), { method: "POST", body: archivo });
      obj[clave] = r.foto;
      marcar();
      dibujar();
      avisar(`Foto lista (${r.kb} KB). Acordate de guardar.`);
    } catch (e) {
      estado.textContent = e.message;
    }
  }

  const archivo = el("input", { type: "file", accept: "image/*", hidden: true, onchange: (e) => subir(e.target.files[0]) });
  const vista = el("div", {
    class: "foto-vista",
    title: "Podés arrastrar una foto acá",
    ondragover: (e) => { e.preventDefault(); vista.classList.add("arrastrando"); },
    ondragleave: () => vista.classList.remove("arrastrando"),
    ondrop: (e) => { e.preventDefault(); vista.classList.remove("arrastrando"); subir(e.dataTransfer.files[0]); },
    onclick: () => archivo.click(),
  }, obj[clave] ? el("img", { src: "/" + obj[clave], alt: "" }) : el("span", {}, alternativa));

  return el("div", { class: "foto" },
    el("span", { class: "rotulo" }, rotulo),
    vista,
    el("div", { class: "botones-foto" },
      el("button", { type: "button", class: "btn secundario chico", onclick: () => archivo.click() }, obj[clave] ? "Cambiar foto" : "Subir foto"),
      obj[clave] ? el("button", { type: "button", class: "link peligro", onclick: () => { delete obj[clave]; marcar(); dibujar(); } }, "Quitar") : null),
    estado,
    archivo);
}

// ---------- Bloques ----------

function bloqueNegocio() {
  const n = datos.negocio;
  return el("details", { class: "bloque negocio", open: negocioAbierto, ontoggle: (e) => { negocioAbierto = e.target.open; } },
    el("summary", {}, el("strong", {}, "Datos del local"), el("span", {}, " · nombre, horario, WhatsApp, Instagram, logo")),
    el("div", { class: "columnas" },
      el("div", { class: "grilla" },
        campoTexto("Nombre del local", n, "nombre", { guardarVacio: true }),
        campoTexto("Debajo del nombre", n, "subtitulo", { guardarVacio: true, placeholder: "Ej.: Cafetería · Minimarket" }),
        campoTexto("Dirección", n, "direccion", { guardarVacio: true }),
        campoTexto("Horario", n, "horario", { guardarVacio: true, placeholder: "Ej.: Lunes a sábado de 8 a 21 h" }),
        campoTexto("WhatsApp", n, "whatsapp", { guardarVacio: true, placeholder: "Ej.: 5492611234567", ayuda: "Con 549 y el código de área, sin 0 ni 15. Vacío = no aparece." }),
        campoTexto("Instagram", n, "instagram", { guardarVacio: true, placeholder: "Ej.: tucafe", ayuda: "Solo el usuario, sin @. Vacío = no aparece." })),
      bloqueFoto(n, "logo", () => "logo", "Sin logo", "Logo (opcional)")));
}

function coincide(p) {
  const filtro = $("#buscar").value.trim().toLowerCase();
  if (!filtro) return true;
  const quitarTildes = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return quitarTildes(p.nombre + " " + (p.descripcion || "")).includes(quitarTildes(filtro));
}

function bloqueTamanos(p) {
  const con = Array.isArray(p.variantes) && p.variantes.length > 0;
  const caja = el("div", { class: "tamanos-caja" },
    el("label", { class: "check" },
      el("input", {
        type: "checkbox",
        checked: con,
        onchange: (e) => {
          if (e.target.checked) {
            p.variantes = [{ nombre: "", precio: p.precio ?? null }, { nombre: "", precio: null }];
            delete p.precio;
          } else {
            const primero = (p.variantes || []).find((v) => v.precio != null);
            if (primero) p.precio = primero.precio;
            delete p.variantes;
          }
          marcar();
          dibujar();
        },
      }),
      " Tiene tamaños o versiones con distinto precio"));
  if (con) {
    p.variantes.forEach((v, i) => caja.append(el("div", { class: "variante" },
      el("input", { type: "text", value: v.nombre || "", placeholder: "Ej.: Taza grande", "aria-label": "Nombre del tamaño", oninput: (e) => { v.nombre = e.target.value; marcar(); } }),
      campoPrecio(null, v, "precio"),
      el("button", {
        type: "button", class: "icono", title: "Quitar este tamaño",
        onclick: () => { p.variantes.splice(i, 1); if (!p.variantes.length) delete p.variantes; marcar(); dibujar(); },
      }, "✕"))));
    caja.append(el("button", { type: "button", class: "link", onclick: () => { p.variantes.push({ nombre: "", precio: null }); marcar(); dibujar(); } }, "+ Agregar tamaño"));
  }
  return caja;
}

function tarjetaProducto(c, ci, p, pi) {
  const abierto = abiertos.has(p);
  const agotado = p.disponible === false;
  const alternar = () => { abierto ? abiertos.delete(p) : abiertos.add(p); dibujar(); };

  const titulo = el("strong", {}, p.nombre || "Producto sin nombre");
  const bajada = el("small", {}, agotado ? "Agotado: no aparece en la carta" : p.descripcion || "");
  const precio = p.variantes && p.variantes.length
    ? el("button", { type: "button", class: "tamanos", onclick: alternar }, `${p.variantes.length} tamaños`)
    : campoPrecio(null, p, "precio");

  const fila = el("div", { class: "fila" },
    el("div", { class: "mini", onclick: alternar }, p.foto ? el("img", { src: "/" + p.foto, alt: "" }) : el("span", {}, c.emoji || "🍽️")),
    el("button", { type: "button", class: "nombre", onclick: alternar }, titulo, bajada),
    precio,
    interruptor(!agotado, agotado ? "Agotado" : "En venta", (on) => {
      if (on) delete p.disponible;
      else p.disponible = false;
      marcar();
      dibujar();
    }, "Si está agotado no aparece en la carta, pero no se borra"),
    el("button", { type: "button", class: "icono editar", title: abierto ? "Cerrar" : "Editar todo", onclick: alternar }, abierto ? "▴" : "✎"));

  let detalle = null;
  if (abierto) {
    const enfocar = porEnfocar === p;
    detalle = el("div", { class: "detalle" },
      el("div", { class: "columnas" },
        el("div", {},
          campoTexto("Nombre", p, "nombre", { enfocar, alCambiar: (v) => { titulo.textContent = v || "Producto sin nombre"; } }),
          campoTexto("Descripción", p, "descripcion", {
            largo: true,
            placeholder: "Opcional. Ej.: De manteca, recién horneadas.",
            alCambiar: (v) => { if (!agotado) bajada.textContent = v; },
          }),
          bloqueTamanos(p),
          el("div", { class: "dos" },
            campoPrecio("Precio anterior (sale tachado)", p, "precio_anterior", { placeholder: "Opcional, para promos" }),
            campoTexto("Etiqueta", p, "etiqueta", { lista: "etiquetas", placeholder: "Opcional. Ej.: Promo" }))),
        bloqueFoto(p, "foto", () => p.nombre, c.emoji || "🍽️", "Foto")),
      el("div", { class: "acciones-producto" },
        el("label", { class: "mover-a" }, "Mover a ",
          el("select", {
            onchange: (e) => {
              const destino = datos.categorias[Number(e.target.value)];
              c.productos.splice(pi, 1);
              (destino.productos ||= []).push(p);
              marcar();
              dibujar();
              avisar(`“${p.nombre || "Producto"}” ahora está en ${destino.nombre}.`);
            },
          }, datos.categorias.map((otra, i) => el("option", { value: i, selected: i === ci }, `${otra.emoji || ""} ${otra.nombre || "Sin nombre"}`)))),
        botonesMover(c.productos, pi),
        el("button", {
          type: "button", class: "link peligro",
          onclick: () => {
            if (!confirm(`¿Borrar “${p.nombre || "este producto"}” de la carta?\n\nSi solo se terminó, mejor marcalo como Agotado.`)) return;
            c.productos.splice(pi, 1);
            abiertos.delete(p);
            marcar();
            dibujar();
          },
        }, "Borrar producto")));
  }

  return el("article", { class: "producto" + (agotado ? " agotado" : "") + (abierto ? " abierto" : ""), hidden: !coincide(p) }, fila, detalle);
}

function tarjetaCategoria(c, ci) {
  const oculta = c.disponible === false;
  const productos = c.productos || (c.productos = []);
  const filtrando = $("#buscar").value.trim() !== "";
  const visibles = productos.filter(coincide).length;

  return el("section", { class: "bloque categoria" + (oculta ? " oculta" : ""), hidden: filtrando && !visibles },
    el("div", { class: "cat-cabecera" },
      el("input", {
        class: "emoji", type: "text", value: c.emoji || "", list: "emojis", "aria-label": "Emoji de la categoría",
        title: "Emoji de la categoría (también se muestra en los productos sin foto). Con la tecla Windows + punto ves todos.",
        oninput: (e) => { const v = e.target.value.trim(); if (v) c.emoji = v; else delete c.emoji; marcar(); },
      }),
      el("input", {
        class: "cat-nombre", type: "text", value: c.nombre || "", placeholder: "Nombre de la categoría", "aria-label": "Nombre de la categoría",
        oninput: (e) => { c.nombre = e.target.value; marcar(); },
      }),
      el("span", { class: "cuenta" }, productos.length === 1 ? "1 producto" : `${productos.length} productos`),
      interruptor(!oculta, oculta ? "Oculta" : "Visible", (on) => {
        if (on) delete c.disponible;
        else c.disponible = false;
        marcar();
        dibujar();
      }, "Ocultar toda la categoría sin borrarla"),
      botonesMover(datos.categorias, ci),
      el("button", {
        type: "button", class: "icono peligro", title: "Borrar categoría",
        onclick: () => {
          const aviso = productos.length ? ` y sus ${productos.length} productos` : "";
          if (!confirm(`¿Borrar la categoría “${c.nombre || "sin nombre"}”${aviso}?`)) return;
          datos.categorias.splice(ci, 1);
          marcar();
          dibujar();
        },
      }, "🗑")),
    el("div", { class: "productos" }, productos.map((p, pi) => tarjetaProducto(c, ci, p, pi))),
    el("button", {
      type: "button", class: "agregar",
      onclick: () => {
        const nuevo = { nombre: "" };
        productos.push(nuevo);
        abiertos.add(nuevo);
        porEnfocar = nuevo;
        $("#buscar").value = "";
        marcar();
        dibujar();
      },
    }, "+ Agregar producto"));
}

function dibujar() {
  const y = window.scrollY;
  $("#contenido").replaceChildren(
    bloqueNegocio(),
    ...datos.categorias.map(tarjetaCategoria),
    el("button", {
      type: "button", class: "agregar categoria-nueva",
      onclick: () => {
        datos.categorias.push({ nombre: "Nueva categoría", emoji: "🍽️", productos: [] });
        marcar();
        dibujar();
        const nombres = document.querySelectorAll(".cat-nombre");
        nombres[nombres.length - 1].select();
      },
    }, "+ Agregar categoría"));
  window.scrollTo(0, y);
  const campo = document.querySelector(".enfocar");
  if (campo) campo.focus();
  porEnfocar = null;
}

// ---------- Guardar y publicar ----------

const ORDEN = ["nombre", "descripcion", "precio", "variantes", "precio_anterior", "foto", "etiqueta", "disponible"];

// Copia prolija para menu.json: sin campos vacíos y en un orden fácil de leer.
function limpiarProducto(p) {
  const r = {};
  for (const k of ORDEN) if (k in p) r[k] = p[k];
  for (const k of Object.keys(p)) if (!(k in r)) r[k] = p[k];
  for (const k of ["nombre", "descripcion", "etiqueta"]) if (typeof r[k] === "string") r[k] = r[k].trim();
  for (const k of ["descripcion", "etiqueta", "foto"]) if (!r[k]) delete r[k];
  for (const k of ["precio", "precio_anterior"]) if (r[k] == null) delete r[k];
  if (r.variantes) {
    r.variantes = r.variantes.map((v) => {
      const o = { ...v, nombre: String(v.nombre || "").trim() };
      if (o.precio == null) delete o.precio;
      return o;
    });
    if (!r.variantes.length) delete r.variantes;
  }
  return r;
}

function preparar() {
  const copia = JSON.parse(JSON.stringify(datos));
  for (const c of copia.categorias) {
    c.nombre = String(c.nombre || "").trim();
    c.productos = (c.productos || []).map(limpiarProducto);
  }
  return copia;
}

function revisar(d) {
  const errores = [];
  const sinPrecio = [];
  d.categorias.forEach((c, ci) => {
    const nombreCat = c.nombre || `la categoría número ${ci + 1}`;
    if (!c.nombre) errores.push(`La categoría número ${ci + 1} no tiene nombre.`);
    for (const p of c.productos) {
      if (!p.nombre) errores.push(`Hay un producto sin nombre en ${nombreCat}. Escribile un nombre o borralo.`);
      for (const v of p.variantes || []) if (!v.nombre) errores.push(`“${p.nombre}” tiene un tamaño sin nombre.`);
      if (p.nombre && p.precio == null && !(p.variantes || []).some((v) => v.precio != null)) sinPrecio.push(p.nombre);
    }
  });
  return { errores, sinPrecio };
}

async function guardar() {
  if (guardando) return false;
  const limpio = preparar();
  const { errores, sinPrecio } = revisar(limpio);
  if (errores.length) {
    mostrarDialogo("Falta completar algo", el("ul", {}, errores.map((t) => el("li", {}, t))));
    return false;
  }
  guardando = true;
  actualizarEstado();
  try {
    const r = await pedir("/api/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(limpio),
    });
    datos.actualizado = r.actualizado;
    sinGuardar = false;
    avisar(sinPrecio.length
      ? `Guardado. Sin precio (en la carta dice “Consultar”): ${sinPrecio.join(", ")}.`
      : "Guardado. Para verlo, recargá la pestaña de la carta.");
    return true;
  } catch (e) {
    avisar(e.message, "error");
    return false;
  } finally {
    guardando = false;
    actualizarEstado();
  }
}

async function publicarCarta() {
  if (sinGuardar && !(await guardar())) return;
  const boton = $("#publicar");
  boton.disabled = true;
  $("#dialogo-cerrar").disabled = true;
  mostrarDialogo("Publicando…", el("p", {}, "Subiendo la carta a internet. Puede tardar unos segundos."));
  try {
    const r = await pedir("/api/publicar", { method: "POST" });
    const detalle = el("details", {}, el("summary", {}, "Ver detalle"), el("pre", {}, r.informe));
    if (r.ok) {
      mostrarDialogo("✓ Carta publicada", el("p", {}, "En 1 o 2 minutos la ve todo el mundo. Si en el celular sigue la versión vieja, recargá la página."), detalle);
    } else if (r.informe.includes("todavía no está conectada")) {
      mostrarDialogo("Falta conectar con GitHub", el("p", {}, "Tus cambios quedaron guardados en la notebook, pero esta carpeta todavía no está conectada a GitHub, así que no se pueden subir a internet."), detalle);
    } else {
      mostrarDialogo("No se pudo publicar", el("p", {}, "Tus cambios quedaron guardados en la notebook. Revisá que haya internet y probá de nuevo."), detalle);
    }
  } catch (e) {
    mostrarDialogo("No se pudo publicar", el("p", {}, e.message));
  } finally {
    boton.disabled = false;
    $("#dialogo-cerrar").disabled = false;
  }
}

// ---------- Arranque ----------

function fallo(titulo, texto) {
  $("#contenido").replaceChildren(el("div", { class: "bloque fallo" }, el("h2", {}, titulo), el("p", {}, texto)));
  document.querySelectorAll(".acciones button, .buscar").forEach((b) => { b.disabled = true; });
}

async function iniciar() {
  for (const t of ETIQUETAS) $("#etiquetas").append(el("option", { value: t }));
  for (const t of EMOJIS) $("#emojis").append(el("option", { value: t }));

  let texto;
  try {
    const r = await fetch("/api/menu", { cache: "no-store" });
    if (!r.ok) throw new Error();
    texto = await r.text();
  } catch {
    fallo("El editor no está disponible acá", "La carta solo se puede editar desde la notebook del local, con el acceso “Editar carta” del escritorio.");
    return;
  }
  try {
    datos = JSON.parse(texto);
  } catch {
    fallo("menu.json quedó mal escrito", "Alguien lo cambió a mano y le falta una coma, comilla o llave. Abrí “Carta y QR”: la ventana negra dice en qué línea está el error. Si no, en la carpeta hay una copia anterior llamada menu.anterior.json.");
    return;
  }
  datos.negocio ||= {};
  datos.categorias ||= [];
  dibujar();
  actualizarEstado();

  $("#guardar").addEventListener("click", guardar);
  $("#publicar").addEventListener("click", publicarCarta);
  $("#buscar").addEventListener("input", dibujar);
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (sinGuardar) guardar();
    }
  });
  window.addEventListener("beforeunload", (e) => {
    if (sinGuardar) e.preventDefault();
  });
}

iniciar();
