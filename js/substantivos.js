import { database } from "./firebase.js?v=20260919-3";
import {
    ref,
    onValue,
    get,
    set
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

const REGISTROS_POR_PAGINA = 20;

let cancelarEscuta = null;
let registros = [];
let paginaAtual = 1;
let controlesConfigurados = false;
let cadastroConfigurado = false;
let substantivoRecemCriado = null;

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

    linha.append(artigo, nome, traducao, plural);
    return linha;
}

function renderizarPagina() {
    const corpo = document.getElementById("listaSubstantivos");
    const paginacao = document.getElementById("paginacaoSubstantivos");
    const anterior = document.getElementById("paginaAnterior");
    const proxima = document.getElementById("proximaPagina");
    const indicador = document.getElementById("indicadorPagina");

    const totalPaginas = Math.ceil(registros.length / REGISTROS_POR_PAGINA);

    if (totalPaginas === 0) {
        corpo.innerHTML = "";
        paginacao.hidden = true;
        return;
    }

    paginaAtual = Math.min(paginaAtual, totalPaginas);

    const inicio = (paginaAtual - 1) * REGISTROS_POR_PAGINA;
    const fim = inicio + REGISTROS_POR_PAGINA;

    corpo.innerHTML = "";

    registros.slice(inicio, fim).forEach(([substantivo, item]) => {
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
        const totalPaginas = Math.ceil(registros.length / REGISTROS_POR_PAGINA);

        if (paginaAtual < totalPaginas) {
            paginaAtual++;
            renderizarPagina();
        }
    });

    controlesConfigurados = true;
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

function configurarCadastro() {
    if (cadastroConfigurado) return;

    const botaoNovo = document.getElementById("novoSubstantivo");
    const botaoCancelar = document.getElementById("cancelarNovoSubstantivo");
    const form = document.getElementById("formSubstantivo");
    const botaoSalvar = document.getElementById("salvarSubstantivo");

    botaoNovo.addEventListener("click", () => {
        form.hidden = false;
        definirMensagemCadastro("");
        document.getElementById("artigoSubstantivo").focus();
    });

    botaoCancelar.addEventListener("click", () => {
        form.reset();
        form.hidden = true;
        definirMensagemCadastro("");
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();
        definirMensagemCadastro("");

        const artigo = document.getElementById("artigoSubstantivo").value;
        const substantivo = capitalizarPrimeiraLetra(
            document.getElementById("nomeSubstantivo").value.trim()
        );
        const traducao = document.getElementById("traducaoSubstantivo").value.trim();
        const plural = document.getElementById("pluralSubstantivo").value.trim();
        const generoOposto = document.getElementById("generoOpostoSubstantivo").value.trim();
        const pluralGeneroOposto = document.getElementById("pluralGeneroOpostoSubstantivo").value.trim();
        const observacao = document.getElementById("observacaoSubstantivo").value.trim();

        if (/[.#$\/\[\]]/.test(substantivo)) {
            definirMensagemCadastro("O substantivo contém um caractere que não pode ser usado no banco.");
            return;
        }

        const caminho = ref(database, `substantivos/${substantivo}`);

        botaoSalvar.disabled = true;
        botaoSalvar.textContent = "Salvando...";

        try {
            const existente = await get(caminho);

            if (existente.exists()) {
                definirMensagemCadastro("Esse substantivo já está cadastrado.");
                return;
            }

            const dados = {
                artigo,
                traducao,
                plural
            };

            if (generoOposto) dados.generoOposto = generoOposto;
            if (pluralGeneroOposto) dados.pluralGeneroOposto = pluralGeneroOposto;
            if (observacao) dados.observacao = observacao;

            substantivoRecemCriado = substantivo;
            await set(caminho, dados);

            form.reset();
            definirMensagemCadastro(`${substantivo} cadastrado com sucesso.`, true);
        } catch (error) {
            console.error("Erro ao cadastrar substantivo:", error);
            substantivoRecemCriado = null;
            definirMensagemCadastro("Não foi possível cadastrar o substantivo.");
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

    if (cancelarEscuta) {
        cancelarEscuta();
        cancelarEscuta = null;
    }

    registros = [];
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
                corpo.innerHTML = "";
                vazio.hidden = false;
                paginacao.hidden = true;
                total.textContent = "0 substantivos";
                return;
            }

            const dados = snapshot.val();

            registros = Object.entries(dados)
                .sort(([a], [b]) => a.localeCompare(b, "de"));

            if (substantivoRecemCriado) {
                const indice = registros.findIndex(
                    ([substantivo]) => substantivo === substantivoRecemCriado
                );

                if (indice >= 0) {
                    paginaAtual = Math.floor(indice / REGISTROS_POR_PAGINA) + 1;
                }

                substantivoRecemCriado = null;
            }

            total.textContent = `${registros.length} substantivo${registros.length === 1 ? "" : "s"}`;
            vazio.hidden = true;
            erro.hidden = true;

            renderizarPagina();
        },
        error => {
            console.error("Erro ao carregar substantivos:", error);
            registros = [];
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
    paginaAtual = 1;
    substantivoRecemCriado = null;

    const form = document.getElementById("formSubstantivo");
    if (form) {
        form.reset();
        form.hidden = true;
        definirMensagemCadastro("");
    }
}
