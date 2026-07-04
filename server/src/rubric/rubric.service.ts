/**
 * Cálculo de la rúbrica de evaluación por unidad (escala 0-20).
 *
 * A diferencia de la v1 (5 componentes fijos con pesos fijos), aquí el
 * docente define libremente las categorías de evaluación de cada unidad
 * (nombre + peso). Esta función es agnóstica a cuántas categorías haya o
 * cómo se llamen: solo necesita, por cada una, su peso y su nota (o null
 * si todavía no hay datos).
 *
 * Los mismos principios de la v1 se mantienen:
 * - Cada sesión con preguntas puntúa según sus aciertos (ver rubric.data.ts).
 * - Las categorías sin datos NO se tratan como 0: la nota final se calcula
 *   únicamente a partir de las categorías con información, renormalizando
 *   sus pesos, y se expone `porcentajePonderadoConDatos` para dejar
 *   explícito qué fracción de la rúbrica (en peso) ya tiene información real.
 */

export interface CategoriaInput {
  nombre: string;
  peso: number; // 0-100
  nota: number | null; // 0-20, o null si aún no hay datos
}

export interface CategoriaResuelta {
  nombre: string;
  peso: number;
  nota: number | null;
  tieneDatos: boolean;
}

export interface RubricaResultado {
  categorias: CategoriaResuelta[];
  notaFinal: number | null;
  /** Porcentaje (0-100) del peso total de la rúbrica que ya cuenta con datos. */
  porcentajePonderadoConDatos: number;
}

function redondear(valor: number, decimales = 2): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

export function calcularRubrica(categorias: CategoriaInput[]): RubricaResultado {
  const resueltas: CategoriaResuelta[] = categorias.map((c) => ({
    nombre: c.nombre,
    peso: c.peso,
    nota: c.nota === null || c.nota === undefined ? null : redondear(c.nota),
    tieneDatos: c.nota !== null && c.nota !== undefined,
  }));

  const conDatos = resueltas.filter((c) => c.tieneDatos);
  const pesoConDatos = conDatos.reduce((acc, c) => acc + c.peso, 0);

  const notaFinal =
    pesoConDatos > 0
      ? redondear(conDatos.reduce((acc, c) => acc + c.peso * (c.nota as number), 0) / pesoConDatos)
      : null;

  return {
    categorias: resueltas,
    notaFinal,
    porcentajePonderadoConDatos: redondear(pesoConDatos, 0),
  };
}
