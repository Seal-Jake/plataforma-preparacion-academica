import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { validate } from '../lib/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { notFound, badRequest } from '../lib/errors';
import { answerSchema, sessionUpdateSchema, toggleAperturaSchema } from './sessions.schemas';
import { seededShuffle, shuffledOptionOrder } from './shuffle';
import { assertEnrolledForSession } from '../lib/sessionScope';
import { TIPOS_SESION_FIJOS_POR_ID } from '../lib/enums';

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

    const tipo = TIPOS_SESION_FIJOS_POR_ID[session.tipoFijo];
    if (tipo?.modo === 'examen' && !session.abiertoParaTodos) {
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
