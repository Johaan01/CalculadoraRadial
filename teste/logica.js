// Executa cores.js e resistor.js sob o JScript do Windows (cscript //Nologo).
// O JScript e nivel IE8, entao os metodos ES5 usados pelo codigo precisam de
// polyfill aqui. O objetivo e exercitar a matematica real do modulo, nao a UI.

var window = this;

if (!Array.prototype.forEach) {
  Array.prototype.forEach = function (fn, esc) {
    for (var i = 0; i < this.length; i++) { fn.call(esc, this[i], i, this); }
  };
}
if (!Array.prototype.map) {
  Array.prototype.map = function (fn, esc) {
    var r = [];
    for (var i = 0; i < this.length; i++) { r.push(fn.call(esc, this[i], i, this)); }
    return r;
  };
}
if (!Array.prototype.filter) {
  Array.prototype.filter = function (fn, esc) {
    var r = [];
    for (var i = 0; i < this.length; i++) {
      if (fn.call(esc, this[i], i, this)) { r.push(this[i]); }
    }
    return r;
  };
}
if (!Array.prototype.reduce) {
  Array.prototype.reduce = function (fn, inicial) {
    var acc = inicial;
    for (var i = 0; i < this.length; i++) { acc = fn(acc, this[i], i, this); }
    return acc;
  };
}
if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function (alvo) {
    for (var i = 0; i < this.length; i++) { if (this[i] === alvo) { return i; } }
    return -1;
  };
}
if (!Array.isArray) {
  Array.isArray = function (v) {
    return Object.prototype.toString.call(v) === '[object Array]';
  };
}
if (!String.prototype.trim) {
  String.prototype.trim = function () { return this.replace(/^\s+|\s+$/g, ''); };
}
if (!Math.log10) {
  Math.log10 = function (x) { return Math.log(x) / Math.LN10; };
}
// Sem Intl no JScript: virgula decimal na mao, so para as mensagens montarem.
Number.prototype.toLocaleString = function () {
  return String(this).replace('.', ',');
};

function ler(caminho) {
  var fluxo = new ActiveXObject('ADODB.Stream');
  fluxo.Type = 2;
  fluxo.Charset = 'utf-8';
  fluxo.Open();
  fluxo.LoadFromFile(caminho);
  var texto = fluxo.ReadText();
  fluxo.Close();
  return texto;
}

// Caminho relativo ao proprio script, para rodar de qualquer maquina.
var fso = new ActiveXObject('Scripting.FileSystemObject');
var RAIZ = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName));
var BASE = fso.BuildPath(fso.BuildPath(RAIZ, 'assets'), 'js');
eval(ler(fso.BuildPath(BASE, 'cores.js')));
eval(ler(fso.BuildPath(BASE, 'resistor.js')));

var R = window.Resistor;
var OHM = '\u03a9';

var passou = 0, falhou = 0;

function ok(nome, real, esperado) {
  var a = (real instanceof Array) ? real.join(',') : String(real);
  var b = (esperado instanceof Array) ? esperado.join(',') : String(esperado);
  if (a === b) {
    passou++;
  } else {
    falhou++;
    WScript.Echo('  FALHOU  ' + nome + '\n          obtido:   ' + a +
                 '\n          esperado: ' + b);
  }
}

WScript.Echo('--- leitura do texto digitado ---');
ok('470', R.analisar('470'), 470);
ok('4k7 (notacao RKM)', R.analisar('4k7'), 4700);
ok('4.7k', R.analisar('4.7k'), 4700);
ok('4,7k (virgula)', R.analisar('4,7k'), 4700);
ok('2R2', R.analisar('2R2'), 2.2);
ok('1M', R.analisar('1M'), 1000000);
ok('220 ohms', R.analisar('220 ohms'), 220);
ok('1 k' + OHM, R.analisar('1 k' + OHM), 1000);
ok('texto invalido', R.analisar('abc'), null);
ok('vazio', R.analisar('   '), null);

WScript.Echo('--- valor -> faixas (4 faixas) ---');
var c;
c = R.codificar(4700, 4);
ok('4k7 faixas', c.faixas, [4, 7, 2]);
ok('4k7 ohms', c.ohms, 4700);
ok('4k7 sem notas', c.notas.length, 0);

c = R.codificar(4.7, 4);
ok('4R7 usa OURO no multiplicador', c.faixas, [4, 7, 10]);
ok('4R7 ohms', c.ohms, 4.7);

c = R.codificar(0.47, 4);
ok('0R47 usa PRATA no multiplicador', c.faixas, [4, 7, 11]);

c = R.codificar(91e9, 4);
ok('91G usa BRANCO no multiplicador', c.faixas, [9, 1, 9]);
ok('91G sem notas', c.notas.length, 0);
c = R.codificar(99e9, 4);
ok('99G nao e E24, cai para 91G', c.ohms, 91e9);

WScript.Echo('--- avisos de arredondamento e de serie ---');
c = R.codificar(4730, 4);
ok('4730 arredonda para 4k7', c.ohms, 4700);
ok('4730 avisa uma vez', c.notas.length, 1);

c = R.codificar(9000, 4);
ok('9k nao existe na E24 -> 9k1', c.ohms, 9100);
ok('9k avisa uma vez', c.notas.length, 1);
WScript.Echo('  nota: ' + c.notas[0].replace(/\u03a9/g, 'ohm'));

c = R.codificar(9030, 4);
ok('9030 avisa duas vezes', c.notas.length, 2);

WScript.Echo('--- valor -> faixas (5 faixas) ---');
c = R.codificar(4700, 5);
ok('4k7 em 5 faixas', c.faixas, [4, 7, 0, 1]);
ok('4k7 em 5 faixas NAO vira 4k75', c.notas.length, 0);
c = R.codificar(1000, 5);
ok('1k em 5 faixas', c.faixas, [1, 0, 0, 1]);

WScript.Echo('--- fora de alcance ---');
c = R.codificar(0.05, 4);
ok('0R05 recusado', c.ok, false);
c = R.codificar(1e12, 4);
ok('1T recusado', c.ok, false);
c = R.codificar(0, 4);
ok('zero recusado', c.ok, false);
c = R.codificar(null, 4);
ok('nulo recusado', c.ok, false);

WScript.Echo('--- faixas -> valor ---');
var d = R.decodificar([1, 0, 2, 10], 4);
ok('marrom preto vermelho ouro', d.ohms, 1000);
ok('tolerancia 5%', d.tolerancia, 5);
ok('sem notas', d.notas.length, 0);

d = R.decodificar([1, 0, 2, null], 4);
ok('faixa vazia = incompleto', d.completo, false);

d = R.decodificar([0, 1, 2, 10], 4);
ok('primeira faixa preta avisa', d.notas.length, 1);
ok('primeira faixa preta e impossivel', d.impossiveis, [0]);
ok('preta ainda calcula o valor', d.ohms, 100);

d = R.decodificar([1, 0, 2, 10], 4);
ok('combinacao valida nao marca nada', d.impossiveis.length, 0);

d = R.decodificar([0, 0, 0, 1, 1], 5);
ok('primeira preta em 5 faixas', d.impossiveis, [0]);

d = R.decodificar([1, 3, 2, 10], 4);
ok('13 esta na E24 -> sem aviso', d.notas.length, 0);
d = R.decodificar([1, 4, 2, 10], 4);
ok('14 nao esta na E24 -> avisa', d.notas.length, 1);

d = R.decodificar([1, 0, 0, 1, 1], 5);
ok('5 faixas = 1k', d.ohms, 1000);
ok('5 faixas tolerancia 1%', d.tolerancia, 1);

d = R.decodificar([1, 0, 0, 1, 1, 1], 6);
ok('6 faixas ppm', d.ppm, 100);
ok('6 faixas ohms', d.ohms, 1000);

WScript.Echo('--- formatacao ---');
ok('1000', R.formatar(1000), '1 k' + OHM);
ok('4700', R.formatar(4700), '4,7 k' + OHM);
ok('4.7', R.formatar(4.7), '4,7 ' + OHM);
ok('1e6', R.formatar(1000000), '1 M' + OHM);
ok('999e9', R.formatar(999e9), '999 G' + OHM);
ok('0.47', R.formatar(0.47), '0,47 ' + OHM);
ok('mult x100', R.formatarMultiplicador(100), '\u00d7100');
ok('mult x1k', R.formatarMultiplicador(1000), '\u00d71 k');
ok('mult x0,1', R.formatarMultiplicador(0.1), '\u00d70,1');

WScript.Echo('');
WScript.Echo(passou + ' passaram, ' + falhou + ' falharam');
if (falhou > 0) { WScript.Quit(1); }
