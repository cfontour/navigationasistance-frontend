// Variable para controlar qué usuario tiene la traza activa
let usuarioTrazaActiva = null;
let intervaloPollling = null;

// NUEVA VARIABLE: Para almacenar la ruta seleccionada actualmente
let rutaActualSeleccionada = null;

const map = L.map("map").setView([-34.9, -56.1], 13);

// Capa de mapa callejero (OpenStreetMap estándar)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19
}).addTo(map);

// === VARIABLES PARA SISTEMA DE VIENTO ===
const WEATHER_API_KEY = "75e2bce104fa4fa180e194644251908 "; // ← CONSEGUIR KEY EN weatherapi.com
let capaViento = null;
let vientoVisible = false;
let intervalViento = null;

const COORD_REFERENCIA = {
    lat: -34.9630725,
    lng: -54.9417927
};

// Íconos personalizados
const iconoInicio = L.icon({ iconUrl: 'img/start_flag.png', iconSize: [32, 32] });
const iconoIntermedio = L.icon({ iconUrl: 'img/white_flag.png', iconSize: [24, 24] });
const iconoFinal = L.icon({ iconUrl: 'img/finish_flag.png', iconSize: [32, 32] });

const anchoCorredorInput = document.getElementById('anchoCorredor');
const anchoLabelSpan = document.getElementById('anchoLabel');

const sirenaAudio = new Audio('img/sirena.mp3');
sirenaAudio.loop = false;

let marcadores = new Map();
let puntosControl = [];
let registrosHechos = new Set();
let mostrarTraza = false;

let RADIO_PUNTO_CONTROL = parseFloat(anchoCorredorInput.value);

// Variables para AISHub
let capaEmbarcaciones = null;
let embarcacionesVisible = false;
let intervalEmbarcaciones = null;
let embarcacionesData = [];

// NUEVAS VARIABLES: Para gestión de marcadores de ruta
let marcadoresPuntosControl = [];
let circulosPuntosControl = [];

// 🎨 Paleta de colores para diferentes usuarios
const COLORES_USUARIOS = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3',
  '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43', '#10ac84', '#ee5a6f',
  '#c44569', '#40739e', '#487eb0', '#8c7ae6'
];

// 🎨 Mapa para asignar colores consistentes a usuarios
let coloresAsignados = new Map();
let contadorColores = 0;

// 🎨 Función para obtener color único por usuario
function obtenerColorUsuario(usuarioid) {
  if (!coloresAsignados.has(usuarioid)) {
    const color = COLORES_USUARIOS[contadorColores % COLORES_USUARIOS.length];
    coloresAsignados.set(usuarioid, color);
    contadorColores++;
    console.log(`🎨 Color asignado para usuario ${usuarioid}: ${color}`);
  }
  return coloresAsignados.get(usuarioid);
}

function aplicarColorIcono(usuarioid, color) {
  const className = `barco-icon-${usuarioid.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const filtros = convertirHexAFiltro(color);

  let styleSheet = document.getElementById('iconos-dinamicos-css');
  if (!styleSheet) {
    styleSheet = document.createElement('style');
    styleSheet.id = 'iconos-dinamicos-css';
    document.head.appendChild(styleSheet);
  }

  const newRule = `.${className} { filter: ${filtros} !important; }`;
  const existingRuleIndex = Array.from(styleSheet.sheet.cssRules).findIndex(
    rule => rule.selectorText === `.${className}`
  );

  if (existingRuleIndex !== -1) {
    styleSheet.sheet.deleteRule(existingRuleIndex);
  }

  styleSheet.sheet.insertRule(newRule, styleSheet.sheet.cssRules.length);
}

function convertirHexAFiltro(hex) {
  const filtrosMap = {
    '#ff6b6b': 'sepia(100%) saturate(200%) hue-rotate(0deg)',
    '#4ecdc4': 'sepia(100%) saturate(200%) hue-rotate(160deg)',
    '#45b7d1': 'sepia(100%) saturate(200%) hue-rotate(200deg)',
    '#96ceb4': 'sepia(100%) saturate(200%) hue-rotate(120deg)',
    '#feca57': 'sepia(100%) saturate(200%) hue-rotate(40deg)',
    '#ff9ff3': 'sepia(100%) saturate(200%) hue-rotate(300deg)',
    '#54a0ff': 'sepia(100%) saturate(200%) hue-rotate(220deg)',
    '#5f27cd': 'sepia(100%) saturate(200%) hue-rotate(260deg)',
    '#00d2d3': 'sepia(100%) saturate(200%) hue-rotate(180deg)',
    '#ff9f43': 'sepia(100%) saturate(200%) hue-rotate(25deg)',
    '#10ac84': 'sepia(100%) saturate(200%) hue-rotate(140deg)',
    '#ee5a6f': 'sepia(100%) saturate(200%) hue-rotate(340deg)',
    '#c44569': 'sepia(100%) saturate(200%) hue-rotate(320deg)',
    '#40739e': 'sepia(100%) saturate(200%) hue-rotate(210deg)',
    '#487eb0': 'sepia(100%) saturate(200%) hue-rotate(205deg)',
    '#8c7ae6': 'sepia(100%) saturate(200%) hue-rotate(270deg)'
  };

  return filtrosMap[hex] || 'sepia(100%) saturate(200%) hue-rotate(0deg)';
}

function actualizarLabel(labelId, value) {
    document.getElementById(labelId).innerText = value;
}

anchoCorredorInput.addEventListener('input', (event) => {
    RADIO_PUNTO_CONTROL = parseFloat(event.target.value);
    actualizarLabel('anchoLabel', event.target.value);
    console.log("Nuevo RADIO_PUNTO_CONTROL:", RADIO_PUNTO_CONTROL);
});

// FUNCIÓN PRINCIPAL: Para llenar el selector de rutas con las opciones del backend
async function cargarRutasDisponiblesEnSelector() {
  const selectorRuta = document.getElementById("select-ruta");

  // Limpiar opciones existentes (excepto la primera)
  while (selectorRuta.options.length > 1) {
    selectorRuta.remove(1);
  }

  try {
    const res = await fetch("https://navigationasistance-backend-1.onrender.com/rutas/listarSimples");
    const rutasDisponibles = await res.json();

    console.log("📋 Rutas obtenidas del backend:", rutasDisponibles);

    let rutasRegata = 0;
    rutasDisponibles.forEach((ruta) => {
      if (ruta.color === "REGATA") {
        const opt = document.createElement("option");
        opt.value = ruta.id;
        opt.textContent = `Ruta ${ruta.id} - ${ruta.nombre}`;
        selectorRuta.appendChild(opt);
        rutasRegata++;
        console.log(`✅ Ruta agregada: ${ruta.id} - ${ruta.nombre}`);
      }
    });

    // AGREGAR event listener para el cambio de ruta
    selectorRuta.addEventListener('change', onCambioRuta);

    console.log(`✅ ${rutasRegata} rutas de regata cargadas en el selector`);

    if (rutasRegata === 0) {
      console.warn("⚠️ No se encontraron rutas con color 'REGATA'");
      const optSinRutas = document.createElement("option");
      optSinRutas.textContent = "No hay rutas de regata disponibles";
      optSinRutas.disabled = true;
      selectorRuta.appendChild(optSinRutas);
    }
  } catch (e) {
    console.error("❌ Error al cargar rutas disponibles:", e);
    alert("❌ Error al cargar la lista de rutas disponibles.");
  }
}

// NUEVA FUNCIÓN: Manejar cambio de ruta
async function onCambioRuta() {
  const selectorRuta = document.getElementById("select-ruta");
  const rutaSeleccionada = selectorRuta.value;

  if (!rutaSeleccionada || rutaSeleccionada === "") {
    console.log("⚠️ No se seleccionó ninguna ruta válida");
    return;
  }

  console.log(`🗺️ Cambiando a ruta: ${rutaSeleccionada}`);

  // Limpiar puntos de control anteriores
  limpiarPuntosControlAnteriores();

  // Cargar nueva ruta
  await cargarRutas(rutaSeleccionada);

  // Actualizar variable de ruta actual
  rutaActualSeleccionada = rutaSeleccionada;

  console.log(`✅ Ruta ${rutaSeleccionada} cargada exitosamente`);
}

// NUEVA FUNCIÓN: Limpiar puntos de control anteriores del mapa
function limpiarPuntosControlAnteriores() {
  // Limpiar marcadores de puntos de control
  marcadoresPuntosControl.forEach(marcador => {
    map.removeLayer(marcador);
  });
  marcadoresPuntosControl = [];

  // Limpiar círculos de puntos de control
  circulosPuntosControl.forEach(circulo => {
    map.removeLayer(circulo);
  });
  circulosPuntosControl = [];

  // Limpiar array de puntos de control
  puntosControl = [];

  console.log("🧹 Puntos de control anteriores limpiados del mapa");
}

function crearIconoCompetidorConBearing(bearing, usuarioid) {
  let normalizedBearing = bearing % 360;
  if (normalizedBearing < 0) {
    normalizedBearing += 360;
  }

  let iconAngle = Math.round(normalizedBearing / 10) * 10;
  if (iconAngle === 360) {
    iconAngle = 0;
  }

  const paddedAngle = String(iconAngle).padStart(3, '0');
  const iconUrl = `/img/barco_bearing_icons/barco_${paddedAngle}.png`;
  const colorUsuario = obtenerColorUsuario(usuarioid);

  console.log("🔍 Nombre icono:", iconUrl);

  return L.icon({
    iconUrl: iconUrl,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -16],
    className: `barco-icon barco-icon-${usuarioid.replace(/[^a-zA-Z0-9]/g, '_')}`
  });
}

async function cargarNavegantesVinculados() {
  try {
    const response = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listarActivosEnCarrera");
    const nadadores = await response.json();
    if (nadadores.length === 0) historialPuntos = new Map();

    for (let m of marcadores.values()) {
      map.removeLayer(m);
    }
    marcadores.clear();

    console.log("🔍 Respuesta de nadadores:", nadadores);

    nadadores.forEach(n => {
      const lat = parseFloat(n.nadadorlat);
      const lng = parseFloat(n.nadadorlng);
      const bearing = parseFloat(n.bearing);

      console.log("👤 Navegante activo:", n);

      if (isNaN(lat) || isNaN(lng)) {
        console.warn(`❌ Coordenadas inválidas para usuario ${n.usuarioid}:`, n);
        return;
      }

      let icono;
      if (n.emergency === true) {
        icono = L.icon({
          iconUrl: 'img/marker-emergencia-36x39.png',
          iconSize: [36, 39],
          iconAnchor: [18, 39],
          className: 'icono-emergencia'
        });

        if (sirenaAudio.paused) {
          sirenaAudio.play().catch(e => console.warn("No se pudo reproducir la sirena:", e));
        }
      } else {
        icono = crearIconoCompetidorConBearing(bearing, n.usuarioid);
        const colorUsuario = obtenerColorUsuario(n.usuarioid);
        setTimeout(() => aplicarColorIcono(n.usuarioid, colorUsuario), 200);
      }

      const marcador = L.marker([lat, lng], {
        icon: icono
      }).addTo(map)
        .bindPopup(`🧍 Usuario: ${n.usuarioid}<br>🕓 ${n.fechaUltimaActualizacion}`);

      marcadores.set(String(n.usuarioid), marcador);
      marcador.bindPopup(generarContenidoPopup(n.usuarioid));
      actualizarPopup(n.usuarioid);

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

function generarContenidoPopup(usuarioid, datosUsuario = {}) {
  const historial = historialPuntos.get(usuarioid) || [];
  const listaHtml = historial.map(p =>
    `<li>${p.etiqueta} <small>${new Date(p.fechaHora).toLocaleTimeString()}</small></li>`
  ).join("");

  const esTrazaActiva = usuarioTrazaActiva === usuarioid;
  const textoBoton = esTrazaActiva ? "🔴 Desactivar Traza" : "🟢 Activar Traza";
  const colorBoton = esTrazaActiva ? "#e74c3c" : "#27ae60";

  const nombreCompleto = datosUsuario.nombre ?
    `${datosUsuario.nombre} ${datosUsuario.apellido || ""}` :
    `Usuario ${usuarioid}`;

  return `
    <div style="min-width: 200px;">
      <strong>📍 ${nombreCompleto}</strong><br/>
      <small>ID: ${usuarioid}</small><br/><br/>

      <div style="margin: 10px 0;">
        <button
          onclick="toggleTrazaDesdePopup('${usuarioid}')"
          style="
            background: ${colorBoton};
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            width: 100%;
            margin-bottom: 10px;
          "
        >
          ${textoBoton}
        </button>
      </div>

      <strong>🏁 Puntos de control:</strong><br/>
      <ul style="margin: 5px 0; padding-left: 20px;">
        ${listaHtml.length > 0 ? listaHtml : '<li><em>Sin puntos registrados</em></li>'}
      </ul>
    </div>
  `;
}

window.toggleTrazaDesdePopup = function(usuarioid) {
  console.log(`🎯 Toggle traza para usuario: ${usuarioid}`);

  if (usuarioTrazaActiva === usuarioid) {
    borrarTraza();
    usuarioTrazaActiva = null;
    detenerActualizacionMetricas();
    console.log("❌ Traza desactivada");
  } else {
    usuarioTrazaActiva = usuarioid;
    iniciarActualizacionMetricas(usuarioid);
    trazarRutaUsuarioEspecifico(usuarioid);
    console.log(`✅ Traza activada para usuario: ${usuarioid}`);
  }

  actualizarTodosLosPopups();
};

async function trazarRutaUsuarioEspecifico(usuarioId) {
  mostrarTraza = true;
  const hoy = new Date().toISOString().split("T")[0];

  try {
    const resUuid = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ultimorecorrido/${usuarioId}/${hoy}`);
    const uuidList = await resUuid.json();

    if (!uuidList || uuidList.length === 0) {
      console.log("❌ No hay recorridos registrados hoy para el usuario: " + usuarioId);
      return;
    }

    const ultimaRuta = uuidList[0];
    const res = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ruta/${ultimaRuta}`);
    let puntos = await res.json();

    puntos.sort((a, b) => {
        const fechaHoraA = new Date(`${a.nadadorfecha}T${a.nadadorhora.split('T')[1]}`);
        const fechaHoraB = new Date(`${b.nadadorfecha}T${b.nadadorhora.split('T')[1]}`);
        if (fechaHoraA.getTime() === fechaHoraB.getTime()) {
            return Number(a.secuencia) - Number(b.secuencia);
        }
        return fechaHoraA.getTime() - fechaHoraB.getTime();
    });

    const latlngs = puntos
      .filter(p =>
        Number.isFinite(parseFloat(p.nadadorlat)) &&
        Number.isFinite(parseFloat(p.nadadorlng)) &&
        Number(p.secuencia) >= 1
      )
      .map(p => [parseFloat(p.nadadorlat), parseFloat(p.nadadorlng)]);

    if (latlngs.length === 0) {
      console.error("❌ La ruta no contiene puntos válidos.");
      return;
    }

    if (polylineTraza) {
        map.removeLayer(polylineTraza);
    }

    const colorUsuario = obtenerColorUsuario(usuarioId);

    polylineTraza = L.polyline(latlngs, {
      color: colorUsuario,
      weight: 7,
      dashArray: '10, 10'
    }).addTo(map);

  } catch (err) {
    console.error("❌ Error al trazar ruta:", err);
  }
}

async function actualizarTodosLosPopups() {
  for (let [usuarioid, marcador] of marcadores.entries()) {
    try {
      const resUsuario = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${usuarioid}`);
      const usuario = await resUsuario.json();
      const nuevoContenido = generarContenidoPopup(usuarioid, usuario);
      marcador.bindPopup(nuevoContenido);
    } catch (err) {
      console.warn(`⚠️ Error actualizando popup para ${usuarioid}:`, err);
    }
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

let historialPuntos = new Map();

async function actualizarPopup(usuarioid) {
  try {
    console.log(`🔄 Actualizando popup para usuario: ${usuarioid}`);
    const res = await fetch(`https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/listarPorNadadorrutaId/${usuarioid}`);
    const historial = await res.json();

    if (!Array.isArray(historial)) {
      console.warn(`⚠️ El historial no es un array para ${usuarioid}:`, historial);
      return;
    }

    historialPuntos.set(usuarioid, historial.map(p => ({
      etiqueta: p.puntoControl || "❓(sin etiqueta)",
      fechaHora: p.fechaHora
    })));

    const resUsuario = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${usuarioid}`);
    const usuario = await resUsuario.json();
    const popupHtml = generarContenidoPopup(usuarioid, usuario);
    const marcador = marcadores.get(String(usuarioid));

    if (marcador) {
      marcador.bindPopup(popupHtml);
    } else {
      console.warn(`⚠️ No se encontró marcador para usuario ${usuarioid}`);
    }

  } catch (err) {
    console.error(`❌ Error crítico al actualizar popup para ${usuarioid}:`, err);
  }
}

async function verificarPuntosDeControl(usuarioid, latActual, lngActual) {
  try {
    puntosControl.forEach(async punto => {
      const distancia = distanciaMetros(latActual, lngActual, punto.latitud, punto.longitud);

      console.log(`📏 Distancia para ${usuarioid} al punto "${punto.etiqueta}": ${distancia.toFixed(2)}m`);

      if (distancia < RADIO_PUNTO_CONTROL) {
        const payload = {
          nadadorrutaId: usuarioid,
          puntoControl: punto.etiqueta,
          fechaHora: new Date().toISOString(),
          rutaId: punto.rutaId
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
          actualizarPopup(usuarioid);
        }
      }
    });
  } catch (err) {
    console.error("❌ Falló conexión con el backend al registrar punto de control", err);
  }
}

async function cargarRutas(idRuta) {
  try {
    const res = await fetch(`https://navigationasistance-backend-1.onrender.com/rutas/listarId/${idRuta}`);
    const ruta = await res.json();

    console.log(`🗺️ Cargando ruta ${idRuta}:`, ruta);

    // Remover título anterior si existe
    const tituloAnterior = document.querySelector('h2[data-titulo-ruta]');
    if (tituloAnterior) {
      tituloAnterior.remove();
    }

    // Crear nuevo título
    const titulo = document.createElement("h2");
    titulo.innerText = ruta.nombre;
    titulo.style.color = "white";
    titulo.style.fontSize = "1.5em";
    titulo.style.textShadow = "1px 1px 3px black";
    titulo.setAttribute('data-titulo-ruta', 'true');
    document.body.insertBefore(titulo, document.getElementById("map"));

    const puntos = ruta.puntos;
    if (!puntos || puntos.length === 0) {
      console.warn("⚠️ La ruta no tiene puntos definidos");
      return;
    }

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

      // Círculo de control
      const controlPointRadius = L.circle(latlng, {
        radius: RADIO_PUNTO_CONTROL,
        color: 'blue',
        fillColor: '#3388ff',
        fillOpacity: 0.2,
        weight: 1
      }).addTo(map);

      circulosPuntosControl.push(controlPointRadius);

      // Círculo pequeño en el centro
      const puntoCentral = L.circle(latlng, {
        radius: 5,
        color: 'rgba(255, 255, 0, 0.5)',
        fillColor: 'rgba(255, 255, 0, 0.5)',
        fillOpacity: 1
      }).addTo(map);

      circulosPuntosControl.push(puntoCentral);

      // Marcador con icono
      let icon = iconoIntermedio;
      if (i === 0) icon = iconoInicio;
      else if (i === puntos.length - 1) icon = iconoFinal;

      const marcador = L.marker(latlng, { icon })
        .addTo(map)
        .bindPopup(`Etiqueta: ${p.etiqueta}<br>Lat: ${p.latitud}<br>Lng: ${p.longitud}`);

      marcadoresPuntosControl.push(marcador);
    });

    console.log("🧭 puntosControl cargados:", puntosControl);
    map.fitBounds(bounds);

  } catch (err) {
    console.error("Error al cargar rutas:", err);
  }
}

let polylineTraza = null;

function borrarTraza() {
  mostrarTraza = false;
  usuarioTrazaActiva = null;

  if (polylineTraza) {
    map.removeLayer(polylineTraza);
    polylineTraza = null;
  }

  setTimeout(() => actualizarTodosLosPopups(), 100);
}

// Funciones de métricas (simplificadas para mantener el código conciso)
function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function metrosAMillasNauticas(metros) {
    return metros / 1852;
}

function calcularVelocidadNudos(distanciaMetros, tiempoSegundos) {
    if (tiempoSegundos === 0) return 0;
    const velocidadMs = distanciaMetros / tiempoSegundos;
    const velocidadNudos = velocidadMs * 1.94384;
    return velocidadNudos;
}

function actualizarMetricas(metricas) {
    if (!metricas || metricas.totalPuntos === 0) {
        mostrarSinDatos();
        return;
    }

    actualizarBearing(metricas.bearing);
    actualizarDistancia(metricas.millasNauticas);
    actualizarVelocidad(metricas.velocidadNudos);

    console.log(`📊 Métricas actualizadas: Bearing: ${metricas.bearing}°, Distancia: ${metricas.millasNauticas.toFixed(2)} mn, Velocidad: ${metricas.velocidadNudos.toFixed(1)} nudos`);
}

function actualizarBearing(bearing) {
    const bearingElement = document.getElementById('bearing-value');
    const needleElement = document.getElementById('bearing-needle');

    bearingElement.textContent = bearing.toFixed(0) + '°';
    bearingElement.classList.add('actualizado');
    setTimeout(() => bearingElement.classList.remove('actualizado'), 400);

    needleElement.style.transform = `rotate(${bearing}deg)`;
}

function actualizarDistancia(millas) {
    const distanciaElement = document.getElementById('distancia-value');
    distanciaElement.textContent = millas.toFixed(2);
    distanciaElement.classList.add('actualizado');
    setTimeout(() => distanciaElement.classList.remove('actualizado'), 400);
}

function actualizarVelocidad(nudos) {
    const velocidadElement = document.getElementByI