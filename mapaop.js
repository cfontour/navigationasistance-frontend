const map = L.map("map").setView([-34.9, -56.1], 13);

const RADIO_PUNTO_CONTROL = 20;

// ✅ Capa base STREET (OpenStreetMap) — reemplaza la satelital
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);

/*  ⛔ (antes satélite, ya no se usa)
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: '&copy; Esri',
  maxZoom: 18
}).addTo(map);
*/

// Íconos personalizados
const iconoInicio = L.icon({ iconUrl: 'img/start_flag.png', iconSize: [32, 32] });
const iconoIntermedio = L.icon({ iconUrl: 'img/white_flag.png', iconSize: [24, 24] });
const iconoFinal = L.icon({ iconUrl: 'img/finish_flag.png', iconSize: [32, 32] });

const sirenaAudio = new Audio('img/sirena.mp3');
sirenaAudio.loop = false;

let marcadores = new Map();
let puntosControl = [];
let registrosHechos = new Set();
let mostrarTraza = false;

// --- resto de tu JS SIN CAMBIOS ---
async function cargarRutas(idRuta) {
  try {
    const res = await fetch(`https://navigationasistance-backend-1.onrender.com/rutas/listarId/${idRuta}`);
    const ruta = await res.json();

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

      console.log("🧩 Punto recibido:", p);

      puntosControl.push({
        latitud: p.latitud,
        longitud: p.longitud,
        etiqueta: p.etiqueta || `Punto ${i + 1}`,
        nadadorruta_id: p.nadadorruta_id,
        rutaId: idRuta
      });

      const controlPointRadius = L.circle(latlng, {
        radius: RADIO_PUNTO_CONTROL,
        color: 'blue',
        fillColor: '#3388ff',
        fillOpacity: 0.2,
        weight: 1
      }).addTo(map);

      L.circle(latlng, {
        radius: 5,
        color: 'rgba(255, 255, 0, 0.5)',
        fillColor: 'rgba(255, 255, 0, 0.5)',
        fillOpacity: 1
      }).addTo(map);

      let icon = iconoIntermedio;
      if (i === 0) icon = iconoInicio;
      else if (i === puntos.length - 1) icon = iconoFinal;

      L.marker(latlng, { icon })
        .addTo(map)
        .bindPopup(`Etiqueta: ${p.etiqueta}<br>Lat: ${p.latitud}<br>Lng: ${p.longitud}`);
    });

    console.log("🧭 puntosControl cargados:", puntosControl);
    map.fitBounds(bounds);

  } catch (err) {
    console.error("Error al cargar rutas:", err);
  }
}

function crearIconoCompetidor() {
  return L.icon({
    iconUrl: 'img/aventurero.png',
    iconSize: [34, 50],
    iconAnchor: [16, 48],
    popupAnchor: [0, -48]
  });
}

async function cargarRutasDisponiblesEnSelector() {
  const selectorRuta = document.getElementById("select-ruta");
  while (selectorRuta.options.length > 1) selectorRuta.remove(1);

  try {
    const res = await fetch("https://navigationasistance-backend-1.onrender.com/rutas/listarSimples");
    const rutasDisponibles = await res.json();

    rutasDisponibles.forEach((ruta) => {
      if (ruta.color === "OPERATIONAL") {
        const opt = document.createElement("option");
        opt.value = ruta.id;
        opt.textContent = `Ruta ${ruta.id} - ${ruta.nombre}`;
        selectorRuta.appendChild(opt);
      }
    });
  } catch (e) {
    console.error("❌ Error al cargar rutas disponibles en el selector:", e);
    alert("❌ Error al cargar la lista de rutas disponibles.");
  }
}

async function cargarNavegantesVinculados() {
  try {
    const response = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listarActivosEnCarrera");
    const nadadores = await response.json();
    if (nadadores.length === 0) historialPuntos = new Map();

    for (let m of marcadores.values()) map.removeLayer(m);
    marcadores.clear();

    nadadores.forEach(n => {
      const lat = parseFloat(n.nadadorlat);
      const lng = parseFloat(n.nadadorlng);
      const bearing = parseFloat(n.bearing);

      if (isNaN(lat) || isNaN(lng)) return;

      let icono;
      if (n.emergency === true) {
        icono = L.icon({
          iconUrl: 'img/marker-emergencia-36x39.png',
          iconSize: [36, 39],
          iconAnchor: [18, 39],
          className: 'icono-emergencia'
        });
        if (sirenaAudio.paused) {
          sirenaAudio.play().catch(() => {});
        }
      } else {
        icono = crearIconoCompetidor();
      }

      const marcador = L.marker([lat, lng], { icon: icono })
        .addTo(map)
        .bindPopup(`🧍 Usuario: ${n.usuarioid}<br>🕓 ${n.fechaUltimaActualizacion}`);

      marcadores.set(String(n.usuarioid), marcador);
      marcador.bindPopup(generarContenidoPopup(n.usuarioid));
      actualizarPopup(n.usuarioid);

      if (n.usuarioid && puntosControl.length > 0) {
        verificarPuntosDeControl(n.usuarioid, lat, lng);
      }
    });

  } catch (error) {
    console.error("Error al cargar nadadores vinculados:", error);
  }
}

function generarContenidoPopup(usuarioid) {
  const historial = historialPuntos.get(usuarioid) || [];
  const listaHtml = historial.map(p =>
    `<li>${p.etiqueta} <small>${new Date(p.fechaHora).toLocaleTimeString()}</small></li>`
  ).join("");
  return `<strong>Usuario: ${usuarioid}</strong><br/>Puntos de control:<br/><ul>${listaHtml}</ul>`;
}

function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
            Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

let historialPuntos = new Map();

async function actualizarPopup(usuarioid) {
  try {
    const res = await fetch(`https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/listarPorNadadorrutaId/${usuarioid}`);
    const historial = await res.json();
    if (!Array.isArray(historial)) return;

    const resUsuario = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${usuarioid}`);
    const usuario = await resUsuario.json();
    const nombreCompleto = `${usuario.nombre || "Nombre"} ${usuario.apellido || "Apellido"}`;

    const listaHtml = historial.map(p => {
      const etiqueta = p.puntoControl || "❓(sin etiqueta)";
      let hora = "⏱️ (sin hora)";
      if (p.fechaHora) {
        const fecha = new Date(p.fechaHora);
        if (!isNaN(fecha)) hora = fecha.toLocaleTimeString();
      }
      return `<li>${etiqueta} <small>${hora}</small></li>`;
    }).join("");

    const popupHtml = `<strong>${nombreCompleto}</strong><br/>Puntos de control:<br/><ul>${listaHtml}</ul>`;
    const marcador = marcadores.get(String(usuarioid));
    if (marcador) marcador.bindPopup(popupHtml);

  } catch (err) {
    console.error(`❌ Error crítico al actualizar popup para ${usuarioid}:`, err);
  }
}

async function verificarPuntosDeControl(usuarioid, latActual, lngActual) {
  try {
    puntosControl.forEach(async punto => {
      const distancia = distanciaMetros(latActual, lngActual, punto.latitud, punto.longitud);
      if (distancia < RADIO_PUNTO_CONTROL) {
        const payload = {
          nadadorrutaId: usuarioid,
          puntoControl: punto.etiqueta,
          fechaHora: new Date().toISOString(),
          rutaId: punto.rutaId
        };

        const res = await fetch("https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/agregar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (res.ok) actualizarPopup(usuarioid);
      }
    });
  } catch (err) {
    console.error("❌ Falló conexión con el backend al registrar punto de control", err);
  }
}

async function cargarUsuariosEnSelector() {
  const res = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorrutas/listar");
  const relaciones = await res.json();
  const selector = document.getElementById("selector-usuario");

  for (const rel of relaciones) {
    try {
      const resUsuario = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${rel.usuarioId}`);
      const usuario = await resUsuario.json();

      const option = document.createElement("option");
      option.value = rel.usuarioId;
      option.textContent = `${rel.usuarioId} - ${usuario.nombre} ${usuario.apellido}`;
      selector.appendChild(option);
    } catch (err) {
      console.warn(`❌ No se pudo obtener info para usuario ${rel.usuarioId}:`, err);
    }
  }
}

let polylineTraza = null;

async function trazarRutaUsuario() {
  mostrarTraza = true;
  const usuarioId = document.getElementById("selector-usuario").value;

  const fechaUruguay = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Montevideo'
  });

  if (!usuarioId) { alert("❗ Debe seleccionar un usuario."); return; }

  try {
    const resUuid = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ultimorecorrido/${usuarioId}/${fechaUruguay}`);
    const uuidList = await resUuid.json();
    if (!uuidList || uuidList.length === 0) { console.error("❌ No hay recorridos registrados hoy para este usuario"); return; }
    const ultimaRuta = uuidList[0];

    const res = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ruta/${ultimaRuta}`);
    let puntos = await res.json();

    puntos.sort((a, b) => {
      const crearFechaUruguay = (fecha, hora) => {
        const tiempoHora = hora.includes('T') ? hora.split('T')[1] : hora;
        const fechaHoraString = `${fecha}T${tiempoHora}`;
        const fechaUTC = new Date(fechaHoraString + 'Z');
        return new Date(fechaUTC.getTime() - (3 * 60 * 60 * 1000));
      };
      const A = crearFechaUruguay(a.nadadorfecha, a.nadadorhora);
      const B = crearFechaUruguay(b.nadadorfecha, b.nadadorhora);
      if (A.getTime() === B.getTime()) return Number(a.secuencia) - Number(b.secuencia);
      return A.getTime() - B.getTime();
    });

    const latlngs = puntos
      .filter(p => Number.isFinite(parseFloat(p.nadadorlat)) && Number.isFinite(parseFloat(p.nadadorlng)) && Number(p.secuencia) >= 1)
      .map(p => [parseFloat(p.nadadorlat), parseFloat(p.nadadorlng)]);

    if (latlngs.length === 0) { alert("❌ La ruta no contiene puntos válidos."); return; }

    if (polylineTraza) map.removeLayer(polylineTraza);

    polylineTraza = L.polyline(latlngs, { color: 'red', weight: 5, dashArray: '10, 10' }).addTo(map);

  } catch (err) {
    console.error("❌ Error al trazar ruta:", err);
  }
}

function borrarTraza() {
  mostrarTraza = false;
  if (polylineTraza) { map.removeLayer(polylineTraza); polylineTraza = null; }
}

document.addEventListener("DOMContentLoaded", () => {
  const selectorRuta = document.getElementById("select-ruta");
  cargarRutasDisponiblesEnSelector();
  selectorRuta.addEventListener('change', (event) => {
    const idRutaSeleccionada = event.target.value;
    cargarRutas(idRutaSeleccionada);
  });
  cargarNavegantesVinculados();
  cargarUsuariosEnSelector();
  setInterval(cargarNavegantesVinculados, 5000);

  const boton = document.getElementById("boton-traza");
  if (boton) boton.addEventListener("click", trazarRutaUsuario);

  const botonBorrar = document.getElementById("boton-borrar-traza");
  if (botonBorrar) botonBorrar.addEventListener("click", borrarTraza);

  setInterval(() => {
    if (!mostrarTraza) return;
    const selector = document.getElementById("selector-usuario");
    const usuarioId = selector?.value;
    if (usuarioId && usuarioId !== "Seleccione un usuario") {
      trazarRutaUsuario();
    }
  }, 5000);
});
