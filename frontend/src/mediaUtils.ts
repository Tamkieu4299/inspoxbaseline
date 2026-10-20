import type { Media } from "./types";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i;

export function isVideoFile(file: Pick<File, "type" | "name">): boolean {
  if ((file.type || "").toLowerCase().startsWith("video/")) return true;
  return VIDEO_EXT.test(file.name || "");
}

export function isVideoMedia(m: Pick<Media, "content_type" | "url"> | null | undefined): boolean {
  if (!m) return false;
  const ct = (m.content_type || "").toLowerCase();
  if (ct.startsWith("video/")) return true;
  const path = (m.url || "").split("?")[0];
  return VIDEO_EXT.test(path);
}

export function mediaKind(m: Pick<Media, "content_type" | "url"> | null | undefined): "video" | "image" | null {
  if (!m?.url) return null;
  return isVideoMedia(m) ? "video" : "image";
}

export type HeroSlide = { url: string; media_type?: "video" | "image" | null };

export function slideIsVideo(slide: HeroSlide): boolean {
  if (slide.media_type === "video") return true;
  if (slide.media_type === "image") return false;
  const path = (slide.url || "").split("?")[0].toLowerCase();
  return /\.(mp4|webm|mov|m4v|ogg)$/.test(path);
}
