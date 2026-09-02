# -*- coding: utf-8 -*-
"""
Confere o que quebra a publicacao sem dar erro visivel no navegador.

O caso que motiva este script: `sw.js` faz `cache.addAll(ARQUIVOS)` na
instalacao. Se UM item dessa lista responder 404, a promessa inteira falha, o
service worker nunca instala e o app deixa de ser instalavel e de funcionar
offline — sem nenhuma mensagem na tela. Renomear um arquivo e esquecer da lista
e o suficiente para isso acontecer.

Roda sem dependencias, em qualquer sistema:

    python ferramentas/conferir-publicacao.py
"""
import io
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

falhas = []
verificados = 0


def erro(msg):
    falhas.append(msg)


def ler(caminho):
    with io.open(os.path.join(RAIZ, caminho), encoding="utf-8") as f:
        return f.read()


def existe(rel, origem):
    """Confere um caminho relativo declarado por algum arquivo do projeto."""
    global verificados
    verificados += 1
    limpo = rel.split("?")[0].split("#")[0]
    if limpo in ("", "./"):
        limpo = "index.html"
    if limpo.startswith("./"):
        limpo = limpo[2:]
    if not os.path.isfile(os.path.join(RAIZ, limpo)):
        erro("%s aponta para %s, que nao existe" % (origem, rel))
        return False
    return True


def conferir_service_worker():
    fonte = ler("sw.js")
    bloco = re.search(r"var ARQUIVOS = \[(.*?)\];", fonte, re.S)
    if not bloco:
        return erro("sw.js: nao achei a lista ARQUIVOS")

    itens = re.findall(r"'([^']+)'", bloco.group(1))
    if not itens:
        return erro("sw.js: a lista ARQUIVOS esta vazia")
    for item in itens:
        if not item.startswith("./"):
            erro("sw.js: '%s' nao e relativo; em site de projeto do GitHub "
                 "Pages um caminho absoluto sai do escopo" % item)
        existe(item, "sw.js")

    if not re.search(r"var VERSAO = '[^']+'", fonte):
        erro("sw.js: nao achei a constante VERSAO")


def conferir_manifest():
    try:
        dados = json.loads(ler("manifest.webmanifest"))
    except ValueError as e:
        return erro("manifest.webmanifest nao e JSON valido: %s" % e)

    for campo in ("name", "short_name", "start_url", "scope", "display", "icons"):
        if campo not in dados:
            erro("manifest.webmanifest: falta o campo obrigatorio '%s'" % campo)

    for campo in ("start_url", "scope"):
        valor = dados.get(campo, "")
        if valor.startswith("/"):
            erro("manifest.webmanifest: '%s' e absoluto ('%s'); precisa ser "
                 "relativo para funcionar em usuario.github.io/repo/"
                 % (campo, valor))

    tamanhos = set()
    for icone in dados.get("icons", []):
        existe(icone.get("src", ""), "manifest.webmanifest")
        tamanhos.add(icone.get("sizes"))
    # O Chrome so oferece instalacao com um icone de 192 e um de 512.
    for exigido in ("192x192", "512x512"):
        if exigido not in tamanhos:
            erro("manifest.webmanifest: falta icone %s, exigido para a "
                 "instalacao" % exigido)


def conferir_html():
    fonte = ler("index.html")
    for rel in re.findall(r'(?:src|href)="([^"]+)"', fonte):
        if re.match(r"^(https?:|data:|mailto:|#)", rel):
            continue
        existe(rel, "index.html")

    # Todo id procurado pelo JS precisa existir no HTML.
    ids = set(re.findall(r'id="([^"]+)"', fonte))
    for js in ("assets/js/app.js", "assets/js/tiras.js"):
        for procurado in re.findall(r"getElementById\('([^']+)'\)", ler(js)):
            if procurado not in ids:
                erro("%s procura #%s, que nao existe no index.html"
                     % (js, procurado))


def conferir_pages():
    if not os.path.isfile(os.path.join(RAIZ, ".nojekyll")):
        erro("falta o arquivo .nojekyll na raiz")


def main():
    conferir_service_worker()
    conferir_manifest()
    conferir_html()
    conferir_pages()

    if falhas:
        print("FALHOU: %d problema(s)\n" % len(falhas))
        for f in falhas:
            print("  - %s" % f)
        return 1

    print("ok: %d referencias conferidas, nada quebrado" % verificados)
    return 0


if __name__ == "__main__":
    sys.exit(main())
