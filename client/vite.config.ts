import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En Docker el server se llama "server"; fuera de Docker, localhost
const API_URL = process.env.API_URL ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': API_URL },
    // Bind mounts de Windows no emiten eventos de archivos dentro del contenedor
    watch: process.env.CHOKIDAR_USEPOLLING ? { usePolling: true } : undefined
  }
});
