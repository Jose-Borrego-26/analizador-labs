"use client";

import { useRef, useState } from "react";
import type { AnalisisLab, Sexo } from "@/app/lib/analizar-lab";
import Resultado from "@/app/components/Resultado";

function SelectorArchivo({
  archivo,
  onElegir,
  etiqueta,
}: {
  archivo: File | null;
  onElegir: (f: File | null) => void;
  etiqueta: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onElegir(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="w-full rounded-2xl border-2 border-dashed border-hb-purpura/40 py-8 px-4 text-center hover:border-hb-magenta transition-colors"
      >
        {archivo ? (
          <span className="text-hb-purpura font-semibold break-all">
            {archivo.name}
          </span>
        ) : (
          <span className="text-hb-grisOsc/60">{etiqueta}</span>
        )}
      </button>
    </div>
  );
}

export default function Home() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [anterior, setAnterior] = useState<File | null>(null);
  const [mostrarComparar, setMostrarComparar] = useState(false);
  const [sexo, setSexo] = useState<Sexo>("");
  const [edad, setEdad] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalisisLab | null>(null);

  function elegir(f: File | null) {
    setError(null);
    setData(null);
    setArchivo(f);
  }

  async function analizar() {
    if (!archivo) return;
    setCargando(true);
    setError(null);
    setData(null);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      if (anterior) fd.append("anterior", anterior);
      if (sexo) fd.append("sexo", sexo);
      if (edad) fd.append("edad", edad);
      if (objetivo.trim()) fd.append("objetivo", objetivo.trim());
      const res = await fetch("/api/analizar", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al analizar.");
      setData(json as AnalisisLab);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al analizar.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-5 py-10">
      <header className="text-center mb-8 no-print">
        <h1 className="text-3xl font-bold text-hb-purpura uppercase tracking-wide">
          Analizador de Laboratorios
        </h1>
        <span className="sello-dorado mx-auto" />
        <p className="text-hb-grisOsc/70 mt-3">
          Sube un estudio y obtén interpretación, causas probables y soluciones.
        </p>
      </header>

      {/* Zona de subida */}
      <section className="rounded-3xl border border-hb-dorado/40 bg-white/50 p-6 mb-8 no-print">
        <SelectorArchivo
          archivo={archivo}
          onElegir={elegir}
          etiqueta="Toca para elegir un PDF o imagen del estudio"
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
          <div className="mt-3">
            <p className="text-xs font-bold uppercase text-hb-purpura/80 mb-2">
              Estudio anterior (para ver evolución)
            </p>
            <SelectorArchivo
              archivo={anterior}
              onElegir={(f) => {
                setError(null);
                setAnterior(f);
              }}
              etiqueta="Toca para elegir el estudio anterior"
            />
            <button
              type="button"
              onClick={() => {
                setAnterior(null);
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
        </div>

        <button
          type="button"
          disabled={!archivo || cargando}
          onClick={analizar}
          className="mt-5 w-full rounded-2xl bg-hb-purpura text-white font-bold py-3 disabled:opacity-40 hover:bg-hb-purpura/90 transition-colors"
        >
          {cargando ? "Analizando estudio…" : "Analizar"}
        </button>

        {error && (
          <p className="mt-3 text-sm text-hb-magfuerte font-semibold">{error}</p>
        )}
      </section>

      {cargando && (
        <p className="text-center text-hb-grisOsc/60 animate-pulse no-print">
          Leyendo el estudio y generando interpretación, causas y soluciones…
        </p>
      )}

      {data && (
        <>
          <div className="flex justify-end mb-4 no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl border border-hb-purpura/40 text-hb-purpura font-semibold px-4 py-2 hover:bg-hb-purpura hover:text-white transition-colors"
            >
              Descargar / Imprimir PDF
            </button>
          </div>
          <div id="reporte">
            <Resultado data={data} />
          </div>
        </>
      )}
    </main>
  );
}
