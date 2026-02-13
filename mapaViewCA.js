// Ejecutar cuando el DOM esté listo
const params = new URLSearchParams(window.location.search);
const naveganteSeleccionadoId = params.get("usuario");

if (!naveganteSeleccionadoId) {
  alert("ID de usuario no especificado en la URL.");
}

document.addEventListener("DOMContentLoaded", () => {
  const latElem = document.getElementById("lat");
  const lonElem = document.getElementById("lon");
  const btnTraza = document.getElementById("btn-traza");

  const sirenaAudio = new Audio("img/sirena.mp3");
  sirenaAudio.loop = false;

  const iconosDisponibles = [
    "marker_na_verde.png",
    "marker_na_amarillo.png",
    "marker_na_violeta.png",
    "marker_na_azul.png",
    "marker_na_negro.png",
    "marker_na_lila.png",
    "marker_na_anaranjado.png",
    "marker_na_rojo.png",
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

  const colorSeleccionado = obtenerColorParaUsuario(naveganteSeleccionadoId);

  // =========================
  // MAPA + CAPAS
  // =========================
  const map = L.map("map", { preferCanvas: true }).setView([0, 0], 2);

  const satLayer = L.tileLayer(
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Tiles © Esri" }
  );

  const osmLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 19, attribution: "&copy; OpenStreetMap" }
  );

  // Base por defecto: satélite
  let baseActual = "sat";
  satLayer.addTo(map);

  // Si satélite falla (o queda gris), cambiamos a OSM
  function cambiarAOSM() {
    if (baseActual === "osm") return;
    try { map.removeLayer(satLayer); } catch {}
    osmLayer.addTo(map);
    baseActual = "osm";
    console.warn("⚠️ Cambié a OSM para evitar tiles grises / sin data.");
  }

  // Detectar tileerror en satélite
  satLayer.on("tileerror", () => cambiarAOSM());

  // ✅ FIX REAL: invalidar tamaño en momentos correctos
  function fixLeaflet() {
    map.invalidateSize();
  }

  // y además, cuando el mapa termina de moverse/zoomear, volver a invalidar (1 vez)
  let postMoveFixTimer = null;
  function schedulePostMoveFix() {
    if (postMoveFixTimer) clearTimeout(postMoveFixTimer);
    postMoveFixTimer = setTimeout(() => map.invalidateSize(), 60);
  }
  map.on("moveend", schedulePostMoveFix);
  map.on("zoomend", schedulePostMoveFix);

  // =========================
  // MARKERS + TRAZA
  // =========================
  const swimmerMarkers = new Map();

  let trazaActiva = false;
  let trazaUUID = null;

  let polylineTraza = null;
  let marcadorInicio = null;

  const iconoInicio = L.icon({
    iconUrl: "img/start_flag.png",
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });

  function limpiarTraza() {
    if (polylineTraza) {
      map.removeLayer(polylineTraza);
      polylineTraza = null;
    }
    if (marcadorInicio) {
      map.removeLayer(marcadorInicio);
      marcadorInicio = null;
    }
    trazaUUID = null;
  }

  function normalizarPuntos(puntos) {
    const latlngs = [];
    for (const p of puntos) {
      const lat = parseFloat(p.latitud ?? p.nadadorlat ?? p.lat);
      const lng = parseFloat(p.longitud ?? p.nadadorlng ?? p.lng);
      if (!isNaN(lat) && !isNaN(lng)) latlngs.push([lat, lng]);
    }
    return latlngs;
  }

  async function obtenerUltimoUUIDdelDia(usuarioId) {
    const fechaUruguay = new Date().toLocaleDateString("sv-SE", {
      timeZone: "America/Montevideo",
    });

    const url = `https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ultimorecorrido/${encodeURIComponent(
      usuarioId
    )}/${fechaUruguay}`;

    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ultimorecorrido ${res.status}: ${body}`);
    }

    const uuidList = await res.json();
    if (!Array.isArray(uuidList) || uuidList.length === 0) return null;
    return uuidList[0];
  }

  // ✅ CLAMP de zoom para que NO se vaya a zoom ridículo
  // - minZoomTraza: si fitBounds queda demasiado lejos, lo subimos a ese mínimo
  // - maxZoomTraza: para que no se pase de cerca en rutas cortas
  const minZoomTraza = 13;
  const maxZoomTraza = 18;

  function fitBoundsConClamp(latlngs) {
    if (!latlngs || latlngs.length === 0) return;

    const bounds = L.latLngBounds(latlngs);

    // primero: calcular el zoom “ideal”
    const targetZoom = map.getBoundsZoom(bounds, false, [30, 30]);

    // clamp
    const clampedZoom = Math.max(minZoomTraza, Math.min(maxZoomTraza, targetZoom));

    // setView al centro con zoom clamp (esto evita zoom ultra bajo)
    const center = bounds.getCenter();

    map.setView(center, clampedZoom, { animate: false });

    // invalidate size después del setView (en el timing correcto)
    fixLeaflet();
    schedulePostMoveFix();

    // si el zoom resultó muy bajo, satélite suele verse gris => cambio a OSM
    if (clampedZoom <= 12) {
      cambiarAOSM();
    }
  }

  async function cargarTrazaHistoricaPorUUID(uuid, color) {
    const url = `https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ruta/${encodeURIComponent(uuid)}`;
    const res = await fetch(url);

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ruta ${res.status}: ${body}`);
    }

    const puntos = await res.json();
    if (!Array.isArray(puntos) || puntos.length === 0) return null;

    const latlngs = normalizarPuntos(puntos);
    if (latlngs.length === 0) return null;

    if (polylineTraza) map.removeLayer(polylineTraza);

    polylineTraza = L.polyline(latlngs, {
      color,
      weight: 7,
      dashArray: "10, 10",
    }).addTo(map);

    polylineTraza.bringToFront();

    if (marcadorInicio) map.removeLayer(marcadorInicio);
    marcadorInicio = L.marker(latlngs[0], { icon: iconoInicio }).addTo(map);

    // ✅ NO fitBounds directo: usamos clamp
    // ✅ y antes invalidamos para evitar “mapa en blanco”
    fixLeaflet();
    setTimeout(() => {
      fitBoundsConClamp(latlngs);
    }, 0);

    return latlngs;
  }

  // =========================
  // BACKEND: USUARIO
  // =========================
  async function getUsuario(id) {
    try {
      const res = await fetch(
        `https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${id}`
      );
      return await res.json();
    } catch {
      return null;
    }
  }

  // =========================
  // LOOP PRINCIPAL
  // =========================
  async function tick() {
    const usuarioid = naveganteSeleccionadoId;
    if (!usuarioid) return;

    try {
      const res = await fetch(
        "https://navigationasistance-backend-1.onrender.com/nadadorposicion/listar"
      );
      const nadadores = await res.json();
      const nadador = nadadores.find((n) => n.usuarioid === usuarioid);

      if (!nadador) {
        if (swimmerMarkers.has(usuarioid)) {
          map.removeLayer(swimmerMarkers.get(usuarioid));
          swimmerMarkers.delete(usuarioid);
        }

        limpiarTraza();
        latElem.textContent = "--";
        lonElem.textContent = "--";
        fixLeaflet();
        return;
      }

      const lat = parseFloat(nadador.nadadorlat);
      const lng = parseFloat(nadador.nadadorlng);
      if (isNaN(lat) || isNaN(lng)) return;

      const position = [lat, lng];

      const usuario = await getUsuario(usuarioid);
      const nombre = usuario?.nombre
        ? `${usuario.nombre} ${usuario?.apellido || ""}`.trim()
        : `Usuario ${usuarioid}`;
      const telefono = usuario?.telefono || "Sin teléfono";

      let hora = "Sin fecha";
      try {
        const date = new Date(nadador.fechaUltimaActualizacion);
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
      } catch {}

      const estado = nadador.estado || "Navegante";

      const popupTexto = `👤 ${nombre}<br>📞 ${telefono}<br>🕒 ${hora}`;
      const tooltipTexto = `👤 ${nombre}\n🆔 ${usuarioid}\n🕒 ${hora}\n📶 Estado: ${estado}`;

      let icono;
      if (nadador.emergency === true) {
        icono = L.icon({
          iconUrl: "img/marker-emergencia-36x39.png",
          iconSize: [36, 39],
          iconAnchor: [18, 39],
          className: "icono-emergencia",
        });

        if (sirenaAudio.paused) {
          sirenaAudio.play().catch(() => {});
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
        const marker = L.marker(position, { icon: icono, usuarioid })
          .addTo(map)
          .bindPopup(popupTexto)
          .bindTooltip(tooltipTexto, { permanent: false, direction: "top" });
        swimmerMarkers.set(usuarioid, marker);

        map.setView(position, 15, { animate: false });
        fixLeaflet();
      }

      latElem.textContent = lat.toFixed(5);
      lonElem.textContent = lng.toFixed(5);

      // Seguimiento
      if (!trazaActiva) {
        map.setView(position, map.getZoom(), { animate: false });
      } else {
        // traza en vivo: solo si polyline existe
        if (polylineTraza) polylineTraza.addLatLng(position);
      }
    } catch (e) {
      console.error("Error tick:", e);
    }
  }

  // =========================
  // BOTÓN TRAZA
  // =========================
  btnTraza?.addEventListener("click", async () => {
    trazaActiva = !trazaActiva;

    // clave: invalidar ANTES de cualquier move/fit
    fixLeaflet();

    if (!trazaActiva) {
      limpiarTraza();
      fixLeaflet();
      return;
    }

    try {
      const uuid = await obtenerUltimoUUIDdelDia(naveganteSeleccionadoId);
      if (!uuid) return;

      trazaUUID = uuid;

      await cargarTrazaHistoricaPorUUID(trazaUUID, colorSeleccionado);

      // invalidar al final (una vez)
      schedulePostMoveFix();
    } catch (e) {
      console.error("No se pudo cargar traza:", e);
      // si falla satélite / zoom raro => OSM
      cambiarAOSM();
      schedulePostMoveFix();
    }
  });

  // Fixes de layout / pestaña / resize
  window.addEventListener("resize", () => {
    fixLeaflet();
    schedulePostMoveFix();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      fixLeaflet();
      schedulePostMoveFix();
    }
  });

  // Primer tick + loop
  setTimeout(() => {
    fixLeaflet();
    tick();
  }, 0);

  setInterval(tick, 5000);
});
