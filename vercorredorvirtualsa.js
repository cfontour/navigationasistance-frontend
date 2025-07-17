let map = L.map("map").setView([-34.95, -54.95], 14);
let senialesLayer = L.layerGroup().addTo(map);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
}).addTo(map);

document.addEventListener("DOMContentLoaded", async () => {
  const selector = document.getElementById("selectRuta");

  try {
    const res = await fetch("https://navigationasistance-backend-1.onrender.com/rutasa/listar");
    const rutas = await res.json();

    rutas.sort((a, b) => new Date(b.color) - new Date(a.color));

    rutas.forEach((ruta) => {
      const opt = document.createElement("option");
      opt.value = ruta.id;
      opt.textContent = `Ruta ${ruta.id} - ${ruta.nombre} [${ruta.color}]`;
      selector.appendChild(opt);
    });
  } catch (e) {
    alert("❌ Error al cargar rutas.");
    console.error(e);
  }
});

async function cargarSeniales() {
  const rutaId = document.getElementById("selectRuta").value;

  if (!rutaId) {
    alert("❗ Debe seleccionar una ruta.");
    return;
  }

  document.getElementById("ruta-id-confirmada").textContent = `Ruta seleccionada: ${rutaId}`;
  senialesLayer.clearLayers();

  try {
    const res = await fetch(`https://navigationasistance-backend-1.onrender.com/seniales/getSenialesByRutaId/${rutaId}`);
    const seniales = await res.json();

    if (!seniales || seniales.length === 0) {
      alert("⚠️ No hay señales para esta ruta.");
      return;
    }

    // ✅ Ordenar por distancia acumulada
    seniales.sort((a, b) => a.mts - b.mts);

    // ✅ Extraer coordenadas por tipo de andarivel
    const puntosIzquierdos = seniales.map(s => [s.latl, s.lngl]);
    const puntosDerechos = seniales.map(s => [s.latr, s.lngr]);
    const puntosCentrales = seniales.map(s => [s.latc, s.lngc]);

    // ✅ Dibujar andariveles
    L.polyline(puntosIzquierdos, { color: "red", weight: 3, opacity: 0.8 }).addTo(senialesLayer);
    L.polyline(puntosDerechos, { color: "green", weight: 3, opacity: 0.8 }).addTo(senialesLayer);
    L.polyline(puntosCentrales, { color: "green", weight: 2, dashArray: "4,6" }).addTo(senialesLayer);

    // ✅ Iconos de señalización
    seniales.forEach(s => {
      let icon;
      if (s.tipo === "O") {
        icon = L.divIcon({ html: "🟩", className: "custom-icon", iconSize: [24, 24] });
      } else if (s.tipo === "I") {
        icon = L.divIcon({ html: "⚪", className: "custom-icon", iconSize: [24, 24] });
      } else if (s.tipo === "F") {
        icon = L.divIcon({ html: "🏁", className: "custom-icon", iconSize: [24, 24] });
      }
      L.marker([s.latc, s.lngc], { icon }).addTo(senialesLayer);
    });

    // ✅ Zoom automático a toda la ruta
    const bounds = puntosIzquierdos.concat(puntosDerechos);
    map.fitBounds(bounds);

  } catch (e) {
    alert("❌ Error al obtener las señales.");
    console.error(e);
  }
}
