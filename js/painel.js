const botoesAbertura = document.querySelectorAll("[data-modal]");
const modais = document.querySelectorAll(".modal-admin");

function abrirModal(id) {
    const modal = document.getElementById(id);

    if (!modal) return;

    modal.showModal();

    const conteudo = modal.querySelector(".modal-admin-conteudo");
    if (conteudo) conteudo.scrollTop = 0;
}

function fecharModal(modal) {
    if (modal?.open) {
        modal.close();
    }
}

botoesAbertura.forEach(botao => {
    botao.addEventListener("click", () => {
        abrirModal(botao.dataset.modal);
    });
});

modais.forEach(modal => {
    modal
        .querySelectorAll("[data-fechar-modal]")
        .forEach(botao => {
            botao.addEventListener("click", () => fecharModal(modal));
        });

    modal.addEventListener("click", event => {
        if (event.target !== modal) return;

        const rect = modal.getBoundingClientRect();
        const dentro =
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom;

        if (!dentro) {
            fecharModal(modal);
        }
    });
});
