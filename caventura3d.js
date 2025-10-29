class CarreraAventura3D {
  constructor() {
    this.baseURL = 'https://navigationasistance-backend-1.onrender.com';
    this.viewer = null;
    this.routeData = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.playInterval = null;
    this.entity = null;
    this.totalDistance = 0;

    this.init();
  }

  async init() {
    this.initCesium();
    this.setupEventListeners();
    await this.loadParticipants();
  }

  initCesium() {
    // Inicializar el visor Cesium
    this.viewer = new Cesium.Viewer('cesiumContainer', {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      sceneModePicker: false,
      homeButton: false,
      geocoder: false
    });
    this.viewer.scene.globe.enableLighting = true;
  }

  setupEventListeners() {
    const playBtn = document.getElementById('playBtn');
    const timeSlider = document.getElementById('timeSlider');
    const userSelector = document.getElementById('userSelector');

    playBtn.addEventListener('click', () => this.togglePlayback());
    timeSlider.addEventListener('input', (e) => this.updatePositionFromSlider(e));
    userSelector.addEventListener('change', async (e) => {
      if (e.target.value) await this.loadUserRoute(e.target.value);
    });
  }

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
    }
  }

  async loadUserRoute(userId) {
    try {
      const selectedDate = document.getElementById('dateSelector').value || new Date().toISOString().split('T')[0];
      const lastRouteResponse = await fetch(`${this.baseURL}/nadadorhistoricorutas/ultimorecorrido/${userId}/${selectedDate}`);
      const lastRoute = await lastRouteResponse.json();

      if (Array.isArray(lastRoute) && lastRoute.length > 0) {
        const rutaId = lastRoute[0];
        const routeResponse = await fetch(`${this.baseURL}/nadadorhistoricorutas/ruta/${rutaId}`);
        const routePoints = await routeResponse.json();
        this.routeData = this.processRouteData(routePoints);
        this.displayRoute3D();
      }
    } catch (err) {
      console.error('Error cargando ruta:', err);
    }
  }

  processRouteData(points) {
    let totalDistance = 0;
    return points.map((p, i) => {
      if (i > 0) {
        totalDistance += this.haversine(points[i-1].nadadorlat, points[i-1].nadadorlng, p.nadadorlat, p.nadadorlng);
      }
      return {
        lat: parseFloat(p.nadadorlat),
        lon: parseFloat(p.nadadorlng),
        distance: totalDistance
      };
    });
  }

  displayRoute3D() {
    if (!this.routeData.length) return;
    this.viewer.entities.removeAll();

    const positions = this.routeData.map(p => Cesium.Cartesian3.fromDegrees(p.lon, p.lat));
    this.viewer.entities.add({
      polyline: {
        positions,
        width: 4,
        material: Cesium.Color.CHARTREUSE.withAlpha(0.8),
        clampToGround: true
      }
    });

    this.entity = this.viewer.entities.add({
      position: positions[0],
      point: { pixelSize: 10, color: Cesium.Color.RED },
      label: {
        text: "Participante",
        font: "14px sans-serif",
        fillColor: Cesium.Color.WHITE,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM
      }
    });

    this.viewer.zoomTo(this.viewer.entities);
  }

  togglePlayback() {
    const btn = document.getElementById('playBtn');
    if (this.isPlaying) {
      clearInterval(this.playInterval);
      btn.textContent = '▶️ Play';
    } else {
      this.playInterval = setInterval(() => this.advancePlayback(), 500);
      btn.textContent = '⏸️ Pause';
    }
    this.isPlaying = !this.isPlaying;
  }

  advancePlayback() {
    if (this.currentIndex >= this.routeData.length - 1) {
      clearInterval(this.playInterval);
      this.isPlaying = false;
      document.getElementById('playBtn').textContent = '▶️ Play';
      return;
    }
    this.currentIndex++;
    this.updateMarkerPosition();
    this.updateStats();
  }

  updateMarkerPosition() {
    const p = this.routeData[this.currentIndex];
    const pos = Cesium.Cartesian3.fromDegrees(p.lon, p.lat);
    this.entity.position = pos;
    this.viewer.camera.lookAt(pos, new Cesium.Cartesian3(0, 0, 300));
  }

  updateStats() {
    document.getElementById('distanceValue').textContent = p.cumulativeDistance?.toFixed(2) || (p.distance?.toFixed(2) ?? 0);
    document.getElementById('speedValue').textContent = '—';
    document.getElementById('timeSlider').value = (this.currentIndex / (this.routeData.length - 1)) * 100;
  }

  updatePositionFromSlider(e) {
    if (!this.routeData.length) return;
    this.currentIndex = Math.floor((e.target.value / 100) * (this.routeData.length - 1));
    this.updateMarkerPosition();
  }

  haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
}

document.addEventListener('DOMContentLoaded', () => new CarreraAventura3D());
