import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { Media } from "../types";
import ImageCropModal from "./ImageCropModal";
import { DangerButton, PrimaryButton, SecondaryButton } from "./ui";

export function useMedia() {
  return useQuery({ queryKey: ["admin-media"], queryFn: adminApi.getMedia });
}

function UploadButton({ onDone }: { onDone: (m: Media) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; preview: string } | null>(null);

  const mutation = useMutation({
    mutationFn: (file: File | Blob) => adminApi.uploadMedia(file),
    onSuccess: (media) => {
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      onDone(media);
    },
  });

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setPendingFile({ file, preview: URL.createObjectURL(file) });
          }
          e.target.value = "";
        }}
      />
      <PrimaryButton onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? t("admin.uploading") : t("admin.uploadImage")}
      </PrimaryButton>
      {pendingFile && (
        <ImageCropModal
          src={pendingFile.preview}
          title={t("admin.editUpload")}
          onClose={() => {
            URL.revokeObjectURL(pendingFile.preview);
            setPendingFile(null);
          }}
          onComplete={async (blob) => {
            URL.revokeObjectURL(pendingFile.preview);
            setPendingFile(null);
            setUploading(true);
            await mutation.mutateAsync(blob, {
              onSettled: () => setUploading(false),
            });
          }}
        />
      )}
      {mutation.isError && <p className="text-error text-sm mt-2">{String(mutation.error)}</p>}
    </div>
  );
}

export function MediaLibrary({ onSelect }: { onSelect?: (m: Media) => void }) {
  const { data: media, isLoading } = useMedia();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [cropTarget, setCropTarget] = useState<Media | null>(null);
  const [cropping, setCropping] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteMedia,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-media"] }),
  });
  const replaceMutation = useMutation({
    mutationFn: ({ id, file }: { id: number; file: Blob }) => adminApi.replaceMedia(id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-media"] }),
  });

  if (isLoading) return <p className="font-body text-body-md text-secondary">{t("admin.loadingMedia")}</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-headline text-headline-md text-primary uppercase">{t("admin.mediaLibrary")}</h3>
        <UploadButton onDone={(m) => onSelect?.(m)} />
      </div>
      {(!media || media.length === 0) && (
        <p className="font-body text-body-md text-secondary">
          {t("admin.noMedia")}
        </p>
      )}
      {deleteMutation.isError && (
        <p className="font-body text-body-md text-error mb-3">
          {t("admin.deleteFailed")} {deleteMutation.error instanceof Error ? deleteMutation.error.message : String(deleteMutation.error)}
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {media?.map((m) => (
          <div key={m.id} className="group relative border border-surface-container-highest bg-white p-2 flex flex-col">
            <img src={m.url} alt={m.filename} className="w-full h-32 object-cover mb-2" loading="lazy" />
            <p className="font-body text-body-md text-secondary text-xs truncate" title={m.filename}>
              {m.filename}
            </p>
            <div className="flex items-center justify-between mt-1">
              {onSelect ? (
                <button
                  onClick={() => onSelect(m)}
                  className="font-label text-label-caps text-forest-green hover:underline uppercase"
                >
                  {t("admin.selectShort")}
                </button>
              ) : (
                <span className="text-xs" />
              )}
              <button
                onClick={() => setCropTarget(m)}
                className="font-label text-label-caps text-forest-green hover:underline uppercase opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {t("admin.crop")}
              </button>
              <button
                onClick={() => deleteMutation.mutate(m.id)}
                className="font-label text-label-caps text-error hover:underline uppercase opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {t("admin.delete")}
              </button>
            </div>
          </div>
        ))}
      </div>
      {cropTarget && (
        <ImageCropModal
          src={cropTarget.url}
          title={t("admin.editImageInPlace")}
          onClose={() => setCropTarget(null)}
          onComplete={async (blob) => {
            setCropping(true);
            try {
              await replaceMutation.mutateAsync({ id: cropTarget.id, file: blob });
            } catch {
              alert(t("admin.replaceFailed"));
            } finally {
              setCropping(false);
              setCropTarget(null);
            }
          }}
        />
      )}
      {cropping && <p className="font-body text-body-md text-secondary mt-2">{t("admin.saving")}</p>}
    </div>
  );
}

export function MediaPicker({
  onSelect,
  onClose,
}: {
  onSelect: (m: Media) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-background w-full max-w-3xl max-h-[85vh] overflow-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline text-headline-md text-primary uppercase">{t("admin.selectMedia")}</h3>
          <SecondaryButton onClick={onClose}>{t("admin.close")}</SecondaryButton>
        </div>
        <MediaLibrary
          onSelect={(m) => {
            onSelect(m);
            onClose();
          }}
        />
      </div>
    </div>
  );
}

export function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: Media | null;
  onChange: (m: Media | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-1">
      <span className="font-label text-label-caps text-secondary uppercase">{label}</span>
      {value ? (
        <div className="flex items-center gap-3 border border-surface-container-highest bg-white p-2">
          <img src={value.url} alt={value.filename} className="w-16 h-16 object-cover" />
          <div className="flex flex-col gap-1">
            <span className="font-body text-body-md text-on-background text-xs truncate max-w-[200px]">
              {value.filename}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(true)}
                className="font-label text-label-caps text-forest-green hover:underline uppercase"
              >
                {t("admin.change")}
              </button>
              <button
                onClick={() => onChange(null)}
                className="font-label text-label-caps text-error hover:underline uppercase"
              >
                {t("admin.clear")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <SecondaryButton onClick={() => setOpen(true)}>{t("admin.chooseImage")}</SecondaryButton>
      )}
      {open && <MediaPicker onSelect={onChange} onClose={() => setOpen(false)} />}
    </div>
  );
}
