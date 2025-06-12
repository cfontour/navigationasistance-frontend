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

    for (const ruta of rutas) {
      document.getElementById("tituloRuta").innerText = ruta.nombre;

      const resPuntos = await fetch(`https://tu-backend.com/rutaspuntos/listarporruta/${ruta.id}`);
      const puntos = await resPuntos.json();

      if (!puntos.length) continue;

      puntos.forEach((punto, i) => {
        const latlng = [punto.latitud, punto.longitud];

        // Círculo del color de la ruta
        L.circle(latlng, {
          radius: 5,
          color: ruta.color || "#3388ff",
          fillColor: ruta.color || "#3388ff",
          fillOpacity: 1
        }).addTo(map);

        // Bandera según posición
        let icon = iconoIntermedio;
        if (i === 0) icon = iconoInicio;
        else if (i === puntos.length - 1) icon = iconoFinal;

        L.marker(latlng, { icon }).addTo(map)
          .bindPopup(`Secuencia ${punto.secuencia}<br>${punto.etiqueta || ''}`);
      });

      // Ajustar vista
      const grupo = puntos.map(p => [p.latitud, p.longitud]);
      map.fitBounds(grupo);
    }

  } catch (err) {
    console.error("Error al cargar rutas:", err);
    document.getElementById("tituloRuta").innerText = "Error cargando rutas";
  }
}

cargarRutas();
