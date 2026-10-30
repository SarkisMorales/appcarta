// Carta digital: lee menu.json y dibuja la carta.
// No hace falta tocar este archivo para cambiar productos o precios: eso va en menu.json.
(function () {
  "use strict";

  var CLAVE_FAVORITOS = "carta-favoritos";
  var carta = document.getElementById("carta");
  var pildoras = document.getElementById("pildoras");
  var pie = document.getElementById("pie");
  var detalle = document.getElementById("detalle");
  var detalleCaja = document.getElementById("detalle-caja");

  var categorias = [];
  var favoritos = leerFavoritos();
  var modoFavoritos = false;
  var observador = null;

  var ICONO_CORAZON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 6.9 4.5c2 0 3.4 1.1 4.1 2.3h2c.7-1.2 2.1-2.3 4.1-2.3 3.5 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

  // ---------- Utilidades ----------

  function esc(texto) {
    return String(texto == null ? "" : texto)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // 1500 -> "$ 1.500"
  function pesos(numero) {
    var n = Math.round(Number(numero));
    if (!isFinite(n)) return "";
    var conPuntos = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (n < 0 ? "-" : "") + "$ " + conPuntos;
  }

  // "2026-10-29" -> "29/10/2026" (sin pasar por Date para que no cambie el día por la zona horaria)
  function fecha(texto) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(texto || ""));
    return m ? m[3] + "/" + m[2] + "/" + m[1] : String(texto || "");
  }

  function slug(texto) {
    return String(texto || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function iniciales(nombre) {
    var palabras = String(nombre || "").split(/\s+/).filter(function (p) {
      return p && !/^(de|del|la|el|los|las|y)$/i.test(p);
    });
    return palabras.slice(0, 2).map(function (p) { return p.charAt(0).toUpperCase(); }).join("") || "★";
  }

  function leerFavoritos() {
    try { return JSON.parse(localStorage.getItem(CLAVE_FAVORITOS)) || {}; } catch (e) { return {}; }
  }
  function guardarFavoritos() {
    try { localStorage.setItem(CLAVE_FAVORITOS, JSON.stringify(favoritos)); } catch (e) { /* modo privado */ }
  }

  // Precio a mostrar en la tarjeta. Con variantes muestra el más barato con "desde".
  function precioDe(p) {
    var vars = (p.variantes || []).filter(function (v) { return v && v.disponible !== false && v.precio != null; });
    if (vars.length) {
      var minimo = Math.min.apply(null, vars.map(function (v) { return Number(v.precio); }));
      return { texto: pesos(minimo), desde: vars.length > 1 };
    }
    if (p.precio != null && p.precio !== "") return { texto: pesos(p.precio), desde: false };
    return { texto: "Consultar", desde: false };
  }

  // ---------- Carga ----------

  function cargar() {
    // no-cache: el celular siempre pregunta si hay precios nuevos.
    fetch("menu.json", { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("No se encontró menu.json (error " + r.status + ")");
        return r.text();
      })
      .then(function (texto) {
        var datos;
        try {
          datos = JSON.parse(texto);
        } catch (e) {
          throw new Error(explicarErrorJson(e, texto));
        }
        dibujar(datos);
      })
      .catch(function (e) {
        carta.innerHTML =
          '<div class="aviso-error"><strong>No se pudo cargar la carta.</strong><br>' +
          esc(e.message) + "</div>";
      });
  }

  function explicarErrorJson(e, texto) {
    var msg = String(e.message || e);
    var linea = /line (\d+)/.exec(msg);
    var pos = /position (\d+)/.exec(msg);
    var numLinea = linea ? Number(linea[1]) : pos ? texto.slice(0, Number(pos[1])).split("\n").length : null;
    return "Hay un error de escritura en menu.json" +
      (numLinea ? " cerca de la línea " + numLinea : "") +
      ". Revisá comas, comillas y llaves. Detalle técnico: " + msg;
  }

  // ---------- Dibujo ----------

  function dibujar(datos) {
    var negocio = datos.negocio || {};
    var nombre = negocio.nombre || "Carta";
    document.title = nombre + " · Carta";
    document.getElementById("nombre-negocio").textContent = nombre;
    document.getElementById("subtitulo").textContent = negocio.subtitulo || "";
    var logo = document.getElementById("logo");
    if (negocio.logo) logo.innerHTML = '<img src="' + esc(negocio.logo) + '" alt="" width="52" height="52">';
    else logo.textContent = iniciales(nombre);
    document.getElementById("info-negocio").textContent =
      [negocio.horario, negocio.direccion].filter(Boolean).join(" · ");

    categorias = (datos.categorias || []).map(function (c, i) {
      var id = c.id ? slug(c.id) : slug(c.nombre) || "categoria-" + (i + 1);
      var productos = (c.productos || [])
        .filter(function (p) { return p && p.nombre && p.disponible !== false; })
        .map(function (p) {
          p._clave = id + "/" + slug(p.nombre);
          p._emoji = c.emoji || "🍽️";
          return p;
        });
      return { id: id, nombre: c.nombre || "Sin nombre", emoji: c.emoji, productos: productos, oculta: c.disponible === false };
    }).filter(function (c) { return !c.oculta && c.productos.length; });

    dibujarPildoras();
    dibujarCarta();
    dibujarPie(datos, negocio);
  }

  function dibujarPildoras() {
    var html = categorias.map(function (c) {
      return '<button class="pildora" type="button" data-ir="' + esc(c.id) + '">' + esc(c.nombre) + "</button>";
    }).join("");
    html += '<button class="pildora" type="button" data-favoritos="1"><span class="corazon-mini">♥</span> Favoritos</button>';
    pildoras.innerHTML = html;
  }

  function tarjeta(p) {
    var precio = precioDe(p);
    var fav = !!favoritos[p._clave];
    var foto = p.foto
      ? '<img src="' + esc(p.foto) + '" alt="" width="400" height="300" loading="lazy" decoding="async">'
      : '<div class="sin-foto" aria-hidden="true">' + esc(p._emoji) + "</div>";
    return (
      '<article class="producto">' +
        '<button class="abrir" type="button" data-producto="' + esc(p._clave) + '">' +
          '<div class="foto">' + foto +
            '<span class="precio-chip">' + (precio.desde ? "<small>desde</small>" : "") + esc(precio.texto) + "</span>" +
            (p.etiqueta ? '<span class="etiqueta">' + esc(p.etiqueta) + "</span>" : "") +
          "</div>" +
          "<h3>" + esc(p.nombre) + "</h3>" +
          (p.descripcion ? '<p class="desc">' + esc(p.descripcion) + "</p>" : "") +
          (p.precio_anterior ? '<p class="antes">Antes <s>' + esc(pesos(p.precio_anterior)) + "</s></p>" : "") +
        "</button>" +
        '<button class="corazon" type="button" data-fav="' + esc(p._clave) + '" aria-pressed="' + fav + '" aria-label="Guardar ' + esc(p.nombre) + ' en favoritos">' +
          ICONO_CORAZON +
        "</button>" +
      "</article>"
    );
  }

  function dibujarCarta() {
    if (!categorias.length) {
      carta.innerHTML = '<p class="aviso">Todavía no hay productos cargados.</p>';
      return;
    }
    if (modoFavoritos) {
      var favs = [];
      categorias.forEach(function (c) {
        c.productos.forEach(function (p) { if (favoritos[p._clave]) favs.push(p); });
      });
      carta.innerHTML =
        '<section class="seccion" id="favoritos"><h2>Tus favoritos</h2>' +
        (favs.length
          ? '<div class="grilla">' + favs.map(tarjeta).join("") + "</div>"
          : '<p class="aviso">Tocá el ♥ de un producto para guardarlo acá.</p>') +
        "</section>";
    } else {
      carta.innerHTML = categorias.map(function (c) {
        return '<section class="seccion" id="' + esc(c.id) + '" data-categoria="' + esc(c.id) + '">' +
          "<h2>" + esc(c.nombre) + "</h2>" +
          '<div class="grilla">' + c.productos.map(tarjeta).join("") + "</div></section>";
      }).join("");
    }
    activarSeguimiento();
  }

  function dibujarPie(datos, negocio) {
    var enlaces = [];
    if (negocio.whatsapp) {
      enlaces.push('<a href="https://wa.me/' + esc(String(negocio.whatsapp).replace(/\D/g, "")) + '" target="_blank" rel="noopener">WhatsApp</a>');
    }
    if (negocio.instagram) {
      enlaces.push('<a href="https://instagram.com/' + esc(String(negocio.instagram).replace(/^@/, "")) + '" target="_blank" rel="noopener">Instagram</a>');
    }
    pie.innerHTML =
      (datos.actualizado ? '<p class="fecha">Precios actualizados el ' + esc(fecha(datos.actualizado)) + "</p>" : "") +
      "<p>Precios en pesos argentinos, sujetos a cambios.</p>" +
      (enlaces.length ? '<div class="enlaces">' + enlaces.join("") + "</div>" : "");
  }

  // ---------- Categoría activa mientras se hace scroll ----------

  function marcarPildora(boton) {
    Array.prototype.forEach.call(pildoras.children, function (b) {
      b.setAttribute("aria-current", b === boton ? "true" : "false");
    });
    if (boton) {
      // Mueve la fila de categorías para que la activa quede a la vista, sin mover la página.
      var izq = boton.offsetLeft - (pildoras.clientWidth - boton.offsetWidth) / 2;
      pildoras.scrollTo({ left: Math.max(0, izq), behavior: "smooth" });
    }
  }

  function activarSeguimiento() {
    if (observador) observador.disconnect();
    if (modoFavoritos) {
      marcarPildora(pildoras.querySelector("[data-favoritos]"));
      return;
    }
    marcarPildora(pildoras.firstElementChild);
    if (!("IntersectionObserver" in window)) return;
    observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (en.isIntersecting) {
          marcarPildora(pildoras.querySelector('[data-ir="' + en.target.dataset.categoria + '"]'));
        }
      });
    }, { rootMargin: "-80px 0px -65% 0px" });
    carta.querySelectorAll(".seccion").forEach(function (s) { observador.observe(s); });
  }

  // ---------- Detalle del producto ----------

  function buscarProducto(clave) {
    for (var i = 0; i < categorias.length; i++) {
      for (var j = 0; j < categorias[i].productos.length; j++) {
        if (categorias[i].productos[j]._clave === clave) return categorias[i].productos[j];
      }
    }
    return null;
  }

  function abrirDetalle(p) {
    var vars = (p.variantes || []).filter(function (v) { return v && v.disponible !== false; });
    var foto = p.foto
      ? '<img src="' + esc(p.foto) + '" alt="' + esc(p.nombre) + '" width="800" height="600" decoding="async">'
      : '<div class="sin-foto" aria-hidden="true">' + esc(p._emoji) + "</div>";
    detalleCaja.innerHTML =
      '<div class="foto">' + foto + (p.etiqueta ? '<span class="etiqueta">' + esc(p.etiqueta) + "</span>" : "") + "</div>" +
      '<h2 id="detalle-nombre">' + esc(p.nombre) + "</h2>" +
      (p.descripcion ? "<p>" + esc(p.descripcion) + "</p>" : "") +
      (vars.length
        ? '<ul class="variantes">' + vars.map(function (v) {
            return "<li><span>" + esc(v.nombre) + "</span><strong>" + esc(pesos(v.precio)) + "</strong></li>";
          }).join("") + "</ul>"
        : '<div class="precio-grande">' + esc(precioDe(p).texto) + "</div>") +
      (p.precio_anterior ? '<p class="antes">Antes <s>' + esc(pesos(p.precio_anterior)) + "</s></p>" : "") +
      '<button class="cerrar" type="button" data-cerrar="1">Volver a la carta</button>';

    if (typeof detalle.showModal === "function") {
      detalle.showModal();
      // Así el botón "atrás" del celular cierra el detalle en vez de salir de la carta.
      history.pushState({ detalle: true }, "");
    }
  }

  detalle.addEventListener("click", function (e) {
    // Toca fuera de la ventana o en "Volver": cerrar.
    if (e.target === detalle || e.target.closest("[data-cerrar]")) detalle.close();
  });
  detalle.addEventListener("close", function () {
    if (history.state && history.state.detalle) history.back();
  });
  window.addEventListener("popstate", function () {
    if (detalle.open) detalle.close();
  });

  // ---------- Toques ----------

  document.addEventListener("click", function (e) {
    var fav = e.target.closest("[data-fav]");
    if (fav) {
      var clave = fav.dataset.fav;
      if (favoritos[clave]) delete favoritos[clave]; else favoritos[clave] = 1;
      guardarFavoritos();
      fav.setAttribute("aria-pressed", String(!!favoritos[clave]));
      if (modoFavoritos) dibujarCarta();
      return;
    }

    var abrir = e.target.closest("[data-producto]");
    if (abrir) {
      var p = buscarProducto(abrir.dataset.producto);
      if (p) abrirDetalle(p);
      return;
    }

    if (e.target.closest("[data-favoritos]")) {
      modoFavoritos = true;
      dibujarCarta();
      window.scrollTo({ top: carta.offsetTop - 70 });
      return;
    }

    var ir = e.target.closest("[data-ir]");
    if (ir) {
      if (modoFavoritos) {
        modoFavoritos = false;
        dibujarCarta();
      }
      var seccion = document.getElementById(ir.dataset.ir);
      if (seccion) seccion.scrollIntoView({ block: "start" });
      marcarPildora(ir);
    }
  });

  cargar();
})();
