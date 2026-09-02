/*
 * app.js — o estado da aplicação e a ligação entre as peças.
 *
 * Só este arquivo guarda estado. `resistor.js` calcula, `mostrador.js`,
 * `faixas.js` e `tiras.js` desenham; nenhum deles sabe o que está selecionado
 * até receber a informação daqui.
 *
 * `estado.selecoes` sempre tem uma entrada por faixa do componente, na ordem
 * em que se lê o resistor: dígitos, multiplicador, tolerância e, no modo de 6
 * faixas, coeficiente térmico. Quem edita as primeiras é o mostrador radial;
 * as duas últimas são as tiras abaixo dele. Os índices são os mesmos para
 * todos.
 */
(function () {
  'use strict';

  var Cores = window.Cores;
  var Resistor = window.Resistor;

  var CHAVE_ARMAZENAMENTO = 'calculadora-radial-resistores';
  var ORDINAIS = ['1º', '2º', '3º'];
  var PPM_PADRAO = 1;   /* marrom, 100 ppm/K */

  var PADROES = {
    4: [1, 0, 2, 10],       /* marrom preto vermelho ouro  = 1 kΩ ±5%  */
    5: [1, 0, 0, 1, 1],     /* marrom preto preto marrom marrom = 1 kΩ ±1% */
    6: [1, 0, 0, 1, 1, 1]   /* o mesmo, com 100 ppm/K */
  };

  /*
   * A tolerância acompanha o número de faixas em vez de ser preservada na
   * troca: resistor de 4 faixas é quase sempre ouro (±5%) e o de 5 é quase
   * sempre marrom (±1%). Manter ouro ao passar para 5 faixas deixava o app
   * mostrando a combinação errada na maioria dos casos.
   */
  var TOLERANCIA_PADRAO = { 4: 10, 5: 1, 6: 1 };

  var el = {
    entrada:      document.getElementById('valor'),
    tolerancia:   document.getElementById('tolerancia'),
    intervalo:    document.getElementById('intervalo'),
    avisos:       document.getElementById('avisos'),
    recado:       document.getElementById('recado'),
    grupoFaixas:  document.getElementById('faixas-resistor'),
    grupoRotulos: document.getElementById('rotulos-resistor'),
    mostrador:    document.getElementById('mostrador'),
    seletorModo:  document.getElementById('seletor-modo'),
    tiraTol:      document.getElementById('tira-tolerancia'),
    tiraCoef:     document.getElementById('tira-coeficiente'),
    blocoCoef:    document.getElementById('bloco-coeficiente'),
    valorTol:     document.getElementById('valor-tolerancia'),
    valorCoef:    document.getElementById('valor-coeficiente'),
    tabela:       document.querySelector('#leitura-faixas tbody'),
    botaoLink:    document.getElementById('copiar-link'),
    botaoLimpar:  document.getElementById('limpar'),
    botaoInstalar: document.getElementById('instalar')
  };

  var estado = { modo: 4, selecoes: PADROES[4].slice() };

  var mostrador = window.criarMostrador(el.mostrador, escolher);
  var desenho = window.criarDesenho(el.grupoFaixas, el.grupoRotulos);
  var tiraTolerancia = window.criarTira(el.tiraTol, escolherTolerancia);
  var tiraCoeficiente = window.criarTira(el.tiraCoef, escolherCoeficiente);

  /* ---------------------------------------------------------------- estado */

  /*
   * Uma seleção vinda da URL ou do armazenamento local pode ser qualquer
   * coisa. Sem esta checagem, um anel de dígito com ouro (que não tem dígito)
   * faria a leitura virar NaN silenciosamente.
   */
  function selecoesValidas(selecoes, modo) {
    if (!Array.isArray(selecoes) || selecoes.length !== modo) { return false; }
    var nDig = Resistor.digitosDe(modo);
    for (var i = 0; i < modo; i++) {
      if (selecoes[i] === null) { continue; }
      var cor = Cores.por(selecoes[i]);
      if (!cor) { return false; }
      if (i < nDig && cor.digito === null) { return false; }
      if (i === nDig && cor.mult === null) { return false; }
      if (i === nDig + 1 && cor.tol === null) { return false; }
      if (i === nDig + 2 && cor.ppm === null) { return false; }
    }
    return true;
  }

  function estadoValido(candidato) {
    if (!candidato) { return null; }
    if ([4, 5, 6].indexOf(candidato.modo) === -1) { return null; }
    if (!selecoesValidas(candidato.selecoes, candidato.modo)) { return null; }
    return { modo: candidato.modo, selecoes: candidato.selecoes.slice() };
  }

  function lerDaUrl() {
    var params = new URLSearchParams(window.location.search);
    if (!params.get('f')) { return null; }
    var cores = (params.get('c') || '').split('-').map(function (pedaco) {
      if (pedaco === 'x') { return null; }
      var n = parseInt(pedaco, 10);
      return isNaN(n) ? undefined : n;
    });
    return estadoValido({ modo: parseInt(params.get('f'), 10), selecoes: cores });
  }

  function lerDoArmazenamento() {
    try {
      var bruto = window.localStorage.getItem(CHAVE_ARMAZENAMENTO);
      return bruto ? estadoValido(JSON.parse(bruto)) : null;
    } catch (erro) {
      return null;   /* modo anônimo, cookies bloqueados, JSON corrompido */
    }
  }

  function guardar() {
    try {
      window.localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(estado));
    } catch (erro) { /* sem armazenamento: o app continua funcionando */ }

    try {
      var consulta = '?f=' + estado.modo
        + '&c=' + estado.selecoes.map(function (id) {
            return id === null ? 'x' : id;
          }).join('-');
      window.history.replaceState(null, '', consulta);
    } catch (erro) { /* file:// não deixa mexer no histórico */ }
  }

  /* -------------------------------------------------------------- mensagens */

  function mostrarAvisos(mensagens, tipo) {
    el.avisos.textContent = '';
    el.avisos.hidden = !mensagens || mensagens.length === 0;
    el.avisos.className = 'avisos' + (tipo === 'erro' ? ' avisos--erro' : '');
    (mensagens || []).forEach(function (texto) {
      var linha = document.createElement('p');
      linha.textContent = texto;
      el.avisos.appendChild(linha);
    });
  }

  var timerRecado = null;
  function recado(texto) {
    el.recado.textContent = texto;
    window.clearTimeout(timerRecado);
    timerRecado = window.setTimeout(function () { el.recado.textContent = ''; }, 4000);
  }

  /* ------------------------------------------------------------- desenho/UI */

  function papelDaFaixa(indice, modo) {
    var nDig = Resistor.digitosDe(modo);
    if (indice < nDig) { return ORDINAIS[indice] + ' dígito'; }
    if (indice === nDig) { return 'Multiplicador'; }
    if (indice === nDig + 1) { return 'Tolerância'; }
    return 'Coef. térmico';
  }

  function significadoDaFaixa(indice, modo, cor) {
    if (!cor) { return '—'; }
    var nDig = Resistor.digitosDe(modo);
    if (indice < nDig) { return String(cor.digito); }
    if (indice === nDig) { return Resistor.formatarMultiplicador(cor.mult); }
    if (indice === nDig + 1) { return '±' + Resistor.numero(cor.tol) + '%'; }
    return cor.ppm + ' ppm/K';
  }

  /* Amostra da cor + o valor por extenso, ao lado do rótulo da tira. */
  function escreverEscolha(destino, cor, texto) {
    destino.textContent = '';
    if (!cor) { return; }
    var amostra = document.createElement('span');
    amostra.className = 'amostra amostra--' + cor.id;
    if (cor.fill.charAt(0) === '#') { amostra.style.background = cor.fill; }
    destino.appendChild(amostra);
    destino.appendChild(document.createTextNode(texto + ' · ' + cor.nome));
  }

  function preencherTabela(impossiveis) {
    el.tabela.textContent = '';
    estado.selecoes.forEach(function (id, indice) {
      var cor = Cores.por(id);
      var linha = document.createElement('tr');
      if (impossiveis.indexOf(indice) !== -1) { linha.className = 'linha-impossivel'; }

      var papel = document.createElement('th');
      papel.setAttribute('scope', 'row');
      papel.textContent = papelDaFaixa(indice, estado.modo);

      var celulaCor = document.createElement('td');
      var amostra = document.createElement('span');
      amostra.className = 'amostra' + (cor ? ' amostra--' + cor.id : ' amostra--vazia');
      if (cor && cor.fill.charAt(0) === '#') { amostra.style.background = cor.fill; }
      celulaCor.appendChild(amostra);
      celulaCor.appendChild(document.createTextNode(cor ? cor.nome : 'não escolhida'));

      var significado = document.createElement('td');
      significado.textContent = significadoDaFaixa(indice, estado.modo, cor);

      linha.appendChild(papel);
      linha.appendChild(celulaCor);
      linha.appendChild(significado);
      el.tabela.appendChild(linha);
    });
  }

  function renderizar(notasExtras) {
    var leitura = Resistor.decodificar(estado.selecoes, estado.modo);
    var nDig = Resistor.digitosDe(estado.modo);

    desenho.atualizar(estado.selecoes);
    mostrador.atualizar(estado.selecoes, leitura.impossiveis);
    preencherTabela(leitura.impossiveis);

    /* A pastilha marcada diz onde está a escolha; o texto ao lado do rótulo
       diz qual é, sem obrigar a decorar a cor. */
    var corTol = Cores.por(estado.selecoes[nDig + 1]);
    tiraTolerancia.atualizar(estado.selecoes[nDig + 1]);
    escreverEscolha(el.valorTol, corTol,
      corTol ? '±' + Resistor.numero(corTol.tol) + '%' : '');

    el.blocoCoef.hidden = estado.modo !== 6;
    if (estado.modo === 6) {
      var corPpm = Cores.por(estado.selecoes[nDig + 2]);
      tiraCoeficiente.atualizar(estado.selecoes[nDig + 2]);
      escreverEscolha(el.valorCoef, corPpm, corPpm ? corPpm.ppm + ' ppm/K' : '');
    }

    /*
     * Duas linhas curtas dentro do mostrador e uma abaixo dele. O que fica no
     * centro precisa caber na largura livre do disco, então os nomes das cores
     * ficam de fora — eles já estão na tabela, por extenso.
     */
    if (!leitura.completo) {
      el.entrada.value = '— — —';
      el.entrada.classList.add('indefinido');
      el.tolerancia.textContent = 'faixas incompletas';
      el.intervalo.textContent = 'Escolha as faixas que faltam para ver o valor.';
    } else {
      el.entrada.value = Resistor.formatar(leitura.ohms);
      el.entrada.classList.remove('indefinido');

      /* Só a tolerância. O coeficiente térmico não muda o valor do resistor —
         não tem por que disputar espaço com ele na leitura principal; fica na
         tira própria e na tabela. */
      el.tolerancia.textContent = '±' + Resistor.numero(leitura.tolerancia) + '%';

      var margem = leitura.ohms * leitura.tolerancia / 100;
      el.intervalo.textContent = 'Na tolerância, o resistor real está entre '
        + Resistor.formatar(leitura.ohms - margem) + ' e '
        + Resistor.formatar(leitura.ohms + margem) + '.';
    }

    mostrarAvisos((notasExtras || []).concat(leitura.notas));
    guardar();
  }

  /* ------------------------------------------------------------------ ações */

  function escolher(indiceAnel, corId, forcar) {
    var atual = estado.selecoes[indiceAnel];
    estado.selecoes[indiceAnel] = (!forcar && atual === corId) ? null : corId;
    renderizar();
  }

  /* Tolerância e coeficiente são obrigatórios: a tira só troca, nunca esvazia. */
  function escolherTolerancia(corId) {
    estado.selecoes[Resistor.digitosDe(estado.modo) + 1] = corId;
    renderizar();
  }

  function escolherCoeficiente(corId) {
    estado.selecoes[Resistor.digitosDe(estado.modo) + 2] = corId;
    renderizar();
  }

  /*
   * Trocar o número de faixas preserva o valor em ohms sempre que ele couber
   * no novo formato, em vez de zerar tudo como o protótipo fazia. Se o valor
   * precisar ser ajustado para caber, `codificar` devolve a nota explicando o
   * ajuste e ela aparece na tela.
   */
  function trocarModo(novoModo) {
    if (novoModo === estado.modo) { return; }

    var nDigAntes = Resistor.digitosDe(estado.modo);
    var leitura = Resistor.decodificar(estado.selecoes, estado.modo);
    var idPpm = estado.modo === 6 ? estado.selecoes[nDigAntes + 2] : PPM_PADRAO;

    var nDigDepois = Resistor.digitosDe(novoModo);
    var novas = null;
    var notas = [];

    if (leitura.completo && leitura.ohms > 0) {
      var codificado = Resistor.codificar(leitura.ohms, novoModo);
      if (codificado.ok) {
        novas = codificado.faixas.slice();
        notas = codificado.notas;
      }
    }
    if (!novas) { novas = PADROES[novoModo].slice(0, nDigDepois + 1); }

    novas.push(TOLERANCIA_PADRAO[novoModo]);
    if (novoModo === 6) {
      novas.push(idPpm === null || idPpm === undefined ? PPM_PADRAO : idPpm);
    }

    estado.modo = novoModo;
    estado.selecoes = novas;

    mostrador.montar(novoModo);
    desenho.montar(novoModo);
    marcarModoAtivo();
    renderizar(notas);
  }

  function marcarModoAtivo() {
    Array.prototype.forEach.call(el.seletorModo.children, function (botao) {
      var ativo = parseInt(botao.dataset.modo, 10) === estado.modo;
      botao.classList.toggle('ativo', ativo);
      botao.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    });
  }

  function aplicarTextoDigitado() {
    var ohms = Resistor.analisar(el.entrada.value);
    var resultado = Resistor.codificar(ohms, estado.modo);

    if (!resultado.ok) {
      mostrarAvisos([resultado.erro], 'erro');
      var leitura = Resistor.decodificar(estado.selecoes, estado.modo);
      el.entrada.value = leitura.completo ? Resistor.formatar(leitura.ohms) : '— — —';
      return;
    }

    var nDig = Resistor.digitosDe(estado.modo);
    var novas = resultado.faixas.slice();
    /* Digitar um valor muda os dígitos, não a tolerância que a pessoa
       escolheu — só repõe o padrão se ela estiver vazia. */
    var idTolerancia = estado.selecoes[nDig + 1];
    novas.push(idTolerancia === null || idTolerancia === undefined
      ? TOLERANCIA_PADRAO[estado.modo] : idTolerancia);
    if (estado.modo === 6) {
      var idPpm = estado.selecoes[nDig + 2];
      novas.push(idPpm === null || idPpm === undefined ? PPM_PADRAO : idPpm);
    }

    estado.selecoes = novas;
    renderizar(resultado.notas);
  }

  function copiarLink() {
    var endereco = window.location.href;
    function feito() { recado('Link copiado — ele reabre o app neste resistor.'); }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(endereco).then(feito, function () {
        mostrarAvisos(['Não consegui copiar sozinho. O link é: ' + endereco]);
      });
      return;
    }
    mostrarAvisos(['Copie o link da barra de endereços: ' + endereco]);
  }

  /* ------------------------------------------------------------- construção */

  function montarSeletorModo() {
    [4, 5, 6].forEach(function (modo) {
      var botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'btn-modo';
      botao.dataset.modo = modo;
      /* Só o número: no centro do mostrador a largura livre é o diâmetro do
         disco. O sentido vem da legenda "faixas" logo acima e do aria-label. */
      botao.textContent = String(modo);
      botao.setAttribute('aria-label', modo + ' faixas');
      botao.setAttribute('aria-pressed', 'false');
      botao.addEventListener('click', function () { trocarModo(modo); });
      el.seletorModo.appendChild(botao);
    });
  }

  function montarTiras() {
    tiraTolerancia.montar(
      Cores.tolerancias,
      function (c) { return Resistor.numero(c.tol); },
      function (c) { return 'tolerância de ±' + Resistor.numero(c.tol) + '%'; }
    );
    tiraCoeficiente.montar(
      Cores.coeficientes,
      function (c) { return String(c.ppm); },
      function (c) { return c.ppm + ' ppm por kelvin'; }
    );
  }

  function ligarEntrada() {
    el.entrada.addEventListener('focus', function () { this.select(); });
    el.entrada.addEventListener('keydown', function (evento) {
      if (evento.key === 'Enter') { evento.preventDefault(); this.blur(); }
    });
    el.entrada.addEventListener('change', aplicarTextoDigitado);
  }

  function ligarInstalacao() {
    var convite = null;

    window.addEventListener('beforeinstallprompt', function (evento) {
      evento.preventDefault();
      convite = evento;
      el.botaoInstalar.hidden = false;
    });

    el.botaoInstalar.addEventListener('click', function () {
      if (!convite) { return; }
      convite.prompt();
      convite.userChoice.then(function () {
        convite = null;
        el.botaoInstalar.hidden = true;
      });
    });

    window.addEventListener('appinstalled', function () {
      el.botaoInstalar.hidden = true;
      recado('App instalado. Ele abre e funciona sem internet.');
    });
  }

  function registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) { return; }
    if (window.location.protocol.indexOf('http') !== 0) { return; }  /* file:// não serve */
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function (erro) {
        console.warn('Service worker não registrado:', erro);
      });
    });
  }

  function iniciar() {
    var inicial = lerDaUrl() || lerDoArmazenamento();
    if (inicial) { estado = inicial; }

    montarSeletorModo();
    montarTiras();
    ligarEntrada();
    ligarInstalacao();

    el.botaoLink.addEventListener('click', copiarLink);
    el.botaoLimpar.addEventListener('click', function () {
      estado.selecoes = PADROES[estado.modo].slice();
      renderizar();
      recado('Voltou para o resistor de referência de 1 kΩ.');
    });

    mostrador.montar(estado.modo);
    desenho.montar(estado.modo);
    marcarModoAtivo();
    renderizar();

    registrarServiceWorker();
  }

  iniciar();
}());
