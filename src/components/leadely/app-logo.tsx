import Image from "next/image";
import classes from "@/styles/leadely-logo.module.css";

type AppLogoProps = {
  compact?: boolean;
  platform?: boolean;
  tagline?: boolean;
};

export function AppLogo({ compact = false, platform = false, tagline = false }: AppLogoProps) {
  if (compact) {
    return (
      <Image
        src="/brand/leadely-mark.png"
        alt="Leadely"
        width={136}
        height={108}
        className={`${classes.img} ${classes.compact}`}
        quality={100}
        unoptimized
        priority
      />
    );
  }

  if (tagline) {
    return (
      <Image
        src="/brand/leadely-logo.png"
        alt="Leadely — Your AI BD assistant"
        width={576}
        height={144}
        className={`${classes.img} ${classes.lockup}`}
        quality={100}
        unoptimized
        priority
      />
    );
  }

  return (
    <div className={classes.wrap} title={platform ? "Leadely Platform" : undefined}>
      <Image
        src="/brand/leadely-wordmark.png"
        alt={platform ? "Leadely Platform" : "Leadely"}
        width={491}
        height={132}
        className={`${classes.img} ${classes.navbar}`}
        quality={100}
        unoptimized
        priority
      />
    </div>
  );
}
