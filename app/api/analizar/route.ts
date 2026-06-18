import { NextRequest, NextResponse } from "next/server";
import { analizarLaboratorio, type Sexo } from "@/app/lib/analizar-lab";

export const runtime = "nodejs";
export const maxDuration = 120;

const TIPOS_OK = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB por archivo

async function leerArchivo(file: File): Promise<{ base64: string; mediaType: string }> {
  if (!TIPOS_OK.has(file.type)) {
    throw new Error("Formato no soportado. Sube PDF o imágenes (JPG/PNG/WEBP).");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    throw new Error("Un archivo es muy grande (máx. 20 MB).");
  }
  return { base64: buf.toString("base64"), mediaType: file.type };
}

async function leerVarios(files: FormDataEntryValue[]): Promise<
  { base64: string; mediaType: string }[]
> {
  const out: { base64: string; mediaType: string }[] = [];
  for (const f of files) {
    if (f instanceof File && f.size > 0) out.push(await leerArchivo(f));
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const archivos = await leerVarios(form.getAll("archivos"));
    if (archivos.length === 0) {
      return NextResponse.json(
        { error: "Falta al menos un documento del estudio." },
        { status: 400 },
      );
    }

    // Estudio(s) anterior(es) opcional(es) para comparar evolución.
    const anteriores = await leerVarios(form.getAll("anteriores"));

    // Datos opcionales del paciente.
    const sexoRaw = String(form.get("sexo") ?? "");
    const sexo: Sexo = sexoRaw === "F" || sexoRaw === "M" ? sexoRaw : "";
    const edadRaw = Number(form.get("edad"));
    const edad = Number.isFinite(edadRaw) && edadRaw > 0 ? edadRaw : null;
    const objetivo = String(form.get("objetivo") ?? "").trim();
    const notasCoach = String(form.get("notasCoach") ?? "").trim();

    const analisis = await analizarLaboratorio({
      archivos,
      anteriores,
      datos: { sexo, edad, objetivo, notasCoach },
    });

    return NextResponse.json(analisis);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al analizar el estudio.";
    const status = msg.includes("Formato") || msg.includes("grande") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
