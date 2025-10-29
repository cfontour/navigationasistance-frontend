class CarreraAventura3D {
  constructor() {
    // === CONFIG GENERAL ===
    this.baseURL = 'https://navigationasistance-backend-1.onrender.com';

    // Token Cesium (dejé el tuyo tal cual)
    Cesium.Ion.defaultAccessToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1ODYyOTlmYi0yNzJiLTQ4YmItOTZjOC0xN2NkZjA2NjFlNDgiLCJpZCI6MzU1MTkyLCJpYXQiOjE3NjE3NDA0NTB9.xV9NaeQy9znoxa_HfijTDSG1zVepGVTDc-U4ZmEvo4Y';

    // Estado runtime
    this.viewer = null;
    this.routeData = [];     // puntos de la ruta [{lat, lon, distance}, ...]
    this.currentIndex = 0;   // índice actual en la reproducción
    this.isPlaying = false;  // flag play/pause
    this.playInterval = null;
    this.entity = null;      // marcador "Participante"

    // Arranque
    this.init();
  }

  async init() {
    this.initCesium();
    this.setupEventListeners();
    await this.loadParticipants();
  }

  initCesium() {
    // Inicializar visor Cesium con terreno global y capa satelital
    this.viewer = new Cesium.Viewer('cesiumContainer', {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      imageryProvider: new Cesium.IonImageryProvider({ assetId: 3 }), // Bing Aerial
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      sceneModePicker: false,
      homeButton: false,
      geocoder: false
    });

    // Luz suave en el globo (sombra relieve)
    this.viewer.scene.globe.enableLighting = true;
  }

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
      // /nadadorrutas/listar -> todos los vínculos usuario/ruta/evento
      const res = await fetch(`${this.baseURL}/nadadorrutas/listar`);
      const data = await res.json();

      selector.innerHTML = '<option value="">Selecciona un participante...</option>';

      // Para cada nadadorruta, traigo los datos del usuario (nombre/apellido)
      for (const u of data) {
        const userRes = await fetch(`${this.baseURL}/usuarios/listarId/${u.usuarioId}`);
        const user = await userRes.json();

        const option = document.createElement('option');
        option.value = u.usuarioId; // Este ID lo usamos más abajo
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
      // Fecha elegida en el datepicker (o hoy si está vacío)
      const selectedDate =
        document.getElementById('dateSelector').value ||
        new Date().toISOString().split('T')[0];

      // 1) consulto cuál fue su último recorrido en esa fecha
      const lastRouteResponse = await fetch(
        `${this.baseURL}/nadadorhistoricorutas/ultimorecorrido/${userId}/${selectedDate}`
      );
      const lastRoute = await lastRouteResponse.json();

      // lastRoute esperado: [rutaId]
      if (Array.isArray(lastRoute) && lastRoute.length > 0) {
        const rutaId = lastRoute[0];

        // 2) traigo los puntos crudos de esa ruta
        const routeResponse = await fetch(
          `${this.baseURL}/nadadorhistoricorutas/ruta/${rutaId}`
        );
        const routePoints = await routeResponse.json();

        // 3) proceso esos puntos -> array amigable con distancia acumulada
        this.routeData = this.processRouteData(routePoints);

        // 4) los dibujo y reseteo el reproductor
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
    // Construye array [{lat, lon, distance}, ...]
    // distance = km acumulados a lo largo de la ruta
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
  // RENDER 3D
  // =========================

  displayRoute3D() {
    if (!this.routeData.length) {
      console.warn('displayRoute3D() llamado sin datos');
      return;
    }

    // 1) Limpio entidades previas (otra ruta anterior, etc.)
    this.viewer.entities.removeAll();

    // 2) Convierto la ruta a posiciones cartesianas
    const positions = this.routeData.map(p =>
      Cesium.Cartesian3.fromDegrees(p.lon, p.lat)
    );

    // 3) Dibujo la polilínea "pegada al suelo"
    this.viewer.entities.add({
      polyline: {
        positions,
        width: 4,
        material: Cesium.Color.CHARTREUSE.withAlpha(0.8),
        clampToGround: true
      }
    });

    // 4) Creo el "participante" como un punto rojo con label
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

    // 5) Ajusto la cámara para ver toda la ruta
    this.viewer.zoomTo(this.viewer.entities);

    // 6) Reset del reproductor UI
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
      // estaba reproduciendo → pausar
      this.pausePlayback();
      btn.textContent = '▶️ Play';
      this.isPlaying = false;
    } else {
      // estaba pausado → reproducir
      this.startPlayback();
      btn.textContent = '⏸️ Pause';
      this.isPlaying = true;
    }
  }

  startPlayback() {
    if (!this.routeData.length) return;

    // cada 500ms avanzo un "frame"
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
    // fin de la ruta → stop
    if (this.currentIndex >= this.routeData.length - 1) {
      this.pausePlayback();
      this.isPlaying = false;
      document.getElementById('playBtn').textContent = '▶️ Play';
      return;
    }

    // avanzar 1 punto
    this.currentIndex++;
    this.updateMarkerPosition();
    this.updateStats();
  }

  updateMarkerPosition() {
    if (!this.entity || !this.routeData.length) return;

    const p = this.routeData[this.currentIndex];
    const pos = Cesium.Cartesian3.fromDegrees(p.lon, p.lat);

    // mover la entidad
    this.entity.position = pos;

    // NOTA: no movemos la cámara en cada frame todavía,
    // así podés orbitar libre con el mouse sin que te secuestre.
  }

  updateStats() {
    const p = this.routeData[this.currentIndex];
    const distKm = p.distanceKm ?? 0;

    // Distancia recorrida en km acumulados
    document.getElementById('distanceValue').textContent = distKm.toFixed(2);

    // Velocidad real: por ahora no la estamos calculando (necesita timestamp).
    // Lo dejamos “—” hasta la siguiente iteración en la que migremos tu cálculo de velocidad.
    document.getElementById('speedValue').textContent = '—';

    // timeline visual tipo mm:ss (placeholder igual que tu lógica vieja)
    const minutes = Math.floor(this.currentIndex / 2); // aprox 2 puntos / minuto
    const seconds = (this.currentIndex % 2) * 30;
    document.getElementById('timeDisplay').textContent =
      `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;

    // actualizo slider
    document.getElementById('timeSlider').value =
      (this.currentIndex / (this.routeData.length - 1)) * 100;
  }

  updatePositionFromSlider(e) {
    if (!this.routeData.length) return;

    // Traducir el % del slider a un índice de la ruta
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

document.addEventListener('DOMContentLoaded', () => {
  new CarreraAventura3D();
});
