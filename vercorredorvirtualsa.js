let map = L.map("map").setView([-34.95, -54.95], 14);
let senialesLayer = L.layerGroup().addTo(map);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
}).addTo(map);

// Al cargar la página, llenar el selector de rutas
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

    const bounds = [];

    seniales.forEach((s, index) => {
      const izq = [s.latl, s.lngl];
      const der = [s.latr, s.lngr];
      const cen = [s.latc, s.lngc];

      // Línea central punteada
      L.polyline([izq, cen, der], {
        color: "blue",
        weight: 2,
        dashArray: "4"
      }).addTo(senialesLayer);

      // Borde lateral izquierdo (rojo)
      L.polyline([izq, der], {
        color: "red",
        weight: 1
      }).addTo(senialesLayer);

      // Flecha
      const midLat = (s.latl + s.latr) / 2;
      const midLng = (s.lngl + s.lngr) / 2;
      L.marker([midLat, midLng], {
        icon: L.divIcon({
          className: "arrow-icon",
          html: "➡️",
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      }).addTo(senialesLayer);

      // Inicio
      if (s.tipo === "O") {
        L.marker(cen, {
          icon: L.divIcon({
            html: "🚩",
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        }).addTo(senialesLayer);
      }

      // Fin
      if (s.tipo === "F") {
        L.marker(cen, {
          icon: L.divIcon({
            html: "🏁",
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        }).addTo(senialesLayer);
      }

      bounds.push(cen);
    });

    map.fitBounds(bounds);
  } catch (e) {
    alert("❌ Error al obtener las señales.");
    console.error(e);
  }
}
