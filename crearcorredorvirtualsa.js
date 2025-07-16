// crearcorredorvirtualsa.js

let zonaSeleccionada = null;
let mapaRuta = null;
let mapaFinal = null;
let puntosRuta = [];
let marcadoresRuta = [];
let polyline = null;

// Inicialización
window.onload = () => {
  cargarZonas();
  initMapaRuta();
  initMapaFinal();
};

function showTab(index) {
  document.querySelectorAll('.tab-button').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });
  document.querySelectorAll('.tab-content').forEach((tab, i) => {
    tab.classList.toggle('active', i === index);
  });
}

function irASolapa(index) {
  showTab(index);

  if (index === 1 && zonaSeleccionada) {
    centrarMapaEnZona(zonaSeleccionada);
    setTimeout(() => mapaRuta.invalidateSize(), 300);
  }

  if (index === 3) {
    centrarMapaFinalEnZona(zonaSeleccionada);
    setTimeout(() => {
      mapaFinal.invalidateSize();
      dibujarCorredorVirtual();

      const ancho = document.getElementById('anchoCorredor').value;
      const distancia = document.getElementById('puntosControl').value;
      const zona = zonaSeleccionada || "Desconocida";

      document.getElementById('infoSeteos').innerHTML = `
        🧭 Zona seleccionada: <strong>${zona}</strong><br/>
        📏 Ancho del corredor: <strong>${ancho} m</strong><br/>
        📍 Distancia entre puntos de control: <strong>${distancia} m</strong>
      `;
    }, 300);
  }
}

function actualizarLabel(id, valor) {
  document.getElementById(id).textContent = valor;
}

function habilitarSiguienteZona() {
  const select = document.getElementById("zonaSelect");
  zonaSeleccionada = (select.value || "").trim();
  document.getElementById("btnSiguiente1").disabled = !zonaSeleccionada;
}

function cargarZonas() {
  fetch('https://navigationasistance-backend-1.onrender.com/zonas/listar')
    .then(res => res.json())
    .then(zonas => {
      const select = document.getElementById('zonaSelect');
      select.innerHTML = '<option value="">-- Seleccionar --</option>';
      zonas.forEach(z => {
        const option = document.createElement('option');
        option.value = z.zona;
        option.textContent = `${z.zona} - ${z.nomo} a ${z.nomd}`;
        select.appendChild(option);
      });
    });
}

function agregarZona() {
  alert("🔧 Funcionalidad Agregar Zona en construcción.");
}
function modificarZona() {
  alert("🔧 Funcionalidad Modificar Zona en construcción.");
}
function eliminarZona() {
  alert("🔧 Funcionalidad Eliminar Zona en construcción.");
}

function initMapaRuta() {
  mapaRuta = L.map('map1').setView([-34.9, -56.2], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(mapaRuta);

  let timeout = null;
  mapaRuta.on('click', function (e) {
    const { lat, lng } = e.latlng;
    const marcador = L.marker([lat, lng]).addTo(mapaRuta);
    marcadoresRuta.push(marcador);
    puntosRuta.push([lat, lng]);

    marcador.bindPopup(`
      <div>
        ¿Este es el punto final?<br/>
        <button onclick="confirmarPuntoFinal()">Sí</button>
        <button onclick="cerrarPopup()">No</button>
      </div>
    `, { closeOnClick: false }).openPopup();

    marcador.on('mousedown', () => {
      timeout = setTimeout(() => {
        mapaRuta.removeLayer(marcador);
        puntosRuta = puntosRuta.filter(p => !(p[0] === lat && p[1] === lng));
        marcadoresRuta = marcadoresRuta.filter(m => m !== marcador);
        if (polyline) mapaRuta.removeLayer(polyline);
        polyline = L.polyline(puntosRuta, { color: 'red' }).addTo(mapaRuta);
      }, 2000);
    });

    marcador.on('mouseup', () => clearTimeout(timeout));

    if (polyline) mapaRuta.removeLayer(polyline);
    polyline = L.polyline(puntosRuta, { color: 'red' }).addTo(mapaRuta);
  });
}

function confirmarPuntoFinal() {
  document.getElementById('btnSiguiente2').disabled = false;
  alert("✅ Ruta definida. Puede continuar.");
  mapaRuta.closePopup(); // cerrar cualquier popup abierto
}

function cerrarPopup() {
  mapaRuta.closePopup(); // simplemente cierra el popup y permite seguir
}

function finalizarRuta() {
  document.getElementById('btnSiguiente2').disabled = false;
  alert("✅ Ruta definida. Puede continuar.");
}

function centrarMapaEnZona(zonaRaw) {
  const zona = zonaRaw.trim();

  fetch(`https://navigationasistance-backend-1.onrender.com/zonas/listarZona/${encodeURIComponent(zona)}`)
    .then(res => res.json())
    .then(data => {
      const z = Array.isArray(data) ? data[0] : data;

      const latRaw = z?.lato ?? '';
      const lngRaw = z?.lngo ?? '';

      const lat = parseFloat(latRaw.trim());
      const lng = parseFloat(lngRaw.trim());

      if (!isNaN(lat) && !isNaN(lng)) {
        mapaRuta.setView([lat, lng], 16);
        setTimeout(() => mapaRuta.invalidateSize(), 300);
      } else {
        console.error("❌ Coordenadas inválidas:", latRaw, lngRaw);
      }
    })
    .catch(err => {
      console.error("❌ Error al obtener zona:", err);
    });
}

function centrarMapaFinalEnZona(zonaRaw) {
  const zona = zonaRaw.trim();

  fetch(`https://navigationasistance-backend-1.onrender.com/zonas/listarZona/${encodeURIComponent(zona)}`)
    .then(res => res.json())
    .then(data => {
      const z = Array.isArray(data) ? data[0] : data;
      const lat = parseFloat(z.lato.trim());
      const lng = parseFloat(z.lngo.trim());

      if (!isNaN(lat) && !isNaN(lng)) {
        // AHORA SÍ: centramos y redimensionamos correctamente
        setTimeout(() => {
          mapaFinal.setView([lat, lng], 16);
          mapaFinal.invalidateSize();
        }, 300);
      } else {
        console.error("❌ Coordenadas inválidas:", z.lato, z.lngo);
      }
    })
    .catch(err => {
      console.error("❌ Error al centrar mapa final:", err);
    });
}

function initMapaFinal() {
  mapaFinal = L.map('map2').setView([-34.9, -56.2], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(mapaFinal);
}

function dibujarCorredorVirtual() {
  if (!mapaFinal || puntosRuta.length < 2) {
    console.warn("⚠️ No hay suficientes puntos para generar el corredor virtual.");
    return;
  }

  mapaFinal.eachLayer(l => {
    if (l instanceof L.Polyline || l instanceof L.Marker) mapaFinal.removeLayer(l);
  });

  const ancho = parseFloat(document.getElementById('anchoCorredor').value);
  const offset = ancho / 2;

  const izq = [], der = [];
  const normales = [];

  // Paso 1: calcular normales por segmento
  for (let i = 0; i < puntosRuta.length - 1; i++) {
    const [lat1, lon1] = puntosRuta[i];
    const [lat2, lon2] = puntosRuta[i + 1];

    const dx = lat2 - lat1;
    const dy = lon2 - lon1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len;
    const ny = dx / len;

    normales.push([nx, ny]);
  }

  // Paso 2: aplicar normales promediadas en cada punto
  for (let i = 0; i < puntosRuta.length; i++) {
    let nx = 0, ny = 0;

    if (i > 0) {
      nx += normales[i - 1][0];
      ny += normales[i - 1][1];
    }

    if (i < normales.length) {
      nx += normales[i][0];
      ny += normales[i][1];
    }

    // normalizar
    const len = Math.sqrt(nx * nx + ny * ny);
    if (len !== 0) {
      nx /= len;
      ny /= len;
    }

    const offsetLat = nx * offset * 0.00001;
    const offsetLon = ny * offset * 0.00001;

    izq.push([puntosRuta[i][0] + offsetLat, puntosRuta[i][1] + offsetLon]);
    der.push([puntosRuta[i][0] - offsetLat, puntosRuta[i][1] - offsetLon]);
  }

  const lineaCentral = L.polyline(puntosRuta, { color: 'red' }).addTo(mapaFinal);
  L.polyline(izq, { color: 'blue', dashArray: '5, 5' }).addTo(mapaFinal);
  L.polyline(der, { color: 'blue', dashArray: '5, 5' }).addTo(mapaFinal);

  // 📌 Centramos la vista
  mapaFinal.setView(puntosRuta[0], 16);

  // 🏁 Agregar marcadores con íconos
  const iconoInicio = L.icon({
    iconUrl: 'img/start_flag.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });

  const iconoIntermedio = L.icon({
    iconUrl: 'img/white_flag.png',
    iconSize: [28, 28],
    iconAnchor: [14, 28]
  });

  const iconoFin = L.icon({
    iconUrl: 'img/finish_flag.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });

  // Punto de inicio
  L.marker(puntosRuta[0], { icon: iconoInicio }).addTo(mapaFinal);

  // Puntos intermedios
  for (let i = 1; i < puntosRuta.length - 1; i++) {
    L.marker(puntosRuta[i], { icon: iconoIntermedio }).addTo(mapaFinal);
  }

  // Punto final
  const lastIndex = puntosRuta.length - 1;
  L.marker(puntosRuta[lastIndex], { icon: iconoFin }).addTo(mapaFinal);

  // 🚧 Dibujar líneas punteadas de puntos de control (cubrimos toda la ruta)
  const distanciaControl = parseFloat(document.getElementById('puntosControl').value); // en metros
  const segmentos = [];
  let distanciaTotal = 0;

  // 1. Calcular todos los segmentos y distancia total
  for (let i = 1; i < puntosRuta.length; i++) {
    const [lat1, lon1] = puntosRuta[i - 1];
    const [lat2, lon2] = puntosRuta[i];
    const d = getDistanciaMetros(lat1, lon1, lat2, lon2);
    segmentos.push({ lat1, lon1, lat2, lon2, distancia: d });
    distanciaTotal += d;
  }

  // 2. Insertar líneas cada "distanciaControl" metros, incluso si el último tramo es más corto
  let distanciaActual = 0;
  while (distanciaActual <= distanciaTotal) {
    let acumulado = 0;

    for (let i = 0; i < segmentos.length; i++) {
      const seg = segmentos[i];
      if (acumulado + seg.distancia >= distanciaActual) {
        const f = (distanciaActual - acumulado) / seg.distancia;

        const lat = seg.lat1 + (seg.lat2 - seg.lat1) * f;
        const lon = seg.lon1 + (seg.lon2 - seg.lon1) * f;

        const dx = seg.lat2 - seg.lat1;
        const dy = seg.lon2 - seg.lon1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const ux = -dy / length * offset * 0.00001;
        const uy = dx / length * offset * 0.00001;

        const puntoIzq = [lat + ux, lon + uy];
        const puntoDer = [lat - ux, lon - uy];

        L.polyline([puntoIzq, puntoDer], {
          color: 'green',
          dashArray: '4, 4',
          weight: 2
        }).addTo(mapaFinal);

        break;
      }

      acumulado += seg.distancia;
    }

    distanciaActual += distanciaControl;
  }
}

function getDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function confirmarConfiguracion() {
  const zona = zonaSeleccionada;
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
  const distanciaControl = parseFloat(document.getElementById('puntosControl').value);
  const ancho = parseFloat(document.getElementById('anchoCorredor').value);
  const offset = ancho / 2;

  try {
    const rutaResponse = await fetch("https://navigationasistance-backend-1.onrender.com/rutasa/agregar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: zona, color: timestamp })
    });

    if (!rutaResponse.ok) throw new Error("Error al agregar ruta");

    const rutaId = await rutaResponse.text();
    console.log("✅ Ruta creada con ID:", rutaId);

    // 1. Calcular distancias de cada tramo
    let distanciasSegmentos = [];
    let totalDistancia = 0;

    for (let i = 1; i < puntosRuta.length; i++) {
      const [lat1, lon1] = puntosRuta[i - 1];
      const [lat2, lon2] = puntosRuta[i];
      const dist = getDistanciaMetros(lat1, lon1, lat2, lon2);
      distanciasSegmentos.push({ lat1, lon1, lat2, lon2, distancia: dist, acumuladoInicio: totalDistancia });
      totalDistancia += dist;
    }

    // 2. Colocar puntos de control a intervalos fijos (cada distanciaControl)
    let mtsGlobal = 0;
    while (mtsGlobal <= totalDistancia) {
      // buscar en qué segmento estamos
      const seg = distanciasSegmentos.find(s =>
        mtsGlobal >= s.acumuladoInicio && mtsGlobal <= s.acumuladoInicio + s.distancia
      );

      if (!seg) break; // no encontrado, fin

      const { lat1, lon1, lat2, lon2, distancia, acumuladoInicio } = seg;

      const f = (mtsGlobal - acumuladoInicio) / distancia;
      const lat = lat1 + (lat2 - lat1) * f;
      const lon = lon1 + (lon2 - lon1) * f;

      const len = Math.sqrt((lat2 - lat1) ** 2 + (lon2 - lon1) ** 2);
      const ux = -(lon2 - lon1) / len * offset * 0.00001;
      const uy = (lat2 - lat1) / len * offset * 0.00001;

      const latl = lat + uy;
      const lngl = lon + ux;
      const latr = lat - uy;
      const lngr = lon - ux;

      let tipo = "I";
      if (mtsGlobal === 0) tipo = "O";
      else if (mtsGlobal + distanciaControl > totalDistancia) tipo = "F";

      const payload = {
        ruta_id: parseInt(rutaId),
        mts: Math.round(mtsGlobal),
        latl,
        lngl,
        latr,
        lngr,
        latc: lat,
        lngc: lon,
        tipo
      };

      console.log("📦 Enviando señal:", payload);

      await fetch("https://navigationasistance-backend-1.onrender.com/seniales/agregar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      mtsGlobal += distanciaControl;
    }

    alert("✅ Corredor virtual confirmado correctamente.");
  } catch (error) {
    console.error("❌ Error al confirmar:", error);
    alert("❌ Error al confirmar el corredor. Ver consola.");
  }
}
