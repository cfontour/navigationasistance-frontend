// usuarios.js

$(document).ready(function () {
    const usuarioStr = localStorage.getItem("usuarioLogueado");
    if (!usuarioStr) return;

    const usuario = JSON.parse(usuarioStr);
    actualizarEmailDelUsuario();
    mostrarItemRespaldoSiUsuarioLogueado();

    if (usuario.rol === "ADMINISTRADOR") {
        cargarUsuarios();
        $('#usuarios').DataTable();
    } else {
        mostrarVistaSoloDelUsuario(usuario);
    }
});

function getHeaders() {
    return {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    };
}

function actualizarEmailDelUsuario() {
    const email = localStorage.getItem('usuarioEmail');
    if (email) {
        document.getElementById('txt-email-usuario').innerText = email;
    }
}

async function cargarUsuarios() {
    const request = await fetch('https://navigationasistance-backend-1.onrender.com/usuarios/listar', {
        method: 'GET',
        headers: getHeaders()
    });

    const usuarios = await request.json();
    let listadoHtml = '';

    for (let usuario of usuarios) {
        let botonEliminar = `<a href="#" onclick="eliminarUsuario('${usuario.id}')" class="btn btn-danger btn-circle btn-sm"><i class="fas fa-trash"></i></a>`;
        let usuarioHtml = `<tr>
            <td>${usuario.id}</td>
            <td>${usuario.nombre} ${usuario.apellido}</td>
            <td>${usuario.email}</td>
            <td>${usuario.telefono || ''}</td>
            <td>${botonEliminar}</td>
        </tr>`;
        listadoHtml += usuarioHtml;
    }

    document.querySelector('#usuarios tbody').innerHTML = listadoHtml;
}

async function eliminarUsuario(id) {
    if (!confirm('¿Desea eliminar el usuario?')) return;

    await fetch('https://navigationasistance-backend-1.onrender.com/usuarios/eliminar/' + id, {
        method: 'DELETE',
        headers: getHeaders()
    });

    cargarUsuarios();
}

async function agregarUsuario() {
    const id = document.getElementById('inputId').value.trim();
    const nombre = document.getElementById('inputNombre').value.trim();
    const apellido = document.getElementById('inputApellido').value.trim();
    const email = document.getElementById('inputEmail').value.trim();
    const password = document.getElementById('inputPassword').value.trim();
    const telefono = document.getElementById('inputTelefono').value.trim();

    if (!id || !nombre || !apellido || !email || !password) {
        alert("Por favor, completa todos los campos obligatorios.");
        return;
    }

    const usuario = { id, nombre, apellido, email, password, telefono };

    try {
        const response = await fetch('https://navigationasistance-backend-1.onrender.com/usuarios/agregar', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(usuario)
        });

        const resultado = await response.text();
        alert(resultado);

        document.getElementById('formAgregarUsuario').reset();
        cargarUsuarios();
    } catch (error) {
        console.error("Error al agregar usuario:", error);
        alert("No se pudo agregar el usuario. Intente nuevamente.");
    }
}

function mostrarItemRespaldoSiUsuarioLogueado() {
    const userStr = localStorage.getItem("usuarioLogueado");
    const itemRespaldo = document.getElementById("item-respaldo");

    if (userStr && itemRespaldo) {
        itemRespaldo.classList.remove("d-none");
    }
}

// ✅ NUEVO: Vista restringida solo para rol USUARIO
function mostrarVistaSoloDelUsuario(usuario) {
    document.getElementById("card-formulario").classList.add("d-none");
    document.getElementById("card-tabla").classList.add("d-none");

    const container = document.querySelector(".container-fluid");
    const card = document.createElement("div");
    card.className = "card mb-4";
    card.innerHTML = `
        <div class="card-header">Tus datos</div>
        <div class="card-body">
            <table class="table table-bordered">
                <thead><tr><th>ID</th><th>Nombre Completo</th><th>Email</th></tr></thead>
                <tbody>
                    <tr>
                        <td>${usuario.id}</td>
                        <td>${usuario.nombre} ${usuario.apellido}</td>
                        <td>${usuario.email}</td>
                        <td>${usuario.telefono}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
    container.appendChild(card);
}
