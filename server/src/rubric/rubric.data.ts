import { prisma } from '../lib/prisma';
import type { AcademicSession } from '@prisma/client';
import { calcularRubrica, RubricaResultado } from './rubric.service';
import { TIPOS_TAREA } from '../lib/enums';

interface NotaSesion {
  nota: number | null;
  vencidaSinEntrega: boolean;
}

function promedio(valores: number[]): number {
  return valores.reduce((acc, v) => acc + v, 0) / valores.length;
}

// Nota (0-20) de UNA tarea para un estudiante.
//
// 1. Si el docente ya puso una nota manual (Entrega.nota), esa gana siempre
//    — sin importar el tipo de tarea ni si el alumno entregó algo. Así el
//    docente puede calificar cualquier tarea en cualquier momento.
// 2. Si no hay nota manual y la tarea tiene preguntas, se autocalifica con
//    los aciertos — pero si alguna pregunta de respuesta abierta quedó sin
//    calificar, la tarea entera queda "pendiente" (null) hasta que el
//    docente la califique, en vez de contar en silencio como si faltara.
// 3. Si nadie entregó/intentó nada Y la fecha límite ya pasó, la nota es 0
//    automáticamente (la tarea venció sin nada). Si todavía no vence, o si
//    hay algo pendiente de calificar, se deja en null (no cuenta como cero
//    en el promedio — ver calcularRubrica).
async function notaSesionParaEstudiante(session: AcademicSession, studentId: string): Promise<NotaSesion> {
  const entrega = await prisma.entrega.findUnique({
    where: { sessionId_studentId: { sessionId: session.id, studentId } },
  });
  if (entrega?.nota !== null && entrega?.nota !== undefined) return { nota: entrega.nota, vencidaSinEntrega: false };

  const questionIds: string[] = JSON.parse(session.questionIds);
  let nota: number | null = null;
  let huboAlgo = false;

  if (questionIds.length > 0) {
    const attempts = await prisma.attempt.findMany({ where: { sessionId: session.id, studentId } });
    huboAlgo = attempts.length > 0;
    if (huboAlgo) {
      const questions = await prisma.question.findMany({
        where: { id: { in: questionIds } },
        select: { id: true, modoRespuesta: true },
      });
      const attemptByQuestion = new Map(attempts.map((a) => [a.questionId, a]));
      const pendienteCalificacion = questions.some((q) => {
        if (q.modoRespuesta !== 'abierta') return false;
        const a = attemptByQuestion.get(q.id);
        return !a || a.puntaje === null;
      });
      if (!pendienteCalificacion) {
        const sumaPuntaje = attempts.reduce((acc, a) => acc + (a.puntaje ?? 0), 0);
        nota = (sumaPuntaje / questionIds.length) * 20;
      }
    }
  } else {
    huboAlgo = !!entrega?.entregadoAt;
  }

  const vencida = !!session.dueDate && new Date(session.dueDate).getTime() < Date.now();
  if (nota === null && !huboAlgo && vencida) return { nota: 0, vencidaSinEntrega: true };
  return { nota, vencidaSinEntrega: false };
}

// Cuenta el trabajo pendiente de calificar del docente en todo el curso:
// respuestas abiertas ya entregadas por algún alumno pero sin nota, y
// entregas ya subidas pero sin nota. No cuenta lo que el alumno todavía no
// entregó (eso, si venció, ya se resuelve solo como 0 — ver arriba — y si no
// venció, es pendiente del alumno, no del docente).
export async function contarPendientesCalificacionCurso(
  courseId: string
): Promise<{ abiertasPendientes: number; entregasPendientes: number; total: number }> {
  const sesiones = await prisma.academicSession.findMany({
    where: { OR: [{ courseId }, { unit: { courseId } }] },
    select: { id: true },
  });
  const sessionIds = sesiones.map((s) => s.id);
  if (sessionIds.length === 0) return { abiertasPendientes: 0, entregasPendientes: 0, total: 0 };

  const attemptsSinCalificar = await prisma.attempt.findMany({
    where: {
      sessionId: { in: sessionIds },
      puntaje: null,
      OR: [{ respuestaTexto: { not: null } }, { archivoData: { not: null } }],
    },
    select: { questionId: true },
  });
  const questionIds = [...new Set(attemptsSinCalificar.map((a) => a.questionId))];
  const preguntasAbiertas = await prisma.question.findMany({
    where: { id: { in: questionIds }, modoRespuesta: 'abierta' },
    select: { id: true },
  });
  const idsAbiertas = new Set(preguntasAbiertas.map((q) => q.id));
  const abiertasPendientes = attemptsSinCalificar.filter((a) => idsAbiertas.has(a.questionId)).length;

  const entregasPendientes = await prisma.entrega.count({
    where: { sessionId: { in: sessionIds }, entregadoAt: { not: null }, nota: null },
  });

  return { abiertasPendientes, entregasPendientes, total: abiertasPendientes + entregasPendientes };
}

// Nombres y pesos de las 6 categorías de la nota final, en el mismo orden
// que arma calcularRubricaCurso — usado por el export CSV y la página de
// "Información de Curso" para mostrar la tabla de pesos sin tener que
// calcular la rúbrica de un estudiante primero.
export function etiquetasCategoriasCurso(): { nombre: string; peso: number }[] {
  return TIPOS_TAREA.map((t) => ({ nombre: t.nombre, peso: t.peso }));
}

// Nota final del CURSO (0-20) para un estudiante: cada uno de los 6 tipos de
// tarea (TPA, Práctica Calificada, Examen de Unidad, Examen Final,
// Investigación de Unidad, Investigación Final) es el promedio simple de
// TODAS las instancias de ese tipo creadas en cualquier parte del curso
// (sin importar en qué tema/unidad estén), ponderado por su peso fijo. Un
// tipo sin ninguna tarea creada, o sin ningún alumno con nota todavía, no
// cuenta como 0: se excluye y se renormaliza sobre lo que sí tiene datos
// (ver calcularRubrica).
export async function calcularRubricaCurso(courseId: string, studentId: string): Promise<RubricaResultado> {
  const sesiones = await prisma.academicSession.findMany({
    where: { OR: [{ courseId }, { unit: { courseId } }] },
  });

  const porTipo = new Map<string, AcademicSession[]>();
  for (const s of sesiones) {
    porTipo.set(s.tipoFijo, [...(porTipo.get(s.tipoFijo) ?? []), s]);
  }

  const categorias: {
    nombre: string;
    peso: number;
    nota: number | null;
    cantidad: number;
    cantidadConDatos: number;
    instancias: { title: string; nota: number | null; vencidaSinEntrega: boolean }[];
  }[] = [];
  for (const def of TIPOS_TAREA) {
    const instancias = porTipo.get(def.tipo) ?? [];
    const notasSesiones = await Promise.all(instancias.map((s) => notaSesionParaEstudiante(s, studentId)));
    const notas = notasSesiones.map((n) => n.nota).filter((n): n is number => n !== null);
    categorias.push({
      nombre: def.nombre,
      peso: def.peso,
      nota: notas.length > 0 ? promedio(notas) : null,
      cantidad: instancias.length,
      cantidadConDatos: notas.length,
      instancias: instancias.map((s, i) => ({
        title: s.title,
        nota: notasSesiones[i].nota,
        vencidaSinEntrega: notasSesiones[i].vencidaSinEntrega,
      })),
    });
  }

  return calcularRubrica(categorias);
}
