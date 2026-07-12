#!/usr/bin/env python3
"""从不可变英雄母版确定性生成 256×256 游戏运行纹理。"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageFilter, __version__ as pillow_version


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_SIZE = 256
SAFE_MARGIN_RATIO = 0.07
UNSHARP_RADIUS = 0.55
UNSHARP_PERCENT = 30
UNSHARP_THRESHOLD = 3
HERO_DIRECTORIES = (
    "wind-hunter",
    "ember-mage",
    "stone-vanguard",
    "forest-summoner",
    "starlight-priest",
)
REPORT_PATH = ROOT / "tools" / "hero_runtime_assets_report.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def premultiplied_resize(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """以预乘 Alpha 缩放并轻量锐化，避免透明边缘产生白/黑色晕边。"""
    red, green, blue, alpha = image.split()
    premultiplied = [ImageChops.multiply(channel, alpha) for channel in (red, green, blue)]
    resized_alpha = alpha.resize(size, Image.Resampling.LANCZOS)
    resized_rgb = Image.merge(
        "RGB",
        tuple(channel.resize(size, Image.Resampling.LANCZOS) for channel in premultiplied),
    ).filter(
        ImageFilter.UnsharpMask(
            radius=UNSHARP_RADIUS,
            percent=UNSHARP_PERCENT,
            threshold=UNSHARP_THRESHOLD,
        )
    )
    rgb_data = list(resized_rgb.get_flattened_data())
    alpha_data = list(resized_alpha.get_flattened_data())
    output_data: list[tuple[int, int, int, int]] = []
    for (red_value, green_value, blue_value), alpha_value in zip(
        rgb_data,
        alpha_data,
        strict=True,
    ):
        if alpha_value == 0:
            output_data.append((0, 0, 0, 0))
            continue
        output_data.append(
            (
                min(255, round(min(red_value, alpha_value) * 255 / alpha_value)),
                min(255, round(min(green_value, alpha_value) * 255 / alpha_value)),
                min(255, round(min(blue_value, alpha_value) * 255 / alpha_value)),
                alpha_value,
            )
        )
    output = Image.new("RGBA", size)
    output.putdata(output_data)
    return output


def generate_one(hero_directory: str) -> dict[str, Any]:
    master_path = ROOT / "public" / "assets" / "heroes" / hero_directory / "battle-1star.png"
    output_path = master_path.parent / "runtime" / "battle-1star.png"
    if not master_path.is_file():
        raise FileNotFoundError(f"缺少英雄母版：{master_path.relative_to(ROOT)}")

    master_hash_before = sha256(master_path)
    with Image.open(master_path) as opened:
        if "A" not in opened.getbands():
            raise ValueError(f"英雄母版缺少 Alpha：{master_path.relative_to(ROOT)}")
        image = opened.convert("RGBA")
    alpha_bounds = image.getchannel("A").getbbox()
    if alpha_bounds is None:
        raise ValueError(f"英雄母版没有非透明主体：{master_path.relative_to(ROOT)}")

    subject = image.crop(alpha_bounds)
    subject_width, subject_height = subject.size
    inner_size = math.floor(OUTPUT_SIZE * (1 - SAFE_MARGIN_RATIO * 2))
    scale = min(inner_size / subject_width, inner_size / subject_height)
    resized_size = (
        max(1, round(subject_width * scale)),
        max(1, round(subject_height * scale)),
    )
    resized = premultiplied_resize(subject, resized_size)
    offset = (
        (OUTPUT_SIZE - resized_size[0]) // 2,
        (OUTPUT_SIZE - resized_size[1]) // 2,
    )
    runtime = Image.new("RGBA", (OUTPUT_SIZE, OUTPUT_SIZE), (0, 0, 0, 0))
    runtime.alpha_composite(resized, dest=offset)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    runtime.save(output_path, format="PNG", compress_level=9, optimize=False)

    master_hash_after = sha256(master_path)
    if master_hash_before != master_hash_after:
        raise RuntimeError(f"英雄母版被意外修改：{master_path.relative_to(ROOT)}")
    runtime_bounds = runtime.getchannel("A").getbbox()
    if runtime_bounds is None:
        raise RuntimeError(f"运行纹理没有非透明主体：{output_path.relative_to(ROOT)}")
    corner_alpha = [
        runtime.getpixel((0, 0))[3],
        runtime.getpixel((OUTPUT_SIZE - 1, 0))[3],
        runtime.getpixel((0, OUTPUT_SIZE - 1))[3],
        runtime.getpixel((OUTPUT_SIZE - 1, OUTPUT_SIZE - 1))[3],
    ]
    safety_margins = {
        "left": runtime_bounds[0],
        "top": runtime_bounds[1],
        "right": OUTPUT_SIZE - runtime_bounds[2],
        "bottom": OUTPUT_SIZE - runtime_bounds[3],
    }
    return {
        "heroDirectory": hero_directory,
        "masterPath": master_path.relative_to(ROOT).as_posix(),
        "masterSha256": master_hash_before,
        "originalMode": image.mode,
        "originalSize": list(image.size),
        "alphaBounds": list(alpha_bounds),
        "runtimePath": output_path.relative_to(ROOT).as_posix(),
        "runtimeMode": runtime.mode,
        "runtimeSize": list(runtime.size),
        "runtimeAlphaBounds": list(runtime_bounds),
        "safetyMargins": safety_margins,
        "scale": scale,
        "resizedSubjectSize": list(resized_size),
        "cornerAlpha": corner_alpha,
        "runtimeSha256": sha256(output_path),
    }


def main() -> None:
    assets = [generate_one(hero_directory) for hero_directory in HERO_DIRECTORIES]
    report = {
        "generatorVersion": 1,
        "pillowVersion": pillow_version,
        "outputSize": [OUTPUT_SIZE, OUTPUT_SIZE],
        "safeMarginRatio": SAFE_MARGIN_RATIO,
        "resampling": "Lanczos",
        "unsharpMask": {
            "radius": UNSHARP_RADIUS,
            "percent": UNSHARP_PERCENT,
            "threshold": UNSHARP_THRESHOLD,
        },
        "assets": assets,
    }
    REPORT_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"已生成 {len(assets)} 张运行纹理：{REPORT_PATH.relative_to(ROOT)}")
    for asset in assets:
        print(
            f"- {asset['heroDirectory']}: {asset['runtimeSize']} "
            f"bbox={asset['runtimeAlphaBounds']} sha256={asset['runtimeSha256']}"
        )


if __name__ == "__main__":
    main()
