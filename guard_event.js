class GuardEventViewer {
    constructor() {
        this.API_BASE = 'https://navigationasistance-backend-1.onrender.com';
        this.allEvents = [];
        this.filteredEvents = [];
        this.init();
    }

    init() {
        this.cacheElements();
        this.attachEventListeners();
        this.loadEvents();
    }

    cacheElements() {
        // Botones
        this.btnRefresh = document.getElementById('btnRefresh');
        this.refreshText = document.getElementById('refreshText');

        // Search
        this.searchBox = document.getElementById('searchBox');
        this.recordsCount = document.getElementById('recordsCount');

        // Containers
        this.tableContainer = document.getElementById('tableContainer');
        this.errorMessage = document.getElementById('errorMessage');

        // Modal
        this.detailModal = document.getElementById('detailModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.mapContainer = document.getElementById('mapContainer');
        this.modalImage = document.getElementById('modalImage');
        this.closeModal = document.getElementById('closeModal');

        // Variables para el mapa
        this.map = null;
        this.mapMarker = null;
    }

    attachEventListeners() {
        this.btnRefresh.addEventListener('click', () => this.handleRefresh());
        this.searchBox.addEventListener('input', (e) => this.handleSearch(e.target.value));
        this.closeModal.addEventListener('click', () => this.hideModal());
        this.detailModal.addEventListener('click', (e) => {
            if (e.target === this.detailModal) {
                this.hideModal();
            }
        });
    }

    async handleRefresh() {
        this.btnRefresh.disabled = true;
        const originalText = this.refreshText.textContent;
        this.refreshText.innerHTML = '<span class="spinner-small"></span>';

        await this.loadEvents();

        this.refreshText.textContent = originalText;
        this.btnRefresh.disabled = false;
    }

    async loadEvents() {
        try {
            this.showLoading();
            this.errorMessage.innerHTML = '';

            const response = await fetch(`${this.API_BASE}/guardEvent/listar`);
            console.log('Response status:', response.status);

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            console.log('Datos recibidos:', data);

            // Validar y convertir la respuesta
            if (Array.isArray(data)) {
                this.allEvents = data;
            } else if (data && typeof data === 'object') {
                // Si es un objeto, intentar extraer array de propiedades comunes
                this.allEvents = data.data || data.eventos || data.guardEvents || data.items || [];
            } else {
                this.allEvents = [];
            }

            console.log('Eventos después de procesar:', this.allEvents);
            this.filteredEvents = [...this.allEvents];
            this.updateRecordsCount();
            this.renderTable();
        } catch (error) {
            console.error('Error al cargar eventos:', error);
            this.showError(error.message);
            this.allEvents = [];
            this.filteredEvents = [];
            this.renderTable();
        }
    }

    handleSearch(searchTerm) {
        const term = searchTerm.toLowerCase().trim();

        if (!term) {
            this.filteredEvents = [...this.allEvents];
        } else {
            this.filteredEvents = this.allEvents.filter(event => {
                const usuario = (event.usuario_id || '').toLowerCase();
                const descripcion = (event.event_descripcion || '').toLowerCase();
                const localidad = (event.localidad_id || '').toString().toLowerCase();
                const typeId = (event.type_id || '').toString().toLowerCase();
                const lat = (event.guard_lat || '').toString().toLowerCase();
                const lng = (event.guard_lng || '').toString().toLowerCase();

                return usuario.includes(term) ||
                       descripcion.includes(term) ||
                       localidad.includes(term) ||
                       typeId.includes(term) ||
                       lat.includes(term) ||
                       lng.includes(term);
            });
        }

        this.updateRecordsCount();
        this.renderTable();
    }

    updateRecordsCount() {
        this.recordsCount.textContent = this.filteredEvents.length;
    }

    renderTable() {
        console.log('Renderizando tabla con', this.filteredEvents.length, 'registros');

        if (this.filteredEvents.length === 0) {
            this.tableContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <h3>${this.allEvents.length === 0 ? 'No hay registros' : 'Sin resultados de búsqueda'}</h3>
                    <p>${this.allEvents.length === 0 ? 'No hay eventos registrados en el sistema' : 'Intenta con otros términos de búsqueda'}</p>
                </div>
            `;
            return;
        }

        const tableHTML = `
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Usuario</th>
                            <th>Localidad</th>
                            <th>Tipo</th>
                            <th>Descripción</th>
                            <th>Imagen</th>
                            <th>Latitud</th>
                            <th>Longitud</th>
                            <th>Fecha/Hora</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.filteredEvents.map((event, index) => this.createTableRow(event, index)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        this.tableContainer.innerHTML = tableHTML;

        // Adjuntar event listeners a las imágenes y mapas
        setTimeout(() => {
            this.filteredEvents.forEach(event => {
                // Listeners para imágenes
                if (event.event_image) {
                    const imgBtn = document.getElementById(`img-${event.id}`);
                    if (imgBtn) {
                        imgBtn.addEventListener('click', () => this.showImageModal(event));
                    }
                }

                // Listeners para mapas (latitud)
                if (event.guard_lat) {
                    const latBtn = document.getElementById(`lat-${event.id}`);
                    if (latBtn) {
                        latBtn.addEventListener('click', () => this.showMap(event));
                    }
                }

                // Listeners para mapas (longitud)
                if (event.guard_lng) {
                    const lngBtn = document.getElementById(`lng-${event.id}`);
                    if (lngBtn) {
                        lngBtn.addEventListener('click', () => this.showMap(event));
                    }
                }
            });
        }, 0);
    }

    createTableRow(event, index) {
        const fecha = this.formatDateTime(event.event_datetime);
        const imagenBtn = event.event_image ?
            `<div class="image-preview" id="img-${event.id}" style="cursor: pointer;" title="Ver imagen">🖼️</div>` :
            '<span class="text-muted">-</span>';

        const latBtn = event.guard_lat ?
            `<span class="geo-cell" id="lat-${event.id}" style="cursor: pointer;" title="Ver mapa">${this.formatCoordinate(event.guard_lat)}</span>` :
            '<span class="text-muted">-</span>';

        const lngBtn = event.guard_lng ?
            `<span class="geo-cell" id="lng-${event.id}" style="cursor: pointer;" title="Ver mapa">${this.formatCoordinate(event.guard_lng)}</span>` :
            '<span class="text-muted">-</span>';

        return `
            <tr style="animation-delay: ${index * 30}ms">
                <td class="id-cell">${event.id}</td>
                <td>${this.escapeHtml(event.usuario_id || '-')}</td>
                <td class="truncate">${event.localidad_id || '-'}</td>
                <td class="truncate">${event.type_id || '-'}</td>
                <td class="truncate">${this.escapeHtml(event.event_descripcion || '-')}</td>
                <td>${imagenBtn}</td>
                <td>${latBtn}</td>
                <td>${lngBtn}</td>
                <td class="datetime-cell">${fecha}</td>
            </tr>
        `;
    }

    formatDateTime(dateString) {
        if (!dateString) return '-';

        try {
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');

            return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
        } catch {
            return dateString;
        }
    }

    formatCoordinate(coord) {
        if (!coord) return '-';

        try {
            const num = parseFloat(coord);
            if (isNaN(num)) return coord;

            // Redondear a 6 decimales (precisión máxima para coordenadas GPS)
            return num.toFixed(6);
        } catch {
            return coord;
        }
    }

    showMap(event) {
        if (!event.guard_lat || !event.guard_lng) return;

        try {
            const lat = parseFloat(event.guard_lat);
            const lng = parseFloat(event.guard_lng);

            if (isNaN(lat) || isNaN(lng)) {
                this.showError('Coordenadas inválidas');
                return;
            }

            this.modalTitle.textContent = `📍 Ubicación del Evento ${event.id}`;
            this.modalImage.style.display = 'none';
            this.mapContainer.style.display = 'block';
            this.detailModal.style.display = 'block';

            // Esperar a que el modal sea visible antes de inicializar el mapa
            setTimeout(() => {
                if (this.map) {
                    this.map.remove();
                    this.map = null;
                }

                this.map = L.map('mapContainer', {
                    center: [lat, lng],
                    zoom: 15,
                    dragging: true,
                    touchZoom: true
                });

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 19
                }).addTo(this.map);

                // Crear marcador
                if (this.mapMarker) {
                    this.map.removeLayer(this.mapMarker);
                }

                this.mapMarker = L.circleMarker([lat, lng], {
                    radius: 8,
                    fillColor: '#3b82f6',
                    color: '#1e40af',
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.7
                }).addTo(this.map);

                // Popup con información
                const popupText = `
                    <strong>Evento ${event.id}</strong><br>
                    Usuario: ${this.escapeHtml(event.usuario_id)}<br>
                    Descripción: ${this.escapeHtml(event.event_descripcion || '-')}<br>
                    Lat: ${lat.toFixed(6)}<br>
                    Lng: ${lng.toFixed(6)}
                `;

                this.mapMarker.bindPopup(popupText).openPopup();

                // Redimensionar el mapa
                this.map.invalidateSize();
            }, 50);

        } catch (error) {
            console.error('Error al mostrar mapa:', error);
            this.showError('Error al cargar el mapa');
        }
    }

    showImageModal(event) {
        if (!event.event_image) return;

        try {
            this.modalTitle.textContent = `🖼️ Imagen del Evento ${event.id}`;
            this.mapContainer.style.display = 'none';
            this.modalImage.style.display = 'block';

            let imageSrc = '';

            console.log('Tipo de event_image:', typeof event.event_image);
            console.log('Contenido de event_image:', event.event_image);

            // Si es un string, usarlo como nombre de archivo y construir la URL del backend
            if (typeof event.event_image === 'string') {
                // Si ya es una URL completa (empieza con http, data:, o /), usarla tal cual
                if (event.event_image.startsWith('http') || event.event_image.startsWith('data:') || event.event_image.startsWith('/')) {
                    imageSrc = event.event_image;
                } else {
                    // Si es solo un nombre de archivo, construir la URL hacia el backend
                    imageSrc = `https://navigationasistance-backend-1.onrender.com/images/${event.event_image}`;
                }
            }
            // Si es un array de números (array de bytes)
            else if (Array.isArray(event.event_image)) {
                const binary = String.fromCharCode.apply(null, event.event_image);
                const base64 = btoa(binary);
                imageSrc = `data:image/jpeg;base64,${base64}`;
            }
            // Si es un ArrayBuffer
            else if (event.event_image instanceof ArrayBuffer) {
                const binary = String.fromCharCode.apply(null, new Uint8Array(event.event_image));
                const base64 = btoa(binary);
                imageSrc = `data:image/jpeg;base64,${base64}`;
            }
            // Si es un Uint8Array
            else if (event.event_image instanceof Uint8Array) {
                const binary = String.fromCharCode.apply(null, event.event_image);
                const base64 = btoa(binary);
                imageSrc = `data:image/jpeg;base64,${base64}`;
            }
            else {
                console.warn('Tipo de imagen desconocido:', typeof event.event_image);
                imageSrc = String(event.event_image);
            }

            console.log('Intentando cargar imagen desde:', imageSrc);
            this.modalImage.src = imageSrc;
            this.detailModal.style.display = 'block';

            // Manejar errores de carga de imagen
            this.modalImage.onerror = () => {
                console.error('Error al cargar la imagen desde:', imageSrc);
                this.showError('Error al cargar la imagen. La URL podría ser incorrecta.');
                this.modalImage.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23333" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="white" font-family="Arial" font-size="16"%3EError al cargar imagen%3C/text%3E%3C/svg%3E';
            };

            this.modalImage.onload = () => {
                console.log('Imagen cargada exitosamente');
            };

        } catch (error) {
            console.error('Error al procesar imagen:', error);
            this.showError('Error al cargar la imagen: ' + error.message);
        }
    }

    hideModal() {
        this.detailModal.style.display = 'none';
        this.modalImage.src = '';
        this.mapContainer.style.display = 'none';
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }

    showError(message) {
        this.errorMessage.innerHTML = `
            <div class="error-message">
                <span>⚠️</span>
                <span>${this.escapeHtml(message)}</span>
            </div>
        `;
    }

    showLoading() {
        this.tableContainer.innerHTML = `
            <div class="loading-container">
                <div class="spinner-large"></div>
                <p class="loading-text">Cargando registros...</p>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.app = new GuardEventViewer();
});