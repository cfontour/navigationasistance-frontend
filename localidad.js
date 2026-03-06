class LocalidadABM {
    constructor() {
        this.API_BASE = 'https://navigationasistance-backend-1.onrender.com';
        this.localities = [];
        this.editingId = null;
        this.isLoading = false;
        this.countryFlags = {
            'Uruguay': '🇺🇾',
            'Argentina': '🇦🇷',
            'Brasil': '🇧🇷',
            'Chile': '🇨🇱',
            'Paraguay': '🇵🇾',
            'Bolivia': '🇧🇴',
            'Perú': '🇵🇪',
            'Colombia': '🇨🇴',
            'Venezuela': '🇻🇪',
            'Ecuador': '🇪🇨',
            'Sudán': '🇸🇩',
            'Egipto': '🇪🇬',
            'Kenia': '🇰🇪',
            'Nigeria': '🇳🇬',
            'Sudáfrica': '🇿🇦',
            'España': '🇪🇸',
            'Portugal': '🇵🇹',
            'Francia': '🇫🇷',
            'Alemania': '🇩🇪',
            'Italia': '🇮🇹',
            'Reino Unido': '🇬🇧',
            'Irlanda': '🇮🇪',
            'Bélgica': '🇧🇪',
            'Países Bajos': '🇳🇱',
            'Suiza': '🇨🇭',
            'Austria': '🇦🇹',
            'Suecia': '🇸🇪',
            'Noruega': '🇳🇴',
            'Dinamarca': '🇩🇰',
            'Finlandia': '🇫🇮',
            'Rusia': '🇷🇺',
            'China': '🇨🇳',
            'Japón': '🇯🇵',
            'Corea del Sur': '🇰🇷',
            'India': '🇮🇳',
            'Tailandia': '🇹🇭',
            'Vietnam': '🇻🇳',
            'Malasia': '🇲🇾',
            'Singapur': '🇸🇬',
            'Filipinas': '🇵🇭',
            'Indonesia': '🇮🇩',
            'Australia': '🇦🇺',
            'Nueva Zelanda': '🇳🇿',
            'Canadá': '🇨🇦',
            'Estados Unidos': '🇺🇸',
            'México': '🇲🇽',
            'Sudan': '🇸🇩',
            'Yuba': '🇸🇩'
        };
        this.init();
    }

    init() {
        this.cacheElements();
        this.attachEventListeners();
        this.loadLocalities();
    }

    cacheElements() {
        // Botones
        this.btnNewLocality = document.getElementById('btnNewLocality');
        this.btnCloseForm = document.getElementById('btnCloseForm');
        this.btnCancel = document.getElementById('btnCancel');
        this.btnSubmit = document.getElementById('btnSubmit');

        // Form
        this.formContainer = document.getElementById('formContainer');
        this.localityForm = document.getElementById('localityForm');
        this.formTitle = document.getElementById('formTitle');
        this.submitText = document.getElementById('submitText');
        this.errorMessage = document.getElementById('errorMessage');

        // Inputs
        this.inputNombre = document.getElementById('nombreLocalidad');
        this.inputPais = document.getElementById('paisLocalidad');

        // Container
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
        const payload = {
            localidad_nombre: nombre,
            localidad_pais: pais
        };

        console.log('Enviando payload:', payload);

        const response = await fetch(`${this.API_BASE}/localidad/agregar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log('Response status add:', response.status);
        const responseData = await response.json();
        console.log('Response data add:', responseData);

        if (!response.ok) {
            throw new Error(responseData.message || 'Error al crear la localidad');
        }

        return responseData;
    }

    async updateLocality(id, nombre, pais) {
        const payload = {
            localidad_nombre: nombre,
            localidad_pais: pais
        };

        console.log('Actualizando con payload:', payload);

        const response = await fetch(
            `${this.API_BASE}/localidad/actualizar/${id}`,
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
            throw new Error(responseData.message || 'Error al actualizar la localidad');
        }

        return responseData;
    }

    async deleteLocality(id) {
        const response = await fetch(
            `${this.API_BASE}/localidad/eliminar/${id}`,
            { method: 'POST' }
        );

        if (!response.ok) {
            throw new Error('Error al eliminar la localidad');
        }
    }

    async loadLocalities() {
        try {
            this.showLoading();
            this.errorMessage.innerHTML = '';

            const response = await fetch(`${this.API_BASE}/localidad/listar`);
            console.log('Response status:', response.status);

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            console.log('Datos recibidos:', data);

            // Validar y convertir la respuesta
            if (Array.isArray(data)) {
                this.localities = data;
            } else if (data && typeof data === 'object') {
                // Si es un objeto, intentar extraer array de propiedades comunes
                this.localities = data.data || data.localidades || data.items || [];
            } else {
                this.localities = [];
            }

            console.log('Localidades después de procesar:', this.localities);
            this.renderLocalities();
        } catch (error) {
            console.error('Error al cargar localidades:', error);
            this.showError(error.message);
            this.localities = [];
            this.renderLocalities();
        }
    }

    renderLocalities() {
        console.log('Renderizando localidades:', this.localities);

        if (this.localities.length === 0) {
            this.localitiesContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🗺️</div>
                    <h3>No hay localidades registradas</h3>
                    <p>Crea tu primera localidad para comenzar</p>
                    <button class="btn-new" onclick="app.showForm()">
                        <span>➕</span>
                        <span>Nueva Localidad</span>
                    </button>
                </div>
            `;
            return;
        }

        const cardsHTML = this.localities.map((locality, index) => this.createLocalityCard(locality, index)).join('');
        this.localitiesContainer.innerHTML = `<div class="localities-grid">${cardsHTML}</div>`;

        // Adjuntar event listeners a los botones de edición y eliminación
        setTimeout(() => {
            this.localities.forEach(locality => {
                const editBtn = document.getElementById(`edit-${locality.id}`);
                const deleteBtn = document.getElementById(`delete-${locality.id}`);

                if (editBtn) {
                    editBtn.addEventListener('click', () => this.showForm(locality));
                }

                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => this.handleDelete(locality.id));
                }
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
                        <span>✎</span>
                        <span>Editar</span>
                    </button>
                    <button class="btn-delete" id="delete-${locality.id}">
                        <span>🗑</span>
                        <span>Eliminar</span>
                    </button>
                </div>
            </div>
        `;
    }

    getCountryFlag(countryName) {
        return this.countryFlags[countryName] || '📍';
    }

    async handleDelete(id) {
        const locality = this.localities.find(l => l.id === id);
        const localityName = locality ? `${locality.localidad_nombre}, ${locality.localidad_pais}` : 'esta localidad';

        if (!window.confirm(`¿Estás seguro de que deseas eliminar "${localityName}"?`)) {
            return;
        }

        try {
            this.setSubmitLoading(true);
            this.errorMessage.innerHTML = '';
            await this.deleteLocality(id);
            await this.loadLocalities();
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
        this.localitiesContainer.innerHTML = `
            <div class="loading-container">
                <div class="spinner"></div>
                <p class="loading-text">Cargando localidades...</p>
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
    window.app = new LocalidadABM();
});