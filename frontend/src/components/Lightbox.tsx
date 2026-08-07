import { useCallback, useEffect, useState } from "react";
import Icon from "./Icon";
import { useLanguage } from "../i18n";
import type { GalleryImage } from "./ProductGallery";

interface Props {
  images: GalleryImage[];
  name: string;
  startIndex: number;
  onClose: () => void;
}

export default function Lightbox({ images, name, startIndex, onClose }: Props) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(startIndex);

  const prev = useCallback(
    () => setIndex((i) => (i - 1 + images.length) % images.length),
    [images.length]
  );
  const next = useCallback(
    () => setIndex((i) => (i + 1) % images.length),
    [images.length]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [prev, next, onClose]);

  const img = images[index];

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center select-none"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("lightbox.close")}
        className="absolute top-4 right-4 z-10 text-white/90 hover:text-white p-2"
      >
        <Icon name="close" className="text-[32px]" />
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            aria-label={t("lightbox.prev")}
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-4 z-10 text-white/90 hover:text-white p-2"
          >
            <Icon name="chevron_left" className="text-[48px]" />
          </button>
          <button
            type="button"
            aria-label={t("lightbox.next")}
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-4 z-10 text-white/90 hover:text-white p-2"
          >
            <Icon name="chevron_right" className="text-[48px]" />
          </button>
        </>
      )}

      {img && (
        <img
          src={img.url}
          alt={img.alt || name}
          onClick={(e) => e.stopPropagation()}
          className="max-w-[90vw] max-h-[85vh] object-contain"
        />
      )}

      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 font-label text-label-caps">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
