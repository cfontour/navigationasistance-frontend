// Call the dataTables jQuery plugin
$(document).ready(function() {
    //on ready
});

async function registrarUsuario() {
    let datos = {};
    datos.id = document.getElementById('txtId').value.trim();
    datos.nombre = document.getElementById('txtNombre').value.trim();
    datos.apellido = document.getElementById('txtApellido').value.trim();
    datos.email = document.getElementById('txtEmail').value.trim();
    datos.telefono = document.getElementById('txtTelefono').value.trim();
    datos.password = document.getElementById('txtPassword').value;

    let repetirPassword = document.getElementById('txtRepetirPassword').value;

    if (repetirPassword !== datos.password) {
        alert('La contraseña ingresada es diferente!');
        return;
    }

    try {
        const response = await fetch('https://navigationasistance-backend-1.onrender.com/usuarios/agregar', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(datos)
        });

        const mensaje = await response.text();

        alert(mensaje);
        if (mensaje.includes("éxito")) {
            window.location.href = 'usuarios.html';
        }

    } catch (error) {
        console.error("Error al registrar usuario:", error);
        alert("Ocurrió un error al registrar el usuario.");
    }
}
