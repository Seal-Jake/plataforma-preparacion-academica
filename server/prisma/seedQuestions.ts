export interface QuestionSeed {
  section: 'matematica' | 'economia_aplicada';
  nivel: 'basico' | 'estandar' | 'deco' | 'admision' | 'retos';
  tipo: 'operaciones' | 'enunciado' | 'problema_lectura' | 'interpretacion_grafica' | 'proposicion_vf';
  enunciado: string;
  opcionA: string;
  opcionB: string;
  opcionC: string;
  opcionD: string;
  opcionE: string;
  clave: number;
  explicacion?: string;
  esModelo?: boolean;
}

// Banco Modelo General: único lugar de toda la plataforma con desarrollo resuelto.
// Q1 y Q5 quedan asociadas a "Ecuaciones de Primer y Segundo Grado" (encajan temáticamente:
// ecuación lineal y discriminante de una cuadrática); Q3 y Q4 a "Tanto por Ciento" (aumento/
// disminución porcentual y promedio de ventas).
export const MODELO_GENERAL_ECUACIONES: QuestionSeed[] = [
  {
    section: 'matematica',
    nivel: 'basico',
    tipo: 'operaciones',
    enunciado: 'Resuelve: 2x + 5 = 17',
    opcionA: '4',
    opcionB: '5',
    opcionC: '6',
    opcionD: '7',
    opcionE: '8',
    clave: 2,
    explicacion: '2x + 5 = 17 → 2x = 12 → x = 6',
    esModelo: true,
  },
  {
    section: 'matematica',
    nivel: 'estandar',
    tipo: 'enunciado',
    enunciado: 'La suma de un número y el triple de otro es 20. Si el primero es 2, halla el segundo.',
    opcionA: '5',
    opcionB: '6',
    opcionC: '7',
    opcionD: '8',
    opcionE: '9',
    clave: 1,
    explicacion: 'x + 3y = 20, con x = 2 → 3y = 18 → y = 6',
    esModelo: true,
  },
  {
    section: 'matematica',
    nivel: 'retos',
    tipo: 'proposicion_vf',
    enunciado:
      'I. Todo primo es impar. II. La suma de dos pares es par. III. El discriminante de x² + 4 = 0 es negativo. ¿Cuántas son V?',
    opcionA: '0',
    opcionB: '1',
    opcionC: '2',
    opcionD: '3',
    opcionE: 'Ninguna',
    clave: 2,
    explicacion:
      'I es falsa (2 es primo y par). II es verdadera. III: Δ = 0² − 4(1)(4) = −16 < 0, verdadera. Total: 2 verdaderas.',
    esModelo: true,
  },
];

export const MODELO_GENERAL_TANTO_POR_CIENTO: QuestionSeed[] = [
  {
    section: 'economia_aplicada',
    nivel: 'deco',
    tipo: 'problema_lectura',
    enunciado:
      'Una tienda vendió 120 unidades en enero. En febrero subieron 25%, en marzo bajaron 10% respecto a febrero. ¿Cuántas en marzo?',
    opcionA: '127',
    opcionB: '129',
    opcionC: '135',
    opcionD: '150',
    opcionE: '108',
    clave: 2,
    explicacion: '120 × 1.25 = 150 (febrero); 150 × 0.90 = 135 (marzo)',
    esModelo: true,
  },
  {
    section: 'economia_aplicada',
    nivel: 'admision',
    tipo: 'interpretacion_grafica',
    enunciado: 'Ventas mensuales (miles S/): Ene 10, Feb 15, Mar 12, Abr 18. Halla el promedio.',
    opcionA: '12.5',
    opcionB: '13.75',
    opcionC: '14',
    opcionD: '15',
    opcionE: '13',
    clave: 1,
    explicacion: '(10 + 15 + 12 + 18) / 4 = 55 / 4 = 13.75',
    esModelo: true,
  },
];

// ~10 preguntas reales (no modelo, sin explicación) para "Ecuaciones de Primer y Segundo Grado".
export const ECUACIONES_PRIMER_SEGUNDO_GRADO: QuestionSeed[] = [
  {
    section: 'matematica',
    nivel: 'basico',
    tipo: 'operaciones',
    enunciado: 'Resuelve: 3x - 4 = 11',
    opcionA: '3',
    opcionB: '4',
    opcionC: '5',
    opcionD: '6',
    opcionE: '7',
    clave: 2,
  },
  {
    section: 'matematica',
    nivel: 'basico',
    tipo: 'operaciones',
    enunciado: 'Halla el valor positivo de x en: x² = 16',
    opcionA: '2',
    opcionB: '3',
    opcionC: '4',
    opcionD: '5',
    opcionE: '6',
    clave: 2,
  },
  {
    section: 'matematica',
    nivel: 'estandar',
    tipo: 'enunciado',
    enunciado: 'La edad de Ana es el doble de la de Luis. Si la suma de sus edades es 36, halla la edad de Luis.',
    opcionA: '10',
    opcionB: '11',
    opcionC: '12',
    opcionD: '13',
    opcionE: '14',
    clave: 2,
  },
  {
    section: 'economia_aplicada',
    nivel: 'estandar',
    tipo: 'enunciado',
    enunciado:
      'El costo total de producir x unidades es C(x) = 50x + 200. ¿Cuántas unidades se deben producir para que el costo total sea S/700?',
    opcionA: '8',
    opcionB: '9',
    opcionC: '10',
    opcionD: '11',
    opcionE: '12',
    clave: 2,
  },
  {
    section: 'economia_aplicada',
    nivel: 'deco',
    tipo: 'problema_lectura',
    enunciado:
      'Una empresa tiene ingresos I(x) = 80x y costos C(x) = 20x + 900, con x unidades vendidas. ¿Cuántas unidades debe vender para llegar al punto de equilibrio (I = C)?',
    opcionA: '12',
    opcionB: '13',
    opcionC: '14',
    opcionD: '15',
    opcionE: '16',
    clave: 3,
  },
  {
    section: 'matematica',
    nivel: 'deco',
    tipo: 'problema_lectura',
    enunciado: 'Si al triple de un número se le resta 7 se obtiene 20, ¿cuál es el número?',
    opcionA: '7',
    opcionB: '8',
    opcionC: '9',
    opcionD: '10',
    opcionE: '11',
    clave: 2,
  },
  {
    section: 'matematica',
    nivel: 'admision',
    tipo: 'interpretacion_grafica',
    enunciado:
      'La ecuación x² - 5x + 6 = 0 tiene como raíces a 2 y 3. Según la relación de Cardano (-b/a), ¿cuánto suman las raíces?',
    opcionA: '3',
    opcionB: '4',
    opcionC: '5',
    opcionD: '6',
    opcionE: '7',
    clave: 2,
  },
  {
    section: 'matematica',
    nivel: 'admision',
    tipo: 'proposicion_vf',
    enunciado:
      'Dada la ecuación 2x² - 8 = 0: I. Una raíz es 2. II. Una raíz es -2. III. El producto de raíces es -4. ¿Cuántas son verdaderas?',
    opcionA: '0',
    opcionB: '1',
    opcionC: '2',
    opcionD: '3',
    opcionE: 'Ninguna',
    clave: 3,
  },
  {
    section: 'economia_aplicada',
    nivel: 'retos',
    tipo: 'problema_lectura',
    enunciado:
      'El precio p (en soles) de un producto satisface p² - 10p + 21 = 0. Si el precio es mayor a 5, ¿cuál es el precio?',
    opcionA: '3',
    opcionB: '5',
    opcionC: '6',
    opcionD: '7',
    opcionE: '9',
    clave: 3,
  },
  {
    section: 'matematica',
    nivel: 'retos',
    tipo: 'enunciado',
    enunciado: 'Las raíces de una ecuación cuadrática son 4 y -3. ¿Cuál es la ecuación, de la forma x² + bx + c = 0?',
    opcionA: 'x² - x - 12 = 0',
    opcionB: 'x² + x - 12 = 0',
    opcionC: 'x² - 7x + 12 = 0',
    opcionD: 'x² + 7x - 12 = 0',
    opcionE: 'x² - x + 12 = 0',
    clave: 0,
  },
];

// ~3 preguntas reales para "Tanto por Ciento".
export const TANTO_POR_CIENTO: QuestionSeed[] = [
  {
    section: 'matematica',
    nivel: 'basico',
    tipo: 'operaciones',
    enunciado: '¿Cuánto es el 20% de 150?',
    opcionA: '20',
    opcionB: '25',
    opcionC: '30',
    opcionD: '35',
    opcionE: '40',
    clave: 2,
  },
  {
    section: 'economia_aplicada',
    nivel: 'estandar',
    tipo: 'enunciado',
    enunciado: 'Un producto cuesta S/80 y se le aplica un descuento del 15%. ¿Cuál es el precio final?',
    opcionA: '64',
    opcionB: '66',
    opcionC: '68',
    opcionD: '70',
    opcionE: '72',
    clave: 2,
  },
  {
    section: 'economia_aplicada',
    nivel: 'deco',
    tipo: 'problema_lectura',
    enunciado: 'Las ventas de una empresa aumentaron de S/40 000 a S/46 000. ¿Cuál fue el porcentaje de aumento?',
    opcionA: '10%',
    opcionB: '12%',
    opcionC: '15%',
    opcionD: '18%',
    opcionE: '20%',
    clave: 2,
  },
];
