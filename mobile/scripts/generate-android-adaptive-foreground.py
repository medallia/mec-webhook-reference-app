#!/usr/bin/env python3
"""Build mobile/assets/icon-android-foreground.png from Medallia launcher source art.

White logo pixels become black; blue (and outer transparent) become fully transparent.
The full source frame is scaled so the blue circle matches Android's 66dp safe zone, then
centered on a 1024x1024 canvas (same placement as the Medallia launcher asset).
"""

from pathlib import Path

from PIL import Image

TARGET = 1024
# Android adaptive icon: keyline artwork fits in a 66dp-diameter circle on a 108dp layer.
ANDROID_SAFE_ZONE_RATIO = 66 / 108

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "medallia-adaptive-foreground-source.png"
OUT = ROOT / "assets" / "icon-android-foreground.png"


def is_blue_background(r: int, g: int, b: int, a: int) -> bool:
    if a < 20:
        return True
    return b > max(r, g) + 8 and b > 70


def convert_to_foreground(img: Image.Image) -> Image.Image:
    src = img.convert("RGBA")
    out = Image.new("RGBA", src.size, (0, 0, 0, 0))
    sp = src.load()
    dp = out.load()
    w, h = src.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = sp[x, y]
            if is_blue_background(r, g, b, a):
                dp[x, y] = (0, 0, 0, 0)
            else:
                dp[x, y] = (0, 0, 0, a)
    return out


def blue_circle_bounds(img: Image.Image) -> tuple[int, int, int, int]:
    pixels = img.load()
    w, h = img.size
    min_x, min_y, max_x, max_y = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if is_blue_background(r, g, b, a):
                found = True
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if not found:
        return 0, 0, w - 1, h - 1
    return min_x, min_y, max_x, max_y


def opacity_centroid(img: Image.Image) -> tuple[float, float]:
    pixels = img.load()
    w, h = img.size
    sum_x = sum_y = sum_a = 0.0
    for y in range(h):
        for x in range(w):
            a = pixels[x, y][3]
            if a < 16:
                continue
            weight = a / 255.0
            sum_x += x * weight
            sum_y += y * weight
            sum_a += weight
    if sum_a == 0:
        return w / 2, h / 2
    return sum_x / sum_a, sum_y / sum_a


def fit_like_medallia_launcher(source: Image.Image, foreground: Image.Image) -> Image.Image:
    sw, sh = source.size
    bx0, by0, bx1, by1 = blue_circle_bounds(source)
    blue_w = bx1 - bx0 + 1
    blue_h = by1 - by0 + 1
    blue_d = max(blue_w, blue_h)
    blue_cx = (bx0 + bx1) / 2
    blue_cy = (by0 + by1) / 2

    # Scale the source frame so the blue circle matches the adaptive safe zone diameter.
    scale = (TARGET * ANDROID_SAFE_ZONE_RATIO) / blue_d
    scaled_w = max(1, int(round(sw * scale)))
    scaled_h = max(1, int(round(sh * scale)))
    scaled = foreground.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)

    # Map blue-circle center from source pixels to scaled layer coordinates.
    scaled_blue_cx = blue_cx * scale
    scaled_blue_cy = blue_cy * scale

    canvas = Image.new("RGBA", (TARGET, TARGET), (0, 0, 0, 0))
    paste_x = int(round(TARGET / 2 - scaled_blue_cx))
    paste_y = int(round(TARGET / 2 - scaled_blue_cy))
    canvas.paste(scaled, (paste_x, paste_y), scaled)

    # Fine-tune: align logo mass to canvas center (fixes bbox/AA skew vs Medallia).
    cx, cy = opacity_centroid(canvas)
    dx = int(round(TARGET / 2 - cx))
    dy = int(round(TARGET / 2 - cy))
    if dx or dy:
        shifted = Image.new("RGBA", (TARGET, TARGET), (0, 0, 0, 0))
        shifted.paste(canvas, (dx, dy), canvas)
        canvas = shifted

    return canvas


def content_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    pixels = img.load()
    w, h = img.size
    min_x, min_y, max_x, max_y = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            if pixels[x, y][3] > 10:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    return min_x, min_y, max_x, max_y


def main() -> None:
    source = Image.open(SRC)
    foreground = convert_to_foreground(source)
    result = fit_like_medallia_launcher(source, foreground)
    result.save(OUT, "PNG")

    bx0, by0, bx1, by1 = content_bbox(result)
    cx, cy = opacity_centroid(result)
    print(f"Wrote {OUT} from {SRC}")
    print(f"bbox=({bx0},{by0})-({bx1},{by1}) centroid=({cx:.1f},{cy:.1f}) margins top={by0} bottom={TARGET-1-by1}")


if __name__ == "__main__":
    main()
