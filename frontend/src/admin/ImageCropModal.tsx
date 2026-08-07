import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { useLanguage } from "../i18n";
import { PrimaryButton, SecondaryButton, Select } from "./ui";

const ASPECTS = [
  { key: "admin.aspect3x4", value: 3 / 4 },
  { key: "admin.aspect4x5", value: 4 / 5 },
  { key: "admin.aspect1x1", value: 1 },
  { key: "admin.aspect16x9", value: 16 / 9 },
  { key: "admin.aspectFree", value: 0 },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for cropping (cross-origin image may not be crop-able)."));
    img.src = src;
  });
}

export async function cropImageToBlob(
  src: string,
  area: Area,
  aspect?: number
): Promise<Blob> {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width);
  canvas.height = Math.round(area.height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Crop failed — image may be cross-origin."))),
      "image/jpeg",
      0.92
    )
  );
}

export async function fitImageToBlob(
  src: string,
  aspect?: number,
  bg: string = "#ffffff"
): Promise<Blob> {
  const image = await loadImage(src);
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;

  let boxW = iw;
  let boxH = ih;
  if (aspect && aspect > 0) {
    if (iw / ih >= aspect) {
      boxW = iw;
      boxH = iw / aspect;
    } else {
      boxW = ih * aspect;
      boxH = ih;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(boxW);
  canvas.height = Math.round(boxH);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, (canvas.width - iw) / 2, (canvas.height - ih) / 2, iw, ih);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Fit failed — image may be cross-origin."))),
      "image/jpeg",
      0.92
    )
  );
}

export default function ImageCropModal({
  src,
  title = "EDIT IMAGE",
  onComplete,
  onClose,
}: {
  src: string;
  title?: string;
  onComplete: (blob: Blob) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectValue, setAspectValue] = useState(3 / 4);
  const [mode, setMode] = useState<"crop" | "fit">("crop");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback(
    (_: Area, areaPixels: Area) => setCroppedArea(areaPixels),
    []
  );

  async function handleCrop() {
    setProcessing(true);
    setError(null);
    try {
      let blob: Blob;
      if (mode === "fit") {
        blob = await fitImageToBlob(src, aspectValue || undefined, bgColor);
      } else {
        if (!croppedArea) return;
        blob = await cropImageToBlob(src, croppedArea, aspectValue || undefined);
      }
      onComplete(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background w-full max-w-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-surface-container-high">
          <h3 className="font-headline text-headline-md text-primary uppercase">{title}</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-label text-label-caps text-secondary uppercase">{t("admin.mode")}</span>
              <Select
                value={mode}
                onChange={(e) => setMode(e.target.value as "crop" | "fit")}
                className="py-1"
              >
                <option value="crop">{t("admin.cropFillFrame")}</option>
                <option value="fit">{t("admin.fitWholeImage")}</option>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-label text-label-caps text-secondary uppercase">{t("admin.aspect")}</span>
              <Select
                value={aspectValue}
                onChange={(e) => setAspectValue(Number(e.target.value))}
                className="py-1"
              >
                {ASPECTS.map((a) => (
                  <option key={a.key} value={a.value}>
                    {t(a.key)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
        {mode === "fit" ? (
          <div className="relative w-full h-[420px] bg-black flex items-center justify-center overflow-auto">
            <div
              className="max-w-full max-h-full"
              style={{
                aspectRatio: aspectValue > 0 ? String(aspectValue) : undefined,
                backgroundColor: bgColor,
              }}
            >
              <img src={src} alt="Fit preview" className="w-full h-full object-contain" />
            </div>
          </div>
        ) : (
          <div className="relative w-full h-[420px] bg-black">
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspectValue || undefined}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              minZoom={1}
              maxZoom={4}
            />
          </div>
        )}
        <div className="flex items-center justify-between p-4 border-t border-surface-container-high">
          {mode === "fit" ? (
            <div className="flex items-center gap-3">
              <span className="font-label text-label-caps text-secondary uppercase">{t("admin.bg")}</span>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="h-[38px] w-12 p-1 bg-white border border-surface-container-highest"
              />
              <span className="font-label text-label-caps text-secondary uppercase">{t("admin.paddingColor")}</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="font-label text-label-caps text-secondary uppercase">{t("admin.zoom")}</span>
              <input
                type="range"
                min={1}
                max={4}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-40 accent-forest-green"
              />
            </div>
          )}
          <div className="flex gap-2">
            <SecondaryButton onClick={onClose} disabled={processing}>
              {t("admin.cancel")}
            </SecondaryButton>
            <PrimaryButton
              onClick={handleCrop}
              disabled={processing || (mode === "crop" && !croppedArea)}
            >
              {processing ? t("admin.processing") : mode === "fit" ? t("admin.saveImage") : t("admin.cropAndSave")}
            </PrimaryButton>
          </div>
        </div>
        {error && <p className="px-4 pb-4 text-error text-sm">{error}</p>}
      </div>
    </div>
  );
}
