# 今日油价 ⛽

全国省级行政区汽柴油价格看板，支持移动端和桌面端，部署在 GitHub Pages。

**在线访问**：https://liuyuhang888.github.io/today-oil-price/

- 查看各油品全国均价，搜索省份并比较各地价格。
- 查看当前油价最高和最低的前 10 个地区，可切换油品；并展示价格中位数、地区价差和按均价加油 50 升的参考费用。
- 按大区和油品查看当年各省历史调价记录及归档走势；鼠标悬停、触摸或使用方向键可查看具体日期的各省价格。全国均价为当日有有效价格的省份的算术平均值，不按人口或销量加权；缺失和 `0.00` 的价格不计入统计。

## 数据和更新

GitHub Actions 每天北京时间 06:20 / 22:20 运行 `scripts/fetch_oil_price.py`，优先镜像 [OilPulse-CN](https://github.com/ZhangHowie/oilpulse-cn) 的公开数据，失败时尝试解析 youjia.chemcp.com。抓取全部失败时保留现有数据。

- `data/latest.json`：最新快照。
- `data/history/YYYY/MM/DD/HHMM.json`：北京时间归档快照。
- `data/imported-history.json`：从 [东方财富地区油价](https://data.eastmoney.com/cjsj/oil_default.html) 导入的历史调价记录。来源提供 89、92、95 号汽油和 0 号柴油，不提供 98 号历史价格。
- `data/history-index.json`：合并导入记录和归档的图表索引；同一天优先使用本地最后一次有效快照。每次抓取成功后自动重建；也可单独运行 `python3 scripts/build_history.py` 重建。

图表展示来源提供的调价日期与本地归档日期，标明记录覆盖范围；相隔多天的点之间用虚线连接，中间日期没有实际观测值。2026 年导入记录目前覆盖 1 月 21 日至 9 月 25 日，后续本地归档自动增加；东方财富数据可能滞后。运行 `python3 scripts/import_eastmoney_history.py --year 2026` 可重新导入指定年份（使用公开接口，依赖来源可用），不会覆盖其他年份。

静态页面无需构建依赖。最新价格加载顺序为本站数据、本仓库 CDN、上游数据；历史图表使用本站的历史索引。价格单位为元/升，数据仅供参考，实际价格以当地加油站为准。

## 本地运行

```bash
python3 -m http.server 8000
# 访问 http://localhost:8000/
```

手动更新数据：`python3 scripts/fetch_oil_price.py`（仅使用 Python 标准库）。修改 `.github/workflows/update.yml` 的 UTC cron 可调整更新时间。

## License

MIT。数据源自 OilPulse-CN（其上游为幂次方 API）与 youjia.chemcp.com，版权归原作者所有。
