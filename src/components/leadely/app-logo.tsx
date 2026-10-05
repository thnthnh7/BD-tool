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
        src="/brand/bizcraw-mark.png"
        alt="Bizcraw"
        width={512}
        height={411}
        className={`${classes.img} ${classes.compact}`}
        unoptimized
        priority
      />
    );
  }

  if (tagline) {
    return (
      <Image
        src="/brand/bizcraw-logo.png"
        alt="Bizcraw"
        width={1600}
        height={384}
        className={`${classes.img} ${classes.lockup}`}
        unoptimized
        priority
      />
    );
  }

  return (
    <div className={classes.wrap} title={platform ? "Bizcraw Platform" : undefined}>
      <Image
        src="/brand/bizcraw-logo.png"
        alt={platform ? "Bizcraw Platform" : "Bizcraw"}
        width={1600}
        height={384}
        className={`${classes.img} ${classes.navbar}`}
        unoptimized
        priority
      />
    </div>
  );
}
