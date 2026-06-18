// Historial de análisis tipo "chats": cada sesión es un estudio analizado de
// UNA persona, con su propio análisis y su propio chat. Se guarda en
// localStorage para que sobreviva recargas y cierres del navegador, y para
// poder cambiar entre pacientes sin mezclar datos ni perder los anteriores.

import type { AnalisisLab, DatosPaciente } from "./analizar-lab";

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export interface Sesion {
  id: string;
  titulo: string;
  creadoEn: number;
  data: AnalisisLab;
  datos: DatosPaciente;
  chat: ChatMsg[];
}

const KEY = "analizador-labs:sesiones";

export function cargarSesiones(): Sesion[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as Sesion[]) : [];
  } catch {
    return [];
  }
}

export function guardarSesiones(sesiones: Sesion[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(sesiones));
  } catch {
    /* localStorage lleno o no disponible: las sesiones siguen en memoria */
  }
}

export function nuevoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Título legible para la lista del historial.
export function tituloSesion(
  nombre: string,
  data: AnalisisLab,
  datos: DatosPaciente,
): string {
  const n = nombre.trim();
  if (n) return n;
  const partes: string[] = [];
  if (datos.sexo === "F") partes.push("Femenino");
  if (datos.sexo === "M") partes.push("Masculino");
  if (datos.edad && datos.edad > 0) partes.push(`${datos.edad}a`);
  if (data.fechaEstudio) partes.push(data.fechaEstudio);
  if (data.laboratorio) partes.push(data.laboratorio);
  return partes.join(" · ") || "Análisis sin nombre";
}
