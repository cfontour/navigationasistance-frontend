class RegatasDashboard {
    constructor() {
        this.baseURL = 'https://navigationasistance-backend-1.onrender.com';
        this.map = null;
        this.routeData = [];
        this.currentMarker = null;
        this.routeLine = null;
        this.isPlaying = false;
        this.currentIndex = 0;
        this.playInterval = null;
        this.selectedUserId = null;
        this.puntosControl = [];
        this.RADIO_PUNTO_CONTROL = 20; // 20 metros

        this.init();
    }

    async init() {
        this.initMap();
        this.setupEventListeners();
        await this.loadParticipants();
        // Cargar automáticamente la ruta 52
        await this.cargarRutas("52");
    }

    initMap() {
        // Inicializar mapa centrado en coordenadas por defecto
        this.map = L.map('map').setView([-34.9011, -56.1645], 13); // Montevideo

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Definir iconos personalizados
        this.iconoInicio = L.icon({
            iconUrl: 'img/start_flag.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        this.iconoFinal = L.icon({
            iconUrl: 'img/finish_flag.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        this.iconoIntermedio = L.icon({
            iconUrl: 'img/white_flag.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });
    }

    setupEventListeners() {
        const userSelector = document.getElementById('userSelector');
        const playBtn = document.getElementById('playBtn');
        const timeSlider = document.getElementById('timeSlider');

        userSelector.addEventListener('change', (e) => {
            if (e.target.value) {
                this.selectedUserId = e.target.value;
                this.loadUserDetails(e.target.value);
                this.loadUserRoute(e.target.value);
            }
        });

        playBtn.addEventListener('click', () => {
            this.togglePlayback();
        });

        timeSlider.addEventListener('input', (e) => {
            if (this.routeData.length > 0) {
                this.currentIndex = Math.floor((e.target.value / 100) * (this.routeData.length - 1));
                this.updateMapPosition();
                this.updateGauges();
            }
        });
    }

    async loadParticipants() {
        try {
            const response = await fetch(`${this.baseURL}/nadadorrutas/listar`);
            const data = await response.json();

            const selector = document.getElementById('userSelector');
            selector.innerHTML = '<option value="">Selecciona un participante...</option>';

            if (data && Array.isArray(data)) {
                data.forEach(participant => {
                    const option = document.createElement('option');
                    option.value = participant.usuarioId || participant.id;
                    option.textContent = participant.nombre || `Participante ${participant.usuarioId || participant.id}`;
                    selector.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading participants:', error);
            this.showError('userSelector', 'Error cargando participantes');
        }
    }

    async loadUserDetails(userId) {
        try {
            // Cargar datos del usuario
            const userResponse = await fetch(`${this.baseURL}/usuarios/listarId/${userId}`);
            const userData = await userResponse.json();

            let personData = null;
            if (userData && userData.personaId) {
                const personResponse = await fetch(`${this.baseURL}/personas/listarId/${userData.personaId}`);
                personData = await personResponse.json();
            }

            this.displayUserProfile(userData, personData);
        } catch (error) {
            console.error('Error loading user details:', error);
            this.showError('userProfileContainer', 'Error cargando datos del usuario');
        }
    }

    displayUserProfile(userData, personData) {
        const container = document.getElementById('userProfileContainer');

        const profileHTML = `
            <div class="user-profile">
                <img class="user-avatar"
                     src="${personData?.apellido || `img/${userData?.id}.png` || 'img/avatar-default.png'}"
                     alt="Avatar"
                     onerror="this.src='https://via.placeholder.com/80'">
                <h4>${userData?.nombre || 'Usuario'}</h4>
            </div>
            <div class="user-info">
                <div class="info-item">
                    <span class="info-label">ID:</span>
                    <span class="info-value">${userData?.id || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${userData?.email || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Estado:</span>
                    <span class="info-value">${userData?.activo ? 'Activo' : 'Inactivo'}</span>
                </div>
                ${personData?.datoExtra ? `
                <div class="info-item">
                    <span class="info-label">Info Extra:</span>
                    <span class="info-value">${personData.datoExtra}</span>
                </div>
                ` : ''}
            </div>
        `;

        container.innerHTML = profileHTML;
    }

    async loadUserRoute(userId) {
        try {
            console.log("🔍 INICIO - Cargando ruta para usuario:", userId);

            // Obtener la fecha actual para el último recorrido
            const today = new Date().toISOString().split('T')[0];
            console.log("🔍 Fecha calculada:", today);

            // Obtener último recorrido
            const lastRouteResponse = await fetch(`${this.baseURL}/nadadorhistoricorutas/ultimorecorrido/${userId}/${today}`);
            console.log("🔍 URL último recorrido:", lastRouteResponse);

            const lastRoute = await lastRouteResponse.json();
            console.log("🔍 Respuesta último recorrido:", lastRoute);

            if (lastRoute && Array.isArray(lastRoute) && lastRoute.length > 0) {
                const rutaId = lastRoute[0]; // Tomar el primer elemento del array
                console.log("🔍 RutaId encontrado:", rutaId);
                // Obtener puntos de la ruta
                const routeResponse = await fetch(`${this.baseURL}/nadadorhistoricorutas/ruta/${rutaId}`);
                console.log("🔍 URL puntos de ruta:", routeResponse);

                const routePoints = await routeResponse.json();

                if (routePoints && Array.isArray(routePoints)) {
                    console.log("✅ Procesando puntos...");
                    this.routeData = this.processRouteData(routePoints);
                    console.log("✅ routeData final:", this.routeData.length);
                    this.displayRoute();
                    this.resetPlayback();
                }
            }
        } catch (error) {
            console.error('Error loading route:', error);
            this.showError('map', 'Error cargando ruta del usuario');
        }
    }

    processRouteData(points) {
        // Procesar puntos y calcular velocidades
        const processed = points.map((point, index) => {
            let speed = 0;
            let distance = 0;

            if (index > 0) {
                const prevPoint = points[index - 1];
                distance = this.calculateDistance(
                    parseFloat(prevPoint.nadadorlat), parseFloat(prevPoint.nadadorlng),
                    parseFloat(point.nadadorlat), parseFloat(point.nadadorlng)
                );

                // Calcular tiempo transcurrido (asumiendo que hay timestamp)
                const currentTime = new Date(point.nadadorhora).getTime();
                const prevTime = new Date(prevPoint.nadadorhora).getTime();
                const timeDiff = (currentTime - prevTime) / 1000;

                // Velocidad en nudos (millas náuticas por hora)
                speed = timeDiff > 0 ? (distance / timeDiff) * 3600 / 1.852 : 0;
            }

            return {
                lat: parseFloat(point.nadadorlat),
                lng: parseFloat(point.nadadorlng),
                speed: speed,
                distance: distance,
                timestamp: point.timestamp || null,
                cumulativeDistance: 0
            };
        });

        // Calcular distancia acumulativa
        let totalDistance = 0;
        processed.forEach(point => {
            totalDistance += point.distance;
            point.cumulativeDistance = totalDistance;
        });

        return processed;
    }

    displayRoute() {
        if (this.routeData.length === 0) return;

        // Centrar mapa en la ruta
        const bounds = L.latLngBounds(this.routeData.map(p => [p.lat, p.lng]));
        this.map.fitBounds(bounds);

        // Crear línea de ruta con colores según velocidad
        this.createColoredRoute();
    }

    createColoredRoute() {
        // Limpiar ruta anterior
        if (this.routeLine) {
            this.map.removeLayer(this.routeLine);
        }

        // Crear segmentos coloreados
        const maxSpeed = Math.max(...this.routeData.map(p => p.speed));

        for (let i = 0; i < this.routeData.length - 1; i++) {
            const point1 = this.routeData[i];
            const point2 = this.routeData[i + 1];

            // Color basado en velocidad (verde a rojo)
            const speedRatio = maxSpeed > 0 ? point2.speed / maxSpeed : 0;
            const color = this.getSpeedColor(speedRatio);

            const polyline = L.polyline([[point1.lat, point1.lng], [point2.lat, point2.lng]], {
                color: color,
                weight: 4,
                opacity: 0.8
            }).addTo(this.map);
        }
    }

    getSpeedColor(ratio) {
        // Interpolación de verde a rojo
        const red = Math.floor(255 * ratio);
        const green = Math.floor(255 * (1 - ratio));
        return `rgb(${red}, ${green}, 0)`;
    }

    togglePlayback() {
        if (this.routeData.length === 0) return;

        const playBtn = document.getElementById('playBtn');

        if (this.isPlaying) {
            this.pausePlayback();
            playBtn.textContent = '▶️ Play';
        } else {
            this.startPlayback();
            playBtn.textContent = '⏸️ Pause';
        }

        this.isPlaying = !this.isPlaying;
    }

    startPlayback() {
        this.playInterval = setInterval(() => {
            if (this.currentIndex < this.routeData.length - 1) {
                this.currentIndex++;
                this.updateMapPosition();
                this.updateGauges();
                this.updateTimeSlider();
            } else {
                this.pausePlayback();
                document.getElementById('playBtn').textContent = '▶️ Play';
                this.isPlaying = false;
            }
        }, 500); // Actualizar cada 500ms
    }

    pausePlayback() {
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
    }

    resetPlayback() {
        this.pausePlayback();
        this.currentIndex = 0;
        this.isPlaying = false;
        document.getElementById('playBtn').textContent = '▶️ Play';
        document.getElementById('timeSlider').value = 0;
        this.updateMapPosition();
        this.updateGauges();
    }

    updateMapPosition() {
        if (this.routeData.length === 0 || this.currentIndex >= this.routeData.length) return;

        const currentPoint = this.routeData[this.currentIndex];

        // Actualizar marcador
        if (this.currentMarker) {
            this.map.removeLayer(this.currentMarker);
        }

        this.currentMarker = L.marker([currentPoint.lat, currentPoint.lng])
            .addTo(this.map)
            .bindPopup(`Velocidad: ${currentPoint.speed.toFixed(1)} nudos`);
    }

    updateGauges() {
        if (this.routeData.length === 0 || this.currentIndex >= this.routeData.length) return;

        const currentPoint = this.routeData[this.currentIndex];

        // Actualizar velocímetro (máximo 30 nudos)
        const maxSpeed = 30;
        const speedPercentage = Math.min(currentPoint.speed / maxSpeed, 1) * 100;
        this.updateGauge('speedGauge', speedPercentage);
        document.getElementById('speedValue').textContent = currentPoint.speed.toFixed(1);

        // Actualizar distancia (convertir a millas náuticas)
        const distanceNM = currentPoint.cumulativeDistance / 1.852; // km a millas náuticas
        const maxDistance = this.routeData[this.routeData.length - 1].cumulativeDistance / 1.852;
        const distancePercentage = maxDistance > 0 ? (distanceNM / maxDistance) * 100 : 0;
        this.updateGauge('distanceGauge', distancePercentage);
        document.getElementById('distanceValue').textContent = distanceNM.toFixed(1);
    }

    updateGauge(gaugeId, percentage) {
        const circumference = 2 * Math.PI * 60; // radio = 60
        const offset = circumference - (percentage / 100) * circumference;
        document.getElementById(gaugeId).style.strokeDasharray = `${circumference - offset} ${circumference}`;
    }

    updateTimeSlider() {
        const slider = document.getElementById('timeSlider');
        const progress = (this.currentIndex / (this.routeData.length - 1)) * 100;
        slider.value = progress;

        // Actualizar display de tiempo
        const timeDisplay = document.getElementById('timeDisplay');
        const minutes = Math.floor(this.currentIndex / 2); // Asumiendo 2 puntos por minuto
        const seconds = (this.currentIndex % 2) * 30;
        timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        // Fórmula de Haversine para calcular distancia en km
        const R = 6371;
        const dLat = this.degToRad(lat2 - lat1);
        const dLon = this.degToRad(lon2 - lon1);
        const a =
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.degToRad(lat1)) * Math.cos(this.degToRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    degToRad(deg) {
        return deg * (Math.PI/180);
    }

    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `<div class="error">${message}</div>`;
        }
    }

    // Nueva función para cargar la ruta específica
    async cargarRutas(idRuta) {
        try {
            const res = await fetch(`${this.baseURL}/rutas/listarId/${idRuta}`);
            const ruta = await res.json(); // 'ruta' ya es el objeto de la ruta

            // Agregar título de la ruta
            const titulo = document.createElement("h2");
            titulo.innerText = ruta.nombre;
            titulo.style.color = "white";
            titulo.style.fontSize = "1.5em";
            titulo.style.textShadow = "1px 1px 3px black";
            titulo.style.position = "absolute";
            titulo.style.top = "10px";
            titulo.style.left = "50%";
            titulo.style.transform = "translateX(-50%)";
            titulo.style.zIndex = "1000";
            titulo.style.margin = "0";
            titulo.style.padding = "10px 20px";
            titulo.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
            titulo.style.borderRadius = "10px";
            document.body.appendChild(titulo);

            const puntos = ruta.puntos;
            if (!puntos || puntos.length === 0) return;

            const bounds = [];

            puntos.forEach((p, i) => {
                const latlng = [p.latitud, p.longitud];
                bounds.push(latlng);

                console.log("🧩 Punto recibido:", p);

                this.puntosControl.push({
                    latitud: p.latitud,
                    longitud: p.longitud,
                    etiqueta: p.etiqueta || `Punto ${i + 1}`,
                    nadadorruta_id: p.nadadorruta_id,
                    rutaId: idRuta
                });

                // ✅ Círculo sombreado para marcar el radio de 20 metros del punto de control
                const controlPointRadius = L.circle(latlng, {
                    radius: this.RADIO_PUNTO_CONTROL, // Radio en metros
                    color: 'blue',
                    fillColor: '#3388ff',
                    fillOpacity: 0.2,
                    weight: 1
                }).addTo(this.map);

                L.circle(latlng, {
                    radius: 5,
                    color: 'rgba(255, 255, 0, 0.5)',
                    fillColor: 'rgba(255, 255, 0, 0.5)',
                    fillOpacity: 1
                }).addTo(this.map);

                let icon = this.iconoIntermedio;
                if (i === 0) icon = this.iconoInicio;
                else if (i === puntos.length - 1) icon = this.iconoFinal;

                L.marker(latlng, { icon })
                    .addTo(this.map)
                    .bindPopup(`Etiqueta: ${p.etiqueta}<br>Lat: ${p.latitud}<br>Lng: ${p.longitud}`);
            });

            console.log("🧭 puntosControl cargados:", this.puntosControl);
            this.map.fitBounds(bounds);
        } catch (err) {
            console.error("Error al cargar rutas:", err);
        }
    }
}

// Inicializar dashboard cuando la página cargue
document.addEventListener('DOMContentLoaded', () => {
    new RegatasDashboard();
});