# 鱼缸几何规格

本文件描述的是**构造规则**，不是任何现有程序的实现。所有公式从物理约束与加工常识推导，用于驱动声明式规则引擎。

单位：**毫米**。坐标系：右手系，Y 轴向上，缸底内表面为 `y = 0`，缸体在 X/Z 上居中。

## 1. 设计参数

| 字段 | 含义 | 典型值 | 约束 |
|---|---|---|---|
| `L` | 缸体长度（左右方向） | 400–2000 | > 0 |
| `W` | 缸体宽度（前后方向） | 300–800 | > 0 |
| `H` | 缸体高度 | 300–900 | > 0 |
| `sideT` | 侧板/前后板厚度 | 6 / 8 / 10 / 12 / 15 | > 0 |
| `bottomT` | 底板厚度 | 8 / 10 / 12 / 15 | > 0 |
| `baffleT` | 隔板厚度 | 5 / 6 / 8 | > 0 |
| `gap` | 胶缝预留 | 1 | ≥ 0 |
| `baffleCount` | 隔板数量 | 1–4 | 1 ≤ n ≤ ⌊L/125⌋ |
| `baffleCut` | 隔板下缘离底高度 | 20–45 | ≥ 0 |
| `overflowW` | 溢流区宽度 | 0 / 69 / 80 | ≥ 0 |
| `sandW` | 沙缸（侧滤）宽度 | 0 / 139 / 150 | ≥ 0 |
| `pumpW` | 泵仓宽度 | 0 / 49 / 90 | ≥ 0 |
| `braceW` | 拉筋宽度 | 0 / 19 / 50 | ≥ 0 或 19 ≤ n |
| `material` | 玻璃等级 | 0 全浮法 / 1 底背超白 / 2 正面超白 / 3 全超白 | — |

## 2. 派生量

由参数一次算出，全缸型共享，不重复推导。

```
outerL  = L - 2·sideT          外观板跨度（左右板之间的净距）
outerW  = W - 2·sideT          外观板跨度（前后板之间的净距）
innerL  = L - 2·sideT - 2·gap  内腔长
innerW  = W - 2·sideT - 2·gap  内腔宽
innerH  = H - bottomT          内腔高
floorY  = bottomT / 2          底板中心 Y（底板下表面贴地）
wallY   = bottomT / 2 + ...    四壁中心 Y = (H - bottomT)/2 + bottomT/2 - ...（见 §3）
volumeL = innerL · innerW · (H - bottomT) / 1e6

// 溢流仓占用后侧深度，横跨腔深的板件（隔板、隔断）只能用到剩下的那部分，
// 否则会直接穿过溢流板。没有溢流仓时这部分等于完整内腔。
floodW  = hasOverflow ? overflowW + baffleT : 0
usableW = innerW - floodW                             可用腔深
usableZ = -innerW/2 + floodW + usableW/2              可用腔中心 z
```

`usable*` 是隔板与隔断的唯一 Z 基准。任何横跨腔深的板件都读它，不读 `innerW`。

**构造约定**：四壁竖立在底板外缘之内，底板夹在四壁中间（水族箱常规做法，底板不受剪切力）。

- 前后板：长边横跨整个 `L`，位于 `z = ±(W - sideT)/2`
- 左右板：长度取 `outerW - 2·gap`，夹在前后板之间，位于 `x = ±(L - sideT)/2`
- 底板：`(outerL - 2·gap) × (outerW - 2·gap)`，绕 X 轴转 90° 使厚度沿 Y

## 3. 板件规则

每条规则是一个纯函数 `(Geom) => Part[]`，可以独立测试和组合。

### 3.0 孔位坐标系

`Hole.x/y/z` 是**板件局部坐标**，原点在板件几何中心，轴与板件自身的 `l/w/h` 对齐
（`l`→X、`w`→Y、`h`→Z），**不随 `rx/ry/rz` 旋转**。挖孔时先在局部空间成形，
再与板件一同变换到世界坐标。

这样一块玻璃改尺寸或换位置时，孔位图案跟着板件走；若用缸体世界坐标，
任何尺寸改动都会让孔落到板外。`Hole.h` 在挖除时需要比板厚略大（过切），
由 `attachHole` 统一加余量，规则本身不必关心。

### 3.1 底板 `floor`

```
尺寸: l = outerL - 2·gap, w = outerW - 2·gap, 厚 = bottomT
位置: (0, floorY, 0), 绕 X 转 90°
```

### 3.2 前后板 `frontBack`（两块）

```
尺寸: l = L, w = H, 厚 = sideT
位置: z = ±(W - sideT)/2, y = H/2
```

### 3.3 左右板 `leftRight`（两块）

```
尺寸: l = outerW - 2·gap, w = H, 厚 = sideT
位置: x = ±(L - sideT)/2, y = H/2, 绕 Y 转 90°
```

### 3.4 拉筋 `brace`（仅当 braceW > 0 且 baffleCut ≥ 2·sideT）

在四壁上缘内侧横向加固，抵消满水侧压。**走向决定旋转与尺寸分配**：竖直方向必须落 `sideT`，
拉筋才有厚度抗弯；水平那一维才是 `braceW`。

```
左右拉筋 ×2（沿缸深 Z 跑）：世界外廓 = braceW × sideT × innerW
    l = innerW, w = sideT, h = braceW, ry = 2
    x = ±(innerL - braceW)/2, y = H - bottomT - sideT
前后拉筋 ×2（沿缸长 X 跑）：世界外廓 = innerL × sideT × braceW
    l = innerL, w = braceW, h = sideT, rx = 2
    z = ±(innerW - braceW)/2, y = H - bottomT - sideT
```

偏移取 `(innerL − braceW)/2` 而不是 `L/2 − …`：拉筋外缘必须落在**内腔壁面**上，
用标称外尺寸会把拉筋嵌进侧壁一个玻璃厚。

### 3.5 溢流板 `overflow`（仅当 overflowW ≥ 70）

后侧隔出一条约 `overflowW` 宽的溢流仓。溢流板距**内腔后壁** `overflowW`，
基准必须是内腔而不是标称外宽，否则溢流仓的实际宽度会被侧壁厚吃掉两倍。

```
尺寸: l = innerL, w = innerH - 10, 厚 = baffleT
位置: z = -innerW/2 + overflowW + baffleT/2, y = bottomT/2 + innerH/2
```

### 3.6 隔板 `baffle`（数量 = `baffleCount - 1`，均匀分布）

把内腔沿长度等分成 `baffleCount` 段。隔板**贴底安装**，缺口留在**上缘**，
水流从隔板顶端翻到下一段（上过水）。

```
段宽   = innerL / baffleCount
第 i 块: l = usableW, w = innerH - baffleCut, 厚 = baffleT
         下缘 = bottomT（贴底），故中心 y = bottomT + (innerH - baffleCut)/2
         x = -innerL/2 + 段宽·i, z = usableZ
```

隔板顶边距缸口 `baffleCut`，这段空隙就是过水通道。

### 3.7 沙缸隔断 `sandDivider`（仅当 sandW > 0）

在侧边隔出宽度 `sandW` 的沙缸区。横跨可用腔深，不得穿过溢流仓。

```
尺寸: l = usableW, w = innerH, 厚 = baffleT
位置: x = L/2 - sandW - baffleT/2, y = bottomT + innerH/2, z = usableZ
```

### 3.8 泵仓隔断 `pumpDivider`（仅当 pumpW > 0）

```
尺寸: l = usableW, w = innerH, 厚 = baffleT
位置: x = -L/2 + pumpW + baffleT/2, y = bottomT + innerH/2, z = usableZ
```

## 4. 参数联动

这些是**加工可行性约束**，违反会导致实物装不出来，所以必须在输入层夹紧：

1. `baffleCount > ⌊L / 125⌋` → 夹到 `⌊L / 125⌋`（每段至少 125mm 才够手伸进去维护）
2. `baffleCut < 2·sideT` → `braceW = 0`（切口太浅，拉筋无处安放）
3. `sandW ≥ 140` 且 `pumpW ≥ 50` → 二者互斥，只能有一个处于加宽态（同时加宽会挤占主缸空间）。
   校验函数是**无状态**的，看不到"哪一个刚被修改"，因此采用可判定的近似：
   **偏离各自默认值更远的一方回落到默认**（并列时沙缸让位，因为泵仓在过滤通路上，
   误判沙缸的代价低于误判泵仓）。接入表单后，调用方可传入 `lastChanged`
   以获得"后改动者推回默认"的严格语义。
4. `bottomT + 2·sideT ≥ H` → 拒绝（玻璃厚度吃掉了全部内腔）
5. 任一边 ≤ 0 → 拒绝

## 5. 一致性约束（测试基准）

这些断言不依赖任何外部输出，纯粹从几何自洽性推出。实现必须全部满足：

- **C1** 所有板件尺寸 > 0，位置为有限数
- **C2** 所有板件包围盒落在缸体包围盒 `[-L/2, L/2] × [0, H] × [-W/2, W/2]` 内（容许 1mm 胶缝溢出）
- **C3** 前后板外表面间距 = `W`（即外观宽等于标称宽）
- **C4** 左右板外表面间距 = `L`
- **C5** 底板的上表面 = `y = bottomT`，与四壁内侧底部对齐
- **C6** 相邻板件之间间隙 ∈ `[0, 2·gap]`，不重叠不穿透
- **C7** 内腔体积与 `volumeL` 一致（误差 < 0.5%）
- **C8** 隔板均匀分布：相邻隔板中心距相等
- **C9** `overflowW < 70` 时不生成溢流板（不是缺陷，是设计）
- **C10** `baffleCut < 2·sideT` 时不生成拉筋

## 6. 材质分区

`material` 决定每块玻璃的等级，影响报价与渲染：

| 值 | 含义 | 底板 | 前后板 | 左右板 |
|---|---|---|---|---|
| 0 | 全浮法 | 浮法 | 浮法 | 浮法 |
| 1 | 底背超白 | 超白 | 后超白、前浮法 | 浮法 |
| 2 | 正面超白 | 浮法 | 前超白、后浮法 | 浮法 |
| 3 | 全超白 | 超白 | 超白 | 超白 |

## 7. 缸型扩展

`jar` 的规则集是基础。其余缸型在它之上增删：

| 缸型 | 规则差异 |
|---|---|
| `jar` 标准鱼缸 | 基础 |
| `rack` 铝架 | 基础 + 铝型材框架规则（替换柜体） |
| `sys` 系统组缸 | 基础 + 多仓隔断（沙缸 + 泵仓同时启用） |
| `filter` 底滤 | 基础 + 溢流 + 隔板组（底缸无拉筋） |
| `upfilter` 上滤 | 基础 + 顶部过滤槽规则 |
| `sideback` 背侧滤 | 基础 + 背仓隔断。**背仓与溢流仓互斥**：`overflowW ≥ 70` 时溢流仓本身就是背仓，不再生成独立背仓隔断，否则两块板会在同一段深度里互相围合 |
| `whole` 客厅缸 | 基础 + 柜体 + 灯架 |
| `seafood` 海鲜池 | 基础 + 保温层 + 多格分池 |

每种缸型只声明自己的规则差异，求解器统一执行。
