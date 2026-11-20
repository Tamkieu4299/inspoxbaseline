"""Auction lot lifecycle and bid placement."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .bid_notify import notify_bid_event
from .models import AuctionBid, AuctionLot, Product, SiteSettings


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _min_next_bid(lot: AuctionLot) -> float:
    base = lot.current_bid_amount if lot.current_bid_amount is not None else None
    if base is None:
        return float(lot.starting_bid or 0)
    return float(base) + float(lot.min_increment or 0)


def lot_time_state(lot: AuctionLot) -> str:
    if lot.status in ("ended", "sold", "cancelled"):
        return lot.status
    if lot.ends_at and lot.ends_at <= _utcnow():
        return "ended"
    if lot.status == "live" and lot.is_published:
        return "live"
    return "draft"


def compute_lot_public_fields(lot: AuctionLot) -> dict:
    state = lot_time_state(lot)
    current = lot.current_bid_amount
    min_next = _min_next_bid(lot) if state == "live" else float(lot.starting_bid or 0)
    reserve = float(lot.reserve_price) if lot.reserve_price is not None else None
    reserve_met = reserve is None or (current is not None and current >= reserve)
    return {
        "state": state,
        "current_bid": current,
        "min_next_bid": min_next,
        "starting_bid": float(lot.starting_bid or 0),
        "min_increment": float(lot.min_increment or 0),
        "reserve_met": reserve_met,
        "ends_at": lot.ends_at,
        "bid_count": len(lot.bids or []),
    }


def ensure_bidding_enabled(db: Session, tenant_id: int) -> SiteSettings:
    site = db.scalar(select(SiteSettings).where(SiteSettings.tenant_id == tenant_id))
    if site is None or not site.bidding_enabled:
        raise HTTPException(status_code=404, detail="Bidding not available")
    return site


def get_live_lot_for_product(db: Session, tenant_id: int, product_id: int) -> AuctionLot | None:
    lot = db.scalar(
        select(AuctionLot)
        .where(
            AuctionLot.tenant_id == tenant_id,
            AuctionLot.product_id == product_id,
            AuctionLot.is_published.is_(True),
            AuctionLot.status.in_(("live", "draft")),
        )
        .options(selectinload(AuctionLot.bids))
    )
    if lot is None:
        return None
    if lot_time_state(lot) == "ended" and lot.status == "live":
        lot.status = "ended"
        db.flush()
    return lot if lot_time_state(lot) == "live" else None


def place_bid(
    db: Session,
    *,
    tenant_id: int,
    product_slug: str,
    amount: float,
    bidder_name: str,
    bidder_phone: str,
    bidder_email: str | None,
) -> AuctionBid:
    site = ensure_bidding_enabled(db, tenant_id)
    product = db.scalar(
        select(Product).where(Product.tenant_id == tenant_id, Product.slug == product_slug)
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    lot = db.scalar(
        select(AuctionLot)
        .where(
            AuctionLot.tenant_id == tenant_id,
            AuctionLot.product_id == product.id,
            AuctionLot.is_published.is_(True),
            AuctionLot.status == "live",
        )
        .options(selectinload(AuctionLot.bids), selectinload(AuctionLot.product))
    )
    if lot is None:
        raise HTTPException(status_code=404, detail="No live auction for this product")
    if lot.ends_at and lot.ends_at <= _utcnow():
        lot.status = "ended"
        db.commit()
        raise HTTPException(status_code=400, detail="Auction has ended")

    min_required = _min_next_bid(lot)
    if amount < min_required:
        raise HTTPException(
            status_code=400,
            detail=f"Bid must be at least {min_required:,.0f} VND",
        )

    prev_id = lot.current_bid_id
    prev_bid: AuctionBid | None = None
    if prev_id:
        prev_bid = db.get(AuctionBid, prev_id)

    bid = AuctionBid(
        lot_id=lot.id,
        amount=amount,
        bidder_name=bidder_name.strip(),
        bidder_phone=bidder_phone.strip(),
        bidder_email=(bidder_email or "").strip() or None,
        status="leading",
    )
    db.add(bid)
    db.flush()

    if prev_bid is not None:
        prev_bid.status = "outbid"

    lot.current_bid_amount = amount
    lot.current_bid_id = bid.id
    db.flush()

    title = (lot.headline_vi or lot.headline or product.name_vi or product.name).strip()
    notify_bid_event(
        site=site,
        event="bid_placed",
        lot_title=title,
        product_slug=product.slug,
        amount=amount,
        min_next=_min_next_bid(lot),
        bidder_name=bid.bidder_name,
        bidder_phone=bid.bidder_phone,
        bidder_email=bid.bidder_email,
        message=f"Your bid of {amount:,.0f} VND was recorded for {title}. We will contact you if you are outbid or if you win.",
        message_vi=(
            f"Đã ghi nhận giá {amount:,.0f}₫ cho {title}. "
            "Chúng tôi sẽ liên hệ nếu có người trả cao hơn hoặc khi đấu giá kết thúc."
        ),
    )

    if prev_bid and prev_bid.bidder_email:
        notify_bid_event(
            site=site,
            event="outbid",
            lot_title=title,
            product_slug=product.slug,
            amount=amount,
            min_next=_min_next_bid(lot),
            bidder_name=prev_bid.bidder_name,
            bidder_phone=prev_bid.bidder_phone,
            bidder_email=prev_bid.bidder_email,
            message=(
                f"You were outbid on {title}. Current bid: {amount:,.0f} VND. "
                f"Minimum next bid: {_min_next_bid(lot):,.0f} VND."
            ),
            message_vi=(
                f"Bạn đã bị vượt giá trên {title}. Giá hiện tại: {amount:,.0f}₫. "
                f"Giá đặt tối thiểu tiếp theo: {_min_next_bid(lot):,.0f}₫."
            ),
        )

    db.commit()
    db.refresh(bid)
    return bid


def close_lot(db: Session, lot: AuctionLot, *, site: SiteSettings) -> AuctionLot:
    """End lot and notify winner / losers."""
    lot.status = "ended"
    db.flush()
    product = lot.product or db.get(Product, lot.product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product missing")
    title = (lot.headline_vi or lot.headline or product.name_vi or product.name).strip()
    reserve = float(lot.reserve_price) if lot.reserve_price is not None else None
    current = lot.current_bid_amount
    winner = db.get(AuctionBid, lot.current_bid_id) if lot.current_bid_id else None

    if winner and (reserve is None or (current and current >= reserve)):
        winner.status = "won"
        lot.status = "sold"
        notify_bid_event(
            site=site,
            event="won",
            lot_title=title,
            product_slug=product.slug,
            amount=winner.amount,
            min_next=None,
            bidder_name=winner.bidder_name,
            bidder_phone=winner.bidder_phone,
            bidder_email=winner.bidder_email,
            message=f"Congratulations — you have the leading bid on {title} at {winner.amount:,.0f} VND. Our team will contact you to confirm.",
            message_vi=(
                f"Chúc mừng — bạn đang dẫn đầu đấu giá {title} với {winner.amount:,.0f}₫. "
                "Baseline sẽ liên hệ để xác nhận."
            ),
        )
        for bid in lot.bids or []:
            if bid.id != winner.id and bid.status != "rejected":
                bid.status = "lost"
                if bid.bidder_email:
                    notify_bid_event(
                        site=site,
                        event="lost",
                        lot_title=title,
                        product_slug=product.slug,
                        amount=bid.amount,
                        min_next=None,
                        bidder_name=bid.bidder_name,
                        bidder_phone=bid.bidder_phone,
                        bidder_email=bid.bidder_email,
                        message=f"The auction for {title} has ended. Another bid was higher.",
                        message_vi=f"Phiên đấu giá {title} đã kết thúc. Có giá cao hơn giá của bạn.",
                    )
    else:
        if winner:
            winner.status = "lost"
        notify_bid_event(
            site=site,
            event="reserve_not_met",
            lot_title=title,
            product_slug=product.slug,
            amount=current or 0,
            min_next=None,
            bidder_name=winner.bidder_name if winner else "—",
            bidder_phone=winner.bidder_phone if winner else "—",
            bidder_email=winner.bidder_email if winner else None,
            message=f"Auction ended for {title} without meeting reserve.",
            message_vi=f"Đấu giá {title} đã kết thúc — chưa đạt giá khởi điểm / giá dự trữ.",
        )
    db.commit()
    db.refresh(lot)
    return lot