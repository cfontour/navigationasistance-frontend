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
        this.imageModal = document.getElementById('imageModal');
        this.modalImage = document.getElementById('modalImage');
        this.closeModal = document.getElementById('closeModal');
    }

    attachEventListeners() {
        this.btnRefresh.addEventListener('click', () => this.handleRefresh());
        this.searchBox.addEventListener('input', (e) => this.handleSearch(e.target.value));
        this.closeModal.addEventListener('click', () => this.hideImageModal());
        this.imageModal.addEventListener('click', (e) => {
            if (e.target === this.imageModal) {
                this.hideImageModal();
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

        // Adjuntar event listeners a las imágenes
        setTimeout(() => {
            this.filteredEvents.forEach(event => {
                if (event.event_image) {
                    const imgBtn = document.getElementById(`img-${event.id}`);
                    if (imgBtn) {
                        imgBtn.addEventListener('click', () => this.showImageModal(event));
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

        return `
            <tr style="animation-delay: ${index * 30}ms">
                <td class="id-cell">${event.id}</td>
                <td>${this.escapeHtml(event.usuario_id || '-')}</td>
                <td class="truncate">${event.localidad_id || '-'}</td>
                <td class="truncate">${event.type_id || '-'}</td>
                <td class="truncate">${this.escapeHtml(event.event_descripcion || '-')}</td>
                <td>${imagenBtn}</td>
                <td class="geo-cell" title="${event.guard_lat || '-'}">${this.formatCoordinate(event.guard_lat)}</td>
                <td class="geo-cell" title="${event.guard_lng || '-'}">${this.formatCoordinate(event.guard_lng)}</td>
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

    showImageModal(event) {
        if (!event.event_image) return;

        try {
            // Si es un string base64, usarlo directamente
            if (typeof event.event_image === 'string') {
                this.modalImage.src = event.event_image;
            } else if (event.event_image instanceof ArrayBuffer) {
                // Si es un buffer, convertirlo a base64
                const binary = String.fromCharCode.apply(null, new Uint8Array(event.event_image));
                const base64 = btoa(binary);
                this.modalImage.src = `data:image/jpeg;base64,${base64}`;
            } else {
                // Intentar como es
                this.modalImage.src = event.event_image;
            }

            this.imageModal.style.display = 'block';
        } catch (error) {
            console.error('Error al mostrar imagen:', error);
            this.showError('Error al cargar la imagen');
        }
    }

    hideImageModal() {
        this.imageModal.style.display = 'none';
        this.modalImage.src = '';
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