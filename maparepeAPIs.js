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

/*
// Tu capa satelital anterior (comentada o eliminada si ya no la necesitas)
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: '&copy; Esri',
  maxZoom: 19
}).addTo(map);
*/

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

const sirenaAudio = new Audio('img/sirena.mp3'); // colocá el archivo en la misma carpeta que el mapa.html
sirenaAudio.loop = false;

let marcadores = new Map(); //let marcadores = []; // ⬅️ Para limpiar luego los círculos de competidores
let puntosControl = []; // guardará todos los puntos
let registrosHechos = new Set(); // para evitar múltiples registros del mismo punto
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

// 🎨 NUEVO: Paleta de colores para diferentes usuarios
const COLORES_USUARIOS = [
  '#ff6b6b',  // Rojo coral
  '#4ecdc4',  // Verde agua
  '#45b7d1',  // Azul cielo
  '#96ceb4',  // Verde menta
  '#feca57',  // Amarillo
  '#ff9ff3',  // Rosa
  '#54a0ff',  // Azul
  '#5f27cd',  // Púrpura
  '#00d2d3',  // Cian
  '#ff9f43',  // Naranja
  '#10ac84',  // Verde esmeralda
  '#ee5a6f',  // Rosa salmón
  '#c44569',  // Rosa oscuro
  '#40739e',  // Azul marino
  '#487eb0',  // Azul acero
  '#8c7ae6'   // Lavanda
];

// 🎨 NUEVO: Mapa para asignar colores consistentes a usuarios
let coloresAsignados = new Map();
let contadorColores = 0;

// 🎨 NUEVO: Función para obtener color único por usuario
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

  // Convertir hex a filtros CSS
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
  // Filtros CSS específicos para cada color
  const filtrosMap = {
    '#ff6b6b': 'sepia(100%) saturate(200%) hue-rotate(0deg)',      // rojo
    '#4ecdc4': 'sepia(100%) saturate(200%) hue-rotate(160deg)',    // verde agua
    '#45b7d1': 'sepia(100%) saturate(200%) hue-rotate(200deg)',    // azul
    '#96ceb4': 'sepia(100%) saturate(200%) hue-rotate(120deg)',    // verde menta
    '#feca57': 'sepia(100%) saturate(200%) hue-rotate(40deg)',     // amarillo
    '#ff9ff3': 'sepia(100%) saturate(200%) hue-rotate(300deg)',    // rosa
    '#54a0ff': 'sepia(100%) saturate(200%) hue-rotate(220deg)',    // azul claro
    '#5f27cd': 'sepia(100%) saturate(200%) hue-rotate(260deg)',    // púrpura
    '#00d2d3': 'sepia(100%) saturate(200%) hue-rotate(180deg)',    // cian
    '#ff9f43': 'sepia(100%) saturate(200%) hue-rotate(25deg)',     // naranja
    '#10ac84': 'sepia(100%) saturate(200%) hue-rotate(140deg)',    // verde esmeralda
    '#ee5a6f': 'sepia(100%) saturate(200%) hue-rotate(340deg)',    // rosa salmón
    '#c44569': 'sepia(100%) saturate(200%) hue-rotate(320deg)',    // rosa oscuro
    '#40739e': 'sepia(100%) saturate(200%) hue-rotate(210deg)',    // azul marino
    '#487eb0': 'sepia(100%) saturate(200%) hue-rotate(205deg)',    // azul acero
    '#8c7ae6': 'sepia(100%) saturate(200%) hue-rotate(270deg)'     // lavanda
  };

  return filtrosMap[hex] || 'sepia(100%) saturate(200%) hue-rotate(0deg)';
}

function actualizarLabel(labelId, value) {
    document.getElementById(labelId).innerText = value;
}

anchoCorredorInput.addEventListener('input', (event) => {
    // a. Actualiza la variable 'RADIO_PUNTO_CONTROL' con el nuevo valor del slider
    RADIO_PUNTO_CONTROL = parseFloat(event.target.value);

    // b. Llama a tu función para actualizar el label visualmente
    actualizarLabel('anchoLabel', event.target.value);

    // Opcional: Si necesitas hacer algo más inmediatamente cuando el slider cambie, hazlo aquí.
    console.log("Nuevo RADIO_PUNTO_CONTROL:", RADIO_PUNTO_CONTROL);
});

// FUNCIÓN MODIFICADA: Para llenar el selector de rutas con las opciones del backend
async function cargarRutasDisponiblesEnSelector() {
  const selectorRuta = document.getElementById("select-ruta");

  // Limpiar opciones existentes (excepto la primera "Seleccione una ruta")
  while (selectorRuta.options.length > 1) {
    selectorRuta.remove(1);
  }

  try {
    const res = await fetch("https://navigationasistance-backend-1.onrender.com/rutas/listarSimples");
    const rutasDisponibles = await res.json();

    rutasDisponibles.forEach((ruta) => {
      if (ruta.color === "REGATA") { // ← CAMBIADO DE "CARRERA" A "REGATA"
        const opt = document.createElement("option");
        opt.value = ruta.id;
        opt.textContent = `Ruta ${ruta.id} - ${ruta.nombre}`;
        selectorRuta.appendChild(opt);
      }
    });

    // NUEVO: Agregar event listener para el cambio de ruta
    selectorRuta.addEventListener('change', onCambioRuta);

    console.log(`✅ ${rutasDisponibles.filter(r => r.color === "REGATA").length} rutas de regata cargadas en el selector`);
  } catch (e) {
    console.error("❌ Error al cargar rutas disponibles en el selector:", e);
    alert("❌ Error al cargar la lista de rutas disponibles.");
  }
}

// NUEVA FUNCIÓN: Manejar cambio de ruta
async function onCambioRuta() {
  const selectorRuta = document.getElementById("select-ruta");
  const rutaSeleccionada = selectorRuta.value;

  if (!rutaSeleccionada) {
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

// Dentro de tu archivo JS, en la sección de definición de íconos o funciones auxiliares

function crearIconoCompetidorConBearing(bearing, usuarioid) {
  // Asegurarse de que el bearing esté entre 0 y 359
  let normalizedBearing = bearing % 360;
  if (normalizedBearing < 0) {
    normalizedBearing += 360;
  }

  // Redondear al múltiplo de 10 más cercano
  let iconAngle = Math.round(normalizedBearing / 10) * 10;
  if (iconAngle === 360) { // Manejo especial para 360 grados, que es 000
    iconAngle = 0;
  }

  // Formatear el número con ceros a la izquierda (ej: 000, 010, 350)
  const paddedAngle = String(iconAngle).padStart(3, '0');
  const iconUrl = `/img/barco_bearing_icons/barco_${paddedAngle}.png`;

  // 🎨 NUEVO: Obtener color único para este usuario
  const colorUsuario = obtenerColorUsuario