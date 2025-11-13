// Ejecutar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  const selectLocation = document.getElementById("select-location");
  const latElem = document.getElementById("lat");
  const lonElem = document.getElementById("lon");

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
            .bindTooltip(tooltipTexto, { permanent: false, direction: 'top' });

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

  // Iniciar ciclo de actualizaciones
  setInterval(getSwimmer, 5000);
});
