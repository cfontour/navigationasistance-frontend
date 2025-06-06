document.addEventListener("DOMContentLoaded", () => {
    const usuarioInfo = document.getElementById("usuario-info");
    const userStr = localStorage.getItem("usuarioLogueado");

    if (!userStr) {
        usuarioInfo.textContent = "No hay usuario logueado.";
        return;
    }

    try {
        const user = JSON.parse(userStr);
        if (!user.id) {
            usuarioInfo.textContent = "Usuario sin ID.";
            return;
        }

        fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${user.id}`)
            .then(res => {
                if (!res.ok) throw new Error("Error al obtener usuario");
                return res.json();
            })
            .then(usuario => {
                usuarioInfo.textContent = `ID: ${usuario.id} - ${usuario.nombre} ${usuario.apellido}`;
            })
            .catch(error => {
                console.error("Error al cargar usuario desde backend:", error);
                usuarioInfo.textContent = "No se pudo cargar el usuario.";
            });

    } catch (e) {
        usuarioInfo.textContent = "No se pudo interpretar el usuario local.";
    }
});
