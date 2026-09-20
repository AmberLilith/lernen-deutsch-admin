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
const PESSOAS = ["ich", "du", "er/sie/es", "wir", "ihr", "sie/Sie"];

let cancelarEscuta = null;
let registros = [];
let registrosFiltrados = [];
let paginaAtual = 1;
let controlesConfigurados = false;
let cadastroConfigurado = false;
let buscaConfigurada = false;
let verboEmFoco = null;
let modoFormulario = "novo";
let verboOriginal = null;

function normalizar(texto) {
    return (texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function normalizarLista(valor) {
    if (Array.isArray(valor)) return valor;

    if (valor && typeof valor === "object") {
        return Object.keys(valor)
            .sort((a, b) => Number(a) - Number(b))
            .map(chave => valor[chave]);
    }

    return [];
}

function caracteristicas(item) {
    const lista = [];
    if (item.separavel) lista.push("separável");
    if (item.inseparavel) lista.push("inseparável");
    if (item.reflexivo) lista.push("reflexivo");
    if (item.preposicional) lista.push("preposicional");
    if (item.modal) lista.push("modal");
    if (item.verboAuxiliar) lista.push("auxiliar");
    if (item.impessoal) lista.push("impessoal");
    return lista.join(", ") || "normal";
}

function atualizarFiltro(reiniciarPagina = false) {
    const campoBusca = document.getElementById("buscaVerbos");
    const resultadoBusca = document.getElementById("resultadoBuscaVerbos");
    const termo = campoBusca.value.trim();
    const termoNormalizado = normalizar(termo);

    if (termo === "") {
        registrosFiltrados = [...registros];
        resultadoBusca.textContent = "";
    } else {
        registrosFiltrados = registros.filter(([verbo, item]) => {
            const verboOk = normalizar(verbo).includes(termoNormalizado);
            const traducaoOk = normalizar(item.traducao).includes(termoNormalizado);
            return verboOk || traducaoOk;
        });

        resultadoBusca.textContent =
            `${registrosFiltrados.length} resultado${registrosFiltrados.length === 1 ? "" : "s"}`;
    }

    if (reiniciarPagina) paginaAtual = 1;
}

async function excluirVerbo(verbo, botao) {
    const confirmado = window.confirm(
        `Excluir "${verbo}"? Esta ação não pode ser desfeita.`
    );

    if (!confirmado) return;

    botao.disabled = true;
    botao.textContent = "Excluindo...";

    try {
        await remove(ref(database, `verbos/${verbo}`));

        if (modoFormulario === "editar" && verboOriginal === verbo) {
            cancelarFormulario();
        }
    } catch (error) {
        console.error("Erro ao excluir verbo:", error);
        window.alert("Não foi possível excluir o verbo.");
        botao.disabled = false;
        botao.textContent = "Excluir";
    }
}

function criarLinha(verbo, item) {
    const linha = document.createElement("tr");

    const nome = document.createElement("td");
    nome.textContent = verbo;

    const traducao = document.createElement("td");
    traducao.textContent = item.traducao || "";

    const regularidade = document.createElement("td");
    regularidade.textContent = item.regularidade || "";

    const auxiliar = document.createElement("td");
    auxiliar.textContent = item.auxiliar || "";

    const tipos = document.createElement("td");
    tipos.textContent = caracteristicas(item);

    const acoes = document.createElement("td");
    acoes.className = "celula-acoes";

    const grupoAcoes = document.createElement("div");
    grupoAcoes.className = "acoes-linha";

    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "botao-editar";
    editar.textContent = "Editar";
    editar.addEventListener("click", () => abrirEdicao(verbo, item));

    const excluir = document.createElement("button");
    excluir.type = "button";
    excluir.className = "botao-excluir";
    excluir.textContent = "Excluir";
    excluir.addEventListener("click", () => excluirVerbo(verbo, excluir));

    grupoAcoes.append(editar, excluir);
    acoes.appendChild(grupoAcoes);
    linha.append(nome, traducao, regularidade, auxiliar, tipos, acoes);

    return linha;
}

function renderizarPagina() {
    const corpo = document.getElementById("listaVerbos");
    const paginacao = document.getElementById("paginacaoVerbos");
    const anterior = document.getElementById("paginaAnteriorVerbos");
    const proxima = document.getElementById("proximaPaginaVerbos");
    const indicador = document.getElementById("indicadorPaginaVerbos");
    const vazio = document.getElementById("listaVerbosVazia");
    const campoBusca = document.getElementById("buscaVerbos");

    const totalPaginas = Math.ceil(registrosFiltrados.length / REGISTROS_POR_PAGINA);

    if (totalPaginas === 0) {
        corpo.innerHTML = "";
        paginacao.hidden = true;

        if (registros.length === 0) {
            vazio.textContent = "Nenhum verbo cadastrado.";
        } else if (campoBusca.value.trim() !== "") {
            vazio.textContent = "Nenhum verbo encontrado.";
        }

        vazio.hidden = false;
        return;
    }

    vazio.hidden = true;
    paginaAtual = Math.min(paginaAtual, totalPaginas);

    const inicio = (paginaAtual - 1) * REGISTROS_POR_PAGINA;
    const fim = inicio + REGISTROS_POR_PAGINA;

    corpo.innerHTML = "";

    registrosFiltrados.slice(inicio, fim).forEach(([verbo, item]) => {
        corpo.appendChild(criarLinha(verbo, item));
    });

    indicador.textContent = `Página ${paginaAtual} de ${totalPaginas}`;
    anterior.disabled = paginaAtual === 1;
    proxima.disabled = paginaAtual === totalPaginas;
    paginacao.hidden = totalPaginas <= 1;
}

function configurarControlesPaginacao() {
    if (controlesConfigurados) return;

    document.getElementById("paginaAnteriorVerbos").addEventListener("click", () => {
        if (paginaAtual > 1) {
            paginaAtual--;
            renderizarPagina();
        }
    });

    document.getElementById("proximaPaginaVerbos").addEventListener("click", () => {
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

    document.getElementById("buscaVerbos").addEventListener("input", () => {
        atualizarFiltro(true);
        renderizarPagina();
    });

    buscaConfigurada = true;
}

function definirMensagemCadastro(texto, sucesso = false) {
    const mensagem = document.getElementById("mensagemVerbo");
    mensagem.textContent = texto;
    mensagem.classList.toggle("sucesso", sucesso);
}

function atualizarCamposIrregulares() {
    const irregular =
        document.getElementById("regularidadeVerbo").value === "irregular";

    document.getElementById("camposIrregulares").hidden = !irregular;
    document.getElementById("presenteVerbo").required = irregular;
    document.getElementById("preteritoVerbo").required = irregular;
}

function atualizarObrigatoriedadePrefixo() {
    const separavel = document.getElementById("separavelVerbo").checked;
    document.getElementById("prefixoVerbo").required = separavel;
}


function prepararNovoVerbo() {
    const form = document.getElementById("formVerbo");

    form.reset();
    modoFormulario = "novo";
    verboOriginal = null;
    document.getElementById("regularidadeVerbo").value = "regular";
    document.getElementById("tituloFormVerbo").textContent = "Novo verbo";
    document.getElementById("salvarVerbo").textContent = "Salvar";
    definirMensagemCadastro("");
    atualizarCamposIrregulares();
    atualizarObrigatoriedadePrefixo();
    form.hidden = false;
    document.getElementById("nomeVerbo").focus();
}

function formatarConjugacao(formas) {
    const lista = normalizarLista(formas);

    return lista
        .map((forma, indice) => `${PESSOAS[indice]} ${forma}`)
        .join("\n");
}

function formatarRegencias(regencias) {
    return normalizarLista(regencias)
        .map(item => `${item.preposicao || ""} | ${item.caso || ""}`)
        .join("\n");
}

function abrirEdicao(verbo, item) {
    const form = document.getElementById("formVerbo");

    modoFormulario = "editar";
    verboOriginal = verbo;

    document.getElementById("tituloFormVerbo").textContent = `Editar: ${verbo}`;
    document.getElementById("nomeVerbo").value = verbo;
    document.getElementById("traducaoVerbo").value = item.traducao || "";
    document.getElementById("partizipVerbo").value = item.partizip || "";
    document.getElementById("auxiliarVerbo").value = item.auxiliar || "";
    document.getElementById("regularidadeVerbo").value = item.regularidade || "regular";
    document.getElementById("prefixoVerbo").value = item.prefixo || "";

    document.getElementById("separavelVerbo").checked = Boolean(item.separavel);
    document.getElementById("inseparavelVerbo").checked = Boolean(item.inseparavel);
    document.getElementById("reflexivoVerbo").checked = Boolean(item.reflexivo);
    document.getElementById("preposicionalVerbo").checked = Boolean(item.preposicional);
    document.getElementById("modalVerbo").checked = Boolean(item.modal);
    document.getElementById("verboAuxiliarVerbo").checked = Boolean(item.verboAuxiliar);
    document.getElementById("impessoalVerbo").checked = Boolean(item.impessoal);

    document.getElementById("regenciasVerbo").value =
        formatarRegencias(item.regencias);

    document.getElementById("presenteVerbo").value =
        item.regularidade === "irregular" ? formatarConjugacao(item.presente) : "";

    document.getElementById("preteritoVerbo").value =
        item.regularidade === "irregular" ? formatarConjugacao(item.preterito) : "";

    atualizarCamposIrregulares();
    atualizarObrigatoriedadePrefixo();
    definirMensagemCadastro("");
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelarFormulario() {
    const form = document.getElementById("formVerbo");

    form.reset();
    form.hidden = true;
    modoFormulario = "novo";
    verboOriginal = null;
    document.getElementById("regularidadeVerbo").value = "regular";
    document.getElementById("tituloFormVerbo").textContent = "Novo verbo";
    document.getElementById("salvarVerbo").textContent = "Salvar";
    definirMensagemCadastro("");
    atualizarCamposIrregulares();
    atualizarObrigatoriedadePrefixo();
}

function removerRotuloPessoa(linha, indice) {
    const padroes = [
        /^ich\s*[:\-]?\s*/i,
        /^du\s*[:\-]?\s*/i,
        /^(?:er\s*\/\s*sie\s*\/\s*es|er\/sie\/es)\s*[:\-]?\s*/i,
        /^wir\s*[:\-]?\s*/i,
        /^ihr\s*[:\-]?\s*/i,
        /^(?:sie\s*\/\s*Sie|sie\/Sie)\s*[:\-]?\s*/
    ];

    return linha.replace(padroes[indice], "").trim();
}

function interpretarConjugacao(texto, nomeTempo) {
    let linhas = texto
        .split(/\r?\n/)
        .map(linha => linha.trim())
        .filter(Boolean);

    if (linhas.length === 1 && linhas[0].includes(";")) {
        linhas = linhas[0]
            .split(";")
            .map(linha => linha.trim())
            .filter(Boolean);
    }

    if (linhas.length !== 6) {
        throw new Error(
            `${nomeTempo}: informe exatamente 6 formas, uma para cada pessoa.`
        );
    }

    const formas = linhas.map((linha, indice) =>
        removerRotuloPessoa(linha, indice)
    );

    if (formas.some(forma => forma === "")) {
        throw new Error(`${nomeTempo}: uma das formas ficou vazia.`);
    }

    return formas;
}

function interpretarRegencias(texto) {
    const linhas = texto
        .split(/\r?\n/)
        .map(linha => linha.trim())
        .filter(Boolean);

    return linhas.map(linha => {
        const [preposicao, ...resto] = linha.split("|");
        const caso = resto.join("|").trim();
        const prep = (preposicao || "").trim();

        if (!prep || !caso) {
            throw new Error(
                'Regências: use o formato "preposição | caso", uma por linha.'
            );
        }

        return { preposicao: prep, caso };
    });
}

function montarDadosFormulario() {
    const verbo = document
        .getElementById("nomeVerbo")
        .value
        .trim()
        .toLocaleLowerCase("de-DE");

    const traducao =
        document.getElementById("traducaoVerbo").value.trim();

    const partizip =
        document.getElementById("partizipVerbo").value.trim();

    const auxiliar =
        document.getElementById("auxiliarVerbo").value;

    const regularidade =
        document.getElementById("regularidadeVerbo").value;

    const prefixo =
        document.getElementById("prefixoVerbo").value.trim();

    const dados = {
        traducao,
        partizip,
        auxiliar,
        regularidade
    };

    const camposBooleanos = {
        separavel: "separavelVerbo",
        inseparavel: "inseparavelVerbo",
        reflexivo: "reflexivoVerbo",
        preposicional: "preposicionalVerbo",
        modal: "modalVerbo",
        verboAuxiliar: "verboAuxiliarVerbo",
        impessoal: "impessoalVerbo"
    };

    Object.entries(camposBooleanos).forEach(([campo, id]) => {
        if (document.getElementById(id).checked) {
            dados[campo] = true;
        }
    });

    if (prefixo) dados.prefixo = prefixo;

    const regencias = interpretarRegencias(
        document.getElementById("regenciasVerbo").value
    );

    if (regencias.length) {
        dados.regencias = regencias;
        dados.preposicional = true;
    }

    if (regularidade === "irregular") {
        dados.presente = interpretarConjugacao(
            document.getElementById("presenteVerbo").value,
            "Präsens"
        );

        dados.preterito = interpretarConjugacao(
            document.getElementById("preteritoVerbo").value,
            "Präteritum"
        );
    }

    return { verbo, dados };
}

async function salvarNovo(verbo, dados) {
    const caminho = ref(database, `verbos/${verbo}`);
    const existente = await get(caminho);

    if (existente.exists()) {
        throw new Error("VERBO_EXISTENTE");
    }

    await set(caminho, dados);
}

async function salvarEdicao(verbo, dados) {
    if (!verboOriginal) {
        throw new Error("VERBO_ORIGINAL_AUSENTE");
    }

    if (verbo === verboOriginal) {
        await set(ref(database, `verbos/${verbo}`), dados);
        return;
    }

    const novoCaminho = ref(database, `verbos/${verbo}`);
    const existente = await get(novoCaminho);

    if (existente.exists()) {
        throw new Error("VERBO_EXISTENTE");
    }

    const alteracoes = {};
    alteracoes[`verbos/${verbo}`] = dados;
    alteracoes[`verbos/${verboOriginal}`] = null;

    await update(ref(database), alteracoes);
}

function configurarCadastro() {
    if (cadastroConfigurado) return;

    const botaoNovo = document.getElementById("novoVerbo");
    const botaoCancelar = document.getElementById("cancelarNovoVerbo");
    const form = document.getElementById("formVerbo");
    const botaoSalvar = document.getElementById("salvarVerbo");
    const regularidade = document.getElementById("regularidadeVerbo");
    const separavel = document.getElementById("separavelVerbo");

    botaoNovo.addEventListener("click", prepararNovoVerbo);
    botaoCancelar.addEventListener("click", cancelarFormulario);
    regularidade.addEventListener("change", atualizarCamposIrregulares);
    separavel.addEventListener("change", atualizarObrigatoriedadePrefixo);

    form.addEventListener("submit", async event => {
        event.preventDefault();
        definirMensagemCadastro("");

        let dadosFormulario;

        try {
            dadosFormulario = montarDadosFormulario();
        } catch (error) {
            definirMensagemCadastro(error.message);
            return;
        }

        const { verbo, dados } = dadosFormulario;

        if (!verbo) {
            definirMensagemCadastro("Informe o verbo.");
            return;
        }

        if (/[.#$\/\[\]]/.test(verbo)) {
            definirMensagemCadastro(
                "O verbo contém um caractere que não pode ser usado no banco."
            );
            return;
        }

        if (dados.separavel && dados.inseparavel) {
            definirMensagemCadastro(
                "O verbo não pode ser separável e inseparável ao mesmo tempo."
            );
            return;
        }

        if (dados.separavel && !dados.prefixo) {
            definirMensagemCadastro(
                "Informe o prefixo do verbo separável."
            );
            document.getElementById("prefixoVerbo").focus();
            return;
        }

        botaoSalvar.disabled = true;
        botaoSalvar.textContent = "Salvando...";

        try {
            const estavaEditando = modoFormulario === "editar";

            if (estavaEditando) {
                await salvarEdicao(verbo, dados);
            } else {
                await salvarNovo(verbo, dados);
            }

            verboEmFoco = verbo;
            form.reset();
            modoFormulario = "novo";
            verboOriginal = null;
            document.getElementById("regularidadeVerbo").value = "regular";
            document.getElementById("tituloFormVerbo").textContent = "Novo verbo";
            atualizarCamposIrregulares();
            atualizarObrigatoriedadePrefixo();

            definirMensagemCadastro(
                estavaEditando
                    ? `${verbo} atualizado com sucesso.`
                    : `${verbo} cadastrado com sucesso.`,
                true
            );
        } catch (error) {
            console.error("Erro ao salvar verbo:", error);

            if (error.message === "VERBO_EXISTENTE") {
                definirMensagemCadastro("Já existe um verbo com esse nome.");
            } else {
                verboEmFoco = null;
                definirMensagemCadastro(
                    modoFormulario === "editar"
                        ? "Não foi possível atualizar o verbo."
                        : "Não foi possível cadastrar o verbo."
                );
            }
        } finally {
            botaoSalvar.disabled = false;
            botaoSalvar.textContent = "Salvar";
        }
    });

    cadastroConfigurado = true;
}

export function iniciarListaVerbos() {
    const corpo = document.getElementById("listaVerbos");
    const carregando = document.getElementById("carregandoVerbos");
    const vazio = document.getElementById("listaVerbosVazia");
    const erro = document.getElementById("erroVerbos");
    const total = document.getElementById("totalVerbos");
    const paginacao = document.getElementById("paginacaoVerbos");

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
        ref(database, "verbos"),
        snapshot => {
            carregando.hidden = true;

            if (!snapshot.exists()) {
                registros = [];
                registrosFiltrados = [];
                atualizarFiltro(false);
                renderizarPagina();
                total.textContent = "0 verbos";
                return;
            }

            registros = Object.entries(snapshot.val())
                .sort(([a], [b]) => a.localeCompare(b, "de"));

            atualizarFiltro(false);

            if (verboEmFoco) {
                const indice = registrosFiltrados.findIndex(
                    ([verbo]) => verbo === verboEmFoco
                );

                if (indice >= 0) {
                    paginaAtual = Math.floor(indice / REGISTROS_POR_PAGINA) + 1;
                }

                verboEmFoco = null;
            }

            total.textContent =
                `${registros.length} verbo${registros.length === 1 ? "" : "s"}`;

            vazio.hidden = true;
            erro.hidden = true;
            renderizarPagina();
        },
        error => {
            console.error("Erro ao carregar verbos:", error);
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

export function pararListaVerbos() {
    if (cancelarEscuta) {
        cancelarEscuta();
        cancelarEscuta = null;
    }

    registros = [];
    registrosFiltrados = [];
    paginaAtual = 1;
    verboEmFoco = null;
    modoFormulario = "novo";
    verboOriginal = null;

    const campoBusca = document.getElementById("buscaVerbos");
    const resultadoBusca = document.getElementById("resultadoBuscaVerbos");

    if (campoBusca) campoBusca.value = "";
    if (resultadoBusca) resultadoBusca.textContent = "";

    const form = document.getElementById("formVerbo");

    if (form) {
        form.reset();
        form.hidden = true;
        document.getElementById("regularidadeVerbo").value = "regular";
        document.getElementById("tituloFormVerbo").textContent = "Novo verbo";
        definirMensagemCadastro("");
        atualizarCamposIrregulares();
        atualizarObrigatoriedadePrefixo();
    }
}
