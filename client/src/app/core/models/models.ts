export type Role = 'docente' | 'estudiante';
export type Seccion = 'matematica' | 'economia_aplicada';
export type Nivel = 'basico' | 'estandar' | 'deco' | 'admision' | 'retos';
export type TipoPregunta =
  | 'operaciones'
  | 'enunciado'
  | 'problema_lectura'
  | 'interpretacion_grafica'
  | 'proposicion_vf';
export type TipoEvaluacion = 'examen' | 'participacion_clase' | 'participacion_activa' | 'entrega' | 'generica';
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
  bancoInsuficiente?: boolean;
  minimoRequerido?: number;
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

export interface Question {
  id: string;
  topicId: string;
  section: Seccion;
  nivel: Nivel;
  tipo: TipoPregunta;
  enunciado: string;
  opciones: QuestionOption[];
  explicacion?: string | null;
  esModelo: boolean;
  createdAt: string;
}

export interface EvaluationCategory {
  id: string;
  unitId: string;
  nombre: string;
  peso: number;
  tipoEvaluacion: TipoEvaluacion;
  promediarPorTema: boolean;
}

export interface EvaluationCategoriesResponse {
  categorias: EvaluationCategory[];
  pesoTotal: number;
  pesoValido: boolean;
}

export interface AcademicSession {
  id: string;
  unitId: string;
  topicId?: string | null;
  categoriaId: string;
  categoria?: EvaluationCategory;
  title: string;
  questionIds: string[];
  dueDate?: string | null;
  timeLimitMinutes?: number | null;
  abiertoParaTodos: boolean;
  requiereEvidencia: boolean;
  pesoAciertos: number;
  pesoEvidencia: number;
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
  opciones: { id: string; texto: string }[];
  multiCorrecta: boolean;
  respondida: boolean;
  seleccionadas: string[];
  puntajeObtenido?: number;
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
  respuestas: {
    questionId: string;
    enunciado: string;
    seleccion: string[];
    puntaje: number;
    correcta: boolean;
    answeredAt: string;
  }[];
}

export interface CategoriaRubrica {
  nombre: string;
  peso: number;
  nota: number | null;
  tieneDatos: boolean;
}

export interface RubricaResultado {
  categorias: CategoriaRubrica[];
  notaFinal: number | null;
  porcentajePonderadoConDatos: number;
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
  unitId: string;
  unitName: string;
  courseName: string;
  dueDate: string | null;
  vencido: boolean;
  estado: 'no_iniciado' | 'en_curso';
}

export interface DashboardResponse {
  pendientes: DashboardPendiente[];
  progresoGeneral: { totalCarpetas: number; completadas: number; porcentaje: number };
}

export interface CourseInfoResponse {
  infoEvaluacion: string | null;
  unidades: { unitId: string; unitName: string; categorias: { nombre: string; peso: number }[] }[];
}
