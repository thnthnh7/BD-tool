"use client";

import { useRef } from "react";
import { Check, X } from "lucide-react";
import styles from "@/styles/pricing-feature-dialog.module.css";

type FeatureGroup = { label: string; items: string[] };

export function PricingFeatureDialog({ planName, groups, hiddenCount }: { planName: string; groups: FeatureGroup[]; hiddenCount: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return <>
    <button type="button" className={styles.trigger} onClick={() => dialogRef.current?.showModal()}>
      +{hiddenCount} more feature{hiddenCount === 1 ? "" : "s"}
    </button>
    <dialog ref={dialogRef} className={styles.dialog} onClick={(event) => {
      if (event.target === event.currentTarget) event.currentTarget.close();
    }}>
      <div className={styles.panel}>
        <header><div><span>EVERYTHING INCLUDED</span><h2>{planName} features</h2></div><button type="button" aria-label="Close feature list" onClick={() => dialogRef.current?.close()}><X size={20} /></button></header>
        <div className={styles.groups}>{groups.map((group) => <section key={group.label}><h3>{group.label}</h3><ul>{group.items.map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul></section>)}</div>
      </div>
    </dialog>
  </>;
}
