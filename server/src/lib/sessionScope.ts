import { prisma } from './prisma';
import { forbidden } from './errors';

// Las sesiones de curso solo tienen courseId; las de unidad y de tema
// siempre tienen unitId (las de tema además tienen topicId), así que basta
// con mirar esos dos campos para saber a qué curso pertenece cualquier sesión.
export async function resolveCourseIdForSession(session: { courseId: string | null; unitId: string | null }): Promise<string> {
  if (session.courseId) return session.courseId;
  if (session.unitId) {
    const unit = await prisma.unit.findUnique({ where: { id: session.unitId } });
    if (unit) return unit.courseId;
  }
  throw new Error('No se pudo resolver el curso de la sesión.');
}

export async function assertEnrolledForSession(
  studentId: string,
  session: { courseId: string | null; unitId: string | null }
) {
  const courseId = await resolveCourseIdForSession(session);
  const enrolled = await prisma.enrollment.findUnique({ where: { studentId_courseId: { studentId, courseId } } });
  if (!enrolled) throw forbidden('No estás inscrito en el curso de esta sesión.');
}
