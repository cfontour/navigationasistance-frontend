// =================== CONFIG & STATE ===================

// Variable para controlar qué usuario tiene la traza activa
let usuarioTrazaActiva = null;
let intervaloPollling = null;

// Viento (canvas de partículas)
let windCanvasEl = null;
let windCtx = null;
let vientoBusy = false;

// Ruta seleccionada (meta)
let rutaActualSeleccionada = null;

// Mapa
const map = L.map("map").setView([-34.9, -56.1], 13);

// Capa base
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);

// =================== CONSTANTES EXTERNAS ===================

const WEATHER_API_KEY = "75e2bce104fa4fa180e194644251908";
const MARINETRAFFIC_API_KEY =
  "a2bce129655604707493126125e973ca8ced2993";

const COORD_REFERENCIA = { lat: -34.9630725, lng: -54.9417927 };

// =================== ICONOS ===================

const iconoInicio = L.icon({ iconUrl: "img/start_flag.png", iconSize: [32, 32] });
const iconoIntermedio = L.icon({ iconUrl: "img/white_flag.png", iconSize: [24, 24] });
const iconoFinal = L.icon({ iconUrl: "img/finish_flag.png", iconSize: [32, 32] });

// =================== CONTROL CORREDOR ===================

const anchoCorredorInput = document.getElementById("anchoCorredor") || null;
const anchoLabelSpan = document.getElementById("anchoLabel") || null;

let RADIO_PUNTO_CONTROL = parseFloat(
  (anchoCorredorInput && anchoCorredorInput.value) || "10"
);

function actualizarLabel(labelId, value) {
  const el = document.getElementById(labelId);
  if (el) el.innerText = value;
}

if (anchoCorredorInput) {
  anchoCorredorInput.addEventListener("input", (event) => {
    RADIO_PUNTO_CONTROL = parseFloat(event.target.value);
    actualizarLabel("anchoLabel", event.target.value);
    console.log("Nuevo RADIO_PUNTO_CONTROL:", RADIO_PUNTO_CONTROL);
  });
}

// =================== SONIDOS ===================

const sirenaAudio = new Audio("img/sirena.mp3");
sirenaAudio.loop = false;

// =================== ESTRUCTURAS ===================

let marcadores = new Map();
let puntosControl = [];
let registrosHechos = new Set();
let mostrarTraza = false;

let capaEmbarcaciones = null;
let embarcacionesVisible = false;
let intervalEmbarcaciones = null;
let embarcacionesData = [];

let marcadoresPuntosControl = [];
let circulosPuntosControl = [];

const COLORES_USUARIOS = [
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#96ceb4",
  "#feca57",
  "#ff9ff3",
  "#54a0ff",
  "#5f27cd",
  "#00d2d3",
  "#ff9f43",
  "#10ac84",
  "#ee5a6f",
  "#c44569",
  "#40739e",
  "#487eb0",
  "#8c7ae6",
];
let coloresAsignados = new Map();
let contadorColores = 0;

function obtenerColorUsuario(usuarioid) {
  if (!coloresAsignados.has(usuarioid)) {
    const color = COLORES_USUARIOS[contadorColores % COLORES_USUARIOS.length];
    coloresAsignados.set(usuarioid, color);
    contadorColores++;
    console.log(`🎨 Color asignado para usuario ${usuarioid}: ${color}`);
  }
  return coloresAsignados.get(usuarioid);
}

function convertirHexAFiltro(hex) {
  const filtrosMap = {
    "#ff6b6b": "sepia(100%) saturate(200%) hue-rotate(0deg)",
    "#4ecdc4": "sepia(100%) saturate(200%) hue-rotate(160deg)",
    "#45b7d1": "sepia(100%) saturate(200%) hue-rotate(200deg)",
    "#96ceb4": "sepia(100%) saturate(200%) hue-rotate(120deg)",
    "#feca57": "sepia(100%) saturate(200%) hue-rotate(40deg)",
    "#ff9ff3": "sepia(100%) saturate(200%) hue-rotate(300deg)",
    "#54a0ff": "sepia(100%) saturate(200%) hue-rotate(220deg)",
    "#5f27cd": "sepia(100%) saturate(200%) hue-rotate(260deg)",
    "#00d2d3": "sepia(100%) saturate(200%) hue-rotate(180deg)",
    "#ff9f43": "sepia(100%) saturate(200%) hue-rotate(25deg)",
    "#10ac84": "sepia(100%) saturate(200%) hue-rotate(140deg)",
    "#ee5a6f": "sepia(100%) saturate(200%) hue-rotate(340deg)",
    "#c44569": "sepia(100%) saturate(200%) hue-rotate(320deg)",
    "#40739e": "sepia(100%) saturate(200%) hue-rotate(210deg)",
    "#487eb0": "sepia(100%) saturate(200%) hue-rotate(205deg)",
    "#8c7ae6": "sepia(100%) saturate(200%) hue-rotate(270deg)",
  };
  return filtrosMap[hex] || "sepia(100%) saturate(200%) hue-rotate(0deg)";
}

function aplicarColorIcono(usuarioid, color) {
  const className = `barco-icon-${usuarioid.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const filtros = convertirHexAFiltro(color);

  let styleSheet = document.getElementById("iconos-dinamicos-css");
  if (!styleSheet) {
    styleSheet = document.createElement("style");
    styleSheet.id = "iconos-dinamicos-css";
    document.head.appendChild(styleSheet);
  }

  const newRule = `.${className} { filter: ${filtros} !important; }`;
  const existingRuleIndex = Array.from(styleSheet.sheet.cssRules).findIndex(
    (rule) => rule.selectorText === `.${className}`
  );

  if (existingRuleIndex !== -1) {
    styleSheet.sheet.deleteRule(existingRuleIndex);
  }
  styleSheet.sheet.insertRule(newRule, styleSheet.sheet.cssRules.length);
}

// =================== ICONOS NAVEGANTES ===================

function crearIconoCompetidorConBearing(bearing, usuarioid) {
  let normalizedBearing = bearing % 360;
  if (normalizedBearing < 0) normalizedBearing += 360;

  let iconAngle = Math.round(normalizedBearing / 10) * 10;
  if (iconAngle === 360) iconAngle = 0;

  const paddedAngle = String(iconAngle).padStart(3, "0");
  const iconUrl = `/img/barco_bearing_icons/barco_${paddedAngle}.png`;

  return L.icon({
    iconUrl,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -16],
    className: `barco-icon barco-icon-${usuarioid.replace(/[^a-zA-Z0-9]/g, "_")}`,
  });
}

// =================== DATOS NAVEGANTES ===================

async function cargarNavegantesVinculados() {
  try {
    const response = await fetch(
      "https://navigationasistance-backend-1.onrender.com/nadadorposicion/listarActivosEnCarrera"
    );
    const nadadores = await response.json();
    if (nadadores.length === 0) historialPuntos = new Map();

    for (let m of marcadores.values()) map.removeLayer(m);
    marcadores.clear();

    nadadores.forEach((n) => {
      const lat = parseFloat(n.nadadorlat);
      const lng = parseFloat(n.nadadorlng);
      const bearing = parseFloat(n.bearing);

      if (isNaN(lat) || isNaN(lng)) return;

      let icono;
      if (n.emergency === true) {
        icono = L.icon({
          iconUrl: "img/marker-emergencia-36x39.png",
          iconSize: [36, 39],
          iconAnchor: [18, 39],
          className: "icono-emergencia",
        });
        if (sirenaAudio.paused) {
          sirenaAudio.play().catch(() => {});
        }
      } else {
        icono = crearIconoCompetidorConBearing(bearing, n.usuarioid);
        const colorUsuario = obtenerColorUsuario(n.usuarioid);
        setTimeout(() => aplicarColorIcono(n.usuarioid, colorUsuario), 200);
      }

      const marcador = L.marker([lat, lng], { icon: icono }).addTo(map);
      marcadores.set(String(n.usuarioid), marcador);

      // popup (contenido sin onclick inline)
      actualizarPopup(n.usuarioid);

      // verificación de puntos de control
      if (n.usuarioid && puntosControl.length > 0) {
        verificarPuntosDeControl(n.usuarioid, lat, lng);
      }
    });
  } catch (error) {
    console.error("Error al cargar nadadores vinculados:", error);
  }
}

// =================== POPUP (sin inline handlers) ===================

let historialPuntos = new Map();

function htmlPopupUsuario(usuarioid, datosUsuario = {}) {
  const historial = historialPuntos.get(usuarioid) || [];
  const listaHtml = historial
    .map(
      (p) =>
        `<li>${p.etiqueta} <small>${new Date(p.fechaHora).toLocaleTimeString()}</small></li>`
    )
    .join("");

  const esTrazaActiva = usuarioTrazaActiva === usuarioid;
  const textoBoton = esTrazaActiva ? "🔴 Desactivar Traza" : "🟢 Activar Traza";
  const colorBoton = esTrazaActiva ? "#e74c3c" : "#27ae60";

  const nombreCompleto = datosUsuario.nombre
    ? `${datosUsuario.nombre} ${datosUsuario.apellido || ""}`
    : `Usuario ${usuarioid}`;

  return `
    <div style="min-width: 220px;">
      <strong>📍 ${nombreCompleto}</strong><br/>
      <small>ID: ${usuarioid}</small><br/><br/>
      <div style="margin: 10px 0;">
        <button
          class="btn-toggle-traza"
          data-usuario="${usuarioid}"
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
        >${textoBoton}</button>
      </div>
      <strong>🏁 Puntos de control:</strong><br/>
      <ul style="margin: 5px 0; padding-left: 20px;">
        ${listaHtml.length > 0 ? listaHtml : "<li><em>Sin puntos registrados</em></li>"}
      </ul>
    </div>
  `;
}

async function actualizarPopup(usuarioid) {
  try {
    const resHist = await fetch(
      `https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/listarPorNadadorrutaId/${usuarioid}`
    );
    const historial = await resHist.json();
    const normal = Array.isArray(historial)
      ? historial.map((p) => ({
          etiqueta: p.puntoControl || "❓(sin etiqueta)",
          fechaHora: p.fechaHora,
        }))
      : [];
    historialPuntos.set(usuarioid, normal);

    const resUsuario = await fetch(
      `https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${usuarioid}`
    );
    const usuario = await resUsuario.json();
    const html = htmlPopupUsuario(usuarioid, usuario);

    const m = marcadores.get(String(usuarioid));
    if (m) m.bindPopup(html);
  } catch (err) {
    console.warn("Popup error:", err);
  }
}

async function actualizarTodosLosPopups() {
  for (let [usuarioid, marcador] of marcadores.entries()) {
    try {
      const resUsuario = await fetch(
        `https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${usuarioid}`
      );
      const usuario = await resUsuario.json();
      marcador.bindPopup(htmlPopupUsuario(usuarioid, usuario));
    } catch {}
  }
}

// Enganche de botones al abrir cualquier popup
map.on("popupopen", (e) => {
  const cont = e.popup.getElement();
  if (!cont) return;
  const btn = cont.querySelector(".btn-toggle-traza");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const usuarioid = btn.getAttribute("data-usuario");
    toggleTrazaSegura(usuarioid);
  });
});

// =================== TRAZA (a prueba de carreras async) ===================

let polylineTraza = null;
// token monotónico: si cambia, invalida requests anteriores
let trazaToken = 0;

function borrarTraza() {
  mostrarTraza = false;
  usuarioTrazaActiva = null;

  // invalida cualquier fetch en curso
  trazaToken++;

  if (polylineTraza) {
    map.removeLayer(polylineTraza);
    polylineTraza = null;
  }
  detenerActualizacionMetricas();

  // refrescar popups para botón
  setTimeout(() => actualizarTodosLosPopups(), 100);
}

function toggleTrazaSegura(usuarioid) {
  if (usuarioTrazaActiva === usuarioid) {
    // desactivar
    borrarTraza();
    console.log("❌ Traza desactivada");
  } else {
    // activar
    usuarioTrazaActiva = usuarioid;
    mostrarTraza = true;
    iniciarActualizacionMetricas(usuarioid);
    trazarRutaUsuarioEspecifico(usuarioid); // primer trazo
    console.log(`✅ Traza activada para usuario: ${usuarioid}`);
  }
  actualizarTodosLosPopups();
}

async function trazarRutaUsuarioEspecifico(usuarioId) {
  // si no hay traza activa para ese usuario, salir
  if (!mostrarTraza || usuarioTrazaActiva !== usuarioId) return;

  const miToken = ++trazaToken; // token propio de este llamado

  const fechaUruguay = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Montevideo",
  });

  try {
    const resUuid = await fetch(
      `https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ultimorecorrido/${usuarioId}/${fechaUruguay}`
    );
    const uuidList = await resUuid.json();
    if (!uuidList || uuidList.length === 0) return;

    const ultimaRuta = uuidList[0];
    const res = await fetch(
      `https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ruta/${ultimaRuta}`
    );
    let puntos = await res.json();

    // orden por hora (UTC-3)
    puntos.sort((a, b) => {
      const tA = new Date(`${a.nadadorfecha}T${a.nadadorhora.split("T")[1]}`).getTime();
      const tB = new Date(`${b.nadadorfecha}T${b.nadadorhora.split("T")[1]}`).getTime();
      if (tA === tB) return Number(a.secuencia) - Number(b.secuencia);
      return tA - tB;
    });

    const latlngs = puntos
      .filter(
        (p) =>
          Number.isFinite(parseFloat(p.nadadorlat)) &&
          Number.isFinite(parseFloat(p.nadadorlng)) &&
          Number(p.secuencia) >= 1
      )
      .map((p) => [parseFloat(p.nadadorlat), parseFloat(p.nadadorlng)]);

    if (latlngs.length === 0) return;

    // si durante el fetch se apagó, abortar silencioso
    if (miToken !== trazaToken || !mostrarTraza || usuarioTrazaActiva !== usuarioId) return;

    // borrar anterior y dibujar
    if (polylineTraza) map.removeLayer(polylineTraza);

    const colorUsuario = obtenerColorUsuario(usuarioId);
    polylineTraza = L.polyline(latlngs, {
      color: colorUsuario,
      weight: 7,
      dashArray: "10, 10",
    }).addTo(map);

    // por encima de azulejos y debajo de UI
    polylineTraza.bringToFront();
  } catch (err) {
    console.error("❌ Error al trazar ruta:", err);
  }
}

// Re-trazado periódico: respeta flags y token
setInterval(() => {
  if (!mostrarTraza || !usuarioTrazaActiva) return;
  trazarRutaUsuarioEspecifico(usuarioTrazaActiva);
}, 5000);

// =================== MÉTRICAS ===================

function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function metrosAMillasNauticas(m) {
  return m / 1852;
}
function calcularVelocidadNudos(distM, tSeg) {
  if (tSeg === 0) return 0;
  return (distM / tSeg) * 1.94384;
}

function actualizarMetricas(metricas) {
  if (!metricas || metricas.totalPuntos === 0) {
    mostrarSinDatos();
    return;
  }
  actualizarBearing(metricas.bearing);
  actualizarDistancia(metricas.millasNauticas);
  actualizarVelocidad(metricas.velocidadNudos);
}

function actualizarBearing(bearing) {
  const bearingElement = document.getElementById("bearing-value");
  const needleElement = document.getElementById("bearing-needle");
  if (!bearingElement || !needleElement) return;

  bearingElement.textContent = bearing.toFixed(0) + "°";
  bearingElement.classList.add("actualizado");
  setTimeout(() => bearingElement.classList.remove("actualizado"), 400);

  needleElement.style.transform = `rotate(${bearing}deg)`;
}
function actualizarDistancia(mn) {
  const el = document.getElementById("distancia-value");
  if (!el) return;
  el.textContent = mn.toFixed(2);
  el.classList.add("actualizado");
  setTimeout(() => el.classList.remove("actualizado"), 400);
}
function actualizarVelocidad(kn) {
  const el = document.getElementById("velocidad-value");
  if (!el) return;
  el.textContent = kn.toFixed(1);
  el.classList.add("actualizado");
  setTimeout(() => el.classList.remove("actualizado"), 400);
}
function actualizarUsuario(usuarioid, nombre) {
  const el = document.getElementById("usuario-value");
  if (!el) return;
  const nombreCompleto = nombre || `Usuario ${usuarioid}`;
  el.textContent = nombreCompleto;
  el.classList.add("actualizado");
  setTimeout(() => el.classList.remove("actualizado"), 400);
}
function mostrarSinDatos() {
  document.getElementById("bearing-value") &&
    (document.getElementById("bearing-value").textContent = "---°");
  document.getElementById("distancia-value") &&
    (document.getElementById("distancia-value").textContent = "0.00");
  document.getElementById("velocidad-value") &&
    (document.getElementById("velocidad-value").textContent = "0.0");
}

async function obtenerDatosHistoricos(usuarioId) {
  try {
    const fechaUruguay = new Date().toLocaleDateString("sv-SE", {
      timeZone: "America/Montevideo",
    });

    const resUuid = await fetch(
      `https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ultimorecorrido/${usuarioId}/${fechaUruguay}`
    );
    if (!resUuid.ok) return [];

    const uuidList = await resUuid.json();
    if (!uuidList || uuidList.length === 0) return [];

    const ultimaRuta = uuidList[0];
    const res = await fetch(
      `https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ruta/${ultimaRuta}`
    );
    if (!res.ok) return [];

    let puntos = await res.json();
    if (!puntos || puntos.length === 0) return [];

    puntos.sort((a, b) => {
      const tA = new Date(`${a.nadadorfecha}T${a.nadadorhora.split("T")[1]}`).getTime();
      const tB = new Date(`${b.nadadorfecha}T${b.nadadorhora.split("T")[1]}`).getTime();
      if (tA === tB) return Number(a.secuencia) - Number(b.secuencia);
      return tA - tB;
    });

    return puntos.filter(
      (p) =>
        Number.isFinite(parseFloat(p.nadadorlat)) &&
        Number.isFinite(parseFloat(p.nadadorlng)) &&
        Number(p.secuencia) >= 1
    );
  } catch (e) {
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
        totalPuntos: 0,
      };
    }

    let bearingActual = 0;
    try {
      const response = await fetch(
        "https://navigationasistance-backend-1.onrender.com/nadadorposicion/listarActivosEnCarrera"
      );
      const nadadores = await response.json();
      const nadadorActual = nadadores.find((n) => n.usuarioid == usuarioId);
      if (nadadorActual && nadadorActual.bearing !== undefined) {
        bearingActual = parseFloat(nadadorActual.bearing) || 0;
      }
    } catch {
      const ultimoPunto = datos[datos.length - 1];
      bearingActual = ultimoPunto.bearing || 0;
    }

    const ultimoPunto = datos[datos.length - 1];

    // distancia total
    let distM = 0;
    for (let i = 1; i < datos.length; i++) {
      const p1 = datos[i - 1];
      const p2 = datos[i];
      distM += calcularDistanciaHaversine(
        parseFloat(p1.nadadorlat),
        parseFloat(p1.nadadorlng),
        parseFloat(p2.nadadorlat),
        parseFloat(p2.nadadorlng)
      );
    }

    // velocidad (ventana últimos 5 puntos)
    let velocidadNudos = 0;
    if (datos.length >= 3) {
      const ventana = datos.slice(-5);
      let d = 0;
      let t = 0;
      for (let i = 1; i < ventana.length; i++) {
        const a = ventana[i - 1];
        const b = ventana[i];
        d += calcularDistanciaHaversine(
          parseFloat(a.nadadorlat),
          parseFloat(a.nadadorlng),
          parseFloat(b.nadadorlat),
          parseFloat(b.nadadorlng)
        );
        const t1 = new Date(`${a.nadadorfecha}T${a.nadadorhora.split("T")[1]}`).getTime();
        const t2 = new Date(`${b.nadadorfecha}T${b.nadadorhora.split("T")[1]}`).getTime();
        t += Math.abs(t2 - t1) / 1000;
      }
      if (t > 0) velocidadNudos = calcularVelocidadNudos(d, t);
    }

    return {
      bearing: bearingActual,
      millasNauticas: metrosAMillasNauticas(distM),
      velocidadNudos,
      ultimoPunto,
      totalPuntos: datos.length,
      recorridoId: ultimoPunto.recorridoid || ultimoPunto.recorrido_id,
    };
  } catch {
    return {
      bearing: 0,
      millasNauticas: 0,
      velocidadNudos: 0,
      ultimoPunto: null,
      totalPuntos: 0,
    };
  }
}

function iniciarActualizacionMetricas(usuarioId) {
  if (intervaloPollling) clearInterval(intervaloPollling);

  fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${usuarioId}`)
    .then((res) => res.json())
    .then((usuario) =>
      actualizarUsuario(usuarioId, `${usuario.nombre} ${usuario.apellido}`)
    )
    .catch(() => actualizarUsuario(usuarioId, null));

  actualizarDatos(usuarioId);
  intervaloPollling = setInterval(() => actualizarDatos(usuarioId), 5000);
}

async function actualizarDatos(usuarioId) {
  const panel = document.getElementById("panel-metricas");
  panel && panel.classList.add("panel-updating");

  try {
    const metricas = await obtenerMetricasUsuario(usuarioId);
    actualizarMetricas(metricas);
  } catch {
    mostrarSinDatos();
  } finally {
    panel && setTimeout(() => panel.classList.remove("panel-updating"), 300);
  }
}

function detenerActualizacionMetricas() {
  if (intervaloPollling) {
    clearInterval(intervaloPollling);
    intervaloPollling = null;
  }
  mostrarSinDatos();
}

// =================== VIENTO (partículas canvas) ===================

let capaViento = null;
let vientoVisible = false;
let intervalViento = null;

let windParticles = [];
let windAnimationFrame = null;
let windData = { speed: 0, direction: 0 };
const PARTICLE_COUNT = 3000;
const PARTICLE_LIFE = 120;

class WindParticle {
  constructor(canvas) {
    this.reset(canvas);
    this.age = Math.random() * PARTICLE_LIFE;
  }
  reset(canvas) {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.px = this.x;
    this.py = this.y;
    this.age = 0;
    this.speed = 0.7 + Math.random() * 1.6;
  }
  update(canvas, windSpeed, windDir) {
    const rad = ((windDir || 0) * Math.PI) / 180;
    const visualSpeed = (windSpeed / 8) * this.speed;
    this.px = this.x;
    this.py = this.y;
    this.x += -Math.sin(rad) * visualSpeed;
    this.y += Math.cos(rad) * visualSpeed;
    this.age++;
    if (
      this.x < -10 ||
      this.x > canvas.width + 10 ||
      this.y < -10 ||
      this.y > canvas.height + 10 ||
      this.age > PARTICLE_LIFE
    ) {
      this.reset(canvas);
    }
  }
  draw(ctx) {
    const t = Math.max(0.2, 1 - this.age / PARTICLE_LIFE);
    const lw = 1.2 + 1.3 * t;
    const alpha = 0.65 + 0.25 * t;
    ctx.lineWidth = lw;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(this.px, this.py);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
  }
}

function initWindParticles() {
  const canvas = windCanvasEl || document.getElementById("wind-canvas");
  if (!canvas) return false;
  if (!windCtx) {
    const size = map.getSize();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(size.x * dpr));
    canvas.height = Math.max(1, Math.floor(size.y * dpr));
    canvas.style.width = size.x + "px";
    canvas.style.height = size.y + "px";
    windCtx = canvas.getContext("2d");
    windCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  windParticles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++)
    windParticles.push(new WindParticle(canvas));
  return true;
}

function animateWindParticles() {
  const canvas = windCanvasEl || document.getElementById("wind-canvas");
  if (!canvas) return;
  const ctx = windCtx || canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#ffffff";

  for (const p of windParticles) {
    p.update(canvas, windData.speed, windData.direction);
    p.draw(ctx);
  }
  ctx.globalAlpha = 1;

  windAnimationFrame = requestAnimationFrame(animateWindParticles);
}
function stopWindAnimation() {
  if (windAnimationFrame) {
    cancelAnimationFrame(windAnimationFrame);
    windAnimationFrame = null;
  }
  const canvas = windCanvasEl || document.getElementById("wind-canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

async function cargarViento(lat, lon) {
  try {
    const url = `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${lat},${lon}&aqi=no`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const kph = data.current.wind_kph;
    const kn = kph * 0.539957;
    const deg = data.current.wind_degree;
    const dirTxt = data.current.wind_dir;
    const gustKph = data.current.gust_kph || 0;
    const gustKn = gustKph * 0.539957;

    windData.speed = kn;
    windData.direction = deg;

    const setTxt = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };
    setTxt("vientoDir", `${deg}° (${dirTxt})`);
    setTxt("vientoVel", `${kn.toFixed(1)} kt`);
    setTxt("vientoRafagas", `${gustKn.toFixed(1)} kt`);
    setTxt("vientoActualizado", `Actualizado: ${new Date().toLocaleTimeString()}`);

    return { velocidad: kn, direccion: deg, direccionTexto: dirTxt, rafagas: gustKn };
  } catch (error) {
    const setTxt = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };
    setTxt("vientoDir", "Error");
    setTxt("vientoVel", "Error");
    setTxt("vientoRafagas", "Error");
    return null;
  }
}

async function toggleCapaViento() {
  const btn = document.getElementById("toggle-viento");
  if (vientoBusy) return;
  vientoBusy = true;

  try {
    if (vientoVisible) {
      stopWindAnimation();
      vientoVisible = false;
      btn && btn.classList.remove("activo");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "🌬️ Viento ON";
      }
      return;
    }

    btn && btn.classList.add("activo");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "🌬️ Cargando...";
    }

    const coords =
      marcadores.size > 0
        ? marcadores.values().next().value.getLatLng()
        : COORD_REFERENCIA;

    const datosViento = await cargarViento(coords.lat, coords.lng);
    if (!datosViento) {
      btn && btn.classList.remove("activo");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "🌬️ Error Viento";
      }
      return;
    }

    const ok = initWindParticles();
    if (!ok) {
      btn && btn.classList.remove("activo");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "🌬️ Error Canvas";
      }
      return;
    }

    animateWindParticles();
    vientoVisible = true;
    if (btn) {
      btn.disabled = false;
      btn.textContent = "🌬️ Viento OFF";
    }
  } finally {
    vientoBusy = false;
  }
}

function iniciarSistemaViento() {
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
}

// =================== PUNTOS DE CONTROL / RUTAS ===================

function limpiarPuntosControlAnteriores() {
  marcadoresPuntosControl.forEach((m) => map.removeLayer(m));
  marcadoresPuntosControl = [];
  circulosPuntosControl.forEach((c) => map.removeLayer(c));
  circulosPuntosControl = [];
  puntosControl = [];
}

async function cargarRutas(idRuta) {
  try {
    const res = await fetch(
      `https://navigationasistance-backend-1.onrender.com/rutas/listarId/${idRuta}`
    );
    const ruta = await res.json();

    const titleEl = document.getElementById("site-title");
    if (titleEl) titleEl.textContent = (ruta.nombre || "").toUpperCase();

    const puntos = ruta.puntos;
    if (!puntos || puntos.length === 0) return;

    const bounds = [];

    puntos.forEach((p, i) => {
      const latlng = [p.latitud, p.longitud];
      bounds.push(latlng);

      puntosControl.push({
        latitud: p.latitud,
        longitud: p.longitud,
        etiqueta: p.etiqueta || `Punto ${i + 1}`,
        nadadorruta_id: p.nadadorruta_id,
        rutaId: idRuta,
      });

      const controlPointRadius = L.circle(latlng, {
        radius: RADIO_PUNTO_CONTROL,
        color: "blue",
        fillColor: "#3388ff",
        fillOpacity: 0.2,
        weight: 1,
      }).addTo(map);
      circulosPuntosControl.push(controlPointRadius);

      const puntoCentral = L.circle(latlng, {
        radius: 5,
        color: "rgba(255, 255, 0, 0.5)",
        fillColor: "rgba(255, 255, 0, 0.5)",
        fillOpacity: 1,
      }).addTo(map);
      circulosPuntosControl.push(puntoCentral);

      let icon = iconoIntermedio;
      if (i === 0) icon = iconoInicio;
      else if (i === puntos.length - 1) icon = iconoFinal;

      const marcador = L.marker(latlng, { icon })
        .addTo(map)
        .bindPopup(
          `Etiqueta: ${p.etiqueta}<br>Lat: ${p.latitud}<br>Lng: ${p.longitud}`
        );
      marcadoresPuntosControl.push(marcador);
    });

    map.fitBounds(bounds);
  } catch (err) {
    console.error("Error al cargar rutas:", err);
  }
}

async function verificarPuntosDeControl(usuarioid, latActual, lngActual) {
  try {
    puntosControl.forEach(async (punto) => {
      const distancia = calcularDistanciaHaversine(
        latActual,
        lngActual,
        punto.latitud,
        punto.longitud
      );
      if (distancia < RADIO_PUNTO_CONTROL) {
        const payload = {
          nadadorrutaId: usuarioid,
          puntoControl: punto.etiqueta,
          fechaHora: new Date().toISOString(),
          rutaId: punto.rutaId,
        };
        const res = await fetch(
          "https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/agregar",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        if (res.ok) actualizarPopup(usuarioid);
      }
    });
  } catch {}
}

// =================== EMBARCACIONES (MarineTraffic) ===================

function getTipoEmbarcacion(shipType) {
  const tipo = parseInt(shipType) || 0;
  if (tipo >= 70 && tipo <= 79) return { tipo: "cargo", icono: "📦", clase: "vessel-cargo" };
  if (tipo >= 80 && tipo <= 89) return { tipo: "tanker", icono: "🛢️", clase: "vessel-tanker" };
  if (tipo >= 60 && tipo <= 69) return { tipo: "passenger", icono: "🛳️", clase: "vessel-passenger" };
  if (tipo == 30) return { tipo: "fishing", icono: "🎣", clase: "vessel-fishing" };
  if (tipo >= 36 && tipo <= 37) return { tipo: "pleasure", icono: "⛵", clase: "vessel-pleasure" };
  return { tipo: "other", icono: "🚢", clase: "vessel-other" };
}

function crearIconoEmbarcacion(v) {
  const t = getTipoEmbarcacion(v.type);
  return L.divIcon({
    className: `vessel-icon ${t.clase}`,
    html: `<div style="transform: rotate(${v.heading}deg);">${t.icono}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

async function cargarEmbarcacionesAIS() {
  try {
    const url = `https://services.marinetraffic.com/api/exportvessels-custom-area/${MARINETRAFFIC_API_KEY}?v=2&timespan=1440&protocol=jsono&limit=2000`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    let vessels = [];
    if (Array.isArray(data)) vessels = data;
    else if (data && Array.isArray(data.DATA)) vessels = data.DATA;
    else if (data && Array.isArray(data.data)) vessels = data.data;
    else return [];

    const embarcaciones = vessels
      .map((v) => {
        const lat = parseFloat(v.LAT || v.lat || v.latitude || 0);
        const lng = parseFloat(v.LON || v.lng || v.longitude || 0);
        let speed = parseFloat(v.SPEED || v.speed || 0);
        if (speed > 100) speed = speed / 10;
        return {
          mmsi: v.MMSI || v.mmsi || "N/A",
          lat,
          lng,
          speed,
          heading: parseFloat(v.HEADING || v.heading || 0),
          course: parseFloat(v.COURSE || v.course || 0),
          name: v.SHIPNAME || v.shipname || v.name || "Sin nombre",
          type: v.SHIPTYPE || v.shiptype || v.type || 0,
          destination: v.DESTINATION || v.destination || "",
          timestamp: v.TIMESTAMP || v.timestamp || new Date().toISOString(),
          imo: v.IMO || v.imo || "",
          callsign: v.CALLSIGN || v.callsign || "",
          flag: v.FLAG || v.flag || "",
          length: v.LENGTH || v.length || 0,
          width: v.WIDTH || v.width || 0,
          typeName: v.TYPE_NAME || v.type_name || "",
          shipClass: v.SHIP_CLASS || v.ship_class || "",
          lastPort: v.LAST_PORT || v.last_port || "",
          eta: v.ETA || v.eta || "",
          status: v.STATUS || v.status || 0,
        };
      })
      .filter(
        (v) =>
          !isNaN(v.lat) && !isNaN(v.lng) && v.lat !== 0 && v.lng !== 0 && Math.abs(v.lat) <= 90 && Math.abs(v.lng) <= 180
      );

    return embarcaciones;
  } catch (e) {
    return [];
  }
}

function mostrarEmbarcacionesEnMapa(embarcaciones) {
  if (capaEmbarcaciones) map.removeLayer(capaEmbarcaciones);
  capaEmbarcaciones = L.layerGroup();
  embarcacionesData = embarcaciones;

  embarcaciones.forEach((v) => {
    try {
      if (!v.lat || !v.lng || isNaN(v.lat) || isNaN(v.lng)) return;
      const icono = crearIconoEmbarcacion(v);
      const t = getTipoEmbarcacion(v.type);
      const popup = `
        <div style="min-width: 250px;">
          <strong>${v.name || "Sin nombre"}</strong><br>
          <strong>MMSI:</strong> ${v.mmsi}<br>
          ${v.imo ? `<strong>IMO:</strong> ${v.imo}<br>` : ""}
          ${v.callsign ? `<strong>Indicativo:</strong> ${v.callsign}<br>` : ""}
          ${v.flag ? `<strong>Bandera:</strong> ${v.flag}<br>` : ""}
          <strong>Tipo:</strong> ${v.typeName || t.tipo}<br>
          <strong>Velocidad:</strong> ${(v.speed || 0).toFixed(1)} kt<br>
          <strong>Rumbo:</strong> ${(v.heading || 0).toFixed(0)}°<br>
          <strong>Destino:</strong> ${v.destination || "N/A"}<br>
          <small><strong>Actualizado:</strong> ${new Date(v.timestamp).toLocaleString()}</small>
        </div>`;
      L.marker([v.lat, v.lng], { icon: icono }).bindPopup(popup).addTo(capaEmbarcaciones);
    } catch {}
  });

  if (embarcaciones.length > 0) capaEmbarcaciones.addTo(map);
}

async function toggleCapaEmbarcaciones() {
  const btn = document.getElementById("toggle-embarcaciones");
  const panel = document.getElementById("panel-embarcaciones");

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
    if (btn) {
      btn.textContent = "🚢 Embarcaciones MarineTraffic ON";
      btn.classList.remove("activo");
    }
    if (panel) panel.style.display = "none";
  } else {
    if (btn) {
      btn.classList.add("activo");
      btn.textContent = "🚢 Cargando MarineTraffic...";
    }
    if (panel) panel.style.display = "block";

    const embarcaciones = await cargarEmbarcacionesAIS();
    if (embarcaciones.length > 0) {
      mostrarEmbarcacionesEnMapa(embarcaciones);
      embarcacionesVisible = true;
      if (btn) btn.textContent = "🚢 Embarcaciones MarineTraffic OFF";

      intervalEmbarcaciones = setInterval(async () => {
        const nuevas = await cargarEmbarcacionesAIS();
        if (nuevas.length > 0) mostrarEmbarcacionesEnMapa(nuevas);
      }, 120000);
    } else {
      if (btn) {
        btn.textContent = "🚢 Sin Datos MarineTraffic";
        btn.classList.remove("activo");
      }
      if (panel) panel.style.display = "none";
    }
  }
}

// =================== INICIALIZACIÓN ===================

document.addEventListener("DOMContentLoaded", () => {
  // Pane exclusivo para viento (debajo de overlays)
  const windPane = map.createPane("windPane");
  windPane.style.zIndex = "300";
  windPane.style.pointerEvents = "none";

  // 🔧 Hacer que el pane se traslade con el mapa durante pan/zoom
  L.DomUtil.addClass(windPane, 'leaflet-zoom-animated');

  windCanvasEl = document.createElement("canvas");
  windCanvasEl.id = "wind-canvas";
  windCanvasEl.style.position = "absolute";
  windCanvasEl.style.top = "0";
  windCanvasEl.style.left = "0";
  windCanvasEl.style.pointerEvents = "none";
  windPane.appendChild(windCanvasEl);

  // --- SINCRONIZAR TRANSFORM DEL CANVAS CON EL MAPA (pan/zoom) ---
  const mapPane = map.getPanes().mapPane;            // <div class="leaflet-map-pane">
  function syncWindCanvasTransform() {
    // copia exactamente el transform que aplica Leaflet al mapPane
    windCanvasEl.style.transform = mapPane.style.transform || '';
  }
  // sincronizar en los eventos de movimiento/zoom
  map.on('move zoom zoomanim', syncWindCanvasTransform);
  // y una vez de arranque
  syncWindCanvasTransform();

  function resizeWindCanvas() {
    const size = map.getSize();
    const dpr = window.devicePixelRatio || 1;
    windCanvasEl.width = Math.max(1, Math.floor(size.x * dpr));
    windCanvasEl.height = Math.max(1, Math.floor(size.y * dpr));
    windCanvasEl.style.width = size.x + "px";
    windCanvasEl.style.height = size.y + "px";
    windCtx = windCanvasEl.getContext("2d");
    windCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (vientoVisible) {
      windParticles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++)
        windParticles.push(new WindParticle(windCanvasEl));
    }
  }

  //resizeWindCanvas();
  //map.on("resize zoomend moveend", resizeWindCanvas);
  //map.on("zoomstart movestart", () => {
  //  if (windCtx) windCtx.clearRect(0, 0, windCanvasEl.width, windCanvasEl.height);
  //});

  resizeWindCanvas();

  // Mantener partículas visibles mientras se arrastra el mapa
  map.on('resize zoomend', resizeWindCanvas);

  // (Opcional) bajar un poco el alpha durante el zoom animado para evitar “smear” visual
  map.on('zoomstart', () => {
    if (windCtx) windCtx.globalAlpha = 0.8;
  });
  map.on('zoomend', () => {
    if (windCtx) windCtx.globalAlpha = 1;
  });

  //map.on('moveend', () => {
  //  if (vientoVisible && windCanvasEl) {
  //    windParticles = [];
  //    for (let i = 0; i < PARTICLE_COUNT; i++) windParticles.push(new WindParticle(windCanvasEl));
  //  }
  //});

  // Botón viento (sin inline handler)
  const btnViento = document.getElementById("toggle-viento");
  if (btnViento) {
    btnViento.onclick = null;
    btnViento.addEventListener("click", (e) => {
      e.preventDefault();
      toggleCapaViento();
    });
  }

  // Cargar ruta y nadadores
  cargarRutas("52");
  cargarNavegantesVinculados();
  iniciarSistemaViento();

  // Polling de nadadores
  setInterval(cargarNavegantesVinculados, 5000);
});
