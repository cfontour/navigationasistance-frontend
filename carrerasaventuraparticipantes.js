<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Participantes Carrera de Aventura</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css">
  <style>
    .dual-list {
      display: flex;
      justify-content: space-around;
      margin: 20px;
    }
    select {
      width: 300px;
      height: 300px;
    }
    .buttons {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 10px;
    }
    table {
      margin: 20px auto;
      width: 90%;
    }
  </style>
</head>
<body>
  <section class="section">
    <h1 class="title has-text-centered">Participantes - Carrera de Aventura</h1>

    <div class="dual-list">
      <div>
        <h2 class="subtitle">USUARIOS</h2>
        <select id="usuariosDisponibles" multiple></select>
      </div>

      <div class="buttons">
        <button class="button is-primary" onclick="asignarUsuarios()">➤</button>
      </div>

      <div>
        <h2 class="subtitle">COMPETIDORES CARRERA DE AVENTURAS</h2>
        <select id="usuariosAsignados" multiple disabled></select>
      </div>
    </div>

    <div class="table-container">
      <h2 class="subtitle has-text-centered">Grilla de Participantes</h2>
      <table class="table is-striped is-fullwidth">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Apellido</th>
            <th>Email</th>
            <th>Teléfono</th>
          </tr>
        </thead>
        <tbody id="tablaParticipantes"></tbody>
      </table>
    </div>
  </section>

  <script src="carrerasaventuraparticipantes.js"></script>
</body>
</html>
