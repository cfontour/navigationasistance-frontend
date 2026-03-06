class TypeEventABM {
    constructor() {
        this.API_BASE = 'https://navigationasistance-backend-1.onrender.com';
        this.events = [];
        this.editingId = null;
        this.init();
    }

    init() {
        this.cacheElements();
        this.attachEventListeners();
        this.loadEvents();
    }

    cacheElements() {
        this.btnNewEvent = document.getElementById('btnNewEvent');
        this.btnCloseForm = document.getElementById('btnCloseForm');
        this.btnCancel = document.getElementById('btnCancel');
        this.btnSubmit = document.getElementById('btnSubmit');
        this.formContainer = document.getElementById('formContainer');
        this.eventForm = document.getElementById('eventForm');
        this.formTitle = document.getElementById('formTitle');
        this.submitText = document.getElementById('submitText');
        this.errorMessage = document.getElementById('errorMessage');
        this.inputNombre = document.getElementById('nombreEvento');
        this.inputImportancia = document.getElementById('importancia');
        this.importanciaValue = document.getElementById('importanciaValue');
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
        // Obtener el último ID y sumar 1
        const lastId = this.events.length > 0
            ? Math.max(...this.events.map(e => e.id))
            : 0;
        const newId = lastId + 1;

        const response = await fetch(`${this.API_BASE}/typeEvent/agregar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                id: newId,
                type_nombre: nombre,
                type_importancia: importancia
            })
        });
        console.log('Add status:', response.status, 'ID enviado:', newId);
        if (!response.ok) throw new Error('Error al crear el evento');
    }

    async updateEvent(id, nombre, importancia) {
        const response = await fetch(`${this.API_BASE}/typeEvent/actualizar/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ type_nombre: nombre, type_importancia: importancia })
        });
        console.log('Update response status:', response.status);
        if (!response.ok) throw new Error('Error al actualizar el evento');
    }

    async deleteEvent(id) {
        const response = await fetch(`${this.API_BASE}/typeEvent/eliminar/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({})
        });
        console.log('Delete status:', response.status);
        if (!response.ok) throw new Error('Error al eliminar el evento');
    }

    async loadEvents() {
        try {
            this.showLoading();
            this.errorMessage.innerHTML = '';
            const response = await fetch(`${this.API_BASE}/typeEvent/listar`);
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
            const data = await response.json();
            this.events = Array.isArray(data) ? data : (data.data || data.eventos || data.typeEvents || data.items || []);
            this.renderEvents();
        } catch (error) {
            console.error('Error:', error);
            this.showError(error.message);
            this.events = [];
            this.renderEvents();
        }
    }

    renderEvents() {
        if (this.events.length === 0) {
            this.eventsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <h3>No hay eventos registrados</h3>
                    <p>Crea tu primer evento para comenzar</p>
                    <button class="btn-new" onclick="app.showForm()">
                        <span>➕</span> <span>Crear Evento</span>
                    </button>
                </div>`;
            return;
        }
        const cardsHTML = this.events.map((e, i) => this.createEventCard(e, i)).join('');
        this.eventsContainer.innerHTML = `<div class="events-grid">${cardsHTML}</div>`;
        setTimeout(() => {
            this.events.forEach(e => {
                const editBtn = document.getElementById(`edit-${e.id}`);
                const deleteBtn = document.getElementById(`delete-${e.id}`);
                if (editBtn) editBtn.addEventListener('click', () => this.showForm(e));
                if (deleteBtn) deleteBtn.addEventListener('click', () => this.handleDelete(e.id));
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
                        <span>✎</span> <span>Editar</span>
                    </button>
                    <button class="btn-delete" id="delete-${event.id}">
                        <span>🗑</span> <span>Eliminar</span>
                    </button>
                </div>
            </div>`;
    }

    getImportanceStyles(level) {
        if (level <= 3) return { badge: 'importance-low', progress: 'progress-low' };
        if (level <= 6) return { badge: 'importance-medium', progress: 'progress-medium' };
        if (level <= 8) return { badge: 'importance-high', progress: 'progress-high' };
        return { badge: 'importance-critical', progress: 'progress-critical' };
    }

    getImportanceLabel(level) {
        if (level <= 3) return 'Baja';
        if (level <= 6) return 'Media';
        if (level <= 8) return 'Alta';
        return 'Crítica';
    }

    async handleDelete(id) {
        const event = this.events.find(e => e.id === id);
        const name = event?.type_nombre || 'este evento';
        if (!window.confirm(`¿Estás seguro de que deseas eliminar "${name}"?`)) return;
        try {
            this.setSubmitLoading(true);
            await this.deleteEvent(id);
            await this.loadEvents();
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.setSubmitLoading(false);
        }
    }

    showError(message) {
        this.errorMessage.innerHTML = `<div class="error-message"><span>⚠️</span> <span>${this.escapeHtml(message)}</span></div>`;
    }

    showLoading() {
        this.eventsContainer.innerHTML = `<div class="loading-container"><div class="spinner"></div><p class="loading-text">Cargando eventos...</p></div>`;
    }

    setSubmitLoading(loading) {
        this.btnSubmit.disabled = loading;
        this.btnSubmit.innerHTML = loading ? '<span>⏳</span> <span>Guardando...</span>' : `<span>✓</span> <span>${this.submitText.textContent}</span>`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new TypeEventABM();
});