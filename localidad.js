class LocalidadABM {
    constructor() {
        this.API_BASE = 'https://navigationasistance-backend-1.onrender.com';
        this.localities = [];
        this.editingId = null;
        this.countryFlags = {
            'Uruguay': '🇺🇾', 'Argentina': '🇦🇷', 'Brasil': '🇧🇷', 'Chile': '🇨🇱',
            'Paraguay': '🇵🇾', 'Bolivia': '🇧🇴', 'Perú': '🇵🇪', 'Colombia': '🇨🇴',
            'Venezuela': '🇻🇪', 'Ecuador': '🇪🇨', 'Sudán': '🇸🇩', 'Egipto': '🇪🇬',
            'Kenia': '🇰🇪', 'Nigeria': '🇳🇬', 'Sudáfrica': '🇿🇦', 'España': '🇪🇸',
            'Portugal': '🇵🇹', 'Francia': '🇫🇷', 'Alemania': '🇩🇪', 'Italia': '🇮🇹',
            'Reino Unido': '🇬🇧', 'Irlanda': '🇮🇪', 'Bélgica': '🇧🇪', 'Países Bajos': '🇳🇱',
            'Suiza': '🇨🇭', 'Austria': '🇦🇹', 'Suecia': '🇸🇪', 'Noruega': '🇳🇴',
            'Dinamarca': '🇩🇰', 'Finlandia': '🇫🇮', 'Rusia': '🇷🇺', 'China': '🇨🇳',
            'Japón': '🇯🇵', 'Corea del Sur': '🇰🇷', 'India': '🇮🇳', 'Tailandia': '🇹🇭',
            'Vietnam': '🇻🇳', 'Malasia': '🇲🇾', 'Singapur': '🇸🇬', 'Filipinas': '🇵🇭',
            'Indonesia': '🇮🇩', 'Australia': '🇦🇺', 'Nueva Zelanda': '🇳🇿', 'Canadá': '🇨🇦',
            'Estados Unidos': '🇺🇸', 'México': '🇲🇽', 'Sudan': '🇸🇩', 'Yuba': '🇸🇩'
        };
        this.init();
    }

    init() {
        this.cacheElements();
        this.attachEventListeners();
        this.loadLocalities();
    }

    cacheElements() {
        this.btnNewLocality = document.getElementById('btnNewLocality');
        this.btnCloseForm = document.getElementById('btnCloseForm');
        this.btnCancel = document.getElementById('btnCancel');
        this.btnSubmit = document.getElementById('btnSubmit');
        this.formContainer = document.getElementById('formContainer');
        this.localityForm = document.getElementById('localityForm');
        this.formTitle = document.getElementById('formTitle');
        this.submitText = document.getElementById('submitText');
        this.errorMessage = document.getElementById('errorMessage');
        this.inputNombre = document.getElementById('nombreLocalidad');
        this.inputPais = document.getElementById('paisLocalidad');
        this.localitiesContainer = document.getElementById('localitiesContainer');
    }

    attachEventListeners() {
        this.btnNewLocality.addEventListener('click', () => this.showForm());
        this.btnCloseForm.addEventListener('click', () => this.hideForm());
        this.btnCancel.addEventListener('click', () => this.hideForm());
        this.localityForm.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    showForm(localityToEdit = null) {
        this.formContainer.style.display = 'block';
        this.errorMessage.innerHTML = '';
        if (localityToEdit) {
            this.editingId = localityToEdit.id;
            this.formTitle.textContent = 'Editar Localidad';
            this.submitText.textContent = 'Actualizar';
            this.inputNombre.value = localityToEdit.localidad_nombre;
            this.inputPais.value = localityToEdit.localidad_pais;
        } else {
            this.editingId = null;
            this.formTitle.textContent = 'Crear Nueva Localidad';
            this.submitText.textContent = 'Crear';
            this.inputNombre.value = '';
            this.inputPais.value = '';
        }
        this.inputNombre.focus();
    }

    hideForm() {
        this.formContainer.style.display = 'none';
        this.localityForm.reset();
        this.errorMessage.innerHTML = '';
        this.editingId = null;
    }

    async handleSubmit(e) {
        e.preventDefault();
        const nombre = this.inputNombre.value.trim();
        const pais = this.inputPais.value.trim();
        if (!nombre || !pais) {
            this.showError('El nombre de la localidad y el país son requeridos');
            return;
        }
        try {
            this.setSubmitLoading(true);
            this.errorMessage.innerHTML = '';
            if (this.editingId) {
                await this.updateLocality(this.editingId, nombre, pais);
            } else {
                await this.addLocality(nombre, pais);
            }
            await this.loadLocalities();
            this.hideForm();
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.setSubmitLoading(false);
        }
    }

    async addLocality(nombre, pais) {
        // Obtener el último ID y sumar 1
        const lastId = this.localities.length > 0
            ? Math.max(...this.localities.map(l => l.id))
            : 0;
        const newId = lastId + 1;

        const response = await fetch(`${this.API_BASE}/localidad/agregar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                id: newId,
                localidad_nombre: nombre,
                localidad_pais: pais
            })
        });
        console.log('Add status:', response.status, 'ID enviado:', newId);
        if (!response.ok) throw new Error('Error al crear la localidad');
    }

    async updateLocality(id, nombre, pais) {
        const response = await fetch(`${this.API_BASE}/localidad/actualizar/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ localidad_nombre: nombre, localidad_pais: pais })
        });
        console.log('Update status:', response.status);
        if (!response.ok) throw new Error('Error al actualizar la localidad');
    }

    async deleteLocality(id) {
        const response = await fetch(`${this.API_BASE}/localidad/eliminar/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({})
        });
        console.log('Delete status:', response.status);
        if (!response.ok) throw new Error('Error al eliminar la localidad');
    }

    async loadLocalities() {
        try {
            this.showLoading();
            this.errorMessage.innerHTML = '';
            const response = await fetch(`${this.API_BASE}/localidad/listar`);
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
            const data = await response.json();
            this.localities = Array.isArray(data) ? data : (data.data || data.localidades || data.items || []);
            this.renderLocalities();
        } catch (error) {
            console.error('Error:', error);
            this.showError(error.message);
            this.localities = [];
            this.renderLocalities();
        }
    }

    renderLocalities() {
        if (this.localities.length === 0) {
            this.localitiesContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🗺️</div>
                    <h3>No hay localidades registradas</h3>
                    <p>Crea tu primera localidad para comenzar</p>
                    <button class="btn-new" onclick="app.showForm()">
                        <span>➕</span> <span>Nueva Localidad</span>
                    </button>
                </div>`;
            return;
        }
        const cardsHTML = this.localities.map((l, i) => this.createLocalityCard(l, i)).join('');
        this.localitiesContainer.innerHTML = `<div class="localities-grid">${cardsHTML}</div>`;
        setTimeout(() => {
            this.localities.forEach(l => {
                const editBtn = document.getElementById(`edit-${l.id}`);
                const deleteBtn = document.getElementById(`delete-${l.id}`);
                if (editBtn) editBtn.addEventListener('click', () => this.showForm(l));
                if (deleteBtn) deleteBtn.addEventListener('click', () => this.handleDelete(l.id));
            });
        }, 0);
    }

    createLocalityCard(locality, index) {
        const flag = this.getCountryFlag(locality.localidad_pais);
        return `
            <div class="locality-card" style="animation-delay: ${index * 50}ms">
                <div class="locality-icon">${flag}</div>
                <h3 class="locality-name">${this.escapeHtml(locality.localidad_nombre)}</h3>
                <div class="locality-country">
                    <span class="country-flag">${flag}</span>
                    <span>${this.escapeHtml(locality.localidad_pais)}</span>
                </div>
                <div class="locality-id">ID: ${locality.id}</div>
                <div class="locality-buttons">
                    <button class="btn-edit" id="edit-${locality.id}">
                        <span>✎</span> <span>Editar</span>
                    </button>
                    <button class="btn-delete" id="delete-${locality.id}">
                        <span>🗑</span> <span>Eliminar</span>
                    </button>
                </div>
            </div>`;
    }

    getCountryFlag(countryName) {
        return this.countryFlags[countryName] || '📍';
    }

    async handleDelete(id) {
        const locality = this.localities.find(l => l.id === id);
        const name = locality ? `${locality.localidad_nombre}, ${locality.localidad_pais}` : 'esta localidad';
        if (!window.confirm(`¿Estás seguro de que deseas eliminar "${name}"?`)) return;
        try {
            this.setSubmitLoading(true);
            await this.deleteLocality(id);
            await this.loadLocalities();
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
        this.localitiesContainer.innerHTML = `<div class="loading-container"><div class="spinner"></div><p class="loading-text">Cargando localidades...</p></div>`;
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
    window.app = new LocalidadABM();
});