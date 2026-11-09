import { useLayoutEffect, useRef } from "react";

/** Presentation-only motion; account verification and persistence stay with the caller. */
export function useWalletMotion(selection: string, visible: boolean) {
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef(new Map<string, DOMRect>());
  const capture = () => {
    previous.current.clear();
    root.current?.querySelectorAll<HTMLElement>("[data-wallet-id]").forEach(card => {
      previous.current.set(card.dataset.walletId ?? "", card.getBoundingClientRect());
    });
  };

  useLayoutEffect(() => {
    const container = root.current;
    if (!container) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cards = Array.from(container.querySelectorAll<HTMLElement>(".mt5-wallet-scroll [data-wallet-id]"));
    const scroll = container.querySelector<HTMLElement>(".mt5-wallet-scroll");
    let frame = 0;
    let last = 0;
    const positions = cards.map(() => 0);
    const velocities = cards.map(() => 0);
    const update = (time: number) => {
      const dt = Math.min((time - last) / 1000 || 1 / 60, 1 / 30);
      last = time;
      let moving = false;
      cards.forEach((card, index) => {
        const distance = scroll ? card.offsetTop - scroll.scrollTop - 12 : 0;
        const target = reduced.matches ? 0 : Math.max(-1, Math.min(1, distance / 340));
        velocities[index] += ((target - positions[index]) * 150 - velocities[index] * 25) * dt;
        positions[index] += velocities[index] * dt;
        const depth = Math.abs(positions[index]);
        card.style.transform = reduced.matches ? "none" : `translateY(${positions[index] * 8}px) scale(${1 - depth * 0.055}) rotateX(${positions[index] * -4}deg)`;
        card.style.opacity = String(1 - depth * 0.12);
        moving ||= Math.abs(target - positions[index]) > 0.001 || Math.abs(velocities[index]) > 0.001;
      });
      frame = moving ? requestAnimationFrame(update) : 0;
    };
    const schedule = () => { if (!frame) { last = 0; frame = requestAnimationFrame(update); } };
    const animations: Animation[] = [];
    if (!reduced.matches) container.querySelectorAll<HTMLElement>("[data-wallet-id]").forEach(card => {
      const old = previous.current.get(card.dataset.walletId ?? "");
      if (!old) return;
      const next = card.getBoundingClientRect();
      animations.push(card.animate([
        { transform: `translate(${old.x - next.x}px, ${old.y - next.y}px) scale(${old.width / next.width})`, opacity: 0.85 },
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
      ], { duration: 580, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }));
    });
    previous.current.clear();
    scroll?.addEventListener("scroll", schedule, { passive: true });
    reduced.addEventListener("change", schedule);
    const resize = new ResizeObserver(schedule);
    if (scroll) resize.observe(scroll);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      scroll?.removeEventListener("scroll", schedule);
      reduced.removeEventListener("change", schedule);
      resize.disconnect();
      animations.forEach(animation => animation.cancel());
    };
  }, [selection, visible]);
  return { root, capture };
}