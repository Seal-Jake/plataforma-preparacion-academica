import { prisma } from '../lib/prisma';
import type { AcademicSession } from '@prisma/client';
import { calcularRubrica, RubricaResultado } from './rubric.service';

function promedio(valores: number[]): number {
  return valores.reduce((acc, v) => acc + v, 0) / valores.length;
}

// Nota (0-20) de una sesión para un estudiante. Combina aciertos automáticos
// (si la sesión tiene preguntas) y evidencia manual (si la sesión la
// requiere, o si es una sesión puramente de entrega sin preguntas), sin
// tratar como 0 la parte que todavía no tiene datos.
async function notaSesionParaEstudiante(session: AcademicSession, studentId: string): Promise<number | null> {
  const questionIds: string[] = JSON.parse(session.questionIds);
  let notaAciertos: number | null = null;

  if (questionIds.length > 0) {
    const state = await prisma.studentSessionState.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId } },
    });
    if (state) {
      const attempts = await prisma.attempt.findMany({ where: { sessionId: session.id, studentId } });
      const sumaPuntaje = attempts.reduce((acc, a) => acc + a.puntaje, 0);
      notaAciertos = (sumaPuntaje / questionIds.length) * 20;
    }
  }

  let notaEvidencia: number | null = null;
  if (session.requiereEvidencia || questionIds.length === 0) {
    const entrega = await prisma.entrega.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId } },
    });
    if (entrega?.nota !== null && entrega?.nota !== undefined) notaEvidencia = entrega.nota;
  }

  const partes: { peso: number; nota: number }[] = [];
  if (notaAciertos !== null) partes.push({ peso: session.requiereEvidencia ? session.pesoAciertos : 100, nota: notaAciertos });
  if (notaEvidencia !== null) partes.push({ peso: session.requiereEvidencia ? session.pesoEvidencia : 100, nota: notaEvidencia });

  if (partes.length === 0) return null;
  const pesoTotal = partes.reduce((acc, p) => acc + p.peso, 0);
  return partes.reduce((acc, p) => acc + (p.peso / pesoTotal) * p.nota, 0);
}

async function notaCategoria(
  sessions: AcademicSession[],
  promediarPorTema: boolean,
  studentId: string
): Promise<number | null> {
  if (!promediarPorTema) {
    const notas = (await Promise.all(sessions.map((s) => notaSesionParaEstudiante(s, studentId)))).filter(
      (n): n is number => n !== null
    );
    return notas.length > 0 ? promedio(notas) : null;
  }

  const porTema = new Map<string, AcademicSession[]>();
  for (const s of sessions) {
    const key = s.topicId ?? '__sin_tema__';
    porTema.set(key, [...(porTema.get(key) ?? []), s]);
  }

  const promediosPorTema: number[] = [];
  for (const sesionesTema of porTema.values()) {
    const notas = (await Promise.all(sesionesTema.map((s) => notaSesionParaEstudiante(s, studentId)))).filter(
      (n): n is number => n !== null
    );
    if (notas.length > 0) promediosPorTema.push(promedio(notas));
  }
  return promediosPorTema.length > 0 ? promedio(promediosPorTema) : null;
}

export async function calcularRubricaUnidad(unitId: string, studentId: string): Promise<RubricaResultado> {
  const categorias = await prisma.evaluationCategory.findMany({
    where: { unitId },
    include: { sessions: true },
  });

  const resueltas = await Promise.all(
    categorias.map(async (c) => ({
      nombre: c.nombre,
      peso: c.peso,
      nota: await notaCategoria(c.sessions, c.promediarPorTema, studentId),
    }))
  );

  return calcularRubrica(resueltas);
}
