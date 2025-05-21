// Ejecutar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  const selectLocation = document.getElementById("select-location");
  const selectNavegante = document.getElementById("select-navegante");
  const latElem = document.getElementById("lat");
  const lonElem = document.getElementById("lon");

  let naveganteSeleccionadoId = null;

  let map = L.map('map').setView([0, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

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

  const swimmerMarkers = new Map();

  map.on('zoomend', function () {
    const newZoom = map.getZoom();
    swimmerMarkers.forEach(marker => {
      const newIcon = createSwimmerIcon(newZoom);
      marker.setIcon(newIcon);
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

  // Cargar lista de zonas
  fetch("https://navigationasistance-backend-1.onrender.com/zonas/listar")
    .then(response => response.json())
    .then(data => {
      if (!data || data.length === 0) {
        console.warn("No se encontraron zonas en la API.");
        return;
      }

      const zonasOrdenadas = data.sort((a, b) => a.zona.localeCompare(b.zona));
      zonasOrdenadas.forEach(zona => {
        const option = document.createElement("option");
        option.value = zona.idzon;
        option.textContent = zona.zona;
        selectLocation.appendChild(option);
      });
    });

  // Cargar lista de usuarios activos (nadadores)
  fetch("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listar")
    .then(response => response.json())
    .then(async nadadores => {
      const opciones = [];
      for (const nadador of nadadores) {
        const lat = parseFloat(nadador.nadadorlat);
        const lng = parseFloat(nadador.nadadorlng);
        if (!isNaN(lat) && !isNaN(lng)) {
          const usuarioRes = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${nadador.usuarioid}`);
          const usuario = await usuarioRes.json();
          const nombre = usuario.nombre && usuario.apellido ? `👤 ${usuario.nombre} ${usuario.apellido}` : `👤 Navegante`;
          opciones.push({ value: `${lat},${lng}`, label: nombre });
        }
      }
      opciones.sort((a, b) => a.label.localeCompare(b.label));
      opciones.forEach(opt => {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = opt.label;
        option.dataset.id = opt.id;
        selectNavegante.appendChild(option);
      });
    });

  // Al cambiar la zona seleccionada, centrar el mapa
  selectLocation.addEventListener('change', function (e) {
    const zonaId = e.target.value;
    if (!zonaId) return;

    fetch(`https://navigationasistance-backend-1.onrender.com/zonas/listarZona/${zonaId}`)
      .then(res => res.json())
      .then(zona => {
        if (zona && zona.lato && zona.lngo) {
          updateMap([zona.lato, zona.lngo]);
        } else {
          console.warn("Coordenadas inválidas para la zona seleccionada.");
        }
      })
      .catch(err => {
        console.error("Error al obtener coordenadas de la zona:", err);
      });
  });

  selectNavegante.addEventListener('change', function (e) {
    const coords = e.target.value.split(",").map(parseFloat);
    map.flyTo(coords, 15);
    naveganteSeleccionadoId = e.target.options[e.target.selectedIndex].dataset.id || null;
  });

  const api_url = new URL("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listar");
  let firstTime = true;

  async function getUsuarioNombre(id) {
    try {
      const res = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${id}`);
      const usuario = await res.json();
      return usuario.nombre && usuario.apellido
            ? `${usuario.nombre} ${usuario.apellido}`
            : usuario.nombre || "Nombre no disponible";
    } catch {
      console.error("Error al obtener nombre completo:", error);
      return "Nombre no disponible";
    }
  }

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
        const position = [lat, lng];

        // Obtener y formatear la hora desde fecha_ultima_actualizacion
        let hora = "";
        try {
            const date = new Date(fechaRaw);
            if (!isNaN(date.getTime())) {
                hora = date.toLocaleTimeString('es-UY', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            } else {
                hora = "Hora inválida";
            }
        } catch (e) {
            console.error("Error formateando hora:", e);
            hora = "Sin hora";
        }
        //
        const estado = nadador.estado ? nadador.estado : "Navegante";

        // Contenido del popup
        const popupTexto = `👤 ${nombre}<br>🕒 ${hora}`;
        const tooltipTexto = `👤 ${nombre}\n🆔 ${usuarioid}\n🕒 ${hora}\n📶 Estado: ${estado}`;

        if (swimmerMarkers.has(usuarioid)) {
          const marker = swimmerMarkers.get(usuarioid);
          marker.setLatLng(position);
          marker.setIcon(createSwimmerIcon(map.getZoom()));
          marker.setPopupContent(popupTexto);
          marker.setTooltipContent(tooltipTexto);
        } else {
            const marker = L.marker(position, {
              icon: createSwimmerIcon(map.getZoom())
            }).addTo(map)
              .bindPopup(popupTexto)
              .bindTooltip(tooltipTexto, { permanent: false, direction: 'top' });
          swimmerMarkers.set(usuarioid, marker);
        }

        // 👇 ESTA ES LA LÍNEA QUE AGREGA EL SEGUIMIENTO
        if (usuarioid === naveganteSeleccionadoId) {
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

  setInterval(getSwimmer, 5000);
});
