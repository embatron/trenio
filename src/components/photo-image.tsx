import { useState, type MouseEvent } from "react";

import { variantImagePath } from "@/lib/images/variants";

type Preset = "card" | "avatar" | "profile" | "tile";

const PRESET: Record<Preset, { src: "c640" | "s128" | "w960" | "c320"; srcSet: string; sizes: string }> = {
  card: {
    src: "c640",
    srcSet: "c320 320w, c640 640w",
    sizes: "(max-width: 640px) 100vw, 320px",
  },
  avatar: { src: "s128", srcSet: "", sizes: "44px" },
  tile: { src: "c320", srcSet: "", sizes: "96px" },
  profile: {
    src: "w960",
    srcSet: "w960 960w",
    sizes: "(max-width: 960px) 100vw, 640px",
  },
};

export function PhotoImage({
  src,
  alt,
  preset,
  className,
  width,
  height,
  loading,
  onClick,
}: {
  src: string;
  alt: string;
  preset: Preset;
  className?: string;
  width?: number;
  height?: number;
  loading?: "eager" | "lazy";
  onClick?: (event: MouseEvent<HTMLImageElement>) => void;
}) {
  const [useMaster, setUseMaster] = useState(false);
  const raster = /\.(jpe?g|png|webp)(\?|$)/i.test(src);
  if (!raster || src.startsWith("blob:") || src.startsWith("data:") || useMaster) {
    return <img className={className} src={src} alt={alt} width={width} height={height} loading={loading} onClick={onClick} />;
  }
  const presetInfo = PRESET[preset];
  const srcSet = presetInfo.srcSet
    .split(", ")
    .filter(Boolean)
    .map((item) => {
      const [name, widthLabel] = item.split(" ");
      return `${variantImagePath(src, name as "c320" | "c640" | "w960")} ${widthLabel}`;
    })
    .join(", ");
  return (
    <img
      className={className}
      src={variantImagePath(src, presetInfo.src)}
      srcSet={srcSet || undefined}
      sizes={srcSet ? presetInfo.sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      onClick={onClick}
      onError={() => setUseMaster(true)}
    />
  );
}
