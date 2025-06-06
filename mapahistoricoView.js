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
  const canvas = document.getElementById("graficoRitmo");

  const map = L.map("map").setView([0, 0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  const rutaHistorial = [];
  let marcadorInicio = null;
  let routeLine = null;
  let routeMarkers = [];
  let infoControl = null;
  let datosRuta = [];
  let chartInstance = null;

  function updateMap(lat, lng) {
    map.setView([lat, lng], 15);
    latElem.textContent = lat.toFixed(5);
    lonElem.textContent = lng.toFixed(5);
  }

  function limpiarMapa() {
    if (routeLine) map.removeLayer(routeLine);
    routeLine = null;
    routeMarkers.forEach(m => map.removeLayer(m));
    routeMarkers = [];
    if (infoControl) map.removeControl(infoControl);
    infoControl = null;
  }

  function calcularDistancia(lat1, lon1, lat2, lon2) {
    const toRad = deg => deg * Math.PI / 180;
    const R = 6371e3;
    const φ1 = toRad(lat1), φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function mostrarGrafico(datos) {
    const ctx = canvas.getContext("2d");
    if (chartInstance) chartInstance.destroy();
    const labels = datos.map((d, i) => `Punto ${i + 1}`);
    const ritmos = datos.map(d => d.ritmo);
    chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Ritmo (min/km)",
          data: ritmos,
          borderColor: "#007bff",
          fill: false
        }]
      }
    });
  }

  function exportarCSV(datos) {
    let csv = "Secuencia,Fecha,Hora,Latitud,Longitud,Distancia Parcial (m),Ritmo (min/km)\n";
    datos.forEach(p => {
      csv += `${p.secuencia},${p.fecha},${p.hora},${p.lat},${p.lng},${p.distancia.toFixed(2)},${p.ritmo.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "ruta_nadador.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function cargarFechasDisponibles() {
    try {
      const res = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/fechas/${naveganteSeleccionadoId}`);
      const fechas = await res.json();
      selectFecha.innerHTML = '<option value="">-- Seleccionar fecha --</option>';
      fechas.forEach(fecha => {
        const option = document.createElement("option");
        option.value = fecha;
        option.textContent = fecha;
        selectFecha.appendChild(option);
      });
    } catch (error) {
      console.error("Error al cargar fechas disponibles:", error);
    }
  }

  async function cargarRecorridos(usuarioId, fecha) {
    selectRecorrido.innerHTML = '<option value="">-- Seleccionar recorrido --</option>';
    const url = `https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/recorridos/${usuarioId}/${fecha}`;
    const res = await fetch(url);
    const lista = await res.json();
    lista.forEach(id => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = `Recorrido ${id.substring(0, 8)}...`;
      selectRecorrido.appendChild(opt);
    });
  }

  async function cargarRutaPorRecorrido(recorridoId) {
    const url = `https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ruta/${recorridoId}`;
    const res = await fetch(url);
    const datos = await res.json();

    if (!Array.isArray(datos) || datos.length === 0) {
      alert("No se encontraron registros para el recorrido seleccionado.");
      return;
    }

    datos.sort((a, b) => a.secuencia - b.secuencia);
    datosRuta = [];
    limpiarMapa();

    const latlngs = datos.map(p => [parseFloat(p.nadadorlat), parseFloat(p.nadadorlng)]);
    routeLine = L.polyline(latlngs, { color: "blue" }).addTo(map);
    map.fitBounds(routeLine.getBounds());

    datos.forEach((p, i) => {
      const latlng = [parseFloat(p.nadadorlat), parseFloat(p.nadadorlng)];
      let marker;
      if (i === 0) {
        marker = L.marker(latlng, {
          icon: L.icon({ iconUrl: "img/start_flag.png", iconSize: [32, 32], iconAnchor: [16, 32] })
        }).bindPopup("🏋️ Inicio");
      } else if (i === datos.length - 1) {
        marker = L.marker(latlng, {
          icon: L.icon({ iconUrl: "img/finish_flag.png", iconSize: [32, 32], iconAnchor: [16, 32] })
        }).bindPopup("🏋️ Fin");
      } else {
        marker = L.circleMarker(latlng, { radius: 6, color: "blue", fillColor: "#3388ff", fillOpacity: 0.7 })
          .bindPopup(`Secuencia: ${p.secuencia}<br>Hora: ${new Date(p.nadadorhora).toLocaleTimeString()}`);
      }
      marker.addTo(map);
      routeMarkers.push(marker);

      if (i > 0) {
        const anterior = datos[i - 1];
        const d = calcularDistancia(parseFloat(anterior.nadadorlat), parseFloat(anterior.nadadorlng), latlng[0], latlng[1]);
        const t1 = new Date(anterior.nadadorhora), t2 = new Date(p.nadadorhora);
        const tMin = (t2 - t1) / 60000;
        const ritmo = tMin / (d / 1000);
        datosRuta.push({ secuencia: p.secuencia, fecha: p.nadadorfecha, hora: new Date(p.nadadorhora).toLocaleTimeString(), lat: latlng[0], lng: latlng[1], distancia: d, ritmo });
      } else {
        datosRuta.push({ secuencia: p.secuencia, fecha: p.nadadorfecha, hora: new Date(p.nadadorhora).toLocaleTimeString(), lat: latlng[0], lng: latlng[1], distancia: 0, ritmo: 0 });
      }
    });

    const inicio = new Date(datos[0].nadadorhora);
    const fin = new Date(datos[datos.length - 1].nadadorhora);
    const duracionHor = Math.floor((fin - inicio) / 3600000);
    const duracionMin = Math.floor((fin - inicio) % 3600000 / 60000);
    const duracionSeg = Math.floor(((fin - inicio) % 60000) / 1000);
    const distanciaTotal = datosRuta.reduce((sum, p) => sum + p.distancia, 0);
    const distanciaKm = (distanciaTotal / 1000).toFixed(2);

    infoControl = L.control({ position: "topright" });
    infoControl.onAdd = () => {
      const div = L.DomUtil.create("div", "info");
      div.style.background = "white";
      div.style.padding = "10px";
      div.style.border = "1px solid #ccc";
      div.style.borderRadius = "8px";
      div.innerHTML = `<strong>Resumen</strong><br>Tiempo total: ${duracionHor}h ${duracionMin}m ${duracionSeg}s<br>Distancia: ${distanciaKm} km`;
      return div;
    };
    infoControl.addTo(map);
    mostrarGrafico(datosRuta);
  }

  btnCargarRutas.addEventListener("click", () => {
    const fecha = selectFecha.value;
    if (!naveganteSeleccionadoId || !fecha) return;
    cargarRecorridos(naveganteSeleccionadoId, fecha);
  });

  selectRecorrido.addEventListener("change", () => {
    const recorridoId = selectRecorrido.value;
    if (recorridoId) cargarRutaPorRecorrido(recorridoId);
  });

  btnExportarCSV.addEventListener("click", () => {
    if (datosRuta.length > 0) exportarCSV(datosRuta);
  });

  cargarFechasDisponibles();
});
