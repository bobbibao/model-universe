"""Builds every brand asset the web app serves from the line-art logo in this folder.

source-mark-line.png   the ram-head mark as black line art on white (the main logo)

The name is never an image: the site sets "Model Universe" as live text in Satoshi next to the mark (BrandLogo), and the
images below draw it with the same font.

Run from anywhere (Pillow and numpy required):  python apps/web-ecommerce/assets/brand/build_brand_assets.py

Outputs (paths relative to apps/web-ecommerce):
  public/brand/mark.png                             an alpha mask of the mark for BrandLogo (CSS paints it in currentColor)
  public/icons/logo.png                             512x512, navy mark above the name, on white (Organization logo)
  public/icons/icon-48|192|512.png                  white mark on a navy rounded square (favicons, manifest "any")
  public/icons/icon-maskable-512.png                full-bleed, mark inside the maskable safe zone
  public/icons/apple-touch-icon.png                 180x180, opaque
  src/app/favicon.ico                               16, 32 and 48 px
  public/images/store/og-cover.jpg                  1200x630 social share card
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
APP = HERE.parent.parent
NAVY = (16, 28, 49)  # --mu-navy-900
NAVY_DEEP = (10, 19, 34)  # --mu-navy-950
WHITE = (255, 255, 255)
EMERALD = (58, 217, 168)  # --mu-emerald-glow
MUTED = (178, 188, 206)
SATOSHI = APP / "src/fonts"
SYSTEM_FONTS = Path("C:/Windows/Fonts")
NAME = "Model Universe"


def ink_alpha(path: Path) -> np.ndarray:
    """Black-on-white artwork as an alpha channel: white (and the faint off-white backing square) -> 0, ink -> 255."""
    grey = np.asarray(Image.open(path).convert("L")).astype(float)
    return (np.clip((235 - grey) / (235 - 70), 0, 1) * 255).astype(np.uint8)


def trim(alpha: np.ndarray, pad: int = 2) -> np.ndarray:
    ys, xs = np.where(alpha > 8)
    return alpha[
        max(0, ys.min() - pad) : ys.max() + pad + 1,
        max(0, xs.min() - pad) : xs.max() + pad + 1,
    ]


def solid(alpha: np.ndarray, color) -> Image.Image:
    out = np.zeros((*alpha.shape, 4), np.uint8)
    out[..., :3] = color
    out[..., 3] = alpha
    return Image.fromarray(out, "RGBA")


def fit(image: Image.Image, box: int) -> Image.Image:
    scale = box / max(image.size)
    return image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.LANCZOS,
    )


def paste_center(canvas: Image.Image, image: Image.Image, dy: int = 0) -> None:
    canvas.alpha_composite(
        image,
        ((canvas.width - image.width) // 2, (canvas.height - image.height) // 2 + dy),
    )


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)
    print(f"{path.relative_to(APP)}  {image.size}")


def app_icon(
    mark: Image.Image, size: int, *, inset: float, radius: float
) -> Image.Image:
    """The white mark on the navy square; radius 0 is a full-bleed opaque square."""
    scale = 4
    big = Image.new("RGBA", (size * scale, size * scale), (0, 0, 0, 0))
    ImageDraw.Draw(big).rounded_rectangle(
        (0, 0, big.width - 1, big.height - 1),
        radius=round(radius * big.width),
        fill=(*NAVY, 255),
    )
    paste_center(big, fit(mark, round(big.width * (1 - 2 * inset))))
    return big.resize((size, size), Image.LANCZOS)


def main() -> None:
    alpha = trim(ink_alpha(HERE / "source-mark-line.png"))

    # BrandLogo's mask: luminance-free, alpha only, 256 px tall.
    mask = Image.fromarray(alpha, "L")
    mask = mask.resize((round(mask.width * 256 / mask.height), 256), Image.LANCZOS)
    save_png(
        Image.merge("LA", (Image.new("L", mask.size, 0), mask)),
        APP / "public/brand/mark.png",
    )

    white_mark = solid(alpha, WHITE)
    navy_mark = solid(alpha, NAVY)
    icons = APP / "public/icons"

    # Organization logo: the navy mark above the name, on white.
    logo = Image.new("RGBA", (512, 512), (*WHITE, 255))
    mark = fit(navy_mark, 300)
    font = ImageFont.truetype(str(SATOSHI / "Satoshi-Bold.ttf"), 54)
    text_w = ImageDraw.Draw(logo).textlength(NAME, font=font)
    top = (512 - (mark.height + 28 + 54)) // 2
    logo.alpha_composite(mark, ((512 - mark.width) // 2, top))
    ImageDraw.Draw(logo).text(
        ((512 - text_w) / 2, top + mark.height + 22), NAME, font=font, fill=NAVY
    )
    save_png(logo.convert("RGB"), icons / "logo.png")

    for size in (48, 192, 512):
        save_png(
            app_icon(white_mark, size, inset=0.12, radius=0.22),
            icons / f"icon-{size}.png",
        )
    save_png(
        app_icon(white_mark, 512, inset=0.2, radius=0).convert("RGB"),
        icons / "icon-maskable-512.png",
    )
    save_png(
        app_icon(white_mark, 180, inset=0.14, radius=0).convert("RGB"),
        icons / "apple-touch-icon.png",
    )

    favicon = APP / "src/app/favicon.ico"
    small = [
        app_icon(white_mark, s, inset=0.06 if s == 16 else 0.09, radius=0.2)
        for s in (16, 32, 48)
    ]
    small[2].save(
        favicon,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=small[:2],
    )
    print(f"{favicon.relative_to(APP)}  16/32/48")

    og_cover(white_mark, APP / "public/images/store/og-cover.jpg")


def og_cover(mark: Image.Image, path: Path) -> None:
    width, height = 1200, 630
    card = Image.new("RGBA", (width, height), (*NAVY_DEEP, 255))
    mark = fit(mark, 380)
    card.alpha_composite(mark, (width - 96 - mark.width, (height - mark.height) // 2))

    draw = ImageDraw.Draw(card)
    # Satoshi has no Vietnamese stacked marks, so the Vietnamese lines use Segoe UI.
    semi, regular = (str(SYSTEM_FONTS / f) for f in ("seguisb.ttf", "segoeui.ttf"))
    x = 88
    draw.text(
        (x, 132), "Vũ Trụ Mô Hình", font=ImageFont.truetype(semi, 28), fill=EMERALD
    )
    draw.text(
        (x, 176),
        NAME,
        font=ImageFont.truetype(str(SATOSHI / "Satoshi-Bold.ttf"), 76),
        fill=WHITE,
    )
    body = ImageFont.truetype(semi, 32)
    draw.text((x, 306), "Mô hình lắp ráp · Gunpla · Mecha", font=body, fill=WHITE)
    draw.text((x, 352), "Kit Trung Quốc · New & 2hand", font=body, fill=WHITE)
    small = ImageFont.truetype(regular, 24)
    draw.text(
        (x, 448),
        "Mua bán · Thu mua · Trade · Cầm cố · Hỗ trợ lắp ráp",
        font=small,
        fill=MUTED,
    )
    draw.text(
        (x, 494),
        "Gò Vấp, TP.HCM · COD toàn quốc · modeluniverse.vn",
        font=small,
        fill=MUTED,
    )
    card.convert("RGB").save(path, quality=88, optimize=True, progressive=True)
    print(f"{path.relative_to(APP)}  {card.size}")


if __name__ == "__main__":
    main()
