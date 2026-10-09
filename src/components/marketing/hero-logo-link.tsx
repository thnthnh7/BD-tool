"use client";

import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";

type HeroLogoLinkProps = {
  children: ReactNode;
  className?: string;
};

export function HeroLogoLink({ children, className }: HeroLogoLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (window.location.pathname !== "/") return;

    const hero = document.getElementById("hero");
    if (!hero) return;

    event.preventDefault();
    window.history.replaceState(null, "", "/#hero");
    hero.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <Link href="/#hero" aria-label="Bizcraw home" className={className} onClick={handleClick}>{children}</Link>;
}
