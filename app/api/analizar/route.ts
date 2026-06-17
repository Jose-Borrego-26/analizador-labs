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

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

async function leerArchivo(file: File): Promise<{ base64: string; mediaType: string }> {
  if (!TIPOS_OK.has(file.type)) {
    throw new Error("Formato no soportado. Sube un PDF o una imagen (JPG/PNG/WEBP).");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    throw new Error("El archivo es muy grande (máx. 20 MB).");
  }
  return { base64: buf.toString("base64"), mediaType: file.type };
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("archivo");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Falta el archivo del estudio." },
        { status: 400 },
      );
    }
    const archivo = await leerArchivo(file);

    // Estudio anterior opcional (para comparar evolución).
    const fileAnterior = form.get("anterior");
    const anterior =
      fileAnterior instanceof File ? await leerArchivo(fileAnterior) : null;

    // Datos opcionales del paciente para afinar el análisis.
    const sexoRaw = String(form.get("sexo") ?? "");
    const sexo: Sexo = sexoRaw === "F" || sexoRaw === "M" ? sexoRaw : "";
    const edadRaw = Number(form.get("edad"));
    const edad = Number.isFinite(edadRaw) && edadRaw > 0 ? edadRaw : null;
    const objetivo = String(form.get("objetivo") ?? "").trim();

    const analisis = await analizarLaboratorio({
      archivo,
      anterior,
      datos: { sexo, edad, objetivo },
    });

    return NextResponse.json(analisis);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al analizar el estudio.";
    const status = msg.includes("Formato") || msg.includes("grande") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
