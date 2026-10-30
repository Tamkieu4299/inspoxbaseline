import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api";
import { useCart } from "../cart/CartContext";
import { useLanguage } from "../i18n";
import { useStoreCurrency } from "../useStoreCurrency";

export default function CheckoutPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { formatPrice } = useStoreCurrency();
  const { lines, subtotal, clearCart } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [note, setNote] = useState("");

  const placeOrder = useMutation({
    mutationFn: () =>
      api.createOrder({
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        shipping_address: shippingAddress,
        note: note || null,
        items: lines.map((l) => ({
          product_id: l.productId,
          quantity: l.quantity,
          color: l.color || null,
          size: l.size || null,
        })),
      }),
    onSuccess: (res) => {
      clearCart();
      navigate(`/orders/thank-you?order=${encodeURIComponent(res.order_number)}`, { replace: true });
    },
  });

  if (lines.length === 0) {
    return (
      <main className="px-4 sm:px-8 py-12 max-w-lg mx-auto text-center">
        <p className="font-body text-body-md text-secondary mb-4">{t("cart.empty")}</p>
        <Link to="/products" className="text-forest-green underline">
          {t("cart.continueShopping")}
        </Link>
      </main>
    );
  }

  return (
    <main className="px-4 sm:px-8 lg:px-stack-xl py-12 max-w-4xl mx-auto">
      <h1 className="font-headline text-headline-lg text-primary uppercase mb-8">{t("checkout.title")}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            placeOrder.mutate();
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="font-label text-label-caps text-primary uppercase">{t("checkout.name")} *</span>
            <input
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="border border-outline-variant px-3 py-2 font-body text-body-md"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label text-label-caps text-primary uppercase">{t("checkout.phone")} *</span>
            <input
              required
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="border border-outline-variant px-3 py-2 font-body text-body-md"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label text-label-caps text-primary uppercase">{t("checkout.email")}</span>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="border border-outline-variant px-3 py-2 font-body text-body-md"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label text-label-caps text-primary uppercase">{t("checkout.address")} *</span>
            <textarea
              required
              rows={3}
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              className="border border-outline-variant px-3 py-2 font-body text-body-md"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label text-label-caps text-primary uppercase">{t("checkout.note")}</span>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="border border-outline-variant px-3 py-2 font-body text-body-md"
            />
          </label>
          <p className="font-body text-body-sm text-secondary">{t("checkout.codHint")}</p>
          {placeOrder.isError ? (
            <p className="text-status-danger font-body text-body-sm">{t("checkout.error")}</p>
          ) : null}
          <button
            type="submit"
            disabled={placeOrder.isPending}
            className="bg-forest-green text-white font-label text-label-caps py-3 uppercase hover:bg-inverse-surface transition-colors disabled:opacity-50"
          >
            {placeOrder.isPending ? t("checkout.placing") : t("checkout.placeOrder")}
          </button>
        </form>
        <div className="border border-outline-variant p-6 bg-surface-container-low h-fit">
          <h2 className="font-headline text-headline-md text-primary uppercase mb-4">{t("checkout.summary")}</h2>
          <ul className="flex flex-col gap-2 mb-4">
            {lines.map((l) => (
              <li key={`${l.productId}-${l.color}-${l.size}`} className="font-body text-body-sm text-secondary flex justify-between gap-2">
                <span>
                  {l.name} × {l.quantity}
                </span>
                <span>{formatPrice(l.price * l.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="font-headline text-headline-md text-primary uppercase border-t border-outline-variant pt-4">
            {t("cart.subtotal")}: {formatPrice(subtotal)}
          </p>
        </div>
      </div>
    </main>
  );
}
