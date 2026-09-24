"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ActionIcon, Anchor, Button, type AnchorProps, type ButtonProps } from "@mantine/core";
import { ArrowUpRight } from "lucide-react";

export function LinkButton({ href, children, ...props }: ButtonProps & { href: string; children?: ReactNode }) {
  return (
    <Button component={Link} href={href} {...props}>
      {children}
    </Button>
  );
}

export function LinkAnchor({ href, children, ...props }: AnchorProps & { href: string; children?: ReactNode }) {
  return (
    <Anchor component={Link} href={href} {...props}>
      {children}
    </Anchor>
  );
}

export function LinkIcon({ href, label }: { href: string; label: string }) {
  return (
    <ActionIcon component={Link} href={href} variant="subtle" color="leadely" size={28} aria-label={label}>
      <ArrowUpRight size={16} />
    </ActionIcon>
  );
}
