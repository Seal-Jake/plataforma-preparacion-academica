export type Role = 'docente' | 'estudiante';
export type Seccion = 'matematica' | 'economia_aplicada';
export type Nivel = 'basico' | 'estandar' | 'deco' | 'admision' | 'retos';
export type TipoPregunta =
  | 'operaciones'
  | 'enunciado'
  | 'problema_lectura'
  | 'interpretacion_grafica'
  | 'proposicion_vf';
// Los 6 tipos de tarea de la plataforma: el docente crea libremente tantas
// instancias de cada uno como quiera (ver server/src/lib/enums.ts).
export type TipoTarea =
  | 'tpa'
  | 'practica_calificada'
  | 'examen_unidad'
  | 'examen_final'
  | 'investigacion_unidad'
  | 'investigacion_final';
export type AmbitoTarea = 'tema' | 'unidad' | 'curso';
export type ModoTarea = 'examen' | 'entrega';
export type ThemePreference = 'dark' | 'light';

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
  themePreference?: ThemePreference;
  notificationsEnabled?: boolean;
}

export interface Course {
  id: string;
  name: string;
  orderIndex: number;
  infoEvaluacion?: string | null;
  units?: Unit[];
}

export interface Unit {
  id: string;
  courseId: string;
  name: string;
  orderIndex: number;
  topics?: Topic[];
}

export interface Topic {
  id: string;
  unitId: string;
  name: string;
  orderIndex: number;
  subtemas?: string | null;
  questionCount?: number;
}

export interface FileItem {
  id: string;
  nombre: string;
  contenidoTexto: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface FolderNode {
  id: string;
  nombre: string;
  tipoFijo: string | null;
  orderIndex: number;
  archivos: FileItem[];
  completado: boolean;
  children: FolderNode[];
}

export interface FolderTreeResponse {
  tree: FolderNode[];
  progreso: { totalCarpetas: number; completadas: number; porcentaje: number };
}

export interface QuestionOption {
  id?: string;
  texto: string;
  esCorrecta: boolean;
  orderIndex?: number;
}

export type ModoRespuesta = 'opciones' | 'abierta';

export interface Question {
  id: string;
  topicId: string;
  section: Seccion;
  nivel: Nivel;
  tipo: TipoPregunta;
  modoRespuesta: ModoRespuesta;
  enunciado: string;
  tieneArchivo: boolean;
  opciones: QuestionOption[];
  explicacion?: string | null;
  esModelo: boolean;
  createdAt: string;
}

export interface AcademicSession {
  id: string;
  courseId?: string | null;
  unitId?: string | null;
  topicId?: string | null;
  tipoFijo: TipoTarea;
  title: string;
  questionIds: string[];
  dueDate?: string | null;
  timeLimitMinutes?: number | null;
  abiertoParaTodos: boolean;
  requiereEvidencia: boolean;
  createdAt: string;
  vencido?: boolean;
  estado?: 'no_iniciado' | 'en_curso' | 'entregado';
}

export interface SessionQuestion {
  questionId: string;
  section: Seccion;
  nivel: Nivel;
  tipo: TipoPregunta;
  enunciado: string;
  tieneArchivoEnunciado?: boolean;
  modoRespuesta: ModoRespuesta;
  opciones: { id: string; texto: string }[];
  multiCorrecta: boolean;
  respondida: boolean;
  seleccionadas: string[];
  respuestaTexto?: string | null;
  tieneArchivo?: boolean;
  puntajeObtenido?: number;
  calificado?: boolean;
  explicacion?: string;
}

export interface SessionQuestionsResponse {
  sessionId: string;
  startedAt: string;
  deadlineAt?: string | null;
  submittedAt?: string | null;
  vencidoTiempo: boolean;
  preguntas: SessionQuestion[];
}

export interface SessionResult {
  sessionId: string;
  studentId: string;
  estado: string;
  startedAt: string | null;
  submittedAt: string | null;
  total: number;
  correctas: number;
  nota: number | null;
  pendienteCalificacion: boolean;
  entrega: {
    contenidoTexto: string | null;
    tieneArchivo: boolean;
    nota: number | null;
    feedback: string | null;
    entregadoAt: string | null;
  } | null;
  respuestas: {
    questionId: string;
    enunciado: string;
    modoRespuesta: ModoRespuesta;
    tieneArchivoEnunciado: boolean;
    seleccion: string[];
    respuestaTexto: string | null;
    tieneArchivo: boolean;
    respondida: boolean;
    puntaje: number | null;
    correcta: boolean | null;
    answeredAt: string | null;
  }[];
}

export interface InstanciaTarea {
  title: string;
  nota: number | null;
  vencidaSinEntrega: boolean;
}

export interface CategoriaRubrica {
  nombre: string;
  peso: number;
  nota: number | null;
  tieneDatos: boolean;
  cantidad?: number;
  cantidadConDatos?: number;
  instancias?: InstanciaTarea[];
}

export interface RubricaResultado {
  categorias: CategoriaRubrica[];
  notaFinal: number | null;
  porcentajePonderadoConDatos: number;
}

export interface FilaPlanilla {
  studentId: string;
  studentName: string;
  rubrica: RubricaResultado;
}

export interface PendientesCalificacion {
  abiertasPendientes: number;
  entregasPendientes: number;
  total: number;
}

export interface Entrega {
  id?: string;
  sessionId: string;
  studentId: string;
  contenidoTexto?: string | null;
  archivoMimeType?: string | null;
  nota?: number | null;
  feedback?: string | null;
  entregadoAt?: string | null;
  student?: { id: string; name: string; email: string };
}

export interface StudentInfo {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  student?: StudentInfo;
}

export interface DashboardPendiente {
  sessionId: string;
  title: string;
  categoriaNombre: string;
  unitId: string | null;
  unitName: string | null;
  courseName: string;
  dueDate: string | null;
  vencido: boolean;
  estado: 'no_iniciado' | 'en_curso';
}

export interface RubricaPorCurso {
  courseId: string;
  courseName: string;
  rubrica: RubricaResultado;
}

export interface DashboardResponse {
  pendientes: DashboardPendiente[];
  progresoGeneral: { totalCarpetas: number; completadas: number; porcentaje: number };
  rubricasPorCurso: RubricaPorCurso[];
}

export interface CourseInfoResponse {
  infoEvaluacion: string | null;
  categoriasCurso: { nombre: string; peso: number }[];
}

export type TipoNotificacion = 'vence_pronto' | 'vencida' | 'pendiente_calificar';

export interface NotificationItem {
  id: string;
  tipo: TipoNotificacion;
  mensaje: string;
  link: string[];
}

export interface NotificationsResponse {
  items: NotificationItem[];
}
