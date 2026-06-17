import type { AnalisisLab, Marcador } from "@/app/lib/analizar-lab";

function valorMarcador(m: Marcador): string {
  if (m.valor !== null) return `${m.valor}${m.unidad ? " " + m.unidad : ""}`;
  return m.refTexto || "—";
}

function refMarcador(m: Marcador): string {
  if (m.refTexto) return m.refTexto;
  if (m.refMin != null && m.refMax != null) return `${m.refMin}–${m.refMax}`;
  if (m.refMax != null) return `< ${m.refMax}`;
  if (m.refMin != null) return `> ${m.refMin}`;
  return "—";
}

function claseEstado(estado: Marcador["estado"]): string {
  if (estado === "alto") return "estado-alto";
  if (estado === "bajo") return "estado-bajo";
  if (estado === "ok") return "estado-ok";
  return "";
}

function flechaEstado(estado: Marcador["estado"]): string {
  if (estado === "alto") return "▲";
  if (estado === "bajo") return "▼";
  if (estado === "ok") return "✓";
  return "";
}

function tendenciaTexto(m: Marcador): { txt: string; cls: string } {
  const prev =
    m.valorAnterior != null
      ? `${m.valorAnterior}${m.unidad ? " " + m.unidad : ""} → `
      : "";
  if (m.tendencia === "mejora")
    return { txt: `${prev}mejora ↗`, cls: "estado-ok" };
  if (m.tendencia === "empeora")
    return { txt: `${prev}empeora ↘`, cls: "estado-alto" };
  if (m.tendencia === "estable")
    return { txt: `${prev}estable →`, cls: "" };
  return { txt: prev ? `${prev}—` : "—", cls: "" };
}

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="text-xl font-bold text-hb-purpura uppercase tracking-wide">
        {children}
      </h2>
      <span className="sello-dorado" />
    </div>
  );
}

function ListaSolucion({ titulo, items }: { titulo: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-bold text-hb-purpura mb-1">{titulo}</p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-hb-grisOsc flex gap-2">
            <span className="text-hb-dorado font-bold">›</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Resultado({ data }: { data: AnalisisLab }) {
  const meta = [
    data.fechaEstudio && `Fecha: ${data.fechaEstudio}`,
    data.laboratorio && `Lab: ${data.laboratorio}`,
    data.orden && `Orden: ${data.orden}`,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div className="space-y-10">
      {/* Resumen */}
      <section>
        <Titulo>Resumen</Titulo>
        {meta && <p className="text-xs text-hb-grisOsc/70 mb-2">{meta}</p>}
        <p className="text-hb-grisOsc leading-relaxed">{data.resumen}</p>
      </section>

      {/* Marcadores alterados: Interpretación → Causas → Soluciones */}
      {data.alterados.length > 0 && (
        <section>
          <Titulo>Lo alterado</Titulo>
          <div className="space-y-5">
            {data.alterados.map((a, i) => (
              <article
                key={i}
                className="rounded-3xl border border-hb-dorado/40 bg-white/60 p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <h3 className="text-lg font-bold text-hb-magfuerte">
                    {a.etiqueta}
                  </h3>
                  <p className="text-sm text-hb-grisOsc">
                    <span className="font-bold">{a.valor}</span>
                    {a.meta && (
                      <span className="text-hb-grisOsc/60">
                        {"  "}(meta {a.meta})
                      </span>
                    )}
                  </p>
                </div>

                <div className="mb-3">
                  <p className="text-xs font-bold uppercase text-hb-purpura/80 mb-1">
                    Interpretación
                  </p>
                  <p className="text-sm text-hb-grisOsc leading-relaxed">
                    {a.interpretacion}
                  </p>
                </div>

                {a.causas.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-bold uppercase text-hb-purpura/80 mb-1">
                      Causas probables
                    </p>
                    <ul className="space-y-1">
                      {a.causas.map((c, j) => (
                        <li
                          key={j}
                          className="text-sm text-hb-grisOsc flex gap-2"
                        >
                          <span className="text-hb-magenta font-bold">•</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-2xl bg-hb-crema/80 p-4 space-y-3">
                  <p className="text-xs font-bold uppercase text-hb-purpura/80">
                    Soluciones
                  </p>
                  <ListaSolucion titulo="Nutrición" items={a.soluciones.nutricion} />
                  <ListaSolucion
                    titulo="Suplementación"
                    items={a.soluciones.suplementacion}
                  />
                  <ListaSolucion
                    titulo="Estilo de vida"
                    items={a.soluciones.estiloVida}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Prioridades */}
      {data.prioridades.length > 0 && (
        <section>
          <Titulo>Prioridades</Titulo>
          <ol className="space-y-2">
            {data.prioridades.map((p, i) => (
              <li key={i} className="flex gap-3 text-hb-grisOsc">
                <span className="flex-none w-6 h-6 rounded-full bg-hb-purpura text-white text-sm font-bold grid place-items-center">
                  {i + 1}
                </span>
                <span className="pt-0.5">{p}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* En rango */}
      {data.enRango && (
        <section>
          <Titulo>Lo que está bien</Titulo>
          <p className="text-hb-grisOsc">{data.enRango}</p>
        </section>
      )}

      {/* Tabla completa de marcadores */}
      {data.marcadores.length > 0 && (
        <section>
          <Titulo>Todos los marcadores</Titulo>
          <div className="overflow-x-auto rounded-2xl border border-hb-dorado/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-hb-purpura text-white text-left">
                  <th className="px-3 py-2 font-semibold">Marcador</th>
                  <th className="px-3 py-2 font-semibold">Resultado</th>
                  <th className="px-3 py-2 font-semibold">Referencia</th>
                  <th className="px-3 py-2 font-semibold">Estado</th>
                  {data.comparado && (
                    <th className="px-3 py-2 font-semibold">Evolución</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.marcadores.map((m, i) => (
                  <tr
                    key={m.clave + i}
                    className={i % 2 ? "bg-white/50" : "bg-white/20"}
                  >
                    <td className="px-3 py-2">
                      {m.etiqueta}
                      {m.categoria && (
                        <span className="block text-xs text-hb-grisOsc/50">
                          {m.categoria}
                        </span>
                      )}
                    </td>
                    <td className={`px-3 py-2 ${claseEstado(m.estado)}`}>
                      {valorMarcador(m)}
                    </td>
                    <td className="px-3 py-2 text-hb-grisOsc/70">
                      {refMarcador(m)}
                    </td>
                    <td className={`px-3 py-2 ${claseEstado(m.estado)}`}>
                      {flechaEstado(m.estado)}
                    </td>
                    {data.comparado && (
                      <td
                        className={`px-3 py-2 text-xs ${tendenciaTexto(m).cls}`}
                      >
                        {tendenciaTexto(m).txt}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-xs text-hb-grisOsc/50 pt-4 border-t border-hb-dorado/20">
        Análisis generado con IA como apoyo clínico. Las sugerencias de
        suplementación y nutrición son orientativas; las decisiones las toma el
        coach.
      </p>
    </div>
  );
}
