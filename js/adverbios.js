import { database } from "./firebase.js?v=20260919-6";
import {
    ref,
    onValue,
    get,
    set,
    update,
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
let adverbioEmFoco = null;
let modoFormulario = "novo";
let adverbioOriginal = null;

function normalizar(texto) {
    return String(texto || "")
        .toLocaleLowerCase("pt-BR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function atualizarFiltro(reiniciarPagina = false) {
    const campoBusca = document.getElementById("buscaAdverbios");
    const resultadoBusca = document.getElementById("resultadoBuscaAdverbios");
    const termo = campoBusca.value.trim();
    const termoNormalizado = normalizar(termo);

    if (termo === "") {
        registrosFiltrados = [...registros];
        resultadoBusca.textContent = "";
    } else {
        registrosFiltrados = registros.filter(([adverbio, item]) =>
            normalizar(adverbio).includes(termoNormalizado) ||
            normalizar(item.traducao).includes(termoNormalizado) ||
            normalizar(item.tipo).includes(termoNormalizado)
        );

        resultadoBusca.textContent =
            `${registrosFiltrados.length} resultado${registrosFiltrados.length === 1 ? "" : "s"}`;
    }

    if (reiniciarPagina) paginaAtual = 1;
}

async function excluirAdverbio(adverbio, botao) {
    const confirmado = window.confirm(
        `Excluir "${adverbio}"? Esta ação não pode ser desfeita.`
    );

    if (!confirmado) return;

    botao.disabled = true;
    botao.textContent = "Excluindo...";

    try {
        await remove(ref(database, `adverbios/${adverbio}`));

        if (modoFormulario === "editar" && adverbioOriginal === adverbio) {
            cancelarFormulario();
        }
    } catch (error) {
        console.error("Erro ao excluir advérbio:", error);
        window.alert("Não foi possível excluir o advérbio.");
        botao.disabled = false;
        botao.textContent = "Excluir";
    }
}

function criarLinha(adverbio, item) {
    const linha = document.createElement("tr");

    const nome = document.createElement("td");
    nome.textContent = adverbio;

    const traducao = document.createElement("td");
    traducao.textContent = item.traducao || "";

    const tipo = document.createElement("td");
    tipo.textContent = item.tipo || "";

    const acoes = document.createElement("td");
    acoes.className = "celula-acoes";

    const grupoAcoes = document.createElement("div");
    grupoAcoes.className = "acoes-linha";

    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "botao-editar";
    editar.textContent = "Editar";
    editar.addEventListener("click", () => abrirEdicao(adverbio, item));

    const excluir = document.createElement("button");
    excluir.type = "button";
    excluir.className = "botao-excluir";
    excluir.textContent = "Excluir";
    excluir.addEventListener("click", () => excluirAdverbio(adverbio, excluir));

    grupoAcoes.append(editar, excluir);
    acoes.appendChild(grupoAcoes);
    linha.append(nome, traducao, tipo, acoes);

    return linha;
}

function renderizarPagina() {
    const corpo = document.getElementById("listaAdverbios");
    const paginacao = document.getElementById("paginacaoAdverbios");
    const anterior = document.getElementById("paginaAnteriorAdverbios");
    const proxima = document.getElementById("proximaPaginaAdverbios");
    const indicador = document.getElementById("indicadorPaginaAdverbios");
    const vazio = document.getElementById("listaAdverbiosVazia");
    const campoBusca = document.getElementById("buscaAdverbios");

    const totalPaginas = Math.ceil(
        registrosFiltrados.length / REGISTROS_POR_PAGINA
    );

    if (totalPaginas === 0) {
        corpo.innerHTML = "";
        paginacao.hidden = true;

        vazio.textContent =
            registros.length === 0
                ? "Nenhum advérbio cadastrado."
                : campoBusca.value.trim() !== ""
                    ? "Nenhum advérbio encontrado."
                    : "Nenhum advérbio cadastrado.";

        vazio.hidden = false;
        return;
    }

    vazio.hidden = true;
    paginaAtual = Math.min(paginaAtual, totalPaginas);

    const inicio = (paginaAtual - 1) * REGISTROS_POR_PAGINA;
    const fim = inicio + REGISTROS_POR_PAGINA;

    corpo.innerHTML = "";

    registrosFiltrados.slice(inicio, fim).forEach(([adverbio, item]) => {
        corpo.appendChild(criarLinha(adverbio, item));
    });

    indicador.textContent = `Página ${paginaAtual} de ${totalPaginas}`;
    anterior.disabled = paginaAtual === 1;
    proxima.disabled = paginaAtual === totalPaginas;
    paginacao.hidden = totalPaginas <= 1;
}

function configurarControlesPaginacao() {
    if (controlesConfigurados) return;

    document
        .getElementById("paginaAnteriorAdverbios")
        .addEventListener("click", () => {
            if (paginaAtual > 1) {
                paginaAtual--;
                renderizarPagina();
            }
        });

    document
        .getElementById("proximaPaginaAdverbios")
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
        .getElementById("buscaAdverbios")
        .addEventListener("input", () => {
            atualizarFiltro(true);
            renderizarPagina();
        });

    buscaConfigurada = true;
}

function definirMensagemCadastro(texto, sucesso = false) {
    const mensagem = document.getElementById("mensagemAdverbio");
    mensagem.textContent = texto;
    mensagem.classList.toggle("sucesso", sucesso);
}

function prepararNovoAdverbio() {
    const form = document.getElementById("formAdverbio");

    form.reset();
    modoFormulario = "novo";
    adverbioOriginal = null;

    document.getElementById("tituloFormAdverbio").textContent =
        "Novo advérbio";
    document.getElementById("salvarAdverbio").textContent = "Salvar";

    definirMensagemCadastro("");
    form.hidden = false;
    document.getElementById("nomeAdverbio").focus();
}

function abrirEdicao(adverbio, item) {
    const form = document.getElementById("formAdverbio");

    modoFormulario = "editar";
    adverbioOriginal = adverbio;

    document.getElementById("tituloFormAdverbio").textContent =
        `Editar: ${adverbio}`;
    document.getElementById("nomeAdverbio").value = adverbio;
    document.getElementById("traducaoAdverbio").value =
        item.traducao || "";
    document.getElementById("tipoAdverbio").value =
        item.tipo || "";
    document.getElementById("observacaoAdverbio").value =
        item.observacao || "";

    definirMensagemCadastro("");
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelarFormulario() {
    const form = document.getElementById("formAdverbio");

    form.reset();
    form.hidden = true;
    modoFormulario = "novo";
    adverbioOriginal = null;

    document.getElementById("tituloFormAdverbio").textContent =
        "Novo advérbio";
    document.getElementById("salvarAdverbio").textContent = "Salvar";

    definirMensagemCadastro("");
}

function montarDadosFormulario() {
    const adverbio = document
        .getElementById("nomeAdverbio")
        .value
        .trim()
        .toLocaleLowerCase("de-DE");

    const dados = {
        traducao:
            document.getElementById("traducaoAdverbio").value.trim(),
        tipo:
            document.getElementById("tipoAdverbio").value.trim().toLocaleLowerCase("pt-BR"),
        observacao:
            document.getElementById("observacaoAdverbio").value.trim()
    };

    return { adverbio, dados };
}

async function salvarNovo(adverbio, dados) {
    const caminho = ref(database, `adverbios/${adverbio}`);
    const existente = await get(caminho);

    if (existente.exists()) {
        throw new Error("ADVERBIO_EXISTENTE");
    }

    await set(caminho, dados);
}

async function salvarEdicao(adverbio, dados) {
    if (!adverbioOriginal) {
        throw new Error("ADVERBIO_ORIGINAL_AUSENTE");
    }

    if (adverbio === adverbioOriginal) {
        await set(ref(database, `adverbios/${adverbio}`), dados);
        return;
    }

    const novoCaminho = ref(database, `adverbios/${adverbio}`);
    const existente = await get(novoCaminho);

    if (existente.exists()) {
        throw new Error("ADVERBIO_EXISTENTE");
    }

    const alteracoes = {};
    alteracoes[`adverbios/${adverbio}`] = dados;
    alteracoes[`adverbios/${adverbioOriginal}`] = null;

    await update(ref(database), alteracoes);
}

function configurarCadastro() {
    if (cadastroConfigurado) return;

    const botaoNovo = document.getElementById("novoAdverbio");
    const botaoCancelar = document.getElementById("cancelarNovoAdverbio");
    const form = document.getElementById("formAdverbio");
    const botaoSalvar = document.getElementById("salvarAdverbio");

    botaoNovo.addEventListener("click", prepararNovoAdverbio);
    botaoCancelar.addEventListener("click", cancelarFormulario);

    form.addEventListener("submit", async event => {
        event.preventDefault();
        definirMensagemCadastro("");

        const { adverbio, dados } = montarDadosFormulario();

        if (!adverbio) {
            definirMensagemCadastro("Informe o advérbio.");
            return;
        }

        if (/[.#$\/\[\]]/.test(adverbio)) {
            definirMensagemCadastro(
                "O advérbio contém um caractere que não pode ser usado no banco."
            );
            return;
        }

        botaoSalvar.disabled = true;
        botaoSalvar.textContent = "Salvando...";

        try {
            const estavaEditando = modoFormulario === "editar";

            if (estavaEditando) {
                await salvarEdicao(adverbio, dados);
            } else {
                await salvarNovo(adverbio, dados);
            }

            adverbioEmFoco = adverbio;
            form.reset();
            modoFormulario = "novo";
            adverbioOriginal = null;

            document.getElementById("tituloFormAdverbio").textContent =
                "Novo advérbio";

            definirMensagemCadastro(
                estavaEditando
                    ? `${adverbio} atualizado com sucesso.`
                    : `${adverbio} cadastrado com sucesso.`,
                true
            );
        } catch (error) {
            console.error("Erro ao salvar advérbio:", error);

            if (error.message === "ADVERBIO_EXISTENTE") {
                definirMensagemCadastro(
                    "Já existe um advérbio com esse nome."
                );
            } else {
                adverbioEmFoco = null;
                definirMensagemCadastro(
                    modoFormulario === "editar"
                        ? "Não foi possível atualizar o advérbio."
                        : "Não foi possível cadastrar o advérbio."
                );
            }
        } finally {
            botaoSalvar.disabled = false;
            botaoSalvar.textContent = "Salvar";
        }
    });

    cadastroConfigurado = true;
}

export function iniciarListaAdverbios() {
    const corpo = document.getElementById("listaAdverbios");
    const carregando = document.getElementById("carregandoAdverbios");
    const vazio = document.getElementById("listaAdverbiosVazia");
    const erro = document.getElementById("erroAdverbios");
    const total = document.getElementById("totalAdverbios");
    const paginacao = document.getElementById("paginacaoAdverbios");

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
        ref(database, "adverbios"),
        snapshot => {
            carregando.hidden = true;

            if (!snapshot.exists()) {
                registros = [];
                registrosFiltrados = [];
                atualizarFiltro(false);
                renderizarPagina();
                total.textContent = "0 advérbios";
                return;
            }

            registros = Object.entries(snapshot.val())
                .sort(([a], [b]) =>
                    a.localeCompare(b, "de", { sensitivity: "base" })
                );

            atualizarFiltro(false);

            if (adverbioEmFoco) {
                const indice = registrosFiltrados.findIndex(
                    ([adverbio]) => adverbio === adverbioEmFoco
                );

                if (indice >= 0) {
                    paginaAtual =
                        Math.floor(indice / REGISTROS_POR_PAGINA) + 1;
                }

                adverbioEmFoco = null;
            }

            total.textContent =
                `${registros.length} advérbio${registros.length === 1 ? "" : "s"}`;

            vazio.hidden = true;
            erro.hidden = true;
            renderizarPagina();
        },
        error => {
            console.error("Erro ao carregar advérbios:", error);

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

export function pararListaAdverbios() {
    if (cancelarEscuta) {
        cancelarEscuta();
        cancelarEscuta = null;
    }

    registros = [];
    registrosFiltrados = [];
    paginaAtual = 1;
    adverbioEmFoco = null;
    modoFormulario = "novo";
    adverbioOriginal = null;

    const campoBusca = document.getElementById("buscaAdverbios");
    const resultadoBusca = document.getElementById("resultadoBuscaAdverbios");

    if (campoBusca) campoBusca.value = "";
    if (resultadoBusca) resultadoBusca.textContent = "";

    const form = document.getElementById("formAdverbio");

    if (form) {
        form.reset();
        form.hidden = true;
        document.getElementById("tituloFormAdverbio").textContent =
            "Novo advérbio";
        definirMensagemCadastro("");
    }
}
