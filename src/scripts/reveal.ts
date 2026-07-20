/**
 * Reveal-on-scroll con IntersectionObserver.
 *
 * Uso en markup:
 *   <div data-reveal="rise">…</div>            // anima al entrar en viewport
 *   <div data-reveal-group> <div data-reveal>…  // escalona hijos por índice
 *
 * Se re-inicializa en cada navegación con View Transitions (astro:page-load).
 */
function initReveal() {
  const prefersReduced = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  const items = Array.from(
    document.querySelectorAll<HTMLElement>('[data-reveal]')
  );

  if (prefersReduced || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  // Asignar retardo escalonado a los hijos de cada grupo.
  document
    .querySelectorAll<HTMLElement>('[data-reveal-group]')
    .forEach((group) => {
      const step = Number(group.dataset.revealStep ?? 90);
      group
        .querySelectorAll<HTMLElement>('[data-reveal]')
        .forEach((child, i) => {
          if (!child.style.getPropertyValue('--reveal-delay')) {
            child.style.setProperty('--reveal-delay', `${i * step}ms`);
          }
        });
    });

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  );

  items.forEach((el) => observer.observe(el));
}

/**
 * Recorrer TODOS los [data-reveal] de la página y armar el
 * IntersectionObserver es trabajo que no necesita el usuario ver de
 * inmediato (los elementos ya arrancan en opacity:0 por CSS). Corriéndolo
 * en el mismo tick que astro:page-load compite por el hilo principal justo
 * cuando el usuario puede estar haciendo click en algo (por eso el "Input
 * delay" alto en el INP) — se aplaza a un momento ocioso del navegador, o
 * como máximo 200ms después, para no atrasar el primer click.
 */
function scheduleIdle(fn: () => void) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(fn, { timeout: 200 });
  } else {
    setTimeout(fn, 1);
  }
}

// astro:page-load corre en la carga inicial y tras cada navegación con
// View Transitions, así que alcanza con el listener (sin llamada directa).
document.addEventListener('astro:page-load', () => scheduleIdle(initReveal));
