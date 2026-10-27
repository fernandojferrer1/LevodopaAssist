import app from "./app";

const port = process.env.PORT ?? 4000;

app.listen(port, (err?: Error) => {
  if (err) {
    console.error(`No se pudo abrir el puerto ${port}: ${err.message}`);
    if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
      console.error(
        `Otro programa ya usa el puerto ${port}. Cerralo o ejecuta diagnostico.cmd para ver cuál es.`
      );
    }
    process.exit(1);
  }
  console.log(`Backend escuchando en http://localhost:${port}`);
});
