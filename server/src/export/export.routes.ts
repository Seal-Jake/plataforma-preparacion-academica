import { Router } from 'express';
import { stringify } from 'csv-stringify/sync';
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { notFound } from '../lib/errors';
import { calcularRubricaUnidad } from '../rubric/rubric.data';

export const exportRouter = Router();

async function tablaNotasUnidad(unitId: string) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) throw notFound('Unidad');

  const categorias = await prisma.evaluationCategory.findMany({ where: { unitId }, orderBy: { nombre: 'asc' } });
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: unit.courseId },
    include: { student: true },
  });

  const filas = await Promise.all(
    enrollments.map(async (e) => {
      const r = await calcularRubricaUnidad(unitId, e.studentId);
      const fila: Record<string, string | number> = {
        estudiante: e.student.name,
        email: e.student.email,
      };
      for (const c of categorias) {
        const encontrada = r.categorias.find((rc) => rc.nombre === c.nombre);
        fila[c.nombre] = encontrada?.nota ?? '';
      }
      fila['Nota Final'] = r.notaFinal ?? '';
      fila['% Rúbrica con datos'] = r.porcentajePonderadoConDatos;
      return fila;
    })
  );

  const columns = [
    { key: 'estudiante', header: 'Estudiante' },
    { key: 'email', header: 'Correo' },
    ...categorias.map((c) => ({ key: c.nombre, header: `${c.nombre} (${c.peso}%)` })),
    { key: 'Nota Final', header: 'Nota Final' },
    { key: '% Rúbrica con datos', header: '% Rúbrica con datos' },
  ];

  return { unitName: unit.name, filas, columns };
}

exportRouter.get(
  '/units/:unitId/csv',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    const { filas, columns } = await tablaNotasUnidad(req.params.unitId);
    const csv = stringify(filas, { header: true, columns });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="notas-unidad-${req.params.unitId}.csv"`);
    res.send(csv);
  })
);

exportRouter.get(
  '/courses/:courseId/csv',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    const course = await prisma.course.findUnique({
      where: { id: req.params.courseId },
      include: { units: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!course) throw notFound('Curso');

    // Cada unidad puede tener categorías distintas, así que se exporta un bloque
    // de tabla por unidad dentro del mismo archivo, en vez de forzar columnas fijas.
    const bloques = await Promise.all(
      course.units.map(async (u) => {
        const { unitName, filas, columns } = await tablaNotasUnidad(u.id);
        const tabla = stringify(filas, { header: true, columns });
        return `Unidad: ${unitName}\n${tabla}`;
      })
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="notas-curso-${req.params.courseId}.csv"`);
    res.send(bloques.join('\n'));
  })
);

exportRouter.get(
  '/topics/:topicId/pdf',
  requireAuth,
  asyncHandler(async (req, res) => {
    const topic = await prisma.topic.findUnique({ where: { id: req.params.topicId } });
    if (!topic) throw notFound('Tema');

    const folders = await prisma.folder.findMany({
      where: { topicId: topic.id },
      include: { archivos: true },
      orderBy: { orderIndex: 'asc' },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${topic.name.replace(/[^\w\- ]/g, '')}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(18).text(topic.name, { underline: true });
    doc.moveDown();

    for (const folder of folders.filter((f) => f.tipoFijo)) {
      doc.fontSize(14).text(folder.nombre);
      doc.moveDown(0.5);
      const notas = folder.archivos.filter((a) => a.contenidoTexto);
      if (notas.length === 0) {
        doc.fontSize(11).text('Aún no se ha registrado contenido para esta carpeta.');
      } else {
        for (const nota of notas) {
          doc.fontSize(11).text(nota.contenidoTexto!);
          doc.moveDown(0.3);
        }
      }
      doc.moveDown();
    }

    doc.end();
  })
);
