const map = L.map("map").setView([-34.9, -56.1], 13);

// Capa satelital
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: '&copy; Esri',
  maxZoom: 19
}).addTo(map);

// Íconos personalizados
const iconoInicio = L.icon({ iconUrl: 'img/start_flag.png', iconSize: [32, 32] });
const iconoIntermedio = L.icon({ iconUrl: 'img/white_flag.png', iconSize: [24, 24] });
const iconoFinal = L.icon({ iconUrl: 'img/finish_flag.png', iconSize: [32, 32] });

let marcadores = []; // ⬅️ Para limpiar luego los círculos de competidores

async function cargarRutas() {
  try {
    const res = await fetch("https://navigationasistance-backend-1.onrender.com/rutas/listar");
    const rutas = await res.json();

    rutas.forEach(ruta => {
      // Título destacado
      const titulo = document.createElement("h2");
      titulo.innerText = ruta.nombre;
      titulo.style.color = "white";
      titulo.style.fontSize = "1.5em";
      titulo.style.textShadow = "1px 1px 3px black";
      document.body.insertBefore(titulo, document.getElementById("map"));

      const puntos = ruta.puntos;
      if (!puntos || puntos.length === 0) return;

      const bounds = [];

      puntos.forEach((p, i) => {
        const latlng = [p.latitud, p.longitud];
        bounds.push(latlng);

        // Círculo del color de la ruta
        L.circle(latlng, {
          radius: 5,
          color: ruta.color,
          fillColor: ruta.color,
          fillOpacity: 1
        }).addTo(map);

        // Ícono correspondiente
        let icon = iconoIntermedio;
        if (i === 0) icon = iconoInicio;
        else if (i === puntos.length - 1) icon = iconoFinal;

        L.marker(latlng, { icon })
          .addTo(map)
          .bindPopup(`<b>${p.etiqueta || `Punto ${i + 1}`}</b><br>Secuencia: ${p.secuencia}`);
      });

      // Ajustar vista a la ruta
      map.fitBounds(bounds);
    });

  } catch (err) {
    console.error("Error al cargar rutas:", err);
  }
}

// ➕ NUEVO: Cargar competidores en tiempo real
async function cargarNavegantesVinculados() {
  try {
    const response = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listarActivosEnCarrera");
    const nadadores = await response.json();

    // Limpiar anteriores
    marcadores.forEach(m => map.removeLayer(m));
    marcadores = [];

    console.log("🔍 Respuesta de nadadores:", nadadores); // 👈 clave para entender el error

    nadadores.forEach(n => {
      const latlng = [parseFloat(n.latitud), parseFloat(n.longitud)];
      const marcador = L.circleMarker([n.latitud, n.longitud], {
        radius: 8,
        fillColor: "deeppink",
        color: "magenta",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
      })
        .addTo(map)
        .bindPopup(`🧍 Usuario: ${n.usuarioId}<br>⏱ ${n.fechaHora}`);
      marcadores.push(marcador);
    });
  } catch (error) {
    console.error("Error al cargar nadadores vinculados:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  cargarRutas();
  cargarNavegantesVinculados();
  setInterval(cargarNavegantesVinculados, 5000); // Actualiza cada 5s
});
