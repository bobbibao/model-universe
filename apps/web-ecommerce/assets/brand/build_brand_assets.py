"""Builds every brand asset the web app serves from the two source logo images in this folder.

source-mark-color.png  the ram-head mark in colour, on a transparent background
source-lockup.png      the line-art mark above the "MODEL UNIVERSE" wordmark, black on white (the wordmark comes from here)

Run from anywhere (Pillow and numpy required):  python apps/web-ecommerce/assets/brand/build_brand_assets.py

Outputs (paths relative to apps/web-ecommerce):
  public/brand/mark.webp                            the colour mark for BrandLogo
  public/brand/wordmark.png                         an alpha mask for BrandLogo (CSS paints it in currentColor)
  public/icons/logo.png                             512x512 lockup on white (Organization logo in JSON-LD)
  public/icons/icon-48|192|512.png                  the mark on a dark rounded square (favicons, manifest "any")
  public/icons/icon-maskable-512.png                full-bleed, mark inside the maskable safe zone
  public/icons/apple-touch-icon.png                 180x180, opaque
  src/app/favicon.ico                               16, 32 and 48 px
  public/images/store/og-cover.jpg                  1200x630 social share card
"""

from itertools import pairwise
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
APP = HERE.parent.parent
INK = (23, 22, 28)  # #17161c, the dark band of the storefront
LIME = (220, 245, 106)  # #dcf56a
FONTS = Path("C:/Windows/Fonts")


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


def mask_png(alpha: np.ndarray, height: int, path: Path) -> None:
    image = Image.fromarray(alpha, "L")
    if image.height > height:
        image = image.resize(
            (round(image.width * height / image.height), height), Image.LANCZOS
        )
    la = Image.merge("LA", (Image.new("L", image.size, 0), image))
    path.parent.mkdir(parents=True, exist_ok=True)
    la.save(path, optimize=True)
    print(f"{path.relative_to(APP)}  {la.size}")


def app_icon(
    mark: Image.Image, size: int, *, inset: float, radius: float
) -> Image.Image:
    """The mark on the dark square; radius 0 is a full-bleed opaque square."""
    scale = 4
    big = Image.new("RGBA", (size * scale, size * scale), (0, 0, 0, 0))
    ImageDraw.Draw(big).rounded_rectangle(
        (0, 0, big.width - 1, big.height - 1),
        radius=round(radius * big.width),
        fill=(*INK, 255),
    )
    paste_center(big, fit(mark, round(big.width * (1 - 2 * inset))))
    return big.resize((size, size), Image.LANCZOS)


def save_png(image: Image.Image, path: Path) -> None:
    image.save(path, optimize=True)
    print(f"{path.relative_to(APP)}  {image.size}")


def main() -> None:
    color_mark = Image.open(HERE / "source-mark-color.png").convert("RGBA")
    color_mark = color_mark.crop(
        color_mark.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    )
    lockup_alpha = ink_alpha(HERE / "source-lockup.png")
    # The lockup's mark sits above a blank band; everything below it is the wordmark.
    rows = np.where((lockup_alpha > 8).sum(1) > 0)[0]
    gap = next(a for a, b in pairwise(rows) if b - a > 3)
    word_alpha = trim(lockup_alpha[gap + 1 :])

    web_mark = color_mark.resize(
        (round(color_mark.width * 256 / color_mark.height), 256), Image.LANCZOS
    )
    web_mark.save(APP / "public/brand/mark.webp", quality=90, method=6)
    print(f"public/brand/mark.webp  {web_mark.size}")
    mask_png(word_alpha, 160, APP / "public/brand/wordmark.png")

    black_word = solid(word_alpha, (0, 0, 0))
    icons = APP / "public/icons"

    # Organization logo: the colour mark above the wordmark, the proportions of the source lockup, on white.
    mark_w = round(word_alpha.shape[1] * 0.97)
    lock_mark = color_mark.resize(
        (mark_w, round(mark_w * color_mark.height / color_mark.width)), Image.LANCZOS
    )
    lock = Image.new(
        "RGBA",
        (word_alpha.shape[1], lock_mark.height + 6 + black_word.height),
        (0, 0, 0, 0),
    )
    lock.alpha_composite(lock_mark, ((lock.width - lock_mark.width) // 2, 0))
    lock.alpha_composite(black_word, (0, lock_mark.height + 6))
    logo = Image.new("RGBA", (512, 512), (255, 255, 255, 255))
    paste_center(logo, fit(lock, 420))
    save_png(logo.convert("RGB"), icons / "logo.png")

    for size in (48, 192, 512):
        save_png(
            app_icon(color_mark, size, inset=0.1, radius=0.22),
            icons / f"icon-{size}.png",
        )
    save_png(
        app_icon(color_mark, 512, inset=0.2, radius=0).convert("RGB"),
        icons / "icon-maskable-512.png",
    )
    save_png(
        app_icon(color_mark, 180, inset=0.12, radius=0).convert("RGB"),
        icons / "apple-touch-icon.png",
    )

    favicon = APP / "src/app/favicon.ico"
    small = [
        app_icon(color_mark, s, inset=0.04 if s == 16 else 0.07, radius=0.2)
        for s in (16, 32, 48)
    ]
    small[2].save(
        favicon,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=small[:2],
    )
    print(f"{favicon.relative_to(APP)}  16/32/48")

    og_cover(color_mark, APP / "public/images/store/og-cover.jpg")


def og_cover(mark: Image.Image, path: Path) -> None:
    width, height = 1200, 630
    card = Image.new("RGBA", (width, height), (*INK, 255))
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((700, 40, 1220, 560), fill=(40, 170, 130, 60))
    card.alpha_composite(glow.filter(ImageFilter.GaussianBlur(120)))
    mark = fit(mark, 430)
    card.alpha_composite(mark, (1200 - 80 - mark.width, (height - mark.height) // 2))

    draw = ImageDraw.Draw(card)
    bold, semi, regular = (
        str(FONTS / f) for f in ("segoeuib.ttf", "seguisb.ttf", "segoeui.ttf")
    )
    x = 80
    draw.text(
        (x, 120),
        "VŨ TRỤ MÔ HÌNH",
        font=ImageFont.truetype(semi, 26),
        fill=LIME,
        spacing=0,
    )
    draw.text(
        (x, 162),
        "Model Universe",
        font=ImageFont.truetype(bold, 76),
        fill=(245, 244, 240),
    )
    body = ImageFont.truetype(semi, 34)
    draw.text(
        (x, 290), "Mô hình lắp ráp · Gunpla · Mecha", font=body, fill=(245, 244, 240)
    )
    draw.text((x, 338), "Kit Trung Quốc · New & 2hand", font=body, fill=(245, 244, 240))
    small = ImageFont.truetype(regular, 24)
    draw.text(
        (x, 440),
        "Mua bán · Thu mua · Trade · Cầm cố · Hỗ trợ lắp ráp",
        font=small,
        fill=(196, 193, 204),
    )
    draw.text(
        (x, 500),
        "Gò Vấp, TP.HCM · COD toàn quốc · modeluniverse.vn",
        font=small,
        fill=(196, 193, 204),
    )
    card.convert("RGB").save(path, quality=88, optimize=True, progressive=True)
    print(f"{path.relative_to(APP)}  {card.size}")


if __name__ == "__main__":
    main()
