import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { validate } from '../lib/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { notFound, badRequest, forbidden } from '../lib/errors';
import { uploadDocument } from '../lib/upload';
import { questionSchema, questionUpdateSchema, questionFilterSchema } from './questions.schemas';

export const questionsRouter = Router();

// Nunca se incluyen los bytes del archivo adjunto en las respuestas JSON de
// listado/creación/edición: solo un booleano. El archivo se sirve aparte
// por /:id/archivo, igual que las entregas y las respuestas abiertas.
const questionSelect = {
  id: true,
  topicId: true,
  section: true,
  nivel: true,
  tipo: true,
  modoRespuesta: true,
  enunciado: true,
  archivoMimeType: true,
  explicacion: true,
  esModelo: true,
  createdAt: true,
  opciones: { orderBy: { orderIndex: 'asc' as const } },
};

function conTieneArchivo<T extends { archivoMimeType: string | null }>(q: T) {
  const { archivoMimeType, ...rest } = q;
  return { ...rest, tieneArchivo: !!archivoMimeType };
}

async function assertEnrolledForQuestion(userId: string, questionId: string) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { topic: { include: { unit: true } } },
  });
  if (!question) throw notFound('Pregunta');
  const enrolled = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId: userId, courseId: question.topic.unit.courseId } },
  });
  if (!enrolled) throw forbidden('No estás inscrito en el curso de este tema.');
  return question;
}

questionsRouter.get(
  '/',
  requireAuth,
  requireRole('docente'),
  validate(questionFilterSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { topicId, sessionId, nivel, tipo, section, q } = req.query as unknown as {
      topicId?: string;
      sessionId?: string;
      nivel?: string;
      tipo?: string;
      section?: string;
      q?: string;
    };

    let effectiveTopicId = topicId;
    let idsFilter: string[] | undefined;
    if (sessionId) {
      const session = await prisma.academicSession.findUnique({ where: { id: sessionId } });
      if (!session) throw notFound('Sesión');
      idsFilter = JSON.parse(session.questionIds);
    }

    const questions = await prisma.question.findMany({
      where: {
        ...(effectiveTopicId && { topicId: effectiveTopicId }),
        ...(idsFilter && { id: { in: idsFilter } }),
        ...(nivel && { nivel }),
        ...(tipo && { tipo }),
        ...(section && { section }),
        ...(q && { enunciado: { contains: q } }),
      },
      select: questionSelect,
      orderBy: { createdAt: 'desc' },
    });
    res.json(questions.map(conTieneArchivo));
  })
);

questionsRouter.post(
  '/',
  requireAuth,
  requireRole('docente'),
  validate(questionSchema),
  asyncHandler(async (req, res) => {
    const { opciones, ...rest } = req.body;
    const opcionesACrear = rest.modoRespuesta === 'abierta' ? [] : opciones ?? [];
    const question = await prisma.question.create({
      data: {
        ...rest,
        opciones: {
          create: opcionesACrear.map((o: { texto: string; esCorrecta: boolean }, idx: number) => ({ ...o, orderIndex: idx })),
        },
      },
      select: questionSelect,
    });
    res.status(201).json(conTieneArchivo(question));
  })
);

questionsRouter.put(
  '/:id',
  requireAuth,
  requireRole('docente'),
  validate(questionUpdateSchema),
  asyncHandler(async (req, res) => {
    const { opciones, ...rest } = req.body;
    const pasaAAbierta = rest.modoRespuesta === 'abierta';
    if (opciones || pasaAAbierta) {
      await prisma.questionOption.deleteMany({ where: { questionId: req.params.id } });
    }
    const opcionesACrear = pasaAAbierta ? undefined : opciones;
    const question = await prisma.question.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(opcionesACrear && {
          opciones: { create: opcionesACrear.map((o: { texto: string; esCorrecta: boolean }, idx: number) => ({ ...o, orderIndex: idx })) },
        }),
      },
      select: questionSelect,
    });
    res.json(conTieneArchivo(question));
  })
);

questionsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    // Al borrar una pregunta, se limpia también cualquier referencia colgante
    // en questionIds de las sesiones que la tuvieran asignada (Examen de
    // Unidad, Examen Final, Participación en Clase, Práctica).
    const question = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: { topic: { include: { unit: true } } },
    });
    if (!question) throw notFound('Pregunta');

    const sessions = await prisma.academicSession.findMany({
      where: {
        OR: [
          { topicId: question.topicId },
          { unitId: question.topic.unitId, topicId: null },
          { courseId: question.topic.unit.courseId },
        ],
      },
    });
    for (const s of sessions) {
      const ids: string[] = JSON.parse(s.questionIds);
      if (ids.includes(req.params.id)) {
        await prisma.academicSession.update({
          where: { id: s.id },
          data: { questionIds: JSON.stringify(ids.filter((id) => id !== req.params.id)) },
        });
      }
    }

    await prisma.question.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

// Adjunta (o reemplaza) una imagen/archivo al enunciado de la pregunta — útil
// para notación matemática que no se puede escribir como texto plano (ej.
// una foto del problema). Aplica a cualquier modoRespuesta.
questionsRouter.post(
  '/:id/archivo',
  requireAuth,
  requireRole('docente'),
  uploadDocument.single('archivo'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw badRequest('Debes adjuntar un archivo.');
    const question = await prisma.question.update({
      where: { id: req.params.id },
      data: { archivoData: file.buffer, archivoMimeType: file.mimetype },
      select: { id: true },
    });
    res.json({ id: question.id, tieneArchivo: true });
  })
);

questionsRouter.delete(
  '/:id/archivo',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    await prisma.question.update({
      where: { id: req.params.id },
      data: { archivoData: null, archivoMimeType: null },
    });
    res.status(204).send();
  })
);

questionsRouter.get(
  '/:id/archivo',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.role === 'estudiante') {
      await assertEnrolledForQuestion(req.user!.sub, req.params.id);
    }
    const question = await prisma.question.findUnique({ where: { id: req.params.id } });
    if (!question?.archivoData) throw notFound('Archivo de la pregunta');
    res.setHeader('Content-Type', question.archivoMimeType || 'application/octet-stream');
    res.send(Buffer.from(question.archivoData));
  })
);
