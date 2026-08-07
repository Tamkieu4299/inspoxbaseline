import { useParams } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import Icon from "../components/Icon";
import Lightbox from "../components/Lightbox";
import ProductGallery from "../components/ProductGallery";
import { useLanguage } from "../i18n";

export default function ProductDetail() {
  const { lang, t } = useLanguage();
  const { slug = "" } = useParams();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug, lang],
    queryFn: () => api.getProduct(slug, lang),
  });

  if (isLoading || !product) {
    return (
      <main className="pt-20 max-w-[1440px] mx-auto px-8 py-16">
        <p className="font-body text-body-md text-secondary">{t("loading")}</p>
      </main>
    );
  }

  const images = product.images?.length ? product.images : [];

  return (
    <>
      <main className="max-w-[1440px] mx-auto px-6 md:px-8 py-24">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-16">
        {/* Gallery */}
        <div className="md:col-span-7">
          <ProductGallery
            images={images}
            name={product.name}
            layout={product.gallery_layout}
            onImageClick={(index) => setLightboxIndex(index)}
          />
        </div>

        {/* Info */}
        <div className="md:col-span-5 flex flex-col md:pl-4 pt-8 md:pt-0">
          {product.badge && (
            <div className="mb-4">
              <span className="font-label text-label-caps bg-primary text-on-primary px-2 py-1 uppercase tracking-widest inline-block">
                {product.badge}
              </span>
            </div>
          )}
          <h1 className="font-display text-display-lg-mobile md:text-display-lg text-primary uppercase mb-1 tracking-tighter">
            {product.name}
          </h1>
          {product.description && (
            <p className="font-body text-body-md text-on-background opacity-80 mb-6 max-w-md">
              {product.description}
            </p>
          )}

          {/* Tech Specs */}
          {product.tech_specs?.length > 0 && (
            <div className="border-t border-outline-variant pt-4 mt-1">
              <h3 className="font-label text-label-caps text-primary uppercase mb-2">
                {t("product.techSpecs")}
              </h3>
              <ul className="flex flex-col gap-2">
                {product.tech_specs.map((spec, index) => (
                  <li key={index} className="flex justify-between border-b border-surface-container-high pb-2">
                    <span className="font-body text-body-md text-secondary">{spec.label}</span>
                    <span className="font-label text-label-caps text-primary">{spec.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Features */}
      {product.features?.length > 0 && (
        <section className="py-16 my-16 border-t border-outline-variant">
          <h2 className="font-headline text-headline-lg-mobile md:text-headline-lg text-primary uppercase text-center mb-16 tracking-tighter">
            {t("product.engineered")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {product.features.map((feature, index) => (
              <div
                key={index}
                className="bg-surface p-8 flex flex-col border border-transparent hover:border-outline-variant transition-colors duration-300"
              >
                {feature.icon && <Icon name={feature.icon} className="text-[48px] text-primary mb-4" />}
                <h4 className="font-headline text-headline-md text-primary uppercase mb-2">
                  {feature.title}
                </h4>
                <p className="font-body text-body-md text-secondary">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      </main>
      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          name={product.name}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
