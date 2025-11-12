let map = L.map('map').setView([-34.9, -56.2], 13);

L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
  subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  maxZoom: 20,
}).addTo(map);

let rutasConfirmadas = [];
let puntosActuales = [];
let lineaActual = null;
let secuencia = 1;

map.on('click', function (e) {
  const color = document.getElementById("color").value;

  const marker = L.circleMarker(e.latlng, {
    radius: 6,
    color: color,
    fillOpacity: 0.9
  }).addTo(map);

  marker.bindTooltip("Punto " + secuencia + "Coord " + e.latlng.lat + ", " + e.latlng.lng).openTooltip();
  setTimeout(() => marker.closeTooltip(), 1000);

  const punto = {
    secuencia: secuencia++,
    latitud: e.latlng.lat,
    longitud: e.latlng.lng,
    marker: marker
  };

  let pressTimer;

  marker.on('mousedown touchstart', function () {
    pressTimer = setTimeout(() => {
      eliminarPunto(punto);
    }, 2000);
  });

  marker.on('mouseup touchend', function () {
    clearTimeout(pressTimer);
  });

  puntosActuales.push(punto);

  if (lineaActual) {
    map.removeLayer(lineaActual);
  }
  const latlngs = puntosActuales.map(p => [p.latitud, p.longitud]);
  lineaActual = L.polyline(latlngs, { color: color }).addTo(map);
});

function confirmarRuta() {
  if (puntosActuales.length < 2) {
    alert("Debe haber al menos 2 puntos para guardar una ruta.");
    return;
  }

  const color = document.getElementById("color").value;

  fetch('https://navigationasistance-backend-1.onrender.com/rutas/agregar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ color })
  })
  .then(response => {
    if (!response.ok) throw new Error("Error al guardar la ruta");
    return response.text();
  })
  .then(text => {
    const rutaId = parseInt(text.trim(), 10);
    console.log("ID generado por backend:", rutaId); // 👈 Verificá esto

    if (isNaN(rutaId)) throw new Error("ID inválido de la ruta creada.");

    document.getElementById("ruta-id-confirmada").innerText = `Ruta confirmada con ID: ${rutaId}`;

    const puntosParaEnviar = puntosActuales.map(p => ({
      ruta: { id: rutaId },
      secuencia: p.secuencia,
      latitud: p.latitud,
      longitud: p.longitud
    }));

    console.log("JSON final a enviar:", JSON.stringify(puntosParaEnviar)); // 👈 console.log agregado

    return fetch('https://navigationasistance-backend-1.onrender.com/rutaspuntos/agregar-masivo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(puntosParaEnviar)
    });
  })
  .then(res => {
    if (!res.ok) {
      return res.text().then(text => {
        throw new Error(`Error en carga masiva de puntos: ${text}`);
      });
    }
    return res.json();
  })
  .then(() => {
    rutasConfirmadas.push({
      rutaId: rutasConfirmadas.length + 1,
      color: color,
      puntos: [...puntosActuales]
    });

    alert("Ruta confirmada");
    limpiarRutaActual();
  })
  .catch(err => {
    alert("Error al guardar: " + err.message);
  });
}


function limpiarRutaActual() {
  puntosActuales = [];
  secuencia = 1;
  if (lineaActual) {
    map.removeLayer(lineaActual);
    lineaActual = null;
  }
}

function eliminarPunto(punto) {
  if (punto.marker) {
    map.removeLayer(punto.marker);
  }

  puntosActuales = puntosActuales.filter(p => p !== punto);

  if (lineaActual) {
    map.removeLayer(lineaActual);
  }
  const latlngs = puntosActuales.map(p => [p.latitud, p.longitud]);
  if (latlngs.length > 1) {
    lineaActual = L.polyline(latlngs, { color: document.getElementById("color").value }).addTo(map);
  }

  if (punto.id) {
    fetch(`https://navigationasistance-backend-1.onrender.com/rutaspuntos/eliminar/${punto.id}`, {
      method: 'DELETE'
    }).then(() => {
      console.log("Punto eliminado del backend:", punto.id);
    }).catch(err => {
      alert("Error al eliminar el punto: " + err);
    });
  }
}

function finalizar() {
  rutasConfirmadas.forEach(r => {
    const latlngs = r.puntos.map(p => [p.latitud, p.longitud]);
    L.polyline(latlngs, { color: r.color }).addTo(map);
  });
  alert("Todas las rutas han sido visualizadas.");
}
