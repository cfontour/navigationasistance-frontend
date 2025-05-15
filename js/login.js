document.getElementById("txtId").addEventListener("blur", validarIdExistente);

async function validarIdExistente() {
    const id = document.getElementById("txtId").value.trim();
    const botonLogin = document.querySelector(".btn-user");

    if (!id) {
        botonLogin.disabled = true;
        return;
    }

    try {
        const res = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${encodeURIComponent(id)}`);
        if (res.ok) {
            botonLogin.disabled = false;
        } else {
            botonLogin.disabled = true;
            alert("El ID ingresado no existe en el sistema.");
        }
    } catch (error) {
        console.error("Error al validar ID:", error);
        botonLogin.disabled = true;
    }
}

function iniciarSesion() {
    const id = document.getElementById("txtId").value.trim();
    const password = document.getElementById("txtPassword").value.trim();

    if (!id || !password) {
        alert("Por favor, completa todos los campos.");
        return;
    }

    const url = `https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${encodeURIComponent(id)}`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error("Usuario no encontrado");
            }
            return response.json();
        })
        .then(usuario => {
            if (!usuario || !usuario.password) {
                alert("Usuario inválido o sin contraseña registrada.");
                return;
            }

            if (usuario.password.trim() === password) {
                localStorage.setItem("usuarioLogueado", JSON.stringify(usuario));
                window.location.href = "https://navigationasistance.ddns.net:8083/usuarios.html";
            } else {
                alert("Contraseña incorrecta.");
            }
        })
        .catch(error => {
            console.error("Error al iniciar sesión:", error);
            alert("No se pudo iniciar sesión. Verifica tus datos.");
        });
}
