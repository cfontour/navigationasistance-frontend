// Variable para controlar qué usuario tiene la traza activa
let usuarioTrazaActiva = null;
let intervaloPollling = null;

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

    // Opcional: Si necesitas hacer algo más inmediatamente cuando el slider cambia, hazlo aquí.
    console.log("Nuevo RADIO_PUNTO_CONTROL:", RADIO_PUNTO_CONTROL);
});

// FUNCIÓN NUEVA: Para llenar el selector de rutas con las opciones del backend
async function cargarRutasDisponiblesEnSelector() {
  const selectorRuta = document.getElementById("select-ruta");

  // Limpiar opciones existentes (excepto la primera "Seleccione una ruta")
  while (selectorRuta.options.length > 1) {
    selectorRuta.remove(1);
  }

  try {
    const res = await fetch("https://navigationasistance-backend-1.onrender.com/rutas/listarSimples"); // Este endpoint debería listar todas tus rutas
    const rutasDisponibles = await res.json();

    rutasDisponibles.forEach((ruta) => {
      if (ruta.color === "REGATA") {
        const opt = document.createElement("option");
        opt.value = ruta.id; // Asume que el ID de la ruta está en 'ruta.id'
        opt.textContent = `Ruta ${ruta.id} - ${ruta.nombre}`;
        selectorRuta.appendChild(opt);
      }
    });
  } catch (e) {
    console.error("❌ Error al cargar rutas disponibles en el selector:", e);
    alert("❌ Error al cargar la lista de rutas disponibles.");
  }
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
  const colorUsuario = obtenerColorUsuario(usuarioid);

  console.log("🔍 Nombre icono:", iconUrl);

  return L.icon({
    iconUrl: iconUrl,
    iconSize: [40, 40],             // Ajusta el tamaño si es necesario para tus íconos de barco
    iconAnchor: [20, 20],           // La punta inferior central del icono
    popupAnchor: [0, -16],           // Para que el popup salga justo arriba
    className: `barco-icon barco-icon-${usuarioid.replace(/[^a-zA-Z0-9]/g, '_')}`
  });
}

async function cargarNavegantesVinculados() {
  try {
    const response = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listarActivosEnCarrera");
    const nadadores = await response.json();
    if (nadadores.length === 0) historialPuntos = new Map(); // ✅ limpia los popups si no hay nadie

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

      // ⚠️ Verificar coordenadas válidas
      if (isNaN(lat) || isNaN(lng)) {
        console.warn(`❌ Coordenadas inválidas para usuario ${n.usuarioid}:`, n);
        return;
      }

      // 🚨 MANEJO DE EMERGENCIAS - Seleccionar el icono apropiado
      let icono;
      if (n.emergency === true) {
        icono = L.icon({
          iconUrl: 'img/marker-emergencia-36x39.png',
          iconSize: [36, 39],
          iconAnchor: [18, 39],
          className: 'icono-emergencia'
        });

        // 🔊 Reproducir sonido de emergencia
        if (sirenaAudio.paused) {
          sirenaAudio.play().catch(e => console.warn("No se pudo reproducir la sirena:", e));
        }
      } else {
        // ✅ CORRECTO: Usar icono normal con bearing
        icono = crearIconoCompetidorConBearing(bearing, n.usuarioid);

        // Aplicar color después de crear el marcador
        const colorUsuario = obtenerColorUsuario(n.usuarioid);
        setTimeout(() => aplicarColorIcono(n.usuarioid, colorUsuario), 200);

      }

      const marcador = L.marker([lat, lng], {
        icon: icono // <-- ¡Usar la variable icono!
      }).addTo(map)
        .bindPopup(`🧍 Usuario: ${n.usuarioid}<br>🕓 ${n.fechaUltimaActualizacion}`);

      marcadores.set(String(n.usuarioid), marcador); // 👈 almacenamos por clave

      // Crear popup inicial vacío (o solo con usuario)
      marcador.bindPopup(generarContenidoPopup(n.usuarioid));

      // 🔥 Cargar puntos históricos desde el backend
      actualizarPopup(n.usuarioid);

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

function generarContenidoPopup(usuarioid, datosUsuario = {}) {
  const historial = historialPuntos.get(usuarioid) || [];
  const listaHtml = historial.map(p =>
    `<li>${p.etiqueta} <small>${new Date(p.fechaHora).toLocaleTimeString()}</small></li>`
  ).join("");

  // Determinar el texto del botón según el estado actual
  const esTrazaActiva = usuarioTrazaActiva === usuarioid;
  const textoBoton = esTrazaActiva ? "🔴 Desactivar Traza" : "🟢 Activar Traza";
  const colorBoton = esTrazaActiva ? "#e74c3c" : "#27ae60";

  // Obtener nombre del usuario si está disponible
  const nombreCompleto = datosUsuario.nombre ?
    `${datosUsuario.nombre} ${datosUsuario.apellido || ""}` :
    `Usuario ${usuarioid}`;

  // 🎨 NUEVO: Obtener color del usuario para mostrar en el popup
  //const colorUsuario = obtenerColorUsuario(usuarioid);

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

// Función GLOBAL para manejar toggle de traza desde el popup
window.toggleTrazaDesdePopup = function(usuarioid) {
  console.log(`🎯 Toggle traza para usuario: ${usuarioid}`);

  if (usuarioTrazaActiva === usuarioid) {
    // Desactivar traza actual
    borrarTraza();
    usuarioTrazaActiva = null;
    detenerActualizacionMetricas(); // ← AGREGAR ESTA LÍNEA
    console.log("❌ Traza desactivada");
  } else {
    // Activar traza para este usuario
    usuarioTrazaActiva = usuarioid;

    // Actualizar selector de usuario para que coincida
    //const selector = document.getElementById("selector-usuario");
    //if (selector) {
    //  selector.value = usuarioid;
    //}

    // Trazar ruta
    iniciarActualizacionMetricas(usuarioid); // ← AGREGAR ESTA LÍNEA
    trazarRutaUsuarioEspecifico(usuarioid);
    console.log(`✅ Traza activada para usuario: ${usuarioid}`);
  }

  // Actualizar todos los popups para reflejar el nuevo estado
  actualizarTodosLosPopups();
};

// Función específica para trazar ruta de un usuario específico
async function trazarRutaUsuarioEspecifico(usuarioId) {
  mostrarTraza = true;
  const hoy = new Date().toISOString().split("T")[0];

  try {
    const resUuid = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ultimorecorrido/${usuarioId}/${hoy}`);
    const uuidList = await resUuid.json();

    if (!uuidList || uuidList.length === 0) {
      console.log("❌ No hay recorridos registrados hoy para el usuario: " + usuarioId);
      alert("❌ No hay recorridos registrados hoy para este usuario.");
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
      //alert("❌ La ruta no contiene puntos válidos.");
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
    //alert("⚠️ Error al trazar la ruta del usuario.");
  }
}

// Función para actualizar todos los popups
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

// Acumulador visual: usuarioid => array de { etiqueta, fechaHora }
let historialPuntos = new Map();

async function actualizarPopup(usuarioid) {
  try {
    // 1. Traer los puntos de control del usuario
    console.log(`🔄 Actualizando popup para usuario: ${usuarioid}`);
    const res = await fetch(`https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/listarPorNadadorrutaId/${usuarioid}`);
    const historial = await res.json();

    if (!Array.isArray(historial)) {
      console.warn(`⚠️ El historial no es un array para ${usuarioid}:`, historial);
      return;
    }

    // 👈 AGREGAR ESTA LÍNEA después de obtener el historial:
    historialPuntos.set(usuarioid, historial.map(p => ({
      etiqueta: p.puntoControl || "❓(sin etiqueta)",
      fechaHora: p.fechaHora
    })));

    // 2. Traer nombre y apellido del usuario
    const resUsuario = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${usuarioid}`);
    const usuario = await resUsuario.json();

    const nombreCompleto = `${usuario.nombre || "Nombre"} ${usuario.apellido || "Apellido"}`;

    // 3. Generar lista de puntos
    const listaHtml = historial.map(p => {
      const etiqueta = p.puntoControl || "❓(sin etiqueta)";
      let hora = "⏱️ (sin hora)";

      if (p.fechaHora) {
        const fecha = new Date(p.fechaHora);
        if (!isNaN(fecha)) {
          hora = fecha.toLocaleTimeString(); // o .toLocaleString() si querés la fecha completa
        } else {
          console.warn(`⛔ Fecha inválida para ${usuarioid}:`, p.fechaHora);
        }
      }

      return `<li>${etiqueta} <small>${hora}</small></li>`;
    }).join("");

    // 4. Contenido del popup
    const popupHtml = generarContenidoPopup(usuarioid, usuario);

    // 5. Actualizar popup en el marcador correspondiente
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

      console.log(`📏 Distancia para ${usuarioid} al punto "${punto.etiqueta}": ${distancia.toFixed(2)}m`); // <-- AÑADE ESTO

      if (distancia < RADIO_PUNTO_CONTROL) {

        const payload = {
          nadadorrutaId: usuarioid, // 👈 ahora como String plano
          puntoControl: punto.etiqueta,
          fechaHora: new Date().toISOString(),
          rutaId: punto.rutaId // <--- USAR ESTO
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

//async function cargarUsuariosEnSelector() {
//  const res = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorrutas/listar");
//  const relaciones = await res.json();
//  const selector = document.getElementById("selector-usuario");

//  for (const rel of relaciones) {
//    try {
//      const resUsuario = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${rel.usuarioId}`);
//      const usuario = await resUsuario.json();

//      const option = document.createElement("option");
//      option.value = rel.usuarioId; // 👈 Se guarda el usuarioId
//      option.textContent = `${rel.usuarioId} - ${usuario.nombre} ${usuario.apellido}`;
//      selector.appendChild(option);
//    } catch (err) {
//      console.warn(`❌ No se pudo obtener info para usuario ${rel.usuarioId}:`, err);
//    }
//  }
//}

async function cargarRutas(idRuta) {
  try {
    const res = await fetch(`https://navigationasistance-backend-1.onrender.com/rutas/listarId/${idRuta}`);
    const ruta = await res.json(); // 'ruta' ya es el objeto de la ruta

    // No hay forEach aquí, procesamos 'ruta' directamente
    const titulo = document.createElement("h2");
    titulo.innerText = ruta.nombre;
    titulo.style.color = "white";
    titulo.style.fontSize = "1.5em";
    titulo.style.textShadow = "1px 1px 3px black";
    document.body.insertBefore(titulo, document.getElementById("map"));

    const puntos = ruta.puntos;
    if (!puntos || puntos.length === 0) return;

    const bounds = [];

    puntos.forEach((p, i) => { // Este forEach es para los 'puntos' dentro de la 'ruta'
      const latlng = [p.latitud, p.longitud];
      bounds.push(latlng);

      console.log("🧩 Punto recibido:", p);

      if (typeof puntosControl === 'undefined') {
          console.warn("puntosControl no está definido. Asegúrate de declararlo.");
      }

      puntosControl.push({
        latitud: p.latitud,
        longitud: p.longitud,
        etiqueta: p.etiqueta || `Punto ${i + 1}`,
        nadadorruta_id: p.nadadorruta_id,
        rutaId: idRuta // <--- AÑADIR ESTO
      });

      // ✅ Círculo sombreado para marcar el radio de 20 metros del punto de control
      const controlPointRadius = L.circle(latlng, {
        radius: RADIO_PUNTO_CONTROL,          // Radio en metros (coincide con tu lógica de 20m)
        color: 'blue',       // Color del borde del círculo
        fillColor: '#3388ff',// Color de relleno (un azul más claro)
        fillOpacity: 0.2,    // Transparencia del relleno (0.2 es bastante transparente)
        weight: 1            // Grosor del borde
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

let polylineTraza = null;

function borrarTraza() {
  mostrarTraza = false; // ✅ desactiva el redibujo
  usuarioTrazaActiva = null; // 👈 AGREGAR ESTA LÍNEA

  if (polylineTraza) {
    map.removeLayer(polylineTraza);
    polylineTraza = null;
  }

  // 👈 AGREGAR ESTA LÍNEA:
    setTimeout(() => actualizarTodosLosPopups(), 100);

}

// Función para calcular distancia entre dos puntos (Haversine)
function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distancia en metros
}

// Función para convertir metros a millas náuticas
function metrosAMillasNauticas(metros) {
    return metros / 1852;
}

// Función para calcular velocidad en nudos
function calcularVelocidadNudos(distanciaMetros, tiempoSegundos) {
    if (tiempoSegundos === 0) return 0;
    const velocidadMs = distanciaMetros / tiempoSegundos;
    const velocidadNudos = velocidadMs * 1.94384; // m/s a nudos
    return velocidadNudos;
}

// Función para actualizar el panel de métricas (simplificada)
function actualizarMetricas(metricas) {
    if (!metricas || metricas.totalPuntos === 0) {
        mostrarSinDatos();
        return;
    }

    // Actualizar cada métrica
    actualizarBearing(metricas.bearing);
    actualizarDistancia(metricas.millasNauticas);
    actualizarVelocidad(metricas.velocidadNudos);

    // Log para debugging
    console.log(`📊 Métricas actualizadas: Bearing: ${metricas.bearing}°, Distancia: ${metricas.millasNauticas.toFixed(2)} mn, Velocidad: ${metricas.velocidadNudos.toFixed(1)} nudos`);
}

// Funciones para actualizar cada métrica individualmente
function actualizarBearing(bearing) {
    const bearingElement = document.getElementById('bearing-value');
    const needleElement = document.getElementById('bearing-needle');

    bearingElement.textContent = bearing.toFixed(0) + '°';
    bearingElement.classList.add('actualizado');
    setTimeout(() => bearingElement.classList.remove('actualizado'), 400);

    // Rotar la aguja de la brújula
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

// Función para obtener datos históricos usando tus endpoints reales
async function obtenerDatosHistoricos(usuarioId) {
    try {
        const hoy = new Date().toISOString().split("T")[0];

        // 🔹 Paso 1: Obtener último recorrido UUID (igual que en tu código)
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

        // 🔹 Paso 2: Obtener puntos del recorrido (igual que en tu código)
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

        // 🔹 Paso 3: Ordenar puntos por tiempo (igual que en tu código)
        puntos.sort((a, b) => {
            const fechaHoraA = new Date(`${a.nadadorfecha}T${a.nadadorhora.split('T')[1]}`);
            const fechaHoraB = new Date(`${b.nadadorfecha}T${b.nadadorhora.split('T')[1]}`);

            if (fechaHoraA.getTime() === fechaHoraB.getTime()) {
                return Number(a.secuencia) - Number(b.secuencia);
            }
            return fechaHoraA.getTime() - fechaHoraB.getTime();
        });

        // 🔹 Paso 4: Filtrar puntos válidos
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

// Función específica para obtener métricas en tiempo real
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

        // 🎯 OBTENER BEARING DE LA POSICIÓN ACTIVA (MÁS ACTUAL)
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

        // Último punto (más reciente por tiempo)
        const ultimoPunto = datos[datos.length - 1];

        // Calcular distancia total
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

        // Calcular velocidad (últimos 3-5 puntos para suavizar)
        let velocidadNudos = 0;
        if (datos.length >= 3) {
            // Usar más puntos para calcular velocidad promedio
            const puntosParaVelocidad = datos.slice(-5); // Últimos 5 puntos
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
            bearing: bearingActual, // 🎯 USAR BEARING ACTUAL
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

// Función para iniciar el polling de datos
function iniciarActualizacionMetricas(usuarioId) {
    if (intervaloPollling) {
        clearInterval(intervaloPollling);
    }

    // AGREGAR ESTAS LÍNEAS:
    fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${usuarioId}`)
        .then(res => res.json())
        .then(usuario => {
            actualizarUsuario(usuarioId, `${usuario.nombre} ${usuario.apellido}`);
        })
        .catch(() => actualizarUsuario(usuarioId, null));

    // Actualización inmediata
    actualizarDatos(usuarioId);

    // Actualización cada 5 segundos
    intervaloPollling = setInterval(() => {
        actualizarDatos(usuarioId);
    }, 5000);
}

async function actualizarDatos(usuarioId) {
    const panel = document.getElementById('panel-metricas');
    panel.classList.add('panel-updating');

    try {
        // Usar la nueva función que calcula métricas directamente
        const metricas = await obtenerMetricasUsuario(usuarioId);
        actualizarMetricas(metricas);
    } catch (error) {
        console.error('❌ Error actualizando métricas:', error);
        mostrarSinDatos();
    } finally {
        setTimeout(() => panel.classList.remove('panel-updating'), 300);
    }
}

// Función para detener el polling
function detenerActualizacionMetricas() {
    if (intervaloPollling) {
        clearInterval(intervaloPollling);
        intervaloPollling = null;
    }
    mostrarSinDatos();
}


// Función principal para cargar información del viento
async function cargarViento(lat, lon) {
    try {
        const url = `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${lat},${lon}&aqi=no`;
        const res = await fetch(url);

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        // Extraer datos del viento
        const kph = data.current.wind_kph;
        const kn = kph * 0.539957; // kph -> nudos
        const deg = data.current.wind_degree; // 0..359
        const dirTxt = data.current.wind_dir; // N, NE, E, ...
        const gustKph = data.current.gust_kph || 0;
        const gustKn = gustKph * 0.539957;

        // Actualizar panel
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

// Función para crear icono de flecha de viento
function iconoFlecha(deg, velocidad) {
    // Color basado en velocidad del viento
    let color = '#2196F3'; // Azul por defecto
    if (velocidad > 25) color = '#f44336'; // Rojo para vientos fuertes
    else if (velocidad > 15) color = '#ff9800'; // Naranja para vientos moderados
    else if (velocidad > 8) color = '#4caf50'; // Verde para vientos suaves

    return L.divIcon({
        className: "wind-arrow",
        html: `<div style="transform: rotate(${deg}deg); color: ${color};">⇧</div>`,
        iconSize: [50, 50],
        iconAnchor: [20, 20]
    });
}

// Función para agregar capa de viento al mapa
async function agregarCapaViento(mapa, puntos) {
    try {
        // Mostrar indicador de carga
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

                // Delay para no saturar la API
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

// Función para toggle de la capa de viento
async function toggleCapaViento() {
    const btn = document.getElementById("toggle-viento");

    if (vientoVisible) {
        // Ocultar capa de viento
        if (capaViento) {
            map.removeLayer(capaViento);
            capaViento = null;
        }
        vientoVisible = false;
        btn.textContent = "🌬️ Mostrar Viento";
        btn.classList.remove('activo');
        console.log("🌬️ Capa de viento oculta");

    } else {
        // Mostrar capa de viento
        btn.classList.add('activo');

        // Definir puntos donde mostrar viento
        const puntosViento = [
            { lat: -34.9630725, lon: -54.9417927, nombre: "Navegante Principal" }
        ];

        // Agregar puntos de control si existen
        if (puntosControl && puntosControl.length > 0) {
            puntosControl.forEach(p => {
                puntosViento.push({
                    lat: p.latitud,
                    lon: p.longitud,
                    nombre: p.etiqueta
                });
            });
        }

        // Agregar algunos puntos adicionales en el área
        puntosViento.push(
            { lat: -34.95, lon: -54.95, nombre: "Norte" },
            { lat: -34.97, lon: -54.93, nombre: "Sur" },
            { lat: -34.96, lon: -54.92, nombre: "Este" },
            { lat: -34.96, lon: -54.96, nombre: "Oeste" }
        );

        capaViento = await agregarCapaViento(map, puntosViento);

        if (capaViento) {
            capaViento.addTo(map);
            vientoVisible = true;
            btn.textContent = "🌬️ Ocultar Viento";
            console.log("✅ Capa de viento mostrada");
        } else {
            btn.textContent = "🌬️ Error Viento";
            btn.classList.remove('activo');
        }
    }
}


// Función para iniciar el sistema de viento
function iniciarSistemaViento() {
    console.log("🌬️ Iniciando sistema de viento...");

    // Carga inicial
    cargarViento(COORD_REFERENCIA.lat, COORD_REFERENCIA.lng);

    // Actualizar cada 5 minutos (300,000 ms)
    intervalViento = setInterval(() => {
        // Usar coordenadas del navegante activo si está disponible
        let coords = COORD_REFERENCIA;

        if (marcadores.size > 0) {
            const primerMarcador = marcadores.values().next().value;
            if (primerMarcador) {
                const latlng = primerMarcador.getLatLng();
                coords = { lat: latlng.lat, lng: latlng.lng };
            }
        }

        cargarViento(coords.lat, coords.lng);

        // Si la capa de viento está visible, actualizarla también
        if (vientoVisible && capaViento) {
            console.log("🔄 Actualizando capa de viento...");
            // Recrear la capa
            map.removeLayer(capaViento);
            capaViento = null;
            vientoVisible = false;
            setTimeout(() => toggleCapaViento(), 1000);
        }

    }, 5 * 60 * 1000); // 5 minutos

    console.log("✅ Sistema de viento iniciado (actualización cada 5 min)");
}

document.addEventListener("DOMContentLoaded", () => {

  cargarRutas("52");
  cargarNavegantesVinculados();
  iniciarSistemaViento();

  setInterval(cargarNavegantesVinculados, 5000);

  setInterval(() => {
    if (!mostrarTraza || !usuarioTrazaActiva) return;
      trazarRutaUsuarioEspecifico(usuarioTrazaActiva);
  }, 5000);
});