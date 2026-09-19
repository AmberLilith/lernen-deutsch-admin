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
let substantivoEmFoco = null;
let modoFormulario = "novo";
let substantivoOriginal = null;

function normalizar(texto) {
    return (texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function atualizarFiltro(reiniciarPagina = false) {
    const campoBusca = document.getElementById("buscaSubstantivos");
    const resultadoBusca = document.getElementById("resultadoBuscaSubstantivos");
    const termo = campoBusca.value.trim();
    const termoNormalizado = normalizar(termo);

    if (termo === "") {
        registrosFiltrados = [...registros];
        resultadoBusca.textContent = "";
    } else {
        registrosFiltrados = registros.filter(([substantivo, item]) => {
            const substantivoOk = normalizar(substantivo).includes(termoNormalizado);
            const traducaoOk = normalizar(item.traducao).includes(termoNormalizado);
            return substantivoOk || traducaoOk;
        });

        resultadoBusca.textContent =
            `${registrosFiltrados.length} resultado${registrosFiltrados.length === 1 ? "" : "s"}`;
    }

    if (reiniciarPagina) {
        paginaAtual = 1;
    }
}

async function excluirSubstantivo(substantivo, botao) {
    const confirmado = window.confirm(
        `Excluir "${substantivo}"? Esta ação não pode ser desfeita.`
    );

    if (!confirmado) return;

    botao.disabled = true;
    botao.textContent = "Excluindo...";

    try {
        await remove(ref(database, `substantivos/${substantivo}`));

        if (modoFormulario === "editar" && substantivoOriginal === substantivo) {
            cancelarFormulario();
        }
    } catch (error) {
        console.error("Erro ao excluir substantivo:", error);
        window.alert("Não foi possível excluir o substantivo.");
        botao.disabled = false;
        botao.textContent = "Excluir";
    }
}

function criarLinha(substantivo, item) {
    const linha = document.createElement("tr");

    const artigo = document.createElement("td");
    artigo.textContent = item.artigo || "";

    const nome = document.createElement("td");
    nome.textContent = substantivo;

    const traducao = document.createElement("td");
    traducao.textContent = item.traducao || "";

    const plural = document.createElement("td");
    plural.textContent = item.plural || "";

    const acoes = document.createElement("td");
    acoes.className = "celula-acoes";

    const grupoAcoes = document.createElement("div");
    grupoAcoes.className = "acoes-linha";

    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "botao-editar";
    editar.textContent = "Editar";
    editar.addEventListener("click", () => abrirEdicao(substantivo, item));

    const excluir = document.createElement("button");
    excluir.type = "button";
    excluir.className = "botao-excluir";
    excluir.textContent = "Excluir";
    excluir.addEventListener("click", () => excluirSubstantivo(substantivo, excluir));

    grupoAcoes.append(editar, excluir);
    acoes.appendChild(grupoAcoes);
    linha.append(artigo, nome, traducao, plural, acoes);
    return linha;
}

function renderizarPagina() {
    const corpo = document.getElementById("listaSubstantivos");
    const paginacao = document.getElementById("paginacaoSubstantivos");
    const anterior = document.getElementById("paginaAnterior");
    const proxima = document.getElementById("proximaPagina");
    const indicador = document.getElementById("indicadorPagina");
    const vazio = document.getElementById("listaVazia");
    const campoBusca = document.getElementById("buscaSubstantivos");

    const totalPaginas = Math.ceil(registrosFiltrados.length / REGISTROS_POR_PAGINA);

    if (totalPaginas === 0) {
        corpo.innerHTML = "";
        paginacao.hidden = true;

        if (registros.length === 0) {
            vazio.textContent = "Nenhum substantivo cadastrado.";
        } else if (campoBusca.value.trim() !== "") {
            vazio.textContent = "Nenhum substantivo encontrado.";
        }

        vazio.hidden = false;
        return;
    }

    vazio.hidden = true;
    paginaAtual = Math.min(paginaAtual, totalPaginas);

    const inicio = (paginaAtual - 1) * REGISTROS_POR_PAGINA;
    const fim = inicio + REGISTROS_POR_PAGINA;

    corpo.innerHTML = "";

    registrosFiltrados.slice(inicio, fim).forEach(([substantivo, item]) => {
        corpo.appendChild(criarLinha(substantivo, item));
    });

    indicador.textContent = `Página ${paginaAtual} de ${totalPaginas}`;
    anterior.disabled = paginaAtual === 1;
    proxima.disabled = paginaAtual === totalPaginas;
    paginacao.hidden = totalPaginas <= 1;
}

function configurarControlesPaginacao() {
    if (controlesConfigurados) return;

    document.getElementById("paginaAnterior").addEventListener("click", () => {
        if (paginaAtual > 1) {
            paginaAtual--;
            renderizarPagina();
        }
    });

    document.getElementById("proximaPagina").addEventListener("click", () => {
        const totalPaginas = Math.ceil(registrosFiltrados.length / REGISTROS_POR_PAGINA);

        if (paginaAtual < totalPaginas) {
            paginaAtual++;
            renderizarPagina();
        }
    });

    controlesConfigurados = true;
}

function configurarBusca() {
    if (buscaConfigurada) return;

    const campoBusca = document.getElementById("buscaSubstantivos");

    campoBusca.addEventListener("input", () => {
        atualizarFiltro(true);
        renderizarPagina();
    });

    buscaConfigurada = true;
}

function definirMensagemCadastro(texto, sucesso = false) {
    const mensagem = document.getElementById("mensagemSubstantivo");
    mensagem.textContent = texto;
    mensagem.classList.toggle("sucesso", sucesso);
}

function capitalizarPrimeiraLetra(texto) {
    if (!texto) return "";
    return texto.charAt(0).toLocaleUpperCase("de-DE") + texto.slice(1);
}

function prepararNovoSubstantivo() {
    const form = document.getElementById("formSubstantivo");
    form.reset();
    modoFormulario = "novo";
    substantivoOriginal = null;
    document.getElementById("tituloFormSubstantivo").textContent = "Novo substantivo";
    document.getElementById("salvarSubstantivo").textContent = "Salvar";
    definirMensagemCadastro("");
    form.hidden = false;
    document.getElementById("artigoSubstantivo").focus();
}

function abrirEdicao(substantivo, item) {
    const form = document.getElementById("formSubstantivo");

    modoFormulario = "editar";
    substantivoOriginal = substantivo;

    document.getElementById("tituloFormSubstantivo").textContent = `Editar: ${substantivo}`;
    document.getElementById("artigoSubstantivo").value = item.artigo || "";
    document.getElementById("nomeSubstantivo").value = substantivo;
    document.getElementById("traducaoSubstantivo").value = item.traducao || "";
    document.getElementById("pluralSubstantivo").value = item.plural || "";
    document.getElementById("generoOpostoSubstantivo").value = item.generoOposto || "";
    document.getElementById("pluralGeneroOpostoSubstantivo").value = item.pluralGeneroOposto || "";
    document.getElementById("observacaoSubstantivo").value = item.observacao || "";

    definirMensagemCadastro("");
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelarFormulario() {
    const form = document.getElementById("formSubstantivo");
    form.reset();
    form.hidden = true;
    modoFormulario = "novo";
    substantivoOriginal = null;
    document.getElementById("tituloFormSubstantivo").textContent = "Novo substantivo";
    document.getElementById("salvarSubstantivo").textContent = "Salvar";
    definirMensagemCadastro("");
}

function montarDadosFormulario() {
    const artigo = document.getElementById("artigoSubstantivo").value;
    const substantivo = capitalizarPrimeiraLetra(
        document.getElementById("nomeSubstantivo").value.trim()
    );
    const traducao = document.getElementById("traducaoSubstantivo").value.trim();
    const plural = document.getElementById("pluralSubstantivo").value.trim();
    const generoOposto = document.getElementById("generoOpostoSubstantivo").value.trim();
    const pluralGeneroOposto = document.getElementById("pluralGeneroOpostoSubstantivo").value.trim();
    const observacao = document.getElementById("observacaoSubstantivo").value.trim();

    const dados = {
        artigo,
        traducao,
        plural
    };

    if (generoOposto) dados.generoOposto = generoOposto;
    if (pluralGeneroOposto) dados.pluralGeneroOposto = pluralGeneroOposto;
    if (observacao) dados.observacao = observacao;

    return { substantivo, dados };
}

async function salvarNovo(substantivo, dados) {
    const caminho = ref(database, `substantivos/${substantivo}`);
    const existente = await get(caminho);

    if (existente.exists()) {
        throw new Error("SUBSTANTIVO_EXISTENTE");
    }

    await set(caminho, dados);
}

async function salvarEdicao(substantivo, dados) {
    if (!substantivoOriginal) {
        throw new Error("SUBSTANTIVO_ORIGINAL_AUSENTE");
    }

    if (substantivo === substantivoOriginal) {
        await set(ref(database, `substantivos/${substantivo}`), dados);
        return;
    }

    const novoCaminho = ref(database, `substantivos/${substantivo}`);
    const existente = await get(novoCaminho);

    if (existente.exists()) {
        throw new Error("SUBSTANTIVO_EXISTENTE");
    }

    const alteracoes = {};
    alteracoes[`substantivos/${substantivo}`] = dados;
    alteracoes[`substantivos/${substantivoOriginal}`] = null;

    await update(ref(database), alteracoes);
}

function configurarCadastro() {
    if (cadastroConfigurado) return;

    const botaoNovo = document.getElementById("novoSubstantivo");
    const botaoCancelar = document.getElementById("cancelarNovoSubstantivo");
    const form = document.getElementById("formSubstantivo");
    const botaoSalvar = document.getElementById("salvarSubstantivo");

    botaoNovo.addEventListener("click", prepararNovoSubstantivo);
    botaoCancelar.addEventListener("click", cancelarFormulario);

    form.addEventListener("submit", async event => {
        event.preventDefault();
        definirMensagemCadastro("");

        const { substantivo, dados } = montarDadosFormulario();

        if (/[.#$\/\[\]]/.test(substantivo)) {
            definirMensagemCadastro("O substantivo contém um caractere que não pode ser usado no banco.");
            return;
        }

        botaoSalvar.disabled = true;
        botaoSalvar.textContent = "Salvando...";

        try {
            const estavaEditando = modoFormulario === "editar";

            if (estavaEditando) {
                await salvarEdicao(substantivo, dados);
            } else {
                await salvarNovo(substantivo, dados);
            }

            substantivoEmFoco = substantivo;
            form.reset();
            modoFormulario = "novo";
            substantivoOriginal = null;
            document.getElementById("tituloFormSubstantivo").textContent = "Novo substantivo";
            definirMensagemCadastro(
                estavaEditando
                    ? `${substantivo} atualizado com sucesso.`
                    : `${substantivo} cadastrado com sucesso.`,
                true
            );
        } catch (error) {
            console.error("Erro ao salvar substantivo:", error);

            if (error.message === "SUBSTANTIVO_EXISTENTE") {
                definirMensagemCadastro("Já existe um substantivo com esse nome.");
            } else {
                substantivoEmFoco = null;
                definirMensagemCadastro(
                    modoFormulario === "editar"
                        ? "Não foi possível atualizar o substantivo."
                        : "Não foi possível cadastrar o substantivo."
                );
            }
        } finally {
            botaoSalvar.disabled = false;
            botaoSalvar.textContent = "Salvar";
        }
    });

    cadastroConfigurado = true;
}

export function iniciarListaSubstantivos() {
    const corpo = document.getElementById("listaSubstantivos");
    const carregando = document.getElementById("carregandoSubstantivos");
    const vazio = document.getElementById("listaVazia");
    const erro = document.getElementById("erroSubstantivos");
    const total = document.getElementById("totalSubstantivos");
    const paginacao = document.getElementById("paginacaoSubstantivos");

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
        ref(database, "substantivos"),
        snapshot => {
            carregando.hidden = true;

            if (!snapshot.exists()) {
                registros = [];
                registrosFiltrados = [];
                atualizarFiltro(false);
                renderizarPagina();
                total.textContent = "0 substantivos";
                return;
            }

            const dados = snapshot.val();

            registros = Object.entries(dados)
                .sort(([a], [b]) => a.localeCompare(b, "de"));

            atualizarFiltro(false);

            if (substantivoEmFoco) {
                const indice = registrosFiltrados.findIndex(
                    ([substantivo]) => substantivo === substantivoEmFoco
                );

                if (indice >= 0) {
                    paginaAtual = Math.floor(indice / REGISTROS_POR_PAGINA) + 1;
                }

                substantivoEmFoco = null;
            }

            total.textContent = `${registros.length} substantivo${registros.length === 1 ? "" : "s"}`;
            vazio.hidden = true;
            erro.hidden = true;

            renderizarPagina();
        },
        error => {
            console.error("Erro ao carregar substantivos:", error);
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

export function pararListaSubstantivos() {
    if (cancelarEscuta) {
        cancelarEscuta();
        cancelarEscuta = null;
    }

    registros = [];
    registrosFiltrados = [];
    paginaAtual = 1;
    substantivoEmFoco = null;
    modoFormulario = "novo";
    substantivoOriginal = null;

    const campoBusca = document.getElementById("buscaSubstantivos");
    const resultadoBusca = document.getElementById("resultadoBuscaSubstantivos");

    if (campoBusca) campoBusca.value = "";
    if (resultadoBusca) resultadoBusca.textContent = "";

    const form = document.getElementById("formSubstantivo");
    if (form) {
        form.reset();
        form.hidden = true;
        document.getElementById("tituloFormSubstantivo").textContent = "Novo substantivo";
        definirMensagemCadastro("");
    }
}
