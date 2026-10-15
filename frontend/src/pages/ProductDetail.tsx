import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import Icon from "../components/Icon";
import Lightbox from "../components/Lightbox";
import ProductGallery, { isGalleryLayout } from "../components/ProductGallery";
import { ProductDescription, ProductTechSpecList } from "../components/ProductStoryAndSpecs";
import { useLanguage } from "../i18n";
import { useStoreCurrency } from "../useStoreCurrency";
import {
  canPurchaseWithVariants,
  colorDisplayName,
  enabledProductImages,
  firstImageIndexForColorway,
  getProductVariantOptions,
} from "../productDisplay";

export default function ProductDetail() {
  const { lang, t } = useLanguage();
  const { formatPrice } = useStoreCurrency();
  const { slug = "" } = useParams();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug, lang],
    queryFn: () => api.getProduct(slug, lang),
  });

  const variantOptions = useMemo(
    () => (product ? getProductVariantOptions(product) : null),
    [product]
  );
  const { colors, sizes, hasColors, hasSizes } = variantOptions ?? {
    colors: [],
    sizes: [],
    hasColors: false,
    hasSizes: false,
  };

  const selectedColor =
    hasColors && selectedColorIndex != null && selectedColorIndex >= 0
      ? colors[selectedColorIndex] ?? null
      : null;

  const galleryImages = useMemo(
    () => (product ? enabledProductImages(product.images) : []),
    [product]
  );

  const galleryFocusIndex = useMemo(() => {
    if (!product || !selectedColor?.name) return undefined;
    const idx = firstImageIndexForColorway(product.images, selectedColor.name);
    return idx ?? undefined;
  }, [product, selectedColor?.name]);

  const galleryLayout = product?.gallery_layout;
  const isSlideshowGallery = isGalleryLayout(galleryLayout) && galleryLayout === "slideshow";

  useEffect(() => {
    setSelectedColorIndex(null);
    setSelectedSize(null);
    setLightboxIndex(null);
  }, [slug, product?.id]);

  function selectColorway(idx: number) {
    setSelectedColorIndex(idx);
    const colorName = colors[idx]?.name;
    if (!colorName || !product) return;
    const imageIdx = firstImageIndexForColorway(product.images, colorName);
    if (imageIdx == null) return;
    if (isSlideshowGallery) return;
    setLightboxIndex(imageIdx);
  }

  if (isLoading || !product) {
    return (
      <main className="pt-20 max-w-[1440px] mx-auto px-8 py-16">
        <p className="font-body text-body-md text-secondary">{t("loading")}</p>
      </main>
    );
  }

  const canAddToCart = variantOptions
    ? canPurchaseWithVariants(variantOptions, { size: selectedSize })
    : false;

  return (
    <>
      <main className="max-w-[1440px] mx-auto px-6 md:px-8 py-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-16">
          <div className="md:col-span-7">
            <ProductGallery
              images={galleryImages}
              name={product.name}
              layout={product.gallery_layout}
              activeIndex={galleryFocusIndex}
              onImageClick={(index) => setLightboxIndex(index)}
            />
          </div>

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
            {product.subtitle && (
              <p className="font-body text-body-md text-secondary max-w-2xl leading-relaxed mb-2">{product.subtitle}</p>
            )}
            <p className="font-headline text-headline-md text-primary mb-4">{formatPrice(Number(product.price) || 0)}</p>
            <ProductDescription description={product.description} />

            {hasColors && (
              <div className="mb-8">
                <h3 className="font-label text-label-caps text-primary mb-2 uppercase">
                  {t("product.colorway")}
                  {selectedColor ? `: ${colorDisplayName(selectedColor, lang).toUpperCase()}` : ""}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c, idx) => {
                    const active = selectedColorIndex === idx;
                    return (
                      <button
                        key={`${c.name}-${idx}`}
                        type="button"
                        aria-label={colorDisplayName(c, lang)}
                        aria-pressed={active}
                        onClick={() => selectColorway(idx)}
                        className={`w-12 h-12 border-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors ${
                          active ? "border-primary" : "border-outline hover:border-primary"
                        }`}
                        style={{ backgroundColor: c.hex || "#eee" }}
                        title={colorDisplayName(c, lang)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {hasSizes && (
              <div className="mb-8">
                <div className="flex justify-between items-end mb-2">
                  <h3 className="font-label text-label-caps text-primary uppercase">{t("product.size")}</h3>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {sizes.map((size) => {
                    const active = selectedSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`py-2 border font-body text-body-md transition-colors ${
                          active
                            ? "border-primary bg-primary text-on-primary"
                            : "border-outline text-primary hover:border-primary hover:bg-surface-container"
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!canAddToCart && hasSizes ? (
              <p className="font-body text-body-sm text-secondary mb-2">{t("product.selectSizeHint")}</p>
            ) : null}
            <button
              type="button"
              disabled={!canAddToCart}
              className="w-full bg-primary text-on-primary font-label text-label-caps uppercase py-4 mb-8 hover:bg-inverse-surface transition-colors tracking-widest flex justify-center items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("product.addToCart")} <Icon name="arrow_forward" className="text-[20px]" />
            </button>

            <ProductTechSpecList techSpecs={product.tech_specs} />
          </div>
        </div>

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
                  <h4 className="font-headline text-headline-md text-primary uppercase mb-2">{feature.title}</h4>
                  <p className="font-body text-body-md text-secondary">{feature.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
      {lightboxIndex !== null && (
        <Lightbox
          images={galleryImages}
          name={product.name}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
