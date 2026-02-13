// Ejecutar cuando el DOM esté listo

const params = new URLSearchParams(window.location.search);
const naveganteSeleccionadoId = params.get("usuario");

if (!naveganteSeleccionadoId) {
  alert("ID de usuario no especificado en la URL.");
}

document.addEventListener("DOMContentLoaded", () => {
  const latElem = document.getElementById("lat");
  const lonElem = document.getElementById("lon");

  const sirenaAudio = new Audio("img/sirena.mp3");
  sirenaAudio.loop = false;

  const iconosDisponibles = [
    "marker_na_rojo.png",
    "marker_na_verde.png",
    "marker_na_anaranjado.png",
    "marker_na_lila.png",
    "marker_na_negro.png",
    "marker_na_amarillo.png",
    "marker_na_violeta.png",
    "marker_na_azul.png",
  ];

  const iconosPorUsuario = new Map();
  let indiceIcono = 0;

  function obtenerIconoParaUsuario(usuarioid) {
    if (!iconosPorUsuario.has(usuarioid)) {
      const archivo = iconosDisponibles[indiceIcono % iconosDisponibles.length];
      const icono = L.icon({
        iconUrl: `img/${archivo}`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      iconosPorUsuario.set(usuarioid, icono);
      indiceIcono++;
    }
    return iconosPorUsuario.get(usuarioid);
  }

  const coloresDisponibles = [
    "#e6194b", "#3cb44b", "#ffe119", "#4363d8",
    "#f58231", "#911eb4", "#46f0f0", "#f032e6",
    "#bcf60c", "#fabebe", "#008080", "#e6beff",
    "#9a6324", "#fffac8", "#800000", "#aaffc3",
  ];

  const coloresPorUsuario = new Map();
  let indiceColor = 0;

  function obtenerColorParaUsuario(usuarioid) {
    if (!coloresPorUsuario.has(usuarioid)) {
      const color = coloresDisponibles[indiceColor % coloresDisponibles.length];
      coloresPorUsuario.set(usuarioid, color);
      indiceColor++;
    }
    return coloresPorUsuario.get(usuarioid);
  }

  // Historial de trazas por "usuario" (en vivo) y por "uuid" (histórica)
  const rutaHistorial = new Map();
  let trazaActiva = false;
  let marcadorInicio = null;

  const colorSeleccionado = obtenerColorParaUsuario(naveganteSeleccionadoId);

  const map = L.map("map").setView([0, 0], 2);

  // Satélite
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19 }
  ).addTo(map);

  const swimmerMarkers = new Map();

  const api_url = "https://navigationasistance-backend-1.onrender.com/nadadorposicion/listar";

  async function getUsuario(id) {
    try {
      const res = await fetch(
        `https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${id}`
      );
      return await res.json();
    } catch (err) {
      console.error("Error al obtener usuario:", err);
      return null;
    }
  }

  async function getUsuarioNombre(id) {
    try {
      const res = await fetch(
        `https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${id}`
      );
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
      const response = await fetch(
        `https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${usuarioid}`
      );
      if (response.ok) {
        const data = await response.json();
        return data.telefono || "Sin teléfono";
      }
    } catch (error) {
      console.error(`Error al obtener el teléfono de ${usuarioid}:`, error);
    }
    return "Sin teléfono";
  }

  // === LÓGICA "NUEVA" PARA TRAZA (uuid desde ultimorecorrido) ===
  // Trae el UUID del último recorrido del día (Uruguay) y luego carga la ruta por UUID
  async function cargarTrazaHistoricaPorUsuario(usuarioId, color) {
    try {
      const fechaUruguay = new Date().toLocaleDateString("sv-SE", {
        timeZone: "America/Montevideo",
      });

      const resUuid = await fetch(
        `https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ultimorecorrido/${encodeURIComponent(usuarioId)}/${fechaUruguay}`
      );

      if (!resUuid.ok) {
        const body = await resUuid.text();
        console.error("ultimorecorrido error", resUuid.status, body);
        return;
      }

      const uuidList = await resUuid.json();

      if (!Array.isArray(uuidList) || uuidList.length === 0) {
        console.warn("No hay uuid de recorrido para hoy:", usuarioId, fechaUruguay);
        return;
      }

      const ultimaRutaUuid = uuidList[0];

      // ahora sí, traigo puntos por UUID real
      await cargarTrazaHistorica(ultimaRutaUuid, color);
    } catch (err) {
      console.error("Error al obtener uuid del último recorrido:", err);
    }
  }

  // Carga la ruta por UUID (esto ya existía, pero robusto + fitBounds)
  async function cargarTrazaHistorica(uuid, color) {
    try {
      const url = `https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ruta/${encodeURIComponent(uuid)}`;
      const res = await fetch(url);

      if (!res.ok) {
        const body = await res.text();
        console.error("Traza histórica: backend respondió error", res.status, body);
        return;
      }

      const puntos = await res.json();

      if (!Array.isArray(puntos)) {
        console.error("Traza histórica: respuesta inesperada (no es array):", puntos);
        return;
      }

      if (puntos.length === 0) {
        console.warn("Traza histórica: no hay puntos para:", uuid);
        return;
      }

      const historial = [];
      const latlngs = [];

      for (const punto of puntos) {
        // soporte para ambos formatos posibles
        const lat = parseFloat(punto.latitud ?? punto.nadadorlat);
        const lng = parseFloat(punto.longitud ?? punto.nadadorlng);
        if (isNaN(lat) || isNaN(lng)) continue;

        const ll = [lat, lng];
        latlngs.push(ll);

        const marcador = L.circleMarker(ll, {
          radius: 5,
          color: color,
          fillColor: color,
          fillOpacity: 0.8,
        }).addTo(map);

        historial.push(marcador);
      }

      // guardo por UUID (histórica)
      rutaHistorial.set(uuid, historial);

      // para verla siempre
      if (latlngs.length) map.fitBounds(latlngs, { padding: [30, 30] });
    } catch (err) {
      console.error("Error al cargar traza histórica:", err);
    }
  }

  function limpiarTrazaVisual() {
    // borro TODO lo dibujado en historial (sea uuid o usuario)
    rutaHistorial.forEach((puntos) => puntos.forEach((p) => map.removeLayer(p)));
    rutaHistorial.clear();

    if (marcadorInicio) {
      map.removeLayer(marcadorInicio);
      marcadorInicio = null;
    }
  }

  async function getSwimmer() {
    const params = new URLSearchParams(window.location.search);
    const usuarioId = params.get("usuario");

    if (!usuarioId) {
      console.error("No se especificó el parámetro ?usuario= en la URL.");
      return;
    }

    try {
      const response = await fetch(api_url);
      const data = await response.json();

      const nadador = data.find((n) => n.usuarioid === usuarioId);
      if (!nadador) {
        console.warn("El usuario especificado no se encuentra activo:", usuarioId);
        return;
      }

      const { nadadorlat, nadadorlng } = nadador;
      const lat = parseFloat(nadadorlat);
      const lng = parseFloat(nadadorlng);
      if (isNaN(lat) || isNaN(lng)) return;

      const nombre = await getUsuarioNombre(usuarioId);
      const telefono = await getUsuarioTelefono(usuarioId);
      const position = [lat, lng];

      const fechaRaw = nadador.fechaUltimaActualizacion;
      let hora = "Sin fecha";
      try {
        const date = new Date(fechaRaw);
        if (!isNaN(date.getTime())) {
          const dia = String(date.getDate()).padStart(2, "0");
          const mes = String(date.getMonth() + 1).padStart(2, "0");
          const anio = date.getFullYear();
          const horaTxt = date.toLocaleTimeString("es-UY", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          hora = `${dia}/${mes}/${anio} ${horaTxt}`;
        }
      } catch (e) {
        console.error("Error formateando hora:", e);
      }

      const estado = nadador.estado || "Navegante";

      const popupTexto = `👤 ${nombre}<br>📞 ${telefono}<br>🕒 ${hora}`;
      const tooltipTexto = `👤 ${nombre}\n🆔 ${usuarioId}\n🕒 ${hora}\n📶 Estado: ${estado}`;

      let icono;
      if (nadador.emergency === true) {
        icono = L.icon({
          iconUrl: "img/marker-emergencia-36x39.png",
          iconSize: [36, 39],
          iconAnchor: [18, 39],
          className: "icono-emergencia",
        });

        if (sirenaAudio.paused) {
          sirenaAudio.play().catch((e) => console.warn("No se pudo reproducir la sirena:", e));
        }
      } else {
        icono = obtenerIconoParaUsuario(usuarioId);
      }

      if (swimmerMarkers.has(usuarioId)) {
        const marker = swimmerMarkers.get(usuarioId);
        marker.setLatLng(position);
        marker.setIcon(icono);
        marker.setPopupContent(popupTexto);
        marker.setTooltipContent(tooltipTexto);
      } else {
        const marker = L.marker(position, {
          icon: icono,
          usuarioid: usuarioId,
        })
          .addTo(map)
          .bindPopup(popupTexto)
          .bindTooltip(tooltipTexto, { permanent: false, direction: "top" });

        swimmerMarkers.set(usuarioId, marker);
      }

      // Seguimiento si la traza NO está activa
      if (!trazaActiva && map) {
        map.setView(position, map.getZoom());
      }

      latElem.textContent = lat.toFixed(2);
      lonElem.textContent = lng.toFixed(2);
    } catch (error) {
      console.error("Error al obtener la posición del nadador:", error);
    }
  }

  document.getElementById("btn-traza").addEventListener("click", async () => {
    trazaActiva = !trazaActiva;
    alert(`Traza en vivo ${trazaActiva ? "activada" : "desactivada"}`);

    if (!trazaActiva) {
      // limpiar traza + inicio
      limpiarTrazaVisual();

      // (mantengo tu estándar original de borrar marker del navegante)
      if (swimmerMarkers.has(naveganteSeleccionadoId)) {
        map.removeLayer(swimmerMarkers.get(naveganteSeleccionadoId));
        swimmerMarkers.delete(naveganteSeleccionadoId);
      }
    } else {
      // activar: 1) pintar histórico usando uuid del día  2) poner bandera inicio (con posición actual cuando llegue)
      if (naveganteSeleccionadoId && colorSeleccionado) {
        await cargarTrazaHistoricaPorUsuario(naveganteSeleccionadoId, colorSeleccionado);
      }
    }
  });

  async function actualizarNadador() {
    const usuarioid = naveganteSeleccionadoId;
    if (!usuarioid) {
      console.error("No se especificó ningún ID de usuario en la URL.");
      return;
    }

    try {
      const res = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listar");
      const nadadores = await res.json();

      const nadador = nadadores.find((n) => n.usuarioid === usuarioid);

      // Si ya no está activo, limpiamos todo
      if (!nadador) {
        console.warn("El usuario ya no está activo:", usuarioid);

        if (swimmerMarkers.has(usuarioid)) {
          map.removeLayer(swimmerMarkers.get(usuarioid));
          swimmerMarkers.delete(usuarioid);
        }

        limpiarTrazaVisual();

        latElem.textContent = "--";
        lonElem.textContent = "--";
        return;
      }

      const { nadadorlat, nadadorlng, emergency, fechaUltimaActualizacion, estado } = nadador;
      const lat = parseFloat(nadadorlat);
      const lng = parseFloat(nadadorlng);
      if (isNaN(lat) || isNaN(lng)) return;

      const usuario = await getUsuario(usuarioid);
      const nombre = usuario?.nombre || "Nombre desconocido";
      const apellido = usuario?.apellido || "";
      const telefono = usuario?.telefono || "Sin teléfono";
      const nombreCompleto = `${nombre} ${apellido}`.trim();

      let hora = "Sin fecha";
      try {
        const date = new Date(fechaUltimaActualizacion);
        if (!isNaN(date.getTime())) {
          const dia = String(date.getDate()).padStart(2, "0");
          const mes = String(date.getMonth() + 1).padStart(2, "0");
          const anio = date.getFullYear();
          const horaTxt = date.toLocaleTimeString("es-UY", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          hora = `${dia}/${mes}/${anio} ${horaTxt}`;
        }
      } catch (e) {
        console.error("Error formateando hora:", e);
      }

      const position = [lat, lng];
      const estadoTexto = estado || "Navegante";

      const popupTexto = `👤 ${nombreCompleto}<br>📞 ${telefono}<br>🕒 ${hora}`;
      const tooltipTexto = `👤 ${nombreCompleto}\n🆔 ${usuarioid}\n🕒 ${hora}\n📶 Estado: ${estadoTexto}`;

      let icono;
      if (emergency === true) {
        icono = L.icon({
          iconUrl: "img/marker-emergencia-36x39.png",
          iconSize: [36, 39],
          iconAnchor: [18, 39],
          className: "icono-emergencia",
        });

        if (sirenaAudio.paused) {
          sirenaAudio.play().catch((e) => console.warn("No se pudo reproducir la sirena:", e));
        }
      } else {
        icono = obtenerIconoParaUsuario(usuarioid);
      }

      if (swimmerMarkers.has(usuarioid)) {
        const marker = swimmerMarkers.get(usuarioid);
        marker.setLatLng(position);
        marker.setIcon(icono);
        marker.setPopupContent(popupTexto);
        marker.setTooltipContent(tooltipTexto);
      } else {
        const marker = L.marker(position, {
          icon: icono,
          emergency: emergency === true,
          usuarioid: usuarioid,
        })
          .addTo(map)
          .bindPopup(popupTexto)
          .bindTooltip(tooltipTexto, { permanent: false, direction: "top" });

        swimmerMarkers.set(usuarioid, marker);
      }

      if (!trazaActiva) {
        map.setView(position, 15);
      }

      // Traza EN VIVO (igual a tu lógica original)
      if (trazaActiva) {
        if (!rutaHistorial.has(usuarioid)) rutaHistorial.set(usuarioid, []);
        const puntos = rutaHistorial.get(usuarioid);

        const punto = L.circleMarker(position, {
          radius: 5,
          color: colorSeleccionado,
          fillColor: colorSeleccionado,
          fillOpacity: 0.8,
        }).addTo(map);

        puntos.push(punto);

        if (!marcadorInicio) {
          marcadorInicio = L.marker(position, {
            icon: L.icon({
              iconUrl: "img/start_flag.png",
              iconSize: [24, 24],
              iconAnchor: [12, 24],
            }),
          }).addTo(map);
        }
      }

      latElem.textContent = lat.toFixed(5);
      lonElem.textContent = lng.toFixed(5);
    } catch (err) {
      console.error("Error al actualizar nadador:", err);
    }
  }

  // ciclo
  setInterval(getSwimmer, 5000);
  setInterval(actualizarNadador, 5000);
});
