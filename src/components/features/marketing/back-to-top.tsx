"use client";

import { useEffect, useState } from "react";

/**
 * Botão flutuante de volta ao topo (canto inferior direito). Só aparece depois
 * de uma tela de rolagem — antes disso não há o que desfazer, e o disco
 * competiria com o CTA do hero. Fica em `z-40` de propósito: se a faixa de
 * cookies (z-50) estiver na tela, ela tem prioridade sobre o botão.
 *
 * A distância até a base é calculada no CSS (`--btn-to-top-bottom`), porque
 * no celular ela depende de quem mais está no rodapé: a barra de CTA e a
 * faixa de cookies empurram o disco para cima em vez de ficar por baixo dele.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > window.innerHeight * 0.6);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  function scrollToTop() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Voltar ao topo"
      tabIndex={visible ? 0 : -1}
      className={`btn-to-top fixed right-4 z-40 sm:right-6 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <svg className="btn-to-top__icon" viewBox="0 0 384 512" aria-hidden="true">
        <path
          fill="currentColor"
          d="M214.6 41.4c-12.5-12.5-32.8-12.5-45.3 0l-160 160c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 141.2V448c0 17.7 14.3 32 32 32s32-14.3 32-32V141.2L329.4 246.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-160-160z"
        />
      </svg>
    </button>
  );
}
