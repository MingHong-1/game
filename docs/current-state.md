# 《星核守望》项目现状基线

> 更新日期：2026-07-11  
> 项目目录：`/Users/bytedance/gmh_github/game`

## 结论

项目已从空仓库完成初始化，并完成阶段 1、阶段 2、阶段 2B、阶段 2C、阶段 2C.1～2C.4b、阶段 2.5、阶段 2.5B 和阶段 2D.1。系统模型保持 `docs/system-models-v1.md` v1.1，局内英雄星级冻结为 1～4 星。当前单体基础攻击已经接入与 Phaser 无关的统一战斗属性和伤害结算内核；20 毫秒固定步长、渲染插值、宽走廊、多通道、能量、召唤、十格和资源框架均保持不变。

当前固定使用疾风猎手、余烬法师、岩盾先锋、星辉祭司组成 4 英雄池；召唤英雄固定显示在底部格位，格位不提供攻击属性或站位加成。数据结构允许以后替换成玩家选择结果。正式英雄、怪物、背景和音频文件尚未提供，因此默认资源清单为空并继续使用程序 fallback；合成、重构和正式技能效果仍未实现。

局内星级的代码权威位于 `src/battle/HeroStar.ts`：最低 1 星、最高 4 星，等价值为 1/2/4/8。召唤仍只生成 1 星英雄；格位、战斗运行态和视觉选择会明确拒绝非法范围，不会静默把非法输入截断为 4 星。4 星在 UI 中显示“满星”，仍可正常攻击和接受现有表现状态，但不能继续升星。合成、特殊合成和遣散尚未实现，本轮没有为它们新增提前实现代码。

## 当前技术栈

| 项目 | 版本或选择 | 说明 |
| --- | --- | --- |
| HTML5 | 原生 | 页面只承载 Phaser 画布，不使用 UI 框架 |
| TypeScript | 7.0.2 | 启用 `strict`、未使用无意义的 `any` |
| Phaser | 4.2.1 | 通过 npm 本地打包，不从 CDN 加载 |
| Vite | 8.1.4 | 开发服务器和生产构建 |
| Vitest | 4.1.10 | 纯战斗规则、状态和随机模块测试 |
| Node.js | 本次验证为 24.18.0 | 项目要求不低于 20.19.0 |
| npm | 本次验证为 11.16.0 | 依赖锁定在 `package-lock.json` |

没有 React、Vue、后端服务或数据库。当前也没有存档实现；后续局外进度只使用浏览器本地存档。

## 当前目录结构

```text
game/
├── .git/                         # 原有 Git 元数据，未重新初始化
├── .idea/                        # 原有 IDE 状态，未修改
├── docs/
│   ├── current-state.md
│   ├── game-design.md
│   ├── implementation-plan.md
│   ├── asset-pipeline.md
│   ├── system-models-v1.md
│   ├── ui-style-guide.md
│   └── progress.md
├── public/
│   └── assets/
│       ├── heroes/               # 五名英雄的资源目录约定与说明
│       ├── enemies/              # 普通、精英和 Boss 资源目录约定
│       ├── backgrounds/          # 章节主题背景目录约定
│       ├── effects/              # 弹道、命中、状态和环境特效目录约定
│       ├── audio/                # 音乐、环境、UI 和战斗音频目录约定
│       └── fonts/                # 本地字体目录约定
├── src/
│   ├── assets/                   # Manifest、加载队列和资源可用性注册
│   ├── audio/                    # 安全静默音频管理与 Phaser 后端
│   ├── battle/
│   │   ├── combat/               # 属性、修改器、伤害类型/标签、解析与应用
│   │   ├── BattleEvents.ts
│   │   ├── BattleSession.ts
│   │   ├── BattleSimulation.ts
│   │   ├── BattleState.ts
│   │   ├── BattleStateMachine.ts
│   │   ├── EnergySystem.ts
│   │   ├── EnemyProgressRegressionMonitor.ts
│   │   ├── HeroBag.ts
│   │   ├── HeroStar.ts
│   │   ├── HeroTargeting.ts
│   │   ├── LanePathGeometry.ts
│   │   ├── LaneSpawnPlanner.ts
│   │   ├── PathGeometry.ts
│   │   ├── RenderInterpolation.ts
│   │   ├── RunRandomStreams.ts
│   │   ├── RunSeed.ts
│   │   ├── SeededRandom.ts
│   │   ├── SlotSystem.ts
│   │   ├── SummonSystem.ts
│   │   ├── WaveRandomStreams.ts
│   │   └── definitions.ts
│   ├── core/
│   │   └── gameConstants.ts
│   ├── data/
│   │   ├── battleConfig.ts
│   │   ├── definitionRegistry.ts
│   │   ├── enemyDefinitions.ts
│   │   ├── heroDefinitions.ts
│   │   ├── levelDefinitions.ts
│   │   ├── visualDefinitions.ts
│   │   ├── battleThemes.ts
│   │   └── audioDefinitions.ts
│   ├── presentation/             # 视觉定义、实体视图、动画、主题、VFX 与事件桥
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   ├── MainMenuScene.ts
│   │   └── PrototypeScene.ts
│   ├── ui/
│   │   ├── BattlefieldView.ts
│   │   ├── components/
│   │   │   ├── BattleNotice.ts
│   │   │   ├── GameButton.ts
│   │   │   ├── HealthBar.ts
│   │   │   ├── HeroSlotView.ts
│   │   │   ├── Panel.ts
│   │   │   └── ResourceDisplay.ts
│   │   ├── state/
│   │   │   ├── BattleUiState.ts
│   │   │   ├── ButtonStateController.ts
│   │   │   ├── EnemyViewTransform.ts
│   │   │   ├── HeroStarUiState.ts
│   │   │   ├── StableViewRegistry.ts
│   │   │   ├── ToastQueue.ts
│   │   │   └── UiCleanupBag.ts
│   │   └── theme/
│   │       ├── uiMetrics.ts
│   │       ├── uiTheme.ts
│   │       └── uiTypography.ts
│   ├── gameConfig.ts
│   ├── main.ts
│   └── style.css
├── tests/
│   ├── AssetManifest.test.ts
│   ├── BattleLayout.test.ts
│   ├── BattleSession.test.ts
│   ├── BattleSimulation.test.ts
│   ├── BattleStateMachine.test.ts
│   ├── EnergySystem.test.ts
│   ├── EnemyProgressRegression.test.ts
│   ├── EnemyTraversalTiming.test.ts
│   ├── GameAudioManager.test.ts
│   ├── HeroBag.test.ts
│   ├── HeroStar.test.ts
│   ├── HeroTargeting.test.ts
│   ├── LanePathGeometry.test.ts
│   ├── LaneSpawnPlanner.test.ts
│   ├── PresentationResources.test.ts
│   ├── RenderInterpolation.test.ts
│   ├── SeededRandom.test.ts
│   ├── RunRandomStreams.test.ts
│   ├── SummonSystem.test.ts
│   ├── ToastQueue.test.ts
│   ├── UiLifecycle.test.ts
│   ├── UiState.test.ts
│   ├── VisualDefinitions.test.ts
│   └── WaveRandomStreams.test.ts
├── .gitignore
├── README.md
├── index.html
├── package-lock.json
├── package.json
├── tsconfig.json
└── vite.config.ts
```

`node_modules/` 和构建产物 `dist/` 在本地验证时生成，均已加入 `.gitignore`。资源子目录只包含说明文档，没有空 PNG、伪造音频或远程素材；只有 `AssetManifest` 中显式启用且通过校验的本地资源才会进入 Phaser 加载队列。

## 当前运行方法

```bash
npm install
npm run dev
```

Vite 默认监听 `127.0.0.1:5173`；端口占用时会自动选择后续可用端口。

其他命令：

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

## 已实现的场景

### BootScene

- 从唯一的 `GAME_ASSET_MANIFEST` 读取已启用资源并显示加载进度。
- 当前清单为空，因此不会发出英雄、怪物、背景或音频请求，也不会依靠 404 判断资源是否存在。
- 可选资源失败时记录一次开发诊断并继续使用 fallback；必需资源失败时在启动界面显示明确错误。
- 加载结束后统一注册可用动画并进入主菜单。

### MainMenuScene

- 使用雾林星核程序背景、统一幻想面板和呼吸星核徽记。
- 显示“星核守望”“雾林边境 · 随机合成塔防”。
- 提供可点击并支持 Enter 键的“开始新战斗”主按钮。
- URL 没有 `seed` 时点击生成新 run seed；存在 `?seed=...` 时优先使用显式种子。

### PrototypeScene

- 显示数据配置生成的宽纵向 S 形走廊、多通道敌人、固定格位英雄、Boss、星核和攻击弹道。
- 支持准备、战斗中、暂停、技能选择、胜利和失败六种互斥状态。
- 支持敌人移动、英雄自动索敌与攻击、伤害、死亡、星核受击和胜负判定。
- 支持初始 15 能量、击杀与波次能量奖励，以及无上限能量累计。
- 支持固定 4 英雄的 8 张洗牌袋召唤、分档费用和固定种子复现。
- 持续显示能量、费用、英雄数量、已解锁格位、扩格进度、英雄名称和星级。
- 非扩格满格或能量不足时禁用召唤；第 9、14、19、24 次成功召唤后的下一次操作可在满格时先扩格再完成召唤。
- 支持暂停、1 倍速、2 倍速、同种子重演、新随机战斗和返回主菜单。
- 十个格位从开局起全部可见；下排第 1～5 格开放，上排第 6～10 格显示半透明锁。
- 第 5、10、15、20、25 次成功召唤依次解锁上排从左到右的第 6～10 格。
- 英雄名称、星级和几何占位图形均显示在所属格位；不支持自由放置，也没有站位属性。
- 开发模式提供可关闭的 FPS、帧耗时、固定模拟步数、插值 alpha、丢弃追帧时间、长帧计数、敌人/弹道/Tween 数、时间、随机种子和状态信息。
- 顶部栏集中星核生命、波次、时间、敌人计数、暂停、倍速、调试和返回入口。
- 下方十格以画布中心为中轴，资源和召唤/预留入口对称分布在两侧，形成完整“星核指挥台”。
- 波次、Boss、召唤、扩格、敌人受击和星核受伤具备轻量且有界的反馈动画。

所有当前画面仍由原创几何图形与文字构成，没有外部图片、音频或其他商业游戏素材。阶段 2.5 只建立长期资源管线，没有伪造最终资产。

## 当前资源与表现框架

- `AssetManifest` 是可请求资源的唯一清单；支持图片、Sprite Sheet、Texture Atlas、背景、特效、音频和字体预留，开发阶段拒绝重复 `assetId`、重复 Phaser key、空路径、远程路径和不匹配的加载参数。
- `AssetRegistry` 区分 disabled、registered、queued、available 和 failed；未启用资源直接返回 unavailable，不进入网络队列。
- `HeroVisualRegistry` 和 `EnemyVisualRegistry` 将玩法 ID 映射为图片、Sprite Sheet、锚点、缩放、层级、动画集与程序 fallback，不修改玩法定义。
- 英雄视觉资源节点为 1/3/4 星：1～2 星使用 1 星资源；3 星回退链为 3→1；4 星回退链为 4→3→1；全部缺失时使用程序图形。
- `HeroBattleView` 封装格位内 idle、summon、attack、buffed 和 disabled 表现；`EnemyBattleView` 保持 `EnemyRootContainer → VisualContainer` 边界，移动根节点仅由插值渲染器写入。
- `HeroStarUiState` 统一生成星级图标、满星文案和是否可继续升星的表现派生值；UI 不通过截断掩盖非法星级。
- `BattleThemeRegistry` 通过关卡 `themeId` 选择背景、前景、道路/星核风格与音乐映射；当前 `mistwood-border` 没有启用图片，继续绘制程序雾林且不改变道路几何。
- `BattlePresentationEventBridge` 只把已经结算的攻击、死亡、抵达与波次事件转换为动画、VFX 和音频请求；表现失败不会取消或重复玩法结果。
- `VfxManager` 支持纹理或程序 fallback 的轻量特效及统一销毁；当前弹道仍使用程序表现。
- `GameAudioManager` 管理主/音乐/音效/环境音量、静音、循环去重、暂停恢复和淡入淡出。当前音频映射为空，因此所有事件安全静默。
- 资源规格、许可记录和第一张英雄 PNG/怪物 Sprite Sheet 的接入步骤见 `docs/asset-pipeline.md`。

## 画面和适配

- 逻辑分辨率固定为 1280×720。
- `Phaser.Scale.FIT` 保持 16:9 比例，`CENTER_BOTH` 负责双向居中。
- 页面容器限制为最大 1600×900，避免在 5K 等高分辨率屏幕上持续放大。
- Phaser 画布后备缓冲保持 1280×720 逻辑尺寸，当前未额外乘以 `devicePixelRatio`；因此 5K 屏幕不会创建无上限超大 Canvas 缓冲。CSS 容器与 Phaser `FIT` 各自只承担外层上限和画布等比适配，不重复放大。
- 页面禁止溢出滚动，外层背景、容器边框和游戏画面颜色有明确区分。
- 场景布局只读取共享尺寸常量，没有在多处重复定义画布尺寸。
- 战斗区约占画面上方 69%，操作区约占下方 31%；星核位于战斗区底部中央且在英雄格位上方。
- 正式道路坐标由 `(640, 72)` 开始，经两次柔和方向转换后抵达 `(640, 464)` 的星核；中心曲线有效长度至少 500 像素。
- 十格展示坐标为：下排第 1～5 格 `(468,642)`、`(554,642)`、`(640,642)`、`(726,642)`、`(812,642)`；上排第 6～10 格使用相同 x 坐标，y 均为 `550`，两排中心均为 `x=640`。
- 走廊宽度从顶部 `500`、中段 `430` 收束到底部 `260`；通道间距基准为 `84`，局部偏移范围为 `±10`，后段不会收束为单点。

## 当前 UI 与基础美工框架

- `src/ui/theme/` 是颜色、字号、布局、圆角、边距、层级和动画时长的单一来源。
- `Panel`、`GameButton`、`ResourceDisplay`、`HeroSlotView`、`HealthBar` 和 `BattleNotice` 提供可复用显示职责。
- `deriveBattleUiState` 只从 `BattleSessionSnapshot` 派生按钮、资源、扩格和结果状态；UI 不维护第二份业务状态。
- `ToastQueue` 上限为 4，重复提示会复用；`UiCleanupBag` 以固定键替换 Tween/事件清理项，防止长期增长。
- 战斗区背景、雾气、森林、岩石、道路、星核和所有单位均为原创程序图形，没有远程或商业素材。
- 当前英雄仍使用几何占位图；正式英雄图片只应替换 `HeroSlotView` 内的 glyph。

## 当前已实现的战斗底座

- `BattleStateMachine` 是战斗状态的唯一可信来源，不使用互相冲突的布尔标记。
- `BattleSimulation` 使用 20 毫秒固定步长，玩法只在固定步骤内更新；敌人和追踪弹道运行时分别保存 `previous/current` 进度或坐标，快照再用 `alpha = accumulator / fixedStep`（限制在 0～1）生成只供显示的插值位置。
- 单帧最多执行 5 个模拟步骤、保留最多 100 毫秒累积模拟时间；输入帧仍受 250 毫秒上限保护，超出的累积时间会被丢弃并计入调试统计，避免无限追赶或一次性推进过远。
- 页面隐藏或窗口失焦时暂停接收真实帧时间并清空待插值余量；恢复后忽略首个旧 delta、重新同步时钟，不追赶后台停留时间。暂停、重置、生成和删除都会同步前后快照，防止漂移、旧位置插值或死亡对象重现。
- `BattlefieldView` 只消费 `renderX/renderY`，不把 Phaser 对象坐标写回战斗逻辑；敌人曲线路径插值先插值 `pathProgress`，再通过 `LanePathGeometry` 映射世界坐标，lane 与 jitter 保持不变。
- 阶段 2C.4a 确认模拟与渲染进度均未回退；视觉跳回来自 `PathGeometry` 在线段节点处瞬间切换法线，外侧通道曾出现最高约 185 像素的世界坐标跳跃。当前使用连续顶点切线和线段内平滑法线，中心路径节点、长度、通道配置和推进时间均未改变。
- 敌人视图由 `StableViewRegistry` 按稳定 `enemy.id` 绑定；数组重排和其他敌人删除不会换绑。运动根容器只有一个位置写入口，受击缩放与透明度 Tween 作用于内部视觉容器。
- 开发模式通过 `EnemyProgressRegressionMonitor` 记录同一实例的模拟/渲染进度；只有超过 `1e-6` 的真实回退才以 `[EnemyProgressRegression]` 输出一次结构化日志，诊断不钳制或修改状态。
- 英雄在职业允许的道路区间内优先攻击 `pathProgress` 最大、即最接近星核的敌人，该目标模式显式记录在 `HeroDefinition.targeting`。
- 普通攻击合法性只读取 `HeroDefinition.minimumAttackPathProgress`：疾风猎手 0.05、余烬法师 0.20、星辉祭司 0.35、岩盾先锋 0.70；英雄格位屏幕坐标不参与射程判断。
- 波次中的敌人池、通道选择和视觉错位分别使用每波独立的 `waveCompositionRng`、`waveLaneRng`、`waveVisualJitterRng`；同一种子与相同输入序列得到相同快照。
- `LanePathGeometry` 使用中心路径法线、通道偏移和局部错位计算敌人世界坐标；所有通道仍共享 0～1 的 `pathProgress`。
- `LaneSpawnPlanner` 支持随机、均匀、中央突袭、两翼、全线怪潮和 Boss 中央/小怪两翼；默认 5 条，配置校验允许 3～7 条。
- 浏览器正常新局由 `crypto.getRandomValues()` 生成 run seed；`?seed=自定义种子` 优先用于初始局，同种子重演不更换 run seed。
- run seed 隔离召唤、战斗、合成和技能随机；`WaveRandomStreams` 使用 `${runSeed}:level:${levelId}:wave:${waveId}:composition|lanes|jitter` 为每波按用途派生独立流。前一波敌人数、通道消费和视觉 jitter 消费均不会推进其他流；战斗、合成和技能流继续为后续系统预留。
- Boss 死亡立即胜利；敌人抵达星核后扣除配置伤害并消失，星核生命为 0 时失败。
- `EnemyDefinition.traversalTimeSeconds` 是唯一推进权威；快速、普通、重甲、精英、Boss 当前分别采用 14、22、30、28、45 秒，路径长度和通道偏移不参与到达时间计算。
- 点击开始后进入关卡配置的 8 秒准备时间；仍使用 `Running` 状态和逻辑时间轴，不新增互相竞争的状态枚举。准备期内可召唤，敌人尚未生成。
- 每波开始前 5 秒由战斗快照提供结构化预告；原型三波相对正式战斗开始时间为 0、18、45 秒，可以重叠。
- 调试快照提供首次生成/抵达、首次实际推进耗时、平均配置推进时间、同屏峰值、最近敌人预计剩余时间和波次开始时间。
- 当前单体基础攻击在原弹道命中时创建 `DamageRequest`，由 `DamageResolver` 纯计算，再由 `DamageApplicationLedger` 在模拟层应用一次；成功后按稳定顺序派发 `damage-applied` 和可选的 `enemy-killed`。
- `CombatStats` 统一攻击力、攻速、暴击、技能/Boss/召唤/输出倍率、穿透、护甲、抗性、承伤、状态强度与控制时长。静态 Definition 只提供基础输入，运行时使用不可变聚合快照，当前没有实际增益修改器。
- 属性修改器已支持 add、multiply、override，顺序为基础值 → add → multiply → override → 合法范围；override 用 priority 和稳定 sourceId 决定，不依赖集合遍历顺序。
- 当前基础攻击标签为 `basicAttack + projectile`；缺少 `damageType` 配置时默认为 physical。疾风猎手基础暴击率 10%，其他当前英雄为 0%，默认暴击伤害 180%。暴击只由独立 `combatRng` 在命中结算时决定。
- 伤害按基础值、1～4 星倍率、输出/标签/Boss 倍率、暴击、防御减伤、目标承伤倍率计算；物理读取护甲，元素读取抗性，真实伤害绕过防御。穿透为百分比后固定值，减伤公式为 `defense/(defense+100)`，上限 70%。当前敌人防御默认 0，正式防御数值待 2D.4。
- 战斗内部不做中间整数取整；`DamageResult` 区分计算伤害、实际伤害和溢出伤害，目标 HP 不低于 0，重复结果和死亡目标不会再次结算。
- 开发环境可用 `?combatDebug=1` 输出成功应用伤害的时间、来源、目标、类型、暴击、防御、最终值和 HP 变化；默认关闭且不影响 RNG。

## 当前已实现的能量、召唤与格位

- `BattleSession` 统一编排战斗、能量、格位和召唤，同时保持各系统可独立测试。
- 当前原型实现仍是初始能量 15；普通、重甲、精英击杀分别奖励 1、2、5，Boss 为 0；每波完成奖励为 2。正式十位数经济和波次预算已在系统模型冻结，等待阶段 2E 迁移。
- 能量采用非负安全整数且没有游戏上限；余额不足时召唤失败且没有副作用。
- 英雄袋每轮包含 4 名英雄各 2 份，使用 `SeededRandom.shuffle` 洗牌，抽完再生成下一袋。
- 费用在累计成功召唤 0、5、10、15、20 次时分别进入 5、6、7、8、9 档。
- 格位在累计成功召唤 0、5、10、15、20、25 次时分别为 5、6、7、8、9、10，最大 10 格。
- 逻辑格位顺序为第 1～10 格；下五上五坐标来自关卡配置，场景不复制十套位置。
- 满格判断使用“下一次成功召唤后的格位数”：第 9、14、19、24 次时可先解锁新格，再扣能量、抽袋、占用新格并提交次数；首次第 5 次扩格同样遵循此事务顺序。
- 其他满格和所有能量不足路径仍在抽袋前拒绝；能量、次数、扩格进度、费用、袋顺序和战斗英雄均保持不变。
- 随机流按 run seed 和职责分层隔离；玩家召唤不会改变波次，任一波的数量或纯视觉随机消费也不会改变后续波次。

## 当前尚未实现的玩法

- 关卡前阵容选择界面；当前由 `BattleSession` 注入固定 4 英雄池
- 英雄合成、紧急重构和命运校准
- 始终可用的“遣散英雄”安全阀；已记录为阶段 3 需求，本轮未实现 UI 或规则入口
- 正式技能效果和技能能量消费；当前只实现技能选择状态占位
- 圆形、锥形、直线穿透、连锁、持续区域等攻击形式；统一伤害内核已实现，但当前仍只有单体弹道接入
- 燃烧、中毒、减速、冰冻、眩晕、护盾、治疗等状态；怪物能力、Boss 阶段和五名英雄具体机制
- 装备、英雄养成、完整关卡和正式美术资源
- 正式英雄、怪物、背景、特效和音频文件；资源接入框架已实现，当前继续使用几何 fallback 和安全静默音频
- 浏览器本地存档

这些内容继续按照 `implementation-plan.md` 分阶段实现，本轮没有提前加入演示性大型临时代码。

## 重要代码位置

| 职责 | 文件 |
| --- | --- |
| 页面入口 | `index.html` |
| Phaser 实例创建 | `src/main.ts` |
| 逻辑尺寸、缩放和场景注册 | `src/gameConfig.ts`、`src/core/gameConstants.ts` |
| 战斗状态、固定步长与渲染插值 | `src/battle/BattleStateMachine.ts`、`src/battle/BattleSimulation.ts`、`src/battle/RenderInterpolation.ts` |
| 战斗属性、修改器、伤害类型、计算和应用 | `src/battle/combat/` |
| 伤害与死亡事件、表现映射 | `src/battle/BattleEvents.ts`、`src/presentation/BattlePresentationEventBridge.ts` |
| 敌人回退诊断与稳定视图身份 | `src/battle/EnemyProgressRegressionMonitor.ts`、`src/ui/state/StableViewRegistry.ts`、`src/ui/state/EnemyViewTransform.ts` |
| 单局系统编排 | `src/battle/BattleSession.ts` |
| 能量、英雄袋、召唤与格位 | `src/battle/EnergySystem.ts`、`src/battle/HeroBag.ts`、`src/battle/SummonSystem.ts`、`src/battle/SlotSystem.ts` |
| 局内 1～4 星权威范围、等价值与满星判断 | `src/battle/HeroStar.ts`、`src/ui/state/HeroStarUiState.ts` |
| run seed、独立随机流、走廊通道与职业攻击区域 | `src/battle/RunSeed.ts`、`src/battle/RunRandomStreams.ts`、`src/battle/WaveRandomStreams.ts`、`src/battle/LanePathGeometry.ts`、`src/battle/LaneSpawnPlanner.ts`、`src/battle/HeroTargeting.ts` |
| 数据契约 | `src/battle/definitions.ts` |
| 英雄职业攻击区域、敌人、关卡、道路与格位配置 | `src/data/` |
| 启动流程 | `src/scenes/BootScene.ts` |
| 显式资源清单、加载与可用性 | `src/assets/` |
| 英雄/怪物视觉定义与章节主题 | `src/data/visualDefinitions.ts`、`src/data/battleThemes.ts` |
| 实体视图、动画、VFX 与表现事件桥 | `src/presentation/` |
| 音频管理、事件映射与 Phaser 后端 | `src/audio/`、`src/data/audioDefinitions.ts` |
| 主菜单与开始入口 | `src/scenes/MainMenuScene.ts` |
| 战斗场景编排与输入 | `src/scenes/PrototypeScene.ts` |
| Phaser 雾林战场、单位、弹道和星核反馈 | `src/ui/BattlefieldView.ts` |
| UI 主题令牌 | `src/ui/theme/` |
| 面板、按钮、资源、格位、生命条和提示 | `src/ui/components/` |
| UI 派生状态、按钮保护、队列和生命周期 | `src/ui/state/` |
| UI 与基础美工规范 | `docs/ui-style-guide.md` |
| 资源目录、规格、许可与启用流程 | `docs/asset-pipeline.md` |
| 页面尺寸上限和居中 | `src/style.css` |

## 当前验证状态

- `npm install`：通过；共审计 50 个包，0 个已知漏洞。
- `npm run typecheck`：通过。
- `npm test`：通过；28 个测试文件、173 个用例全部通过。
- `npm run build`：通过；Vite 转换 77 个模块并生成 `dist/`。
- 开发服务器：已启动；阶段 2C.1 首页与入口模块均由 Vite 正常提供，HTTP 检查通过。
- 阶段 2.5 开发服务器冒烟：Vite 在 `127.0.0.1:5175` 成功启动，首页和转换后的 `src/main.ts` 均返回成功；该检查不等同于真实 Canvas 人工验收。
- 阶段 2.5B HTTP 冒烟：Vite 在本地成功启动，首页和转换后的入口模块均可访问；默认 Manifest 仍为空，没有新增资源请求路径。未完成真实 Canvas 星级交互验收。
- 阶段 2D.1 HTTP 冒烟：Vite 在 `127.0.0.1:5176` 成功启动，首页、转换后的 `src/main.ts` 和 `DamageResolver.ts` 均返回 HTTP 200；未进行真实 Canvas 人工验收。
- `npm run preview`：已启动；生产首页及构建后的 JavaScript、CSS 均返回 HTTP 200。
- 阶段 1、阶段 2 和阶段 2B 人工浏览器验收：用户已确认通过。
- 阶段 2C.4a 人工浏览器验收：通过；已确认外侧通道折点不再发生视觉回退，普通/快速/Boss、多怪、受击、倍速、暂停与后台恢复符合预期，未报告持续回退错误。
- 构建提示：Phaser 完整运行库使主 JavaScript chunk 超过 Vite 默认 500 kB 提示阈值；当前主包约 1,499.66 kB、gzip 394.31 kB，不阻断构建。待首批正式资源接入并形成真实加载性能目标后再评估拆包。

下一阶段是阶段 2D.2“攻击形式与范围查询”。阶段 2D.1 已为其提供统一伤害请求、计算结果和事件边界；状态、怪物能力和英雄具体机制仍依次留给 2D.3～2D.5。
