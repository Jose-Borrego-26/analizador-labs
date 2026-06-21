import { NextRequest, NextResponse } from "next/server";
import { chatLab, type Adjunto, type ChatMsg } from "@/app/lib/chat-lab";
import type { AnalisisLab, DatosPaciente } from "@/app/lib/analizar-lab";

export const runtime = "nodejs";
export const maxDuration = 120;

const TIPOS_OK = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB por archivo

async function leerAdjuntos(files: FormDataEntryValue[]): Promise<Adjunto[]> {
  const out: Adjunto[] = [];
  for (const f of files) {
    if (!(f instanceof File) || f.size === 0) continue;
    if (!TIPOS_OK.has(f.type)) {
      throw new Error("Formato no soportado. Adjunta PDF o imágenes (JPG/PNG/WEBP).");
    }
    const buf = Buffer.from(await f.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      throw new Error("Un archivo es muy grande (máx. 20 MB).");
    }
    out.push({ base64: buf.toString("base64"), mediaType: f.type });
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    let analisis: AnalisisLab | undefined;
    let datos: DatosPaciente | undefined;
    let messages: ChatMsg[] = [];
    try {
      analisis = JSON.parse(String(form.get("analisis") ?? "")) as AnalisisLab;
      const datosRaw = form.get("datos");
      if (datosRaw) datos = JSON.parse(String(datosRaw)) as DatosPaciente;
      messages = JSON.parse(String(form.get("messages") ?? "[]")) as ChatMsg[];
    } catch {
      return NextResponse.json(
        { error: "Datos del chat inválidos." },
        { status: 400 },
      );
    }

    if (!analisis || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Falta el análisis o la pregunta." },
        { status: 400 },
      );
    }

    const adjuntos = await leerAdjuntos(form.getAll("adjuntos"));

    const respuesta = await chatLab({ analisis, datos, messages, adjuntos });

    return NextResponse.json({ respuesta });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error en el chat.";
    const status = msg.includes("Formato") || msg.includes("grande") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
