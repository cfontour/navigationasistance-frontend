const map = L.map("map").setView([-34.9, -56.1], 13);

// Capa satelital
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: '&copy; Esri',
  maxZoom: 19
}).addTo(map);

// Íconos personalizados
const iconoInicio = L.icon({ iconUrl: 'start_flag.png', iconSize: [32, 32] });
const iconoIntermedio = L.icon({ iconUrl: 'white_flag.png', iconSize: [24, 24] });
const iconoFinal = L.icon({ iconUrl: 'finish_flag.png', iconSize: [32, 32] });

async function cargarRutas() {
  try {
    const res = await fetch("https://navigationasistance-backend-1.onrender.com/rutas/listar");
    const rutas = await res.json();

    rutas.forEach(ruta => {
      // Título destacado
      const titulo = document.createElement("h2");
      titulo.innerText = ruta.nombre;
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

document.addEventListener("DOMContentLoaded", cargarRutas);
