const map = L.map("map").setView([-34.9, -56.1], 13);

const RADIO_PUNTO_CONTROL = 20;

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

// Íconos personalizados
const iconoInicio = L.icon({ iconUrl: 'img/start_flag.png', iconSize: [32, 32] });
const iconoIntermedio = L.icon({ iconUrl: 'img/white_flag.png', iconSize: [24, 24] });
const iconoFinal = L.icon({ iconUrl: 'img/finish_flag.png', iconSize: [32, 32] });

let marcadores = new Map(); //let marcadores = []; // ⬅️ Para limpiar luego los círculos de competidores
let puntosControl = []; // guardará todos los puntos
let registrosHechos = new Set(); // para evitar múltiples registros del mismo punto
let mostrarTraza = false;

async function cargarRutas(idRuta) { // Se añade idRuta como parámetro
  try {
    // Se inserta el idRuta en la URL del endpoint

    const res = await fetch(`https://navigationasistance-backend-1.onrender.com/rutas/listarId/${idRuta}`);
    const rutas = await res.json();

    const titulo = document.createElement("h2");
    titulo.innerText = ruta.nombre;
    titulo.style.color = "white";
    titulo.style.fontSize = "1.5em";
    titulo.style.textShadow = "1px 1px 3px black";
    document.body.insertBefore(titulo, document.getElementById("map"));

    rutas.forEach(ruta => {
   
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
          nadadorruta_id: p.nadadorruta_id, // 👈 asegurate que este campo venga en el JSON
          rutaId: idRuta // <--- ¡AQUÍ ES DONDE DEBE IR! DENTRO DEL OBJETO.
        });

        // Círculo del color de la ruta
        L.circle(latlng, {
          radius: 5,
          color: 'rgba(255, 255, 0, 0.5)',
          fillColor: 'rgba(255, 255, 0, 0.5)',
          fillOpacity: 1
        }).addTo(map);

        // Ícono correspondiente
        let icon = iconoIntermedio;
        if (i === 0) icon = iconoInicio;
        else if (i === puntos.length - 1) icon = iconoFinal;

        L.marker(latlng, { icon })
          .addTo(map)
          .bindPopup(`Etiqueta: ${p.etiqueta}<br>Lat: ${p.latitud}<br>Lng: ${p.longitud}`);
      });

      // ✅ AÑADIDO: revisar que los puntos tengan nadadorruta_id
      console.log("🧭 puntosControl cargados:", puntosControl);

      map.fitBounds(bounds);
    });

  } catch (err) {
    console.error("Error al cargar rutas:", err);
  }
}

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

function crearIconoCompetidorConBearing(bearing) {
  // Asegurarse de que el bearing esté entre 0 y 359
  let normalizedBearing = bearing % 360;
  if (normalizedBearing < 0) {
    normalizedBearing += 360;
  }

  // Redondear al múltiplo de 10 más cercano
  // Math.round(normalizedBearing / 10) * 10
  // Si tenemos 5, queremos 0; si tenemos 6, queremos 10.
  // 5 grados => 000, 15 grados => 010
  let iconAngle = Math.round(normalizedBearing / 10) * 10;
  if (iconAngle === 360) { // Manejo especial para 360 grados, que es 000
    iconAngle = 0;
  }

  // Formatear el número con ceros a la izquierda (ej: 000, 010, 350)
  const paddedAngle = String(iconAngle).padStart(3, '0');
  const iconUrl = `/img/barco_bearing_icons/barco_${paddedAngle}.png`;

  console.log("🔍 Nombre icono:", iconUrl);

  return L.icon({
    iconUrl: iconUrl,
    iconSize: [32, 32],             // Ajusta el tamaño si es necesario para tus íconos de barco
    iconAnchor: [16, 16],           // La punta inferior central del icono
    popupAnchor: [0, -16]           // Para que el popup salga justo arriba
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

      // ✅ CORRECTO: Llamada directa a crearIconoCompetidorConBearing
      const marcador = L.marker([lat, lng], {
        icon: crearIconoCompetidorConBearing(bearing) // <-- ¡Aquí se usa directamente!
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

function generarContenidoPopup(usuarioid) {
  const historial = historialPuntos.get(usuarioid) || [];
  const listaHtml = historial.map(p =>
    `<li>${p.etiqueta} <small>${new Date(p.fechaHora).toLocaleTimeString()}</small></li>`
  ).join("");

  return `
    <strong>Usuario: ${usuarioid}</strong><br/>
    Puntos de control:<br/>
    <ul>${listaHtml}</ul>
  `;
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
    const popupHtml = `
          <strong>${nombreCompleto}</strong><br/>
          Puntos de control:<br/>
          <ul>${listaHtml}</ul>
        `;

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

async function cargarUsuariosEnSelector() {
  const res = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorrutas/listar");
  const relaciones = await res.json();
  const selector = document.getElementById("selector-usuario");

  for (const rel of relaciones) {
    try {
      const resUsuario = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${rel.usuarioId}`);
      const usuario = await resUsuario.json();

      const option = document.createElement("option");
      option.value = rel.usuarioId; // 👈 Se guarda el usuarioId
      option.textContent = `${rel.usuarioId} - ${usuario.nombre} ${usuario.apellido}`;
      selector.appendChild(option);
    } catch (err) {
      console.warn(`❌ No se pudo obtener info para usuario ${rel.usuarioId}:`, err);
    }
  }
}

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

async function trazarRutaUsuario() {
  mostrarTraza = true; // ✅ activar la traza manualmente

  const usuarioId = document.getElementById("selector-usuario").value;
  const hoy = new Date().toISOString().split("T")[0];

  if (!usuarioId) {
    alert("❗ Debe seleccionar un usuario.");
    return;
  }

  try {
    // 🔹 Obtener último recorrido UUID
    const resUuid = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ultimorecorrido/${usuarioId}/${hoy}`);
    const uuidList = await resUuid.json();

    if (!uuidList || uuidList.length === 0) {
      alert("❌ No hay recorridos registrados hoy para este usuario.");
      return;
    }

    const ultimaRuta = uuidList[0]; // solo uno, ya viene ordenado y limitado en el backend

    // 🔹 Obtener puntos del recorrido
    const res = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ruta/${ultimaRuta}`);
    let puntos = await res.json();

    // ✅ ¡ESTA ES LA MODIFICACIÓN CLAVE EN EL FRONTEND!
    // Ordenar los puntos por fecha y hora para garantizar la cronología
    puntos.sort((a, b) => {
        // Combinar fecha y hora para una comparación precisa de tiempo
        const fechaHoraA = new Date(`${a.nadadorfecha}T${a.nadadorhora.split('T')[1]}`);
        const fechaHoraB = new Date(`${b.nadadorfecha}T${b.nadadorhora.split('T')[1]}`);

        if (fechaHoraA.getTime() === fechaHoraB.getTime()) {
            // Si las horas son idénticas, usa la secuencia como desempate
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
      alert("❌ La ruta no contiene puntos válidos.");
      return;
    }

    // 🔹 Eliminar traza anterior si existe
    console.log("Estado de polylineTraza antes de eliminar:", polylineTraza);
    if (polylineTraza) {
        map.removeLayer(polylineTraza);
        console.log("polylineTraza eliminada del mapa.");
    }
    console.log("Nuevo polylineTraza asignado:", polylineTraza); // Después de L.polyline(...)

    // 🔹 Dibujar nueva traza
    polylineTraza = L.polyline(latlngs, {
      color: 'yellow',
      weight: 3,

      dashArray: '10, 10'
    }).addTo(map);

    //map.fitBounds(polylineTraza.getBounds());

  } catch (err) {
    console.error("❌ Error al trazar ruta:", err);
    alert("⚠️ Error inesperado al intentar trazar la ruta.");
  }
}

function borrarTraza() {
  mostrarTraza = false; // ✅ desactiva el redibujo

  if (polylineTraza) {
    map.removeLayer(polylineTraza);
    polylineTraza = null;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const selectorRuta = document.getElementById("select-ruta");
  cargarRutasDisponiblesEnSelector(); // <-- LLAMA A LA NUEVA FUNCIÓN AQUÍ PARA LLENAR EL SELECTOR DE RUTAS
  // 2. **ESTO ES LO CLAVE:** Añadir el escuchador de eventos para el selector de rutas
  selectorRuta.addEventListener('change', (event) => {
    const idRutaSeleccionada = event.target.value;
    // LLAMA A TU FUNCIÓN EXISTENTE 'cargarRutas' CON EL ID SELECCIONADO
    cargarRutas(idRutaSeleccionada);
    //cargarRutas("46");
  });
  cargarNavegantesVinculados();
  cargarUsuariosEnSelector();

  setInterval(cargarNavegantesVinculados, 5000);

  // ⏺️ Vincular botón de traza
  const boton = document.getElementById("boton-traza");
  if (boton) {
    boton.addEventListener("click", trazarRutaUsuario);
  } else {
    console.warn("⚠️ No se encontró el botón 'boton-traza'. ¿Está definido en el HTML?");
  }

  const botonBorrar = document.getElementById("boton-borrar-traza");
  if (botonBorrar) {
    botonBorrar.addEventListener("click", borrarTraza);
  } else {
    console.warn("⚠️ No se encontró el botón 'boton-borrar-traza'.");
  }

  // ⏱️ Actualizar traza automáticamente si hay usuario seleccionado
  setInterval(() => {
    if (!mostrarTraza) return; // 🛑 NO hacer nada si no está activo

    const selector = document.getElementById("selector-usuario");
    const usuarioId = selector?.value;
    if (usuarioId && usuarioId !== "Seleccione un usuario") {
      trazarRutaUsuario();
    }
  }, 5000);
});

