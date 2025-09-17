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
    document.getElementById("controles-superiores").insertAdjacentElement('afterend', titulo);

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
    const velocidadElement = document.getElementById('velocidad-value');
    velocidadElement.textContent = nudos.toFixed(1);
    velocidadElement.classList.add('actualizado');
    setTimeout(() => velocidadElement.classList.remove('actualizado'), 400);
}

function actualizarUsuario(usuarioid, nombre) {
    const usuarioElement = document.getElementById('usuario-value');
    const nombreCompleto = nombre || `Usuario ${usuarioid}`;
    usuarioElement.textContent = nombreCompleto;
    usuarioElement.classList.add('actualizado');
    setTimeout(() => usuarioElement.classList.remove('actualizado'), 400);
}

function mostrarSinDatos() {
    document.querySelectorAll('.metrica').forEach(metrica => {
        metrica.classList.add('sin-datos');
    });

    document.getElementById('bearing-value').textContent = '---°';
    document.getElementById('distancia-value').textContent = '0.00';
    document.getElementById('velocidad-value').textContent = '0.0';
}

async function obtenerDatosHistoricos(usuarioId) {
    try {
        const hoy = new Date().toISOString().split("T")[0];

        const resUuid = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ultimorecorrido/${usuarioId}/${hoy}`);

        if (!resUuid.ok) {
            console.log(`❌ Error al obtener UUID: ${resUuid.status}`);
            return [];
        }

        const uuidList = await resUuid.json();

        if (!uuidList || uuidList.length === 0) {
            console.log(`❌ No hay recorridos registrados hoy para el usuario: ${usuarioId}, fecha: ${hoy}`);
            return [];
        }

        const ultimaRuta = uuidList[0];
        console.log(`✅ UUID encontrado: ${ultimaRuta}`);

        const res = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ruta/${ultimaRuta}`);

        if (!res.ok) {
            console.log(`❌ Error al obtener puntos: ${res.status}`);
            return [];
        }

        let puntos = await res.json();

        if (!puntos || puntos.length === 0) {
            console.log('❌ No se encontraron puntos para la ruta');
            return [];
        }

        puntos.sort((a, b) => {
            const fechaHoraA = new Date(`${a.nadadorfecha}T${a.nadadorhora.split('T')[1]}`);
            const fechaHoraB = new Date(`${b.nadadorfecha}T${b.nadadorhora.split('T')[1]}`);

            if (fechaHoraA.getTime() === fechaHoraB.getTime()) {
                return Number(a.secuencia) - Number(b.secuencia);
            }
            return fechaHoraA.getTime() - fechaHoraB.getTime();
        });

        const puntosValidos = puntos.filter(p =>
            Number.isFinite(parseFloat(p.nadadorlat)) &&
            Number.isFinite(parseFloat(p.nadadorlng)) &&
            Number(p.secuencia) >= 1
        );

        console.log(`✅ Obtenidos ${puntosValidos.length} puntos válidos para métricas`);
        return puntosValidos;

    } catch (error) {
        console.error('❌ Error obteniendo datos históricos:', error);
        return [];
    }
}

async function obtenerMetricasUsuario(usuarioId) {
    try {
        const datos = await obtenerDatosHistoricos(usuarioId);

        if (!datos || datos.length === 0) {
            return {
                bearing: 0,
                millasNauticas: 0,
                velocidadNudos: 0,
                ultimoPunto: null,
                totalPuntos: 0
            };
        }

        let bearingActual = 0;
        try {
            const response = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listarActivosEnCarrera");
            const nadadores = await response.json();
            const nadadorActual = nadadores.find(n => n.usuarioid == usuarioId);

            if (nadadorActual && nadadorActual.bearing !== undefined) {
                bearingActual = parseFloat(nadadorActual.bearing) || 0;
                console.log(`🧭 Bearing actual para ${usuarioId}: ${bearingActual}°`);
            }
        } catch (error) {
            console.warn('⚠️ No se pudo obtener bearing actual, usando del histórico');
            const ultimoPunto = datos[datos.length - 1];
            bearingActual = ultimoPunto.bearing || 0;
        }

        const ultimoPunto = datos[datos.length - 1];

        let distanciaTotal = 0;
        for (let i = 1; i < datos.length; i++) {
            const puntoActual = datos[i];
            const puntoAnterior = datos[i-1];

            distanciaTotal += calcularDistanciaHaversine(
                parseFloat(puntoAnterior.nadadorlat),
                parseFloat(puntoAnterior.nadadorlng),
                parseFloat(puntoActual.nadadorlat),
                parseFloat(puntoActual.nadadorlng)
            );
        }

        let velocidadNudos = 0;
        if (datos.length >= 3) {
            const puntosParaVelocidad = datos.slice(-5);
            let distanciaTotal = 0;
            let tiempoTotal = 0;

            for (let i = 1; i < puntosParaVelocidad.length; i++) {
                const punto1 = puntosParaVelocidad[i];
                const punto2 = puntosParaVelocidad[i-1];

                const distancia = calcularDistanciaHaversine(
                    parseFloat(punto2.nadadorlat),
                    parseFloat(punto2.nadadorlng),
                    parseFloat(punto1.nadadorlat),
                    parseFloat(punto1.nadadorlng)
                );

                const tiempo1 = new Date(`${punto1.nadadorfecha}T${punto1.nadadorhora.split('T')[1]}`).getTime();
                const tiempo2 = new Date(`${punto2.nadadorfecha}T${punto2.nadadorhora.split('T')[1]}`).getTime();
                const tiempoSegundos = Math.abs(tiempo1 - tiempo2) / 1000;

                distanciaTotal += distancia;
                tiempoTotal += tiempoSegundos;
            }

            if (tiempoTotal > 0) {
                velocidadNudos = calcularVelocidadNudos(distanciaTotal, tiempoTotal);
            }
        }

        return {
            bearing: bearingActual,
            millasNauticas: metrosAMillasNauticas(distanciaTotal),
            velocidadNudos: velocidadNudos,
            ultimoPunto: ultimoPunto,
            totalPuntos: datos.length,
            recorridoId: ultimoPunto.recorridoid || ultimoPunto.recorrido_id
        };

    } catch (error) {
        console.error('❌ Error calculando métricas:', error);
        return {
            bearing: 0,
            millasNauticas: 0,
            velocidadNudos: 0,
            ultimoPunto: null,
            totalPuntos: 0
        };
    }
}

function iniciarActualizacionMetricas(usuarioId) {
    if (intervaloPollling) {
        clearInterval(intervaloPollling);
    }

    fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${usuarioId}`)
        .then(res => res.json())
        .then(usuario => {
            actualizarUsuario(usuarioId, `${usuario.nombre} ${usuario.apellido}`);
        })
        .catch(() => actualizarUsuario(usuarioId, null));

    actualizarDatos(usuarioId);

    intervaloPollling = setInterval(() => {
        actualizarDatos(usuarioId);
    }, 5000);
}

async function actualizarDatos(usuarioId) {
    const panel = document.getElementById('panel-metricas');
    panel.classList.add('panel-updating');

    try {
        const metricas = await obtenerMetricasUsuario(usuarioId);
        actualizarMetricas(metricas);
    } catch (error) {
        console.error('❌ Error actualizando métricas:', error);
        mostrarSinDatos();
    } finally {
        setTimeout(() => panel.classList.remove('panel-updating'), 300);
    }
}

function detenerActualizacionMetricas() {
    if (intervaloPollling) {
        clearInterval(intervaloPollling);
        intervaloPollling = null;
    }
    mostrarSinDatos();
}

// Sistema de Viento
async function cargarViento(lat, lon) {
    try {
        const url = `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${lat},${lon}&aqi=no`;
        const res = await fetch(url);

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        const kph = data.current.wind_kph;
        const kn = kph * 0.539957;
        const deg = data.current.wind_degree;
        const dirTxt = data.current.wind_dir;
        const gustKph = data.current.gust_kph || 0;
        const gustKn = gustKph * 0.539957;

        document.getElementById("vientoDir").textContent = `${deg}° (${dirTxt})`;
        document.getElementById("vientoVel").textContent = `${kn.toFixed(1)} kt`;
        document.getElementById("vientoRafagas").textContent = `${gustKn.toFixed(1)} kt`;
        document.getElementById("vientoActualizado").textContent =
            `Actualizado: ${new Date().toLocaleTimeString()}`;

        console.log(`🌬️ Viento cargado: ${kn.toFixed(1)} kt desde ${deg}° (${dirTxt})`);

        return { velocidad: kn, direccion: deg, direccionTexto: dirTxt, rafagas: gustKn };

    } catch (error) {
        console.error('❌ Error cargando viento:', error);
        document.getElementById("vientoDir").textContent = "Error";
        document.getElementById("vientoVel").textContent = "Error";
        document.getElementById("vientoRafagas").textContent = "Error";
        document.getElementById("vientoActualizado").textContent =
            `Error: ${new Date().toLocaleTimeString()}`;

        return null;
    }
}

function iconoFlecha(deg, velocidad) {
    let color = '#2196F3';
    if (velocidad > 25) color = '#f44336';
    else if (velocidad > 15) color = '#ff9800';
    else if (velocidad > 8) color = '#4caf50';

    return L.divIcon({
        className: "wind-arrow",
        html: `<div style="transform: rotate(${deg + 180}deg); color: ${color};">⇧</div>`,
        iconSize: [50, 50],
        iconAnchor: [25, 25]
    });
}

async function agregarCapaViento(mapa, puntos) {
    try {
        document.getElementById("toggle-viento").innerHTML =
            '🌬️ <span class="loading-viento"></span> Cargando...';

        const capa = L.layerGroup();
        let puntosExitosos = 0;

        for (const {lat, lon, nombre} of puntos) {
            try {
                const url = `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${lat},${lon}&aqi=no`;
                const response = await fetch(url);

                if (!response.ok) continue;

                const d = await response.json();
                const deg = d.current.wind_degree;
                const kts = d.current.wind_kph * 0.539957;
                const dirTxt = d.current.wind_dir;

                L.marker([lat, lon], {
                    icon: iconoFlecha(deg, kts)
                })
                .bindTooltip(
                    `<strong>${nombre || 'Punto'}</strong><br>` +
                    `${kts.toFixed(1)} kt<br>` +
                    `${deg}° (${dirTxt})`,
                    {permanent: false, direction: 'top'}
                )
                .addTo(capa);

                puntosExitosos++;
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                console.warn(`⚠️ Error cargando viento para punto ${lat},${lon}:`, error);
            }
        }

        console.log(`✅ Capa de viento creada con ${puntosExitosos} puntos`);
        return capa;

    } catch (error) {
        console.error('❌ Error creando capa de viento:', error);
        return null;
    }
}

async function toggleCapaViento() {
    const btn = document.getElementById("toggle-viento");

    if (vientoVisible) {
        if (capaViento) {
            map.removeLayer(capaViento);
            capaViento = null;
        }
        vientoVisible = false;
        btn.textContent = "🌬️ Viento ON";
        btn.classList.remove('activo');
        console.log("🌬️ Capa de viento oculta");

    } else {
        btn.classList.add('activo');

        const puntosViento = [
            { lat: -34.9630725, lon: -54.9417927, nombre: "Navegante Principal" },
            { lat: -34.95, lon: -54.95, nombre: "Norte" },
            { lat: -34.97, lon: -54.93, nombre: "Sur" },
            { lat: -34.96, lon: -54.92, nombre: "Este" },
            { lat: -34.96, lon: -54.96, nombre: "Oeste" }
        ];

        capaViento = await agregarCapaViento(map, puntosViento);

        if (capaViento) {
            capaViento.addTo(map);
            vientoVisible = true;
            btn.textContent = "🌬️ Viento OFF";
            console.log("✅ Capa de viento mostrada");
        } else {
            btn.textContent = "🌬️ Error Viento";
            btn.classList.remove('activo');
        }
    }
}

function iniciarSistemaViento() {
    console.log("🌬️ Iniciando sistema de viento...");

    cargarViento(COORD_REFERENCIA.lat, COORD_REFERENCIA.lng);

    intervalViento = setInterval(() => {
        let coords = COORD_REFERENCIA;

        if (marcadores.size > 0) {
            const primerMarcador = marcadores.values().next().value;
            if (primerMarcador) {
                const latlng = primerMarcador.getLatLng();
                coords = { lat: latlng.lat, lng: latlng.lng };
            }
        }

        cargarViento(coords.lat, coords.lng);

        if (vientoVisible && capaViento) {
            console.log("🔄 Actualizando capa de viento...");
            map.removeLayer(capaViento);
            capaViento = null;
            vientoVisible = false;
            setTimeout(() => toggleCapaViento(), 1000);
        }

    }, 5 * 60 * 1000);

    console.log("✅ Sistema de viento iniciado (actualización cada 5 min)");
}

// Sistema de Embarcaciones AIS
function getTipoEmbarcacion(shipType) {
    const tipo = parseInt(shipType) || 0;

    if (tipo >= 70 && tipo <= 79) return { tipo: 'cargo', icono: '📦', clase: 'vessel-cargo' };
    if (tipo >= 80 && tipo <= 89) return { tipo: 'tanker', icono: '🛢️', clase: 'vessel-tanker' };
    if (tipo >= 60 && tipo <= 69) return { tipo: 'passenger', icono: '🛳️', clase: 'vessel-passenger' };
    if (tipo == 30) return { tipo: 'fishing', icono: '🎣', clase: 'vessel-fishing' };
    if (tipo >= 36 && tipo <= 37) return { tipo: 'pleasure', icono: '⛵', clase: 'vessel-pleasure' };

    return { tipo: 'other', icono: '🚢', clase: 'vessel-other' };
}

async function cargarEmbarcacionesAIS() {
    try {
        const bounds = map.getBounds();
        const north = bounds.getNorth().toFixed(4);
        const south = bounds.getSouth().toFixed(4);
        const east = bounds.getEast().toFixed(4);
        const west = bounds.getWest().toFixed(4);

        console.log(`🚢 Cargando embarcaciones AIS para área: ${north},${south},${east},${west}`);

        const url = `http://data.aishub.net/ws.php?username=demo&format=1&output=json&compress=0&latmin=${south}&latmax=${north}&lonmin=${west}&lonmax=${east}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data || !data[1]) {
            console.log('🚢 No hay datos de embarcaciones disponibles');
            return [];
        }

        const embarcaciones = data[1].map(vessel => ({
            mmsi: vessel.MMSI || 'N/A',
            lat: parseFloat(vessel.LATITUDE),
            lng: parseFloat(vessel.LONGITUDE),
            speed: parseFloat(vessel.SOG) || 0,
            heading: parseFloat(vessel.COG) || 0,
            name: vessel.SHIPNAME || 'Sin nombre',
            type: vessel.SHIP_ID || 0,
            destination: vessel.DESTINATION || '',
            timestamp: vessel.TIME || ''
        }));

        console.log(`✅ ${embarcaciones.length} embarcaciones cargadas desde AISHub`);
        return embarcaciones.filter(v => !isNaN(v.lat) && !isNaN(v.lng));

    } catch (error) {
        console.error('❌ Error cargando embarcaciones AIS:', error);

        return [
            {
                mmsi: 'DEMO001',
                lat: -34.9630725 + (Math.random() - 0.5) * 0.1,
                lng: -54.9417927 + (Math.random() - 0.5) * 0.1,
                speed: Math.random() * 15,
                heading: Math.random() * 360,
                name: 'Embarcación Demo 1',
                type: 70,
                destination: 'MONTEVIDEO',
                timestamp: new Date().toISOString()
            },
            {
                mmsi: 'DEMO002',
                lat: -34.9630725 + (Math.random() - 0.5) * 0.1,
                lng: -54.9417927 + (Math.random() - 0.5) * 0.1,
                speed: Math.random() * 15,
                heading: Math.random() * 360,
                name: 'Velero Demo',
                type: 37,
                destination: 'PUNTA DEL ESTE',
                timestamp: new Date().toISOString()
            }
        ];
    }
}

function crearIconoEmbarcacion(embarcacion) {
    const tipoInfo = getTipoEmbarcacion(embarcacion.type);

    return L.divIcon({
        className: `vessel-icon ${tipoInfo.clase}`,
        html: `<div style="transform: rotate(${embarcacion.heading}deg);">${tipoInfo.icono}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
}

function mostrarEmbarcacionesEnMapa(embarcaciones) {
    if (capaEmbarcaciones) {
        map.removeLayer(capaEmbarcaciones);
    }

    capaEmbarcaciones = L.layerGroup();
    embarcacionesData = embarcaciones;

    embarcaciones.forEach(vessel => {
        const icono = crearIconoEmbarcacion(vessel);
        const tipoInfo = getTipoEmbarcacion(vessel.type);

        const popup = `
            <strong>${vessel.name}</strong><br>
            <strong>MMSI:</strong> ${vessel.mmsi}<br>
            <strong>Tipo:</strong> ${tipoInfo.tipo}<br>
            <strong>Velocidad:</strong> ${vessel.speed.toFixed(1)} kt<br>
            <strong>Rumbo:</strong> ${vessel.heading.toFixed(0)}°<br>
            <strong>Destino:</strong> ${vessel.destination || 'N/A'}
        `;

        L.marker([vessel.lat, vessel.lng], { icon: icono })
            .bindPopup(popup)
            .addTo(capaEmbarcaciones);
    });

    capaEmbarcaciones.addTo(map);
    actualizarPanelEmbarcaciones(embarcaciones);
}

function actualizarPanelEmbarcaciones(embarcaciones) {
    document.getElementById('contador-embarcaciones').textContent =
        `${embarcaciones.length} embarcaciones detectadas`;

    const lista = document.getElementById('lista-embarcaciones');
    lista.innerHTML = '';

    embarcaciones.slice(0, 10).forEach(vessel => {
        const tipoInfo = getTipoEmbarcacion(vessel.type);
        const item = document.createElement('div');
        item.className = 'embarcacion-item';
        item.onclick = () => centrarEnEmbarcacion(vessel);

        item.innerHTML = `
            <div class="embarcacion-nombre">${tipoInfo.icono} ${vessel.name}</div>
            <div class="embarcacion-info">
                ${vessel.speed.toFixed(1)} kt | ${vessel.heading.toFixed(0)}°
            </div>
        `;

        lista.appendChild(item);
    });

    if (embarcaciones.length > 10) {
        const mas = document.createElement('div');
        mas.style.textAlign = 'center';
        mas.style.color = '#666';
        mas.style.fontSize = '11px';
        mas.style.marginTop = '5px';
        mas.textContent = `... y ${embarcaciones.length - 10} más`;
        lista.appendChild(mas);
    }
}

function centrarEnEmbarcacion(vessel) {
    map.setView([vessel.lat, vessel.lng], 15);

    capaEmbarcaciones.eachLayer(layer => {
        const pos = layer.getLatLng();
        if (Math.abs(pos.lat - vessel.lat) < 0.0001 && Math.abs(pos.lng - vessel.lng) < 0.0001) {
            layer.openPopup();
        }
    });
}

async function toggleCapaEmbarcaciones() {
    const btn = document.getElementById('toggle-embarcaciones');
    const panel = document.getElementById('panel-embarcaciones');

    if (embarcacionesVisible) {
        if (capaEmbarcaciones) {
            map.removeLayer(capaEmbarcaciones);
            capaEmbarcaciones = null;
        }

        if (intervalEmbarcaciones) {
            clearInterval(intervalEmbarcaciones);
            intervalEmbarcaciones = null;
        }

        embarcacionesVisible = false;
        btn.textContent = '🚢 Embarcaciones AIS ON';
        btn.classList.remove('activo');
        panel.style.display = 'none';

        console.log('🚢 Capa de embarcaciones oculta');

    } else {
        btn.classList.add('activo');
        btn.textContent = '🚢 Cargando...';
        panel.style.display = 'block';

        const embarcaciones = await cargarEmbarcacionesAIS();

        if (embarcaciones.length > 0) {
            mostrarEmbarcacionesEnMapa(embarcaciones);
            embarcacionesVisible = true;
            btn.textContent = '🚢 Embarcaciones AIS OFF';

            intervalEmbarcaciones = setInterval(async () => {
                console.log('🔄 Actualizando embarcaciones AIS...');
                const nuevasEmbarcaciones = await cargarEmbarcacionesAIS();
                if (nuevasEmbarcaciones.length > 0) {
                    mostrarEmbarcacionesEnMapa(nuevasEmbarcaciones);
                }
            }, 2 * 60 * 1000);

            console.log('✅ Capa de embarcaciones mostrada');
        } else {
            btn.textContent = '🚢 Sin Datos';
            btn.classList.remove('activo');
            panel.style.display = 'none';
        }
    }
}

// Inicialización principal
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Iniciando aplicación de regatas...");

  // Cargar selector de rutas PRIMERO
  await cargarRutasDisponiblesEnSelector();

  // Cargar navegantes
  cargarNavegantesVinculados();

  // Iniciar sistemas adicionales
  iniciarSistemaViento();

  // Intervalos de actualización
  setInterval(cargarNavegantesVinculados, 5000);

  setInterval(() => {
    if (!mostrarTraza || !usuarioTrazaActiva) return;
      trazarRutaUsuarioEspecifico(usuarioTrazaActiva);
  }, 5000);

  console.log("✅ Aplicación de regatas iniciada correctamente");
});