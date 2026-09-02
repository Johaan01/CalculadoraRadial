/*
 * cores.js — a tabela do código de cores para resistores (IEC 60062).
 *
 * Este é o único lugar do projeto onde uma cor é declarada. Qualquer outro
 * arquivo que precise de um tom, de um dígito ou de um multiplicador pergunta
 * aqui. Os tons foram escolhidos para manter contraste de pelo menos 4,5:1 com
 * a cor de texto de cada faixa, sem deixar de ser reconhecíveis como a cor real
 * do componente.
 */
(function (raiz) {
  'use strict';

  var LISTA = [
    { id:  0, nome: 'Preto',    fill: '#1f1f1f',         texto: '#ffffff', digito: 0,    mult: 1,    tol: null, ppm: 250  },
    { id:  1, nome: 'Marrom',   fill: '#7a4b2a',         texto: '#ffffff', digito: 1,    mult: 1e1,  tol: 1,    ppm: 100  },
    { id:  2, nome: 'Vermelho', fill: '#c62828',         texto: '#ffffff', digito: 2,    mult: 1e2,  tol: 2,    ppm: 50   },
    { id:  3, nome: 'Laranja',  fill: '#ef6c00',         texto: '#111111', digito: 3,    mult: 1e3,  tol: null, ppm: 15   },
    { id:  4, nome: 'Amarelo',  fill: '#fdd835',         texto: '#111111', digito: 4,    mult: 1e4,  tol: null, ppm: 25   },
    { id:  5, nome: 'Verde',    fill: '#2e7d32',         texto: '#ffffff', digito: 5,    mult: 1e5,  tol: 0.5,  ppm: 20   },
    { id:  6, nome: 'Azul',     fill: '#1565c0',         texto: '#ffffff', digito: 6,    mult: 1e6,  tol: 0.25, ppm: 10   },
    { id:  7, nome: 'Violeta',  fill: '#8e24aa',         texto: '#ffffff', digito: 7,    mult: 1e7,  tol: 0.1,  ppm: 5    },
    { id:  8, nome: 'Cinza',    fill: '#8a8a8a',         texto: '#111111', digito: 8,    mult: 1e8,  tol: 0.05, ppm: 1    },
    { id:  9, nome: 'Branco',   fill: '#f0f0f0',         texto: '#111111', digito: 9,    mult: 1e9,  tol: null, ppm: null },
    { id: 10, nome: 'Ouro',     fill: 'url(#gradOuro)',  texto: '#3a2b00', digito: null, mult: 0.1,  tol: 5,    ppm: null },
    { id: 11, nome: 'Prata',    fill: 'url(#gradPrata)', texto: '#222222', digito: null, mult: 0.01, tol: 10,   ppm: null }
  ];

  var porId = {};
  var porDigito = {};
  LISTA.forEach(function (cor) {
    porId[cor.id] = cor;
    if (cor.digito !== null) { porDigito[cor.digito] = cor; }
  });

  /*
   * Cada anel do mostrador é ordenado pela GRANDEZA que representa, do maior
   * para o menor. Como o primeiro arco desenhado fica na ponta superior direita
   * e o último na ponta superior esquerda, a ordem decrescente faz todos os
   * anéis serem lidos do menor para o maior a partir da esquerda. Isso vale
   * inclusive para tolerância e coeficiente térmico, onde a ordem por grandeza
   * não coincide com a ordem das cores.
   */
  function decrescentePor(campo) {
    return LISTA.filter(function (c) { return c[campo] !== null; })
                .sort(function (a, b) { return b[campo] - a[campo]; });
  }

  raiz.Cores = {
    lista: LISTA,
    por: function (id) {
      return (id === null || id === undefined) ? null : (porId[id] || null);
    },
    porDigito: function (d) { return porDigito[d] || null; },
    digitos: decrescentePor('digito'),
    multiplicadores: decrescentePor('mult'),
    tolerancias: decrescentePor('tol'),
    coeficientes: decrescentePor('ppm')
  };
}(window));
