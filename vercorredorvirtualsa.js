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

    seniales.forEach((s, index) => {
      // Línea central azul punteada
      L.polyline(
        [[s.latl, s.lngl], [s.latc, s.lngc], [s.latr, s.lngr]],
        { color: "blue", weight: 2, dashArray: "4" }
      ).addTo(senialesLayer);

      // Borde izquierdo rojo
      L.polyline([[s.latl, s.lngl], [s.latr, s.lngr]], {
        color: "red",
        weight: 1,
      }).addTo(senialesLayer);

      // Flecha direccional
      const latMiddle = (s.latl + s.latr) / 2;
      const lngMiddle = (s.lngl + s.lngr) / 2;
      L.marker([latMiddle, lngMiddle], {
        icon: L.divIcon({
          className: "arrow-icon",
          html: "➡️",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(senialesLayer);

      // Marcador de inicio
      if (index === 0) {
        L.marker([s.latc, s.lngc], {
          icon: L.divIcon({
            className: "custom-div-icon",
            html: '<div style="font-size: 24px;">🏁</div>',
          }),
        }).addTo(senialesLayer);
      }

      // Marcador de fin
      if (index === seniales.length - 1) {
        L.marker([s.latc, s.lngc], {
          icon: L.divIcon({
            className: "custom-div-icon",
            html: '<div style="font-size: 24px;">🚩</div>',
          }),
        }).addTo(senialesLayer);
      }
    });

    const bounds = seniales.map((s) => [s.latc, s.lngc]);
    map.fitBounds(bounds);
  } catch (e) {
    alert("❌ Error al obtener las señales.");
    console.error(e);
  }
}
