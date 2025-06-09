
    let map = L.map('map').setView([-34.9, -56.2], 13); // Coordenadas de Uruguay por defecto

    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      maxZoom: 20,
    }).addTo(map);

    let rutasConfirmadas = []; // Acumula rutas confirmadas
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

      marker.bindTooltip("Punto " + secuencia).openTooltip();

      puntosActuales.push({
        secuencia: secuencia++,
        latitud: e.latlng.lat,
        longitud: e.latlng.lng
      });

      // Dibujar línea actual
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

      // Paso 1: enviar la ruta base
      fetch('https://tu-backend.com/rutas/agregar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color })
      })
      .then(response => response.json())
      .then(rutaCreada => {
        const rutaId = rutaCreada.id;

        // Paso 2: enviar puntos
        puntosActuales.forEach(p => {
          fetch('https://tu-backend.com/rutaspuntos/agregar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ruta: { id: rutaId },
              secuencia: p.secuencia,
              latitud: p.latitud,
              longitud: p.longitud
            })
          });
        });

        // Guardar ruta localmente para mostrar al final
        rutasConfirmadas.push({
          rutaId: rutaId,
          color: color,
          puntos: [...puntosActuales]
        });

        alert("Ruta confirmada");
        limpiarRutaActual();
      })
      .catch(err => alert("Error al guardar la ruta: " + err));
    }

    function limpiarRutaActual() {
      puntosActuales = [];
      secuencia = 1;
      if (lineaActual) {
        map.removeLayer(lineaActual);
        lineaActual = null;
      }
    }

    function finalizar() {
      // Mostrar todas las rutas dibujadas
      rutasConfirmadas.forEach(r => {
        const latlngs = r.puntos.map(p => [p.latitud, p.longitud]);
        L.polyline(latlngs, { color: r.color }).addTo(map);
      });
      alert("Todas las rutas han sido visualizadas.");
    }
