#!/usr/bin/env python3
"""
抓取全国 31 省油价 → data/latest.json + data/history/YYYY/MM/DD/HHMM.json

主源：OilPulse-CN 公开数据（ZhangHowie/oilpulse-cn，任何人可直接引用，无需密钥）
备源：youjia.chemcp.com（国内化工产品网油价页，主源不可用时兜底）
两者全失败时：保留现有 data/latest.json 并以非零码退出，绝不写坏数据。
仅用标准库，无第三方依赖。
"""
import base64
import datetime
import json
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

UPSTREAM = "ZhangHowie/oilpulse-cn"
# 依次尝试的镜像地址（不同网络环境下可达性不同）
SOURCE_URLS = [
    f"https://cdn.jsdelivr.net/gh/{UPSTREAM}@main/data/latest.json",
    f"https://fastly.jsdelivr.net/gh/{UPSTREAM}@main/data/latest.json",
    f"https://raw.githubusercontent.com/{UPSTREAM}/main/data/latest.json",
    f"https://gcore.jsdelivr.net/gh/{UPSTREAM}@main/data/latest.json",
]
# GitHub Contents API（raw/jsdelivr 均不通时的可靠通道）
SOURCE_API = f"https://api.github.com/repos/{UPSTREAM}/contents/data/latest.json"

FALLBACK_URL = "https://youjia.chemcp.com/"

PROVINCES = [
    "北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江",
    "上海", "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南",
    "湖北", "湖南", "广东", "广西", "海南", "重庆", "四川", "贵州",
    "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆",
]

FIELDS = ["t0", "t89", "t92", "t95", "t98"]


def http_get(url: str, timeout: int = 25) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (oil-price-mirror)"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def valid(data: dict) -> bool:
    return (
        isinstance(data, dict)
        and isinstance(data.get("provinces"), dict)
        and len(data["provinces"]) >= 20
        and all(
            isinstance(p, dict) and all(f in p for f in FIELDS)
            for p in data["provinces"].values()
        )
    )


def fetch_primary() -> dict:
    for url in SOURCE_URLS:
        try:
            data = json.loads(http_get(url).decode("utf-8"))
            if valid(data):
                print(f"[primary] ok via {url}")
                return data
        except Exception as e:
            print(f"[primary] {url} -> {e}")
    try:
        raw = json.loads(http_get(SOURCE_API).decode("utf-8"))
        data = json.loads(base64.b64decode(raw["content"]).decode("utf-8"))
        if valid(data):
            print("[primary] ok via GitHub Contents API")
            return data
    except Exception as e:
        print(f"[primary] api -> {e}")
    raise RuntimeError("primary source unavailable")


def fetch_fallback() -> dict:
    """解析 youjia.chemcp.com，字段与主源保持同一 schema。"""
    body = http_get(FALLBACK_URL)
    try:
        text = body.decode("utf-8")
    except UnicodeDecodeError:
        text = body.decode("gb18030", errors="ignore")
    text = re.sub(r"\s+", " ", text)

    labels = {"t0": "0号柴油", "t89": "89号汽油", "t92": "92号汽油",
              "t95": "95号汽油", "t98": "98号汽油"}
    provinces, failed = {}, []
    for prov in PROVINCES:
        # 省份名后 300 字符窗口内逐个牌号取价
        idx = text.find(prov)
        if idx < 0:
            failed.append(prov)
            continue
        window = text[idx: idx + 300]
        entry = {"province": prov}
        for field, label in labels.items():
            m = re.search(label + r"[:：]?\s*(\d+(?:\.\d+)?)", window)
            entry[field] = m.group(1) if m else "0.00"
        provinces[prov] = entry

    if len(provinces) < 20:
        raise RuntimeError(f"fallback parsed only {len(provinces)} provinces: {failed}")
    print(f"[fallback] ok, parsed {len(provinces)} provinces, failed={failed}")
    return {
        "updated_at": datetime.datetime.now(
            datetime.timezone(datetime.timedelta(hours=8))
        ).isoformat(),
        "source": FALLBACK_URL,
        "province_count": len(provinces),
        "failed_provinces": failed,
        "provinces": provinces,
    }


def main() -> int:
    try:
        data = fetch_primary()
    except Exception:
        print("[warn] primary failed, trying fallback scraper")
        try:
            data = fetch_fallback()
        except Exception as e:
            print(f"[error] all sources failed: e={e}; keeping existing data")
            return 1

    latest = DATA_DIR / "latest.json"
    changed = True
    if latest.exists():
        try:
            old = json.loads(latest.read_text(encoding="utf-8"))
            # 只比价格内容，updated_at 每次都会变
            if old.get("provinces") == data.get("provinces"):
                changed = False
        except Exception:
            pass

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    latest.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))
    hist = DATA_DIR / "history" / now.strftime("%Y/%m/%d")
    hist.mkdir(parents=True, exist_ok=True)
    (hist / (now.strftime("%H%M") + ".json")).write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"[done] provinces={data['province_count']} "
          f"updated_at={data['updated_at']} content_changed={changed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
