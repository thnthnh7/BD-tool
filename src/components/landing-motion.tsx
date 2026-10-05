"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

gsap.registerPlugin(useGSAP);

export function LandingMotion({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    (_, contextSafe) => {
      const root = scope.current;
      if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const heroItems = root.querySelectorAll("section:first-of-type > *:not(script)");
      gsap.from(heroItems, {
        autoAlpha: 0,
        y: 26,
        duration: 0.72,
        stagger: 0.1,
        ease: "power3.out",
        clearProps: "all",
      });

      const sections = Array.from(root.querySelectorAll("section:not(:first-of-type), footer"));
      gsap.set(sections, { autoAlpha: 0.2, y: 34 });
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            gsap.to(entry.target, { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out", clearProps: "all" });
            observer.unobserve(entry.target);
          }
        },
        { threshold: 0.1, rootMargin: "0px 0px -8% 0px" },
      );
      sections.forEach((section) => observer.observe(section));

      const press = (event: Event) => {
        const target = (event.target as HTMLElement).closest("a, button, summary");
        if (!target || !root.contains(target)) return;
        gsap.fromTo(target, { scale: 0.97 }, { scale: 1, duration: 0.28, ease: "back.out(2)", overwrite: true });
      };
      const onPress = contextSafe ? contextSafe(press) : press;
      root.addEventListener("pointerdown", onPress);

      return () => {
        observer.disconnect();
        root.removeEventListener("pointerdown", onPress);
      };
    },
    { scope },
  );

  return <div ref={scope}>{children}</div>;
}
