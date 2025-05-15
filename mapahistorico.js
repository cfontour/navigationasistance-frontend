// Versión extendida de mapahistorico.js con:
// - Exportación a CSV
// - Gráfico de ritmo con Chart.js
// - Soporte para seleccionar recorrido_id

document.addEventListener("DOMContentLoaded", () => {
  const selectUsuario = document.getElementById("select-usuario");
  const inputFecha = document.getElementById("fecha");
  const selectRecorrido = document.getElementById("select-recorrido");
  const exportBtn = document.getElementById("btn-exportar");
  const map = L.map("map").setView([0, 0], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  let routeLine = null;
  let routeMarkers = [];
  let infoControl = null;
  let datosRuta = [];
  let chartInstance = null;

  async function cargarUsuarios() {
    const res = await fetch("https://navigationasistance-backend-1.onrender.com/usuarios/listar");
    const usuarios = await res.json();
    usuarios.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = `👤 ${u.nombre}`;
      selectUsuario.appendChild(opt);
    });
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
    const canvas = document.getElementById("graficoRitmo");
    const ctx = canvas.getContext("2d");
    if (chartInstance) {
      chartInstance.destroy();
    }
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

    if (routeLine) map.removeLayer(routeLine);
    routeMarkers.forEach((m) => map.removeLayer(m));
    routeMarkers = [];
    if (infoControl) map.removeControl(infoControl);

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
    const duracionMin = Math.floor((fin - inicio) / 60000);
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
      div.innerHTML = `<strong>Resumen</strong><br>Tiempo total: ${duracionMin}m ${duracionSeg}s<br>Distancia: ${distanciaKm} km`;
      return div;
    };
    infoControl.addTo(map);
    mostrarGrafico(datosRuta);
  }

  document.getElementById("btn-cargar").addEventListener("click", () => {
    const usuarioId = selectUsuario.value;
    const fecha = inputFecha.value;
    if (!usuarioId || !fecha) return;
    cargarRecorridos(usuarioId, fecha);
  });

  selectRecorrido.addEventListener("change", () => {
    const recorridoId = selectRecorrido.value;
    if (recorridoId) cargarRutaPorRecorrido(recorridoId);
  });

  exportBtn.addEventListener("click", () => {
    if (datosRuta.length > 0) exportarCSV(datosRuta);
  });

  cargarUsuarios();
});
