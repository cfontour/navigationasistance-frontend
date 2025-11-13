// Ejecutar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  const selectLocation = document.getElementById("select-location");
  const latElem = document.getElementById("lat");
  const lonElem = document.getElementById("lon");

  const sirenaAudio = new Audio('img/sirena.mp3'); // colocá el archivo en la misma carpeta que el mapa.html
  sirenaAudio.loop = false;

  const iconosDisponibles = [
    "marker_na_rojo.png",
    "marker_na_verde.png",
    "marker_na_anaranjado.png",
    "marker_na_lila.png",
    "marker_na_negro.png",
    "marker_na_amarillo.png",
    "marker_na_violeta.png",
    "marker_na_azul.png"
  ];

  const iconosPorUsuario = new Map();
  let indiceIcono = 0;

  function obtenerIconoParaUsuario(usuarioid) {
    if (!iconosPorUsuario.has(usuarioid)) {
      const archivo = iconosDisponibles[indiceIcono % iconosDisponibles.length];
      const icono = L.icon({
        iconUrl: `img/${archivo}`,
        iconSize: [32, 32], // o el tamaño real del PNG
        iconAnchor: [16, 16] // centro
      });
      iconosPorUsuario.set(usuarioid, icono);
      indiceIcono++;
    }
    return iconosPorUsuario.get(usuarioid);
  }

  const coloresPorUsuario = new Map();
  let indiceColor = 0;

  const coloresDisponibles = [
    "#e6194b", "#3cb44b", "#ffe119", "#4363d8",
    "#f58231", "#911eb4", "#46f0f0", "#f032e6",
    "#bcf60c", "#fabebe", "#008080", "#e6beff",
    "#9a6324", "#fffac8", "#800000", "#aaffc3"
  ];

  function obtenerColorParaUsuario(usuarioid) {
    if (!coloresPorUsuario.has(usuarioid)) {
      const color = coloresDisponibles[indiceColor % coloresDisponibles.length];
      coloresPorUsuario.set(usuarioid, color);
      indiceColor++;
    }
    return coloresPorUsuario.get(usuarioid);
  }

  // Historial de trazas por usuario
  const rutaHistorial = new Map();
  let trazaActiva = false;
  let marcadorInicio = null;

  let naveganteSeleccionadoId = null;
  let colorSeleccionado = null;

  let map = L.map('map').setView([0, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  const swimmerMarkers = new Map();

  // Función para limpiar toda la traza (circles + bandera inicio)
  function limpiarTraza() {
    rutaHistorial.forEach(puntos => {
      puntos.forEach(p => map.removeLayer(p));
    });
    rutaHistorial.clear();
    if (marcadorInicio) {
      map.removeLayer(marcadorInicio);
      marcadorInicio = null;
    }
  }

  // Activar traza para un usuario cuando se hace click en su marcador
  function activarTrazaParaUsuario(usuarioid, position, nombre) {
    naveganteSeleccionadoId = usuarioid;
    colorSeleccionado = obtenerColorParaUsuario(usuarioid);
    trazaActiva = true;

    // Actualizar texto del botón de dropdown (opcional, pero queda prolijo)
    const dropdownButton = document.getElementById("dropdownButton");
    if (dropdownButton) {
      dropdownButton.textContent = `👤 ${nombre}`;
    }

    // Limpiar traza previa (si había de otro usuario)
    limpiarTraza();

    // Marcador de inicio (si querés marcar el punto donde se clickeó)
    marcadorInicio = L.marker(position, {
      icon: L.icon({
        iconUrl: "img/start_flag.png",
        iconSize: [24, 24],
        iconAnchor: [12, 24]
      })
    }).addTo(map);

    // Cargar traza histórica del usuario
    cargarTrazaHistorica(usuarioid, colorSeleccionado);

    // Centrar mapa en el navegante
    map.setView(position, 15);
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "t" || event.key === "T") {
      trazaActiva = !trazaActiva;
      alert(`Traza en vivo ${trazaActiva ? "activada" : "desactivada"}`);

      if (!trazaActiva) {
        limpiarTraza();
      }
    }
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-activar-traza');
    if (!btn) return;

    const usuarioid = btn.dataset.usuarioid;
    const nombre = btn.dataset.nombre;

    const marker = swimmerMarkers.get(usuarioid);
    if (!marker) return;

    const pos = marker.getLatLng();
    activarTrazaParaUsuario(usuarioid, [pos.lat, pos.lng], nombre);
  });

  // Ya NO usamos el botón btn-traza (fue removido del HTML)

  function createSwimmerIcon(zoomLevel) {
    const minSize = 24;
    const scaleFactor = 4;
    const size = Math.max(minSize, zoomLevel * scaleFactor);
    return L.icon({
      iconUrl: 'img/optimist_marker_30x30.png',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  map.on('zoomend', function () {
    swimmerMarkers.forEach(marker => {
      const id = marker.options.usuarioid;
      if (id) {
        const icono = marker.options.emergency === true
          ? L.icon({
              iconUrl: 'img/marker-emergencia-36x39.png',
              iconSize: [36, 39],
              iconAnchor: [18, 39],
              className: 'icono-emergencia'
            })
          : obtenerIconoParaUsuario(id);

        marker.setIcon(icono);
      }
    });
  });

  function updateMap(coords) {
    if (!Array.isArray(coords) || coords.length !== 2) return;
    const lat = parseFloat(coords[0]);
    const lng = parseFloat(coords[1]);
    if (isNaN(lat) || isNaN(lng)) return;

    map.flyTo([lat, lng], 15);
    latElem.textContent = lat.toFixed(5);
    lonElem.textContent = lng.toFixed(5);
  }

  const api_url = new URL("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listar");
  let firstTime = true;

  async function cargarNavegantes() {
    try {
      const response = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listar");
      const nadadores = await response.json();

      const lista = document.getElementById("navegantesList");
      lista.innerHTML = ""; // limpiar lista previa

      const usuariosProcesados = new Set();

      for (const nadador of nadadores) {
        const lat = parseFloat(nadador.nadadorlat);
        const lng = parseFloat(nadador.nadadorlng);
        const id = nadador.usuarioid;

        if (isNaN(lat) || isNaN(lng) || usuariosProcesados.has(id)) continue;

        usuariosProcesados.add(id);

        const usuarioRes = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${id}`);
        const usuario = await usuarioRes.json();
        const nombre = usuario.nombre && usuario.apellido
          ? `${usuario.nombre} ${usuario.apellido}`
          : usuario.nombre || "Navegante";

        const color = obtenerColorParaUsuario(id);

        const li = document.createElement("li");
        li.dataset.id = id;
        li.dataset.lat = lat;
        li.dataset.lng = lng;
        li.dataset.nombre = nombre;
        li.className = "navegante-item";
        li.innerHTML = `
          <span class="color-dot" style="background-color: ${color};"></span>
          ${nombre}
        `;

        lista.appendChild(li);
      }
    } catch (error) {
      console.error("Error al cargar navegantes:", error);
    }
  }

  async function cargarTrazaHistorica(uuid, color) {
    try {
      const res = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ruta/${uuid}`);
      const puntos = await res.json();

      if (!puntos || puntos.length === 0) {
        console.warn("Sin puntos para el recorrido.");
        return;
      }

      const historial = [];
      for (const punto of puntos) {
        const lat = parseFloat(punto.latitud);
        const lng = parseFloat(punto.longitud);

        if (isNaN(lat) || isNaN(lng)) continue;

        const marcador = L.circleMarker([lat, lng], {
          radius: 5,
          color: color,
          fillColor: color,
          fillOpacity: 0.8
        }).addTo(map);

        historial.push(marcador);
      }

      rutaHistorial.set(uuid, historial);
    } catch (err) {
      console.error("Error al cargar traza histórica:", err);
    }
  }

  document.getElementById("navegantesList").addEventListener("click", function (e) {
    const clickedItem = e.target.closest("li[data-id]");
    if (!clickedItem) return;

    const id = clickedItem.getAttribute("data-id");
    const lat = parseFloat(clickedItem.dataset.lat);
    const lng = parseFloat(clickedItem.dataset.lng);
    const nombre = clickedItem.dataset.nombre;

    naveganteSeleccionadoId = id;
    colorSeleccionado = obtenerColorParaUsuario(id);

    // Cambiar el texto del botón
    document.getElementById("dropdownButton").textContent = `👤 ${nombre}`;

    // Centrar el mapa
    if (!isNaN(lat) && !isNaN(lng)) {
      map.flyTo([lat, lng], 15);
    }

    // Ocultar el menú desplegable
    document.getElementById("navegantesList").style.display = "none";
  });

  document.getElementById("dropdownButton").addEventListener("click", () => {
    const lista = document.getElementById("navegantesList");
    lista.style.display = lista.style.display === "block" ? "none" : "block";
  });

  async function getUsuarioNombre(id) {
    try {
      const res = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${id}`);
      const usuario = await res.json();
      return usuario.nombre && usuario.apellido
        ? `${usuario.nombre} ${usuario.apellido}`
        : usuario.nombre || "Nombre no disponible";
    } catch (error) {
      console.error("Error al obtener nombre completo:", error);
      return "Nombre no disponible";
    }
  }

  async function getUsuarioTelefono(usuarioid) {
    try {
      const response = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${usuarioid}`);
      if (response.ok) {
        const data = await response.json();
        return data.telefono || 'Sin teléfono';
      }
    } catch (error) {
      console.error(`Error al obtener el teléfono de ${usuarioid}:`, error);
    }
    return 'Sin teléfono';
  }

  const iconoInicio = L.icon({
    iconUrl: 'img/start_flag.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });

  async function getSwimmer() {
    try {
      const response = await fetch(api_url);
      const data = await response.json();

      const nuevosIds = new Set();

      for (let nadador of data) {
        const { usuarioid, nadadorlat, nadadorlng } = nadador;
        const lat = parseFloat(nadadorlat);
        const lng = parseFloat(nadadorlng);
        if (isNaN(lat) || isNaN(lng)) continue;

        nuevosIds.add(usuarioid);

        const nombre = await getUsuarioNombre(usuarioid);
        const telefono = await getUsuarioTelefono(usuarioid);

        const position = [lat, lng];

        // 📍 Agregar punto a la traza si está activa y corresponde a este usuario
        if (trazaActiva && usuarioid === naveganteSeleccionadoId) {
          if (!rutaHistorial.has(usuarioid)) {
            rutaHistorial.set(usuarioid, []);
          }
          const puntos = rutaHistorial.get(usuarioid);

          const color = obtenerColorParaUsuario(usuarioid);

          const markerRuta = L.circleMarker(position, {
            radius: 5,
            color: color,
            fillColor: color,
            fillOpacity: 0.8
          }).addTo(map);

          puntos.push(markerRuta);
        }

        // 🕒 fecha / hora última actualización
        const fechaRaw = nadador.fechaUltimaActualizacion;
        let hora = "";
        try {
          const date = new Date(fechaRaw);
          if (!isNaN(date.getTime())) {
            const dia = String(date.getDate()).padStart(2, '0');
            const mes = String(date.getMonth() + 1).padStart(2, '0');
            const anio = date.getFullYear();
            const horaTxt = date.toLocaleTimeString('es-UY', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });

            hora = `${dia}/${mes}/${anio} ${horaTxt}`;
          } else {
            hora = "Fecha inválida";
          }
        } catch (e) {
          console.log("Debug usuarioid:", usuarioid, "fechaUltimaActualizacion:", fechaRaw);
          console.error("Error formateando hora:", e);
          hora = "Sin fecha";
        }

        const estado = nadador.estado ? nadador.estado : "Navegante";

        // Usar htmlPopupUsuario para construir el popup dinámico
        const datosUsuario = {
          nombre: nombre,
          apellido: ""
        };
        const popupTexto = htmlPopupUsuario(usuarioid, datosUsuario);
        const tooltipTexto = `👤 ${nombre}\n🆔 ${usuarioid}\n🕒 ${hora}\n📶 Estado: ${estado}`;

        // EMERGENCIA
        let icono;
        if (nadador.emergency === true) {
          icono = L.icon({
            iconUrl: 'img/marker-emergencia-36x39.png',
            iconSize: [36, 39],
            iconAnchor: [18, 39],
            className: 'icono-emergencia'
          });

          if (sirenaAudio.paused) {
            sirenaAudio.play().catch(e => console.warn("No se pudo reproducir la sirena:", e));
          }
        } else {
          icono = obtenerIconoParaUsuario(usuarioid);
        }

        // Actualizar o crear marcador del nadador
        let marker = swimmerMarkers.get(usuarioid);
        if (marker) {
          marker.setLatLng(position);
          marker.setIcon(icono);
          marker.setPopupContent(popupTexto);
          marker.setTooltipContent(tooltipTexto);
          if (!marker.options.usuarioid) {
            marker.options.usuarioid = usuarioid;
          }
          marker.options.emergency = nadador.emergency === true;
        } else {
          marker = L.marker(position, {
            icon: icono,
            emergency: nadador.emergency === true,
            usuarioid: usuarioid
          })
            .addTo(map)
            .bindPopup(popupTexto)
            .bindTooltip(tooltipTexto, { permanent: false, direction: 'top' });

          swimmerMarkers.set(usuarioid, marker);
        }

        // 📌 Click en marcador = activar traza para ese navegante
        //if (!marker._trazaClickAttached) {
        //  marker.on('click', () => {
        //    activarTrazaParaUsuario(usuarioid, position, nombre);
        //  });
        //  marker._trazaClickAttached = true;
        //}

        // ⛳ Marcar inicio si aún no lo hicimos y la traza está activa para este usuario
        if (trazaActiva && usuarioid === naveganteSeleccionadoId && !marcadorInicio) {
          marcadorInicio = L.marker(position, { icon: iconoInicio }).addTo(map);
        }

        // Seguir al nadador solo si NO hay traza (modo "seguimiento simple")
        if (!trazaActiva && usuarioid === naveganteSeleccionadoId) {
          map.setView(position, map.getZoom());
        }
      }

      // Eliminar marcadores que ya no están activos
      for (let id of swimmerMarkers.keys()) {
        if (!nuevosIds.has(id)) {
          map.removeLayer(swimmerMarkers.get(id));
          swimmerMarkers.delete(id);
        }
      }

      if (firstTime && swimmerMarkers.size > 0) {
        const firstMarker = Array.from(swimmerMarkers.values())[0];
        map.setView(firstMarker.getLatLng(), 15);
        firstTime = false;
      }

      if (data[0]) {
        latElem.textContent = parseFloat(data[0].nadadorlat).toFixed(2);
        lonElem.textContent = parseFloat(data[0].nadadorlng).toFixed(2);
      }
    } catch (error) {
      console.error("Error al obtener la posición del nadador:", error);
    }
  }

  function htmlPopupUsuario(usuarioid, datosUsuario = {}) {
    const historial = historialPuntos.get(usuarioid) || [];
    const listaHtml = historial
      .map(
        (p) =>
          `<li>${p.etiqueta} <small>${new Date(p.fechaHora).toLocaleTimeString()}</small></li>`
      )
      .join("");

    const esTrazaActiva = usuarioTrazaActiva === usuarioid;
    const textoBoton = esTrazaActiva ? "🔴 Desactivar Traza" : "🟢 Activar Traza";
    const colorBoton = esTrazaActiva ? "#e74c3c" : "#27ae60";

    const nombreCompleto = datosUsuario.nombre
      ? `${datosUsuario.nombre} ${datosUsuario.apellido || ""}`
      : `Usuario ${usuarioid}`;

    return `
      <div style="min-width: 220px;">
        <strong>📍 ${nombreCompleto}</strong><br/>
        <small>ID: ${usuarioid}</small><br/><br/>
        <div style="margin: 10px 0;">
          <button
            class="btn-toggle-traza"
            data-usuario="${usuarioid}"
            style="
              background: ${colorBoton};
              color: white;
              border: none;
              padding: 8px 12px;
              border-radius: 5px;
              cursor: pointer;
              font-weight: bold;
              width: 100%;
              margin-bottom: 10px;
            "
          >${textoBoton}</button>
        </div>
        <strong>🏁 Puntos de control:</strong><br/>
        <ul style="margin: 5px 0; padding-left: 20px;">
          ${listaHtml.length > 0 ? listaHtml : "<li><em>Sin puntos registrados</em></li>"}
        </ul>
      </div>
    `;
  }

  cargarNavegantes();
  setInterval(getSwimmer, 5000);
  setInterval(cargarNavegantes, 5000); // o el intervalo que prefieras
});
