// words.js
// Banco de palabras para Pasapalabra
// Cada respuesta empieza por su letra correspondiente.
// status: 0 = pendiente, 1 = correcto, 2 = error

const WORD_BANK = [
  {
    letter: 'A',
    answer: 'ALGEBRA',
    clue: 'Rama de las matemáticas que usa símbolos y letras para representar números y operaciones.',
    status: 0,
  },
  {
    letter: 'B',
    answer: 'BARROCO',
    clue: 'Estilo artístico recargado y ornamentado que dominó Europa durante el siglo XVII.',
    status: 0,
  },
  {
    letter: 'C',
    answer: 'COMPÁS',
    clue: 'Instrumento de dibujo con dos brazos articulados usado para trazar circunferencias.',
    status: 0,
  },
  {
    letter: 'D',
    answer: 'DESIERTO',
    clue: 'Región árida caracterizada por escasas precipitaciones y temperaturas extremas.',
    status: 0,
  },
  {
    letter: 'E',
    answer: 'ECLIPSE',
    clue: 'Fenómeno astronómico en el que un cuerpo celeste pasa por la sombra de otro.',
    status: 0,
  },
  {
    letter: 'F',
    answer: 'FIORDO',
    clue: 'Entrada de mar larga, estrecha y profunda entre acantilados altos, frecuente en Noruega.',
    status: 0,
  },
  {
    letter: 'G',
    answer: 'GLACIAR',
    clue: 'Masa de hielo que se desplaza lentamente formada a partir de nieve compactada en las montañas.',
    status: 0,
  },
  {
    letter: 'H',
    answer: 'HURACÁN',
    clue: 'Tormenta tropical intensa con vientos en espiral que superan los 120 km/h.',
    status: 0,
  },
  {
    letter: 'I',
    answer: 'IGLÚ',
    clue: 'Refugio con forma de cúpula construido con bloques de nieve compactada, usado por los inuit.',
    status: 0,
  },
  {
    letter: 'J',
    answer: 'JABALINA',
    clue: 'Lanza ligera que se lanza a la mayor distancia posible como prueba de atletismo.',
    status: 0,
  },
  {
    letter: 'K',
    answer: 'KAYAK',
    clue: 'Pequeña embarcación estrecha propulsada con un remo de doble pala.',
    status: 0,
  },
  {
    letter: 'L',
    answer: 'LABERINTO',
    clue: 'Red complicada de pasillos o caminos por los que es difícil encontrar la salida.',
    status: 0,
  },
  {
    letter: 'M',
    answer: 'MONZÓN',
    clue: 'Viento estacional que trae fuertes lluvias periódicas, especialmente al sur de Asia.',
    status: 0,
  },
  {
    letter: 'N',
    answer: 'NEBULOSA',
    clue: 'Gran nube interestelar de gas y polvo visible en el espacio exterior.',
    status: 0,
  },
  {
    letter: 'O',
    answer: 'ÓRBITA',
    clue: 'Trayectoria curva que sigue un objeto celeste alrededor de una estrella o planeta.',
    status: 0,
  },
  {
    letter: 'P',
    answer: 'PERMAFROST',
    clue: 'Suelo permanentemente congelado bajo la superficie en regiones árticas y subárticas.',
    status: 0,
  },
  {
    letter: 'Q',
    answer: 'QUIMERA',
    clue: 'Monstruo de la mitología griega con cabeza de león, cuerpo de cabra y cola de serpiente.',
    status: 0,
  },
  {
    letter: 'R',
    answer: 'REFRACCIÓN',
    clue: 'Cambio de dirección de una onda luminosa al pasar de un medio transparente a otro.',
    status: 0,
  },
  {
    letter: 'S',
    answer: 'SEQUÍA',
    clue: 'Período prolongado de escasas precipitaciones que provoca una grave escasez de agua.',
    status: 0,
  },
  {
    letter: 'T',
    answer: 'TSUNAMI',
    clue: 'Serie de poderosas olas oceánicas generadas por un terremoto o corrimiento submarino.',
    status: 0,
  },
  {
    letter: 'U',
    answer: 'ULTRAVIOLETA',
    clue: 'Radiación electromagnética de longitud de onda inferior a la luz visible, emitida por el sol.',
    status: 0,
  },
  {
    letter: 'V',
    answer: 'VENENO',
    clue: 'Sustancia tóxica producida por animales como serpientes, arañas o medusas.',
    status: 0,
  },
  {
    letter: 'W',
    answer: 'WOLFRAMIO',
    clue: 'Elemento químico metálico con el punto de fusión más alto de todos los elementos conocidos.',
    status: 0,
  },
  {
    letter: 'X',
    answer: 'XILÓFONO',
    clue: 'Instrumento musical formado por barras de madera de distinto tamaño que se golpean con mazas.',
    status: 0,
  },
  {
    letter: 'Y',
    answer: 'YATE',
    clue: 'Embarcación de recreo, generalmente de vela o motor, usada para navegar y hacer cruceros.',
    status: 0,
  },
  {
    letter: 'Z',
    answer: 'ZODÍACO',
    clue: 'Banda imaginaria del cielo dividida en doce constelaciones por donde transita aparentemente el sol.',
    status: 0,
  },
];
