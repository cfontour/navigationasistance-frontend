// Ejecutar cuando el DOM esté listo

const params = new URLSearchParams(window.location.search);
const naveganteSeleccionadoId = params.get("usuario");

if (!naveganteSeleccionadoId) {
  alert("ID de usuario no especificado en la URL.");
}

document.addEventListener("DOMContentLoaded", () => {
  const latElem = document.getElementById("lat");
  const lonElem = document.getElementById("lon");
  const selectFecha = document.getElementById("select-fecha");
  const selectRecorrido = document.getElementById("select-recorrido");
  const btnCargarRutas = document.getElementById("btn-cargar-rutas");
  const btnExportarCSV = document.getElementById("btn-exportar-csv");

  const map = L.map("map").setView([0, 0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  const rutaHistorial = [];
  let marcadorInicio = null;

  function updateMap(lat, lng) {
    map.setView([lat, lng], 15);
    latElem.textContent = lat.toFixed(5);
    lonElem.textContent = lng.toFixed(5);
  }

  function limpiarMapa() {
    rutaHistorial.forEach((m) => map.removeLayer(m));
    rutaHistorial.length = 0;
    if (marcadorInicio) {
      map.removeLayer(marcadorInicio);
      marcadorInicio = null;
    }
  }

  async function cargarFechasDisponibles() {
    try {
      const res = await fetch(
        `https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/fechas/${naveganteSeleccionadoId}`
      );
      const fechas = await res.json();
      selectFecha.innerHTML = "";
      fechas.forEach((fecha) => {
        const option = document.createElement("option");
        option.value = fecha;
        option.textContent = fecha;
        selectFecha.appendChild(option);
      });
    } catch (err) {
      console.error("Error al cargar fechas disponibles:", err);
    }
  }

  async function cargarRecorridos(fecha) {
    try {
      const res = await fetch(
        `https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/recorridos/${naveganteSeleccionadoId}/${fecha}`
      );
      const recorridos = await res.json();
      selectRecorrido.innerHTML = "";
      recorridos.forEach((uuid) => {
        const option = document.createElement("option");
        option.value = uuid;
        option.textContent = uuid;
        selectRecorrido.appendChild(option);
      });
    } catch (err) {
      console.error("Error al cargar recorridos:", err);
    }
  }

  async function mostrarRuta(uuid) {
    try {
      const res = await fetch(
        `https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ruta/${uuid}`
      );
      const puntos = await res.json();
      if (!puntos || puntos.length === 0) return;
      limpiarMapa();

      puntos.forEach((p, index) => {
        const lat = parseFloat(p.latitud);
        const lng = parseFloat(p.longitud);
        if (isNaN(lat) || isNaN(lng)) return;

        const marcador = L.circleMarker([lat, lng], {
          radius: 5,
          color: "#0074D9",
          fillColor: "#0074D9",
          fillOpacity: 0.8,
        }).addTo(map);
        rutaHistorial.push(marcador);

        if (index === 0) {
          marcadorInicio = L.marker([lat, lng], {
            icon: L.icon({
              iconUrl: "img/start_flag.png",
              iconSize: [24, 24],
              iconAnchor: [12, 24],
            }),
          }).addTo(map);
        }

        if (index === puntos.length - 1) {
          updateMap(lat, lng);
        }
      });
    } catch (err) {
      console.error("Error al mostrar ruta:", err);
    }
  }

  function exportarCSV() {
    const filas = rutaHistorial.map((m) => m.getLatLng());
    if (filas.length === 0) return;

    let csv = "latitud,longitud\n";
    filas.forEach((p) => {
      csv += `${p.lat},${p.lng}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recorrido_${naveganteSeleccionadoId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  btnCargarRutas.addEventListener("click", () => {
    const fecha = selectFecha.value;
    if (fecha) cargarRecorridos(fecha);
  });

  selectRecorrido.addEventListener("change", () => {
    const uuid = selectRecorrido.value;
    if (uuid) mostrarRuta(uuid);
  });

  btnExportarCSV.addEventListener("click", exportarCSV);

  cargarFechasDisponibles();
});
