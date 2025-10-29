class CarreraAventura3D {
  constructor() {
    // === CONFIG GENERAL ===
    this.baseURL = 'https://navigationasistance-backend-1.onrender.com';

    // (Podemos dejar tu token Ion igual, aunque en este modo no usamos terreno Ion todavía)
    Cesium.Ion.defaultAccessToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1ODYyOTlmYi0yNzJiLTQ4YmItOTZjOC0xN2NkZjA2NjFlNDgiLCJpZCI6MzU1MTkyLCJpYXQiOjE3NjE3NDA0NTB9.xV9NaeQy9znoxa_HfijTDSG1zVepGVTDc-U4ZmEvo4Y';

    // Estado runtime
    this.viewer = null;
    this.routeData = [];     // puntos [{lat, lon, distanceKm}, ...]
    this.currentIndex = 0;   // índice actual en la reproducción
    this.isPlaying = false;
    this.playInterval = null;
    this.entity = null;      // marcador del participante

    // Arranque
    this.init();
  }

  async init() {
    this.initCesium();
    this.setupEventListeners();
    await this.loadParticipants();
  }

  // =========================
  // CESIUM VIEWER (VERSIÓN SEGURA)
  // =========================
  initCesium() {
    // Creamos el viewer SIN terreno Ion (para descartar conflictos) y con OSM como capa base
    this.viewer = new Cesium.Viewer('cesiumContainer', {
      imageryProvider: new Cesium.UrlTemplateImageryProvider({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        credit: '© OpenStreetMap'
      }),

      // Forzamos vista 3D real
      sceneMode: Cesium.SceneMode.SCENE3D,

      // Desactivamos UI que no usás en la demo
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      sceneModePicker: false,
      homeButton: false,
      geocoder: false,

      // IMPORTANTE: terreno desactivado por ahora
      terrain: undefined
    });

    // Asegurá que haya globo y atmósfera visibles
    if (!this.viewer.scene.globe) {
      this.viewer.scene.globe = new Cesium.Globe(Cesium.Ellipsoid.WGS84);
    }
    this.viewer.scene.globe.show = true;
    this.viewer.scene.skyAtmosphere.show = true;

    // Colocamos la cámara en Uruguay aprox para evitar que "nazca" mirando al vacío azul
    this.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(-56.0, -34.9, 50000.0), // lon, lat, altura (m)
      orientation: {
        heading: 0.0,
        pitch: Cesium.Math.toRadians(-45), // mira hacia abajo en ángulo
        roll: 0.0
      }
    });

    // Para debug en consola: ahora podés usar _geotraserViewer en F12
    window._geotraserViewer = this.viewer;
  }

  // =========================
  // EVENTOS UI
  // =========================
  setupEventListeners() {
    const playBtn = document.getElementById('playBtn');
    const timeSlider = document.getElementById('timeSlider');
    const userSelector = document.getElementById('userSelector');

    // Play / Pause
    playBtn.addEventListener('click', () => {
      this.togglePlayback();
    });

    // Slider manual de tiempo
    timeSlider.addEventListener('input', (e) => {
      this.updatePositionFromSlider(e);
    });

    // Cambio de participante
    userSelector.addEventListener('change', async (e) => {
      if (e.target.value) {
        await this.loadUserRoute(e.target.value);
      }
    });
  }

  // =========================
  // CARGA DE DATOS DEL BACKEND
  // =========================

  async loadParticipants() {
    const selector = document.getElementById('userSelector');
    selector.innerHTML = '<option value="">Cargando...</option>';

    try {
      // /nadadorrutas/listar -> lista de asociaciones usuario/ruta/evento
      const res = await fetch(`${this.baseURL}/nadadorrutas/listar`);
      const data = await res.json();

      selector.innerHTML = '<option value="">Selecciona un participante...</option>';

      for (const u of data) {
        const userRes = await fetch(`${this.baseURL}/usuarios/listarId/${u.usuarioId}`);
        const user = await userRes.json();

        const option = document.createElement('option');
        option.value = u.usuarioId; // usamos este ID para pedir la ruta luego
        option.textContent = `${user.nombre} ${user.apellido}`;
        selector.appendChild(option);
      }
    } catch (err) {
      console.error('Error cargando participantes:', err);
      selector.innerHTML = '<option value="">(Error cargando participantes)</option>';
    }
  }

  async loadUserRoute(userId) {
    try {
      // Tomamos la fecha elegida o hoy si está vacío
      const selectedDate =
        document.getElementById('dateSelector').value ||
        new Date().toISOString().split('T')[0];

      // Paso 1: cuál fue su último recorrido ese día
      const lastRouteResponse = await fetch(
        `${this.baseURL}/nadadorhistoricorutas/ultimorecorrido/${userId}/${selectedDate}`
      );
      const lastRoute = await lastRouteResponse.json();

      if (Array.isArray(lastRoute) && lastRoute.length > 0) {
        const rutaId = lastRoute[0];

        // Paso 2: traigo los puntos de esa ruta
        const routeResponse = await fetch(
          `${this.baseURL}/nadadorhistoricorutas/ruta/${rutaId}`
        );
        const routePoints = await routeResponse.json();

        // Paso 3: proceso (distancia acumulada, etc.)
        this.routeData = this.processRouteData(routePoints);

        // Paso 4: dibujo y reseteo playback
        this.displayRoute3D();
      } else {
        console.warn('No se encontró recorrido para ese usuario/fecha.');
        this.clearPlaybackState();
      }
    } catch (err) {
      console.error('Error cargando ruta:', err);
      this.clearPlaybackState();
    }
  }

  processRouteData(points) {
    // points viene del backend con nadadorlat / nadadorlng
    // devolvemos [{lat, lon, distanceKm}, ...] con distancia acumulada en km
    let totalDistanceKm = 0;

    return points.map((p, i) => {
      const lat = parseFloat(p.nadadorlat);
      const lon = parseFloat(p.nadadorlng);

      if (i > 0) {
        const prev = points[i - 1];
        const dKm = this.haversine(
          prev.nadadorlat,
          prev.nadadorlng,
          p.nadadorlat,
          p.nadadorlng
        );
        totalDistanceKm += dKm;
      }

      return {
        lat,
        lon,
        distanceKm: totalDistanceKm
      };
    });
  }

  // =========================
  // RENDER 3D DE LA RUTA
  // =========================

  displayRoute3D() {
    if (!this.routeData.length) {
      console.warn('displayRoute3D() llamado sin datos');
      return;
    }

    // Limpiar cualquier ruta previa
    this.viewer.entities.removeAll();

    // Convertir puntos lat/lon a posiciones 3D
    const positions = this.routeData.map(p =>
      Cesium.Cartesian3.fromDegrees(p.lon, p.lat)
    );

    // Dibujar la polilínea (ruta) en verde
    this.viewer.entities.add({
      polyline: {
        positions,
        width: 6,
        material: Cesium.Color.LIME.withAlpha(0.9),
        clampToGround: true
      }
    });

    // Crear el marcador rojo del participante
    this.entity = this.viewer.entities.add({
      position: positions[0],
      point: {
        pixelSize: 10,
        color: Cesium.Color.RED
      },
      label: {
        text: 'Participante',
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM
      }
    });

    // Enfocar la cámara a la zona de la ruta y luego inclinarla tipo dron
    this.viewer.zoomTo(this.viewer.entities).then(() => {
      const firstPoint = this.routeData[0];
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          firstPoint.lon,
          firstPoint.lat,
          500 // altura cámara ~500 m sobre el primer punto
        ),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-45.0),
          roll: 0.0
        },
        duration: 1.0
      });
    });

    // Reset del reproductor UI
    this.currentIndex = 0;
    this.isPlaying = false;
    document.getElementById('playBtn').textContent = '▶️ Play';
    document.getElementById('timeSlider').value = 0;
    document.getElementById('distanceValue').textContent = '0.0';
    document.getElementById('speedValue').textContent = '0';
    document.getElementById('timeDisplay').textContent = '00:00';
  }

  // =========================
  // PLAYBACK (PLAY/PAUSE/SLIDER)
  // =========================

  togglePlayback() {
    const btn = document.getElementById('playBtn');

    if (this.isPlaying) {
      // Pausar
      this.pausePlayback();
      btn.textContent = '▶️ Play';
      this.isPlaying = false;
    } else {
      // Reproducir
      this.startPlayback();
      btn.textContent = '⏸️ Pause';
      this.isPlaying = true;
    }
  }

  startPlayback() {
    if (!this.routeData.length) return;

    // Avanzar un punto cada 500ms
    this.playInterval = setInterval(() => {
      this.advancePlayback();
    }, 500);
  }

  pausePlayback() {
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
  }

  advancePlayback() {
    if (this.currentIndex >= this.routeData.length - 1) {
      // fin de recorrido
      this.pausePlayback();
      this.isPlaying = false;
      document.getElementById('playBtn').textContent = '▶️ Play';
      return;
    }

    this.currentIndex++;
    this.updateMarkerPosition();
    this.updateStats();
  }

  updateMarkerPosition() {
    if (!this.entity || !this.routeData.length) return;

    const p = this.routeData[this.currentIndex];
    const pos = Cesium.Cartesian3.fromDegrees(p.lon, p.lat);

    // Mover puntito rojo
    this.entity.position = pos;
  }

  updateStats() {
    const p = this.routeData[this.currentIndex];
    const distKm = p.distanceKm ?? 0;

    // Distancia acumulada en km
    document.getElementById('distanceValue').textContent = distKm.toFixed(2);

    // Velocidad real aún no calculada (falta timestamp en backend)
    document.getElementById('speedValue').textContent = '—';

    // Timeline mm:ss (placeholder aproximado)
    const minutes = Math.floor(this.currentIndex / 2); // ~2 puntos por minuto
    const seconds = (this.currentIndex % 2) * 30;
    document.getElementById('timeDisplay').textContent =
      `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;

    // Actualizar slider
    document.getElementById('timeSlider').value =
      (this.currentIndex / (this.routeData.length - 1)) * 100;
  }

  updatePositionFromSlider(e) {
    if (!this.routeData.length) return;

    // Convertir % del slider → índice en la ruta
    this.currentIndex = Math.floor(
      (e.target.value / 100) * (this.routeData.length - 1)
    );

    this.updateMarkerPosition();
    this.updateStats();
  }

  clearPlaybackState() {
    this.pausePlayback();
    this.routeData = [];
    this.currentIndex = 0;
    this.isPlaying = false;

    if (this.viewer && this.viewer.entities) {
      this.viewer.entities.removeAll();
    }

    document.getElementById('playBtn').textContent = '▶️ Play';
    document.getElementById('timeSlider').value = 0;
    document.getElementById('distanceValue').textContent = '0.0';
    document.getElementById('speedValue').textContent = '0';
    document.getElementById('timeDisplay').textContent = '00:00';
  }

  // =========================
  // UTILIDADES
  // =========================

  // Distancia Haversine (km) entre dos puntos lat/lon
  haversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // km radio Tierra
    const toRad = deg => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // km
  }
}

// IMPORTANTE: ahora esperamos a que cargue TODO (HTML + CSS + layout)
// para que Cesium calcule bien tamaños
window.addEventListener('load', () => {
  new CarreraAventura3D();
});
