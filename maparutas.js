
    let map = L.map('map').setView([-34.9, -56.2], 13); // Coordenadas de Uruguay por defecto

    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      maxZoom: 20,
    }).addTo(map);

    let rutasConfirmadas = []; // Acumula rutas confirmadas
    let puntosActuales = [];
    let lineaActual = null;
    let secuencia = 1;

    marker.on('mouseup touchend', function () {
      clearTimeout(pressTimer);
    });

    map.on('click', function (e) {
      const color = document.getElementById("color").value;

      const marker = L.circleMarker(e.latlng, {
        radius: 6,
        color: color,
        fillOpacity: 0.9
      }).addTo(map);

      marker.bindTooltip("Punto " + secuencia).openTooltip();

      // Asociamos este punto al marcador
      const punto = {
        secuencia: secuencia++,
        latitud: e.latlng.lat,
        longitud: e.latlng.lng,
        marker: marker // vinculamos el objeto Leaflet
      };

      let pressTimer;

      marker.on('mousedown touchstart', function () {
        pressTimer = setTimeout(() => {
          eliminarPunto(punto);
        }, 2000); // 2 segundos
      });

      puntosActuales.push(punto)

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
      fetch('https://navigationasistance-backend-1.onrender.com/rutas/agregar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color })
      })
      .then(response => response.json())
      .then(rutaCreada => {
        const rutaId = rutaCreada.id;

        // Paso 2: enviar puntos
        Promise.all(puntosActuales.map(p =>
          fetch('https://navigationasistance-backend-1.onrender.com/rutaspuntos/agregar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ruta: { id: rutaId },
              secuencia: p.secuencia,
              latitud: p.latitud,
              longitud: p.longitud
            })
          }).then(res => {
            if (!res.ok) {
              throw new Error(`Error en punto ${p.secuencia}`);
            }
          })
        ))
        .then(() => {
          rutasConfirmadas.push({
            rutaId: rutaId,
            color: color,
            puntos: [...puntosActuales]
          });

          alert("Ruta confirmada");
          //limpiarRutaActual();
        })
        .catch(err => alert("Error al guardar puntos: " + err));

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

    function eliminarPunto(punto) {
      if (punto.marker) {
        map.removeLayer(punto.marker);
      }

      // Eliminar de la lista de puntos
      puntosActuales = puntosActuales.filter(p => p !== punto);

      // Recalcular línea
      if (lineaActual) {
        map.removeLayer(lineaActual);
      }
      const latlngs = puntosActuales.map(p => [p.latitud, p.longitud]);
      if (latlngs.length > 1) {
        lineaActual = L.polyline(latlngs, { color: document.getElementById("color").value }).addTo(map);
      }

      // Si ya fue guardado en backend, eliminarlo también
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
      // Mostrar todas las rutas dibujadas
      rutasConfirmadas.forEach(r => {
        const latlngs = r.puntos.map(p => [p.latitud, p.longitud]);
        L.polyline(latlngs, { color: r.color }).addTo(map);
      });
      alert("Todas las rutas han sido visualizadas.");
    }
