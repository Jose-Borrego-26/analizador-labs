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

// Estudio adicional que el coach adjunta DENTRO del chat (p.ej. los análisis
// que la IA pidió que la paciente se realizara) para afinar el diagnóstico.
export interface Adjunto {
  base64: string;
  mediaType: string;
}

function bloqueArchivo(a: Adjunto) {
  return a.mediaType === "application/pdf"
    ? {
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: a.base64,
        },
      }
    : {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: a.mediaType as "image/jpeg" | "image/png" | "image/webp",
          data: a.base64,
        },
      };
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

const SISTEMA = `Eres el asistente clínico del Coach Hormonal Balance (José Borrego). El coach ya recibió un análisis de un estudio de laboratorio y ahora te hace preguntas de seguimiento. Responde SIEMPRE en español, claro y accionable.

CÓMO RESPONDER
- Apóyate en el análisis y los marcadores que tienes en el contexto; no inventes valores que no estén ahí.
- Da interpretación, causas y soluciones (nutrición / suplementación / estilo de vida) cuando aplique.
- La suplementación es una SUGERENCIA para que el coach decida, no una prescripción (Vitamina D3 = 5000 UI; para Berberina no pongas frecuencias tipo "2-3x día").
- Usa MAYÚSCULAS para títulos cortos, NO markdown con #. Listas con guiones.
- ENTREGA SIEMPRE LA RESPUESTA COMPLETA en este mismo mensaje. Si el coach pide un plan de alimentación, un menú de varios días o protocolos de suplementación, escríbelo TODO de una vez con todo el detalle (cada tiempo de comida, porciones, dosis, horarios). NUNCA respondas con un índice ni preguntes "¿cómo quieres proceder?" ni ofrezcas entregarlo por partes: el coach quiere el contenido entero ya. Solo haz una pregunta de vuelta si te falta un dato imprescindible para poder responder.
- Para preguntas simples sé conciso; para lo que pida desarrollo (planes, protocolos), extiéndete lo necesario sin recortar.
- SÍ PUEDES RECIBIR ARCHIVOS: el coach puede adjuntar en el chat nuevos estudios de laboratorio (PDF o imágenes) de la MISMA paciente, normalmente los que tú sugeriste realizar. Cuando lleguen, léelos COMPLETOS, extrae los valores y rangos relevantes e intégralos con el análisis previo y el contexto de la paciente para dar un diagnóstico más certero, ajustar causas y afinar la suplementación. NUNCA digas que no puedes recibir archivos.`;

export async function chatLab(input: {
  analisis: AnalisisLab;
  datos?: DatosPaciente;
  messages: ChatMsg[];
  adjuntos?: Adjunto[];
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

  const adjuntos = input.adjuntos ?? [];
  const ultimo = input.messages.length - 1;
  const messages: Anthropic.MessageParam[] = input.messages.map((m, i) => {
    // Los archivos adjuntos van pegados al ÚLTIMO mensaje del coach.
    if (i === ultimo && m.role === "user" && adjuntos.length > 0) {
      const bloques: Anthropic.ContentBlockParam[] = [
        {
          type: "text",
          text: "Te adjunto NUEVOS estudios de laboratorio de la misma paciente para integrarlos al diagnóstico:",
        },
        ...adjuntos.map(bloqueArchivo),
        { type: "text", text: m.content },
      ];
      return { role: "user", content: bloques };
    }
    return { role: m.role, content: m.content };
  });

  const msg = await client.messages.create({
    model: MODELO,
    max_tokens: 8000,
    system,
    messages,
  });

  return msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n")
    .trim();
}
