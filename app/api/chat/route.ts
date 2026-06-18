import { NextRequest, NextResponse } from "next/server";
import { chatLab, type ChatMsg } from "@/app/lib/chat-lab";
import type { AnalisisLab, DatosPaciente } from "@/app/lib/analizar-lab";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      analisis?: AnalisisLab;
      datos?: DatosPaciente;
      messages?: ChatMsg[];
    };

    if (!body.analisis || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: "Falta el análisis o la pregunta." },
        { status: 400 },
      );
    }

    const respuesta = await chatLab({
      analisis: body.analisis,
      datos: body.datos,
      messages: body.messages,
    });

    return NextResponse.json({ respuesta });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error en el chat.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
