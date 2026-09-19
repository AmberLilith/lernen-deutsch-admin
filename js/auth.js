import { auth } from "./firebase.js?v=20260919-3";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
    iniciarListaSubstantivos,
    pararListaSubstantivos
} from "./substantivos.js?v=20260919-3";

const ADMIN_UID = "IBFeuoYBZlUTGYc3BLW7Dz7lxzx2";

const loginArea = document.getElementById("loginArea");
const painelArea = document.getElementById("painelArea");
const form = document.getElementById("loginForm");
const email = document.getElementById("email");
const senha = document.getElementById("senha");
const entrar = document.getElementById("entrar");
const sair = document.getElementById("sair");
const mensagem = document.getElementById("mensagem");

function definirMensagem(texto, sucesso = false) {
    mensagem.textContent = texto;
    mensagem.classList.toggle("sucesso", sucesso);
}

function mostrarSessaoAutenticada(autenticada) {
    loginArea.hidden = autenticada;
    painelArea.hidden = !autenticada;
}

function traduzirErro(codigo) {
    const mensagens = {
        "auth/invalid-credential": "E-mail ou senha inválidos.",
        "auth/invalid-email": "Informe um e-mail válido.",
        "auth/missing-password": "Informe a senha.",
        "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente novamente.",
        "auth/network-request-failed": "Falha de conexão. Verifique a internet e tente novamente."
    };

    return mensagens[codigo] || "Não foi possível realizar o login.";
}

form.addEventListener("submit", async event => {
    event.preventDefault();

    definirMensagem("");
    entrar.disabled = true;
    entrar.textContent = "Entrando...";

    try {
        const credencial = await signInWithEmailAndPassword(
            auth,
            email.value.trim(),
            senha.value
        );

        if (credencial.user.uid !== ADMIN_UID) {
            await signOut(auth);
            definirMensagem("Esta conta não tem acesso ao painel.");
            return;
        }

        senha.value = "";
    } catch (error) {
        definirMensagem(traduzirErro(error.code));
    } finally {
        entrar.disabled = false;
        entrar.textContent = "Entrar";
    }
});

sair.addEventListener("click", async () => {
    pararListaSubstantivos();
    definirMensagem("");
    await signOut(auth);
});

onAuthStateChanged(auth, async user => {
    if (user && user.uid !== ADMIN_UID) {
        pararListaSubstantivos();
        await signOut(auth);
        mostrarSessaoAutenticada(false);
        definirMensagem("Esta conta não tem acesso ao painel.");
        return;
    }

    const autenticada = Boolean(user);
    mostrarSessaoAutenticada(autenticada);

    if (autenticada) {
        definirMensagem("");
        iniciarListaSubstantivos();
    } else {
        pararListaSubstantivos();
    }
});
