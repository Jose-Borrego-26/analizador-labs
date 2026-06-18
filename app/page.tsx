"use client";

import { useEffect, useRef, useState } from "react";
import type { AnalisisLab, DatosPaciente, Sexo } from "@/app/lib/analizar-lab";
import Resultado from "@/app/components/Resultado";
import ChatSeguimiento from "@/app/components/ChatSeguimiento";
import {
  cargarSesiones,
  guardarSesiones,
  nuevoId,
  tituloSesion,
  type ChatMsg,
  type Sesion,
} from "@/app/lib/sesiones";

function SelectorArchivos({
  archivos,
  onAgregar,
  onQuitar,
  etiqueta,
}: {
  archivos: File[];
  onAgregar: (fs: File[]) => void;
  onQuitar: (i: number) => void;
  etiqueta: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={ref}
        type="file"
        multiple
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          onAgregar(Array.from(e.target.files ?? []));
          if (ref.current) ref.current.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="w-full rounded-2xl border-2 border-dashed border-hb-purpura/40 py-8 px-4 text-center hover:border-hb-magenta transition-colors"
      >
        <span className="text-hb-grisOsc/60">{etiqueta}</span>
      </button>
      {archivos.length > 0 && (
        <ul className="mt-3 space-y-2">
          {archivos.map((f, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl bg-white/70 border border-hb-dorado/30 px-3 py-2"
            >
              <span className="text-sm text-hb-purpura font-semibold break-all">
                {f.name}
              </span>
              <button
                type="button"
                onClick={() => onQuitar(i)}
                className="flex-none text-sm text-hb-grisOsc/50 hover:text-hb-magfuerte transition-colors"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fechaCorta(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function Home() {
  const [archivos, setArchivos] = useState<File[]>([]);
  const [anteriores, setAnteriores] = useState<File[]>([]);
  const [mostrarComparar, setMostrarComparar] = useState(false);
  const [nombre, setNombre] = useState("");
  const [sexo, setSexo] = useState<Sexo>("");
  const [edad, setEdad] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [notas, setNotas] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Historial tipo "chats": cada paciente es una sesión independiente.
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [activaId, setActivaId] = useState<string | null>(null);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [listo, setListo] = useState(false);

  // Carga el historial al montar (sobrevive recargas y cierre del navegador).
  useEffect(() => {
    setSesiones(cargarSesiones());
    setListo(true);
  }, []);

  // Persiste cada cambio del historial.
  useEffect(() => {
    if (listo) guardarSesiones(sesiones);
  }, [sesiones, listo]);

  const sesionActiva = sesiones.find((s) => s.id === activaId) ?? null;

  function limpiarFormulario() {
    setArchivos([]);
    setAnteriores([]);
    setMostrarComparar(false);
    setNombre("");
    setSexo("");
    setEdad("");
    setObjetivo("");
    setNotas("");
    setError(null);
  }

  function nuevoAnalisis() {
    setActivaId(null);
    setMostrarHistorial(false);
    limpiarFormulario();
  }

  function abrirSesion(id: string) {
    setActivaId(id);
    setMostrarHistorial(false);
    setError(null);
  }

  function eliminarSesion(id: string) {
    setSesiones((prev) => prev.filter((s) => s.id !== id));
    if (activaId === id) setActivaId(null);
  }

  function actualizarChat(id: string, chat: ChatMsg[]) {
    setSesiones((prev) =>
      prev.map((s) => (s.id === id ? { ...s, chat } : s)),
    );
  }

  function agregarArchivos(fs: File[]) {
    setError(null);
    setArchivos((prev) => [...prev, ...fs]);
  }
  function quitarArchivo(i: number) {
    setArchivos((prev) => prev.filter((_, j) => j !== i));
  }

  async function analizar() {
    if (archivos.length === 0) return;
    setCargando(true);
    setError(null);
    try {
      const fd = new FormData();
      archivos.forEach((f) => fd.append("archivos", f));
      anteriores.forEach((f) => fd.append("anteriores", f));
      if (sexo) fd.append("sexo", sexo);
      if (edad) fd.append("edad", edad);
      if (objetivo.trim()) fd.append("objetivo", objetivo.trim());
      if (notas.trim()) fd.append("notasCoach", notas.trim());
      const res = await fetch("/api/analizar", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al analizar.");
      const nuevoData = json as AnalisisLab;
      const nuevosDatos: DatosPaciente = {
        sexo,
        edad: edad ? Number(edad) : null,
        objetivo: objetivo.trim(),
        notasCoach: notas.trim(),
      };
      const sesion: Sesion = {
        id: nuevoId(),
        titulo: tituloSesion(nombre, nuevoData, nuevosDatos),
        creadoEn: Date.now(),
        data: nuevoData,
        datos: nuevosDatos,
        chat: [],
      };
      setSesiones((prev) => [sesion, ...prev]);
      setActivaId(sesion.id);
      limpiarFormulario();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al analizar.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-5 py-10">
      <header className="text-center mb-6 no-print">
        <h1 className="text-3xl font-bold text-hb-purpura uppercase tracking-wide">
          Analizador de Laboratorios
        </h1>
        <span className="sello-dorado mx-auto" />
        <p className="text-hb-grisOsc/70 mt-3">
          Sube uno o varios estudios y obtén interpretación, causas probables y
          soluciones.
        </p>
      </header>

      {/* Barra de historial */}
      <div className="flex items-center justify-between gap-2 mb-6 no-print">
        <button
          type="button"
          onClick={nuevoAnalisis}
          className="rounded-xl bg-hb-purpura text-white font-semibold px-4 py-2 hover:bg-hb-purpura/90 transition-colors"
        >
          + Nuevo análisis
        </button>
        <button
          type="button"
          onClick={() => setMostrarHistorial((v) => !v)}
          className="rounded-xl border border-hb-purpura/40 text-hb-purpura font-semibold px-4 py-2 hover:bg-hb-purpura/10 transition-colors"
        >
          Mis análisis ({sesiones.length})
        </button>
      </div>

      {mostrarHistorial && (
        <section className="rounded-3xl border border-hb-dorado/40 bg-white/50 p-4 mb-6 no-print">
          {sesiones.length === 0 ? (
            <p className="text-sm text-hb-grisOsc/60 px-2 py-3">
              Aún no hay análisis guardados. Crea uno con “+ Nuevo análisis”.
            </p>
          ) : (
            <ul className="space-y-2">
              {sesiones.map((s) => (
                <li
                  key={s.id}
                  className={
                    "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 " +
                    (s.id === activaId
                      ? "border-hb-purpura bg-hb-purpura/10"
                      : "border-hb-dorado/30 bg-white/70")
                  }
                >
                  <button
                    type="button"
                    onClick={() => abrirSesion(s.id)}
                    className="flex-1 text-left"
                  >
                    <span className="block text-sm font-bold text-hb-purpura break-words">
                      {s.titulo}
                    </span>
                    <span className="block text-xs text-hb-grisOsc/50">
                      {fechaCorta(s.creadoEn)}
                      {s.chat.length > 0 ? ` · ${s.chat.length} mensajes` : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => eliminarSesion(s.id)}
                    className="flex-none text-sm text-hb-grisOsc/50 hover:text-hb-magfuerte transition-colors"
                  >
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Zona de subida (solo cuando no hay una sesión abierta) */}
      {!sesionActiva && (
        <section className="rounded-3xl border border-hb-dorado/40 bg-white/50 p-6 mb-8 no-print">
          <SelectorArchivos
            archivos={archivos}
            onAgregar={agregarArchivos}
            onQuitar={quitarArchivo}
            etiqueta="Toca para elegir uno o varios PDF/imágenes del estudio"
          />

          {/* Comparar con estudio anterior */}
          {!mostrarComparar ? (
            <button
              type="button"
              onClick={() => setMostrarComparar(true)}
              className="mt-3 text-sm text-hb-purpura font-semibold hover:text-hb-magenta transition-colors"
            >
              + Comparar con un estudio anterior
            </button>
          ) : (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase text-hb-purpura/80 mb-2">
                Estudio anterior (para ver evolución)
              </p>
              <SelectorArchivos
                archivos={anteriores}
                onAgregar={(fs) => {
                  setError(null);
                  setAnteriores((prev) => [...prev, ...fs]);
                }}
                onQuitar={(i) =>
                  setAnteriores((prev) => prev.filter((_, j) => j !== i))
                }
                etiqueta="Toca para elegir el/los documento(s) anterior(es)"
              />
              <button
                type="button"
                onClick={() => {
                  setAnteriores([]);
                  setMostrarComparar(false);
                }}
                className="mt-2 text-sm text-hb-grisOsc/60 hover:text-hb-magfuerte transition-colors"
              >
                Quitar comparación
              </button>
            </div>
          )}

          {/* Datos opcionales del paciente */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="text-sm col-span-2">
              <span className="block text-hb-purpura/80 font-semibold mb-1">
                Nombre o etiqueta (opcional)
              </span>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. María G. — para encontrarlo en el historial"
                className="w-full rounded-xl border border-hb-dorado/40 bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="block text-hb-purpura/80 font-semibold mb-1">
                Sexo (opcional)
              </span>
              <select
                value={sexo}
                onChange={(e) => setSexo(e.target.value as Sexo)}
                className="w-full rounded-xl border border-hb-dorado/40 bg-white px-3 py-2"
              >
                <option value="">—</option>
                <option value="F">Femenino</option>
                <option value="M">Masculino</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-hb-purpura/80 font-semibold mb-1">
                Edad (opcional)
              </span>
              <input
                type="number"
                min={0}
                max={120}
                value={edad}
                onChange={(e) => setEdad(e.target.value)}
                placeholder="años"
                className="w-full rounded-xl border border-hb-dorado/40 bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm col-span-2">
              <span className="block text-hb-purpura/80 font-semibold mb-1">
                Objetivo (opcional)
              </span>
              <input
                type="text"
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                placeholder="Ej. bajar grasa, mejorar tiroides, fertilidad…"
                className="w-full rounded-xl border border-hb-dorado/40 bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm col-span-2">
              <span className="block text-hb-purpura/80 font-semibold mb-1">
                Notas del coach / lo que dijo el doctor (opcional)
              </span>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                placeholder="Ej. el doctor dijo que la TSH alta es por hipotiroidismo subclínico; sospecho resistencia a la insulina; toma anticonceptivos…"
                className="w-full rounded-xl border border-hb-dorado/40 bg-white px-3 py-2 resize-y"
              />
              <span className="block text-xs text-hb-grisOsc/50 mt-1">
                La IA lo toma como contexto, pero hace su propio análisis
                independiente.
              </span>
            </label>
          </div>

          <button
            type="button"
            disabled={archivos.length === 0 || cargando}
            onClick={analizar}
            className="mt-5 w-full rounded-2xl bg-hb-purpura text-white font-bold py-3 disabled:opacity-40 hover:bg-hb-purpura/90 transition-colors"
          >
            {cargando ? "Analizando estudio…" : "Analizar"}
          </button>

          {error && (
            <p className="mt-3 text-sm text-hb-magfuerte font-semibold">{error}</p>
          )}
        </section>
      )}

      {cargando && (
        <p className="text-center text-hb-grisOsc/60 animate-pulse no-print">
          Leyendo el estudio y generando interpretación, causas y soluciones…
        </p>
      )}

      {sesionActiva && (
        <>
          <div className="flex items-center justify-between gap-2 mb-4 no-print">
            <h2 className="text-lg font-bold text-hb-purpura break-words">
              {sesionActiva.titulo}
            </h2>
            <div className="flex flex-none gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl border border-hb-purpura/40 text-hb-purpura font-semibold px-4 py-2 hover:bg-hb-purpura hover:text-white transition-colors"
              >
                Imprimir / PDF
              </button>
            </div>
          </div>
          <div id="reporte">
            <Resultado data={sesionActiva.data} />
          </div>
          <ChatSeguimiento
            key={sesionActiva.id}
            analisis={sesionActiva.data}
            datos={sesionActiva.datos}
            mensajes={sesionActiva.chat}
            onMensajes={(msgs) => actualizarChat(sesionActiva.id, msgs)}
          />
        </>
      )}
    </main>
  );
}
