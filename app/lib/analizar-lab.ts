// Análisis de un estudio de laboratorio (PDF o imagen) con Claude.
//
// Pipeline:
//   1. Recibe el archivo en base64 + media type (opcionalmente un estudio
//      ANTERIOR para comparar evolución) + datos opcionales del paciente.
//   2. Lo manda a la API de Claude como bloque `document` (PDF) o `image`.
//   3. Devuelve JSON estructurado: metadata + TODOS los marcadores + un
//      análisis por cada marcador alterado con el formato del coach:
//      INTERPRETACIÓN → CAUSAS → SOLUCIONES (nutrición / suplementación /
//      estilo de vida). Si hay estudio anterior, agrega tendencia por marcador.
//
// El análisis es una SUGERENCIA de apoyo clínico, no una prescripción.

import Anthropic from "@anthropic-ai/sdk";

const MODELO = "claude-sonnet-4-6";

export type Sexo = "F" | "M" | "";

export interface DatosPaciente {
  sexo?: Sexo;
  edad?: number | null;
  objetivo?: string;
}

export interface Marcador {
  clave: string;
  etiqueta: string;
  valor: number | null;
  unidad?: string;
  refMin: number | null;
  refMax: number | null;
  refTexto?: string;
  categoria?: string;
  estado: "alto" | "bajo" | "ok" | "indeterminado";
  // Solo cuando hay estudio anterior para comparar:
  valorAnterior?: number | null;
  tendencia?: "mejora" | "empeora" | "estable" | "";
}

export interface Soluciones {
  nutricion: string[];
  suplementacion: string[];
  estiloVida: string[];
}

export interface Alterado {
  etiqueta: string;
  valor: string; // valor + unidad ya formateado
  meta: string; // rango/meta de referencia
  interpretacion: string;
  causas: string[];
  soluciones: Soluciones;
}

export interface AnalisisLab {
  fechaEstudio: string | null;
  laboratorio: string | null;
  orden: string | null;
  resumen: string;
  marcadores: Marcador[];
  alterados: Alterado[];
  enRango: string;
  prioridades: string[];
  comparado: boolean;
}

function bloquePaciente(d?: DatosPaciente): string {
  if (!d) return "";
  const partes: string[] = [];
  if (d.sexo === "F") partes.push("sexo femenino");
  if (d.sexo === "M") partes.push("sexo masculino");
  if (d.edad && d.edad > 0) partes.push(`${d.edad} años`);
  if (d.objetivo && d.objetivo.trim()) partes.push(`objetivo: ${d.objetivo.trim()}`);
  if (partes.length === 0) return "";
  return `\n# DATOS DEL PACIENTE (úsalos para afinar interpretación, causas y soluciones)\n- ${partes.join("\n- ")}\n`;
}

function construirPrompt(opts: { datos?: DatosPaciente; comparar: boolean }): string {
  const base = `Eres asistente clínico del Coach Hormonal Balance (José Borrego). Te paso un estudio de laboratorio (PDF o imagen). Léelo COMPLETO y devuelve un JSON estricto con la metadata, TODOS los marcadores y el análisis.
${bloquePaciente(opts.datos)}${
    opts.comparar
      ? `\n# COMPARACIÓN\nTe paso DOS estudios: primero el ANTERIOR y luego el ACTUAL (el más reciente). Analiza el ACTUAL, pero por cada marcador agrega el valor anterior y la tendencia (mejora/empeora/estable) según si el cambio acerca o aleja del rango óptimo. En el resumen y prioridades menciona la EVOLUCIÓN.\n`
      : ""
  }
# QUÉ EXTRAER
1. fechaEstudio: fecha de toma/reporte del estudio ACTUAL en formato "YYYY-MM-DD". Si no aparece, null.
2. laboratorio: nombre del laboratorio (ej. "Chopo", "Salud Digna"). Si no aparece, null.
3. orden: número de orden o folio. Si no aparece, null.
4. marcadores: TODOS los analitos del estudio ACTUAL. Por cada uno:
   - clave: id estable en snake_case SIN acentos (ej. glucosa, hba1c, colesterol_total, c_ldl, c_hdl, trigliceridos, urea, creatinina, tfg, acido_urico, tsh, t4_libre, t3_libre, vitamina_d, ferritina, hemoglobina, leucocitos, plaquetas, pcr_us, insulina).
   - etiqueta: nombre legible (ej. "Colesterol LDL", "Vitamina D", "TSH").
   - valor: número del resultado actual (sin unidad). Si es cualitativo (ej. "Negativo"), usa null.
   - unidad: unidad (ej. "mg/dL", "ng/mL", "mUI/L"). Omite si no hay.
   - refMin / refMax: límites numéricos del rango de referencia; si solo hay uno (ej. "< 200"), el otro en null.
   - refTexto: rango/resultado cualitativo cuando no sea numérico (ej. "Negativo", "< 200").
   - categoria: agrupador (ej. "Lípidos", "Metabólico/Glucosa", "Función renal", "Tiroides", "Biometría hemática", "Vitaminas", "Inflamación").
   - estado: "alto" si está por encima del rango, "bajo" si por debajo, "ok" si en rango, "indeterminado" si no hay rango numérico.${
     opts.comparar
       ? `\n   - valorAnterior: número del MISMO marcador en el estudio anterior (null si no estaba).\n   - tendencia: "mejora" | "empeora" | "estable" | "" (vacío si no hay dato anterior).`
       : ""
   }

5. resumen: 1-2 frases con el panorama general${opts.comparar ? " y la evolución respecto al estudio anterior" : ""}.

6. alterados: SOLO los marcadores fuera de rango (o en zona de riesgo/tendencia mala), del MÁS relevante al menos. Por cada uno:
   - etiqueta: nombre del marcador.
   - valor: valor actual + unidad (ej. "215 mg/dL").
   - meta: rango/meta de referencia (ej. "< 200 mg/dL").
   - interpretacion: QUÉ SIGNIFICA este valor (1-2 frases claras, en español llano).
   - causas: lista de 2-4 CAUSAS PROBABLES de por qué está así.
   - soluciones: objeto con tres listas de acciones concretas:
       - nutricion: acciones de alimentación.
       - suplementacion: sugerencias (dosis estándar; Vitamina D3 = 5000 UI; para Berberina NO pongas frecuencias tipo "2-3x día"). Puede ir vacía.
       - estiloVida: sueño, actividad física, estrés, hidratación, etc.

7. enRango: una sola frase con lo que salió bien.

8. prioridades: 2 a 4 acciones numeradas (texto), lo más importante primero.

# REGLAS
- La suplementación es una SUGERENCIA para que el coach decida, no una prescripción.
- No inventes valores que no estén en el estudio. Si un dato no se ve claro, omítelo.
- Escribe en español, claro y accionable.
- Devuelve ÚNICAMENTE el JSON, sin texto fuera de él, sin bloques de código.

# FORMATO DE SALIDA (JSON estricto)
{
  "fechaEstudio": "YYYY-MM-DD" | null,
  "laboratorio": string | null,
  "orden": string | null,
  "resumen": string,
  "marcadores": [
    { "clave": string, "etiqueta": string, "valor": number|null, "unidad": string, "refMin": number|null, "refMax": number|null, "refTexto": string, "categoria": string, "estado": "alto"|"bajo"|"ok"|"indeterminado"${
      opts.comparar ? `, "valorAnterior": number|null, "tendencia": "mejora"|"empeora"|"estable"|""` : ""
    } }
  ],
  "alterados": [
    { "etiqueta": string, "valor": string, "meta": string, "interpretacion": string, "causas": [string], "soluciones": { "nutricion": [string], "suplementacion": [string], "estiloVida": [string] } }
  ],
  "enRango": string,
  "prioridades": [string]
}`;
  return base;
}

function extraerJson(texto: string): string {
  const t = texto.trim();
  if (t.startsWith("{") && t.endsWith("}")) return t;
  const match = t.match(/\{[\s\S]*\}/);
  if (match) return match[0];
  throw new Error("No se encontró JSON en la respuesta del modelo");
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function lista(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x)).filter((x): x is string => !!x);
}

function validarEstado(v: unknown): Marcador["estado"] {
  return v === "alto" || v === "bajo" || v === "ok" ? v : "indeterminado";
}

function validarTendencia(v: unknown): Marcador["tendencia"] {
  return v === "mejora" || v === "empeora" || v === "estable" ? v : "";
}

function validarMarcadores(raw: unknown): Marcador[] {
  if (!Array.isArray(raw)) return [];
  const out: Marcador[] = [];
  for (const m of raw) {
    if (typeof m !== "object" || m === null) continue;
    const x = m as Record<string, unknown>;
    const clave = str(x.clave);
    const etiqueta = str(x.etiqueta);
    if (!clave || !etiqueta) continue;
    out.push({
      clave,
      etiqueta,
      valor: num(x.valor),
      unidad: str(x.unidad),
      refMin: num(x.refMin),
      refMax: num(x.refMax),
      refTexto: str(x.refTexto),
      categoria: str(x.categoria),
      estado: validarEstado(x.estado),
      valorAnterior: num(x.valorAnterior),
      tendencia: validarTendencia(x.tendencia),
    });
  }
  return out;
}

function validarAlterados(raw: unknown): Alterado[] {
  if (!Array.isArray(raw)) return [];
  const out: Alterado[] = [];
  for (const a of raw) {
    if (typeof a !== "object" || a === null) continue;
    const x = a as Record<string, unknown>;
    const etiqueta = str(x.etiqueta);
    if (!etiqueta) continue;
    const sol = (x.soluciones ?? {}) as Record<string, unknown>;
    out.push({
      etiqueta,
      valor: str(x.valor) ?? "",
      meta: str(x.meta) ?? "",
      interpretacion: str(x.interpretacion) ?? "",
      causas: lista(x.causas),
      soluciones: {
        nutricion: lista(sol.nutricion),
        suplementacion: lista(sol.suplementacion),
        estiloVida: lista(sol.estiloVida),
      },
    });
  }
  return out;
}

interface Archivo {
  base64: string;
  mediaType: string;
}

function bloqueArchivo(a: Archivo) {
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

export async function analizarLaboratorio(input: {
  archivo: Archivo;
  anterior?: Archivo | null;
  datos?: DatosPaciente;
}): Promise<AnalisisLab> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");
  const client = new Anthropic({ apiKey });

  const comparar = !!input.anterior;
  const prompt = construirPrompt({ datos: input.datos, comparar });

  const content: Anthropic.ContentBlockParam[] = [];
  if (input.anterior) {
    content.push({ type: "text", text: "ESTUDIO ANTERIOR:" });
    content.push(bloqueArchivo(input.anterior));
    content.push({ type: "text", text: "ESTUDIO ACTUAL (el más reciente):" });
  }
  content.push(bloqueArchivo(input.archivo));
  content.push({ type: "text", text: prompt });

  const msg = await client.messages.create({
    model: MODELO,
    max_tokens: 12000,
    messages: [{ role: "user", content }],
  });

  const textoRaw = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n");

  const parsed = JSON.parse(extraerJson(textoRaw)) as Record<string, unknown>;

  return {
    fechaEstudio: str(parsed.fechaEstudio) ?? null,
    laboratorio: str(parsed.laboratorio) ?? null,
    orden: str(parsed.orden) ?? null,
    resumen: str(parsed.resumen) ?? "",
    marcadores: validarMarcadores(parsed.marcadores),
    alterados: validarAlterados(parsed.alterados),
    enRango: str(parsed.enRango) ?? "",
    prioridades: lista(parsed.prioridades),
    comparado: comparar,
  };
}
