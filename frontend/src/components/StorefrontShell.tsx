import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import FloatingContactBar from "./FloatingContactBar";
import Footer from "./Footer";
import Navbar from "./Navbar";
import PageLoader from "./PageLoader";

export default function StorefrontShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data: site, isFetched } = useQuery({
    queryKey: ["site"],
    queryFn: () => api.getSite(),
    staleTime: 60_000,
  });

  const [bootDone, setBootDone] = useState(false);

  useEffect(() => {
    if (!isFetched) return;
    const t = window.setTimeout(() => setBootDone(true), 550);
    return () => window.clearTimeout(t);
  }, [isFetched]);

  const showLoader = !bootDone;

  return (
    <>
      <PageLoader visible={showLoader} logoUrl={site?.logo_url} siteName={site?.site_name} />
      <div
        className={`bg-surface-container-lowest text-on-surface font-body text-body-md antialiased overflow-x-hidden selection:bg-forest-green selection:text-white min-h-screen flex flex-col ${
          showLoader ? "max-h-screen overflow-hidden" : ""
        }`}
      >
        <Navbar />
        <div key={location.pathname} className="flex-grow flex flex-col motion-safe:animate-page-enter">
          {children}
        </div>
        <Footer />
        <FloatingContactBar />
      </div>
    </>
  );
}
