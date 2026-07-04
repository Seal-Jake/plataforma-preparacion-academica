import { calcularRubrica, CategoriaInput } from './rubric.service';

describe('calcularRubrica', () => {
  it('devuelve todo en null y 0% cuando no hay ninguna categoría con datos', () => {
    const categorias: CategoriaInput[] = [
      { nombre: 'Participación en Clase', peso: 15, nota: null },
      { nombre: 'Examen Parcial', peso: 25, nota: null },
    ];
    const r = calcularRubrica(categorias);
    expect(r.categorias.every((c) => !c.tieneDatos)).toBe(true);
    expect(r.notaFinal).toBeNull();
    expect(r.porcentajePonderadoConDatos).toBe(0);
  });

  it('con una sola categoría con datos, la nota final es la de esa categoría', () => {
    const categorias: CategoriaInput[] = [
      { nombre: 'Examen Parcial', peso: 40, nota: 16 },
      { nombre: 'Proyecto de Investigación', peso: 60, nota: null },
    ];
    const r = calcularRubrica(categorias);
    expect(r.notaFinal).toBe(16);
    expect(r.porcentajePonderadoConDatos).toBe(40);
  });

  it('promedia ponderadamente varias categorías con datos', () => {
    const categorias: CategoriaInput[] = [
      { nombre: 'Participación en Clase', peso: 20, nota: 20 },
      { nombre: 'Examen Final', peso: 30, nota: 10 },
    ];
    const r = calcularRubrica(categorias);
    // (20*20 + 30*10) / (20+30) = (400+300)/50 = 14
    expect(r.notaFinal).toBe(14);
    expect(r.porcentajePonderadoConDatos).toBe(50);
  });

  it('no asume 0 en categorías faltantes: renormaliza solo sobre las que tienen datos', () => {
    const categorias: CategoriaInput[] = [
      { nombre: 'Examen Final', peso: 25, nota: 20 },
      { nombre: 'Proyecto de Investigación', peso: 25, nota: 10 },
      { nombre: 'Retos', peso: 50, nota: null },
    ];
    const r = calcularRubrica(categorias);
    // (25*20 + 25*10) / (25+25) = 750/50 = 15
    expect(r.notaFinal).toBe(15);
    expect(r.porcentajePonderadoConDatos).toBe(50);
  });

  it('con todas las categorías completas, la nota final es el promedio ponderado exacto sobre 100', () => {
    const categorias: CategoriaInput[] = [
      { nombre: 'Participación en Clase', peso: 15, nota: 20 },
      { nombre: 'Tareas', peso: 15, nota: 18 },
      { nombre: 'Prácticas', peso: 20, nota: 10 },
      { nombre: 'Examen Final', peso: 25, nota: 12 },
      { nombre: 'Investigación', peso: 25, nota: 16 },
    ];
    const r = calcularRubrica(categorias);
    const esperado = (15 * 20 + 15 * 18 + 20 * 10 + 25 * 12 + 25 * 16) / 100;
    expect(r.notaFinal).toBe(Math.round(esperado * 100) / 100);
    expect(r.porcentajePonderadoConDatos).toBe(100);
  });

  it('funciona con cualquier cantidad y nombre de categorías (no hay 5 fijas)', () => {
    const categorias: CategoriaInput[] = [
      { nombre: 'Carpeta A', peso: 10, nota: 10 },
      { nombre: 'Carpeta B', peso: 10, nota: 10 },
      { nombre: 'Carpeta C', peso: 10, nota: 10 },
      { nombre: 'Carpeta D', peso: 10, nota: 10 },
      { nombre: 'Carpeta E', peso: 10, nota: 10 },
      { nombre: 'Carpeta F', peso: 10, nota: 10 },
    ];
    const r = calcularRubrica(categorias);
    expect(r.categorias.length).toBe(6);
    expect(r.notaFinal).toBe(10);
    expect(r.porcentajePonderadoConDatos).toBe(60);
  });

  it('redondea la nota final a 2 decimales', () => {
    const categorias: CategoriaInput[] = [
      { nombre: 'A', peso: 1, nota: 20 },
      { nombre: 'B', peso: 2, nota: 5 },
    ];
    const r = calcularRubrica(categorias);
    // (1*20 + 2*5)/3 = 30/3 = 10 exacto
    expect(r.notaFinal).toBe(10);

    const categorias2: CategoriaInput[] = [
      { nombre: 'A', peso: 1, nota: 20 },
      { nombre: 'B', peso: 1, nota: 5 },
      { nombre: 'C', peso: 1, nota: 7 },
    ];
    const r2 = calcularRubrica(categorias2);
    // (20+5+7)/3 = 32/3 = 10.666...
    expect(r2.notaFinal).toBe(10.67);
  });

  it('con lista vacía de categorías, devuelve notaFinal null y 0% sin lanzar error', () => {
    const r = calcularRubrica([]);
    expect(r.notaFinal).toBeNull();
    expect(r.porcentajePonderadoConDatos).toBe(0);
    expect(r.categorias).toEqual([]);
  });

  it('marca tieneDatos=false cuando nota es null, y tieneDatos=true cuando nota es 0 (no confunde "sin datos" con "sacó 0")', () => {
    const categorias: CategoriaInput[] = [
      { nombre: 'Examen Final', peso: 50, nota: 0 },
      { nombre: 'Investigación', peso: 50, nota: null },
    ];
    const r = calcularRubrica(categorias);
    const examen = r.categorias.find((c) => c.nombre === 'Examen Final')!;
    const investigacion = r.categorias.find((c) => c.nombre === 'Investigación')!;
    expect(examen.tieneDatos).toBe(true);
    expect(examen.nota).toBe(0);
    expect(investigacion.tieneDatos).toBe(false);
    expect(investigacion.nota).toBeNull();
    expect(r.notaFinal).toBe(0); // única categoría con datos sacó 0
    expect(r.porcentajePonderadoConDatos).toBe(50);
  });
});
