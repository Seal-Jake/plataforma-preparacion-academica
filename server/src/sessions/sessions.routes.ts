import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { validate } from '../lib/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { notFound, badRequest } from '../lib/errors';
import {
  answerSchema,
  answerAbiertaSchema,
  calificarAttemptSchema,
  crearTareaSchema,
  reabrirSesionSchema,
  sessionUpdateSchema,
  toggleAperturaSchema,
} from './sessions.schemas';
import { seededShuffle, shuffledOptionOrder } from './shuffle';
import { assertEnrolledForSession } from '../lib/sessionScope';
import { TIPOS_TAREA_POR_ID } from '../lib/enums';
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
      // Por defecto trae TODAS las tareas de la unidad (las propias de
      // unidad + las de sus temas), para la vista del alumno. soloDirectas=1
      // limita a solo las tareas propias de la unidad (Examen/Investigación
      // de Unidad) — usado por la pantalla del docente para gestionarlas.
      where = soloDirectas === '1' ? { unitId, topicId: null } : { unitId };
    } else if (courseId) {
      // courseId solo se guarda en tareas propias del curso (Examen
      // Final/Investigación Final): ya filtra sin necesitar soloDirectas.
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

// El docente crea una tarea nueva del tipo que quiera, tantas veces como
// quiera: la cantidad y el ritmo de creación los decide él. El ámbito
// (courseId/unitId/topicId) debe corresponder exactamente al nivel fijo de
// ese tipo (ver TIPOS_TAREA_POR_ID) para que la rúbrica del curso sepa
// siempre dónde buscar cada categoría.
sessionsRouter.post(
  '/',
  requireAuth,
  requireRole('docente'),
  validate(crearTareaSchema),
  asyncHandler(async (req, res) => {
    const { tipo, courseId, unitId, topicId, title, dueDate, timeLimitMinutes } = req.body as {
      tipo: string;
      courseId?: string;
      unitId?: string;
      topicId?: string;
      title: string;
      dueDate?: Date | null;
      timeLimitMinutes?: number | null;
    };
    const def = TIPOS_TAREA_POR_ID[tipo];
    if (!def) throw badRequest('Tipo de tarea desconocido.');

    let scopeData: { topicId: string | null; unitId: string | null; courseId: string | null };
    if (def.ambito === 'tema') {
      if (!topicId) throw badRequest(`${def.nombre} se crea dentro de un tema.`);
      const topic = await prisma.topic.findUnique({ where: { id: topicId } });
      if (!topic) throw notFound('Tema');
      scopeData = { topicId: topic.id, unitId: topic.unitId, courseId: null };
    } else if (def.ambito === 'unidad') {
      if (!unitId) throw badRequest(`${def.nombre} se crea dentro de una unidad.`);
      const unit = await prisma.unit.findUnique({ where: { id: unitId } });
      if (!unit) throw notFound('Unidad');
      scopeData = { topicId: null, unitId: unit.id, courseId: null };
    } else {
      if (!courseId) throw badRequest(`${def.nombre} se crea dentro de un curso.`);
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) throw notFound('Curso');
      scopeData = { topicId: null, unitId: null, courseId: course.id };
    }

    const session = await prisma.academicSession.create({
      data: {
        ...scopeData,
        tipoFijo: tipo,
        title,
        questionIds: '[]',
        requiereEvidencia: def.modo === 'entrega',
        dueDate: dueDate ?? null,
        timeLimitMinutes: def.modo === 'examen' ? (timeLimitMinutes ?? null) : null,
      },
    });
    res.status(201).json({ ...session, questionIds: JSON.parse(session.questionIds) });
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

// El docente elimina una tarea que creó (por error, o porque ya no la
// quiere). Se borra en cascada todo lo asociado (intentos, entregas,
// estados) — Prisma ya tiene onDelete: Cascade en esas relaciones.
sessionsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    const session = await prisma.academicSession.findUnique({ where: { id: req.params.id } });
    if (!session) throw notFound('Sesión');
    await prisma.academicSession.delete({ where: { id: req.params.id } });
    res.status(204).send();
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
    const tipo = TIPOS_TAREA_POR_ID[existing.tipoFijo];
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
      select: {
        id: true,
        section: true,
        nivel: true,
        tipo: true,
        modoRespuesta: true,
        enunciado: true,
        archivoMimeType: true,
        esModelo: true,
        explicacion: true,
        opciones: true,
      },
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
            tieneArchivoEnunciado: !!q.archivoMimeType,
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
          tieneArchivoEnunciado: !!q.archivoMimeType,
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
    const question = await prisma.question.findUnique({ where: { id: req.params.questionId } });
    if (!question) throw notFound('Pregunta');

    const puntaje = nota / 20;
    // Se califica incluso si el alumno nunca respondió (nota 0 o la que
    // corresponda por criterio del docente): el intento se crea si no existe.
    const updated = await prisma.attempt.upsert({
      where: { sessionId_studentId_questionId: { sessionId: req.params.id, studentId, questionId: req.params.questionId } },
      create: {
        sessionId: req.params.id,
        studentId,
        questionId: req.params.questionId,
        selectedOptionIds: '[]',
        shownOptionOrder: '[]',
        puntaje,
        correct: puntaje === 1,
      },
      update: { puntaje, correct: puntaje === 1 },
    });
    res.json({ puntaje: updated.puntaje, correct: updated.correct });
  })
);

// El docente reabre el intento de un alumno: borra su estado e intentos de
// esta sesión (empieza de cero) para darle una segunda oportunidad.
sessionsRouter.post(
  '/:id/reabrir',
  requireAuth,
  requireRole('docente'),
  validate(reabrirSesionSchema),
  asyncHandler(async (req, res) => {
    const { studentId } = req.body as { studentId: string };
    const session = await prisma.academicSession.findUnique({ where: { id: req.params.id } });
    if (!session) throw notFound('Sesión');

    await prisma.attempt.deleteMany({ where: { sessionId: session.id, studentId } });
    await prisma.studentSessionState.deleteMany({ where: { sessionId: session.id, studentId } });

    res.json({ ok: true });
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

    const questionIds: string[] = JSON.parse(session.questionIds);
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, enunciado: true, modoRespuesta: true, archivoMimeType: true, opciones: true },
    });
    const questionsById = new Map(questions.map((q) => [q.id, q]));
    const attempts = await prisma.attempt.findMany({ where: { sessionId: session.id, studentId } });
    const attemptByQuestion = new Map(attempts.map((a) => [a.questionId, a]));

    const total = questionIds.length;
    // Una pregunta de respuesta abierta queda "pendiente" hasta que el
    // docente le pone una nota — la haya respondido el alumno o no. Así el
    // docente puede calificar deliberadamente incluso lo que nunca se
    // entregó, en vez de que se trate como 0 en silencio.
    const pendienteCalificacion = questionIds.some((qid) => {
      const q = questionsById.get(qid);
      if (!q || q.modoRespuesta !== 'abierta') return false;
      const a = attemptByQuestion.get(qid);
      return !a || a.puntaje === null;
    });
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
      respuestas: questionIds
        .map((qid) => questionsById.get(qid))
        .filter((q): q is NonNullable<typeof q> => !!q)
        .map((q) => {
          const a = attemptByQuestion.get(q.id);
          const seleccionadas = new Set(a ? (JSON.parse(a.selectedOptionIds) as string[]) : []);
          const respondida = q.modoRespuesta === 'abierta' ? !!(a?.respuestaTexto || a?.archivoData) : !!a;
          return {
            questionId: q.id,
            enunciado: q.enunciado,
            modoRespuesta: q.modoRespuesta,
            tieneArchivoEnunciado: !!q.archivoMimeType,
            seleccion: q.opciones.filter((o) => seleccionadas.has(o.id)).map((o) => o.texto),
            respuestaTexto: a?.respuestaTexto ?? null,
            tieneArchivo: !!a?.archivoData,
            respondida,
            puntaje: a?.puntaje ?? null,
            correcta: a?.correct ?? null,
            answeredAt: a?.answeredAt ?? null,
          };
      }),
    });
  })
);
