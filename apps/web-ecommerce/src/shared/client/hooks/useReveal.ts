'use client';

import { useEffect, useState, type RefObject } from 'react';

// Fades and lifts each `[data-reveal]` element under `root` in as it scrolls into view, once. The root gets
// `reveal-ready` only after this runs, so without JavaScript (and in the server HTML) everything is simply visible;
// with reduced motion nothing is hidden at all. Pass the values that change which elements exist as `deps`.
export function useReveal(root: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const element = root.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const targets = Array.from(element.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-revealed)'));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    // Anything already on screen shows at once, so the first paint never flashes empty.
    const viewport = window.innerHeight;
    for (const target of targets) {
      if (target.getBoundingClientRect().top < viewport * 0.92) target.classList.add('is-revealed', 'is-instant');
      else observer.observe(target);
    }
    element.classList.add('reveal-ready');
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Counts the numbers inside `value` (e.g. "83%", "10–45") up from zero when `active` turns true; the text is the
// final value until then, so the server HTML and screen readers always get the real figure.
export function useCountUp(value: string, active: boolean, duration = 1100) {
  const [text, setText] = useState(value);
  useEffect(() => {
    if (!active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const parts = value.split(/(\d+)/);
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setText(parts.map((part) => (/^\d+$/.test(part) ? String(Math.round(Number(part) * eased)) : part)).join(''));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, active, duration]);
  return text;
}
