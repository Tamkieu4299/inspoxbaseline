import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export default function SiteBranding() {
  const { data } = useQuery({ queryKey: ["site"], queryFn: api.getSite });

  useEffect(() => {
    if (!data) return;
    if (data.site_name) document.title = data.site_name;
    if (data.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = data.favicon_url;
    }
  }, [data]);

  return null;
}
