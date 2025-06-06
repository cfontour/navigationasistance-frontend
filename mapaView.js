// mapaView.js

// ✅ Adaptación para mapaView.html con usuario por parámetro
// ✅ Se elimina selector de navegante y se usa usuarioId fijo desde la URL
// ✅ Se mantiene el botón de traza

// Obtener parámetro de la URL
function getUsuarioDesdeURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("usuario");
}

const usuarioFijo = getUsuarioDesdeURL();
if (!usuarioFijo) {
  alert("Falta el parámetro ?usuario en la URL");
  throw new Error("Usuario no definido");
}

// Ejecutar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  const latElem = document.getElementById("lat");
  const lonElem = document.getElementById("lon");

  const sirenaAudio = new Audio('img/sirena.mp3');
  sirenaAudio.loop = false;

  const map = L.map("map").setView([0, 0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  let marcadorInicio = null;
  let trazaActiva = false;
  const rutaHistorial = [];

  const iconoInicio = L.icon({
    iconUrl: "img/start_flag.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });

  const iconoNadador = L.icon({
    iconUrl: 'img/optimist_marker_30x30.png',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  let marker = null;

  async function obtenerPosicion() {
    try {
      const res = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorposicion/listar`);
      const data = await res.json();

      const nadador = data.find(n => n.usuarioid === usuarioFijo);
      if (!nadador) return;

      const lat = parseFloat(nadador.nadadorlat);
      const lng = parseFloat(nadador.nadadorlng);
      if (isNaN(lat) || isNaN(lng)) return;

      const position = [lat, lng];

      // Actualizar marcador
      if (!marker) {
        marker = L.marker(position, { icon: iconoNadador }).addTo(map);
      } else {
        marker.setLatLng(position);
      }

      // Actualizar mapa y coordenadas
      if (!trazaActiva) map.setView(position, 15);
      latElem.textContent = lat.toFixed(5);
      lonElem.textContent = lng.toFixed(5);

      // Dibujar traza si está activa
      if (trazaActiva) {
        const punto = L.circleMarker(position, {
          radius: 5,
          color: "red",
          fillColor: "red",
          fillOpacity: 0.8
        }).addTo(map);
        rutaHistorial.push(punto);

        if (!marcadorInicio) {
          marcadorInicio = L.marker(position, { icon: iconoInicio }).addTo(map);
        }
      }
    } catch (err) {
      console.error("Error al obtener datos del nadador:", err);
    }
  }

  document.getElementById("btn-traza").addEventListener("click", () => {
    trazaActiva = !trazaActiva;
    alert(`Traza en vivo ${trazaActiva ? "activada" : "desactivada"}`);

    if (!trazaActiva) {
      rutaHistorial.forEach(p => map.removeLayer(p));
      rutaHistorial.length = 0;
      if (marcadorInicio) {
        map.removeLayer(marcadorInicio);
        marcadorInicio = null;
      }
    }
  });

  obtenerPosicion();
  setInterval(obtenerPosicion, 5000);
});
