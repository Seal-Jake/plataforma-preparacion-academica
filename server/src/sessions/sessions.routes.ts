import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { validate } from '../lib/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { notFound, badRequest, forbidden } from '../lib/errors';
import { answerSchema, sessionSchema, toggleAperturaSchema } from './sessions.schemas';
import { seededShuffle, shuffledOptionOrder } from './shuffle';

export const sessionsRouter = Router();

async function assertEnrolledInUnit(studentId: string, unitId: string) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) throw notFound('Unidad');
  const enrolled = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId: unit.courseId } },
  });
  if (!enrolled) throw forbidden('No estás inscrito en el curso de esta unidad.');
}

sessionsRouter.post(
  '/',
  requireAuth,
  requireRole('docente'),
  validate(sessionSchema),
  asyncHandler(async (req, res) => {
    const { questionIds, ...rest } = req.body;
    const session = await prisma.academicSession.create({
      data: { ...rest, questionIds: JSON.stringify(questionIds) },
      include: { categoria: true },
    });
    res.status(201).json({ ...session, questionIds });
  })
);

sessionsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const unitId = req.query.unitId as string | undefined;
    if (!unitId) throw badRequest('unitId es requerido.');

    if (req.user!.role === 'estudiante') {
      await assertEnrolledInUnit(req.user!.sub, unitId);
    }

    const sessions = await prisma.academicSession.findMany({
      where: { unitId },
      include: { categoria: true },
      orderBy: { createdAt: 'desc' },
    });

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
    const session = await prisma.academicSession.findUnique({
      where: { id: req.params.id },
      include: { categoria: true },
    });
    if (!session) throw notFound('Sesión');
    if (req.user!.role === 'estudiante') {
      await assertEnrolledInUnit(req.user!.sub, session.unitId);
    }
    res.json({ ...session, questionIds: JSON.parse(session.questionIds) });
  })
);

sessionsRouter.put(
  '/:id',
  requireAuth,
  requireRole('docente'),
  validate(sessionSchema.partial()),
  asyncHandler(async (req, res) => {
    const { questionIds, ...rest } = req.body;
    const data: Record<string, unknown> = { ...rest };
    if (questionIds) data.questionIds = JSON.stringify(questionIds);
    const session = await prisma.academicSession.update({ where: { id: req.params.id }, data });
    res.json({ ...session, questionIds: JSON.parse(session.questionIds) });
  })
);

// Interruptor global: el docente abre o cierra el examen para todos los inscritos a la vez.
sessionsRouter.patch(
  '/:id/apertura',
  requireAuth,
  requireRole('docente'),
  validate(toggleAperturaSchema),
  asyncHandler(async (req, res) => {
    const session = await prisma.academicSession.update({
      where: { id: req.params.id },
      data: { abiertoParaTodos: req.body.abiertoParaTodos },
    });
    res.json(session);
  })
);

sessionsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    await prisma.academicSession.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

// --- Flujo de resolución del estudiante ---

sessionsRouter.post(
  '/:id/start',
  requireAuth,
  requireRole('estudiante'),
  asyncHandler(async (req, res) => {
    const session = await prisma.academicSession.findUnique({
      where: { id: req.params.id },
      include: { categoria: true },
    });
    if (!session) throw notFound('Sesión');
    await assertEnrolledInUnit(req.user!.sub, session.unitId);

    if (session.categoria.tipoEvaluacion === 'examen' && !session.abiertoParaTodos) {
      throw badRequest('El examen aún no ha sido habilitado por tu docente.');
    }

    const existing = await prisma.studentSessionState.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId: req.user!.sub } },
    });
    if (existing) return res.json(existing);

    const questionIds: string[] = JSON.parse(session.questionIds);
    const order = seededShuffle(questionIds, `${session.id}:${req.user!.sub}:questions`);
    const deadlineAt = session.timeLimitMinutes
      ? new Date(Date.now() + session.timeLimitMinutes * 60 * 1000)
      : null;

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
    await assertEnrolledInUnit(req.user!.sub, session.unitId);

    const state = await prisma.studentSessionState.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId: req.user!.sub } },
    });
    if (!state) throw badRequest('Debes iniciar la sesión antes de ver las preguntas.');

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
        const optionIds = shuffledOptionOrder(
          `${session.id}:${req.user!.sub}:${q.id}`,
          q.opciones.map((o) => o.id)
        );
        const optionsById = new Map(q.opciones.map((o) => [o.id, o]));
        const opciones = optionIds.map((id) => ({ id, texto: optionsById.get(id)!.texto }));
        const attempt = attemptByQuestion.get(q.id);
        return {
          questionId: q.id,
          section: q.section,
          nivel: q.nivel,
          tipo: q.tipo,
          enunciado: q.enunciado,
          opciones,
          multiCorrecta: q.opciones.filter((o) => o.esCorrecta).length > 1,
          respondida: !!attempt,
          seleccionadas: attempt ? (JSON.parse(attempt.selectedOptionIds) as string[]) : [],
          puntajeObtenido: attempt?.puntaje,
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
    await assertEnrolledInUnit(req.user!.sub, session.unitId);

    let state = await prisma.studentSessionState.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId: req.user!.sub } },
    });
    if (!state) throw badRequest('Debes iniciar la sesión antes de responder.');
    if (state.submittedAt) throw badRequest('Esta sesión ya fue entregada.');

    if (state.deadlineAt && new Date(state.deadlineAt).getTime() < Date.now()) {
      await prisma.studentSessionState.update({ where: { id: state.id }, data: { submittedAt: new Date() } });
      throw badRequest('El tiempo para esta sesión ya venció. Tus respuestas guardadas fueron entregadas.');
    }

    const { questionId, selectedOptionIds } = req.body as { questionId: string; selectedOptionIds: string[] };
    const question = await prisma.question.findUnique({ where: { id: questionId }, include: { opciones: true } });
    if (!question) throw notFound('Pregunta');

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
      await assertEnrolledInUnit(req.user!.sub, session.unitId);
    }

    const state = await prisma.studentSessionState.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId } },
    });
    const attempts = await prisma.attempt.findMany({
      where: { sessionId: session.id, studentId },
      include: { question: { include: { opciones: true } } },
      orderBy: { answeredAt: 'asc' },
    });

    const total = JSON.parse(session.questionIds).length as number;
    const sumaPuntaje = attempts.reduce((acc, a) => acc + a.puntaje, 0);

    res.json({
      sessionId: session.id,
      studentId,
      estado: state ? (state.submittedAt ? 'entregado' : 'en_curso') : 'no_iniciado',
      startedAt: state?.startedAt ?? null,
      submittedAt: state?.submittedAt ?? null,
      total,
      correctas: attempts.filter((a) => a.correct).length,
      nota: total > 0 ? Math.round(((sumaPuntaje / total) * 20 + Number.EPSILON) * 100) / 100 : null,
      respuestas: attempts.map((a) => {
        const seleccionadas = new Set(JSON.parse(a.selectedOptionIds) as string[]);
        return {
          questionId: a.questionId,
          enunciado: a.question.enunciado,
          seleccion: a.question.opciones.filter((o) => seleccionadas.has(o.id)).map((o) => o.texto),
          puntaje: a.puntaje,
          correcta: a.correct,
          answeredAt: a.answeredAt,
        };
      }),
    });
  })
);
