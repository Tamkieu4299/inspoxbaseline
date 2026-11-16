"""Baseline Club — return & warranty policy pages (static CMS).

Creates or updates:
  /pages/chinh-sach-doi-tra-hang
  /pages/chinh-sach-bao-hanh

Also points footer preset ``shipping`` at the return policy and adds a ``warranty`` footer link.

    docker exec -w /app inspo-backend python -m app.seed_baseline_policies
    docker exec -w /app inspo-backend python -m app.seed_baseline_policies --dry-run
"""

from __future__ import annotations

import argparse

from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from .database import SessionLocal
from .footer_links import normalize_footer_link_configs
from .models import Page, PageBlock, SiteSettings, Tenant

RETURN_SLUG = "chinh-sach-doi-tra-hang"
WARRANTY_SLUG = "chinh-sach-bao-hanh"

RETURN_ITEMS = [
    "Khách hàng được yêu cầu đổi/trả hàng trong vòng 15 ngày kể từ ngày nhận hàng.",
    "Sản phẩm phải còn nguyên vẹn, chưa qua sử dụng, đầy đủ tag và seal như ban đầu.",
    "Sau khi sản phẩm được gửi về shop và hoàn tất quá trình kiểm tra, tiền hoàn sẽ được chuyển lại cho khách hàng trong vòng 7 ngày.",
]

RETURN_NOTE = (
    "Lưu ý: Shop có quyền từ chối đổi/trả đối với sản phẩm không đáp ứng các điều kiện trên."
)

WARRANTY_INTRO = (
    "BASELINE CLUB áp dụng chính sách bảo hành theo từng nhóm sản phẩm:"
)

WARRANTY_COVERAGE_EN = [
    "Tennis rackets: 3-month warranty for manufacturer defects.",
    "Custom design rackets: 6-month warranty on paint defects from production.",
    "Other products: 3-month warranty for manufacturer defects.",
]

WARRANTY_COVERAGE_VI = [
    "Vợt tennis: Bảo hành 3 tháng đối với các lỗi phát sinh từ nhà sản xuất.",
    "Vợt thiết kế (Custom Racket): Bảo hành 6 tháng đối với các lỗi sơn phát sinh từ quá trình sản xuất.",
    "Các sản phẩm khác: Bảo hành 3 tháng đối với các lỗi phát sinh từ nhà sản xuất.",
]

WARRANTY_EXCLUSIONS = [
    "Sản phẩm bị hư hỏng do va đập, rơi vỡ, cọ xát hoặc tác động ngoại lực trong quá trình sử dụng.",
    "Hư hỏng do sử dụng sai cách, bảo quản không đúng hướng dẫn hoặc sử dụng sản phẩm sai mục đích.",
    "Sản phẩm bị hao mòn tự nhiên trong quá trình sử dụng như trầy xước, bạc màu, bong tróc do ma sát thông thường.",
    "Sản phẩm bị tự ý sửa chữa, tháo lắp, thay đổi kết cấu hoặc can thiệp bởi bên thứ ba không được ủy quyền.",
    "Hư hỏng do tiếp xúc với hóa chất, nhiệt độ cao, độ ẩm hoặc các điều kiện môi trường không phù hợp.",
    "Đối với vợt thiết kế, không áp dụng bảo hành cho các vết trầy xước, bong sơn do va chạm, cọ xát hoặc quá trình sử dụng.",
    "Sản phẩm không có thông tin mua hàng hoặc không xác minh được nguồn gốc mua tại BASELINE CLUB.",
]

WARRANTY_CLOSING = (
    "BASELINE CLUB có quyền kiểm tra tình trạng sản phẩm trước khi xác nhận bảo hành. "
    "Các trường hợp đủ điều kiện sẽ được hỗ trợ theo chính sách bảo hành tương ứng."
)


def _block(block_type: str, data: dict, position: int) -> PageBlock:
    payload = dict(data)
    for key, value in list(payload.items()):
        if key.endswith("_vi"):
            continue
        vi_key = f"{key}_vi"
        if vi_key not in payload and isinstance(value, str):
            payload[vi_key] = value
        elif vi_key not in payload and isinstance(value, list):
            payload[vi_key] = list(value)
    return PageBlock(block_type=block_type, data=payload, position=position)


def _replace_blocks(db, page: Page, blocks: list[PageBlock]) -> None:
    db.execute(delete(PageBlock).where(PageBlock.page_id == page.id))
    for block in blocks:
        block.page_id = page.id
        db.add(block)


def _upsert_page(
    db,
    tenant_id: int,
    *,
    slug: str,
    title: str,
    title_vi: str,
    subtitle: str,
    subtitle_vi: str,
    blocks: list[PageBlock],
) -> Page:
    page = db.scalar(
        select(Page)
        .options(selectinload(Page.blocks))
        .where(Page.tenant_id == tenant_id, Page.slug == slug)
    )
    if page is None:
        page = Page(
            tenant_id=tenant_id,
            slug=slug,
            title=title,
            title_vi=title_vi,
            subtitle=subtitle,
            subtitle_vi=subtitle_vi,
            is_active=True,
            show_in_nav=False,
            position=90,
        )
        db.add(page)
        db.flush()
        for block in blocks:
            block.page_id = page.id
            db.add(block)
        return page

    page.title = title
    page.title_vi = title_vi
    page.subtitle = subtitle
    page.subtitle_vi = subtitle_vi
    page.is_active = True
    page.show_in_nav = False
    _replace_blocks(db, page, blocks)
    return page


def _patch_footer_links(stored: list | None) -> list[dict]:
    configs = normalize_footer_link_configs(stored)

    def _upsert(key: str, **fields: object) -> None:
        for row in configs:
            if row.get("key") == key:
                row.update(fields)
                return
        configs.append({"key": key, "enabled": True, "label": None, "label_vi": None, "url": None, **fields})

    _upsert(
        "shipping",
        enabled=True,
        url=f"/pages/{RETURN_SLUG}",
        label="Shipping & returns",
        label_vi="Chính sách đổi trả",
    )
    _upsert(
        "warranty",
        enabled=True,
        url=f"/pages/{WARRANTY_SLUG}",
        label="Warranty policy",
        label_vi="Chính sách bảo hành",
    )
    return configs


def apply_baseline_policies(*, dry_run: bool = True) -> None:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == "baseline"))
        if tenant is None:
            raise SystemExit("Tenant baseline not found")

        return_blocks = [
            _block("heading", {"text": "CHÍNH SÁCH ĐỔI TRẢ HÀNG"}, 1),
            _block("list", {"items": RETURN_ITEMS}, 2),
            _block("text", {"body": RETURN_NOTE}, 3),
        ]
        warranty_blocks = [
            _block("heading", {"text": "CHÍNH SÁCH BẢO HÀNH"}, 1),
            _block("text", {"body": WARRANTY_INTRO}, 2),
            _block(
                "list",
                {"items": WARRANTY_COVERAGE_EN, "items_vi": WARRANTY_COVERAGE_VI},
                3,
            ),
            _block("heading", {"text": "CÁC TRƯỜNG HỢP KHÔNG ĐƯỢC BẢO HÀNH"}, 4),
            _block("list", {"items": WARRANTY_EXCLUSIONS}, 5),
            _block("text", {"body": WARRANTY_CLOSING}, 6),
        ]

        _upsert_page(
            db,
            tenant.id,
            slug=RETURN_SLUG,
            title="RETURN POLICY",
            title_vi="CHÍNH SÁCH ĐỔI TRẢ HÀNG",
            subtitle="Returns within 15 days of delivery.",
            subtitle_vi="Đổi/trả hàng trong vòng 15 ngày kể từ ngày nhận hàng.",
            blocks=return_blocks,
        )
        _upsert_page(
            db,
            tenant.id,
            slug=WARRANTY_SLUG,
            title="WARRANTY POLICY",
            title_vi="CHÍNH SÁCH BẢO HÀNH",
            subtitle="Manufacturer warranty by product group.",
            subtitle_vi="Bảo hành theo từng nhóm sản phẩm.",
            blocks=warranty_blocks,
        )

        site = db.scalar(select(SiteSettings).where(SiteSettings.tenant_id == tenant.id))
        if site is None:
            site = SiteSettings(tenant_id=tenant.id, site_name="Baseline Club")
            db.add(site)
            db.flush()
        site.footer_links = _patch_footer_links(site.footer_links)

        if dry_run:
            db.rollback()
            print("dry-run: would upsert policy pages and footer links for baseline")
            print(f"  /pages/{RETURN_SLUG}")
            print(f"  /pages/{WARRANTY_SLUG}")
            return

        db.commit()
        print(f"Applied Baseline policy pages: /pages/{RETURN_SLUG}, /pages/{WARRANTY_SLUG}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Write to database (default is dry-run)")
    parser.add_argument("--dry-run", action="store_true", help="Explicit dry-run")
    args = parser.parse_args()
    apply_baseline_policies(dry_run=args.dry_run or not args.apply)


if __name__ == "__main__":
    main()
