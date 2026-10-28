# 今日油价 ⛽

全国 31 个省级行政区汽柴油零售价查询网站，数据每日自动更新，部署在 GitHub Pages。

**在线访问**：https://liuyuhang888.github.io/today-oil-price/

## 工作原理（参考 [OilPulse-CN](https://github.com/ZhangHowie/oilpulse-cn) 的方法）

```
GitHub Actions 定时任务（北京时间 06:20 / 22:20）
  └─ scripts/fetch_oil_price.py
       ├─ 主源：镜像 OilPulse-CN 公开数据（无需 API 密钥）
       └─ 备源：解析 youjia.chemcp.com 兜底
            ↓
  data/latest.json          # 最新快照（网站直接读取）
  data/history/YYYY/MM/DD/  # 历史归档
            ↓
  GitHub Pages 自动部署网站
```

- 网站为纯静态单页（`index.html`），无任何构建依赖
- 浏览器按优先级依次尝试：本站同源数据 → 本仓库 jsDelivr CDN → 上游仓库 CDN，任一可用即渲染
- 价格为字符串（如 `"8.55"`），`"0.00"` 表示该省无此牌号，页面显示为 `—`
- 字段：`t0` 0号柴油，`t89` / `t92` / `t95` / `t98` 对应牌号汽油（单位：元/升）

## 数据接口（固定 URL，可直接引用）

| 通道 | URL |
|---|---|
| 本仓库 raw | `https://raw.githubusercontent.com/liuyuhang888/today-oil-price/main/data/latest.json` |
| 本仓库 CDN | `https://cdn.jsdelivr.net/gh/liuyuhang888/today-oil-price@main/data/latest.json` |

## 调整更新时间

修改 `.github/workflows/update.yml` 里的 `cron` 表达式即可（cron 是 UTC，北京时间需减 8 小时）。

## 本地运行

```bash
python scripts/fetch_oil_price.py   # 仅标准库，无第三方依赖
```

## License

MIT。数据源自 [OilPulse-CN](https://github.com/ZhangHowie/oilpulse-cn)（其上游为幂次方 API）与 youjia.chemcp.com，版权归原作者所有。
