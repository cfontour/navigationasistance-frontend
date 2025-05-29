// Ejecutar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  const selectLocation = document.getElementById("select-location");
  const selectNavegante = document.getElementById("select-navegante");
  const latElem = document.getElementById("lat");
  const lonElem = document.getElementById("lon");

  const rutaHistorial = new Map();
  let trazaActiva = false;
  let marcadorInicio = null;

  let naveganteSeleccionadoId = null;

  let map = L.map('map').setView([0, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  document.addEventListener("keydown", function (event) {
    if (event.key === "t" || event.key === "T") {
      trazaActiva = !trazaActiva;
      alert(`Traza en vivo ${trazaActiva ? "activada" : "desactivada"}`);

      if (!trazaActiva) {
        // Limpiar trazas
        rutaHistorial.forEach(puntos => puntos.forEach(p => map.removeLayer(p)));
        rutaHistorial.clear();
        if (marcadorInicio) {
          map.removeLayer(marcadorInicio);
          marcadorInicio = null;
        }
      }
    }
  });

  document.getElementById("btn-traza").addEventListener("click", () => {
    trazaActiva = !trazaActiva;
    alert(`Traza en vivo ${trazaActiva ? "activada" : "desactivada"}`);

    if (!trazaActiva) {
      rutaHistorial.forEach(puntos => puntos.forEach(p => map.removeLayer(p)));
      rutaHistorial.clear();
      if (marcadorInicio) {
        map.removeLayer(marcadorInicio);
        marcadorInicio = null;
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
    //fetch("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listar")
    //  .then(response => response.json())
    //  .then(async nadadores => {
    //    const opciones = [];
    //    for (const nadador of nadadores) {
    //      const lat = parseFloat(nadador.nadadorlat);
    //      const lng = parseFloat(nadador.nadadorlng);
    //      if (!isNaN(lat) && !isNaN(lng)) {
    //        const usuarioRes = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${nadador.usuarioid}`);
    //        const usuario = await usuarioRes.json();
    //        const nombre = usuario.nombre && usuario.apellido ? `👤 ${usuario.nombre} ${usuario.apellido}` : `👤 Navegante`;
    //        opciones.push({ value: `${lat},${lng}`, label: nombre, id: nadador.usuarioid });
    //      }
    //    }
    //    opciones.sort((a, b) => a.label.localeCompare(b.label));
    //    opciones.forEach(opt => {
    //      const option = document.createElement("option");
    //      option.value = opt.value;
    //      option.textContent = opt.label;
    //      option.dataset.id = opt.id;
    //      selectNavegante.appendChild(option);
    //    });
    //});

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
    console.log("Navegante seleccionado:", naveganteSeleccionadoId);
  });

  const api_url = new URL("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listar");
  let firstTime = true;

  async function cargarNavegantes() {

      const response = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listar");
      const nadadores = await response.json();
      const opciones = [];

      for (const nadador of nadadores) {
        const lat = parseFloat(nadador.nadadorlat);
        const lng = parseFloat(nadador.nadadorlng);
        if (!isNaN(lat) && !isNaN(lng)) {
          const usuarioRes = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${nadador.usuarioid}`);
          const usuario = await usuarioRes.json();
          const nombre = usuario.nombre && usuario.apellido ? `👤 ${usuario.nombre} ${usuario.apellido}` : `👤 Navegante`;
          opciones.push({ value: `${lat},${lng}`, label: nombre, id: nadador.usuarioid });
        }
      }

      opciones.sort((a, b) => a.label.localeCompare(b.label));
      opciones.forEach(opt => {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = opt.label;
        option.dataset.id = opt.id;

        const color = obtenerColorParaUsuario(opt.id);
        option.style.color = color;

        selectNavegante.appendChild(option);
      });

  }


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

  // Agrega esta estructura para mantener historial por usuario
  //const rutaHistorial = new Map();
  const iconoInicio = L.icon({
      iconUrl: 'img/start_flag.png', // deberías tener esta imagen en tu /img
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
        const position = [lat, lng];

        //
        // 📍 Agregar punto a la traza si está activa
              if (trazaActiva && usuarioid === naveganteSeleccionadoId) {
                console.log("Trazando para:", usuarioid);
                if (!rutaHistorial.has(usuarioid)) {
                  rutaHistorial.set(usuarioid, []);
                }
                const puntos = rutaHistorial.get(usuarioid);

                const color = obtenerColorParaUsuario(usuarioid);

                // ➕ Mostrar puntos individuales de la ruta
                const marker = L.circleMarker(position, {
                  radius: 5,
                  color: "blue",
                  fillColor: color,
                  fillOpacity: 0.8
                }).addTo(map);

                puntos.push(marker);

              }
        //

        // 🛠️ CORRECTO: Definís fechaRaw ANTES de usarla
        const fechaRaw = nadador.fechaUltimaActualizacion;

        // Obtener y formatear la hora desde fecha_ultima_actualizacion
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
            console.log("Debug usuarioid:", usuarioid, "fecha_ultima_actualizacion:", nadador.fecha_ultima_actualizacion);
            console.error("Error formateando hora:", e);
            hora = "Sin fecha";
        }
        //
        const estado = nadador.estado ? nadador.estado : "Navegante";

        // Contenido del popup
        const popupTexto = `👤 ${nombre}<br>🕒 ${hora}`;
        const tooltipTexto = `👤 ${nombre}\n🆔 ${usuarioid}\n🕒 ${hora}\n📶 Estado: ${estado}`;

        const icono = obtenerIconoParaUsuario(usuarioid);

        if (swimmerMarkers.has(usuarioid)) {
          const marker = swimmerMarkers.get(usuarioid);
          marker.setLatLng(position);
          marker.setIcon(icono);
          marker.setPopupContent(popupTexto);
          marker.setTooltipContent(tooltipTexto);
        } else {
          const marker = L.marker(position, {
            icon: icono
          }).addTo(map)
            .bindPopup(popupTexto)
            .bindTooltip(tooltipTexto, { permanent: false, direction: 'top' });
          swimmerMarkers.set(usuarioid, marker);
        }
        //
        // ⛳ Marcar inicio si aún no lo hicimos
              if (trazaActiva && usuarioid === naveganteSeleccionadoId && !marcadorInicio) {
                marcadorInicio = L.marker(position, {
                  icon: L.icon({
                    iconUrl: "img/start_flag.png",
                    iconSize: [24, 24],
                    iconAnchor: [12, 24]
                  })
                }).addTo(map);
              }

              //if (usuarioid === naveganteSeleccionadoId && !rutaHistorial.has(usuarioid)) {
              //  map.setView(position, map.getZoom());
              //}

              // Solo seguir al nadador si la traza está desactivada
              if (!trazaActiva && usuarioid === naveganteSeleccionadoId) {
                map.setView(position, map.getZoom());
              }


        //

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

  cargarNavegantes();

  setInterval(getSwimmer, 5000);
});
