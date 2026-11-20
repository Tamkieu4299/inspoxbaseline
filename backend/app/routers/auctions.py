"""Auction listings and bids (tenant-gated)."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..auction_service import (
    close_lot,
    compute_lot_public_fields,
    ensure_bidding_enabled,
    lot_time_state,
    place_bid,
)
from ..database import get_db
from ..models import AuctionBid, AuctionLot, Product, SiteSettings, Tenant
from ..schemas import (
    AuctionBidAdminOut,
    AuctionBidIn,
    AuctionBidPlacedOut,
    AuctionBidPublicOut,
    AuctionLotAdminOut,
    AuctionLotBaseIn,
    AuctionLotDetailOut,
    AuctionLotSummaryOut,
    ProductImageOut,
)
from ..security import AdminDep, get_tenant

public_router = APIRouter(prefix="/api/auctions", tags=["auctions"])
admin_router = APIRouter(prefix="/api/admin/auctions", tags=["admin-auctions"])


def _product_image(product: Product) -> str | None:
    for img in sorted(product.images or [], key=lambda i: i.position):
        if img.enabled and img.url:
            return img.url
    return None


def _summary(lot: AuctionLot, product: Product, lang: str) -> AuctionLotSummaryOut:
    fields = compute_lot_public_fields(lot)
    name = product.name_vi if lang == "vi" and product.name_vi else product.name
    headline = lot.headline_vi if lang == "vi" and lot.headline_vi else lot.headline
    return AuctionLotSummaryOut(
        id=lot.id,
        product_slug=product.slug,
        product_name=name,
        image_url=_product_image(product),
        subtitle=product.subtitle_vi if lang == "vi" and product.subtitle_vi else product.subtitle,
        starting_bid=fields["starting_bid"],
        current_bid=fields["current_bid"],
        min_next_bid=fields["min_next_bid"],
        ends_at=lot.ends_at,
        state=fields["state"],
        bid_count=fields["bid_count"],
        headline=headline,
    )


def _mask_bidder(name: str) -> str:
    parts = name.strip().split()
    if not parts:
        return "—"
    if len(parts) == 1:
        return parts[0][:1] + "***"
    return f"{parts[0]} {parts[-1][:1]}***"


@public_router.get("", response_model=list[AuctionLotSummaryOut])
def list_auctions(
    lang: str = "en",
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant),
):
    try:
        ensure_bidding_enabled(db, tenant.id)
    except HTTPException:
        return []
    lots = db.scalars(
        select(AuctionLot)
        .where(
            AuctionLot.tenant_id == tenant.id,
            AuctionLot.is_published.is_(True),
            AuctionLot.status == "live",
        )
        .options(selectinload(AuctionLot.product).selectinload(Product.images), selectinload(AuctionLot.bids))
    ).all()
    out: list[AuctionLotSummaryOut] = []
    for lot in lots:
        if lot.product is None or not lot.product.is_active:
            continue
        if lot_time_state(lot) != "live":
            continue
        out.append(_summary(lot, lot.product, lang))
    out.sort(key=lambda x: x.ends_at or datetime.max)
    return out


@public_router.get("/{product_slug}", response_model=AuctionLotDetailOut)
def get_auction(
    product_slug: str,
    lang: str = "en",
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant),
):
    ensure_bidding_enabled(db, tenant.id)
    lot = db.scalar(
        select(AuctionLot)
        .join(Product, Product.id == AuctionLot.product_id)
        .where(
            AuctionLot.tenant_id == tenant.id,
            Product.slug == product_slug,
            AuctionLot.is_published.is_(True),
        )
        .options(
            selectinload(AuctionLot.product).selectinload(Product.images),
            selectinload(AuctionLot.bids),
        )
    )
    if lot is None or lot.product is None:
        raise HTTPException(status_code=404, detail="Auction not found")
    if lot_time_state(lot) not in ("live", "ended", "sold"):
        raise HTTPException(status_code=404, detail="Auction not found")

    product = lot.product
    fields = compute_lot_public_fields(lot)
    base = _summary(lot, product, lang)
    desc = product.description_vi if lang == "vi" and product.description_vi else product.description
    bids = sorted(lot.bids or [], key=lambda b: b.amount, reverse=True)[:20]
    recent = [
        AuctionBidPublicOut(
            id=b.id,
            amount=b.amount,
            bidder_name=_mask_bidder(b.bidder_name),
            created_at=b.created_at,
            status=b.status,
        )
        for b in bids
        if b.status != "rejected"
    ]
    return AuctionLotDetailOut(
        **base.model_dump(),
        description=desc,
        tech_specs=product.tech_specs or [],
        features=product.features or [],
        images=[
            ProductImageOut.model_validate(img)
            for img in sorted(product.images or [], key=lambda i: i.position)
            if img.enabled
        ],
        reserve_met=fields["reserve_met"],
        min_increment=fields["min_increment"],
        recent_bids=recent,
    )


@public_router.post("/{product_slug}/bids", response_model=AuctionBidPlacedOut)
def submit_bid(
    product_slug: str,
    payload: AuctionBidIn,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_tenant),
):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    if not payload.bidder_name.strip() or not payload.bidder_phone.strip():
        raise HTTPException(status_code=400, detail="Name and phone required")
    bid = place_bid(
        db,
        tenant_id=tenant.id,
        product_slug=product_slug,
        amount=float(payload.amount),
        bidder_name=payload.bidder_name,
        bidder_phone=payload.bidder_phone,
        bidder_email=payload.bidder_email,
    )
    lot = db.get(AuctionLot, bid.lot_id)
    if lot is None:
        raise HTTPException(status_code=500, detail="Lot missing after bid")
    min_next = (lot.current_bid_amount or 0) + float(lot.min_increment or 0)
    return AuctionBidPlacedOut(
        bid_id=bid.id,
        amount=bid.amount,
        min_next_bid=min_next,
        message="Bid recorded. This is not a binding purchase until Baseline confirms with you.",
        message_vi="Đã ghi nhận giá. Đây chưa phải cam kết mua cho đến khi Baseline xác nhận với bạn.",
    )


@admin_router.get("", response_model=list[AuctionLotAdminOut])
def admin_list_lots(db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    lots = db.scalars(
        select(AuctionLot)
        .where(AuctionLot.tenant_id == tenant.id)
        .options(selectinload(AuctionLot.product), selectinload(AuctionLot.bids))
        .order_by(AuctionLot.id.desc())
    ).all()
    out: list[AuctionLotAdminOut] = []
    for lot in lots:
        p = lot.product
        out.append(
            AuctionLotAdminOut(
                id=lot.id,
                product_id=lot.product_id,
                starting_bid=lot.starting_bid,
                min_increment=lot.min_increment,
                reserve_price=lot.reserve_price,
                ends_at=lot.ends_at,
                status=lot.status,
                is_published=lot.is_published,
                current_bid_amount=lot.current_bid_amount,
                headline=lot.headline,
                headline_vi=lot.headline_vi,
                created_at=lot.created_at,
                updated_at=lot.updated_at,
                product_slug=p.slug if p else None,
                product_name=p.name if p else None,
                bid_count=len(lot.bids or []),
            )
        )
    return out


@admin_router.post("", response_model=AuctionLotAdminOut)
def admin_create_lot(payload: AuctionLotBaseIn, db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    site = db.scalar(select(SiteSettings).where(SiteSettings.tenant_id == tenant.id))
    if site is None or not site.bidding_enabled:
        raise HTTPException(status_code=400, detail="Enable bidding in Site settings first")
    product = db.scalar(
        select(Product).where(Product.tenant_id == tenant.id, Product.id == payload.product_id)
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    existing = db.scalar(
        select(AuctionLot).where(AuctionLot.tenant_id == tenant.id, AuctionLot.product_id == product.id)
    )
    if existing is not None:
        raise HTTPException(status_code=400, detail="This product already has an auction lot")
    lot = AuctionLot(tenant_id=tenant.id, **payload.model_dump())
    db.add(lot)
    db.commit()
    db.refresh(lot)
    return AuctionLotAdminOut(
        id=lot.id,
        product_id=lot.product_id,
        starting_bid=lot.starting_bid,
        min_increment=lot.min_increment,
        reserve_price=lot.reserve_price,
        ends_at=lot.ends_at,
        status=lot.status,
        is_published=lot.is_published,
        current_bid_amount=lot.current_bid_amount,
        headline=lot.headline,
        headline_vi=lot.headline_vi,
        created_at=lot.created_at,
        updated_at=lot.updated_at,
        product_slug=product.slug,
        product_name=product.name,
        bid_count=0,
    )


@admin_router.put("/{lot_id}", response_model=AuctionLotAdminOut)
def admin_update_lot(
    lot_id: int, payload: AuctionLotBaseIn, db: Session = Depends(get_db), tenant: Tenant = AdminDep
):
    lot = db.scalar(
        select(AuctionLot)
        .where(AuctionLot.id == lot_id, AuctionLot.tenant_id == tenant.id)
        .options(selectinload(AuctionLot.product), selectinload(AuctionLot.bids))
    )
    if lot is None:
        raise HTTPException(status_code=404, detail="Lot not found")
    data = payload.model_dump()
    if data["product_id"] != lot.product_id:
        raise HTTPException(status_code=400, detail="Cannot change product on existing lot")
    for k, v in data.items():
        setattr(lot, k, v)
    db.commit()
    db.refresh(lot)
    p = lot.product
    return AuctionLotAdminOut(
        id=lot.id,
        product_id=lot.product_id,
        starting_bid=lot.starting_bid,
        min_increment=lot.min_increment,
        reserve_price=lot.reserve_price,
        ends_at=lot.ends_at,
        status=lot.status,
        is_published=lot.is_published,
        current_bid_amount=lot.current_bid_amount,
        headline=lot.headline,
        headline_vi=lot.headline_vi,
        created_at=lot.created_at,
        updated_at=lot.updated_at,
        product_slug=p.slug if p else None,
        product_name=p.name if p else None,
        bid_count=len(lot.bids or []),
    )


@admin_router.get("/{lot_id}/bids", response_model=list[AuctionBidAdminOut])
def admin_list_bids(lot_id: int, db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    lot = db.scalar(select(AuctionLot).where(AuctionLot.id == lot_id, AuctionLot.tenant_id == tenant.id))
    if lot is None:
        raise HTTPException(status_code=404, detail="Lot not found")
    bids = db.scalars(
        select(AuctionBid).where(AuctionBid.lot_id == lot.id).order_by(AuctionBid.amount.desc())
    ).all()
    return [AuctionBidAdminOut.model_validate(b) for b in bids]


@admin_router.post("/{lot_id}/close", response_model=AuctionLotAdminOut)
def admin_close_lot(lot_id: int, db: Session = Depends(get_db), tenant: Tenant = AdminDep):
    site = db.scalar(select(SiteSettings).where(SiteSettings.tenant_id == tenant.id))
    if site is None:
        raise HTTPException(status_code=400, detail="Site settings missing")
    lot = db.scalar(
        select(AuctionLot)
        .where(AuctionLot.id == lot_id, AuctionLot.tenant_id == tenant.id)
        .options(selectinload(AuctionLot.product), selectinload(AuctionLot.bids))
    )
    if lot is None:
        raise HTTPException(status_code=404, detail="Lot not found")
    lot = close_lot(db, lot, site=site)
    p = lot.product
    return AuctionLotAdminOut(
        id=lot.id,
        product_id=lot.product_id,
        starting_bid=lot.starting_bid,
        min_increment=lot.min_increment,
        reserve_price=lot.reserve_price,
        ends_at=lot.ends_at,
        status=lot.status,
        is_published=lot.is_published,
        current_bid_amount=lot.current_bid_amount,
        headline=lot.headline,
        headline_vi=lot.headline_vi,
        created_at=lot.created_at,
        updated_at=lot.updated_at,
        product_slug=p.slug if p else None,
        product_name=p.name if p else None,
        bid_count=len(lot.bids or []),
    )