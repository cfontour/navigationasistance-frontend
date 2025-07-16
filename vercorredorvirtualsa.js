let map = L.map("map").setView([-34.9, -56.2], 13); // Ajustá coordenadas por defecto si querés
let senialesLayer = L.layerGroup().addTo(map);
let rutaSeleccionada = null;

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap",
}).addTo(map);

document.addEventListener("DOMContentLoaded", async () => {
  const selector = document.getElementById("selectRuta");

  try {
    const res = await fetch("https://navigationasistance-backend-1.onrender.com/rutasa/listar");
    const rutas = await res.json();

    rutas.forEach((ruta) => {
      const opt = document.createElement("option");
      opt.value = ruta.id;
      opt.textContent = `Ruta ${ruta.id} - ${ruta.nombre || ruta.color}`;
      selector.appendChild(opt);
    });
  } catch (e) {
    alert("❌ Error al cargar rutas.");
    console.error(e);
  }
});

async function cargarSeniales() {
  const rutaId = document.getElementById("color").value;

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

    seniales.forEach((s) => {
      const izquierda = L.circleMarker([s.latl, s.lngl], {
        radius: 4,
        color: "red",
      }).bindPopup("Izquierda").addTo(senialesLayer);

      const derecha = L.circleMarker([s.latr, s.lngr], {
        radius: 4,
        color: "blue",
      }).bindPopup("Derecha").addTo(senialesLayer);

      const centro = L.circleMarker([s.latc, s.lngc], {
        radius: 3,
        color: "green",
        fillColor: "green",
        fillOpacity: 0.7,
      }).bindPopup(`Centro (${s.tipo})`).addTo(senialesLayer);

      L.polyline(
        [
          [s.latl, s.lngl],
          [s.latr, s.lngr]
        ],
        { color: "gray", weight: 1 }
      ).addTo(senialesLayer);
    });

    const bounds = senialesLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds);
    }

  } catch (e) {
    alert("❌ Error al obtener las señales.");
    console.error(e);
  }
}

function finalizar() {
  senialesLayer.clearLayers();
  document.getElementById("ruta-id-confirmada").textContent = "";
  document.getElementById("color").value = "";
}
