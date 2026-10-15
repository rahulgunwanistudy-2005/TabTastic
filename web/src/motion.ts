/**
 * Journeyproof motion layer: Lenis smooth scroll, header hide/solid states, line-split heading
 * reveals with the green sweep, and staggered card reveals. All values live in MOTION below.
 * Reduced motion: native scroll, no reveals, no sweep.
 */
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

gsap.registerPlugin(SplitText, CustomEase);
CustomEase.create('jpMain', '0.22,1,0.36,1');

export const MOTION = {
  scroll: { duration: 1.15, easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) },
  /** Reveals fire when an element's top crosses 85% of the viewport. */
  line: 0.85,
  heading: { duration: 0.65, stagger: 0.12, ghostOpacity: 0.14, y: 14 },
  reveal: { y: 28, duration: 0.8, stagger: 0.08 },
  hero: { headline: 0.15, copy: 0.55, card: 0.7, rest: 0.9 },
  nav: { hideAfter: 120 },
  mobileScale: 0.6,
};

const HEADINGS = [
  '.hero h1',
  '.section-heading h2',
  '.compare-section h2',
  '.feature-copy h2',
  '.page-intro h1',
  '.pricing-intro h1',
  '.pricing-faq h2',
  '.closing-note p',
];

const GROUPS: Array<[string, string]> = [
  ['.process-grid', '.process-card'],
  ['.stakes-grid', '.stakes-card'],
  ['.compare-table', '.compare-row'],
  ['.pricing-grid', '.price-card'],
  ['.comparison-grid', '.announcement-evidence'],
  ['.report-meta', ':scope > div'],
  ['.faq-list', 'details'],
  ['.run-list', '.run-row'],
  ['.insight-strip', ':scope > *'],
  ['.feature-section', '.announcement-illustration'],
  ['.report-evidence-grid', ':scope > *'],
];

const reduceQuery = '(prefers-reduced-motion: reduce)';
const prefersReduced = () => window.matchMedia(reduceQuery).matches;
const isMobile = () => window.matchMedia('(max-width: 650px)').matches;

let lenis: Lenis | null = null;

function startLenis() {
  if (lenis || prefersReduced()) return;
  lenis = new Lenis({
    duration: MOTION.scroll.duration,
    easing: MOTION.scroll.easing,
    smoothWheel: true,
    syncTouch: false,
    anchors: true,
    autoRaf: false,
    // Inner scroll areas (live transcript, code diff) keep native scrolling.
    prevent: (node) => !!node.closest?.('.transcript-body, .code-diff, .main-nav.nav-open'),
  });
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
}

function tick(time: number) {
  lenis?.raf(time * 1000);
}

function whenVisible(el: Element, onEnter: () => void) {
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting || e.boundingClientRect.bottom < 0)) return;
      io.disconnect();
      onEnter();
    },
    { rootMargin: `0px 0px -${Math.round((1 - MOTION.line) * 100)}% 0px` },
  );
  io.observe(el);
  return () => io.disconnect();
}

function sweepWhenVisible(el: HTMLElement) {
  el.classList.add('sweep', 'is-sweeping');
  const io = new IntersectionObserver(([entry]) => el.classList.toggle('is-inview', entry.isIntersecting));
  io.observe(el);
  return () => io.disconnect();
}

/** Lines fade up from a faint ghost, one after another; the split is reverted afterwards. */
function revealHeading(el: HTMLElement, ctx: gsap.Context, delay = 0, immediate = false) {
  const scale = isMobile() ? MOTION.mobileScale : 1;
  gsap.set(el, { opacity: immediate ? MOTION.heading.ghostOpacity : 0 });
  const play = () =>
    document.fonts.ready.then(() =>
      ctx.add(() => {
        if (!el.isConnected) return;
        const split = SplitText.create(el, { type: 'lines', linesClass: 'split-line' });
        gsap.set(el, { opacity: 1 });
        gsap.set(split.lines, { opacity: immediate ? MOTION.heading.ghostOpacity : 0, y: MOTION.heading.y * scale });
        const tl = gsap.timeline({
          delay,
          onComplete: () => {
            split.revert();
            gsap.set(el, { clearProps: 'opacity' });
            cleanups.push(sweepWhenVisible(el));
          },
        });
        if (!immediate) tl.to(split.lines, { opacity: MOTION.heading.ghostOpacity, duration: 0.18, ease: 'none' });
        tl.to(
          split.lines,
          { opacity: 1, y: 0, duration: MOTION.heading.duration, stagger: MOTION.heading.stagger * scale, ease: 'jpMain' },
          immediate ? 0 : 0.08,
        );
      }),
    );
  if (immediate) {
    void play();
    return () => {};
  }
  return whenVisible(el, () => void play());
}

function revealGroup(items: Element[], trigger: Element, ctx: gsap.Context) {
  if (!items.length) return () => {};
  const scale = isMobile() ? MOTION.mobileScale : 1;
  gsap.set(items, { opacity: 0, y: MOTION.reveal.y * scale });
  return whenVisible(trigger, () =>
    ctx.add(() =>
      gsap.to(items, {
        opacity: 1,
        y: 0,
        duration: MOTION.reveal.duration,
        stagger: MOTION.reveal.stagger * scale,
        ease: 'jpMain',
        clearProps: 'opacity,transform',
      }),
    ),
  );
}

let cleanups: Array<() => void> = [];

function setupPage(ctx: gsap.Context) {
  const hero = document.querySelector('.hero');
  if (hero) {
    const h1 = hero.querySelector<HTMLElement>('h1');
    if (h1) cleanups.push(revealHeading(h1, ctx, MOTION.hero.headline, true));
    ctx.add(() => {
      const tl = gsap.timeline();
      tl.from('.hero .eyebrow', { opacity: 0, y: 12, duration: 0.7, ease: 'jpMain' }, 0)
        .from(['.hero-description', '.hero-proof'], { opacity: 0, y: 20, duration: 0.9, stagger: 0.08, ease: 'jpMain' }, MOTION.hero.copy)
        .from('.checker-area', { opacity: 0, y: 30, duration: 1.1, ease: 'jpMain' }, MOTION.hero.card)
        .from('.checker-caption', { opacity: 0, duration: 0.8 }, MOTION.hero.rest);
    });
  }
  for (const selector of HEADINGS) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (el.closest('.hero')) continue;
      cleanups.push(revealHeading(el, ctx));
    }
  }
  for (const [group, item] of GROUPS) {
    for (const root of document.querySelectorAll(group)) {
      cleanups.push(revealGroup(Array.from(root.querySelectorAll(item)), root, ctx));
    }
  }
}

function setupHeader() {
  const header = document.querySelector<HTMLElement>('.site-header');
  if (!header) return () => {};
  let lastY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-solid', y > 24);
    const down = y > lastY && y > MOTION.nav.hideAfter;
    header.classList.toggle('is-hidden', down && !header.contains(document.activeElement));
    lastY = y;
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}

/** Mount once in <App>; re-runs page reveals on every route change. */
export function useSiteMotion() {
  const location = useLocation();

  useEffect(() => {
    startLenis();
    const stopHeader = setupHeader();
    const media = window.matchMedia(reduceQuery);
    const onChange = () => {
      if (media.matches) {
        gsap.ticker.remove(tick);
        lenis?.destroy();
        lenis = null;
      } else startLenis();
    };
    media.addEventListener('change', onChange);
    return () => {
      stopHeader();
      media.removeEventListener('change', onChange);
    };
  }, []);

  // Layout effect: initial hidden states are set before the route's first paint (no flash).
  useLayoutEffect(() => {
    lenis?.scrollTo(0, { immediate: true, force: true });
    if (prefersReduced()) return;
    const ctx = gsap.context(() => {});
    setupPage(ctx);
    return () => {
      cleanups.forEach((fn) => fn());
      cleanups = [];
      ctx.revert();
    };
  }, [location.pathname]);
}
