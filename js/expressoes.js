import { database } from "./firebase.js?v=20260919-6";
import {
    ref,
    onValue,
    get,
    set,
    remove
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

const REGISTROS_POR_PAGINA = 20;

let cancelarEscuta = null;
let registros = [];
let registrosFiltrados = [];
let paginaAtual = 1;
let controlesConfigurados = false;
let cadastroConfigurado = false;
let buscaConfigurada = false;
let expressaoEmFoco = null;
let modoFormulario = "novo";
let expressaoIdOriginal = null;

function normalizar(texto) {
    return String(texto || "")
        .toLocaleLowerCase("pt-BR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ß/g, "ss")
        .trim();
}

function gerarIdBase(expressao) {
    const id = String(expressao || "")
        .toLocaleLowerCase("de-DE")
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    return id || "expressao";
}

function encontrarDuplicada(expressao, ignorarId = null) {
    const alvo = normalizar(expressao);

    return registros.find(([id, item]) =>
        id !== ignorarId &&
        normalizar(item.expressao || id) === alvo
    );
}

async function gerarIdDisponivel(expressao) {
    const base = gerarIdBase(expressao);
    let candidato = base;
    let numero = 2;

    while ((await get(ref(database, `expressoes/${candidato}`))).exists()) {
        candidato = `${base}_${numero}`;
        numero++;
    }

    return candidato;
}

function atualizarFiltro(reiniciarPagina = false) {
    const campoBusca = document.getElementById("buscaExpressoes");
    const resultadoBusca = document.getElementById("resultadoBuscaExpressoes");
    const termo = campoBusca.value.trim();
    const termoNormalizado = normalizar(termo);

    if (termo === "") {
        registrosFiltrados = [...registros];
        resultadoBusca.textContent = "";
    } else {
        registrosFiltrados = registros.filter(([id, item]) => {
            const texto = [
                item.expressao || id,
                item.traducao,
                item.tipo,
                item.explicacao,
                item.exemplo,
                item.traducaoExemplo
            ].join(" ");

            return normalizar(texto).includes(termoNormalizado);
        });

        resultadoBusca.textContent =
            `${registrosFiltrados.length} resultado${registrosFiltrados.length === 1 ? "" : "s"}`;
    }

    if (reiniciarPagina) paginaAtual = 1;
}

async function excluirExpressao(id, nome, botao) {
    const confirmado = window.confirm(
        `Excluir "${nome}"? Esta ação não pode ser desfeita.`
    );

    if (!confirmado) return;

    botao.disabled = true;
    botao.textContent = "Excluindo...";

    try {
        await remove(ref(database, `expressoes/${id}`));

        if (modoFormulario === "editar" && expressaoIdOriginal === id) {
            cancelarFormulario();
        }
    } catch (error) {
        console.error("Erro ao excluir expressão:", error);
        window.alert("Não foi possível excluir a expressão.");
        botao.disabled = false;
        botao.textContent = "Excluir";
    }
}

function criarLinha(id, item) {
    const fragmento = document.createDocumentFragment();
    const linha = document.createElement("tr");
    const nomeExpressao = item.expressao || id;

    const expressao = document.createElement("td");
    expressao.textContent = nomeExpressao;

    const traducao = document.createElement("td");
    traducao.textContent = item.traducao || "";

    const tipo = document.createElement("td");
    tipo.textContent = item.tipo || "";

    const detalhes = document.createElement("td");
    detalhes.className = "celula-detalhes";

    const temDetalhes = [
        item.explicacao,
        item.exemplo,
        item.traducaoExemplo
    ].some(valor => String(valor || "").trim());

    let linhaDetalhes = null;

    if (temDetalhes) {
        const botaoDetalhes = document.createElement("button");
        botaoDetalhes.type = "button";
        botaoDetalhes.className = "botao-observacao";
        botaoDetalhes.textContent = "Ver";
        botaoDetalhes.setAttribute("aria-expanded", "false");

        linhaDetalhes = document.createElement("tr");
        linhaDetalhes.className = "linha-observacao";
        linhaDetalhes.hidden = true;

        const detalhe = document.createElement("td");
        detalhe.colSpan = 5;

        const conteudo = document.createElement("div");
        conteudo.className = "observacao-conteudo";

        if (item.explicacao) {
            const rotulo = document.createElement("strong");
            rotulo.textContent = "Explicação:";

            const texto = document.createElement("p");
            texto.textContent = item.explicacao;

            conteudo.append(rotulo, texto);
        }

        if (item.exemplo) {
            const rotulo = document.createElement("strong");
            rotulo.className = "detalhe-secundario";
            rotulo.textContent = "Exemplo:";

            const texto = document.createElement("p");
            texto.textContent = item.exemplo;

            conteudo.append(rotulo, texto);
        }

        if (item.traducaoExemplo) {
            const rotulo = document.createElement("strong");
            rotulo.className = "detalhe-secundario";
            rotulo.textContent = "Tradução do exemplo:";

            const texto = document.createElement("p");
            texto.textContent = item.traducaoExemplo;

            conteudo.append(rotulo, texto);
        }

        detalhe.appendChild(conteudo);
        linhaDetalhes.appendChild(detalhe);

        botaoDetalhes.addEventListener("click", () => {
            const abrir = linhaDetalhes.hidden;
            linhaDetalhes.hidden = !abrir;
            botaoDetalhes.textContent = abrir ? "Ocultar" : "Ver";
            botaoDetalhes.setAttribute("aria-expanded", String(abrir));
        });

        detalhes.appendChild(botaoDetalhes);
    } else {
        detalhes.textContent = "—";
        detalhes.classList.add("sem-detalhes");
    }

    const acoes = document.createElement("td");
    acoes.className = "celula-acoes";

    const grupoAcoes = document.createElement("div");
    grupoAcoes.className = "acoes-linha";

    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "botao-editar";
    editar.textContent = "Editar";
    editar.addEventListener("click", () => abrirEdicao(id, item));

    const excluir = document.createElement("button");
    excluir.type = "button";
    excluir.className = "botao-excluir";
    excluir.textContent = "Excluir";
    excluir.addEventListener(
        "click",
        () => excluirExpressao(id, nomeExpressao, excluir)
    );

    grupoAcoes.append(editar, excluir);
    acoes.appendChild(grupoAcoes);
    linha.append(expressao, traducao, tipo, detalhes, acoes);

    fragmento.appendChild(linha);
    if (linhaDetalhes) fragmento.appendChild(linhaDetalhes);

    return fragmento;
}

function renderizarPagina() {
    const corpo = document.getElementById("listaExpressoes");
    const paginacao = document.getElementById("paginacaoExpressoes");
    const anterior = document.getElementById("paginaAnteriorExpressoes");
    const proxima = document.getElementById("proximaPaginaExpressoes");
    const indicador = document.getElementById("indicadorPaginaExpressoes");
    const vazio = document.getElementById("listaExpressoesVazia");
    const campoBusca = document.getElementById("buscaExpressoes");

    const totalPaginas = Math.ceil(
        registrosFiltrados.length / REGISTROS_POR_PAGINA
    );

    if (totalPaginas === 0) {
        corpo.innerHTML = "";
        paginacao.hidden = true;

        vazio.textContent =
            registros.length === 0
                ? "Nenhuma expressão cadastrada."
                : campoBusca.value.trim() !== ""
                    ? "Nenhuma expressão encontrada."
                    : "Nenhuma expressão cadastrada.";

        vazio.hidden = false;
        return;
    }

    vazio.hidden = true;
    paginaAtual = Math.min(paginaAtual, totalPaginas);

    const inicio = (paginaAtual - 1) * REGISTROS_POR_PAGINA;
    const fim = inicio + REGISTROS_POR_PAGINA;

    corpo.innerHTML = "";

    registrosFiltrados.slice(inicio, fim).forEach(([id, item]) => {
        corpo.appendChild(criarLinha(id, item));
    });

    indicador.textContent = `Página ${paginaAtual} de ${totalPaginas}`;
    anterior.disabled = paginaAtual === 1;
    proxima.disabled = paginaAtual === totalPaginas;
    paginacao.hidden = totalPaginas <= 1;
}

function configurarControlesPaginacao() {
    if (controlesConfigurados) return;

    document
        .getElementById("paginaAnteriorExpressoes")
        .addEventListener("click", () => {
            if (paginaAtual > 1) {
                paginaAtual--;
                renderizarPagina();
            }
        });

    document
        .getElementById("proximaPaginaExpressoes")
        .addEventListener("click", () => {
            const totalPaginas = Math.ceil(
                registrosFiltrados.length / REGISTROS_POR_PAGINA
            );

            if (paginaAtual < totalPaginas) {
                paginaAtual++;
                renderizarPagina();
            }
        });

    controlesConfigurados = true;
}

function configurarBusca() {
    if (buscaConfigurada) return;

    document
        .getElementById("buscaExpressoes")
        .addEventListener("input", () => {
            atualizarFiltro(true);
            renderizarPagina();
        });

    buscaConfigurada = true;
}

function definirMensagemCadastro(texto, sucesso = false) {
    const mensagem = document.getElementById("mensagemExpressao");
    mensagem.textContent = texto;
    mensagem.classList.toggle("sucesso", sucesso);
}

function prepararNovaExpressao() {
    const form = document.getElementById("formExpressao");

    form.reset();
    modoFormulario = "novo";
    expressaoIdOriginal = null;

    document.getElementById("tituloFormExpressao").textContent =
        "Nova expressão";
    document.getElementById("salvarExpressao").textContent = "Salvar";

    definirMensagemCadastro("");
    form.hidden = false;
    document.getElementById("textoExpressao").focus();
}

function abrirEdicao(id, item) {
    const form = document.getElementById("formExpressao");

    modoFormulario = "editar";
    expressaoIdOriginal = id;

    document.getElementById("tituloFormExpressao").textContent =
        `Editar: ${item.expressao || id}`;
    document.getElementById("textoExpressao").value =
        item.expressao || id;
    document.getElementById("traducaoExpressao").value =
        item.traducao || "";
    document.getElementById("tipoExpressao").value =
        item.tipo || "";
    document.getElementById("explicacaoExpressao").value =
        item.explicacao || "";
    document.getElementById("exemploExpressao").value =
        item.exemplo || "";
    document.getElementById("traducaoExemploExpressao").value =
        item.traducaoExemplo || "";

    definirMensagemCadastro("");
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelarFormulario() {
    const form = document.getElementById("formExpressao");

    form.reset();
    form.hidden = true;
    modoFormulario = "novo";
    expressaoIdOriginal = null;

    document.getElementById("tituloFormExpressao").textContent =
        "Nova expressão";
    document.getElementById("salvarExpressao").textContent = "Salvar";

    definirMensagemCadastro("");
}

function montarDadosFormulario() {
    return {
        expressao:
            document.getElementById("textoExpressao").value.trim(),
        traducao:
            document.getElementById("traducaoExpressao").value.trim(),
        tipo:
            document.getElementById("tipoExpressao")
                .value
                .trim()
                .toLocaleLowerCase("pt-BR"),
        explicacao:
            document.getElementById("explicacaoExpressao").value.trim(),
        exemplo:
            document.getElementById("exemploExpressao").value.trim(),
        traducaoExemplo:
            document.getElementById("traducaoExemploExpressao").value.trim()
    };
}

async function salvarNovo(dados) {
    if (encontrarDuplicada(dados.expressao)) {
        throw new Error("EXPRESSAO_EXISTENTE");
    }

    const id = await gerarIdDisponivel(dados.expressao);
    await set(ref(database, `expressoes/${id}`), dados);
    return id;
}

async function salvarEdicao(dados) {
    if (!expressaoIdOriginal) {
        throw new Error("EXPRESSAO_ORIGINAL_AUSENTE");
    }

    if (encontrarDuplicada(dados.expressao, expressaoIdOriginal)) {
        throw new Error("EXPRESSAO_EXISTENTE");
    }

    await set(
        ref(database, `expressoes/${expressaoIdOriginal}`),
        dados
    );

    return expressaoIdOriginal;
}

function configurarCadastro() {
    if (cadastroConfigurado) return;

    const botaoNovo = document.getElementById("novaExpressao");
    const botaoCancelar = document.getElementById("cancelarNovaExpressao");
    const form = document.getElementById("formExpressao");
    const botaoSalvar = document.getElementById("salvarExpressao");

    botaoNovo.addEventListener("click", prepararNovaExpressao);
    botaoCancelar.addEventListener("click", cancelarFormulario);

    form.addEventListener("submit", async event => {
        event.preventDefault();
        definirMensagemCadastro("");

        const dados = montarDadosFormulario();

        if (!dados.expressao) {
            definirMensagemCadastro("Informe a expressão.");
            return;
        }

        if (!dados.traducao) {
            definirMensagemCadastro("Informe a tradução.");
            return;
        }

        if (!dados.tipo) {
            definirMensagemCadastro("Informe o tipo.");
            return;
        }

        if (!dados.explicacao) {
            definirMensagemCadastro("Informe a explicação.");
            return;
        }

        botaoSalvar.disabled = true;
        botaoSalvar.textContent = "Salvando...";

        try {
            const estavaEditando = modoFormulario === "editar";
            const id = estavaEditando
                ? await salvarEdicao(dados)
                : await salvarNovo(dados);

            expressaoEmFoco = id;
            form.reset();
            modoFormulario = "novo";
            expressaoIdOriginal = null;

            document.getElementById("tituloFormExpressao").textContent =
                "Nova expressão";

            definirMensagemCadastro(
                estavaEditando
                    ? `${dados.expressao} atualizada com sucesso.`
                    : `${dados.expressao} cadastrada com sucesso.`,
                true
            );
        } catch (error) {
            console.error("Erro ao salvar expressão:", error);

            if (error.message === "EXPRESSAO_EXISTENTE") {
                definirMensagemCadastro(
                    "Já existe uma expressão com esse texto."
                );
            } else {
                expressaoEmFoco = null;
                definirMensagemCadastro(
                    modoFormulario === "editar"
                        ? "Não foi possível atualizar a expressão."
                        : "Não foi possível cadastrar a expressão."
                );
            }
        } finally {
            botaoSalvar.disabled = false;
            botaoSalvar.textContent = "Salvar";
        }
    });

    cadastroConfigurado = true;
}

export function iniciarListaExpressoes() {
    const corpo = document.getElementById("listaExpressoes");
    const carregando = document.getElementById("carregandoExpressoes");
    const vazio = document.getElementById("listaExpressoesVazia");
    const erro = document.getElementById("erroExpressoes");
    const total = document.getElementById("totalExpressoes");
    const paginacao = document.getElementById("paginacaoExpressoes");

    configurarControlesPaginacao();
    configurarCadastro();
    configurarBusca();

    if (cancelarEscuta) {
        cancelarEscuta();
        cancelarEscuta = null;
    }

    registros = [];
    registrosFiltrados = [];
    paginaAtual = 1;
    corpo.innerHTML = "";
    carregando.hidden = false;
    vazio.hidden = true;
    erro.hidden = true;
    paginacao.hidden = true;
    total.textContent = "";

    cancelarEscuta = onValue(
        ref(database, "expressoes"),
        snapshot => {
            carregando.hidden = true;

            if (!snapshot.exists()) {
                registros = [];
                registrosFiltrados = [];
                atualizarFiltro(false);
                renderizarPagina();
                total.textContent = "0 expressões";
                return;
            }

            registros = Object.entries(snapshot.val())
                .sort(([, a], [, b]) =>
                    String(a.expressao || "").localeCompare(
                        String(b.expressao || ""),
                        "de",
                        { sensitivity: "base" }
                    )
                );

            atualizarFiltro(false);

            if (expressaoEmFoco) {
                const indice = registrosFiltrados.findIndex(
                    ([id]) => id === expressaoEmFoco
                );

                if (indice >= 0) {
                    paginaAtual =
                        Math.floor(indice / REGISTROS_POR_PAGINA) + 1;
                }

                expressaoEmFoco = null;
            }

            total.textContent =
                `${registros.length} express${registros.length === 1 ? "ão" : "ões"}`;

            vazio.hidden = true;
            erro.hidden = true;
            renderizarPagina();
        },
        error => {
            console.error("Erro ao carregar expressões:", error);

            registros = [];
            registrosFiltrados = [];
            corpo.innerHTML = "";
            carregando.hidden = true;
            vazio.hidden = true;
            erro.hidden = false;
            paginacao.hidden = true;
            total.textContent = "";
        }
    );
}

export function pararListaExpressoes() {
    if (cancelarEscuta) {
        cancelarEscuta();
        cancelarEscuta = null;
    }

    registros = [];
    registrosFiltrados = [];
    paginaAtual = 1;
    expressaoEmFoco = null;
    modoFormulario = "novo";
    expressaoIdOriginal = null;

    const campoBusca = document.getElementById("buscaExpressoes");
    const resultadoBusca = document.getElementById("resultadoBuscaExpressoes");

    if (campoBusca) campoBusca.value = "";
    if (resultadoBusca) resultadoBusca.textContent = "";

    const form = document.getElementById("formExpressao");

    if (form) {
        form.reset();
        form.hidden = true;
        document.getElementById("tituloFormExpressao").textContent =
            "Nova expressão";
        definirMensagemCadastro("");
    }
}
