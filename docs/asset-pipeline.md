# 《星核守望》资源接入规范

> 阶段：2.5  
> 逻辑画布：1280×720  
> 原则：显式登记、默认禁用、零 404、缺失时程序 fallback、表现不决定玩法

## 1. 总体流程

资源文件只允许放在 `public/assets/`。业务场景不得拼接路径，也不得通过请求不存在文件来探测资源。新资源必须依次完成：

1. 将合法文件放入约定目录。
2. 在 `src/assets/AssetManifest.ts` 的 `GAME_ASSET_MANIFEST` 中增加唯一条目。
3. 先保持 `enabled=false`，执行清单校验并核对路径、许可和规格。
4. 设置 `enabled=true`。
5. 在英雄视觉、怪物视觉、主题、VFX 或音频事件映射中引用 `assetId`。
6. 运行 `npm run typecheck`、`npm test`、`npm run build`。
7. 浏览器检查尺寸、锚点、层级、动画、Console 与 Network。
8. 确认没有 404，程序 fallback 仍可用。

接入资源不应修改 `BattleSimulation`、`EnergySystem`、`SummonSystem`、`HeroBag`、`SlotSystem`、`LanePathGeometry`、`traversalTimeSeconds`、职业攻击阈值或随机流。

## 2. Manifest 规范

每个条目包含：`assetId`、`assetType`、`filePath`、`phaserKey`、`enabled`、`preloadGroup`、owner、`required`、fallback 和可选加载参数。

- `filePath` 相对于 `public/`，必须以 `assets/` 开头。
- 禁止 `..`、反斜杠、远程 URL 和 CDN。
- `assetId` 与 `phaserKey` 在整个清单中唯一。
- Sprite Sheet 必须声明单帧宽高；Texture Atlas 必须声明本地 atlas JSON 数据路径。
- Bitmap Font 同时声明纹理和字体数据路径。
- Web Font 当前只有类型预留；加载适配器完成前不得启用。
- 当前 Manifest 只启用四名运行时英雄的 1 星战场 PNG；未登记的森灵唤师、3/4 星、头像、怪物、背景、音频和特效不会产生请求。

可选资源失败时标记为 `failed`，只输出一次开发日志并回退；必需资源失败时 Boot 显示明确错误并停止进入主菜单。视觉图片具有程序 fallback 时通常应设为可选。

## 3. 目录与命名

```text
public/assets/
├── heroes/<hero-id>/
├── enemies/common|elite|bosses/
├── backgrounds/<theme-id>/
├── effects/projectiles|impacts|status|environment/
├── audio/music|ambience|ui|combat/
└── fonts/
```

文件名使用小写 kebab-case，不添加 `final`、`new`、日期等不稳定后缀。敌人文件继续使用当前真实 enemyId，资源框架不得重命名玩法定义。

## 4. 英雄头像

- 推荐 1024×1024 PNG，透明背景。
- 胸部以上构图，无边框、文字、星级和背景。
- 缩小到 64×64 仍能辨认脸部、职业和主色。
- UI 边框、锁定、选中和星级由组件绘制，不烘焙进头像。
- 锚点默认 `(0.5, 0.42)`，可在 `HeroVisualDefinition` 调整。

头像缺失时 `HeroPortraitProvider` 返回职业色程序占位，不请求未登记路径。

## 5. 英雄战场图与星级图

- 推荐 1024×1024 PNG，透明背景，完整站姿。
- 统一脚底基准，四周至少约 10% 透明安全边距。
- 无地面、背景、文字和大型技能特效。
- 默认使用与当前 3/4 战场一致的朝向。
- 建议命名：`battle-1star.png`、`battle-3star.png`、`battle-4star.png`。
- 2 星沿用 1 星角色图并可使用程序光效表现；4 星是最终形态资源节点。
- 同一英雄在各星级保持脸部、体型、武器和身份一致。

选择规则：1～2 星选 1 星图；3 星选 3 星图并回退 1 星图；4 星选 4 星图并依次回退 3 星、1 星图；全部缺失时回退程序图形。合法局内星级范围固定为 1～4，Manifest 和视觉定义不保留 5 星字段。

### 当前 1 星英雄资源状态

以下文件均已存在并确认为 1254×1254 RGBA：

- `public/assets/heroes/wind-hunter/battle-1star.png`：母版已准备，对应玩法 ID `gale-hunter`；Manifest 启用其 runtime 输出。
- `public/assets/heroes/ember-mage/battle-1star.png`：母版已准备；Manifest 启用其 runtime 输出。
- `public/assets/heroes/stone-vanguard/battle-1star.png`：母版已准备；Manifest 启用其 runtime 输出。
- `public/assets/heroes/starlight-priest/battle-1star.png`：母版已准备；Manifest 启用其 runtime 输出。
- `public/assets/heroes/forest-summoner/battle-1star.png`：母版已准备；对应运行纹理也可生成，但未登记 Manifest、未加载、未加入运行时英雄池。

上述 1254×1254 RGBA 文件均是高分辨率母版，不直接进入 Phaser 正常加载队列，也不得被运行纹理工具覆盖。当前没有 3 星、4 星或头像资源。四张启用运行纹理均为可选资源；加载失败时只报告一次并回退程序图形，不影响召唤、攻击、伤害、星级或胜负。

### 运行纹理生成

浏览器实际加载路径为：

```text
public/assets/heroes/<hero>/runtime/battle-1star.png
```

运行纹理固定为 256×256 PNG RGBA。使用开发工具：

```bash
python -m pip install -r tools/requirements.txt
python tools/generate_hero_runtime_assets.py
python tools/verify_hero_runtime_assets.py
```

工具按 Alpha 计算非透明主体边界，不裁掉非透明像素，在限制方向保留约 7% 透明安全边距；缩放采用预乘 Alpha 的 Lanczos，随后使用 `radius=0.55 / percent=30 / threshold=3` 的轻量 UnsharpMask 恢复轮廓。输出报告 `tools/hero_runtime_assets_report.json` 记录母版与输出 SHA-256、Alpha 边界、缩放比例、四角 Alpha 和安全边距。相同输入与参数必须产生相同 SHA。

Pillow 只属于离线开发工具，固定在 `tools/requirements.txt`，不会进入 Vite 浏览器主包；本地虚拟环境不得提交。

## 6. 怪物战场图

- PNG 使用透明背景和完整身体。
- 统一移动方向、视角和脚底锚点。
- 普通、精英和 Boss 使用清晰不同的尺寸标准。
- 不包含生命条、名称、阴影、状态图标或 UI。
- 行走动画只改变 `VisualContainer` 内容，根节点路径位置由移动渲染器控制。
- Boss 可以更大，但必须通过视觉定义限制最大显示尺度，不能越出走廊或遮挡主要 UI。

## 7. Sprite Sheet 与动画

提交 Sprite Sheet 时同时记录：

- 单帧宽高、总行列数与透明安全区；
- 帧顺序与动画名称；
- `frameRate`、repeat、yoyo 和可打断性；
- 脚底锚点、默认朝向和裁切规则；
- 状态回退关系。

`AnimationClipDefinition` 支持数字帧范围或 frame names；Manifest 已预留 `textureAtlas` 类型并由 Boot 统一加载纹理与本地 JSON。优先级基线为：

```text
death > phaseChange > cast > hit > attack > walk > idle
```

同一状态不得每帧重新启动。缺少动画时回退静态图；缺少静态图时回退程序图形。动画不能决定攻击、伤害、死亡、抵达或胜负。暂停时表现暂停，倍速暂不改变短促 UI Tween 时长；正式战斗动画的倍速策略在阶段 2D 首关验证。

## 8. 背景与战斗主题

- 背景适配 1280×720 逻辑画面。
- 顶部状态栏和底部英雄区不放关键细节。
- 宽走廊区域保持清晰，不让纹理遮挡怪潮和弹道。
- 可以绘制道路质感，但不得把权威路线烘焙为不可替换坐标。
- `BattleThemeDefinition` 只切换背景、前景、环境风格和音频引用，不修改关卡路径、lane 或 `pathProgress`。
- 首个主题为 `mistwood-border`；背景未启用时继续使用程序雾林。

## 9. VFX

资源分类支持 projectile、impact、circleArea、cone、line、chain、persistentArea、aura、status、summon 和 screenEffect。

VFX 只读取已经确定的表现事件，不自行选择目标、制造伤害或施加状态。销毁时必须清理 Tween、Timer、事件和显示对象。当前圆点弹道由 `VfxManager` 的程序 fallback 提供。

## 10. 音频

推荐：

- 音乐和长环境音：OGG 为主，可按目标浏览器补充其他合法格式。
- 短音效：OGG 或 WAV；避免过长尾音和不必要的高采样率。
- 音乐提交循环起止点、建议响度和是否需要淡入淡出。
- 音乐、环境音、UI 音效和战斗音效分别放入对应目录。
- 文件名使用事件或主题语义，例如 `mistwood-border-loop.ogg`、`ui-click.ogg`。

`GameAudioManager` 管理主音量、音乐、音效、环境音和静音。音量范围为 0～1；同一背景音乐不会重复叠加。没有已启用音频时所有调用安全返回且不报错。

## 11. 正式英雄 PNG 接入实例

疾风猎手 1 星战场图已按以下流程完成工程接入：

1. 将母版放入 `public/assets/heroes/wind-hunter/battle-1star.png`。
2. 执行生成与验证工具，得到 `public/assets/heroes/wind-hunter/runtime/battle-1star.png`，并确认母版 SHA 未变化。
3. 在 Manifest 新增 `assetId=hero.gale-hunter.battle.1star`、类型 `heroBattleImage`、runtime 本地路径、唯一 Phaser key、owner 和 `fallback=programmatic`。
4. 校验后设置 `enabled=true`，分组可使用 `battle-core`。
5. 在疾风猎手 `HeroVisualDefinition.battle1StarAssetId` 引用该 assetId。
6. 执行 typecheck、测试、build 与 HTTP 冒烟。
7. 浏览器检查四张 runtime 请求、脚底、格位安全区、选中信息条、武器裁切与透明边缘；母版、森灵唤师和 3/4 星资源不得被请求。

当前视觉配置由 `src/data/visualDefinitions.ts` 管理。阶段 2.5C.2 后，正式英雄使用 256×256 运行纹理和明确的整数目标尺寸：疾风猎手 80px，余烬法师、岩盾先锋、星辉祭司 78px，统一最大画布显示尺寸 84px。个别英雄只通过脚底 anchor 和整数 slot offset 小幅校准；程序 fallback 尺寸不随纹理规则变化。仍需真实 Canvas 复查遮挡、武器边缘和高 DPI 清晰度，不应通过编辑母版 PNG 或修改战斗坐标校准。

## 12. 第一张正式怪物 Sprite Sheet 接入示例

以虚空斥候为例：

1. 放入 `public/assets/enemies/common/void-scout-sheet.png`。
2. 在 Manifest 新增类型 `enemySpriteSheet` 的条目，填写单帧宽高。
3. 设置 `enabled=true` 后，在 `EnemyVisualDefinition.spriteSheetAssetId` 引用。
4. 为 walk、hit、death 等已有帧建立 `AnimationClipDefinition`；没有的状态设置 fallback。
5. Boot 根据已加载纹理注册 Phaser Animation。
6. 执行三项工程验证。
7. 浏览器检查稳定 instanceId、根节点移动、脚底锚点、生命条偏移和折线路径；确认动画只作用 `VisualContainer`。
8. 检查死亡动画不会重复结算，缺失动画仍能安全回退。

## 13. 许可记录

每个正式资源必须在提交说明或同目录清单中记录：

- 原创、AI 生成后人工确认或合法授权；
- 作者/来源；
- 许可类型和证明位置；
- 是否允许修改和商业使用；
- 使用范围与署名要求。

来源不清、禁止商业使用或与其他商业游戏高度相似的资源不得进入 Manifest。
