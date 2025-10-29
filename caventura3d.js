class CarreraAventura3D {
  constructor() {
    console.log("🚀 CarreraAventura3D constructor - USANDO V4 OSM SAFE MODE");

    // === CONFIG GENERAL ===
    this.baseURL = 'https://navigationasistance-backend-1.onrender.com';

    // Token Ion (no lo usamos para imagery/terrain en este modo seguro, pero lo dejamos set)
    Cesium.Ion.defaultAccessToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1ODYyOTlmYi0yNzJiLTQ4YmItOTZjOC0xN2NkZjA2NjFlNDgiLCJpZCI6MzU1MTkyLCJpYXQiOjE3NjE3NDA0NTB9.xV9NaeQy9znoxa_HfijTDSG1zVepGVTDc-U4ZmEvo4Y';

    // Estado runtime
    this.viewer = null;
    this.routeData = [];     // [{lat, lon, distanceKm}, ...]
    this.currentIndex = 0;
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
  // CESIUM VIEWER (MODO SEGURO SIN TERRENO ION)
  // =========================
  initCesium() {
    console.log("🌍 initCesium() - creando viewer con OSM, sin terrain Ion");

    this.viewer = new Cesium.Viewer('cesiumContainer', {
      // capa base OSM (pública, sin token)
      imageryProvider: new Cesium.UrlTemplateImageryProvider({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        credit: '© OpenStreetMap'
      }),

      // forzar 3D real
      sceneMode: Cesium.SceneMode.SCENE3D,

      // UI mínima
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      sceneModePicker: false,
      homeButton: false,
      geocoder: false,

      // 👇 ATENCIÓN: terrain: undefined
      // nada de Cesium.Terrain.fromWorldTerrain() todavía
      terrain: undefined
    });

    // aseguramos globo visible
    if (!this.viewer.scene.globe) {
      this.viewer.scene.globe = new Cesium.Globe(Cesium.Ellipsoid.WGS84);
    }
    this.viewer.scene.globe.show = true;
    this.viewer.scene.skyAtmosphere.show = true;

    // posicionar cámara inicial aprox Uruguay
    this.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(-56.0, -34.9, 50000.0),
      orientation: {
        heading: 0.0,
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0
      }
    });

    // Exponer viewer global para debug
    window._geotraserViewer = this.viewer;
    console.log("✅ Viewer listo y expuesto en window._geotraserViewer");
  }

  // =========================
  // EVENTOS UI
  // =========================
  setupEventListeners() {
    const playBtn = document.getElementById('playBtn');
    const timeSlider = document.getElementById('timeSlider');
    const userSelector = document.getElementById('userSelector');

    playBtn.addEventListener('click', () => {
      this.togglePlayback();
    });

    timeSlider.addEventListener('input', (e) => {
      this.updatePositionFromSlider(e);
    });

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
      const res = await fetch(`${this.baseURL}/nadadorrutas/listar`);
      const data = await res.json();

      selector.innerHTML = '<option value="">Selecciona un participante...</option>';

      for (const u of data) {
        const userRes = await fetch(`${this.baseURL}/usuarios/listarId/${u.usuarioId}`);
        const user = await userRes.json();

        const option = document.createElement('option');
        option.value = u.usuarioId;
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
      const selectedDate =
        document.getElementById('dateSelector').value ||
        new Date().toISOString().split('T')[0];

      const lastRouteResponse = await fetch(
        `${this.baseURL}/nadadorhistoricorutas/ultimorecorrido/${userId}/${selectedDate}`
      );
      const lastRoute = await lastRouteResponse.json();

      if (Array.isArray(lastRoute) && lastRoute.length > 0) {
        const rutaId = lastRoute[0];

        const routeResponse = await fetch(
          `${this.baseURL}/nadadorhistoricorutas/ruta/${rutaId}`
        );
        const routePoints = await routeResponse.json();

        this.routeData = this.processRouteData(routePoints);

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

    console.log("📍 Pintando ruta con", this.routeData.length, "puntos");

    // limpiar entidades previas
    this.viewer.entities.removeAll();

    const positions = this.routeData.map(p =>
      Cesium.Cartesian3.fromDegrees(p.lon, p.lat)
    );

    // línea de la ruta
    this.viewer.entities.add({
      polyline: {
        positions,
        width: 6,
        material: Cesium.Color.LIME.withAlpha(0.9),
        clampToGround: true
      }
    });

    // marcador participante
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

    // zoom a la ruta y después ángulo tipo dron
    this.viewer.zoomTo(this.viewer.entities).then(() => {
      const firstPoint = this.routeData[0];
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          firstPoint.lon,
          firstPoint.lat,
          500
        ),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-45.0),
          roll: 0.0
        },
        duration: 1.0
      });
    });

    // reset playback UI
    this.currentIndex = 0;
    this.isPlaying = false;
    document.getElementById('playBtn').textContent = '▶️ Play';
    document.getElementById('timeSlider').value = 0;
    document.getElementById('distanceValue').textContent = '0.0';
    document.getElementById('speedValue').textContent = '0';
    document.getElementById('timeDisplay').textContent = '00:00';
  }

  // =========================
  // PLAYBACK
  // =========================
  togglePlayback() {
    const btn = document.getElementById('playBtn');

    if (this.isPlaying) {
      this.pausePlayback();
      btn.textContent = '▶️ Play';
      this.isPlaying = false;
    } else {
      this.startPlayback();
      btn.textContent = '⏸️ Pause';
      this.isPlaying = true;
    }
  }

  startPlayback() {
    if (!this.routeData.length) return;

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
    this.entity.position = pos;
  }

  updateStats() {
    const p = this.routeData[this.currentIndex];
    const distKm = p.distanceKm ?? 0;

    document.getElementById('distanceValue').textContent = distKm.toFixed(2);
    document.getElementById('speedValue').textContent = '—';

    const minutes = Math.floor(this.currentIndex / 2);
    const seconds = (this.currentIndex % 2) * 30;
    document.getElementById('timeDisplay').textContent =
      `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;

    document.getElementById('timeSlider').value =
      (this.currentIndex / (this.routeData.length - 1)) * 100;
  }

  updatePositionFromSlider(e) {
    if (!this.routeData.length) return;

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
  // UTIL
  // =========================
  haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
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

// IMPORTANTE: esperamos load completo (no DOMContentLoaded)
window.addEventListener('load', () => {
  new CarreraAventura3D();
});
