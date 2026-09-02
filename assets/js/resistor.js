/*
 * resistor.js — regra de negócio pura: converte cores em valor e valor em
 * cores. Não toca no DOM e não conhece a interface. Tudo aqui pode ser testado
 * chamando as funções direto pelo console do navegador.
 */
(function (raiz) {
  'use strict';

  var Cores = raiz.Cores;

  /* Séries comerciais (IEC 60063). */
  var E24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43,
             47, 51, 56, 62, 68, 75, 82, 91];

  var E96 = [100, 102, 105, 107, 110, 113, 115, 118, 121, 124, 127, 130, 133,
             137, 140, 143, 147, 150, 154, 158, 162, 165, 169, 174, 178, 182,
             187, 191, 196, 200, 205, 210, 215, 221, 226, 232, 237, 243, 249,
             255, 261, 267, 274, 280, 287, 294, 301, 309, 316, 324, 332, 340,
             348, 357, 365, 374, 383, 392, 402, 412, 422, 432, 442, 453, 464,
             475, 487, 499, 511, 523, 536, 549, 562, 576, 590, 604, 619, 634,
             649, 665, 681, 698, 715, 732, 750, 768, 787, 806, 825, 845, 866,
             887, 909, 931, 953, 976];

  /*
   * Com três dígitos significativos não basta consultar a E96: os valores
   * clássicos da E24 (4k7, 2k2, 3k3...) também são fabricados em 1% e aparecem
   * escritos com três dígitos. Sem essa união, digitar 4k7 no modo de 5 faixas
   * seria "corrigido" para 4k75 — justamente o resistor que ninguém tem na
   * gaveta.
   */
  var SERIE_3 = E96.concat(E24.map(function (v) { return v * 10; }))
                   .filter(function (v, i, todos) { return todos.indexOf(v) === i; })
                   .sort(function (a, b) { return a - b; });

  function serieDe(nDigitos) { return nDigitos === 2 ? E24 : SERIE_3; }
  function nomeSerieDe(nDigitos) { return nDigitos === 2 ? 'E24' : 'E96/E24'; }

  /* Mata o lixo de ponto flutuante que aparece em contas como 47 * 0.1. */
  function precisao(n) { return parseFloat(n.toPrecision(12)); }

  function numeroPtBr(n) {
    return precisao(n).toLocaleString('pt-BR', {
      maximumFractionDigits: 4,
      useGrouping: false
    });
  }

  function formatar(ohms) {
    if (ohms === null || !isFinite(ohms)) { return '—'; }
    var v = precisao(ohms);
    var unidade = ' Ω';
    if (Math.abs(v) >= 1e9)      { v = precisao(v / 1e9); unidade = ' GΩ'; }
    else if (Math.abs(v) >= 1e6) { v = precisao(v / 1e6); unidade = ' MΩ'; }
    else if (Math.abs(v) >= 1e3) { v = precisao(v / 1e3); unidade = ' kΩ'; }
    return numeroPtBr(v) + unidade;
  }

  function formatarMultiplicador(mult) {
    if (mult >= 1e9) { return '×1 G'; }
    if (mult >= 1e6) { return '×' + numeroPtBr(mult / 1e6) + ' M'; }
    if (mult >= 1e3) { return '×' + numeroPtBr(mult / 1e3) + ' k'; }
    return '×' + numeroPtBr(mult);
  }

  var SUFIXOS = { r: 1, k: 1e3, m: 1e6, g: 1e9 };

  /*
   * Lê o que a pessoa digitou. Aceita "470", "4.7k", "4,7k", "1M", "220 ohms",
   * "33R" e a notação RKM usada em esquemas ("4k7" = 4700, "2R2" = 2,2).
   * O protótipo tratava "4k7" como 47000, porque apagava a letra e colava os
   * dígitos.
   */
  function analisar(texto) {
    if (typeof texto !== 'string') { return null; }
    var s = texto.trim().toLowerCase();
    /* ω omega minusculo, Ω omega maiusculo, Ω sinal de ohm. */
    s = s.replace(/[ωΩΩ]|ohms?/g, '');
    s = s.replace(/\s+/g, '').replace(/,/g, '.');
    if (!s) { return null; }

    var rkm = /^(\d+)([rkmg])(\d+)$/.exec(s);
    if (rkm) {
      var composto = parseFloat(rkm[1] + '.' + rkm[3]);
      return isFinite(composto) ? composto * SUFIXOS[rkm[2]] : null;
    }

    var simples = /^(\d+(?:\.\d+)?)([rkmg])?$/.exec(s);
    if (simples) {
      var n = parseFloat(simples[1]);
      if (!isFinite(n)) { return null; }
      return n * (simples[2] ? SUFIXOS[simples[2]] : 1);
    }
    return null;
  }

  /* Valor da série mais próximo em termos relativos — a série é logarítmica. */
  function maisProximoNaSerie(mantissa, serie) {
    var melhor = serie[0];
    var menorErro = Infinity;
    serie.forEach(function (v) {
      var erro = Math.abs(v - mantissa) / mantissa;
      if (erro < menorErro - 1e-12) { menorErro = erro; melhor = v; }
    });
    return melhor;
  }

  function corDoMultiplicador(mult) {
    return Cores.lista.filter(function (c) {
      return c.mult !== null && Math.abs(c.mult - mult) <= Math.abs(mult) * 1e-9;
    })[0] || null;
  }

  function digitosDe(modo) { return modo === 4 ? 2 : 3; }

  /*
   * Valor -> faixas. Devolve só os dígitos e o multiplicador; a tolerância e o
   * coeficiente térmico continuam sendo escolha do usuário e são preservados
   * por quem chama.
   *
   * As `notas` existem para que nada aconteça em silêncio: se o valor pedido
   * não cabe no número de dígitos, ou se ele não existe como componente
   * comercial, a pessoa é avisada do que foi montado no lugar e por quê.
   */
  function codificar(ohms, modo) {
    var nDig = digitosDe(modo);
    var serie = serieDe(nDig);
    var notas = [];

    if (ohms === null || !isFinite(ohms) || ohms <= 0) {
      return { ok: false, erro: 'Não entendi esse valor. Tente algo como 470, 4k7, 2.2M ou 33R.' };
    }

    var minMant = Math.pow(10, nDig - 1);
    var maxMant = Math.pow(10, nDig) - 1;

    var expo = Math.floor(Math.log10(ohms)) - (nDig - 1);
    var mantissa = Math.round(ohms / Math.pow(10, expo));
    if (mantissa > maxMant) { expo += 1; mantissa = Math.round(ohms / Math.pow(10, expo)); }
    if (mantissa < minMant) { expo -= 1; mantissa = Math.round(ohms / Math.pow(10, expo)); }

    var arredondado = precisao(mantissa * Math.pow(10, expo));
    if (Math.abs(arredondado - ohms) > Math.abs(ohms) * 1e-9) {
      notas.push('Com ' + modo + ' faixas cabem só ' + nDig + ' dígitos significativos, '
        + 'então ' + formatar(ohms) + ' virou ' + formatar(arredondado) + '.');
    }

    var comercial = maisProximoNaSerie(mantissa, serie);
    if (comercial !== mantissa) {
      var valorComercial = precisao(comercial * Math.pow(10, expo));
      var desvio = ((valorComercial - arredondado) / arredondado) * 100;
      notas.push(formatar(arredondado) + ' não existe na série ' + nomeSerieDe(nDig)
        + ', ou seja, não é um resistor que se compre. Montei o comercial mais '
        + 'próximo: ' + formatar(valorComercial) + ' (' + (desvio > 0 ? '+' : '')
        + desvio.toFixed(1).replace('.', ',') + '%).');
      mantissa = comercial;
    }

    var mult = Math.pow(10, expo);
    var corMult = corDoMultiplicador(mult);
    if (!corMult) {
      return {
        ok: false,
        erro: 'Fora do alcance do código de cores. Com ' + modo + ' faixas dá para '
          + 'representar de ' + formatar(minMant * 0.01) + ' a ' + formatar(maxMant * 1e9) + '.'
      };
    }

    var faixas = String(mantissa).split('').map(function (d) {
      return Cores.porDigito(parseInt(d, 10)).id;
    });
    faixas.push(corMult.id);

    return {
      ok: true,
      faixas: faixas,
      ohms: precisao(mantissa * mult),
      notas: notas
    };
  }

  /*
   * Faixas -> valor. Aqui as notas nunca alteram nada: o que a pessoa escolheu
   * no mostrador é o que aparece. Elas só apontam quando a combinação, embora
   * válida no papel, não corresponde a um componente real.
   */
  function decodificar(selecoes, modo) {
    var nDig = digitosDe(modo);
    var leitura = {
      completo: false, ohms: null, tolerancia: null, ppm: null,
      notas: [],
      /* Índices de faixas que não podem existir num componente real. Quem
         desenha usa isso para marcar a faixa em vermelho. */
      impossiveis: []
    };

    var i;
    for (i = 0; i < modo; i++) {
      if (selecoes[i] === null || selecoes[i] === undefined) { return leitura; }
    }
    leitura.completo = true;

    var mantissa = 0;
    for (i = 0; i < nDig; i++) { mantissa = mantissa * 10 + Cores.por(selecoes[i]).digito; }

    var mult = Cores.por(selecoes[nDig]).mult;
    leitura.mantissa = mantissa;
    leitura.ohms = precisao(mantissa * mult);
    leitura.tolerancia = Cores.por(selecoes[nDig + 1]).tol;
    if (modo === 6) { leitura.ppm = Cores.por(selecoes[nDig + 2]).ppm; }

    if (Cores.por(selecoes[0]).digito === 0) {
      leitura.impossiveis.push(0);
      leitura.notas.push('A primeira faixa está marcada em vermelho porque nenhum '
        + 'resistor comercial começa com preto: o primeiro dígito não pode ser zero. '
        + 'Com preto ali o valor perde um dígito significativo — a conta acima fecha, '
        + 'mas esse componente não existe para comprar. Escolha outra cor na faixa mais '
        + 'interna do mostrador.');
    } else if (serieDe(nDig).indexOf(mantissa) === -1) {
      leitura.notas.push('Essa combinação dá ' + formatar(leitura.ohms) + ', um valor que '
        + 'não pertence à série ' + nomeSerieDe(nDig) + ' — a lista de valores que a '
        + 'indústria realmente fabrica. A leitura das faixas está correta, mas dificilmente '
        + 'você encontra esse resistor à venda. Digitando o valor no centro do mostrador, o '
        + 'app monta sozinho o comercial mais próximo.');
    }

    return leitura;
  }

  raiz.Resistor = {
    analisar: analisar,
    formatar: formatar,
    formatarMultiplicador: formatarMultiplicador,
    numero: numeroPtBr,
    precisao: precisao,
    codificar: codificar,
    decodificar: decodificar,
    digitosDe: digitosDe,
    nomeSerieDe: nomeSerieDe
  };
}(window));
