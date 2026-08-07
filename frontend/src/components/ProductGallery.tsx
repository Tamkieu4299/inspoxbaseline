import { useCallback, useEffect, useState } from "react";
import Icon from "./Icon";

export type GalleryLayout = "collage" | "grid" | "masonry" | "slideshow";

const LAYOUTS: GalleryLayout[] = ["collage", "grid", "masonry", "slideshow"];

export function isGalleryLayout(v: unknown): v is GalleryLayout {
  return typeof v === "string" && (LAYOUTS as string[]).includes(v);
}

export interface GalleryImage {
  id?: number;
  media_id?: number | null;
  url: string;
  alt?: string | null;
  position?: number;
  enabled?: boolean;
}

interface Props {
  images: GalleryImage[];
  name: string;
  layout?: string | null;
  onImageClick?: (index: number) => void;
}

export default function ProductGallery({ images, name, layout, onImageClick }: Props) {
  const mode = isGalleryLayout(layout) ? layout : "collage";
  const visible = images.filter((i) => i.enabled !== false);

  if (!visible.length) {
    return <div className="w-full aspect-[4/5] bg-surface-container-low" />;
  }

  switch (mode) {
    case "grid":
      return <Grid images={visible} name={name} onImageClick={onImageClick} />;
    case "masonry":
      return <Masonry images={visible} name={name} onImageClick={onImageClick} />;
    case "slideshow":
      return <Slideshow images={visible} name={name} onImageClick={onImageClick} />;
    default:
      return <Collage images={visible} name={name} onImageClick={onImageClick} />;
  }
}

function keyOf(img: GalleryImage, index: number) {
  return img.id ?? img.media_id ?? index;
}

function Img({
  img,
  name,
  index,
  onImageClick,
  className = "",
}: {
  img: GalleryImage;
  name: string;
  index: number;
  onImageClick?: (index: number) => void;
  className?: string;
}) {
  if (onImageClick) {
    return (
      <button
        type="button"
        onClick={() => onImageClick(index)}
        className={`block w-full h-full bg-surface-container-low overflow-hidden cursor-pointer p-0 border-0 ${className}`}
      >
        <img src={img.url} alt={img.alt || name} className="w-full h-full object-cover" />
      </button>
    );
  }
  return (
    <div className={`bg-surface-container-low overflow-hidden ${className}`}>
      <img src={img.url} alt={img.alt || name} className="w-full h-full object-cover" />
    </div>
  );
}

function Collage({
  images,
  name,
  onImageClick,
}: {
  images: GalleryImage[];
  name: string;
  onImageClick?: (index: number) => void;
}) {
  const n = images.length;

  if (n === 1) {
    return (
      <Img img={images[0]} name={name} index={0} onImageClick={onImageClick} className="w-full aspect-[4/5]" />
    );
  }

  if (n === 2) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {images.map((img, i) => (
          <Img key={keyOf(img, i)} img={img} name={name} index={i} onImageClick={onImageClick} className="w-full aspect-[4/5]" />
        ))}
      </div>
    );
  }

  if (n === 3) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 auto-rows-fr gap-3 h-[520px] md:h-[620px]">
        <div className="row-span-2">
          <Img img={images[0]} name={name} index={0} onImageClick={onImageClick} className="w-full h-full" />
        </div>
        {images.slice(1).map((img, i) => (
          <Img key={keyOf(img, i + 1)} img={img} name={name} index={i + 1} onImageClick={onImageClick} className="w-full h-full" />
        ))}
      </div>
    );
  }

  if (n === 4) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {images.map((img, i) => (
          <Img key={keyOf(img, i)} img={img} name={name} index={i} onImageClick={onImageClick} className="w-full aspect-[4/5]" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {images.map((img, i) => (
        <Img key={keyOf(img, i)} img={img} name={name} index={i} onImageClick={onImageClick} className="w-full aspect-[4/5]" />
      ))}
    </div>
  );
}

function Grid({
  images,
  name,
  onImageClick,
}: {
  images: GalleryImage[];
  name: string;
  onImageClick?: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {images.map((img, i) => (
        <Img key={keyOf(img, i)} img={img} name={name} index={i} onImageClick={onImageClick} className="w-full aspect-[4/5]" />
      ))}
    </div>
  );
}

function Masonry({
  images,
  name,
  onImageClick,
}: {
  images: GalleryImage[];
  name: string;
  onImageClick?: (index: number) => void;
}) {
  return (
    <div className="columns-2 md:columns-3 gap-3">
      {images.map((img, i) => (
        <div key={keyOf(img, i)} className="break-inside-avoid mb-3">
          {onImageClick ? (
            <button
              type="button"
              onClick={() => onImageClick(i)}
              className="block w-full bg-surface-container-low overflow-hidden cursor-pointer p-0 border-0"
            >
              <img src={img.url} alt={img.alt || name} className="w-full h-auto object-cover" />
            </button>
          ) : (
            <div className="bg-surface-container-low overflow-hidden">
              <img src={img.url} alt={img.alt || name} className="w-full h-auto object-cover" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Slideshow({
  images,
  name,
  onImageClick,
}: {
  images: GalleryImage[];
  name: string;
  onImageClick?: (index: number) => void;
}) {
  const [active, setActive] = useState(0);

  const prev = useCallback(
    () => setActive((a) => (a - 1 + images.length) % images.length),
    [images.length]
  );
  const next = useCallback(
    () => setActive((a) => (a + 1) % images.length),
    [images.length]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full aspect-[4/5] bg-surface-container-low overflow-hidden group">
        {onImageClick ? (
          <button
            type="button"
            onClick={() => onImageClick(active)}
            className="block w-full h-full cursor-pointer p-0 border-0"
          >
            <img
              src={images[active].url}
              alt={images[active].alt || name}
              className="w-full h-full object-cover"
            />
          </button>
        ) : (
          <img
            src={images[active].url}
            alt={images[active].alt || name}
            className="w-full h-full object-cover"
          />
        )}
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 text-white hover:bg-black/70 transition-colors p-2"
            >
              <Icon name="chevron_left" className="text-[28px]" />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 text-white hover:bg-black/70 transition-colors p-2"
            >
              <Icon name="chevron_right" className="text-[28px]" />
            </button>
          </>
        )}
      </div>
      <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
        {images.map((img, i) => (
          <button
            key={keyOf(img, i)}
            type="button"
            onClick={() => setActive(i)}
            className={`aspect-square bg-surface-container-low overflow-hidden border-2 transition-colors ${
              i === active ? "border-forest-green" : "border-transparent hover:border-outline-variant"
            }`}
          >
            <img src={img.url} alt={img.alt || name} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
