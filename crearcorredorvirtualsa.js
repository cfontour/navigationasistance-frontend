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

  if (index === 4) {
    centrarMapaEnZona(zonaSeleccionada);
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

function centrarMapaFinalEnZona(zonaRaw) {
  const zona = zonaRaw.trim();

  fetch(`/zonas/listarZona/${encodeURIComponent(zona)}`)
    .then(res => res.json())
    .then(data => {
      const z = Array.isArray(data) ? data[0] : data;
      const lat = parseFloat(z.lato.trim());
      const lng = parseFloat(z.lngo.trim());

      if (!isNaN(lat) && !isNaN(lng)) {
        mapaFinal.setView([lat, lng], 16);
        setTimeout(() => mapaFinal.invalidateSize(), 300);
      } else {
        console.error("❌ Coordenadas inválidas:", z.lato, z.lngo);
      }
    })
    .catch(err => {
      console.error("❌ Error al centrar mapa final:", err);
    });
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

function initMapaFinal() {
  mapaFinal = L.map('map2').setView([-34.9, -56.2], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(mapaFinal);
}

function dibujarCorredorVirtual() {
  mapaFinal.eachLayer(l => l instanceof L.Polyline && mapaFinal.removeLayer(l));

  const ancho = parseFloat(document.getElementById('anchoCorredor').value);
  const offset = ancho / 2;

  if (puntosRuta.length < 2) {
    alert("❗ Necesitás al menos 2 puntos para calcular el corredor.");
    return;
  }

  const izq = [], der = [];

  for (let i = 1; i < puntosRuta.length; i++) {
    const [lat1, lon1] = puntosRuta[i - 1];
    const [lat2, lon2] = puntosRuta[i];
    const dx = lat2 - lat1;
    const dy = lon2 - lon1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const ux = -dy / length * offset * 0.00001;
    const uy = dx / length * offset * 0.00001;

    izq.push([lat1 + ux, lon1 + uy]);
    der.push([lat1 - ux, lon1 - uy]);
    if (i === puntosRuta.length - 1) {
      izq.push([lat2 + ux, lon2 + uy]);
      der.push([lat2 - ux, lon2 - uy]);
    }
  }

  L.polyline(puntosRuta, { color: 'red' }).addTo(mapaFinal);
  L.polyline(izq, { color: 'blue' }).addTo(mapaFinal);
  L.polyline(der, { color: 'blue' }).addTo(mapaFinal);
}

function confirmarConfiguracion() {
  alert("📡 Llamada al backend en construcción.");
}
