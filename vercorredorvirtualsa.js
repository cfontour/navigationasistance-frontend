let map; // Declara la variable map a nivel global
let senialesLayer; // Declara la variable senialesLayer a nivel global

// La función getDistanciaMetros debe estar definida antes de ser usada.
function getDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000; // radio Tierra en metros
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

document.addEventListener("DOMContentLoaded", async () => {
  // Mueve la inicialización del mapa y del control aquí dentro
  // para asegurar que el DOM esté completamente cargado.
  map = L.map("map").setView([-34.95, -54.95], 14);
  senialesLayer = L.layerGroup().addTo(map);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
  }).addTo(map);

  // Crear el control personalizado para la información del corredor
  const infoControl = L.control({ position: 'topright' });

  infoControl.onAdd = function (mapInstance) { // Cambié 'map' a 'mapInstance' para evitar conflictos con la variable global 'map'
    this._div = L.DomUtil.create('div', 'info-corredor');
    this._div.innerHTML = '<h4>Info Corredor</h4>';
    this._div.style.backgroundColor = 'white';
    this._div.style.padding = '10px';
    this._div.style.borderRadius = '5px';
    this._div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
    this._div.style.lineHeight = '1.6';
    this._div.style.fontFamily = 'Arial, sans-serif';
    this._div.style.fontSize = '14px';
    return this._div;
  };
  infoControl.addTo(map);

  // Resto del código de DOMContentLoaded para cargar las rutas
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
      const infoDiv = document.querySelector('.info-corredor');
      if (infoDiv) {
        infoDiv.innerHTML = '<h4>Info Corredor</h4><p>No hay datos disponibles.</p>';
      }
      return;
    }

    seniales.sort((a, b) => a.mts - b.mts);
    const recorrido = seniales;

    const puntosIzquierdos = recorrido.map(s => [s.latl, s.lngl]);
    const puntosDerechos = recorrido.map(s => [s.latr, s.lngr]);
    const puntosCentrales = recorrido.map(s => [s.latc, s.lngc]);

    L.polyline(puntosIzquierdos, {
      color: "red",
      weight: 3,
      opacity: 0.8
    }).addTo(senialesLayer);

    L.polyline(puntosDerechos, {
      color: "green",
      weight: 3,
      opacity: 0.8
    }).addTo(senialesLayer);

    L.polyline(puntosCentrales, {
      color: "green",
      weight: 2,
      dashArray: "4,6"
    }).addTo(senialesLayer);

    recorrido.forEach(s => {
      let icon;
      if (s.tipo === "O") {
        icon = L.icon({ iconUrl: 'img/start_flag.png', iconSize: [32, 32], iconAnchor: [16, 32] });
      } else if (s.tipo === "I") {
        icon = L.divIcon({ html: "⚪", className: "custom-icon", iconSize: [24, 24] });
      } else if (s.tipo === "F") {
        icon = L.icon({ iconUrl: 'img/finish_flag.png', iconSize: [32, 32], iconAnchor: [16, 32] });
      } else if (s.tipo === "OF") {
          icon = L.icon({ iconUrl: 'img/start_flag.png', iconSize: [32, 32], iconAnchor: [16, 32] });
      }
      L.marker([s.latc, s.lngc], { icon }).addTo(senialesLayer);
    });

    const bounds = puntosIzquierdos.concat(puntosDerechos);
    map.fitBounds(bounds);

    let distanciaTotalCalculada = 0;
    if (recorrido.length > 0) {
      distanciaTotalCalculada = recorrido[recorrido.length - 1].mts;
    }

    let distanciaPuntosControlCalculada = 0;
    if (recorrido.length > 1) {
      distanciaPuntosControlCalculada = recorrido[1].mts - recorrido[0].mts;
    } else if (recorrido.length === 1 && recorrido[0].tipo === "OF") {
        distanciaPuntosControlCalculada = 0;
    }

    let anchoCorredorCalculado = 0;
    if (recorrido.length > 0) {
      const primeraSenial = recorrido[0];
      anchoCorredorCalculado = getDistanciaMetros(
        primeraSenial.latl,
        primeraSenial.lngl,
        primeraSenial.latr,
        primeraSenial.lngr
      );
    }

    const infoDiv = document.querySelector('.info-corredor');
    if (infoDiv) {
      infoDiv.innerHTML = `
        <h4>Info Corredor Virtual</h4>
        <ul>
          <li>📏 Distancia total del trayecto: <strong>${Math.round(distanciaTotalCalculada)} m</strong></li>
          <li>📍 Distancia puntos de control: <strong>${Math.round(distanciaPuntosControlCalculada)} m</strong></li>
          <li>↔️ Ancho corredor: <strong>${Math.round(anchoCorredorCalculado)} m</strong></li>
        </ul>
      `;
    }

  } catch (e) {
    alert("❌ Error al obtener las señales.");
    console.error(e);
    const infoDiv = document.querySelector('.info-corredor');
    if (infoDiv) {
      infoDiv.innerHTML = '<h4>Info Corredor</h4><p>Error al cargar datos.</p>';
    }
  }
}