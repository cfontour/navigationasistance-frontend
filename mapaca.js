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
let puntosControl = []; // guardará todos los puntos
let registrosHechos = new Set(); // para evitar múltiples registros del mismo punto

async function cargarRutas() {
  try {
    const res = await fetch("https://navigationasistance-backend-1.onrender.com/rutas/listar");
    const rutas = await res.json();

    rutas.forEach(ruta => {
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

        // Guardar este punto como punto de control completo
        console.log("🧩 Punto recibido:", p);

        puntosControl.push({
          latitud: p.latitud,
          longitud: p.longitud,
          etiqueta: p.etiqueta || `Punto ${i + 1}`,
          nadadorruta_id: p.nadadorruta_id // 👈 asegurate que este campo venga en el JSON
        });

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
          .bindPopup(`Etiqueta: ${punto.etiqueta}<br>Lat: ${punto.latitud}<br>Lng: ${punto.longitud}`);
      });

      // ✅ AÑADIDO: revisar que los puntos tengan nadadorruta_id
      console.log("🧭 puntosControl cargados:", puntosControl);

      map.fitBounds(bounds);
    });

  } catch (err) {
    console.error("Error al cargar rutas:", err);
  }
}

async function cargarNavegantesVinculados() {
  try {
    const response = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listarActivosEnCarrera");
    const nadadores = await response.json();

    marcadores.forEach(m => map.removeLayer(m));
    marcadores = [];

    console.log("🔍 Respuesta de nadadores:", nadadores);

    nadadores.forEach(n => {
      const lat = parseFloat(n.nadadorlat);
      const lng = parseFloat(n.nadadorlng);

      console.log("👤 Navegante activo:", n);

      // ⚠️ Verificar coordenadas válidas
      if (isNaN(lat) || isNaN(lng)) {
        console.warn(`❌ Coordenadas inválidas para usuario ${n.usuarioid}:`, n);
        return;
      }

      // 🎯 Mostrarlo en el mapa SIEMPRE
      const marcador = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: "magenta",
        color: "black",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.9
      }).addTo(map)
        .bindPopup(`🧍 Usuario: ${n.usuarioid}<br>🕓 ${n.fechaUltimaActualizacion}`);
      marcadores.push(marcador);

      // ✅ Si tiene nadadorruta_id, verificar punto de control
      if (n.usuarioid && puntosControl.length > 0) {
        verificarPuntosDeControl(n.usuarioid, lat, lng);
      } else {
        console.warn(`⚠️ No se puede verificar puntos de control para ${n.usuarioid}. Datos faltantes.`);
      }
    });

  } catch (error) {
    console.error("Error al cargar nadadores vinculados:", error);
  }
}

function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function verificarPuntosDeControl(usuarioid, latActual, lngActual) {
  try {
    puntosControl.forEach(async punto => {
      const distancia = distanciaMetros(latActual, lngActual, punto.latitud, punto.longitud);

      if (distancia < 20) {

        const payload = {
          nadadorrutaId: usuarioid, // 👈 ahora como String plano
          puntoControl: punto.etiqueta,
          fechaHora: new Date().toISOString(),
        };

        console.log("📤 Intentando enviar:", payload);

        const res = await fetch("https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/agregar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          console.error("❌ Error al registrar punto de control:", await res.text());
        } else {
          console.log(`✅ Punto de control "${punto.etiqueta}" registrado para usuario ${usuarioid}`);
        }
      }
    });
  } catch (err) {
    console.error("❌ Falló conexión con el backend al registrar punto de control", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  cargarRutas();
  cargarNavegantesVinculados();
  setInterval(cargarNavegantesVinculados, 5000);
});
