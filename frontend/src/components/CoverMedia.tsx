import { slideIsVideo, type HeroSlide } from "../mediaUtils";
import { isVideoMedia } from "../mediaUtils";
import type { Media } from "../types";

type CoverMediaProps = {
  url?: string | null;
  media?: Media | null;
  slide?: HeroSlide | null;
  className?: string;
  videoClassName?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
};

/** Full-bleed cover image or autoplay video (collections, bento, heroes). */
export default function CoverMedia({
  url,
  media,
  slide,
  className = "absolute inset-0 bg-cover bg-center",
  videoClassName = "absolute inset-0 w-full h-full object-cover",
  autoPlay = true,
  loop = true,
  muted = true,
}: CoverMediaProps) {
  const resolvedUrl = slide?.url || media?.url || url || "";
  if (!resolvedUrl) return null;

  const isVideo =
    slide != null
      ? slideIsVideo(slide)
      : media
        ? isVideoMedia(media)
        : /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(resolvedUrl.split("?")[0]);

  if (isVideo) {
    return (
      <video
        className={videoClassName}
        src={resolvedUrl}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        playsInline
        preload="metadata"
      />
    );
  }

  return <div className={className} style={{ backgroundImage: `url('${resolvedUrl}')` }} />;
}
