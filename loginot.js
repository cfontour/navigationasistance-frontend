async function login() {
    const usuario = document.getElementById("usuario").value;
    const password = document.getElementById("password").value;

    if (!usuario || !password) {
        alert("Debe ingresar usuario y contraseña");
        return;
    }

    try {
        const backendUrl = "https://navigationasistance-backend-1.onrender.com";

        const res = await fetch(`${backendUrl}/login/${usuario}/${password}`, {
            method: "GET",
            credentials: "include"
        });

        if (res.status === 200) {
            const data = await res.json();
            const token = data.token;

            // 🔑 Guardar JWT en localStorage
            localStorage.setItem("authToken", token);

            window.location.href = "menuop.html";
        } else {
            alert("Usuario o contraseña incorrecto");
        }

    } catch (e) {
        console.error("Error en login:", e);
        alert("Error de conexión con el servidor");
    }
}