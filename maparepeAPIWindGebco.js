// Variable para controlar qué usuario tiene la traza activa
let usuarioTrazaActiva = null;
let intervaloPollling = null;
// 🌬️ Canvas global para viento
let windCanvasEl = null;
// 🌬️ contexto 2D global
let windCtx = null;

let vientoBusy = false;

// NUEVA VARIABLE: Para almacenar la ruta seleccionada actualmente
let rutaActualSeleccionada = null;

const map = L.map("map").setView([-34.9, -56.1], 13);

// ⬇️ AÑADIR ESTO
let bathyOn = false;
let sondaActiva = false;


// === BATIMETRÍA (GEBCO + GMRT) =====================================
const gebcoLayer = L.tileLayer.wms('https://www.gebco.net/data_and_products/gebco_web_services/web_map_service/wms?', {
  layers: 'GEBCO_2024_Grid',
  format: 'image/png',
  transparent: true,
  opacity: 0.75,
  tileSize: 512,          // ← tiles más grandes = mejor detalle en retina
  detectRetina: true,
  attribution: 'Bathymetry: GEBCO'
});

// === NUEVO: GMRT WMS (más detalle costero)
const gmrtLayer = L.tileLayer.wms('https://www.gmrt.org/services/mapserver/wms_merc?', {
  layers: 'topo',
  format: 'image/png',
  transparent: true,
  opacity: 0.85,
  tileSize: 512,          // ← igual ajuste
  detectRetina: true,
  attribution: 'GMRT / LDEO'
});

// Control de capa activa y conmutación por zoom
let activeBathyLayer = null;
const GMRT_PREFER_ZOOM = 12; // a partir de este zoom usar GMRT

function switchBathymetryLayer() {
  if (!bathyOn) return;
  const z = map.getZoom();
  const target = (z >= GMRT_PREFER_ZOOM) ? gmrtLayer : gebcoLayer;
  const other  = (target === gmrtLayer) ? gebcoLayer : gmrtLayer;

  if (activeBathyLayer !== target) {
    if (map.hasLayer(other)) map.removeLayer(other);
    target.addTo(map);
    activeBathyLayer = target;
  }
}

// opcional, pero ayuda a que quede por encima del base
gebcoLayer.setZIndex(350);
gmrtLayer.setZIndex(360);

async function fetchDepthGMRT(lat, lon) {
  const url = `https://www.gmrt.org/services/PointServer?latitude=${lat}&longitude=${lon}&format=json`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('GMRT error');
  const data = await res.json();
  return data.elevation; // m (negativo = profundidad)
}

// ===== Sonda en hover: abort + cache + umbral de movimiento + idle =====
let sondaTooltip = null;

// cache por celda (lat/lon redondeados) con TTL
const depthCache = new Map(); // key -> {depth, ts}
const DEPTH_TTL_MS = 2 * 60 * 1000; // 2 min

// control de requests
let currentDepthAbort = null;

// throttling/idle
let hoverIdleTimer = null;
const HOVER_IDLE_MS = 250;     // espera a que el mouse se "asiente"
const MIN_MOVE_PX = 25;        // no consultes si no se movió suficiente

let lastQueryPoint = null;     // L.Point de la última consulta

function cacheKeyFromLatLng(latlng) {
  const qLat = Math.round(latlng.lat * 100) / 100; // ~0.01°
  const qLng = Math.round(latlng.lng * 100) / 100;
  return `${qLat},${qLng}`;
}

function getCachedDepth(latlng) {
  const key = cacheKeyFromLatLng(latlng);
  const hit = depthCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > DEPTH_TTL_MS) {
    depthCache.delete(key);
    return null;
  }
  return hit.depth;
}

function setCachedDepth(latlng, depth) {
  const key = cacheKeyFromLatLng(latlng);
  depthCache.set(key, { depth, ts: Date.now() });
}

async function fetchDepthWithAbort(lat, lng) {
  if (currentDepthAbort) currentDepthAbort.abort();
  currentDepthAbort = new AbortController();

  const url = `https://www.gmrt.org/services/PointServer?latitude=${lat}&longitude=${lng}&format=json`;
  const res = await fetch(url, { cache: 'no-store', signal: currentDepthAbort.signal });
  if (!res.ok) throw new Error('GMRT error');
  const data = await res.json();
  return data.elevation; // m (negativo = profundidad)
}

function showDepthTooltip(latlng, elev) {
  const profundidad = elev < 0 ? `${(-elev).toFixed(1)} m` : 'tierra/0 m';
  if (!sondaTooltip) {
    sondaTooltip = L.tooltip({
      permanent: false,
      direction: 'top',
      className: 'sonda-tooltip'
    }).setLatLng(latlng).setContent(profundidad).addTo(map);
  } else {
    sondaTooltip.setLatLng(latlng).setContent(profundidad);
  }
}

function handleSondaHoverRaw(e) {
  // Umbral de movimiento en px para no spamear
  const p = map.latLngToContainerPoint(e.latlng);
  if (lastQueryPoint && p.distanceTo(lastQueryPoint) < MIN_MOVE_PX) return;
  lastQueryPoint = p;

  // cache primero
  const cached = getCachedDepth(e.latlng);
  if (cached !== null && cached !== undefined) {
    showDepthTooltip(e.latlng, cached);
    return;
  }

  // consulta con abort
  fetchDepthWithAbort(e.latlng.lat, e.latlng.lng)
    .then(elev => {
      setCachedDepth(e.latlng, elev);
      showDepthTooltip(e.latlng, elev);
    })
    .catch(() => {});
}

function handleSondaHover(e) {
  if (hoverIdleTimer) clearTimeout(hoverIdleTimer);
  hoverIdleTimer = setTimeout(() => handleSondaHoverRaw(e), HOVER_IDLE_MS);
}

function enableHoverProbe() {
  map.on('mousemove', handleSondaHover);
}

function disableHoverProbe() {
  map.off('mousemove', handleSondaHover);
  if (hoverIdleTimer) {
    clearTimeout(hoverIdleTimer);
    hoverIdleTimer = null;
  }
  if (currentDepthAbort) {
    currentDepthAbort.abort();
    currentDepthAbort = null;
  }
  lastQueryPoint = null;
  if (sondaTooltip) {
    map.removeLayer(sondaTooltip);
    sondaTooltip = null;
  }
}

function toggleCapaBatimetria() {
  bathyOn = !bathyOn;
  const btn = document.getElementById('toggle-batimetria');

  if (bathyOn) {
    // elegir capa según zoom y escuchar cambios de zoom
    switchBathymetryLayer();
    map.on('zoomend', switchBathymetryLayer);

    btn.textContent = '🌊 Batimetría ON';
    btn.classList.add('activo');

    if (!sondaActiva) {
      enableHoverProbe();
      sondaActiva = true;
    }

  } else {
    // apagar capas
    if (map.hasLayer(gebcoLayer)) map.removeLayer(gebcoLayer);
    if (map.hasLayer(gmrtLayer))  map.removeLayer(gmrtLayer);
    activeBathyLayer = null;

    map.off('zoomend', switchBathymetryLayer);

    btn.textContent = '🌊 Batimetría';
    btn.classList.remove('activo');

    if (sondaActiva) {
      disableHoverProbe();
      sondaActiva = false;
    }
  }
}

// =====================================================================

// Capa de mapa callejero (OpenStreetMap estándar)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19
}).addTo(map);

// === VARIABLES PARA SISTEMA DE VIENTO ===
const WEATHER_API_KEY = "75e2bce104fa4fa180e194644251908"; // ← CONSEGUIR KEY EN weatherapi.com
let capaViento = null;
let vientoVisible = false;
let intervalViento = null;

// 🌬️ Variables para sistema de partículas
let windParticles = [];
let windAnimationFrame = null;
let windData = { speed: 0, direction: 0 };
const PARTICLE_COUNT = 3000;
const PARTICLE_LIFE = 120;

// 🌬️ Clase Partícula (con cola visible)
class WindParticle {
  constructor(canvas) {
    this.reset(canvas);
    this.age = Math.random() * PARTICLE_LIFE;
  }
  reset(canvas) {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.px = this.x; // posición previa (para trazo)
    this.py = this.y;
    this.age = 0;
    this.speed = 0.7 + Math.random() * 1.6; // un poco más rápidas
  }
  update(canvas, windSpeed, windDir) {
    const rad = (windDir - 180) * Math.PI / 180;
    const visualSpeed = (windSpeed / 8) * this.speed; // ↑ escala más visible
    this.px = this.x;
    this.py = this.y;
    this.x += Math.sin(rad) * visualSpeed;
    this.y += Math.cos(rad) * visualSpeed;
    this.age++;
    if (
      this.x < -10 || this.x > canvas.width + 10 ||
      this.y < -10 || this.y > canvas.height + 10 ||
      this.age > PARTICLE_LIFE
    ) {
      this.reset(canvas);
    }
  }
  draw(ctx) {
    // cola de 6–12 px aprox según “edad”
    const t = Math.max(0.2, 1 - this.age / PARTICLE_LIFE);
    const lw = 1.2 + 1.3 * t;      // grosor 1.2–2.5
    const alpha = 0.65 + 0.25 * t; // alfa 0.65–0.9
    ctx.lineWidth = lw;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(this.px, this.py);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
  }
}

// 🌬️ Inicializar partículas
function initWindParticles() {
  const canvas = windCanvasEl || document.getElementById('wind-canvas');
  if (!canvas) { console.error('❌ Canvas no encontrado'); return false; }

  // asegurar que windCtx exista y esté escalado (por si entrás directo desde el botón)
  if (!windCtx) {
    const size = map.getSize();
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.max(1, Math.floor(size.x * dpr));
    canvas.height = Math.max(1, Math.floor(size.y * dpr));
    canvas.style.width  = size.x + 'px';
    canvas.style.height = size.y + 'px';
    windCtx = canvas.getContext('2d');
    windCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  windParticles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) windParticles.push(new WindParticle(canvas));
  return true;
}

function animateWindParticles() {
  const canvas = windCanvasEl || document.getElementById('wind-canvas');
  if (!canvas) return;
  const ctx = windCtx || canvas.getContext('2d');

  // limpiar
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // estilo de trazo visible
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#ffffff'; // ← blanco (se ve en el mar)

  // dibujar
  for (const p of windParticles) {
    p.update(canvas, windData.speed, windData.direction);
    p.draw(ctx);
  }

  // restaurar alpha por las dudas
  ctx.globalAlpha = 1;

  windAnimationFrame = requestAnimationFrame(animateWindParticles);
}


// 🌬️ Detener animación
function stopWindAnimation() {
  if (windAnimationFrame) {
    cancelAnimationFrame(windAnimationFrame);
    windAnimationFrame = null;
  }
  const canvas = windCanvasEl || document.getElementById('wind-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// === VARIABLE PARA MARINETRAFFIC ===
const MARINETRAFFIC_API_KEY = "a2bce129655604707493126125e973ca8ced2993"; // ← CONSEGUIR KEY EN marinetraffic.com

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

// Variables para MarineTraffic (anteriormente AISHub)
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

  // 🔹 Obtener fecha actual en zona horaria de Uruguay
  const fechaUruguay = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Montevideo'
  });

  try {
    const resUuid = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ultimorecorrido/${usuarioId}/${fechaUruguay}`);
    const uuidList = await resUuid.json();

    if (!uuidList || uuidList.length === 0) {
      console.log("❌ No hay recorridos registrados hoy para el usuario: " + usuarioId);
      return;
    }

    const ultimaRuta = uuidList[0];
    const res = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ruta/${ultimaRuta}`);
    let puntos = await res.json();

    // 🔹 Ordenar con zona horaria de Uruguay
    puntos.sort((a, b) => {
        // Función auxiliar para crear fecha en zona horaria de Uruguay
        const crearFechaUruguay = (fecha, hora) => {
            // Extraer solo la parte de tiempo de la hora (sin fecha)
            const tiempoHora = hora.includes('T') ? hora.split('T')[1] : hora;
            const fechaHoraString = `${fecha}T${tiempoHora}`;

            // Crear fecha y ajustar a Uruguay (UTC-3)
            const fechaUTC = new Date(fechaHoraString + 'Z'); // Asume UTC
            return new Date(fechaUTC.getTime() - (3 * 60 * 60 * 1000)); // Resta 3 horas para UTC-3
        };

        const fechaHoraA = crearFechaUruguay(a.nadadorfecha, a.nadadorhora);
        const fechaHoraB = crearFechaUruguay(b.nadadorfecha, b.nadadorhora);

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

// Funciones de métricas
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
        const fechaUruguay = new Date().toLocaleDateString('sv-SE', {
            timeZone: 'America/Montevideo'
        });

        const resUuid = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ultimorecorrido/${usuarioId}/${fechaUruguay}`);

        if (!resUuid.ok) {
            console.log(`❌ Error al obtener UUID: ${resUuid.status}`);
            return [];
        }

        const uuidList = await resUuid.json();

        if (!uuidList || uuidList.length === 0) {
            console.log(`❌ No hay recorridos registrados hoy para el usuario: ${usuarioId}, fecha: ${fechaUruguay}`);
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

// ==================== SISTEMA DE VIENTO CON RÁFAGAS (SOLO LÍNEAS) ====================

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

        // 🌬️ Actualizar datos de viento para las partículas
        windData.speed = kn;
        windData.direction = deg;

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
        return null;
    }
}

// 🌬️ FUNCIÓN CORREGIDA: Crear SVG de ráfaga SOLO CON LÍNEAS (sin flechas)
function crearSvgRafagaSoloLineas(velocidad, direccion, rafagaVel) {
    // Determinar intensidad basada en velocidad del viento
    const intensidad = Math.min(velocidad / 30, 1); // Normalizar a 0-1 (30kt = intensidad máxima)
    const intensidadRafaga = Math.min(rafagaVel / 40, 1); // Ráfagas normalizadas

    // Calcular propiedades visuales basadas en intensidad
    const numLineas = Math.floor(8 + intensidad * 25); // 8-33 líneas
    const largoBase = 30 + intensidad * 80; // 30-110px de largo
    const grosorBase = 0.8 + intensidad * 2.5; // 0.8-3.3px de grosor
    const opacidadBase = 0.2 + intensidad * 0.4; // 0.2-0.6 de opacidad

    // Color más oscuro con mayor intensidad (tonos azules)
    const colorHue = 210; // Azul
    const colorSat = 60 + intensidad * 40; // 60-100% saturación
    const colorLight = 50 - intensidad * 25; // 50-25% brillo (más oscuro con más intensidad)
    const color = `hsl(${colorHue}, ${colorSat}%, ${colorLight}%)`;

    let svg = `<svg width="150" height="150" style="overflow: visible;">`;

    // Generar líneas de ráfaga
    for (let i = 0; i < numLineas; i++) {
        const variacion = (Math.random() - 0.5) * 0.4; // Variación en longitud
        const largo = largoBase * (1 + variacion);
        const grosor = grosorBase * (0.7 + Math.random() * 0.6); // Variación en grosor
        const opacidad = opacidadBase * (0.6 + Math.random() * 0.8); // Variación en opacidad

        // Espaciado irregular para mayor realismo
        const espaciado = 3.5 + Math.random() * 4;
        const offsetY = i * espaciado - (numLineas * espaciado / 2);
        const offsetX = (Math.random() - 0.5) * 20; // Desplazamiento horizontal aleatorio

        // Algunas líneas más largas y gruesas para representar ráfagas
        const esRafaga = Math.random() < intensidadRafaga * 0.4;
        const multiplicadorRafaga = esRafaga ? 1.4 + Math.random() * 0.6 : 1;
        const largoFinal = largo * multiplicadorRafaga;
        const grosorFinal = esRafaga ? grosor * 1.5 : grosor;
        const opacidadFinal = Math.min(esRafaga ? opacidad * 1.3 : opacidad, 0.75);

        svg += `<line
            x1="${75 + offsetX}"
            y1="${75 + offsetY}"
            x2="${75 + offsetX + largoFinal}"
            y2="${75 + offsetY}"
            stroke="${color}"
            stroke-width="${grosorFinal}"
            opacity="${opacidadFinal}"
            stroke-linecap="round"
        />`;
    }

    svg += `</svg>`;

    return svg;
}

// 🌬️ FUNCIÓN CORREGIDA: Crear icono de viento SOLO CON RÁFAGAS (sin flecha)
function iconoVientoSoloRafagas(deg, velocidad, rafagas) {
    const rafagaVel = rafagas || velocidad;
    const svgRafaga = crearSvgRafagaSoloLineas(velocidad, deg, rafagaVel);

    return L.divIcon({
        className: "wind-rafagas-only",
        html: `
            <div style="
                transform: rotate(${deg + 180}deg);
                width: 150px;
                height: 150px;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                ${svgRafaga}
            </div>
        `,
        iconSize: [150, 150],
        iconAnchor: [75, 75]
    });
}

async function agregarCapaViento(mapa, puntos) {
    try {
        document.getElementById("toggle-viento").innerHTML =
            '🌬️ <span class="loading-viento"></span> Cargando...';

        const capa = L.layerGroup();
        let puntosExitosos = 0;

        // 🌬️ NUEVO: Obtener datos de viento de UN solo punto
        const puntoReferencia = puntos[0]; // Usar el primer punto como referencia
        const url = `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${puntoReferencia.lat},${puntoReferencia.lon}&aqi=no`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const d = await response.json();
        const deg = d.current.wind_degree;
        const kts = d.current.wind_kph * 0.539957;
        const dirTxt = d.current.wind_dir;
        const gustKph = d.current.gust_kph || 0;
        const gustKts = gustKph * 0.539957;

        // 🌬️ NUEVO: Crear una cuadrícula de puntos en toda la pantalla visible
        const bounds = mapa.getBounds();
        const norte = bounds.getNorth();
        const sur = bounds.getSouth();
        const este = bounds.getEast();
        const oeste = bounds.getWest();

        // Calcular cuántos puntos necesitamos (uno cada ~2km aprox)
        const latStep = (norte - sur) / 8; // 8 filas
        const lngStep = (este - oeste) / 12; // 12 columnas

        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 12; j++) {
                const lat = sur + (latStep * i) + (latStep * Math.random() * 0.3); // Algo de aleatoriedad
                const lng = oeste + (lngStep * j) + (lngStep * Math.random() * 0.3);

                L.marker([lat, lng], {
                    icon: iconoVientoSoloRafagas(deg, kts, gustKts)
                })
                .addTo(capa);

                puntosExitosos++;
            }
        }

        console.log(`✅ Capa de viento creada con ${puntosExitosos} puntos en toda la pantalla`);
        return capa;

    } catch (error) {
        console.error('❌ Error creando capa de viento:', error);
        return null;
    }
}

async function toggleCapaViento() {
  const btn = document.getElementById("toggle-viento");
  if (vientoBusy) return;          // ← evita reentradas
  vientoBusy = true;

  try {
    if (vientoVisible) {
      // apagar
      stopWindAnimation();
      vientoVisible = false;
      btn.classList.remove('activo');
      btn.disabled = false;
      btn.textContent = "🌬️ Viento ON";
      return;
    }

    // prender
    btn.classList.add('activo');
    btn.disabled = true;
    btn.textContent = "🌬️ Cargando...";

    const coords = marcadores.size > 0
      ? marcadores.values().next().value.getLatLng()
      : COORD_REFERENCIA;

    const datosViento = await cargarViento(coords.lat, coords.lng);
    if (!datosViento) {
      btn.classList.remove('activo');
      btn.disabled = false;
      btn.textContent = "🌬️ Error Viento";
      return;
    }

    const ok = initWindParticles();
    if (!ok) {
      btn.classList.remove('activo');
      btn.disabled = false;
      btn.textContent = "🌬️ Error Canvas";
      return;
    }

    animateWindParticles();
    vientoVisible = true;
    btn.disabled = false;
    btn.textContent = "🌬️ Viento OFF";
  } finally {
    vientoBusy = false;            // ← se libere o falle, el botón no queda “colgado”
  }
}

function iniciarSistemaViento() {
    console.log("🌬️ Iniciando sistema de viento con partículas estilo Windy...");

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

    }, 5 * 60 * 1000);

    console.log("✅ Sistema de viento iniciado (partículas animadas, actualización cada 5 min)");
}

// ==================== SISTEMA DE EMBARCACIONES MARINETRAFFIC ====================

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
        const north = bounds.getNorth().toFixed(6);
        const south = bounds.getSouth().toFixed(6);
        const east = bounds.getEast().toFixed(6);
        const west = bounds.getWest().toFixed(6);

        console.log(`🚢 Cargando embarcaciones MarineTraffic para área: ${north},${south},${east},${west}`);

        const url = `https://services.marinetraffic.com/api/exportvessels-custom-area/${MARINETRAFFIC_API_KEY}?v=2&timespan=1440&protocol=jsono&limit=2000`;

        console.log(`🔗 URL de solicitud: ${url}`);

        const response = await fetch(url);

        if (!response.ok) {
            console.error(`❌ HTTP Error ${response.status}: ${response.statusText}`);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`📥 Respuesta de MarineTraffic:`, data);

        let vessels = [];

        if (data && Array.isArray(data)) {
            vessels = data;
        } else if (data && data.DATA && Array.isArray(data.DATA)) {
            vessels = data.DATA;
        } else if (data && data.data && Array.isArray(data.data)) {
            vessels = data.data;
        } else {
            console.log('🚢 Estructura de respuesta no reconocida o sin datos:', data);
            return [];
        }

        if (vessels.length === 0) {
            console.log('🚢 No hay embarcaciones en el área especificada');
            return [];
        }

        const embarcaciones = vessels.map(vessel => {
            const mmsi = vessel.MMSI || vessel.mmsi || 'N/A';
            const lat = parseFloat(vessel.LAT || vessel.lat || vessel.latitude || 0);
            const lng = parseFloat(vessel.LON || vessel.lng || vessel.longitude || 0);

            let speed = parseFloat(vessel.SPEED || vessel.speed || 0);
            if (speed > 100) {
                speed = speed / 10;
            }

            const heading = parseFloat(vessel.HEADING || vessel.heading || 0);
            const course = parseFloat(vessel.COURSE || vessel.course || heading);

            return {
                mmsi: mmsi,
                lat: lat,
                lng: lng,
                speed: speed,
                heading: heading,
                course: course,
                name: vessel.SHIPNAME || vessel.shipname || vessel.name || 'Sin nombre',
                type: vessel.SHIPTYPE || vessel.shiptype || vessel.type || 0,
                destination: vessel.DESTINATION || vessel.destination || '',
                timestamp: vessel.TIMESTAMP || vessel.timestamp || new Date().toISOString(),
                imo: vessel.IMO || vessel.imo || '',
                callsign: vessel.CALLSIGN || vessel.callsign || '',
                flag: vessel.FLAG || vessel.flag || '',
                length: vessel.LENGTH || vessel.length || 0,
                width: vessel.WIDTH || vessel.width || 0,
                shipClass: vessel.SHIP_CLASS || vessel.ship_class || '',
                typeName: vessel.TYPE_NAME || vessel.type_name || '',
                lastPort: vessel.LAST_PORT || vessel.last_port || '',
                eta: vessel.ETA || vessel.eta || '',
                status: vessel.STATUS || vessel.status || 0
            };
        });

        const embarcacionesValidas = embarcaciones.filter(v =>
            !isNaN(v.lat) && !isNaN(v.lng) &&
            v.lat !== 0 && v.lng !== 0 &&
            Math.abs(v.lat) <= 90 && Math.abs(v.lng) <= 180
        );

        console.log(`✅ ${embarcacionesValidas.length} embarcaciones válidas cargadas desde MarineTraffic`);
        return embarcacionesValidas;

    } catch (error) {
        console.error('❌ Error cargando embarcaciones MarineTraffic:', error);

        if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
            console.error('⚠️ Error de CORS detectado. MarineTraffic puede requerir configuración de proxy.');
        }

        return [
            {
                mmsi: 'DEMO001',
                lat: -34.9630725 + (Math.random() - 0.5) * 0.02,
                lng: -54.9417927 + (Math.random() - 0.5) * 0.02,
                speed: Math.random() * 15,
                heading: Math.random() * 360,
                course: Math.random() * 360,
                name: 'Embarcación Demo 1',
                type: 70,
                destination: 'MONTEVIDEO',
                timestamp: new Date().toISOString(),
                imo: '1234567',
                callsign: 'DEMO1',
                flag: 'UY',
                length: 200,
                width: 30,
                typeName: 'Bulk Carrier'
            },
            {
                mmsi: 'DEMO002',
                lat: -34.9630725 + (Math.random() - 0.5) * 0.02,
                lng: -54.9417927 + (Math.random() - 0.5) * 0.02,
                speed: Math.random() * 15,
                heading: Math.random() * 360,
                course: Math.random() * 360,
                name: 'Velero Demo',
                type: 37,
                destination: 'PUNTA DEL ESTE',
                timestamp: new Date().toISOString(),
                imo: '7654321',
                callsign: 'DEMO2',
                flag: 'UY',
                length: 15,
                width: 5,
                typeName: 'Sailing Vessel'
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

    let embarcacionesExitosas = 0;

    embarcaciones.forEach(vessel => {
        try {
            if (!vessel.lat || !vessel.lng || isNaN(vessel.lat) || isNaN(vessel.lng)) {
                console.warn(`⚠️ Embarcación con coordenadas inválidas:`, vessel);
                return;
            }

            const icono = crearIconoEmbarcacion(vessel);
            const tipoInfo = getTipoEmbarcacion(vessel.type);

            const popup = `
                <div style="min-width: 250px;">
                    <strong>${vessel.name || 'Sin nombre'}</strong><br>
                    <strong>MMSI:</strong> ${vessel.mmsi}<br>
                    ${vessel.imo ? `<strong>IMO:</strong> ${vessel.imo}<br>` : ''}
                    ${vessel.callsign ? `<strong>Indicativo:</strong> ${vessel.callsign}<br>` : ''}
                    ${vessel.flag ? `<strong>Bandera:</strong> ${vessel.flag}<br>` : ''}
                    <strong>Tipo:</strong> ${vessel.typeName || tipoInfo.tipo}<br>
                    ${vessel.shipClass ? `<strong>Clase:</strong> ${vessel.shipClass}<br>` : ''}
                    <strong>Velocidad:</strong> ${(vessel.speed || 0).toFixed(1)} kt<br>
                    <strong>Rumbo:</strong> ${(vessel.heading || 0).toFixed(0)}°<br>
                    ${(vessel.course && vessel.course !== vessel.heading) ? `<strong>Curso:</strong> ${vessel.course.toFixed(0)}°<br>` : ''}
                    ${(vessel.length && vessel.width) ? `<strong>Dimensiones:</strong> ${vessel.length}m x ${vessel.width}m<br>` : ''}
                    <strong>Destino:</strong> ${vessel.destination || 'N/A'}<br>
                    ${vessel.eta ? `<strong>ETA:</strong> ${new Date(vessel.eta).toLocaleString()}<br>` : ''}
                    ${vessel.lastPort ? `<strong>Último puerto:</strong> ${vessel.lastPort}<br>` : ''}
                    <small><strong>Actualizado:</strong> ${new Date(vessel.timestamp).toLocaleString()}</small>
                </div>
            `;

            L.marker([vessel.lat, vessel.lng], { icon: icono })
                .bindPopup(popup)
                .addTo(capaEmbarcaciones);

            embarcacionesExitosas++;

        } catch (error) {
            console.warn(`⚠️ Error creando marcador para embarcación:`, vessel, error);
        }
    });

    if (embarcacionesExitosas > 0) {
        capaEmbarcaciones.addTo(map);
        console.log(`✅ ${embarcacionesExitosas} embarcaciones mostradas en el mapa`);
    }

    actualizarPanelEmbarcaciones(embarcaciones);
}

function actualizarPanelEmbarcaciones(embarcaciones) {
    const contador = document.getElementById('contador-embarcaciones');
    const lista = document.getElementById('lista-embarcaciones');

    if (!contador || !lista) {
        console.warn('⚠️ Elementos del panel de embarcaciones no encontrados');
        return;
    }

    contador.textContent = `${embarcaciones.length} embarcaciones detectadas`;
    lista.innerHTML = '';

    embarcaciones.slice(0, 10).forEach(vessel => {
        try {
            const tipoInfo = getTipoEmbarcacion(vessel.type);
            const item = document.createElement('div');
            item.className = 'embarcacion-item';
            item.onclick = () => centrarEnEmbarcacion(vessel);

            const tipoTexto = vessel.typeName || tipoInfo.tipo;
            const bandera = vessel.flag ? ` (${vessel.flag})` : '';
            const velocidad = vessel.speed ? vessel.speed.toFixed(1) : '0.0';
            const rumbo = vessel.heading ? vessel.heading.toFixed(0) : '0';

            item.innerHTML = `
                <div class="embarcacion-nombre">${tipoInfo.icono} ${vessel.name}${bandera}</div>
                <div class="embarcacion-info">
                    ${tipoTexto} | ${velocidad} kt | ${rumbo}°
                </div>
                ${vessel.destination ? `<div class="embarcacion-destino">→ ${vessel.destination}</div>` : ''}
            `;

            lista.appendChild(item);
        } catch (error) {
            console.warn('⚠️ Error creando item del panel para embarcación:', vessel, error);
        }
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
        btn.textContent = '🚢 Embarcaciones MarineTraffic ON';
        btn.classList.remove('activo');
        panel.style.display = 'none';

        console.log('🚢 Capa de embarcaciones oculta');

    } else {
        btn.classList.add('activo');
        btn.textContent = '🚢 Cargando MarineTraffic...';
        panel.style.display = 'block';

        const embarcaciones = await cargarEmbarcacionesAIS();

        if (embarcaciones.length > 0) {
            mostrarEmbarcacionesEnMapa(embarcaciones);
            embarcacionesVisible = true;
            btn.textContent = '🚢 Embarcaciones MarineTraffic OFF';

            intervalEmbarcaciones = setInterval(async () => {
                console.log('🔄 Actualizando embarcaciones MarineTraffic...');
                const nuevasEmbarcaciones = await cargarEmbarcacionesAIS();
                if (nuevasEmbarcaciones.length > 0) {
                    mostrarEmbarcacionesEnMapa(nuevasEmbarcaciones);
                }
            }, 2 * 60 * 1000);

            console.log('✅ Capa de embarcaciones MarineTraffic mostrada');
        } else {
            btn.textContent = '🚢 Sin Datos MarineTraffic';
            btn.classList.remove('activo');
            panel.style.display = 'none';
        }
    }
}

// ==================== INICIALIZACIÓN PRINCIPAL ====================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Iniciando aplicación de regatas...");

  // 🌬️ CREAR CANVAS PARA PARTÍCULAS DE VIENTO - PRIMERO DE TODO
  windCanvasEl = document.createElement('canvas');    // <-- referencia global
  windCanvasEl.id = 'wind-canvas';
  windCanvasEl.style.position = 'absolute';
  windCanvasEl.style.top = '0';
  windCanvasEl.style.left = '0';
  windCanvasEl.style.pointerEvents = 'none';

  // montar en overlayPane para orden correcto
  const overlayPane = map.getPanes().overlayPane;
  overlayPane.appendChild(windCanvasEl);
  windCanvasEl.style.zIndex = '450';

  // Pane dedicado por encima de markers/overlays
  const windPane = map.createPane('windPane');
  windPane.style.zIndex = '650';
  windPane.style.pointerEvents = 'none';
  windPane.appendChild(windCanvasEl);

  // Resize con DPR (nítido)
  function resizeWindCanvas() {
    const size = map.getSize();
    const dpr = window.devicePixelRatio || 1;

    windCanvasEl.width  = Math.max(1, Math.floor(size.x * dpr));
    windCanvasEl.height = Math.max(1, Math.floor(size.y * dpr));
    windCanvasEl.style.width  = size.x + 'px';
    windCanvasEl.style.height = size.y + 'px';

    windCtx = windCanvasEl.getContext('2d');
    windCtx.setTransform(dpr, 0, 0, dpr, 0, 0); // coords en px CSS

    // 👈 resembrar si está encendido
    if (vientoVisible) {
      windParticles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        windParticles.push(new WindParticle(windCanvasEl));
      }
    }
  }

  resizeWindCanvas();
  map.on('resize zoomend moveend', resizeWindCanvas);

  // limpiar canvas mientras se mueve/zoomea
  map.on('zoomstart movestart', () => {
    if (windCtx) windCtx.clearRect(0, 0, windCanvasEl.width, windCanvasEl.height);
  });

  // 🔘 botón viento — evitar doble disparo
  let btnViento = document.getElementById('toggle-viento');
  if (btnViento) {
    // elimina cualquier onclick inline del HTML (si lo hubiera)
    btnViento.removeAttribute('onclick');

    // (opcional) si sospechás listeners duplicados previos, clonar el nodo:
    // const limpio = btnViento.cloneNode(true);
    // btnViento.parentNode.replaceChild(limpio, btnViento);
    // btnViento = limpio;

    btnViento.addEventListener('click', (e) => {
      e.preventDefault();
      toggleCapaViento();
    });
  }

  // 🔘 botón batimetría — sin onclick inline
  const btnBathy = document.getElementById('toggle-batimetria');
  if (btnBathy) {
    btnBathy.addEventListener('click', (e) => {
      e.preventDefault();
      toggleCapaBatimetria();
    });
  }

  // Cargar selector de rutas PRIMERO
  await cargarRutasDisponiblesEnSelector();

  // Cargar navegantes
  cargarNavegantesVinculados();

  // Solo polling de datos de viento (la animación arranca con el botón)
  iniciarSistemaViento();

  // Intervalos de actualización
  setInterval(cargarNavegantesVinculados, 5000);
  setInterval(() => {
    if (!mostrarTraza || !usuarioTrazaActiva) return;
    trazarRutaUsuarioEspecifico(usuarioTrazaActiva);
  }, 5000);

  console.log("✅ Aplicación iniciada correctamente");
});

