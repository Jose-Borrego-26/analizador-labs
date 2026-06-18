// Chat de seguimiento sobre un estudio ya analizado.
//
// No reenvía los PDF/imágenes: usa el AnalisisLab ya extraído (marcadores +
// alterados + prioridades) como contexto en texto, más los datos opcionales
// del paciente y las notas del coach. Así el coach puede seguir preguntando
// ("¿qué le doy para la vitamina D?", "explícame la insulina") sin perder el
// análisis original.

import Anthropic from "@anthropic-ai/sdk";
import type { AnalisisLab, DatosPaciente, Marcador } from "./analizar-lab";

const MODELO = "claude-sonnet-4-6";

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

function refStr(m: Marcador): string {
  if (m.refTexto) return m.refTexto;
  if (m.refMin != null && m.refMax != null) return `${m.refMin}-${m.refMax}`;
  if (m.refMax != null) return `< ${m.refMax}`;
  if (m.refMin != null) return `> ${m.refMin}`;
  return "sin ref";
}

function contextoAnalisis(a: AnalisisLab): string {
  const cab = [
    a.fechaEstudio && `Fecha: ${a.fechaEstudio}`,
    a.laboratorio && `Laboratorio: ${a.laboratorio}`,
    a.orden && `Orden: ${a.orden}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const marcadores = a.marcadores
    .map((m) => {
      const val = m.valor !== null ? `${m.valor}${m.unidad ? " " + m.unidad : ""}` : m.refTexto || "—";
      const estado =
        m.estado === "alto"
          ? " [ALTO]"
          : m.estado === "bajo"
            ? " [BAJO]"
            : m.estado === "ok"
              ? " [en rango]"
              : "";
      const prev =
        m.valorAnterior != null ? ` (antes ${m.valorAnterior}, ${m.tendencia || "sin tendencia"})` : "";
      return `  - ${m.etiqueta}: ${val} (ref ${refStr(m)})${estado}${prev}`;
    })
    .join("\n");

  const alterados = a.alterados
    .map(
      (x) =>
        `  • ${x.etiqueta} (${x.valor}, meta ${x.meta}): ${x.interpretacion}\n    Causas: ${x.causas.join("; ")}\n    Nutrición: ${x.soluciones.nutricion.join("; ")}\n    Suplementación: ${x.soluciones.suplementacion.join("; ")}\n    Estilo de vida: ${x.soluciones.estiloVida.join("; ")}`,
    )
    .join("\n");

  return `${cab ? cab + "\n" : ""}RESUMEN: ${a.resumen}

MARCADORES:
${marcadores || "  (sin marcadores)"}

ALTERADOS (análisis previo ya entregado al coach):
${alterados || "  (ninguno)"}

PRIORIDADES: ${a.prioridades.join(" | ")}
EN RANGO: ${a.enRango}`;
}

function contextoPaciente(d?: DatosPaciente): string {
  if (!d) return "";
  const partes: string[] = [];
  if (d.sexo === "F") partes.push("sexo femenino");
  if (d.sexo === "M") partes.push("sexo masculino");
  if (d.edad && d.edad > 0) partes.push(`${d.edad} años`);
  if (d.objetivo?.trim()) partes.push(`objetivo: ${d.objetivo.trim()}`);
  const base = partes.length ? `\n\nDATOS DEL PACIENTE: ${partes.join(", ")}.` : "";
  const notas = d.notasCoach?.trim()
    ? `\n\nNOTAS DEL COACH / DOCTOR (contexto, no las repitas literalmente): "${d.notasCoach.trim()}"`
    : "";
  return base + notas;
}

const SISTEMA = `Eres el asistente clínico del Coach Hormonal Balance (José Borrego). El coach ya recibió un análisis de un estudio de laboratorio y ahora te hace preguntas de seguimiento. Responde SIEMPRE en español, breve y accionable.

CÓMO RESPONDER
- Apóyate en el análisis y los marcadores que tienes en el contexto; no inventes valores que no estén ahí.
- Da interpretación, causas y soluciones (nutrición / suplementación / estilo de vida) cuando aplique.
- La suplementación es una SUGERENCIA para que el coach decida, no una prescripción (Vitamina D3 = 5000 UI; para Berberina no pongas frecuencias tipo "2-3x día").
- Usa MAYÚSCULAS para títulos cortos, NO markdown con #. Listas con guiones. Ve directo a lo que pregunta.`;

export async function chatLab(input: {
  analisis: AnalisisLab;
  datos?: DatosPaciente;
  messages: ChatMsg[];
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");
  if (!input.messages || input.messages.length === 0) {
    throw new Error("No hay pregunta que responder.");
  }
  const client = new Anthropic({ apiKey });

  const system = `${SISTEMA}

=== ESTUDIO ANALIZADO ===
${contextoAnalisis(input.analisis)}${contextoPaciente(input.datos)}`;

  const msg = await client.messages.create({
    model: MODELO,
    max_tokens: 1500,
    system,
    messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
  });

  return msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n")
    .trim();
}
