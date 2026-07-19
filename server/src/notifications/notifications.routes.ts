import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { contarPendientesCalificacionCurso } from '../rubric/rubric.data';

export const notificationsRouter = Router();

// Notificaciones calculadas en vivo a partir de datos que ya existen (fechas
// límite próximas, tareas vencidas sin resolver, entregas por calificar) —
// no hay una tabla de notificaciones persistente. El frontend solo muestra
// la campana si el usuario tiene notificationsEnabled activado en su perfil.
const HORAS_AVISO_VENCIMIENTO = 48;

interface NotificationItem {
  id: string;
  tipo: 'vence_pronto' | 'vencida' | 'pendiente_calificar';
  mensaje: string;
  link: string[];
}

notificationsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const items: NotificationItem[] = [];

    if (req.user!.role === 'estudiante') {
      const studentId = req.user!.sub;
      const enrollments = await prisma.enrollment.findMany({ where: { studentId } });
      const courseIds = enrollments.map((e) => e.courseId);
      const units = await prisma.unit.findMany({ where: { courseId: { in: courseIds } } });
      const unitIds = units.map((u) => u.id);
      const unitById = new Map(units.map((u) => [u.id, u]));

      const sessions = await prisma.academicSession.findMany({
        where: { dueDate: { not: null }, OR: [{ courseId: { in: courseIds } }, { unitId: { in: unitIds } }] },
      });
      const states = await prisma.studentSessionState.findMany({
        where: { studentId, sessionId: { in: sessions.map((s) => s.id) } },
      });
      const stateBySession = new Map(states.map((s) => [s.sessionId, s]));

      const ahora = Date.now();
      const limiteAviso = ahora + HORAS_AVISO_VENCIMIENTO * 60 * 60 * 1000;

      const conFecha = sessions
        .filter((s) => !stateBySession.get(s.id)?.submittedAt && new Date(s.dueDate!).getTime() <= limiteAviso)
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

      for (const s of conFecha) {
        const due = new Date(s.dueDate!).getTime();
        const unit = s.unitId ? unitById.get(s.unitId) : undefined;
        const link = unit ? ['/estudiante/units', unit.id] : ['/estudiante/cursos'];
        if (due < ahora) {
          items.push({ id: `vencida-${s.id}`, tipo: 'vencida', mensaje: `"${s.title}" venció y todavía no la resuelves.`, link });
        } else {
          const fecha = new Date(s.dueDate!).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
          items.push({ id: `vence-${s.id}`, tipo: 'vence_pronto', mensaje: `"${s.title}" vence pronto (${fecha}).`, link });
        }
      }
    } else {
      const courses = await prisma.course.findMany({ orderBy: { orderIndex: 'asc' } });
      for (const course of courses) {
        const pendientes = await contarPendientesCalificacionCurso(course.id);
        if (pendientes.total > 0) {
          items.push({
            id: `calificar-${course.id}`,
            tipo: 'pendiente_calificar',
            mensaje: `${pendientes.total} entrega${pendientes.total === 1 ? '' : 's'} por calificar en "${course.name}".`,
            link: ['/docente/courses', course.id],
          });
        }
      }
    }

    res.json({ items });
  })
);
