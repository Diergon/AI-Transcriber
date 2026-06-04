<script setup>
import { ref, computed } from "vue";

const file = ref(null);
const isDragging = ref(false);
const loading = ref(false);
const summary = ref("");
const error = ref("");

const selectedName = computed(() => {
  return file.value ? file.value.name : "Ningún archivo seleccionado";
});

function handleFileChange(event) {
  const selected = event.target.files?.[0];
  if (selected) {
    file.value = selected;
    error.value = "";
  }
}

function handleDragOver(event) {
  event.preventDefault();
  isDragging.value = true;
}

function handleDragLeave() {
  isDragging.value = false;
}

function handleDrop(event) {
  event.preventDefault();
  isDragging.value = false;
  const dropped = event.dataTransfer?.files?.[0];
  if (dropped && dropped.type.startsWith("audio/")) {
    file.value = dropped;
    error.value = "";
  } else if (dropped) {
    error.value = "Solo se permiten archivos de audio.";
  }
}

async function submitAudio() {
  if (!file.value) {
    error.value = "Selecciona un archivo de audio primero.";
    return;
  }

  loading.value = true;
  summary.value = "";
  error.value = "";

  const form = new FormData();
  form.append("audio", file.value);

  try {
    const response = await fetch("http://localhost:3000/api/transcribe", {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "Error al procesar el audio.");
    }

    const data = await response.json();
    summary.value = data?.geminiResponse || data?.resumen || "Resumen no disponible.";
  } catch (err) {
    error.value = err?.message || "Ocurrió un error inesperado.";
  } finally {
    loading.value = false;
  }
}

function downloadSummary() {
  if (!summary.value) return;
  const blob = new Blob([summary.value], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "resumen-reunion.md";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="app-shell">
    <section class="card pane">
      <div class="hero">
        <div>
          <p class="eyebrow">Transcripción de reuniones</p>
          <h1>Sube tu audio y deja que la IA genere el resumen.</h1>
        </div>
      </div>

      <div
        class="drop-zone"
        :class="{ dragging: isDragging }"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
      >
        <p>Arrastra tu archivo de audio aquí o haz clic para seleccionar.</p>
        <input type="file" accept="audio/*" @change="handleFileChange" />
        <strong>{{ selectedName }}</strong>
      </div>

      <div class="actions">
        <button class="primary" @click="submitAudio" :disabled="loading">
          {{ loading ? "Procesando reunión con IA..." : "Enviar audio" }}
        </button>
        <button class="secondary" @click="downloadSummary" :disabled="!summary">
          Descargar Resumen
        </button>
      </div>

      <div class="status">
        <p v-if="error" class="error">{{ error }}</p>
        <p v-else-if="loading" class="loading">Procesando reunión con IA...</p>
        <p v-else-if="summary" class="success">Resumen generado correctamente.</p>
      </div>

      <div v-if="summary" class="result-card">
        <h2>Resumen estructurado</h2>
        <pre>{{ summary }}</pre>
      </div>
    </section>
  </div>
</template>

<style scoped>
:root {
  color-scheme: light;
}

body {
  margin: 0;
  font-family: Inter, system-ui, sans-serif;
}

.app-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
}

.card {
  width: min(100%, 720px);
  background: #ffffff;
  border-radius: 28px;
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.12);
  padding: 2rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.75rem;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.25em;
  color: #6366f1;
  font-size: 0.8rem;
  margin: 0;
}

h1 {
  margin: 0;
  font-size: clamp(2rem, 2.5vw, 2.8rem);
  line-height: 1.05;
  color: #0f172a;
}

.drop-zone {
  position: relative;
  display: grid;
  place-items: center;
  gap: 1rem;
  padding: 2rem;
  border: 2px dashed #c7d2fe;
  border-radius: 20px;
  background: #f8fafc;
  text-align: center;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.drop-zone.dragging {
  border-color: #7c3aed;
  background: #eef2ff;
}

.drop-zone p {
  margin: 0;
  color: #475569;
  font-size: 1rem;
}

.drop-zone input[type="file"] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.drop-zone strong {
  color: #0f172a;
  font-size: 0.95rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1.5rem;
}

button {
  border: none;
  border-radius: 14px;
  padding: 0.95rem 1.4rem;
  font-size: 1rem;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

button.primary {
  background: #4338ca;
  color: #ffffff;
  box-shadow: 0 14px 30px rgba(67, 56, 202, 0.18);
}

button.primary:hover:not(:disabled) {
  transform: translateY(-1px);
}

button.secondary {
  background: #eef2ff;
  color: #4338ca;
}

button.secondary:hover:not(:disabled) {
  transform: translateY(-1px);
}

.status {
  margin-top: 1rem;
  min-height: 1.4rem;
}

.loading,
.success,
.error {
  margin: 0;
  font-weight: 600;
}

.loading {
  color: #2563eb;
}

.success {
  color: #16a34a;
}

.error {
  color: #dc2626;
}

.result-card {
  margin-top: 1.75rem;
  padding: 1.5rem;
  background: #f8fafc;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.result-card h2 {
  margin: 0 0 1rem;
  font-size: 1.2rem;
  color: #111827;
}

.result-card pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: 0.95rem;
  line-height: 1.7;
  color: #334155;
}
</style>
