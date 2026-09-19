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
let adjetivoEmFoco = null;
let modoFormulario = "novo";
let adjetivoOriginal = null;

function normalizar(texto) {
    return (texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function atualizarFiltro(reiniciarPagina = false) {
    const campoBusca = document.getElementById("buscaAdjetivos");
    const resultadoBusca = document.getElementById("resultadoBuscaAdjetivos");
    const termo = campoBusca.value.trim();
    const termoNormalizado = normalizar(termo);

    if (termo === "") {
        registrosFiltrados = [...registros];
        resultadoBusca.textContent = "";
    } else {
        registrosFiltrados = registros.filter(([adjetivo, item]) => {
            const adjetivoOk =
                normalizar(adjetivo).includes(termoNormalizado);
            const traducaoOk =
                normalizar(item.traducao).includes(termoNormalizado);

            return adjetivoOk || traducaoOk;
        });

        resultadoBusca.textContent =
            `${registrosFiltrados.length} resultado${registrosFiltrados.length === 1 ? "" : "s"}`;
    }

    if (reiniciarPagina) {
        paginaAtual = 1;
    }
}

async function excluirAdjetivo(adjetivo, botao) {
    const confirmado = window.confirm(
        `Excluir "${adjetivo}"? Esta ação não pode ser desfeita.`
    );

    if (!confirmado) return;

    botao.disabled = true;
    botao.textContent = "Excluindo...";

    try {
        await remove(ref(database, `adjetivos/${adjetivo}`));

        if (modoFormulario === "editar" && adjetivoOriginal === adjetivo) {
            cancelarFormulario();
        }
    } catch (error) {
        console.error("Erro ao excluir adjetivo:", error);
        window.alert("Não foi possível excluir o adjetivo.");
        botao.disabled = false;
        botao.textContent = "Excluir";
    }
}

function criarLinha(adjetivo, item) {
    const linha = document.createElement("tr");

    const nome = document.createElement("td");
    nome.textContent = adjetivo;

    const traducao = document.createElement("td");
    traducao.textContent = item.traducao || "";

    const comparativo = document.createElement("td");
    comparativo.textContent = item.comparativo || "";

    const superlativo = document.createElement("td");
    superlativo.textContent = item.superlativo || "";

    const acoes = document.createElement("td");
    acoes.className = "celula-acoes";

    const grupoAcoes = document.createElement("div");
    grupoAcoes.className = "acoes-linha";

    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "botao-editar";
    editar.textContent = "Editar";
    editar.addEventListener("click", () => abrirEdicao(adjetivo, item));

    const excluir = document.createElement("button");
    excluir.type = "button";
    excluir.className = "botao-excluir";
    excluir.textContent = "Excluir";
    excluir.addEventListener("click", () => excluirAdjetivo(adjetivo, excluir));

    grupoAcoes.append(editar, excluir);
    acoes.appendChild(grupoAcoes);
    linha.append(nome, traducao, comparativo, superlativo, acoes);

    return linha;
}

function renderizarPagina() {
    const corpo = document.getElementById("listaAdjetivos");
    const paginacao = document.getElementById("paginacaoAdjetivos");
    const anterior = document.getElementById("paginaAnteriorAdjetivos");
    const proxima = document.getElementById("proximaPaginaAdjetivos");
    const indicador = document.getElementById("indicadorPaginaAdjetivos");
    const vazio = document.getElementById("listaAdjetivosVazia");
    const campoBusca = document.getElementById("buscaAdjetivos");

    const totalPaginas = Math.ceil(
        registrosFiltrados.length / REGISTROS_POR_PAGINA
    );

    if (totalPaginas === 0) {
        corpo.innerHTML = "";
        paginacao.hidden = true;

        if (registros.length === 0) {
            vazio.textContent = "Nenhum adjetivo cadastrado.";
        } else if (campoBusca.value.trim() !== "") {
            vazio.textContent = "Nenhum adjetivo encontrado.";
        }

        vazio.hidden = false;
        return;
    }

    vazio.hidden = true;
    paginaAtual = Math.min(paginaAtual, totalPaginas);

    const inicio = (paginaAtual - 1) * REGISTROS_POR_PAGINA;
    const fim = inicio + REGISTROS_POR_PAGINA;

    corpo.innerHTML = "";

    registrosFiltrados.slice(inicio, fim).forEach(([adjetivo, item]) => {
        corpo.appendChild(criarLinha(adjetivo, item));
    });

    indicador.textContent = `Página ${paginaAtual} de ${totalPaginas}`;
    anterior.disabled = paginaAtual === 1;
    proxima.disabled = paginaAtual === totalPaginas;
    paginacao.hidden = totalPaginas <= 1;
}

function configurarControlesPaginacao() {
    if (controlesConfigurados) return;

    document
        .getElementById("paginaAnteriorAdjetivos")
        .addEventListener("click", () => {
            if (paginaAtual > 1) {
                paginaAtual--;
                renderizarPagina();
            }
        });

    document
        .getElementById("proximaPaginaAdjetivos")
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
        .getElementById("buscaAdjetivos")
        .addEventListener("input", () => {
            atualizarFiltro(true);
            renderizarPagina();
        });

    buscaConfigurada = true;
}

function definirMensagemCadastro(texto, sucesso = false) {
    const mensagem = document.getElementById("mensagemAdjetivo");
    mensagem.textContent = texto;
    mensagem.classList.toggle("sucesso", sucesso);
}

function prepararNovoAdjetivo() {
    const form = document.getElementById("formAdjetivo");

    form.reset();
    modoFormulario = "novo";
    adjetivoOriginal = null;

    document.getElementById("tituloFormAdjetivo").textContent =
        "Novo adjetivo";
    document.getElementById("salvarAdjetivo").textContent = "Salvar";

    definirMensagemCadastro("");
    form.hidden = false;
    document.getElementById("nomeAdjetivo").focus();
}

function abrirEdicao(adjetivo, item) {
    const form = document.getElementById("formAdjetivo");

    modoFormulario = "editar";
    adjetivoOriginal = adjetivo;

    document.getElementById("tituloFormAdjetivo").textContent =
        `Editar: ${adjetivo}`;
    document.getElementById("nomeAdjetivo").value = adjetivo;
    document.getElementById("traducaoAdjetivo").value =
        item.traducao || "";
    document.getElementById("comparativoAdjetivo").value =
        item.comparativo || "";
    document.getElementById("superlativoAdjetivo").value =
        item.superlativo || "";

    definirMensagemCadastro("");
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelarFormulario() {
    const form = document.getElementById("formAdjetivo");

    form.reset();
    form.hidden = true;
    modoFormulario = "novo";
    adjetivoOriginal = null;

    document.getElementById("tituloFormAdjetivo").textContent =
        "Novo adjetivo";
    document.getElementById("salvarAdjetivo").textContent = "Salvar";

    definirMensagemCadastro("");
}

function montarDadosFormulario() {
    const adjetivo = document
        .getElementById("nomeAdjetivo")
        .value
        .trim()
        .toLocaleLowerCase("de-DE");

    const dados = {
        traducao:
            document.getElementById("traducaoAdjetivo").value.trim(),
        comparativo:
            document.getElementById("comparativoAdjetivo").value.trim(),
        superlativo:
            document.getElementById("superlativoAdjetivo").value.trim()
    };

    return { adjetivo, dados };
}

async function salvarNovo(adjetivo, dados) {
    const caminho = ref(database, `adjetivos/${adjetivo}`);
    const existente = await get(caminho);

    if (existente.exists()) {
        throw new Error("ADJETIVO_EXISTENTE");
    }

    await set(caminho, dados);
}

async function salvarEdicao(adjetivo, dados) {
    if (!adjetivoOriginal) {
        throw new Error("ADJETIVO_ORIGINAL_AUSENTE");
    }

    if (adjetivo === adjetivoOriginal) {
        await set(ref(database, `adjetivos/${adjetivo}`), dados);
        return;
    }

    const novoCaminho = ref(database, `adjetivos/${adjetivo}`);
    const existente = await get(novoCaminho);

    if (existente.exists()) {
        throw new Error("ADJETIVO_EXISTENTE");
    }

    const alteracoes = {};
    alteracoes[`adjetivos/${adjetivo}`] = dados;
    alteracoes[`adjetivos/${adjetivoOriginal}`] = null;

    await update(ref(database), alteracoes);
}

function configurarCadastro() {
    if (cadastroConfigurado) return;

    const botaoNovo = document.getElementById("novoAdjetivo");
    const botaoCancelar = document.getElementById("cancelarNovoAdjetivo");
    const form = document.getElementById("formAdjetivo");
    const botaoSalvar = document.getElementById("salvarAdjetivo");

    botaoNovo.addEventListener("click", prepararNovoAdjetivo);
    botaoCancelar.addEventListener("click", cancelarFormulario);

    form.addEventListener("submit", async event => {
        event.preventDefault();
        definirMensagemCadastro("");

        const { adjetivo, dados } = montarDadosFormulario();

        if (!adjetivo) {
            definirMensagemCadastro("Informe o adjetivo.");
            return;
        }

        if (/[.#$\/\[\]]/.test(adjetivo)) {
            definirMensagemCadastro(
                "O adjetivo contém um caractere que não pode ser usado no banco."
            );
            return;
        }

        botaoSalvar.disabled = true;
        botaoSalvar.textContent = "Salvando...";

        try {
            const estavaEditando = modoFormulario === "editar";

            if (estavaEditando) {
                await salvarEdicao(adjetivo, dados);
            } else {
                await salvarNovo(adjetivo, dados);
            }

            adjetivoEmFoco = adjetivo;
            form.reset();
            modoFormulario = "novo";
            adjetivoOriginal = null;

            document.getElementById("tituloFormAdjetivo").textContent =
                "Novo adjetivo";

            definirMensagemCadastro(
                estavaEditando
                    ? `${adjetivo} atualizado com sucesso.`
                    : `${adjetivo} cadastrado com sucesso.`,
                true
            );
        } catch (error) {
            console.error("Erro ao salvar adjetivo:", error);

            if (error.message === "ADJETIVO_EXISTENTE") {
                definirMensagemCadastro(
                    "Já existe um adjetivo com esse nome."
                );
            } else {
                adjetivoEmFoco = null;
                definirMensagemCadastro(
                    modoFormulario === "editar"
                        ? "Não foi possível atualizar o adjetivo."
                        : "Não foi possível cadastrar o adjetivo."
                );
            }
        } finally {
            botaoSalvar.disabled = false;
            botaoSalvar.textContent = "Salvar";
        }
    });

    cadastroConfigurado = true;
}

export function iniciarListaAdjetivos() {
    const corpo = document.getElementById("listaAdjetivos");
    const carregando = document.getElementById("carregandoAdjetivos");
    const vazio = document.getElementById("listaAdjetivosVazia");
    const erro = document.getElementById("erroAdjetivos");
    const total = document.getElementById("totalAdjetivos");
    const paginacao = document.getElementById("paginacaoAdjetivos");

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
        ref(database, "adjetivos"),
        snapshot => {
            carregando.hidden = true;

            if (!snapshot.exists()) {
                registros = [];
                registrosFiltrados = [];
                atualizarFiltro(false);
                renderizarPagina();
                total.textContent = "0 adjetivos";
                return;
            }

            registros = Object.entries(snapshot.val())
                .sort(([a], [b]) =>
                    a.localeCompare(b, "de", { sensitivity: "base" })
                );

            atualizarFiltro(false);

            if (adjetivoEmFoco) {
                const indice = registrosFiltrados.findIndex(
                    ([adjetivo]) => adjetivo === adjetivoEmFoco
                );

                if (indice >= 0) {
                    paginaAtual =
                        Math.floor(indice / REGISTROS_POR_PAGINA) + 1;
                }

                adjetivoEmFoco = null;
            }

            total.textContent =
                `${registros.length} adjetivo${registros.length === 1 ? "" : "s"}`;

            vazio.hidden = true;
            erro.hidden = true;
            renderizarPagina();
        },
        error => {
            console.error("Erro ao carregar adjetivos:", error);

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

export function pararListaAdjetivos() {
    if (cancelarEscuta) {
        cancelarEscuta();
        cancelarEscuta = null;
    }

    registros = [];
    registrosFiltrados = [];
    paginaAtual = 1;
    adjetivoEmFoco = null;
    modoFormulario = "novo";
    adjetivoOriginal = null;

    const campoBusca = document.getElementById("buscaAdjetivos");
    const resultadoBusca = document.getElementById("resultadoBuscaAdjetivos");

    if (campoBusca) campoBusca.value = "";
    if (resultadoBusca) resultadoBusca.textContent = "";

    const form = document.getElementById("formAdjetivo");

    if (form) {
        form.reset();
        form.hidden = true;
        document.getElementById("tituloFormAdjetivo").textContent =
            "Novo adjetivo";
        definirMensagemCadastro("");
    }
}
