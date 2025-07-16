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

    // Separar por tipo
    const origen = seniales.find(s => s.tipo === "O");
    const fin = seniales.find(s => s.tipo === "F");
    const intermedios = seniales.filter(s => s.tipo === "I");

    // Ordenar los puntos por secuencia lógica: O → intermedios → F
    const recorrido = [origen, ...intermedios, fin];

    // Dibujar andarivel izquierdo
    const puntosIzquierdos = recorrido.map(s => [s.latl, s.lngl]);
    L.polyline(puntosIzquierdos, {
      color: "red",
      weight: 3,
      opacity: 0.8
    }).addTo(senialesLayer);

    // Dibujar andarivel derecho
    const puntosDerechos = recorrido.map(s => [s.latr, s.lngr]);
    L.polyline(puntosDerechos, {
      color: "green",
      weight: 3,
      opacity: 0.8
    }).addTo(senialesLayer);

    // Ajustar el mapa al área de las señales
    const bounds = puntosIzquierdos.concat(puntosDerechos);
    map.fitBounds(bounds);

  } catch (e) {
    alert("❌ Error al obtener las señales.");
    console.error(e);
  }
}
