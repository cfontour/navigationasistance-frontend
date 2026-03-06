class TypeEventABM {
    constructor() {
        this.API_BASE = 'https://navigationasistance-backend-1.onrender.com';
        this.events = [];
        this.editingId = null;
        this.isLoading = false;
        this.init();
    }

    init() {
        this.cacheElements();
        this.attachEventListeners();
        this.loadEvents();
    }

    cacheElements() {
        // Botones
        this.btnNewEvent = document.getElementById('btnNewEvent');
        this.btnCloseForm = document.getElementById('btnCloseForm');
        this.btnCancel = document.getElementById('btnCancel');
        this.btnSubmit = document.getElementById('btnSubmit');

        // Form
        this.formContainer = document.getElementById('formContainer');
        this.eventForm = document.getElementById('eventForm');
        this.formTitle = document.getElementById('formTitle');
        this.submitText = document.getElementById('submitText');
        this.errorMessage = document.getElementById('errorMessage');

        // Inputs
        this.inputNombre = document.getElementById('nombreEvento');
        this.inputImportancia = document.getElementById('importancia');
        this.importanciaValue = document.getElementById('importanciaValue');

        // Container
        this.eventsContainer = document.getElementById('eventsContainer');
    }

    attachEventListeners() {
        this.btnNewEvent.addEventListener('click', () => this.showForm());
        this.btnCloseForm.addEventListener('click', () => this.hideForm());
        this.btnCancel.addEventListener('click', () => this.hideForm());
        this.eventForm.addEventListener('submit', (e) => this.handleSubmit(e));
        this.inputImportancia.addEventListener('change', (e) => {
            this.importanciaValue.textContent = e.target.value;
        });
    }

    showForm(eventToEdit = null) {
        this.formContainer.style.display = 'block';
        this.errorMessage.innerHTML = '';

        if (eventToEdit) {
            this.editingId = eventToEdit.id;
            this.formTitle.textContent = 'Editar Evento';
            this.submitText.textContent = 'Actualizar';
            this.inputNombre.value = eventToEdit.type_nombre;
            this.inputImportancia.value = eventToEdit.type_importancia;
            this.importanciaValue.textContent = eventToEdit.type_importancia;
        } else {
            this.editingId = null;
            this.formTitle.textContent = 'Crear Nuevo Evento';
            this.submitText.textContent = 'Crear';
            this.inputNombre.value = '';
            this.inputImportancia.value = '5';
            this.importanciaValue.textContent = '5';
        }

        this.inputNombre.focus();
    }

    hideForm() {
        this.formContainer.style.display = 'none';
        this.eventForm.reset();
        this.errorMessage.innerHTML = '';
        this.editingId = null;
        this.importanciaValue.textContent = '5';
    }

    async handleSubmit(e) {
        e.preventDefault();

        const nombre = this.inputNombre.value.trim();
        const importancia = parseInt(this.inputImportancia.value);

        if (!nombre) {
            this.showError('El nombre del evento es requerido');
            return;
        }

        try {
            this.setSubmitLoading(true);
            this.errorMessage.innerHTML = '';

            if (this.editingId) {
                await this.updateEvent(this.editingId, nombre, importancia);
            } else {
                await this.addEvent(nombre, importancia);
            }

            await this.loadEvents();
            this.hideForm();
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.setSubmitLoading(false);
        }
    }

    async addEvent(nombre, importancia) {
        const payload = {
            type_nombre: nombre,
            type_importancia: importancia
        };

        console.log('Enviando payload:', payload);

        const response = await fetch(`${this.API_BASE}/typeEvent/agregar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log('Response status add:', response.status);
        const responseData = await response.json();
        console.log('Response data add:', responseData);

        if (!response.ok) {
            throw new Error(responseData.message || 'Error al crear el evento');
        }

        return responseData;
    }

    async updateEvent(id, nombre, importancia) {
        const payload = {
            type_nombre: nombre,
            type_importancia: importancia
        };

        console.log('Actualizando con payload:', payload);

        const response = await fetch(
            `${this.API_BASE}/typeEvent/actualizar/${id}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }
        );

        console.log('Response status update:', response.status);
        const responseData = await response.json();
        console.log('Response data update:', responseData);

        if (!response.ok) {
            throw new Error(responseData.message || 'Error al actualizar el evento');
        }

        return responseData;
    }

    async deleteEvent(id) {
        const response = await fetch(
            `${this.API_BASE}/typeEvent/eliminar/${id}`,
            { method: 'POST' }
        );

        if (!response.ok) {
            throw new Error('Error al eliminar el evento');
        }
    }

    async loadEvents() {
        try {
            this.showLoading();
            this.errorMessage.innerHTML = '';

            const response = await fetch(`${this.API_BASE}/typeEvent/listar`);
            console.log('Response status:', response.status);

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            console.log('Datos recibidos:', data);

            // Validar y convertir la respuesta
            if (Array.isArray(data)) {
                this.events = data;
            } else if (data && typeof data === 'object') {
                // Si es un objeto, intentar extraer array de propiedades comunes
                this.events = data.data || data.eventos || data.typeEvents || data.items || [];
            } else {
                this.events = [];
            }

            console.log('Eventos después de procesar:', this.events);
            this.renderEvents();
        } catch (error) {
            console.error('Error al cargar eventos:', error);
            this.showError(error.message);
            this.events = [];
            this.renderEvents();
        }
    }

    renderEvents() {
        console.log('Renderizando eventos:', this.events);

        if (this.events.length === 0) {
            this.eventsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <h3>No hay eventos registrados</h3>
                    <p>Crea tu primer evento para comenzar</p>
                    <button class="btn-new" onclick="app.showForm()">
                        <span>➕</span>
                        <span>Crear Evento</span>
                    </button>
                </div>
            `;
            return;
        }

        const cardsHTML = this.events.map((event, index) => this.createEventCard(event, index)).join('');
        this.eventsContainer.innerHTML = `<div class="events-grid">${cardsHTML}</div>`;

        // Adjuntar event listeners a los botones de edición y eliminación
        setTimeout(() => {
            this.events.forEach(event => {
                const editBtn = document.getElementById(`edit-${event.id}`);
                const deleteBtn = document.getElementById(`delete-${event.id}`);

                if (editBtn) {
                    editBtn.addEventListener('click', () => this.showForm(event));
                }

                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => this.handleDelete(event.id));
                }
            });
        }, 0);
    }

    createEventCard(event, index) {
        const importance = event.type_importancia;
        const { badge, progress } = this.getImportanceStyles(importance);
        const label = this.getImportanceLabel(importance);

        return `
            <div class="event-card" style="animation-delay: ${index * 50}ms">
                <div class="event-header">
                    <div class="event-title">
                        <h3>${this.escapeHtml(event.type_nombre)}</h3>
                        <div class="event-id">ID: <code>${event.id}</code></div>
                    </div>
                </div>

                <div class="importance-badge ${badge}">
                    ${label} (${importance}/10)
                </div>

                <div class="progress-bar">
                    <div class="progress-fill ${progress}" style="width: ${(importance / 10) * 100}%"></div>
                </div>

                <div class="event-buttons">
                    <button class="btn-edit" id="edit-${event.id}">
                        <span>✎</span>
                        <span>Editar</span>
                    </button>
                    <button class="btn-delete" id="delete-${event.id}">
                        <span>🗑</span>
                        <span>Eliminar</span>
                    </button>
                </div>
            </div>
        `;
    }

    getImportanceStyles(level) {
        if (level <= 3) {
            return {
                badge: 'importance-low',
                progress: 'progress-low'
            };
        }
        if (level <= 6) {
            return {
                badge: 'importance-medium',
                progress: 'progress-medium'
            };
        }
        if (level <= 8) {
            return {
                badge: 'importance-high',
                progress: 'progress-high'
            };
        }
        return {
            badge: 'importance-critical',
            progress: 'progress-critical'
        };
    }

    getImportanceLabel(level) {
        if (level <= 3) return 'Baja';
        if (level <= 6) return 'Media';
        if (level <= 8) return 'Alta';
        return 'Crítica';
    }

    async handleDelete(id) {
        const eventName = this.events.find(e => e.id === id)?.type_nombre || 'este evento';
        if (!window.confirm(`¿Estás seguro de que deseas eliminar "${eventName}"?`)) {
            return;
        }

        try {
            this.setSubmitLoading(true);
            this.errorMessage.innerHTML = '';
            await this.deleteEvent(id);
            await this.loadEvents();
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.setSubmitLoading(false);
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
        this.eventsContainer.innerHTML = `
            <div class="loading-container">
                <div class="spinner"></div>
                <p class="loading-text">Cargando eventos...</p>
            </div>
        `;
    }

    setSubmitLoading(loading) {
        this.btnSubmit.disabled = loading;
        if (loading) {
            this.btnSubmit.innerHTML = '<span>⏳</span> <span>Guardando...</span>';
        } else {
            this.btnSubmit.innerHTML = `<span>✓</span> <span>${this.submitText.textContent}</span>`;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TypeEventABM();
});