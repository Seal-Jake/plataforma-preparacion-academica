import { Router } from 'express';
import { stringify } from 'csv-stringify/sync';
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { notFound, badRequest, forbidden } from '../lib/errors';
import {
  calcularRubricaCurso,
  calcularRubricaUnidad,
  etiquetasCategoriasCurso,
  etiquetasCategoriasUnidad,
} from '../rubric/rubric.data';
import { RubricaResultado } from '../rubric/rubric.service';

export const exportRouter = Router();

function renderProgresoPdf(
  res: import('express').Response,
  filename: string,
  titulo: string,
  subtitulo: string,
  studentName: string,
  rubrica: RubricaResultado
) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  doc.fontSize(18).font('Helvetica-Bold').text(titulo);
  doc.fontSize(12).font('Helvetica').fillColor('#555').text(subtitulo);
  doc.moveDown(0.3);
  doc.fillColor('#000').fontSize(12).text(`Estudiante: ${studentName}`);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-PE')}`);
  doc.moveDown();

  doc.fontSize(14).font('Helvetica-Bold').text('Progreso por categoría');
  doc.moveDown(0.3);
  for (const c of rubrica.categorias) {
    doc.fontSize(11).font('Helvetica-Bold').text(`${c.nombre} (${c.peso}%)`, { continued: false });
    doc
      .font('Helvetica')
      .fillColor(c.tieneDatos ? '#000' : '#888')
      .text(c.tieneDatos ? `Nota: ${c.nota} / 20` : 'Aún sin datos registrados');
    doc.fillColor('#000');
    doc.moveDown(0.4);
  }

  doc.moveDown();
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown();

  doc.fontSize(14).font('Helvetica-Bold').text(`Nota final: ${rubrica.notaFinal ?? 'Sin datos'} ${rubrica.notaFinal !== null ? '/ 20' : ''}`);
  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#555')
    .text(`${rubrica.porcentajePonderadoConDatos}% de la rúbrica ya tiene datos registrados. El resto no se cuenta como cero: simplemente falta información.`);

  doc.end();
}

async function tablaNotasUnidad(unitId: string) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) throw notFound('Unidad');

  const categorias = etiquetasCategoriasUnidad();
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

    const categoriasCurso = etiquetasCategoriasCurso();
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: course.id },
      include: { student: true },
    });

    const filasCurso = await Promise.all(
      enrollments.map(async (e) => {
        const r = await calcularRubricaCurso(course.id, e.studentId);
        const fila: Record<string, string | number> = { estudiante: e.student.name, email: e.student.email };
        for (const c of categoriasCurso) {
          const encontrada = r.categorias.find((rc) => rc.nombre === c.nombre);
          fila[c.nombre] = encontrada?.nota ?? '';
        }
        fila['Nota Final del Curso'] = r.notaFinal ?? '';
        fila['% Rúbrica con datos'] = r.porcentajePonderadoConDatos;
        return fila;
      })
    );
    const columnsCurso = [
      { key: 'estudiante', header: 'Estudiante' },
      { key: 'email', header: 'Correo' },
      ...categoriasCurso.map((c) => ({ key: c.nombre, header: `${c.nombre} (${c.peso}%)` })),
      { key: 'Nota Final del Curso', header: 'Nota Final del Curso' },
      { key: '% Rúbrica con datos', header: '% Rúbrica con datos' },
    ];

    const bloques = [`Nota final del curso\n${stringify(filasCurso, { header: true, columns: columnsCurso })}`];
    for (const u of course.units) {
      const { unitName, filas, columns } = await tablaNotasUnidad(u.id);
      const tabla = stringify(filas, { header: true, columns });
      bloques.push(`Unidad: ${unitName}\n${tabla}`);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="notas-curso-${req.params.courseId}.csv"`);
    res.send(bloques.join('\n'));
  })
);

exportRouter.get(
  '/topics/:topicId/pdf',
  requireAuth,
  requireRole('docente'),
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

// Progreso de notas imprimible: el alumno descarga el suyo, o el docente el
// de cualquier alumno inscrito (pasando ?studentId=).
exportRouter.get(
  '/units/:unitId/progreso.pdf',
  requireAuth,
  asyncHandler(async (req, res) => {
    const unit = await prisma.unit.findUnique({ where: { id: req.params.unitId } });
    if (!unit) throw notFound('Unidad');

    let studentId: string;
    if (req.user!.role === 'docente') {
      const q = req.query.studentId as string | undefined;
      if (!q) throw badRequest('studentId es requerido para el docente.');
      studentId = q;
    } else {
      studentId = req.user!.sub;
      const enrolled = await prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId, courseId: unit.courseId } },
      });
      if (!enrolled) throw forbidden('No estás inscrito en el curso de esta unidad.');
    }

    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student) throw notFound('Estudiante');

    const rubrica = await calcularRubricaUnidad(unit.id, studentId);
    renderProgresoPdf(
      res,
      `progreso-${unit.name.replace(/[^\w\- ]/g, '')}.pdf`,
      `Progreso de notas — ${unit.name}`,
      'Rúbrica de la unidad',
      student.name,
      rubrica
    );
  })
);

exportRouter.get(
  '/courses/:courseId/progreso.pdf',
  requireAuth,
  asyncHandler(async (req, res) => {
    const course = await prisma.course.findUnique({ where: { id: req.params.courseId } });
    if (!course) throw notFound('Curso');

    let studentId: string;
    if (req.user!.role === 'docente') {
      const q = req.query.studentId as string | undefined;
      if (!q) throw badRequest('studentId es requerido para el docente.');
      studentId = q;
    } else {
      studentId = req.user!.sub;
      const enrolled = await prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId, courseId: course.id } },
      });
      if (!enrolled) throw forbidden('No estás inscrito en este curso.');
    }

    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student) throw notFound('Estudiante');

    const rubrica = await calcularRubricaCurso(course.id, studentId);
    renderProgresoPdf(
      res,
      `progreso-${course.name.replace(/[^\w\- ]/g, '')}.pdf`,
      `Progreso de notas — ${course.name}`,
      'Rúbrica final del curso',
      student.name,
      rubrica
    );
  })
);
