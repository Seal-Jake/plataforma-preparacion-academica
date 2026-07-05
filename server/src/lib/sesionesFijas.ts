import { prisma } from './prisma';
import { TIPOS_SESION_FIJOS } from './enums';

// Crea las sesiones fijas de la rúbrica que le corresponden a un tema/unidad/
// curso recién creado. Las de modo "evidencia" (proyectos, participación
// activa) no tienen preguntas: su nota sale 100% de la Entrega calificada
// manualmente por el docente, nunca se mezcla con aciertos.
function datosBase(t: (typeof TIPOS_SESION_FIJOS)[number]) {
  return {
    tipoFijo: t.tipoFijo,
    title: t.nombre,
    questionIds: '[]',
    requiereEvidencia: t.modo === 'evidencia',
    pesoAciertos: t.modo === 'evidencia' ? 0 : 40,
    pesoEvidencia: t.modo === 'evidencia' ? 100 : 60,
  };
}

export async function crearSesionesFijasTema(topicId: string, unitId: string) {
  const tipos = TIPOS_SESION_FIJOS.filter((t) => t.nivel === 'tema');
  await prisma.academicSession.createMany({
    data: tipos.map((t) => ({ ...datosBase(t), topicId, unitId })),
  });
}

export async function crearSesionesFijasUnidad(unitId: string) {
  const tipos = TIPOS_SESION_FIJOS.filter((t) => t.nivel === 'unidad');
  await prisma.academicSession.createMany({
    data: tipos.map((t) => ({ ...datosBase(t), unitId })),
  });
}

export async function crearSesionesFijasCurso(courseId: string) {
  const tipos = TIPOS_SESION_FIJOS.filter((t) => t.nivel === 'curso');
  await prisma.academicSession.createMany({
    data: tipos.map((t) => ({ ...datosBase(t), courseId })),
  });
}
