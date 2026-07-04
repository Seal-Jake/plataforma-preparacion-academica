export interface UnidadSeed {
  name: string;
  topics: string[];
}

export interface CursoSeed {
  name: string;
  units: UnidadSeed[];
}

export const CURRICULUM: CursoSeed[] = [
  {
    name: 'Álgebra y Cálculo',
    units: [
      {
        name: 'U1 Fundamentos Algebraicos',
        topics: [
          'Leyes de Exponentes y Radicales',
          'Expresiones Algebraicas y Polinomios',
          'Productos Notables',
          'División Algebraica',
          'Factorización',
          'MCD/MCM y Fracciones Algebraicas',
        ],
      },
      {
        name: 'U2 Técnicas Avanzadas y Ecuaciones',
        topics: [
          'Binomio de Newton',
          'Radicación Avanzada (Radicales Dobles y Racionalización)',
          'Números Complejos',
          'Ecuaciones de Primer y Segundo Grado',
          'Ecuaciones de Grado Superior y Racionales',
          'Desigualdades e Inecuaciones',
          'Valor Absoluto',
        ],
      },
      {
        name: 'U3 Funciones y Sistemas',
        topics: ['Relaciones y Funciones', 'Sistemas de Ecuaciones', 'Logaritmos', 'Sucesiones y Series'],
      },
      {
        name: 'U4 Álgebra Lineal, Optimización y Combinatoria',
        topics: ['Matrices y Determinantes', 'Programación Lineal', 'Análisis Combinatorio y Probabilidades'],
      },
      {
        name: 'U5 Límites, Continuidad y Derivada',
        topics: [
          'Composición de Funciones y Función Inversa',
          'Límites de Funciones',
          'Continuidad',
          'La Derivada',
          'Reglas de Derivación',
        ],
      },
      {
        name: 'U6 Aplicaciones de la Derivada',
        topics: [
          'Derivadas de Exponenciales y Logaritmos',
          'Análisis Marginal',
          'Optimización (Máximos y Mínimos)',
          'Elasticidad',
        ],
      },
      {
        name: 'U7 Integrales y Extensión Multivariable',
        topics: [
          'Integral Indefinida',
          'Integral Definida',
          'Excedente del Consumidor y del Productor',
          'Funciones de Dos Variables y Derivadas Parciales',
          'Optimización con Restricciones (Lagrange)',
        ],
      },
    ],
  },
  {
    name: 'Aritmética y Estadística',
    units: [
      {
        name: 'U1 Lógica, Conjuntos y Numeración',
        topics: ['Lógica Proposicional', 'Teoría de Conjuntos', 'Numeración', 'Divisibilidad'],
      },
      {
        name: 'U2 Teoría de Números y Fracciones',
        topics: ['MCD y MCM', 'Análisis de Números Primos', 'Números Racionales (Fracciones)'],
      },
      {
        name: 'U3 Proporcionalidad y Reparto',
        topics: ['Razones y Proporciones', 'Magnitudes Proporcionales', 'Reparto Proporcional', 'Tanto por Ciento'],
      },
      {
        name: 'U4 Matemática Financiera',
        topics: [
          'Mezcla y Aleación',
          'Interés Simple y Compuesto',
          'Descuento Comercial y Racional',
          'Análisis de Inversiones',
        ],
      },
      {
        name: 'U5 Relaciones, Conteo y Probabilidad Básica',
        topics: ['Relaciones y Funciones Aritméticas', 'Combinatoria en Aritmética', 'Probabilidad Condicional'],
      },
      {
        name: 'U6 Estadística Descriptiva',
        topics: [
          'Conceptos Básicos de Estadística',
          'Organización de Datos',
          'Representación Gráfica',
          'Medidas de Tendencia Central',
          'Medidas de Posición',
          'Medidas de Dispersión',
          'Medidas de Forma',
        ],
      },
      {
        name: 'U7 Probabilidad y Variables Aleatorias',
        topics: ['Probabilidad', 'Variables Aleatorias', 'Distribuciones Discretas', 'Distribuciones Continuas'],
      },
      {
        name: 'U8 Inferencia Estadística y Aplicaciones Económicas',
        topics: [
          'Distribución Muestral y Teorema Central del Límite',
          'Estimación',
          'Prueba de Hipótesis',
          'Correlación y Regresión Lineal Simple',
          'Números Índice',
          'Series de Tiempo',
        ],
      },
    ],
  },
];
