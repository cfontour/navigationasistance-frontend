// Ejecutar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  const selectLocation = document.getElementById("select-location");
  const latElem = document.getElementById("lat");
  const lonElem = document.getElementById("lon");

  // NUEVO BURBUJA: estilos de la burbuja translúcida
  const estiloBurbuja = document.createElement("style");
  estiloBurbuja.textContent = `
    .leaflet-tooltip.burbuja-navegante {
      background: rgba(255, 255, 255, 0.75);
      border: 1px solid rgba(0, 0, 0, 0.15);
      border-radius: 12px;
      padding: 4px 8px;
      box-shadow: none;
      font-size: 12px;
      font-weight: 600;
      color: #2C2C2A;
    }
    .leaflet-tooltip-top.burbuja-navegante:before {
      border-top-color: rgba(255, 255, 255, 0.75);
    }
    .burbuja-navegante .bn-fila {
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
  `;
  document.head.appendChild(estiloBurbuja);

  const sirenaAudio = new Audio('img/sirena.mp3');
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
        iconSize: [32, 32],
        iconAnchor: [16, 16]
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

  // Alias para compatibilidad
  function obtenerColorUsuario(usuarioid) {
    return obtenerColorParaUsuario(usuarioid);
  }

  // Historial de trazas por usuario
  const rutaHistorial = new Map();
  let mostrarTraza = false; // Flag para mostrar traza
  let trazaActiva = false;
  let marcadorInicio = null;
  let polylineTraza = null; // Polyline de la ruta actual

  let naveganteSeleccionadoId = null;
  let colorSeleccionado = null;
  let usuarioTrazaActiva = null;

  // Sistema de tokens para evitar race conditions
  let trazaToken = 0;

  let map = L.map('map').setView([0, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  const swimmerMarkers = new Map();

  // Función para limpiar toda la traza (circles + bandera inicio + polyline)
  function limpiarTraza() {
    rutaHistorial.forEach(puntos => {
      puntos.forEach(p => map.removeLayer(p));
    });
    rutaHistorial.clear();
    if (marcadorInicio) {
      map.removeLayer(marcadorInicio);
      marcadorInicio = null;
    }
    if (polylineTraza) {
      map.removeLayer(polylineTraza);
      polylineTraza = null;
    }
  }

  // Trazar la ruta histórica completa del usuario para el día actual
  async function trazarRutaUsuarioEspecifico(usuarioId) {
    // si no hay traza activa para ese usuario, salir
    if (!mostrarTraza || usuarioTrazaActiva !== usuarioId) return;

    const miToken = ++trazaToken; // token propio de este llamado

    const fechaUruguay = new Date().toLocaleDateString("sv-SE", {
      timeZone: "America/Montevideo",
    });

    try {
      const resUuid = await fetch(
        `https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ultimorecorrido/${usuarioId}/${fechaUruguay}`
      );
      const uuidList = await resUuid.json();
      if (!uuidList || uuidList.length === 0) return;

      const ultimaRuta = uuidList[0];
      const res = await fetch(
        `https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ruta/${ultimaRuta}`
      );
      let puntos = await res.json();

      // orden por hora (UTC-3)
      puntos.sort((a, b) => {
        const tA = new Date(`${a.nadadorfecha}T${a.nadadorhora.split("T")[1]}`).getTime();
        const tB = new Date(`${b.nadadorfecha}T${b.nadadorhora.split("T")[1]}`).getTime();
        if (tA === tB) return Number(a.secuencia) - Number(b.secuencia);
        return tA - tB;
      });

      const latlngs = puntos
        .filter(
          (p) =>
            Number.isFinite(parseFloat(p.nadadorlat)) &&
            Number.isFinite(parseFloat(p.nadadorlng)) &&
            Number(p.secuencia) >= 1
        )
        .map((p) => [parseFloat(p.nadadorlat), parseFloat(p.nadadorlng)]);

      if (latlngs.length === 0) return;

      // si durante el fetch se apagó, abortar silencioso
      if (miToken !== trazaToken || !mostrarTraza || usuarioTrazaActiva !== usuarioId) return;

      // borrar anterior y dibujar
      if (polylineTraza) map.removeLayer(polylineTraza);

      const colorUsuario = obtenerColorUsuario(usuarioId);
      polylineTraza = L.polyline(latlngs, {
        color: colorUsuario,
        weight: 7,
        dashArray: "10, 10",
      }).addTo(map);

      // por encima de azulejos y debajo de UI
      polylineTraza.bringToFront();
    } catch (err) {
      console.error("❌ Error al trazar ruta:", err);
    }
  }

  // Activar traza para un usuario cuando se hace click en su marcador
  function activarTrazaParaUsuario(usuarioid, position, nombre) {
    naveganteSeleccionadoId = usuarioid;
    usuarioTrazaActiva = usuarioid;
    colorSeleccionado = obtenerColorParaUsuario(usuarioid);
    trazaActiva = true;
    mostrarTraza = true;

    // Limpiar traza previa (si había de otro usuario)
    limpiarTraza();

    // Marcador de inicio
    marcadorInicio = L.marker(position, {
      icon: L.icon({
        iconUrl: "img/start_flag.png",
        iconSize: [24, 24],
        iconAnchor: [12, 24]
      })
    }).addTo(map);

    // Cargar traza histórica del usuario
    cargarTrazaHistorica(usuarioid, colorSeleccionado);

    // Trazar la ruta completa del día
    trazarRutaUsuarioEspecifico(usuarioid);

    // Centrar mapa en el navegante
    map.setView(position, 15);
  }

  function desactivarTraza() {
    trazaActiva = false;
    mostrarTraza = false;
    usuarioTrazaActiva = null;
    limpiarTraza();
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "t" || event.key === "T") {
      trazaActiva = !trazaActiva;
      mostrarTraza = trazaActiva;
      alert(`Traza en vivo ${trazaActiva ? "activada" : "desactivada"}`);

      if (!trazaActiva) {
        limpiarTraza();
      }
    }
  });

  // Evento delegado para los botones de traza en los popups
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-toggle-traza')) {
      const usuarioid = e.target.dataset.usuario;
      const marker = swimmerMarkers.get(usuarioid);

      if (!marker) return;

      if (usuarioTrazaActiva === usuarioid) {
        // Desactivar traza
        desactivarTraza();
      } else {
        // Activar traza
        const pos = marker.getLatLng();
        const nombre = marker.options.nombre || "Navegante";
        activarTrazaParaUsuario(usuarioid, [pos.lat, pos.lng], nombre);
      }

      // Actualizar el popup dinámicamente
      const popup = marker.getPopup();
      if (popup) {
        const datosUsuario = {
          nombre: marker.options.nombre || "Navegante",
          apellido: ""
        };
        popup.setContent(htmlPopupUsuario(usuarioid, datosUsuario));
      }
    }
  });

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

  // NUEVO BURBUJA: solo el nombre, sin apellido
  async function getUsuarioPrimerNombre(id) {
    try {
      const res = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${id}`);
      const usuario = await res.json();
      return usuario.nombre || id;
    } catch (error) {
      console.error("Error al obtener nombre:", error);
      return id;
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
        const primerNombre = await getUsuarioPrimerNombre(usuarioid); // NUEVO BURBUJA

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
        const tooltipTexto = htmlBurbuja(primerNombre, nadador.bateria ?? 0, nadador.rssi); // NUEVO BURBUJA

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
          marker.options.nombre = nombre;
          marker.options.emergency = nadador.emergency === true;
        } else {
          marker = L.marker(position, {
            icon: icono,
            emergency: nadador.emergency === true,
            usuarioid: usuarioid,
            nombre: nombre
          })
            .addTo(map)
            .bindPopup(popupTexto)
            .bindTooltip(tooltipTexto, {           // NUEVO BURBUJA
              permanent: true,
              direction: 'top',
              offset: [0, -16],
              className: 'burbuja-navegante'
            });

          swimmerMarkers.set(usuarioid, marker);
        }

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

      // Si hay traza activa, re-trazar la ruta completa cada ciclo
      if (mostrarTraza && usuarioTrazaActiva) {
        await trazarRutaUsuarioEspecifico(usuarioTrazaActiva);
      }
    } catch (error) {
      console.error("Error al obtener la posición del nadador:", error);
    }
  }

  function htmlPopupUsuario(usuarioid, datosUsuario = {}) {
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
      </div>
    `;
  }

  // NUEVO BURBUJA: contenido de la burbuja (nombre + pila + señal)
  function htmlBurbuja(nombre, bateria, rssi) {
    return `
      <div class="bn-fila">
        <span>${nombre}</span>
        ${iconoBateria(bateria)}
        ${iconoSenal(rssi)}
      </div>`;
  }

  // NUEVO BURBUJA: pila de 5 segmentos (mismo código de colores que verposicion.js)
  function iconoBateria(pct) {
    const p = Math.max(0, Math.min(100, pct));
    const segmentos = p <= 0 ? 0 : Math.ceil(p / 20);

    let color;
    if (p > 60) color = "#639922";
    else if (p > 40) color = "#EF9F27";
    else if (p > 20) color = "#D85A30";
    else color = "#E24B4A";

    let rects = "";
    for (let i = 0; i < 5; i++) {
      const x = 3 + i * 6.2;
      const activo = i < segmentos;
      rects += `<rect x="${x}" y="3" width="5.2" height="12" rx="1"
                      fill="${activo ? color : "#D3D1C7"}" opacity="${activo ? 1 : 0.5}"/>`;
    }

    return `
      <svg width="34" height="15" viewBox="0 0 40 18" style="vertical-align: middle;">
        <rect x="1" y="1" width="34" height="16" rx="3" fill="none" stroke="#888780" stroke-width="1.5"/>
        <rect x="36" y="6" width="3" height="6" rx="1" fill="#888780"/>
        ${rects}
      </svg>`;
  }

  // NUEVO BURBUJA: ícono estilo wifi (mismos umbrales que verposicion.js)
  function iconoSenal(rssi) {
    const sinDato = (rssi === null || rssi === undefined || rssi >= 0);

    let nivel = 0;
    if (!sinDato) {
      if (rssi >= -70) nivel = 4;
      else if (rssi >= -85) nivel = 3;
      else if (rssi >= -100) nivel = 2;
      else if (rssi >= -115) nivel = 1;
    }

    const colorActivo = nivel >= 3 ? "#639922" : "#BA7517";
    const colorInactivo = "#B4B2A9";
    const c = n => (nivel >= n ? colorActivo : colorInactivo);
    const o = n => (nivel >= n ? 1 : 0.45);

    return `
      <svg width="24" height="16" viewBox="25 0 150 100" style="vertical-align: middle;">
        <path d="M100 96 L83 79 A24 24 0 0 1 117 79 Z" fill="${c(1)}" opacity="${o(1)}"/>
        <path d="M68.9 64.9 A44 44 0 0 1 131.1 64.9" fill="none" stroke="${c(2)}" stroke-width="12" stroke-linecap="round" opacity="${o(2)}"/>
        <path d="M53.3 49.3 A66 66 0 0 1 146.7 49.3" fill="none" stroke="${c(3)}" stroke-width="12" stroke-linecap="round" opacity="${o(3)}"/>
        <path d="M37.8 33.8 A88 88 0 0 1 162.2 33.8" fill="none" stroke="${c(4)}" stroke-width="12" stroke-linecap="round" opacity="${o(4)}"/>
      </svg>`;
  }

  // Iniciar ciclo de actualizaciones
  setInterval(getSwimmer, 5000);
});