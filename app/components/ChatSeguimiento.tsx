"use client";

import { useEffect, useRef, useState } from "react";
import type { AnalisisLab, DatosPaciente } from "@/app/lib/analizar-lab";

const LS_CHAT = "analizador-labs:chat";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export default function ChatSeguimiento({
  analisis,
  datos,
}: {
  analisis: AnalisisLab;
  datos: DatosPaciente;
}) {
  const [mensajes, setMensajes] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  // Rehidrata la conversación para que no se pierda ante recargas/HMR.
  useEffect(() => {
    try {
      const c = sessionStorage.getItem(LS_CHAT);
      if (c) setMensajes(JSON.parse(c) as Msg[]);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    try {
      if (mensajes.length > 0)
        sessionStorage.setItem(LS_CHAT, JSON.stringify(mensajes));
      else sessionStorage.removeItem(LS_CHAT);
    } catch {
      /* noop */
    }
  }, [mensajes]);

  async function enviar() {
    const pregunta = texto.trim();
    if (!pregunta || cargando) return;
    const nuevos: Msg[] = [...mensajes, { role: "user", content: pregunta }];
    setMensajes(nuevos);
    setTexto("");
    setError(null);
    setCargando(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analisis, datos, messages: nuevos }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error en el chat.");
      setMensajes([...nuevos, { role: "assistant", content: json.respuesta }]);
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

      <div className="flex items-end gap-2">
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
          placeholder="Ej. ¿Qué le doy para subir la vitamina D? ¿La insulina alta es grave?"
          className="flex-1 rounded-2xl border border-hb-dorado/40 bg-white px-4 py-2 resize-y"
        />
        <button
          type="button"
          onClick={enviar}
          disabled={!texto.trim() || cargando}
          className="flex-none rounded-2xl bg-hb-purpura text-white font-bold px-5 py-3 disabled:opacity-40 hover:bg-hb-purpura/90 transition-colors"
        >
          Enviar
        </button>
      </div>
    </section>
  );
}
