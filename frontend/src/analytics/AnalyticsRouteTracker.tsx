import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "./track";

export default function AnalyticsRouteTracker() {
  const location = useLocation();
  const lastPath = useRef("");

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    if (path === lastPath.current) return;
    lastPath.current = path;
    trackPageView(path);
  }, [location.pathname, location.search]);

  return null;
}