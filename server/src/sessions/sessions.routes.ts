import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { validate } from '../lib/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { notFound, badRequest } from '../lib/errors';
import { answerSchema, answerAbiertaSchema, calificarAttemptSchema, sessionUpdateSchema, toggleAperturaSchema } from './sessions.schemas';
import { seededShuffle, shuffledOptionOrder } from './shuffle';
import { assertEnrolledForSession } from '../lib/sessionScope';
import { TIPOS_SESION_FIJOS_POR_ID } from '../lib/enums';
import { uploadDocument } from '../lib/upload';

export const sessionsRouter = Router();

// Si una sesión venció y el alumno nunca la entregó, se marca entregada en
// el primer acceso posterior a la fecha límite (no depende de que su
// navegador siga abierto con el temporizador corriendo).
async function autoSubmitIfExpired(state: { id: string; deadlineAt: Date | null; submittedAt: Date | null }) {
  if (!state.submittedAt && state.deadlineAt && new Date(state.deadlineAt).getTime() < Date.now()) {
    await prisma.studentSessionState.update({ where: { id: state.id }, data: { submittedAt: state.deadlineAt } });
    state.submittedAt = state.deadlineAt;
  }
}

sessionsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { courseId, unitId, topicId, soloDirectas } = req.query as {
      courseId?: string;
      unitId?: string;
      topicId?: string;
      soloDirectas?: string;
    };

    let where: Record<string, unknown>;
    if (topicId) {
      where = { topicId };
    } else if (unitId) {
      // Por defecto trae TODAS las sesiones de la unidad (las 2 propias de
      // unidad + las de sus temas), para la vista del alumno. soloDirectas=1
      // limita a solo las 2 sesiones propias de la unidad (usado por la
      // pantalla del docente para configurar Examen/Proyecto de Unidad).
      where = soloDirectas === '1' ? { unitId, topicId: null } : { unitId };
    } else if (courseId) {
      where = { courseId };
    } else {
      throw badRequest('Debes indicar courseId, unitId o topicId.');
    }

    if (req.user!.role === 'estudiante') {
      const sample = await prisma.academicSession.findFirst({ where });
      if (sample) await assertEnrolledForSession(req.user!.sub, sample);
    }

    const sessions = await prisma.academicSession.findMany({ where, orderBy: { createdAt: 'asc' } });

    if (req.user!.role === 'docente') {
      return res.json(sessions.map((s) => ({ ...s, questionIds: JSON.parse(s.questionIds) })));
    }

    const states = await prisma.studentSessionState.findMany({
      where: { studentId: req.user!.sub, sessionId: { in: sessions.map((s) => s.id) } },
    });
    const byId = new Map(states.map((s) => [s.sessionId, s]));

    res.json(
      sessions.map((s) => {
        const state = byId.get(s.id);
        const vencido = s.dueDate ? new Date(s.dueDate).getTime() < Date.now() : false;
        return {
          ...s,
          questionIds: JSON.parse(s.questionIds),
          vencido,
          estado: state ? (state.submittedAt ? 'entregado' : 'en_curso') : 'no_iniciado',
        };
      })
    );
  })
);

sessionsRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await prisma.academicSession.findUnique({ where: { id: req.params.id } });
    if (!session) throw notFound('Sesión');
    if (req.user!.role === 'estudiante') {
      await assertEnrolledForSession(req.user!.sub, session);
    }
    res.json({ ...session, questionIds: JSON.parse(session.questionIds) });
  })
);

sessionsRouter.put(
  '/:id',
  requireAuth,
  requireRole('docente'),
  validate(sessionUpdateSchema),
  asyncHandler(async (req, res) => {
    const { questionIds, ...rest } = req.body;
    const data: Record<string, unknown> = { ...rest };
    if (questionIds) data.questionIds = JSON.stringify(questionIds);
    const session = await prisma.academicSession.update({ where: { id: req.params.id }, data });
    res.json({ ...session, questionIds: JSON.parse(session.questionIds) });
  })
);

// Interruptor global: el docente abre o cierra la sesión para todos los
// inscritos a la vez. Al abrir una Participación Activa por primera vez, se
// fija automáticamente su fecha límite a 120 horas desde ese momento (la
// duración fija que tiene esa categoría en toda la plataforma).
sessionsRouter.patch(
  '/:id/apertura',
  requireAuth,
  requireRole('docente'),
  validate(toggleAperturaSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.academicSession.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Sesión');

    const data: Record<string, unknown> = { abiertoParaTodos: req.body.abiertoParaTodos };
    const tipo = TIPOS_SESION_FIJOS_POR_ID[existing.tipoFijo];
    if (req.body.abiertoParaTodos && tipo?.duracionHoras && !existing.dueDate) {
      data.dueDate = new Date(Date.now() + tipo.duracionHoras * 60 * 60 * 1000);
    }

    const session = await prisma.academicSession.update({ where: { id: req.params.id }, data });
    res.json(session);
  })
);

// --- Flujo de resolución del estudiante (solo aplica a sesiones con preguntas) ---

sessionsRouter.post(
  '/:id/start',
  requireAuth,
  requireRole('estudiante'),
  asyncHandler(async (req, res) => {
    const session = await prisma.academicSession.findUnique({ where: { id: req.params.id } });
    if (!session) throw notFound('Sesión');
    await assertEnrolledForSession(req.user!.sub, session);

    if (!session.abiertoParaTodos) {
      throw badRequest('Esta evaluación aún no ha sido habilitada por tu docente.');
    }

    const existing = await prisma.studentSessionState.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId: req.user!.sub } },
    });
    if (existing) return res.json(existing);

    const questionIds: string[] = JSON.parse(session.questionIds);
    const order = seededShuffle(questionIds, `${session.id}:${req.user!.sub}:questions`);
    const deadlineAt = session.timeLimitMinutes
      ? new Date(Date.now() + session.timeLimitMinutes * 60 * 1000)
      : session.dueDate;

    const state = await prisma.studentSessionState.create({
      data: {
        sessionId: session.id,
        studentId: req.user!.sub,
        questionOrder: JSON.stringify(order),
        deadlineAt,
      },
    });
    res.status(201).json(state);
  })
);

sessionsRouter.get(
  '/:id/questions',
  requireAuth,
  requireRole('estudiante'),
  asyncHandler(async (req, res) => {
    const session = await prisma.academicSession.findUnique({ where: { id: req.params.id } });
    if (!session) throw notFound('Sesión');
    await assertEnrolledForSession(req.user!.sub, session);

    const state = await prisma.studentSessionState.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId: req.user!.sub } },
    });
    if (!state) throw badRequest('Debes iniciar la sesión antes de ver las preguntas.');
    await autoSubmitIfExpired(state);

    const orderedIds: string[] = JSON.parse(state.questionOrder);
    const questions = await prisma.question.findMany({
      where: { id: { in: orderedIds } },
      include: { opciones: true },
    });
    const byId = new Map(questions.map((q) => [q.id, q]));

    const attempts = await prisma.attempt.findMany({
      where: { sessionId: session.id, studentId: req.user!.sub },
    });
    const attemptByQuestion = new Map(attempts.map((a) => [a.questionId, a]));

    const vencidoTiempo = state.deadlineAt ? new Date(state.deadlineAt).getTime() < Date.now() : false;

    const payload = orderedIds
      .map((qid) => byId.get(qid))
      .filter((q): q is NonNullable<typeof q> => !!q)
      .map((q) => {
        const attempt = attemptByQuestion.get(q.id);

        if (q.modoRespuesta === 'abierta') {
          return {
            questionId: q.id,
            section: q.section,
            nivel: q.nivel,
            tipo: q.tipo,
            enunciado: q.enunciado,
            modoRespuesta: 'abierta' as const,
            opciones: [],
            multiCorrecta: false,
            respondida: !!attempt,
            seleccionadas: [],
            respuestaTexto: attempt?.respuestaTexto ?? null,
            tieneArchivo: !!attempt?.archivoData,
            puntajeObtenido: attempt?.puntaje ?? undefined,
            calificado: !!attempt && attempt.puntaje !== null,
            explicacion: undefined,
          };
        }

        const optionIds = shuffledOptionOrder(
          `${session.id}:${req.user!.sub}:${q.id}`,
          q.opciones.map((o) => o.id)
        );
        const optionsById = new Map(q.opciones.map((o) => [o.id, o]));
        const opciones = optionIds.map((id) => ({ id, texto: optionsById.get(id)!.texto }));
        return {
          questionId: q.id,
          section: q.section,
          nivel: q.nivel,
          tipo: q.tipo,
          enunciado: q.enunciado,
          modoRespuesta: 'opciones' as const,
          opciones,
          multiCorrecta: q.opciones.filter((o) => o.esCorrecta).length > 1,
          respondida: !!attempt,
          seleccionadas: attempt ? (JSON.parse(attempt.selectedOptionIds) as string[]) : [],
          puntajeObtenido: attempt?.puntaje ?? undefined,
          calificado: true,
          explicacion: attempt && q.esModelo ? q.explicacion : undefined,
        };
      });

    res.json({
      sessionId: session.id,
      startedAt: state.startedAt,
      deadlineAt: state.deadlineAt,
      submittedAt: state.submittedAt,
      vencidoTiempo,
      preguntas: payload,
    });
  })
);

sessionsRouter.patch(
  '/:id/answer',
  requireAuth,
  requireRole('estudiante'),
  validate(answerSchema),
  asyncHandler(async (req, res) => {
    const session = await prisma.academicSession.findUnique({ where: { id: req.params.id } });
    if (!session) throw notFound('Sesión');
    await assertEnrolledForSession(req.user!.sub, session);

    const state = await prisma.studentSessionState.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId: req.user!.sub } },
    });
    if (!state) throw badRequest('Debes iniciar la sesión antes de responder.');
    await autoSubmitIfExpired(state);
    if (state.submittedAt) throw badRequest('Esta sesión ya fue entregada.');

    const { questionId, selectedOptionIds } = req.body as { questionId: string; selectedOptionIds: string[] };
    const question = await prisma.question.findUnique({ where: { id: questionId }, include: { opciones: true } });
    if (!question) throw notFound('Pregunta');
    if (question.modoRespuesta !== 'opciones') {
      throw badRequest('Esta pregunta es de respuesta abierta; usa el formulario de texto/archivo.');
    }

    const optionIds = question.opciones.map((o) => o.id);
    const shownOrder = shuffledOptionOrder(`${session.id}:${req.user!.sub}:${questionId}`, optionIds);
    const validSelected = selectedOptionIds.filter((id) => optionIds.includes(id));

    const correctas = question.opciones.filter((o) => o.esCorrecta);
    const marcadasCorrectas = correctas.filter((o) => validSelected.includes(o.id)).length;
    const puntaje = correctas.length > 0 ? Math.min(1, marcadasCorrectas / correctas.length) : 0;
    const correct = puntaje === 1;

    const attempt = await prisma.attempt.upsert({
      where: { sessionId_studentId_questionId: { sessionId: session.id, studentId: req.user!.sub, questionId } },
      create: {
        sessionId: session.id,
        studentId: req.user!.sub,
        questionId,
        selectedOptionIds: JSON.stringify(validSelected),
        shownOptionOrder: JSON.stringify(shownOrder),
        puntaje,
        correct,
      },
      update: {
        selectedOptionIds: JSON.stringify(validSelected),
        shownOptionOrder: JSON.stringify(shownOrder),
        puntaje,
        correct,
        answeredAt: new Date(),
      },
    });

    res.json({
      correct: attempt.correct,
      puntaje: attempt.puntaje,
      explicacion: question.esModelo ? question.explicacion : undefined,
    });
  })
);

// Preguntas de modoRespuesta="abierta": el alumno escribe texto y/o adjunta
// un archivo. No se autocorrige: queda con puntaje null (pendiente) hasta
// que el docente la califique manualmente.
sessionsRouter.patch(
  '/:id/answer-abierta',
  requireAuth,
  requireRole('estudiante'),
  uploadDocument.single('archivo'),
  validate(answerAbiertaSchema),
  asyncHandler(async (req, res) => {
    const session = await prisma.academicSession.findUnique({ where: { id: req.params.id } });
    if (!session) throw notFound('Sesión');
    await assertEnrolledForSession(req.user!.sub, session);

    const state = await prisma.studentSessionState.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId: req.user!.sub } },
    });
    if (!state) throw badRequest('Debes iniciar la sesión antes de responder.');
    await autoSubmitIfExpired(state);
    if (state.submittedAt) throw badRequest('Esta sesión ya fue entregada.');

    const { questionId, respuestaTexto } = req.body as { questionId: string; respuestaTexto?: string };
    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) throw notFound('Pregunta');
    if (question.modoRespuesta !== 'abierta') {
      throw badRequest('Esta pregunta es de alternativas; usa el formulario de opciones.');
    }

    const file = req.file;
    const existing = await prisma.attempt.findUnique({
      where: { sessionId_studentId_questionId: { sessionId: session.id, studentId: req.user!.sub, questionId } },
    });
    if (!respuestaTexto && !file && !existing?.archivoData) {
      throw badRequest('Debes escribir una respuesta o adjuntar un archivo.');
    }

    const attempt = await prisma.attempt.upsert({
      where: { sessionId_studentId_questionId: { sessionId: session.id, studentId: req.user!.sub, questionId } },
      create: {
        sessionId: session.id,
        studentId: req.user!.sub,
        questionId,
        selectedOptionIds: '[]',
        shownOptionOrder: '[]',
        respuestaTexto: respuestaTexto || null,
        archivoData: file?.buffer ?? null,
        archivoMimeType: file?.mimetype ?? null,
        puntaje: null,
        correct: null,
      },
      update: {
        respuestaTexto: respuestaTexto || null,
        ...(file ? { archivoData: file.buffer, archivoMimeType: file.mimetype } : {}),
        answeredAt: new Date(),
      },
    });

    res.json({
      respuestaTexto: attempt.respuestaTexto,
      tieneArchivo: !!attempt.archivoData,
    });
  })
);

// Descarga el archivo adjunto a la respuesta de una pregunta abierta.
sessionsRouter.get(
  '/:id/attempts/:questionId/archivo',
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await prisma.academicSession.findUnique({ where: { id: req.params.id } });
    if (!session) throw notFound('Sesión');
    const studentId = req.user!.role === 'docente' ? (req.query.studentId as string) : req.user!.sub;
    if (!studentId) throw badRequest('studentId es requerido.');
    if (req.user!.role === 'estudiante') await assertEnrolledForSession(req.user!.sub, session);

    const attempt = await prisma.attempt.findUnique({
      where: { sessionId_studentId_questionId: { sessionId: session.id, studentId, questionId: req.params.questionId } },
    });
    if (!attempt?.archivoData) throw notFound('Archivo de la respuesta');
    res.setHeader('Content-Type', attempt.archivoMimeType || 'application/octet-stream');
    res.send(Buffer.from(attempt.archivoData));
  })
);

// El docente califica manualmente una respuesta de pregunta abierta (0-20).
sessionsRouter.patch(
  '/:id/attempts/:questionId/calificar',
  requireAuth,
  requireRole('docente'),
  validate(calificarAttemptSchema),
  asyncHandler(async (req, res) => {
    const { studentId, nota } = req.body as { studentId: string; nota: number };
    const attempt = await prisma.attempt.findUnique({
      where: { sessionId_studentId_questionId: { sessionId: req.params.id, studentId, questionId: req.params.questionId } },
    });
    if (!attempt) throw notFound('Respuesta del estudiante');

    const puntaje = nota / 20;
    const updated = await prisma.attempt.update({
      where: { id: attempt.id },
      data: { puntaje, correct: puntaje === 1 },
    });
    res.json({ puntaje: updated.puntaje, correct: updated.correct });
  })
);

sessionsRouter.post(
  '/:id/finish',
  requireAuth,
  requireRole('estudiante'),
  asyncHandler(async (req, res) => {
    const state = await prisma.studentSessionState.findUnique({
      where: { sessionId_studentId: { sessionId: req.params.id, studentId: req.user!.sub } },
    });
    if (!state) throw badRequest('Debes iniciar la sesión antes de entregarla.');
    if (state.submittedAt) return res.json(state);

    const session = await prisma.academicSession.findUnique({ where: { id: req.params.id } });
    if (session?.requiereEvidencia) {
      const entrega = await prisma.entrega.findUnique({
        where: { sessionId_studentId: { sessionId: req.params.id, studentId: req.user!.sub } },
      });
      if (!entrega?.entregadoAt) {
        throw badRequest('Guarda tu evidencia (texto o archivo) antes de entregar la sesión.');
      }
    }

    const updated = await prisma.studentSessionState.update({
      where: { id: state.id },
      data: { submittedAt: new Date() },
    });
    res.json(updated);
  })
);

sessionsRouter.get(
  '/:id/result',
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await prisma.academicSession.findUnique({ where: { id: req.params.id } });
    if (!session) throw notFound('Sesión');

    let studentId = req.user!.sub;
    if (req.user!.role === 'docente') {
      const q = req.query.studentId as string | undefined;
      if (!q) throw badRequest('studentId es requerido para el docente.');
      studentId = q;
    } else {
      await assertEnrolledForSession(req.user!.sub, session);
    }

    const state = await prisma.studentSessionState.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId } },
    });
    if (state) await autoSubmitIfExpired(state);
    const attempts = await prisma.attempt.findMany({
      where: { sessionId: session.id, studentId },
      include: { question: { include: { opciones: true } } },
      orderBy: { answeredAt: 'asc' },
    });

    const total = JSON.parse(session.questionIds).length as number;
    // Mientras haya alguna respuesta abierta sin calificar, la nota de la
    // sesión queda pendiente (no se trata como 0): igual que el resto de la
    // rúbrica, lo que falta no cuenta hasta que exista.
    const pendienteCalificacion = attempts.some((a) => a.puntaje === null);
    const sumaPuntaje = attempts.reduce((acc, a) => acc + (a.puntaje ?? 0), 0);

    let entrega = null;
    if (session.requiereEvidencia) {
      const e = await prisma.entrega.findUnique({ where: { sessionId_studentId: { sessionId: session.id, studentId } } });
      entrega = e
        ? {
            contenidoTexto: e.contenidoTexto,
            tieneArchivo: !!e.archivoData,
            nota: e.nota,
            feedback: e.feedback,
            entregadoAt: e.entregadoAt,
          }
        : null;
    }

    res.json({
      sessionId: session.id,
      studentId,
      estado: state ? (state.submittedAt ? 'entregado' : 'en_curso') : 'no_iniciado',
      startedAt: state?.startedAt ?? null,
      submittedAt: state?.submittedAt ?? null,
      total,
      correctas: attempts.filter((a) => a.correct).length,
      nota: total > 0 && !pendienteCalificacion ? Math.round(((sumaPuntaje / total) * 20 + Number.EPSILON) * 100) / 100 : null,
      pendienteCalificacion,
      entrega,
      respuestas: attempts.map((a) => {
        const seleccionadas = new Set(JSON.parse(a.selectedOptionIds) as string[]);
        return {
          questionId: a.questionId,
          enunciado: a.question.enunciado,
          modoRespuesta: a.question.modoRespuesta,
          seleccion: a.question.opciones.filter((o) => seleccionadas.has(o.id)).map((o) => o.texto),
          respuestaTexto: a.respuestaTexto,
          tieneArchivo: !!a.archivoData,
          puntaje: a.puntaje,
          correcta: a.correct,
          answeredAt: a.answeredAt,
        };
      }),
    });
  })
);
