// Carta digital: lee menu.json y dibuja la carta (portada, ofertas, categorías y pedido).
// No hace falta tocar este archivo para cambiar productos, precios u ofertas: eso se hace con el editor.
// Escrito sin funciones modernas de JavaScript para que ande también en celulares viejos.
(function () {
  "use strict";

  var DIAS = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];
  var ORDEN_DIAS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];
  var DIAS_CORTOS = { lun: "Lun", mar: "Mar", mie: "Mié", jue: "Jue", vie: "Vie", sab: "Sáb", dom: "Dom" };
  var DIAS_PLURAL = { lun: "lunes", mar: "martes", mie: "miércoles", jue: "jueves", vie: "viernes", sab: "sábados", dom: "domingos" };
  var HORAS_PEDIDO = 12; // el pedido armado se borra solo después de este tiempo

  function $(id) { return document.getElementById(id); }
  var carta = $("carta");
  var pildoras = $("pildoras");
  var nav = $("nav");
  var pie = $("pie");
  var hoja = $("hoja");
  var hojaCaja = $("hoja-caja");
  var barraPedido = $("barra-pedido");
  var botonPedido = $("ver-pedido");
  var avisoFlotante = $("aviso-flotante");
  var buscador = $("buscador");
  var campoBuscar = $("buscar");

  var datos = null;
  var negocio = {};
  var categorias = []; // categorías visibles, cada una con sus productos
  var ofertas = []; // ofertas de ahora (o de más tarde hoy) y productos rebajados
  var extras = []; // lo que se carga en el editor para "¿Le sumás algo?" (solo aparece ahí)
  var items = {}; // todo lo que se puede abrir o pedir, por id
  var pedido = []; // [{ id, variante, cantidad }]
  var formulario = { nombre: "", modo: "retiro", direccion: "", aclaraciones: "" };
  var seleccion = { id: null, variante: 0, cantidad: 1 };
  var claveGuardado = "carta-pedido";
  var hojaAbierta = null; // "detalle" | "pedido" | "mozo"
  var ultimoFoco = null;
  var observador = null;
  var firmaOfertas = "";

  // ---------- Íconos ----------

  function svg(trazo) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + trazo + "</svg>";
  }
  var LINEA = ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var ICONO = {
    mas: svg('<path d="M12 5v14M5 12h14"' + LINEA + ' stroke-width="2.6"/>'),
    menos: svg('<path d="M5 12h14"' + LINEA + ' stroke-width="2.6"/>'),
    tacho: svg('<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"' + LINEA + "/>"),
    cerrar: svg('<path d="M6 6l12 12M18 6 6 18"' + LINEA + ' stroke-width="2.4"/>'),
    reloj: svg('<circle cx="12" cy="12" r="8.5"' + LINEA + '/><path d="M12 7.5V12l3 2"' + LINEA + "/>"),
    ubicacion: svg('<path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11z"' + LINEA + '/><circle cx="12" cy="10" r="2.3" fill="currentColor"/>'),
    tarjeta: svg('<rect x="3" y="5.5" width="18" height="13" rx="2.5"' + LINEA + '/><path d="M3 10h18"' + LINEA + "/>"),
    compartir: svg('<circle cx="18" cy="5.5" r="2.5"' + LINEA + '/><circle cx="6" cy="12" r="2.5"' + LINEA + '/><circle cx="18" cy="18.5" r="2.5"' + LINEA + '/><path d="m8.3 10.8 7.4-4.1M8.3 13.2l7.4 4.1"' + LINEA + "/>"),
    instagram: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="5"' + LINEA + '/><circle cx="12" cy="12" r="4"' + LINEA + '/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor"/>'),
    whatsapp: svg('<path d="M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.2 20.8l4.5-1.2A8.8 8.8 0 1 0 12 3.2z"' + LINEA + ' stroke-width="1.9"/><path d="M9 8.2c.2-.4.4-.5.7-.5h.5c.2 0 .4 0 .6.5l.8 1.8c.1.2.1.4 0 .6l-.5.7c-.1.2-.1.4 0 .6.6 1 1.4 1.8 2.5 2.4.2.1.4.1.6-.1l.6-.7c.2-.2.4-.2.6-.1l1.8.8c.3.1.4.3.4.5 0 .6-.3 1.4-1 1.7-.6.3-1.6.4-3.6-.6-2-1-3.4-2.9-3.8-3.6-.4-.7-.8-1.7-.6-2.6.1-.5.3-.9.4-1z" fill="currentColor"/>'),
    bolsa: svg('<path d="M5.5 8h13l-1.1 12H6.6L5.5 8z"' + LINEA + '/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"' + LINEA + "/>"),
    estrella: svg('<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="currentColor"/>')
  };

  // ---------- Utilidades ----------

  function esc(texto) {
    return String(texto == null ? "" : texto)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function hayPrecio(n) {
    return n !== null && n !== undefined && n !== "" && isFinite(Number(n));
  }

  // Cómo se acomodó la foto en el editor (zoom y posición). null = como venga (centrada).
  function ajusteDe(a) {
    if (!a || typeof a !== "object") return null;
    var r = Number(a.proporcion);
    if (!(r > 0.05 && r < 20)) return null;
    function entre(v, min, max, porDefecto) {
      v = Number(v);
      return isFinite(v) ? Math.min(max, Math.max(min, v)) : porDefecto;
    }
    return { zoom: entre(a.zoom, 0.1, 5, 1), x: entre(a.x, 0, 100, 50), y: entre(a.y, 0, 100, 50), proporcion: r };
  }

  // Foto acomodada: la cuenta del tamaño y la posición la hace estilos.css (.encuadre).
  // Si la foto quedó más chica que el recuadro, atrás va la misma foto borrosa de relleno.
  function fotoAjustada(src, aj, atributos) {
    var img = '<img src="' + esc(src) + '" ' + atributos + ' onerror="this.style.display=\'none\'">';
    if (!aj) return img;
    var estilo = "--r:" + aj.proporcion + ";--z:" + aj.zoom + ";--x:" + aj.x / 100 + ";--y:" + aj.y / 100;
    return '<span class="encuadre" style="' + estilo + '">' +
      (aj.zoom < 1 ? '<img class="relleno" src="' + esc(src) + '" alt="" aria-hidden="true" onerror="this.style.display=\'none\'">' : "") +
      img + "</span>";
  }

  // 15000 -> "15.000"
  function miles(n) {
    return String(Math.abs(Math.round(Number(n)))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  // Para textos (WhatsApp, avisos): "$ 15.000"
  function pesos(n) {
    return hayPrecio(n) ? "$ " + miles(n) : "";
  }

  // Para la carta: el signo $ va más chico, así la vista se queda en el número.
  function precioHTML(n) {
    return '<span class="signo">$</span>' + miles(n);
  }

  function descuento(precio, antes) {
    if (!hayPrecio(precio) || !hayPrecio(antes) || Number(antes) <= Number(precio)) return 0;
    return Math.round((1 - Number(precio) / Number(antes)) * 100);
  }

  // "2026-10-29" -> "29/10/2026" (sin pasar por Date para que no cambie el día por la zona horaria)
  function fecha(texto) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(texto || ""));
    return m ? m[3] + "/" + m[2] + "/" + m[1] : String(texto || "");
  }

  function fechaCorta(texto) {
    var m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(texto || ""));
    return m ? Number(m[2]) + "/" + Number(m[1]) : "";
  }

  function normalizar(texto) {
    var t = String(texto || "");
    if (t.normalize) t = t.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return t.toLowerCase();
  }

  // Todo el texto por el que se puede encontrar algo con el buscador.
  function textoBusqueda(it, nombreCategoria) {
    return normalizar([it.nombre, it.descripcion, it.etiqueta, nombreCategoria]
      .concat(it.variantes.map(function (v) { return v.nombre; }))
      .join(" "));
  }

  // "Lomos" -> "lomo", "empanadas" -> "empanada": así encuentra igual en singular o plural.
  function palabrasBusqueda(texto) {
    return normalizar(texto).replace(/[^a-z0-9ñ]+/g, " ").split(" ").filter(Boolean).map(function (p) {
      return p.length > 3 && p.charAt(p.length - 1) === "s" ? p.slice(0, -1) : p;
    });
  }

  function slug(texto) {
    return normalizar(texto).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  // "MORFI - CLUB" -> "MC" ; "Café de la Plaza" -> "CP"
  function iniciales(nombre) {
    var palabras = String(nombre || "").split(/\s+/).filter(function (p) {
      return /[a-z0-9áéíóúñü]/i.test(p) && !/^(de|del|la|el|los|las|y)$/i.test(p);
    });
    return palabras.slice(0, 2).map(function (p) {
      return p.replace(/[^a-z0-9áéíóúñü]/gi, "").charAt(0).toUpperCase();
    }).join("") || "★";
  }

  function cadaUno(lista, fn) {
    Array.prototype.forEach.call(lista, fn);
  }

  // ---------- Hora (las ofertas se prenden y apagan solas) ----------

  // Para ver cómo queda la carta en otro momento: carta/?ahora=2026-11-02T09:30
  function ahora() {
    var m = /[?&]ahora=(\d{4})-(\d{2})-(\d{2})(?:T(\d{1,2}):(\d{2}))?/.exec(location.search);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 12), +(m[5] || 0));
    return new Date();
  }

  function fechaISO(d) {
    function dos(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate());
  }

  function minutos(hhmm) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ""));
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }

  // "08:00" -> "8 h" ; "11:30" -> "11:30 h"
  function hora(hhmm) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ""));
    if (!m) return "";
    return Number(m[1]) + (m[2] === "00" ? "" : ":" + m[2]) + " h";
  }

  function textoDias(dias) {
    var lista = ORDEN_DIAS.filter(function (d) { return dias.indexOf(d) !== -1; });
    if (!lista.length || lista.length === 7) return "";
    if (lista.length === 1) return "Solo los " + DIAS_PLURAL[lista[0]];
    var pos = lista.map(function (d) { return ORDEN_DIAS.indexOf(d); });
    if (lista.length > 2 && pos[pos.length - 1] - pos[0] === pos.length - 1) {
      return DIAS_CORTOS[lista[0]] + " a " + DIAS_CORTOS[lista[lista.length - 1]];
    }
    return lista.map(function (d) { return DIAS_CORTOS[d]; }).join(", ");
  }

  // ¿Se muestra esta oferta ahora? null = no; si no, { vigente, texto }.
  // vigente false = es de más tarde hoy (se ve, pero todavía no se puede pedir).
  function estadoOferta(o, t) {
    if (!o || o.activa === false || !o.titulo) return null;
    var hoy = fechaISO(t);
    if (o.inicio && hoy < o.inicio) return null;
    if (o.fin && hoy > o.fin) return null;
    var m = t.getHours() * 60 + t.getMinutes();
    var desde = minutos(o.desde);
    var hasta = minutos(o.hasta);
    var nocturna = desde !== null && hasta !== null && hasta <= desde; // ej.: de 20 a 2 h
    var dia = DIAS[t.getDay()];
    if (nocturna && m < hasta) dia = DIAS[(t.getDay() + 6) % 7]; // después de medianoche sigue siendo "la noche de ayer"
    var dias = o.dias && o.dias.length ? o.dias : null;
    if (dias && dias.indexOf(dia) === -1) return null;

    var vigente = true;
    var texto = "";
    if (nocturna) {
      if (m >= desde || m < hasta) texto = "Hasta las " + hora(o.hasta);
      else { vigente = false; texto = "Hoy desde las " + hora(o.desde); }
    } else if (desde !== null && m < desde) {
      vigente = false;
      texto = "Hoy desde las " + hora(o.desde);
    } else if (hasta !== null && m >= hasta) {
      return null;
    } else if (hasta !== null) {
      texto = "Hasta las " + hora(o.hasta);
    }
    if (vigente && !texto) {
      if (o.fin === hoy) texto = "Último día";
      else if (o.fin) texto = "Hasta el " + fechaCorta(o.fin);
      else if (dias) texto = textoDias(dias);
    }
    return { vigente: vigente, texto: texto };
  }

  // ---------- Carga ----------

  function cargar() {
    // no-cache: el celular siempre pregunta si hay precios nuevos.
    // index.html ya lo empezó a pedir apenas abrió la página (window.cartaMenu).
    (window.cartaMenu || fetch("menu.json", { cache: "no-cache" }))
      .then(function (r) {
        if (!r.ok) throw new Error("No se encontró menu.json (error " + r.status + ")");
        return r.text();
      })
      .then(function (texto) {
        var d;
        try {
          d = JSON.parse(texto);
        } catch (e) {
          throw new Error(explicarErrorJson(e, texto));
        }
        datos = d;
        preparar();
        pedido = leerPedido();
        dibujarTodo();
        // Si la carta queda abierta, las ofertas se prenden y apagan solas a su hora.
        setInterval(revisarHorario, 60000);
        document.addEventListener("visibilitychange", function () {
          if (!document.hidden) revisarHorario();
        });
      })
      .catch(function (e) {
        carta.innerHTML =
          '<div class="aviso-error"><strong>No se pudo cargar la carta.</strong><br>' + esc(e.message) + "</div>";
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

  // Arma la lista de cosas que se pueden ver y pedir.
  function preparar() {
    negocio = datos.negocio || {};
    claveGuardado = "carta-pedido:" + slug(negocio.nombre || "carta");
    items = {};
    var idsCategorias = { ofertas: true };

    function idUnico(base) {
      var id = base;
      var n = 2;
      while (items[id]) id = base + "-" + n++;
      return id;
    }

    categorias = (datos.categorias || []).filter(function (c) {
      return c && c.disponible !== false;
    }).map(function (c, i) {
      var cid = (c.id ? slug(c.id) : slug(c.nombre)) || "categoria-" + (i + 1);
      var base = cid;
      for (var n = 2; idsCategorias[cid]; n++) cid = base + "-" + n;
      idsCategorias[cid] = true;

      var productos = (c.productos || []).filter(function (p) {
        return p && p.nombre && p.disponible !== false;
      }).map(function (p) {
        var it = {
          id: idUnico(cid + "/" + (slug(p.nombre) || "producto")),
          tipo: "producto",
          nombre: p.nombre,
          descripcion: p.descripcion || "",
          foto: p.foto || "",
          ajuste: ajusteDe(p.foto_ajuste),
          emoji: c.emoji || "🍽️",
          precio: hayPrecio(p.precio) ? Number(p.precio) : null,
          antes: hayPrecio(p.precio_anterior) ? Number(p.precio_anterior) : null,
          variantes: (p.variantes || []).filter(function (v) {
            return v && v.nombre && v.disponible !== false && hayPrecio(v.precio);
          }).map(function (v) {
            return { nombre: v.nombre, precio: Number(v.precio) };
          }),
          etiqueta: p.etiqueta || "",
          destacado: !!p.destacado,
          categoria: cid,
          vigente: true,
          validez: ""
        };
        it.buscar = textoBusqueda(it, c.nombre);
        items[it.id] = it;
        return it;
      });
      // Los recomendados van primero y en grande.
      productos = productos.filter(function (p) { return p.destacado; })
        .concat(productos.filter(function (p) { return !p.destacado; }));
      return { id: cid, nombre: c.nombre || "Sin nombre", emoji: c.emoji || "", productos: productos };
    }).filter(function (c) {
      return c.productos.length;
    });

    var t = ahora();
    var vigentes = [];
    var masTarde = [];
    (datos.ofertas || []).forEach(function (o) {
      var estado = estadoOferta(o, t);
      if (!estado) return;
      var it = {
        id: idUnico("oferta/" + (slug(o.titulo) || "oferta")),
        tipo: "oferta",
        nombre: o.titulo,
        descripcion: o.descripcion || "",
        foto: o.foto || "",
        ajuste: ajusteDe(o.foto_ajuste),
        emoji: "🔥",
        precio: hayPrecio(o.precio) ? Number(o.precio) : null,
        antes: hayPrecio(o.precio_anterior) ? Number(o.precio_anterior) : null,
        variantes: [],
        etiqueta: o.etiqueta || "",
        destacado: false,
        categoria: "ofertas",
        vigente: estado.vigente,
        validez: estado.texto
      };
      it.buscar = textoBusqueda(it, "ofertas oferta promo");
      items[it.id] = it;
      (estado.vigente ? vigentes : masTarde).push(it);
    });
    // Un producto con "precio antes" también es una oferta.
    var rebajados = [];
    categorias.forEach(function (c) {
      c.productos.forEach(function (p) {
        if (descuento(p.precio, p.antes) > 0) rebajados.push(p);
      });
    });
    ofertas = vigentes.concat(rebajados, masTarde);

    // "¿Le sumás algo?" elegido a mano en el editor. No van en la carta ni en el buscador.
    extras = (datos.sugerencias || []).filter(function (s) {
      return s && s.nombre && s.disponible !== false && hayPrecio(s.precio);
    }).map(function (s) {
      var it = {
        id: idUnico("sugerencia/" + (slug(s.nombre) || "extra")),
        tipo: "sugerencia",
        nombre: s.nombre,
        descripcion: s.descripcion || "",
        foto: s.foto || "",
        ajuste: ajusteDe(s.foto_ajuste),
        emoji: s.emoji || "➕",
        precio: Number(s.precio),
        antes: null,
        variantes: [],
        etiqueta: "",
        destacado: false,
        categoria: "sugerencias",
        vigente: true,
        validez: ""
      };
      items[it.id] = it;
      return it;
    });
    firmaOfertas = calcularFirmaOfertas(t);
  }

  function calcularFirmaOfertas(t) {
    return (datos.ofertas || []).map(function (o) {
      var e = estadoOferta(o, t);
      return e ? (e.vigente ? "1" : "0") + e.texto : "-";
    }).join("|");
  }

  function revisarHorario() {
    if (!datos || hojaAbierta) return;
    if (calcularFirmaOfertas(ahora()) === firmaOfertas) return;
    preparar();
    pedido = leerPedido();
    dibujarTodo();
  }

  // ---------- Dibujo ----------

  function dibujarTodo() {
    dibujarPortada();
    dibujarPildoras();
    dibujarCarta();
    dibujarPie();
    actualizarPedido();
  }

  function enlaceMapa() {
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(negocio.direccion || "");
  }

  // WhatsApp necesita el número internacional: "261 264-1587" -> "5492612641587".
  function numeroWhatsApp() {
    var d = String(negocio.whatsapp || "").replace(/\D/g, "").replace(/^00/, "").replace(/^0/, "");
    if (d.length === 10) return "549" + d; // número de Argentina sin el 549 adelante
    if (d.length === 12 && d.indexOf("54") === 0 && d.charAt(2) !== "9") return "549" + d.slice(2);
    return d;
  }

  function enlaceWhatsApp(texto) {
    return "https://wa.me/" + numeroWhatsApp() + (texto ? "?text=" + encodeURIComponent(texto) : "");
  }

  function enlaceInstagram() {
    return "https://instagram.com/" + encodeURIComponent(String(negocio.instagram || "").replace(/^@/, "").trim());
  }

  function dibujarPortada() {
    var nombre = negocio.nombre || "Carta";
    document.title = nombre + " · Carta";
    $("nombre-negocio").textContent = nombre;
    $("subtitulo").textContent = negocio.subtitulo || "";

    var logo = $("logo");
    if (negocio.logo) logo.innerHTML = fotoAjustada(negocio.logo, ajusteDe(negocio.logo_ajuste), 'alt="" width="84" height="84"');
    else logo.textContent = iniciales(nombre);

    var portada = $("portada");
    var foto = $("portada-foto");
    if (negocio.portada) {
      foto.innerHTML = fotoAjustada(negocio.portada, ajusteDe(negocio.portada_ajuste), 'alt="" width="1200" height="600" fetchpriority="high" decoding="async"');
      portada.className = "portada con-foto";
    } else {
      foto.innerHTML = "";
      portada.className = "portada";
    }

    var acciones = ['<button class="portada-boton" type="button" data-compartir="1" aria-label="Compartir la carta">' + ICONO.compartir + "</button>"];
    if (negocio.instagram) {
      acciones.push('<a class="portada-boton" href="' + esc(enlaceInstagram()) + '" target="_blank" rel="noopener" aria-label="Instagram">' + ICONO.instagram + "</a>");
    }
    if (numeroWhatsApp()) {
      acciones.push('<a class="portada-boton" href="' + esc(enlaceWhatsApp("")) + '" target="_blank" rel="noopener" aria-label="WhatsApp">' + ICONO.whatsapp + "</a>");
    }
    $("portada-acciones").innerHTML = acciones.join("");

    var info = [];
    if (negocio.horario) info.push('<li><span class="dato">' + ICONO.reloj + "<span>" + esc(negocio.horario) + "</span></span></li>");
    if (negocio.direccion) {
      info.push('<li><a class="dato" href="' + esc(enlaceMapa()) + '" target="_blank" rel="noopener">' + ICONO.ubicacion + "<span>" + esc(negocio.direccion) + "</span></a></li>");
    }
    if (negocio.pagos) info.push('<li><span class="dato">' + ICONO.tarjeta + "<span>" + esc(negocio.pagos) + "</span></span></li>");
    $("datos-negocio").innerHTML = info.join("");
  }

  function dibujarPildoras() {
    var html = "";
    if (ofertas.length) html += '<button class="pildora pildora-ofertas" type="button" data-ir="ofertas">🔥 Ofertas</button>';
    html += categorias.map(function (c) {
      return '<button class="pildora" type="button" data-ir="' + esc(c.id) + '">' +
        (c.emoji ? esc(c.emoji) + " " : "") + esc(c.nombre) + "</button>";
    }).join("");
    pildoras.innerHTML = html;
  }

  // Foto con el emoji de la categoría debajo: si la foto no carga, queda el emoji.
  function fotoHTML(it, ancho, alto, diferida, alt) {
    return '<span class="sin-foto" aria-hidden="true">' + esc(it.emoji) + "</span>" +
      (it.foto
        ? fotoAjustada(it.foto, it.ajuste, 'alt="' + esc(alt || "") + '" width="' + ancho + '" height="' + alto + '"' +
          (diferida ? ' loading="lazy"' : "") + ' decoding="async"')
        : "");
  }

  function sellos(it) {
    var pct = descuento(it.precio, it.antes);
    return (it.etiqueta ? '<span class="sello sello-etiqueta">' + esc(it.etiqueta) + "</span>" : "") +
      (pct > 0 ? '<span class="sello sello-descuento">-' + pct + "%</span>" : "");
  }

  function precioBloque(it, clase) {
    if (it.variantes.length) {
      var minimo = Math.min.apply(null, it.variantes.map(function (v) { return v.precio; }));
      return '<span class="' + clase + '">' + (it.variantes.length > 1 ? "<small>desde</small>" : "") + precioHTML(minimo) + "</span>";
    }
    if (it.precio === null) return '<span class="' + clase + ' consultar">Consultar precio</span>';
    var pct = descuento(it.precio, it.antes);
    return '<span class="' + clase + (pct > 0 ? " rebajado" : "") + '">' + precioHTML(it.precio) +
      (pct > 0 ? " <s>" + pesos(it.antes) + "</s>" : "") + "</span>";
  }

  function sePuedePedir(it) {
    return !!it && it.vigente && (it.variantes.length > 0 || it.precio !== null);
  }

  function botonMas(it) {
    if (!sePuedePedir(it)) return "";
    return '<button class="mas" type="button" data-agregar="' + esc(it.id) + '" aria-label="Agregar ' + esc(it.nombre) + ' al pedido">' +
      ICONO.mas + '<span class="mas-cantidad" aria-hidden="true"></span></button>';
  }

  function tarjetaProducto(p) {
    return '<article class="prod' + (p.destacado ? " prod-destacado" : "") + '" data-texto="' + esc(p.buscar) + '">' +
      '<button class="prod-abrir" type="button" data-abrir="' + esc(p.id) + '">' +
        '<span class="prod-foto">' + fotoHTML(p, 600, 600, true) + sellos(p) +
          (p.destacado ? '<span class="sello sello-destacado">' + ICONO.estrella + "Recomendado</span>" : "") +
        "</span>" +
        '<span class="prod-texto">' +
          '<span class="prod-nombre">' + esc(p.nombre) + "</span>" +
          (p.descripcion ? '<span class="prod-desc">' + esc(p.descripcion) + "</span>" : "") +
          precioBloque(p, "prod-precio") +
        "</span>" +
      "</button>" +
      botonMas(p) +
    "</article>";
  }

  function tarjetaOferta(it, i) {
    // Los productos rebajados ya aparecen en su categoría: al buscar no se repiten acá.
    return '<article class="oferta' + (it.vigente ? "" : " oferta-mas-tarde") + '"' +
      (it.tipo === "oferta" ? ' data-texto="' + esc(it.buscar) + '"' : "") + ">" +
      '<button class="oferta-abrir" type="button" data-abrir="' + esc(it.id) + '">' +
        '<span class="oferta-foto">' + fotoHTML(it, 640, 400, i > 0) + sellos(it) +
          (it.validez ? '<span class="sello sello-tiempo">' + ICONO.reloj + esc(it.validez) + "</span>" : "") +
        "</span>" +
        '<span class="oferta-texto">' +
          '<span class="oferta-nombre">' + esc(it.nombre) + "</span>" +
          (it.descripcion ? '<span class="oferta-desc">' + esc(it.descripcion) + "</span>" : "") +
          precioBloque(it, "oferta-precio") +
        "</span>" +
      "</button>" +
      botonMas(it) +
    "</article>";
  }

  function dibujarCarta() {
    if (!categorias.length && !ofertas.length) {
      carta.innerHTML = '<p class="aviso">Todavía no hay productos cargados.</p>';
      return;
    }
    var html = "";
    if (ofertas.length) {
      html += '<section class="seccion seccion-ofertas" id="ofertas">' +
        '<div class="seccion-cabeza"><h2>🔥 Ofertas</h2>' +
          (ofertas.length > 1 ? '<span class="deslizar">Deslizá para ver más</span>' : "") + "</div>" +
        '<div class="carrusel' + (ofertas.length === 1 ? " carrusel-uno" : "") + '">' + ofertas.map(tarjetaOferta).join("") + "</div>" +
      "</section>";
    }
    html += categorias.map(function (c) {
      return '<section class="seccion" id="' + esc(c.id) + '">' +
        '<div class="seccion-cabeza"><h2>' + (c.emoji ? '<span class="seccion-emoji" aria-hidden="true">' + esc(c.emoji) + "</span>" : "") + esc(c.nombre) + "</h2></div>" +
        '<div class="grilla">' + c.productos.map(tarjetaProducto).join("") + "</div>" +
      "</section>";
    }).join("");
    html += '<p class="sin-resultados" id="sin-resultados" hidden></p>';
    carta.innerHTML = html;
    if (campoBuscar.value) filtrar(campoBuscar.value);
    activarSeguimiento();
  }

  function dibujarPie() {
    var botones = [];
    if (numeroWhatsApp()) {
      botones.push('<a class="pie-boton" href="' + esc(enlaceWhatsApp("")) + '" target="_blank" rel="noopener">' + ICONO.whatsapp + "WhatsApp</a>");
    }
    if (negocio.instagram) {
      botones.push('<a class="pie-boton" href="' + esc(enlaceInstagram()) + '" target="_blank" rel="noopener">' + ICONO.instagram + "Instagram</a>");
    }
    if (negocio.direccion) {
      botones.push('<a class="pie-boton" href="' + esc(enlaceMapa()) + '" target="_blank" rel="noopener">' + ICONO.ubicacion + "Cómo llegar</a>");
    }
    botones.push('<button class="pie-boton" type="button" data-compartir="1">' + ICONO.compartir + "Compartir</button>");

    pie.innerHTML =
      '<div class="pie-tarjeta">' +
        '<p class="pie-nombre">' + esc(negocio.nombre || "") + "</p>" +
        (negocio.direccion ? "<p>" + esc(negocio.direccion) + "</p>" : "") +
        (negocio.horario ? "<p>" + esc(negocio.horario) + "</p>" : "") +
        (negocio.pagos ? "<p>Medios de pago: " + esc(negocio.pagos) + "</p>" : "") +
        '<div class="pie-botones' + (botones.length % 2 ? " impar" : "") + '">' + botones.join("") + "</div>" +
      "</div>" +
      (datos.actualizado ? '<p class="pie-fecha">Precios actualizados el ' + esc(fecha(datos.actualizado)) + "</p>" : "") +
      '<p class="pie-legal">Precios en pesos argentinos, sujetos a cambios.</p>';
  }

  // ---------- Categoría activa mientras se hace scroll ----------

  function marcarPildora(boton) {
    cadaUno(pildoras.children, function (b) {
      b.setAttribute("aria-current", b === boton ? "true" : "false");
    });
    if (boton && pildoras.scrollTo) {
      // Mueve la fila de categorías para que la activa quede a la vista, sin mover la página.
      var izq = boton.offsetLeft - (pildoras.clientWidth - boton.offsetWidth) / 2;
      pildoras.scrollTo({ left: Math.max(0, izq), behavior: "smooth" });
    }
  }

  function activarSeguimiento() {
    if (observador) observador.disconnect();
    marcarPildora(pildoras.firstElementChild);
    if (!("IntersectionObserver" in window)) return;
    observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (en.isIntersecting) marcarPildora(pildoras.querySelector('[data-ir="' + en.target.id + '"]'));
      });
    }, { rootMargin: "-110px 0px -60% 0px" });
    cadaUno(carta.querySelectorAll(".seccion"), function (s) { observador.observe(s); });
  }

  function irA(id) {
    if (campoBuscar.value) cerrarBuscador();
    var seccion = $(id);
    if (seccion) seccion.scrollIntoView({ block: "start" });
    marcarPildora(pildoras.querySelector('[data-ir="' + id + '"]'));
  }

  // ---------- Buscador ----------

  function abrirBuscador() {
    buscador.hidden = false;
    nav.className = "nav buscando";
    campoBuscar.focus();
  }

  function cerrarBuscador() {
    campoBuscar.value = "";
    filtrar("");
    buscador.hidden = true;
    nav.className = "nav";
  }

  function filtrar(texto) {
    var palabras = palabrasBusqueda(texto);
    var buscando = palabras.length > 0;
    var total = 0;
    cadaUno(carta.querySelectorAll(".seccion"), function (s) {
      var visibles = 0;
      cadaUno(s.querySelectorAll(".prod, .oferta"), function (a) {
        var t = a.getAttribute("data-texto");
        // Sin data-texto = producto rebajado del carrusel: se busca en su categoría.
        var ok = !buscando || (t !== null && palabras.every(function (p) { return t.indexOf(p) !== -1; }));
        a.hidden = !ok;
        if (ok) visibles++;
      });
      var deslizar = s.querySelector(".deslizar");
      if (deslizar) deslizar.hidden = buscando;
      s.hidden = visibles === 0;
      total += visibles;
    });
    var sin = $("sin-resultados");
    if (sin) {
      sin.hidden = !(palabras.length && total === 0);
      sin.textContent = "No encontramos “" + String(texto).trim() + "”. Probá con otra palabra.";
    }
  }

  // ---------- Pedido ----------

  function guardarPedido() {
    try { localStorage.setItem(claveGuardado, JSON.stringify({ t: Date.now(), pedido: pedido })); } catch (e) { /* modo privado */ }
  }

  function leerPedido() {
    try {
      var g = JSON.parse(localStorage.getItem(claveGuardado));
      if (!g || Date.now() - g.t > HORAS_PEDIDO * 3600000) return [];
      return (g.pedido || []).filter(function (l) {
        var it = items[l.id];
        if (!sePuedePedir(it) || !(l.cantidad > 0)) return false;
        if (it.variantes.length) return it.variantes.some(function (v) { return v.nombre === l.variante; });
        return !l.variante;
      });
    } catch (e) {
      return [];
    }
  }

  function precioLinea(l) {
    var it = items[l.id];
    if (!it.variantes.length) return it.precio;
    for (var i = 0; i < it.variantes.length; i++) if (it.variantes[i].nombre === l.variante) return it.variantes[i].precio;
    return 0;
  }

  function totalPedido() {
    return pedido.reduce(function (s, l) { return s + precioLinea(l) * l.cantidad; }, 0);
  }

  function unidades() {
    return pedido.reduce(function (s, l) { return s + l.cantidad; }, 0);
  }

  function agregar(id, numVariante, cantidad) {
    var it = items[id];
    if (!sePuedePedir(it)) return;
    var variante = it.variantes.length ? it.variantes[numVariante].nombre : "";
    var linea = null;
    pedido.forEach(function (l) { if (l.id === id && l.variante === variante) linea = l; });
    if (linea) linea.cantidad = Math.min(99, linea.cantidad + cantidad);
    else pedido.push({ id: id, variante: variante, cantidad: cantidad });
    guardarPedido();
    actualizarPedido();
    avisar("Agregaste " + (cantidad > 1 ? cantidad + " × " : "") + it.nombre + (variante ? " (" + variante + ")" : ""));
    barraPedido.className = "barra-pedido";
    void barraPedido.offsetWidth; // reinicia la animación
    barraPedido.className = "barra-pedido rebote";
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* sin vibración */ }
  }

  function cambiarLinea(i, delta) {
    var l = pedido[i];
    if (!l) return;
    l.cantidad += delta;
    if (l.cantidad <= 0) pedido.splice(i, 1);
    guardarPedido();
    actualizarPedido();
    if (!pedido.length) cerrarHoja();
    else refrescarPedido();
  }

  // Números en los botones "+" y la barra de abajo.
  function actualizarPedido() {
    var porItem = {};
    pedido.forEach(function (l) { porItem[l.id] = (porItem[l.id] || 0) + l.cantidad; });
    cadaUno(document.querySelectorAll("[data-agregar]"), function (b) {
      var n = porItem[b.getAttribute("data-agregar")] || 0;
      b.className = n ? "mas tiene" : "mas";
      var burbuja = b.querySelector(".mas-cantidad");
      if (burbuja) burbuja.textContent = n || "";
    });
    var n = unidades();
    barraPedido.hidden = n === 0;
    document.body.className = n ? "con-pedido" : "";
    if (n) {
      botonPedido.innerHTML =
        '<span class="barra-icono">' + ICONO.bolsa + "<b>" + n + "</b></span>" +
        '<span class="barra-texto">Ver mi pedido</span>' +
        '<span class="barra-total">' + pesos(totalPedido()) + "</span>";
    }
  }

  // ¿Qué más le conviene sumar? Prioriza otras categorías, recomendados y ofertas.
  function sugerir(excluir, categoriaBase, cuantos) {
    var enPedido = {};
    pedido.forEach(function (l) { if (items[l.id]) enPedido[items[l.id].categoria] = true; });
    var candidatos = [];
    Object.keys(items).forEach(function (id, orden) {
      var it = items[id];
      if (excluir.indexOf(id) !== -1 || !sePuedePedir(it) || it.tipo === "sugerencia") return;
      var puntos = 0;
      if (it.categoria !== categoriaBase) puntos += 3;
      if (!enPedido[it.categoria]) puntos += 2;
      if (it.destacado) puntos += 2;
      if (it.tipo === "oferta" || descuento(it.precio, it.antes) > 0) puntos += 2;
      if (it.foto) puntos += 1;
      if (it.etiqueta) puntos += 1;
      candidatos.push({ it: it, puntos: puntos, orden: orden });
    });
    candidatos.sort(function (a, b) { return b.puntos - a.puntos || a.orden - b.orden; });
    var elegidos = [];
    var vistas = {};
    candidatos.forEach(function (c) { // primero, una de cada categoría
      if (elegidos.length < cuantos && !vistas[c.it.categoria]) {
        vistas[c.it.categoria] = true;
        elegidos.push(c.it);
      }
    });
    candidatos.forEach(function (c) {
      if (elegidos.length < cuantos && elegidos.indexOf(c.it) === -1) elegidos.push(c.it);
    });
    return elegidos;
  }

  // Si en el editor se cargó algo para "¿Le sumás algo?", sale eso (en ese orden);
  // si no, la carta elige sola. Lo que ya está en el pedido no se repite.
  function sugerenciasPedido(enPedido) {
    if (!extras.length) return sugerir(enPedido, null, 6);
    return extras.filter(function (it) { return enPedido.indexOf(it.id) === -1; });
  }

  function sugerenciasHTML(lista, titulo) {
    if (!lista.length) return "";
    return '<div class="sugerencias"><h3>' + esc(titulo) + '</h3><div class="sugerencias-fila">' +
      lista.map(function (it) {
        return '<div class="sug">' +
          '<button class="sug-abrir" type="button" data-abrir="' + esc(it.id) + '">' +
            '<span class="sug-foto">' + fotoHTML(it, 240, 240, false) + "</span>" +
            '<span class="sug-nombre">' + esc(it.nombre) + "</span>" +
            precioBloque(it, "sug-precio") +
          "</button>" +
          botonMas(it) +
        "</div>";
      }).join("") + "</div></div>";
  }

  // ---------- Ventanas (detalle, pedido, pantalla para el mozo) ----------

  function abrirHoja(tipo, html) {
    var yaAbierta = !hoja.hidden;
    hojaCaja.innerHTML = html;
    hojaCaja.className = "hoja-caja hoja-" + tipo;
    hojaCaja.setAttribute("aria-labelledby", "hoja-titulo");
    hojaAbierta = tipo;
    if (!yaAbierta) {
      ultimoFoco = document.activeElement;
      hoja.hidden = false;
      document.documentElement.className = "sin-scroll";
      void hoja.offsetWidth; // para que se vea la animación de entrada
      hoja.className = "hoja abierta";
      // Así el botón "atrás" del celular cierra la ventana en vez de salir de la carta.
      try { history.pushState({ hoja: true }, ""); } catch (e) { /* sin historial */ }
    }
    hojaCaja.scrollTop = 0;
    hojaCaja.focus();
    actualizarPedido();
  }

  function cerrarHoja(desdeHistorial) {
    if (hoja.hidden) return;
    hoja.className = "hoja";
    hoja.hidden = true;
    hojaCaja.innerHTML = "";
    document.documentElement.className = "";
    hojaAbierta = null;
    if (!desdeHistorial && history.state && history.state.hoja) history.back();
    if (ultimoFoco && ultimoFoco.focus && document.body.contains(ultimoFoco)) ultimoFoco.focus();
  }

  function cantidadHTML() {
    return '<div class="cantidad">' +
      '<button type="button" data-cantidad="-1" aria-label="Uno menos">' + ICONO.menos + "</button>" +
      '<span id="cantidad-valor" aria-live="polite">1</span>' +
      '<button type="button" data-cantidad="1" aria-label="Uno más">' + ICONO.mas + "</button>" +
    "</div>";
  }

  function abrirDetalle(id) {
    var it = items[id];
    if (!it) return;
    seleccion = { id: id, variante: 0, cantidad: 1 };
    var html =
      '<button class="hoja-cerrar" type="button" data-cerrar="1" aria-label="Cerrar">' + ICONO.cerrar + "</button>" +
      '<div class="hoja-foto">' + fotoHTML(it, 800, 600, false, it.nombre) + sellos(it) + "</div>" +
      '<div class="hoja-cuerpo">' +
        (it.validez ? '<p class="hoja-validez' + (it.vigente ? "" : " mas-tarde") + '">' + ICONO.reloj + esc(it.validez) + "</p>" : "") +
        '<h2 id="hoja-titulo">' + esc(it.nombre) + "</h2>" +
        (it.descripcion ? '<p class="hoja-desc">' + esc(it.descripcion) + "</p>" : "") +
        (it.variantes.length
          ? '<fieldset class="opciones"><legend>Elegí una opción</legend>' +
            it.variantes.map(function (v, i) {
              return '<label class="opcion' + (i === 0 ? " elegida" : "") + '">' +
                '<input type="radio" name="variante" value="' + i + '"' + (i === 0 ? " checked" : "") + ">" +
                '<span class="opcion-nombre">' + esc(v.nombre) + "</span>" +
                '<span class="opcion-precio">' + precioHTML(v.precio) + "</span>" +
              "</label>";
            }).join("") + "</fieldset>"
          : precioBloque(it, "hoja-precio")) +
        (!it.vigente ? '<p class="hoja-nota">Todavía no se puede pedir: ' + esc(it.validez.charAt(0).toLowerCase() + it.validez.slice(1)) + ".</p>" : "") +
        (it.precio === null && !it.variantes.length ? '<p class="hoja-nota">Consultá el precio en el local.</p>' : "") +
        sugerenciasHTML(sugerir([it.id], it.categoria, 4), "Va bien con") +
      "</div>" +
      (sePuedePedir(it)
        ? '<div class="hoja-pie">' + cantidadHTML() + '<button class="boton-principal" type="button" data-confirmar="1"></button></div>'
        : "");
    abrirHoja("detalle", html);
    actualizarBotonAgregar();
  }

  function actualizarBotonAgregar() {
    var boton = hojaCaja.querySelector("[data-confirmar]");
    if (!boton) return;
    var it = items[seleccion.id];
    var unitario = it.variantes.length ? it.variantes[seleccion.variante].precio : it.precio;
    boton.innerHTML = "<span>Agregar</span><span>" + pesos(unitario * seleccion.cantidad) + "</span>";
    $("cantidad-valor").textContent = seleccion.cantidad;
  }

  function puedeWhatsApp() {
    return !!negocio.pedidos_whatsapp && numeroWhatsApp().length >= 8;
  }

  function mensajeWhatsApp() {
    var partes = [
      "¡Hola" + (negocio.nombre ? " " + negocio.nombre : "") + "! Quiero hacer este pedido:",
      "",
      pedido.map(function (l) {
        var it = items[l.id];
        return "• " + l.cantidad + " × " + it.nombre + (l.variante ? " (" + l.variante + ")" : "") + " — " + pesos(precioLinea(l) * l.cantidad);
      }).join("\n"),
      "",
      "*Total: " + pesos(totalPedido()) + "*"
    ];
    var extra = [];
    if (formulario.nombre.trim()) extra.push("Nombre: " + formulario.nombre.trim());
    if (negocio.envio) {
      extra.push(formulario.modo === "envio"
        ? "Envío a domicilio" + (formulario.direccion.trim() ? ": " + formulario.direccion.trim() : "")
        : "Retiro en el local");
    }
    if (formulario.aclaraciones.trim()) extra.push("Aclaraciones: " + formulario.aclaraciones.trim());
    if (extra.length) partes.push("", extra.join("\n"));
    return partes.join("\n");
  }

  function formularioHTML() {
    function modo(valor, texto) {
      return '<button class="modo" type="button" role="radio" data-modo="' + valor + '" aria-checked="' + (formulario.modo === valor) + '">' + texto + "</button>";
    }
    return '<div class="formulario">' +
      '<label class="campo"><span>Tu nombre</span><input data-campo="nombre" type="text" autocomplete="given-name" maxlength="60" value="' + esc(formulario.nombre) + '" placeholder="Para saber de quién es el pedido"></label>' +
      (negocio.envio
        ? '<div class="modos" role="radiogroup" aria-label="¿Cómo lo querés?">' + modo("retiro", "Retiro en el local") + modo("envio", "Envío a domicilio") + "</div>" +
          (formulario.modo === "envio"
            ? '<label class="campo"><span>Dirección de entrega</span><input data-campo="direccion" type="text" autocomplete="street-address" maxlength="120" value="' + esc(formulario.direccion) + '" placeholder="Calle, número y barrio"></label>'
            : "")
        : "") +
      '<label class="campo"><span>Aclaraciones <small>(opcional)</small></span><textarea data-campo="aclaraciones" rows="2" maxlength="300" placeholder="Ej.: sin azúcar, con leche descremada">' + esc(formulario.aclaraciones) + "</textarea></label>" +
    "</div>";
  }

  function pedidoHTML() {
    var whatsapp = puedeWhatsApp();
    var total = pesos(totalPedido());
    var idsEnPedido = pedido.map(function (l) { return l.id; });
    return '<button class="hoja-cerrar" type="button" data-cerrar="1" aria-label="Cerrar">' + ICONO.cerrar + "</button>" +
      '<div class="hoja-cuerpo">' +
        '<h2 id="hoja-titulo">Mi pedido</h2>' +
        '<ul class="lineas">' +
          pedido.map(function (l, i) {
            var it = items[l.id];
            return '<li class="linea">' +
              '<span class="linea-foto">' + fotoHTML(it, 120, 120, false) + "</span>" +
              '<span class="linea-texto"><strong>' + esc(it.nombre) + "</strong>" +
                (l.variante ? "<small>" + esc(l.variante) + "</small>" : "") +
                '<span class="linea-precio">' + pesos(precioLinea(l) * l.cantidad) + "</span>" +
              "</span>" +
              '<span class="cantidad cantidad-chica">' +
                '<button type="button" data-linea="' + i + '" data-delta="-1" aria-label="' + (l.cantidad === 1 ? "Quitar " : "Uno menos de ") + esc(it.nombre) + '">' + (l.cantidad === 1 ? ICONO.tacho : ICONO.menos) + "</button>" +
                "<span>" + l.cantidad + "</span>" +
                '<button type="button" data-linea="' + i + '" data-delta="1" aria-label="Uno más de ' + esc(it.nombre) + '">' + ICONO.mas + "</button>" +
              "</span>" +
            "</li>";
          }).join("") +
        "</ul>" +
        '<div class="total"><span>Total</span><strong>' + total + "</strong></div>" +
        sugerenciasHTML(sugerenciasPedido(idsEnPedido), "¿Le sumás algo?") +
        (whatsapp ? formularioHTML() : "") +
        '<p class="hoja-nota">' + (whatsapp
          ? "Se abre WhatsApp con tu pedido ya escrito: solo tenés que enviarlo."
          : "Cuando estés listo, mostrale tu pedido al mozo o en la caja.") + "</p>" +
      "</div>" +
      '<div class="hoja-pie hoja-pie-columna">' +
        (whatsapp
          ? '<a class="boton-principal boton-whatsapp" id="enviar-whatsapp" href="' + esc(enlaceWhatsApp(mensajeWhatsApp())) + '" target="_blank" rel="noopener">' +
              ICONO.whatsapp + "<span>Pedir por WhatsApp</span><span>" + total + "</span></a>" +
            '<button class="boton-texto" type="button" data-mostrar-mozo="1">Mostrar el pedido en pantalla grande</button>'
          : '<button class="boton-principal" type="button" data-mostrar-mozo="1"><span>Mostrar pedido</span><span>' + total + "</span></button>") +
        '<button class="boton-texto" type="button" data-vaciar="1">Vaciar pedido</button>' +
      "</div>";
  }

  function abrirPedido() {
    if (pedido.length) abrirHoja("pedido", pedidoHTML());
  }

  function refrescarPedido() {
    if (hojaAbierta !== "pedido") return;
    var y = hojaCaja.scrollTop;
    hojaCaja.innerHTML = pedidoHTML();
    hojaCaja.scrollTop = y;
    actualizarPedido();
  }

  function abrirMozo() {
    abrirHoja("mozo",
      '<div class="mozo">' +
        '<p class="mozo-titulo" id="hoja-titulo">' + esc(negocio.nombre || "Pedido") + "</p>" +
        "<ul>" + pedido.map(function (l) {
          return "<li><b>" + l.cantidad + " ×</b> " + esc(items[l.id].nombre) + (l.variante ? " <small>(" + esc(l.variante) + ")</small>" : "") + "</li>";
        }).join("") + "</ul>" +
        (formulario.aclaraciones.trim() ? '<p class="mozo-nota">' + esc(formulario.aclaraciones.trim()) + "</p>" : "") +
        '<p class="mozo-total">Total ' + pesos(totalPedido()) + "</p>" +
        '<p class="mozo-ayuda">Mostrale esta pantalla al mozo o en la caja.</p>' +
        '<button class="boton-principal" type="button" data-volver-pedido="1"><span>Volver</span></button>' +
      "</div>");
  }

  // ---------- Compartir y avisos ----------

  function compartir() {
    var url = location.href.split("#")[0].split("?")[0];
    var nombre = negocio.nombre || "la carta";
    if (navigator.share) {
      navigator.share({ title: nombre, text: "Mirá la carta de " + nombre, url: url }).catch(function () { /* cancelado */ });
      return;
    }
    window.open("https://wa.me/?text=" + encodeURIComponent("Mirá la carta de " + nombre + ": " + url), "_blank");
  }

  var temporizadorAviso = null;
  function avisar(texto) {
    avisoFlotante.textContent = texto;
    avisoFlotante.className = "aviso-flotante visible";
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(function () { avisoFlotante.className = "aviso-flotante"; }, 1800);
  }

  // ---------- Toques ----------

  document.addEventListener("click", function (e) {
    var t = e.target;
    var el;
    if (!t.closest) return;

    if ((el = t.closest("[data-cerrar]"))) { cerrarHoja(); return; }

    if ((el = t.closest("[data-agregar]"))) {
      var id = el.getAttribute("data-agregar");
      if (items[id] && items[id].variantes.length) abrirDetalle(id);
      else {
        agregar(id, 0, 1);
        refrescarPedido();
      }
      return;
    }

    if ((el = t.closest("[data-abrir]"))) { abrirDetalle(el.getAttribute("data-abrir")); return; }

    if ((el = t.closest("[data-cantidad]"))) {
      seleccion.cantidad = Math.max(1, Math.min(99, seleccion.cantidad + Number(el.getAttribute("data-cantidad"))));
      actualizarBotonAgregar();
      return;
    }

    if (t.closest("[data-confirmar]")) {
      agregar(seleccion.id, seleccion.variante, seleccion.cantidad);
      cerrarHoja();
      return;
    }

    if ((el = t.closest("[data-linea]"))) {
      cambiarLinea(Number(el.getAttribute("data-linea")), Number(el.getAttribute("data-delta")));
      return;
    }

    if (t.closest("[data-vaciar]")) {
      if (window.confirm("¿Vaciar el pedido?")) {
        pedido = [];
        guardarPedido();
        actualizarPedido();
        cerrarHoja();
      }
      return;
    }

    if (t.closest("[data-mostrar-mozo]")) { abrirMozo(); return; }
    if (t.closest("[data-volver-pedido]")) { abrirHoja("pedido", pedidoHTML()); return; }

    if ((el = t.closest("[data-modo]"))) {
      formulario.modo = el.getAttribute("data-modo");
      refrescarPedido();
      return;
    }

    if ((el = t.closest("[data-ir]"))) { irA(el.getAttribute("data-ir")); return; }
    if (t.closest("[data-compartir]")) { compartir(); return; }
  });

  document.addEventListener("change", function (e) {
    if (e.target.name === "variante") {
      seleccion.variante = Number(e.target.value);
      cadaUno(hojaCaja.querySelectorAll(".opcion"), function (o) {
        o.className = o.contains(e.target) ? "opcion elegida" : "opcion";
      });
      actualizarBotonAgregar();
    }
  });

  document.addEventListener("input", function (e) {
    var campo = e.target.getAttribute && e.target.getAttribute("data-campo");
    if (campo) {
      formulario[campo] = e.target.value;
      var enlace = $("enviar-whatsapp");
      if (enlace) enlace.href = enlaceWhatsApp(mensajeWhatsApp());
    }
  });

  botonPedido.addEventListener("click", abrirPedido);
  $("abrir-buscador").addEventListener("click", abrirBuscador);
  $("cerrar-buscador").addEventListener("click", cerrarBuscador);
  var buscando = false;
  campoBuscar.addEventListener("input", function () {
    filtrar(campoBuscar.value);
    // Al empezar a escribir, sube hasta el principio de la carta para ver los resultados.
    if (campoBuscar.value && !buscando) window.scrollTo(0, carta.offsetTop - nav.offsetHeight);
    buscando = !!campoBuscar.value;
  });
  campoBuscar.addEventListener("keydown", function (e) {
    if (e.key === "Escape") cerrarBuscador();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && hojaAbierta) cerrarHoja();
  });
  window.addEventListener("popstate", function () {
    cerrarHoja(true);
  });

  // Con una ventana abierta, deslizar el dedo mueve solo la ventana, nunca la carta de atrás
  // (en iPhone y en algunos Android "overflow: hidden" no alcanza).
  var toque = null;
  document.addEventListener("touchstart", function (e) {
    toque = hojaAbierta && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  document.addEventListener("touchmove", function (e) {
    if (!hojaAbierta || !toque || e.touches.length !== 1 || !e.cancelable) return;
    var dx = e.touches[0].clientX - toque.x;
    var dy = e.touches[0].clientY - toque.y;
    var el = e.target;
    if (!hojaCaja.contains(el)) { e.preventDefault(); return; } // el fondo oscuro no se desliza
    if (Math.abs(dx) > Math.abs(dy)) return; // las filas que se deslizan de costado ("¿Le sumás algo?")
    // Se deja si algo de la ventana (o un cuadro de texto adentro) todavía puede moverse para ese lado.
    for (; el && el !== document.body; el = el.parentNode) {
      if (el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY)) {
        if (dy > 0 && el.scrollTop > 0) return;
        if (dy < 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return;
      }
      if (el === hojaCaja) break;
    }
    e.preventDefault();
  }, { passive: false });

  cargar();
})();
