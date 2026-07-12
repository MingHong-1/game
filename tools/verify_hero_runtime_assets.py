#!/usr/bin/env python3
"""验证英雄母版未变、运行纹理规格、安全边距和报告哈希。"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "tools" / "hero_runtime_assets_report.json"
EXPECTED_SIZE = (256, 256)
MINIMUM_MARGIN = 15


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_asset(asset: dict[str, Any]) -> None:
    master = ROOT / asset["masterPath"]
    runtime = ROOT / asset["runtimePath"]
    if sha256(master) != asset["masterSha256"]:
        raise RuntimeError(f"母版哈希变化：{asset['masterPath']}")
    if sha256(runtime) != asset["runtimeSha256"]:
        raise RuntimeError(f"运行纹理哈希不符：{asset['runtimePath']}")
    with Image.open(runtime) as opened:
        image = opened.convert("RGBA")
    if image.size != EXPECTED_SIZE or image.mode != "RGBA":
        raise RuntimeError(f"运行纹理规格错误：{asset['runtimePath']}")
    corners = [
        image.getpixel((0, 0))[3],
        image.getpixel((255, 0))[3],
        image.getpixel((0, 255))[3],
        image.getpixel((255, 255))[3],
    ]
    if corners != [0, 0, 0, 0]:
        raise RuntimeError(f"运行纹理角落必须透明：{asset['runtimePath']}")
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise RuntimeError(f"运行纹理没有主体：{asset['runtimePath']}")
    margins = (bounds[0], bounds[1], 256 - bounds[2], 256 - bounds[3])
    if min(margins) < MINIMUM_MARGIN:
        raise RuntimeError(
            f"运行纹理安全边距不足：{asset['runtimePath']} margins={margins}"
        )


def main() -> None:
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    assets = report.get("assets", [])
    if len(assets) != 5:
        raise RuntimeError("运行纹理报告必须包含五名英雄")
    for asset in assets:
        verify_asset(asset)
    print(f"运行纹理验证通过：{len(assets)} 张，256×256 RGBA，母版哈希保持不变")


if __name__ == "__main__":
    main()
