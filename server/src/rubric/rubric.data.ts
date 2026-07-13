import { prisma } from '../lib/prisma';
import type { AcademicSession } from '@prisma/client';
import { calcularRubrica, RubricaResultado } from './rubric.service';
import { PESOS_UNIDAD, PESOS_CURSO, TIPOS_SESION_FIJOS_POR_ID } from '../lib/enums';

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
      const attemptByQuestion = new Map(attempts.map((a) => [a.questionId, a]));
      const questions = await prisma.question.findMany({
        where: { id: { in: questionIds } },
        select: { id: true, modoRespuesta: true },
      });
      // Una pregunta de respuesta abierta (texto/archivo) sin nota del
      // docente deja la sesión entera pendiente — la haya respondido el
      // alumno o no — para que el docente pueda calificarla a propósito en
      // vez de que cuente como 0 en silencio.
      const pendienteCalificacion = questions.some((q) => {
        if (q.modoRespuesta !== 'abierta') return false;
        const a = attemptByQuestion.get(q.id);
        return !a || a.puntaje === null;
      });
      if (!pendienteCalificacion) {
        const sumaPuntaje = attempts.reduce((acc, a) => acc + (a.puntaje ?? 0), 0);
        notaAciertos = (sumaPuntaje / questionIds.length) * 20;
      }
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

// Promedia la nota de un mismo tipoFijo (practica/participacion_clase/
// participacion_activa) a través de varios temas, sin tratar como 0 los
// temas donde el estudiante todavía no tiene ningún dato.
async function promedioPorTipoATravesDeTemas(
  sesionesPorTema: AcademicSession[],
  studentId: string
): Promise<number | null> {
  const notas = (await Promise.all(sesionesPorTema.map((s) => notaSesionParaEstudiante(s, studentId)))).filter(
    (n): n is number => n !== null
  );
  return notas.length > 0 ? promedio(notas) : null;
}

function agruparPorTipoFijo(sessions: AcademicSession[]): Map<string, AcademicSession[]> {
  const map = new Map<string, AcademicSession[]>();
  for (const s of sessions) {
    map.set(s.tipoFijo, [...(map.get(s.tipoFijo) ?? []), s]);
  }
  return map;
}

// Nota final de una UNIDAD (0-20) para un estudiante, según la rúbrica fija:
// 20% examen de unidad + 20% proyecto de unidad + 20% práctica promedio de
// sus temas + 20% participación en clase promedio de sus temas + 20%
// participación activa promedio de sus temas.
export async function calcularRubricaUnidad(unitId: string, studentId: string): Promise<RubricaResultado> {
  const sesionesUnidad = await prisma.academicSession.findMany({ where: { unitId, topicId: null } });
  const sesionesTemas = await prisma.academicSession.findMany({ where: { unitId, topicId: { not: null } } });
  const porTipoTemas = agruparPorTipoFijo(sesionesTemas);

  const categorias: { nombre: string; peso: number; nota: number | null }[] = [];

  for (const s of sesionesUnidad) {
    const tipo = TIPOS_SESION_FIJOS_POR_ID[s.tipoFijo];
    categorias.push({
      nombre: tipo?.nombre ?? s.title,
      peso: PESOS_UNIDAD[s.tipoFijo] ?? 0,
      nota: await notaSesionParaEstudiante(s, studentId),
    });
  }

  for (const tipoFijo of ['practica', 'participacion_clase', 'participacion_activa']) {
    const tipo = TIPOS_SESION_FIJOS_POR_ID[tipoFijo];
    const sesiones = porTipoTemas.get(tipoFijo) ?? [];
    categorias.push({
      nombre: `${tipo.nombre} (promedio de los temas de la unidad)`,
      peso: PESOS_UNIDAD[tipoFijo] ?? 0,
      nota: sesiones.length > 0 ? await promedioPorTipoATravesDeTemas(sesiones, studentId) : null,
    });
  }

  return calcularRubrica(categorias);
}

// Nombres y pesos de las categorías de unidad, en el mismo orden que arma
// calcularRubricaUnidad — usado por el export CSV para encabezados de columna
// sin tener que calcular la rúbrica de un estudiante primero.
export function etiquetasCategoriasUnidad(): { nombre: string; peso: number }[] {
  return [
    { nombre: TIPOS_SESION_FIJOS_POR_ID.examen_unidad.nombre, peso: PESOS_UNIDAD.examen_unidad },
    { nombre: TIPOS_SESION_FIJOS_POR_ID.proyecto_unidad.nombre, peso: PESOS_UNIDAD.proyecto_unidad },
    { nombre: `${TIPOS_SESION_FIJOS_POR_ID.practica.nombre} (promedio de los temas de la unidad)`, peso: PESOS_UNIDAD.practica },
    { nombre: `${TIPOS_SESION_FIJOS_POR_ID.participacion_clase.nombre} (promedio de los temas de la unidad)`, peso: PESOS_UNIDAD.participacion_clase },
    { nombre: `${TIPOS_SESION_FIJOS_POR_ID.participacion_activa.nombre} (promedio de los temas de la unidad)`, peso: PESOS_UNIDAD.participacion_activa },
  ];
}

export function etiquetasCategoriasCurso(): { nombre: string; peso: number }[] {
  return [
    { nombre: TIPOS_SESION_FIJOS_POR_ID.examen_final_curso.nombre, peso: PESOS_CURSO.examen_final_curso },
    { nombre: TIPOS_SESION_FIJOS_POR_ID.proyecto_final_curso.nombre, peso: PESOS_CURSO.proyecto_final_curso },
    { nombre: `${TIPOS_SESION_FIJOS_POR_ID.proyecto_unidad.nombre} (promedio de las unidades del curso)`, peso: PESOS_CURSO.proyecto_unidad },
    { nombre: `${TIPOS_SESION_FIJOS_POR_ID.examen_unidad.nombre} (promedio de las unidades del curso)`, peso: PESOS_CURSO.examen_unidad },
    { nombre: `${TIPOS_SESION_FIJOS_POR_ID.practica.nombre} (promedio de todos los temas del curso)`, peso: PESOS_CURSO.practica },
    { nombre: `${TIPOS_SESION_FIJOS_POR_ID.participacion_clase.nombre} (promedio de todos los temas del curso)`, peso: PESOS_CURSO.participacion_clase },
    { nombre: `${TIPOS_SESION_FIJOS_POR_ID.participacion_activa.nombre} (promedio de todos los temas del curso)`, peso: PESOS_CURSO.participacion_activa },
  ];
}

// Nota final del CURSO (0-20) para un estudiante, según la rúbrica fija:
// 20% examen final + 20% proyecto final + 10% práctica promedio de TODOS
// los temas del curso + 15% proyecto de unidad promedio de todas las
// unidades + 15% examen de unidad promedio de todas las unidades + 10%
// participación en clase promedio de todos los temas + 10% participación
// activa promedio de todos los temas.
export async function calcularRubricaCurso(courseId: string, studentId: string): Promise<RubricaResultado> {
  const sesionesCurso = await prisma.academicSession.findMany({ where: { courseId } });
  const sesionesUnidades = await prisma.academicSession.findMany({
    where: { unit: { courseId }, topicId: null },
  });
  const sesionesTemas = await prisma.academicSession.findMany({
    where: { topic: { unit: { courseId } } },
  });
  const porTipoUnidades = agruparPorTipoFijo(sesionesUnidades);
  const porTipoTemas = agruparPorTipoFijo(sesionesTemas);

  const categorias: { nombre: string; peso: number; nota: number | null }[] = [];

  for (const s of sesionesCurso) {
    const tipo = TIPOS_SESION_FIJOS_POR_ID[s.tipoFijo];
    categorias.push({
      nombre: tipo?.nombre ?? s.title,
      peso: PESOS_CURSO[s.tipoFijo] ?? 0,
      nota: await notaSesionParaEstudiante(s, studentId),
    });
  }

  for (const tipoFijo of ['proyecto_unidad', 'examen_unidad']) {
    const tipo = TIPOS_SESION_FIJOS_POR_ID[tipoFijo];
    const sesiones = porTipoUnidades.get(tipoFijo) ?? [];
    categorias.push({
      nombre: `${tipo.nombre} (promedio de las unidades del curso)`,
      peso: PESOS_CURSO[tipoFijo] ?? 0,
      nota: sesiones.length > 0 ? await promedioPorTipoATravesDeTemas(sesiones, studentId) : null,
    });
  }

  for (const tipoFijo of ['practica', 'participacion_clase', 'participacion_activa']) {
    const tipo = TIPOS_SESION_FIJOS_POR_ID[tipoFijo];
    const sesiones = porTipoTemas.get(tipoFijo) ?? [];
    categorias.push({
      nombre: `${tipo.nombre} (promedio de todos los temas del curso)`,
      peso: PESOS_CURSO[tipoFijo] ?? 0,
      nota: sesiones.length > 0 ? await promedioPorTipoATravesDeTemas(sesiones, studentId) : null,
    });
  }

  return calcularRubrica(categorias);
}
