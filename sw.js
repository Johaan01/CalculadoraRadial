/*
 * sw.js — service worker. É o que torna o app instalável e utilizável sem
 * internet.
 *
 * IMPORTANTE AO PUBLICAR: suba o número da VERSAO a cada mudança em qualquer
 * arquivo listado em ARQUIVOS. É esse número que faz o navegador baixar a
 * versão nova; sem trocá-lo, quem já abriu o app continua vendo a antiga
 * indefinidamente.
 *
 * Todos os caminhos são relativos de propósito. No GitHub Pages um site de
 * projeto vive em usuario.github.io/nome-do-repo/, e um caminho absoluto como
 * "/sw.js" apontaria para a raiz do domínio, fora do escopo.
 */

var VERSAO = 'v6';
var CACHE = 'calculadora-resistores-' + VERSAO;

var ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/estilo.css',
  './assets/js/cores.js',
  './assets/js/resistor.js',
  './assets/js/mostrador.js',
  './assets/js/faixas.js',
  './assets/js/tiras.js',
  './assets/js/app.js',
  './assets/icons/icone-32.png',
  './assets/icons/icone-192.png',
  './assets/icons/icone-512.png',
  './assets/icons/icone-maskable-512.png'
];

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(ARQUIVOS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(nomes.map(function (nome) {
        if (nome !== CACHE) { return caches.delete(nome); }
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (evento) {
  var requisicao = evento.request;

  if (requisicao.method !== 'GET') { return; }
  if (new URL(requisicao.url).origin !== self.location.origin) { return; }

  /*
   * Uma navegação para "?f=4&c=1-0-2-10" é um endereço que nunca esteve no
   * cache. Como a página é a mesma em qualquer consulta, o index responde.
   */
  if (requisicao.mode === 'navigate') {
    evento.respondWith(
      caches.match('./index.html').then(function (guardado) {
        return guardado || fetch(requisicao);
      })
    );
    return;
  }

  evento.respondWith(
    caches.match(requisicao).then(function (guardado) {
      return guardado || fetch(requisicao).then(function (resposta) {
        if (resposta && resposta.ok && resposta.type === 'basic') {
          var copia = resposta.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(requisicao, copia);
          });
        }
        return resposta;
      });
    })
  );
});
