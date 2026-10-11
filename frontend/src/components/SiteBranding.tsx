import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export default function SiteBranding() {
  const { data } = useQuery({ queryKey: ["site"], queryFn: api.getSite });

  useEffect(() => {
    if (!data) return;
    if (data.site_name) document.title = data.site_name;
    if (data.favicon_url) {
      document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']").forEach((el) => el.remove());
      const link = document.createElement("link");
      link.rel = "icon";
      const url = data.favicon_url.toLowerCase();
      if (url.includes(".svg")) link.type = "image/svg+xml";
      else if (url.includes(".png") || url.includes("image/png")) link.type = "image/png";
      else if (url.includes(".webp")) link.type = "image/webp";
      link.href = data.favicon_url;
      document.head.appendChild(link);
    }
  }, [data]);

  return null;
}
