import { database } from "./firebase.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

let cancelarEscuta = null;

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

export function iniciarListaSubstantivos() {
    const corpo = document.getElementById("listaSubstantivos");
    const carregando = document.getElementById("carregandoSubstantivos");
    const vazio = document.getElementById("listaVazia");
    const erro = document.getElementById("erroSubstantivos");
    const total = document.getElementById("totalSubstantivos");

    if (cancelarEscuta) {
        cancelarEscuta();
        cancelarEscuta = null;
    }

    corpo.innerHTML = "";
    carregando.hidden = false;
    vazio.hidden = true;
    erro.hidden = true;
    total.textContent = "";

    cancelarEscuta = onValue(
        ref(database, "substantivos"),
        snapshot => {
            carregando.hidden = true;
            corpo.innerHTML = "";

            if (!snapshot.exists()) {
                vazio.hidden = false;
                total.textContent = "0 substantivos";
                return;
            }

            const dados = snapshot.val();
            const registros = Object.entries(dados)
                .sort(([a], [b]) => a.localeCompare(b, "de"));

            registros.forEach(([substantivo, item]) => {
                corpo.appendChild(criarLinha(substantivo, item));
            });

            total.textContent = `${registros.length} substantivo${registros.length === 1 ? "" : "s"}`;
            vazio.hidden = true;
            erro.hidden = true;
        },
        error => {
            console.error("Erro ao carregar substantivos:", error);
            carregando.hidden = true;
            corpo.innerHTML = "";
            vazio.hidden = true;
            erro.hidden = false;
            total.textContent = "";
        }
    );
}

export function pararListaSubstantivos() {
    if (cancelarEscuta) {
        cancelarEscuta();
        cancelarEscuta = null;
    }
}
