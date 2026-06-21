"use client";

import { useRef, useState } from "react";
import type { AnalisisLab, DatosPaciente } from "@/app/lib/analizar-lab";
import type { ChatMsg } from "@/app/lib/sesiones";

export default function ChatSeguimiento({
  analisis,
  datos,
  mensajes,
  onMensajes,
}: {
  analisis: AnalisisLab;
  datos: DatosPaciente;
  mensajes: ChatMsg[];
  onMensajes: (msgs: ChatMsg[]) => void;
}) {
  const [texto, setTexto] = useState("");
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function agregarAdjuntos(fs: File[]) {
    setError(null);
    setAdjuntos((prev) => [...prev, ...fs]);
  }
  function quitarAdjunto(i: number) {
    setAdjuntos((prev) => prev.filter((_, j) => j !== i));
  }

  async function enviar() {
    const pregunta = texto.trim();
    if ((!pregunta && adjuntos.length === 0) || cargando) return;
    // Si solo adjunta archivos sin escribir, ponemos una instrucción por defecto.
    const textoFinal =
      pregunta ||
      "Te adjunto estos nuevos estudios. Intégralos al diagnóstico y dime qué cambia.";
    // En la burbuja se muestra qué documentos se adjuntaron.
    const nota =
      adjuntos.length > 0
        ? `\n\n📎 ${adjuntos.length} documento(s) adjunto(s): ${adjuntos
            .map((f) => f.name)
            .join(", ")}`
        : "";
    const nuevos: ChatMsg[] = [
      ...mensajes,
      { role: "user", content: textoFinal + nota },
    ];
    onMensajes(nuevos);
    const archivos = adjuntos;
    setTexto("");
    setAdjuntos([]);
    setError(null);
    setCargando(true);
    try {
      const fd = new FormData();
      fd.append("analisis", JSON.stringify(analisis));
      fd.append("datos", JSON.stringify(datos ?? {}));
      fd.append("messages", JSON.stringify(nuevos));
      archivos.forEach((f) => fd.append("adjuntos", f));
      const res = await fetch("/api/chat", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error en el chat.");
      onMensajes([...nuevos, { role: "assistant", content: json.respuesta }]);
      setTimeout(() => finRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error en el chat.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <section className="mt-10 no-print">
      <div className="mb-3">
        <h2 className="text-xl font-bold text-hb-purpura uppercase tracking-wide">
          Seguir la conversación
        </h2>
        <span className="sello-dorado" />
      </div>
      <p className="text-sm text-hb-grisOsc/60 mb-4">
        Pregunta lo que quieras sobre este estudio. El análisis de arriba se
        mantiene.
      </p>

      {mensajes.length > 0 && (
        <div className="space-y-3 mb-4">
          {mensajes.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-hb-purpura text-white px-4 py-2 whitespace-pre-wrap"
                    : "max-w-[90%] rounded-2xl rounded-bl-sm bg-white/70 border border-hb-dorado/30 text-hb-grisOsc px-4 py-3 whitespace-pre-wrap"
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {cargando && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-white/70 border border-hb-dorado/30 px-4 py-3 text-hb-grisOsc/60 animate-pulse">
                Pensando…
              </div>
            </div>
          )}
          <div ref={finRef} />
        </div>
      )}

      {error && (
        <p className="text-sm text-hb-magfuerte font-semibold mb-2">{error}</p>
      )}

      {/* Archivos por adjuntar en el próximo mensaje */}
      {adjuntos.length > 0 && (
        <ul className="mb-2 space-y-1">
          {adjuntos.map((f, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl bg-white/70 border border-hb-dorado/30 px-3 py-1.5"
            >
              <span className="text-sm text-hb-purpura font-semibold break-all">
                📎 {f.name}
              </span>
              <button
                type="button"
                onClick={() => quitarAdjunto(i)}
                className="flex-none text-sm text-hb-grisOsc/50 hover:text-hb-magfuerte transition-colors"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          agregarAdjuntos(Array.from(e.target.files ?? []));
          if (fileRef.current) fileRef.current.value = "";
        }}
      />

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title="Adjuntar nuevos estudios (PDF o imágenes)"
          className="flex-none rounded-2xl border border-hb-purpura/40 text-hb-purpura font-bold px-4 py-3 hover:bg-hb-purpura/10 transition-colors"
        >
          + Estudio
        </button>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          rows={2}
          placeholder="Pregunta o adjunta nuevos estudios con “+ Estudio”…"
          className="flex-1 rounded-2xl border border-hb-dorado/40 bg-white px-4 py-2 resize-y"
        />
        <button
          type="button"
          onClick={enviar}
          disabled={(!texto.trim() && adjuntos.length === 0) || cargando}
          className="flex-none rounded-2xl bg-hb-purpura text-white font-bold px-5 py-3 disabled:opacity-40 hover:bg-hb-purpura/90 transition-colors"
        >
          Enviar
        </button>
      </div>
    </section>
  );
}
