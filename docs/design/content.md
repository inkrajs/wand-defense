# 无尽巫师内容数据

<!-- implemented-catalog:start -->

## 当前已实现内容目录（2026-11-04）

以下从实际定义生成，优先于后文的历史草案。共 **140 种**：法术 65、奥术 29、装备 18、道具 8、怪物 18、额外法杖模板 2；另有 54 条合成配方。初始 3×3 法杖是初始实例，不重复计入模板数。

数值是当前原型的基础定义，不是平衡定案；实例品质、角色成长、装备、奖励、途径和相邻奥术会改变实际效果。空间使用 0～100 战场坐标，时间参数以毫秒计。定义全表仅供开发；普通 Agent 与游戏手册继续按玩家已知信息过滤。更新本段：`node --import tsx scripts/update-content-doc.mjs`。

### 法术

| ID / 名称 | 属性 / 类型 | 占格 | 力量 / 法力 / 冷却 / 射程 | 实际行为 |
| --- | --- | --- | --- | --- |
| piercing-gale / 穿风刃 | wind / projectile | 0,0; 1,0; 2,0 | 14 / 8 / 1000 / 30 | 发射穿风刃沿直线穿透目标，最多命中4个敌人；命中时击退敌人。 |
| glacial-lance / 冰棱贯刺 | water / projectile | 0,0; 1,0; 2,0 | 16 / 9 / 1250 / 32 | 发射冰棱贯刺沿直线穿透目标，最多命中3个敌人，冲洗命中处附近血迹；命中后敌人移动速度变为65%，持续1.6秒。 |
| ember-comet / 烬星 | fire / projectile | 0,0; 1,0; 0,1; 1,1 | 20 / 14 / 1800 / 30 | 发射烬星攻击目标，命中后伤害周围敌人，最多6个；灼烧每0.6秒造成威力20%伤害，持续1.8秒。 |
| solar-storm / 日耀风暴 | fire / area | 0,0; 1,0; 2,0; 0,1; 1,1; 2,1; 0,2; 1,2; 2,2 | 5 / 40 / 8000 / 100 | 日耀风暴覆盖屏内全域，持续周期伤害敌人；灼烧每0.6秒造成威力15%伤害，持续1.2秒。 |
| tidal-prison / 潮汐囚笼 | water / area | 0,0; 1,0; 0,1; 1,1 | 5 / 18 / 3000 / 32 | 潮汐囚笼覆盖区域，持续周期伤害附近敌人；命中后敌人移动速度变为50%，持续0.8秒。 |
| cinder-ring / 余烬之环 | fire / area | 0,0; 1,0; 0,1; 1,1 | 6 / 22 / 3500 / 22 | 以角色为中心扩散余烬之环，命中周围敌人；灼烧每0.6秒造成威力15%伤害，持续1.2秒。 |
| repulse-wave / 震退波 | wind / area | 0,0; 1,0; 0,1; 1,1 | 6 / 20 / 3000 / 20 | 以角色为中心扩散震退波，命中周围敌人；命中时击退敌人。 |
| prism-ray / 棱镜光束 | light / beam | 0,0; 1,0; 2,0 | 7 / 16 / 2800 / 36 | 棱镜光束沿固定方向持续脉冲攻击线内敌人；命中后敌人移动速度变为80%，持续0.9秒。 |
| storm-spear / 风暴之矛 | lightning / chain | 0,0; 1,0; 2,0 | 18 / 15 / 2000 / 34 | 立即命中目标，再向附近敌人逐跳传导，每跳伤害乘以0.82，最多命中8个目标。 |
| ember-familiar / 烬火灵 | fire / summon | 0,0; 1,0 | 8 / 12 / 2400 / 30 | 召唤烬火灵，发射弹体攻击敌人，持续10秒；灼烧每0.6秒造成威力20%伤害，持续1.2秒。 |
| frost-wisp / 霜缕灵 | water / summon | 0,0; 0,1 | 7 / 11 / 2200 / 30 | 召唤霜缕灵，发射弹体攻击敌人，持续10秒；命中后敌人移动速度变为75%，持续1.2秒。 |
| thorn-guardian / 荆棘卫士 | wood / summon | 0,0; 1,0; 0,1; 1,1 | 14 / 16 / 3200 / 3 | 召唤荆棘卫士，近战攻击敌人，持续14秒。 |
| ember-turret / 烬火炮台 | fire / building | 0,0; 1,0; 0,1; 1,1 | 10 / 14 / 3000 / 34 | 部署烬火炮台（6金币），持续16秒远程攻击敌人；灼烧每0.6秒造成威力15%伤害，持续1.2秒。 |
| frost-pylon / 霜纹塔 | water / building | 0,0; 1,0; 0,1; 1,1 | 8 / 14 / 3200 / 32 | 部署霜纹塔（8金币），持续18秒远程攻击敌人；命中后敌人移动速度变为80%，持续1秒。 |
| restorative-totem / 复苏图腾 | wood / building | 0,0; 1,0; 2,0; 0,1; 1,1; 2,1; 0,2; 1,2; 2,2 | 6 / 18 / 4000 / 24 | 部署复苏图腾（10金币），持续20秒治疗附近友军。 |
| meteor / 陨石术 | earth / area | 0,0; 1,0; 0,1; 1,1 | 48 / 22 / 3000 / 34 | 陨石术锁定地面位置，延迟后落下攻击范围内敌人；灼烧每0.6秒造成威力12%伤害，持续1.8秒。 |
| meteor-shower-small / 小流星雨 | earth / area | 0,0; 1,0; 0,1; 1,1 | 22 / 32 / 4200 / 34 | 在目标附近接连落下3颗陨石，分别造成范围伤害；灼烧每0.6秒造成威力10%伤害，持续1.2秒。 |
| meteor-shower-large / 大流星雨 | earth / area | 0,0; 1,0; 2,0; 0,1; 1,1; 2,1; 0,2; 1,2; 2,2 | 28 / 48 / 6000 / 36 | 在目标附近接连落下5颗陨石，分别造成范围伤害；灼烧每0.6秒造成威力12%伤害，持续1.8秒。 |
| worldfall / 灭世陨石 | earth / area | 0,0; 1,0; 2,0; 0,1; 1,1; 2,1; 0,2; 1,2; 2,2 | 40 / 80 / 9000 / 42 | 在目标附近接连落下8颗陨石，分别造成范围伤害；灼烧每0.6秒造成威力15%伤害，持续1.8秒。 |
| ember-seed / 炽种 | fire / projectile | 0,0 | 7 / 5 / 900 / 23 | 发射炽种攻击目标，命中后造成伤害；灼烧每0.6秒造成威力20%伤害，持续1.8秒。 |
| frost-drop / 霜滴 | water / projectile | 0,0 | 6 / 4 / 850 / 24 | 发射霜滴攻击目标，冲洗命中处附近血迹；命中后敌人移动速度变为70%，持续1.3秒。 |
| thorn-seed / 棘种 | wood / projectile | 0,0 | 8 / 4 / 900 / 25 | 发射棘种沿直线穿透目标，最多命中2个敌人。 |
| iron-spark / 铁砂 | metal / projectile | 0,0 | 5 / 3 / 600 / 27 | 发射铁砂攻击目标，命中后造成伤害。 |
| static-spark / 静电 | lightning / chain | 0,0 | 6 / 5 / 1000 / 23 | 立即命中目标，再向附近敌人逐跳传导，每跳伤害乘以0.6，最多命中2个目标。 |
| gust / 微风 | wind / projectile | 0,0 | 5 / 3 / 750 / 23 | 发射微风攻击目标，命中后造成伤害；命中时击退敌人。 |
| pebble / 石子 | earth / projectile | 0,0 | 13 / 6 / 1300 / 24 | 发射石子攻击目标，命中后造成伤害。 |
| glimmer / 微光 | light / shield | 0,0 | 8 / 6 / 2800 / 20 | 微光为领地提供少量护盾。 |
| night-mote / 暗烬 | dark / projectile | 0,0 | 12 / 6 / 1400 / 26 | 发射暗烬攻击目标，命中后造成伤害；命中后敌人移动速度变为85%，持续0.9秒。 |
| steam-cloud / 蒸汽云 | water / area | 0,0; 1,0; 0,1; 1,1 | 4 / 20 / 3200 / 30 | 蒸汽云覆盖区域，持续周期伤害附近敌人；命中后敌人移动速度变为80%，持续0.9秒。 |
| conductive-tide / 鸣潮 | lightning / chain | 0,0; 1,0; 0,1; 1,1 | 12 / 20 / 2400 / 32 | 立即命中目标，再向附近敌人逐跳传导，每跳伤害乘以0.75，最多命中4个目标；命中后敌人移动速度变为80%，持续0.9秒。 |
| magma-lance / 熔岩刺 | fire / projectile | 0,0; 1,0; 2,0 | 24 / 16 / 1900 / 34 | 发射熔岩刺沿直线穿透目标，最多命中3个敌人；灼烧每0.6秒造成威力18%伤害，持续1.8秒。 |
| twilight-field / 暮光域 | dark / area | 0,0; 1,0; 0,1; 1,1 | 6 / 24 / 3800 / 31 | 暮光域覆盖区域，持续周期伤害附近敌人。 |
| spark / 火花 | fire / projectile | 0,0 | 10 / 4 / 700 / 24 | 发射火花攻击目标，命中后造成伤害。 |
| fireball / 火球 | fire / projectile | 0,0; 1,0 | 25 / 10 / 1100 / 30 | 火球飞行中逐渐加速，接触目标后造成伤害；灼烧每0.6秒造成威力20%伤害，持续2.4秒。 |
| regrowth / 回春 | wood / heal | 0,0; 1,0; 0,1 | 18 / 12 / 3200 / 20 | 恢复领地生命。 |
| metal-needle / 金针 | metal / projectile | 0,0; 1,0; 2,0 | 16 / 7 / 850 / 28 | 发射金针攻击目标，命中后造成伤害。 |
| water-bolt / 水弹 | water / projectile | 0,0; 0,1 | 8 / 3 / 600 / 26 | 发射水弹攻击目标，冲洗命中处附近血迹；命中后敌人移动速度变为75%，持续1.2秒。 |
| lightning-bolt / 雷矢 | lightning / projectile | 0,0; 1,0; 1,1 | 22 / 9 / 1300 / 36 | 发射雷矢攻击目标，命中后造成伤害。 |
| wind-blade / 风刃 | wind / projectile | 0,0; 1,0 | 6 / 2 / 350 / 22 | 发射风刃攻击目标，命中后造成伤害；命中时击退敌人。 |
| rock-shot / 岩弹 | earth / projectile | 0,0; 1,0; 0,1; 1,1 | 36 / 12 / 1800 / 30 | 发射岩弹攻击目标，命中后造成伤害。 |
| flame-lance / 炎矛 | fire / projectile | 0,0; 1,0; 2,0 | 20 / 9 / 1300 / 35 | 发射炎矛沿直线穿透目标，最多命中3个敌人。 |
| cinder-burst / 熔爆 | fire / projectile | 0,0; 1,0; 0,1; 1,1 | 30 / 14 / 1800 / 30 | 发射熔爆攻击目标，命中后伤害周围敌人，最多6个。 |
| thorn-shot / 荆刺 | wood / projectile | 0,0; 1,0 | 7 / 2 / 300 / 25 | 发射荆刺攻击目标，命中后造成伤害。 |
| renewal / 生息 | wood / heal | 0,0; 1,0; 0,1 | 30 / 15 / 4200 / 20 | 以较高法力消耗恢复更多领地生命。 |
| tidal-orb / 潮涌 | water / projectile | 0,0; 1,0; 0,1; 1,1 | 24 / 12 / 1700 / 32 | 潮涌命中后伤害周围目标，并冲洗附近血迹。 |
| stone-spike / 岩刺 | earth / projectile | 0,0; 1,0; 2,0 | 28 / 11 / 1500 / 34 | 发射岩刺沿直线穿透目标，最多命中2个敌人。 |
| iron-disc / 飞刃 | metal / projectile | 0,0; 1,0; 1,1 | 18 / 8 / 1100 / 32 | 发射飞刃沿直线穿透目标，最多命中3个敌人。 |
| gale-burst / 风爆 | wind / projectile | 0,0; 1,0; 0,1; 1,1 | 15 / 10 / 1200 / 28 | 发射风爆攻击目标，命中后伤害周围敌人，最多7个。 |
| arc-chain / 电弧 | lightning / chain | 0,0; 1,0; 1,1 | 18 / 12 / 1600 / 32 | 立即命中目标，再向附近敌人逐跳传导，每跳伤害乘以0.7，最多命中3个目标。 |
| light-arrow / 光矢 | light / projectile | 0,0; 1,0 | 9 / 3 / 400 / 38 | 发射光矢攻击目标，命中后造成伤害。 |
| dark-orb / 暗蚀 | dark / projectile | 0,0; 1,0; 0,1; 1,1 | 32 / 16 / 2000 / 30 | 发射暗蚀攻击目标，命中后伤害周围敌人，最多5个。 |
| ward / 光盾 | light / shield | 0,0; 1,0 | 25 / 12 / 3500 / 20 | 为领地增加护盾。 |
| solar-ray / 光束 | light / beam | 0,0; 1,0; 2,0 | 5 / 12 / 2200 / 38 | 光束沿固定方向持续脉冲攻击线内敌人。 |
| ember-ray / 炎流 | fire / beam | 0,0; 1,0; 2,0; 1,1 | 8 / 18 / 3200 / 30 | 炎流沿固定方向持续脉冲攻击线内敌人；灼烧每0.6秒造成威力15%伤害，持续1.8秒。 |
| void-ray / 幽光 | dark / beam | 0,0; 1,0; 0,1; 1,1 | 18 / 20 / 4000 / 34 | 幽光沿固定方向持续脉冲攻击线内敌人。 |
| spark-hop / 跳电 | lightning / chain | 0,0; 1,0 | 8 / 4 / 650 / 26 | 立即命中目标，再向附近敌人逐跳传导，每跳伤害乘以0.6，最多命中3个目标。 |
| thunder-chain / 雷链 | lightning / chain | 0,0; 1,0; 2,0; 1,1 | 20 / 14 / 1800 / 36 | 立即命中目标，再向附近敌人逐跳传导，每跳伤害乘以0.85，最多命中4个目标。 |
| storm-net / 雷网 | lightning / chain | 0,0; 1,0; 0,1; 1,1 | 12 / 16 / 2100 / 30 | 立即命中目标，再向附近敌人逐跳传导，每跳伤害乘以0.8，最多命中6个目标。 |
| thunder-strike / 落雷 | lightning / area | 0,0; 1,0; 1,1 | 24 / 12 / 1800 / 36 | 落雷锁定地面位置，延迟后落下攻击范围内敌人。 |
| frost-ring / 冰环 | water / area | 0,0; 1,0; 0,1; 1,1 | 12 / 14 / 2200 / 18 | 以角色为中心扩散冰环，命中周围敌人；命中后敌人移动速度变为50%，持续1.8秒。 |
| earth-spikes / 地刺 | earth / area | 0,0; 1,0; 2,0 | 30 / 15 / 2600 / 32 | 地刺预兆后从地面刺出，攻击范围内敌人。 |
| fire-field-bolt / 焰域弹 | fire / projectile | 0,0; 1,0; 0,1; 1,1 | 6 / 12 / 2400 / 30 | 发射焰域弹，命中后展开持续领域，周期伤害附近敌人。 |
| thunder-field-bolt / 雷域弹 | lightning / projectile | 0,0; 1,0; 0,1; 1,1 | 7 / 14 / 2600 / 34 | 发射雷域弹，命中或飞抵射程后展开持续领域，周期伤害附近敌人。 |
| thunderstorm / 雷暴 | lightning / area | 0,0; 1,0; 2,0; 0,1; 1,1; 2,1; 0,2; 1,2; 2,2 | 8 / 45 / 8000 / 100 | 雷暴覆盖屏内全域，持续周期伤害敌人。 |
| moving-storm / 风暴 | wind / area | 1,0; 0,1; 1,1; 2,1; 1,2 | 6 / 24 / 5000 / 12 | 风暴移动牵引周围敌人，持续造成周期伤害。 |

### 召唤与建筑参数

| 名称 | 生命 / 存续 / 间隔 / 同源上限 | 行为 / 攻击方式 | 移动 / 弹速 / 金币 |
| --- | --- | --- | --- |
| 烬火灵 | 22 / 10000 / 1000 / 3 | attack / projectile | 10 / 65 / 0 |
| 霜缕灵 | 20 / 10000 / 1100 / 3 | attack / projectile | 11 / 70 / 0 |
| 荆棘卫士 | 55 / 14000 / 1200 / 2 | attack / contact | 8 / — / 0 |
| 烬火炮台 | 65 / 16000 / 1200 / 3 | attack / projectile | 0 / 72 / 6 |
| 霜纹塔 | 75 / 18000 / 1400 / 3 | attack / projectile | 0 / 68 / 8 |
| 复苏图腾 | 90 / 20000 / 1600 / 2 | heal / contact | 0 / — / 10 |

### 奥术

| ID / 名称 | 修饰 / 基础值 | 占格 | 效果 |
| --- | --- | --- | --- |
| amplify / 增幅 | amplify / 1.5 | 0,0 | 增强相邻法术的力量。 |
| double / 双重 | double / 2 | 0,0; 1,0 | 相邻攻击法术分2次连发；治疗与护盾效果重复生效。 |
| split / 分裂 | split / 2 | 0,0; 0,1 | 相邻飞弹、光束与雷链同时分支，区域法术可展开多个落点或环。 |
| focus / 聚焦 | focus / 1.25 | 0,0; 1,0; 2,0 | 增强相邻法术的力量与射程。 |
| haste / 迅捷 | haste / 0.85 | 0,0 | 缩短相邻法术的冷却时间。 |
| efficiency / 节能 | efficiency / 0.8 | 0,0 | 降低相邻法术的法力消耗。 |
| reach / 延展 | reach / 1.25 | 0,0; 1,0 | 增加相邻法术的射程。 |
| velocity / 疾行 | velocity / 1.3 | 0,0; 0,1 | 提高相邻飞弹的飞行速度。 |
| area / 广域 | area / 1.3 | 0,0; 1,0; 0,1 | 扩大相邻法术的区域、溅射与连锁范围，并加宽光束。 |
| quadruple / 四发 | double / 4 | 0,0; 1,0; 0,1; 1,1 | 相邻攻击法术分4次连发；治疗与护盾效果重复生效。 |
| sextuple / 六发 | double / 6 | 0,0; 1,0; 2,0; 0,1; 1,1; 2,1 | 相邻攻击法术分6次连发；治疗与护盾效果重复生效。 |
| pierce / 穿透 | pierce / 1 | 0,0; 0,1 | 相邻的普通或穿透飞弹额外穿透1个目标，最多8个；不覆盖溅射、连锁或领域效果。 |
| slow / 迟缓 | slow / 0.75 | 0,0 | 相邻攻击法术命中后使敌人移动速度变为75%，持续1.5秒；已有更强迟缓保留。 |
| burn / 灼烧 | burn / 0.2 | 0,0; 1,0 | 相邻攻击法术命中后施加灼烧，每0.5秒造成法术威力20%的伤害，持续3秒；同一来源刷新。 |
| knockback / 击退 | knockback / 3 | 0,0 | 相邻攻击法术命中后沿攻击方向额外击退3距离，单次最多12。 |
| duration / 延时 | duration / 1.3 | 0,0; 1,0 | 相邻光束、持续领域和旋涡的持续时间增加30%，最多5秒；召唤物与建筑最多30秒；不改变伤害间隔。 |
| capacity / 扩容 | capacity / 2 | 0,0; 1,0; 0,1 | 相邻已有多目标法术的目标容量增加2，通常最多8个；全战场领域最多64个；召唤物与建筑的同源存续上限增加2，最多8个。 |
| precision / 精准 | precision / 0.1 | 0,0 | 相邻攻击法术命中率增加10个百分点，最高100%。 |
| hit-trigger / 击发符 | hitTrigger / 1 | 0,0 | 与两个法术相邻：前一个飞弹命中时释放后一个飞弹或区域法术，施放时预付两者法力。 |
| timer-trigger / 刻时符 | timerTrigger / 500 | 0,0 | 与两个法术相邻：前一个飞弹飞行0.5秒后释放后一个飞弹或区域法术；提前碰撞则失效，预付两者法力。 |
| short-reach / 寸进 | reach / 1.12 | 0,0 | 相邻法术射程增加12%。 |
| light-flight / 轻羽 | velocity / 1.15 | 0,0 | 相邻飞弹速度增加15%。 |
| tiny-area / 微域 | area / 1.12 | 0,0 | 相邻法术的作用范围增加12%。 |
| ember-core / 火芯 | burn / 0.08 | 0,0 | 相邻攻击法术附加较弱的灼烧。 |
| triple / 三发 | double / 3 | 0,0; 1,0; 2,0 | 相邻攻击法术分次连发3次。 |
| octuple / 八发 | double / 8 | 0,0; 1,0; 2,0; 0,1; 1,1; 2,1; 0,2; 1,2 | 相邻攻击法术分次连发8次。 |
| greater-area / 宏域 | area / 1.7 | 0,0; 1,0; 0,1; 1,1 | 相邻法术的作用范围增加70%。 |
| greater-burn / 烈焰 | burn / 0.35 | 0,0; 1,0; 0,1 | 相邻攻击法术附加强力灼烧。 |
| greater-reach / 远界 | reach / 1.5 | 0,0; 1,0; 2,0 | 相邻法术射程增加50%。 |

### 装备（每件一格）

| ID / 名称 | 槽位 | 基础加成 |
| --- | --- | --- |
| apprentice-hat / 学徒帽 | head | {"maxMana":15,"manaRegen":0.5} |
| astrologer-hood / 占星兜帽 | head | {"critChance":0.03,"maxMana":10} |
| rune-robe / 魔纹袍 | body | {"manaRegen":1,"maxMana":10} |
| heartguard-armor / 护心甲 | body | {"attack":3,"accuracy":0.03} |
| swift-boots / 轻行靴 | feet | {"castSpeedPercent":5,"projectileSpeedPercent":10} |
| farwatch-boots / 远望靴 | feet | {"range":3,"accuracy":0.02} |
| copper-ring / 铜戒 | accessory | {"attack":2,"critChance":0.02} |
| gatherer-charm / 采集符 | accessory | {"gatheringPercent":10} |
| spring-pendant / 灵泉坠 | accessory | {"maxMana":20,"manaRegen":1} |
| ember-circlet / 余烬冠环 | head | {"critMultiplier":0.2,"elementBonuses":{"fire":0.12}} |
| frost-lens / 霜晶目镜 | head | {"accuracy":0.04,"maxMana":12,"elementBonuses":{"water":0.08}} |
| sage-crown / 贤者冠冕 | head | {"manaRegen":0.8,"elementBonuses":{"wood":0.08}} |
| windweave-mantle / 风织法衣 | body | {"castSpeedPercent":4,"projectileSpeedPercent":8,"elementBonuses":{"wind":0.05}} |
| heartwood-vest / 心木护衣 | body | {"attack":2.5,"maxMana":12,"elementBonuses":{"earth":0.05}} |
| gale-greaves / 疾风胫甲 | feet | {"range":1.5,"projectileSpeedPercent":15} |
| tracker-boots / 寻迹短靴 | feet | {"accuracy":0.03,"luck":2} |
| fortune-knot / 丰收结绳 | accessory | {"luck":3,"gatheringPercent":3} |
| starfall-signet / 星陨印戒 | accessory | {"critChance":0.025,"critMultiplier":0.3,"elementBonuses":{"lightning":0.08}} |

### 道具

| ID / 名称 | 基础效果 | 占格 |
| --- | --- | --- |
| health-potion / 生命药水 | {"type":"territoryHeal","value":40} | 0,0 |
| shield-potion / 护盾药水 | {"type":"territoryShield","value":30} | 0,0; 1,0 |
| mana-potion / 法力药水 | {"type":"partyMana","value":50} | 0,0; 0,1 |
| restoration-elixir / 复元灵剂 | {"type":"territoryRestore","value":25} | 0,0; 1,0; 0,1 |
| mana-surge / 法力涌剂 | {"type":"partyManaPercent","value":25} | 0,0; 1,0 |
| hourglass-dust / 时砂 | {"type":"cooldownAdvance","value":1000} | 0,0 |
| vitality-essence / 生命精华 | {"type":"territoryHealPercent","value":25} | 0,0; 0,1 |
| aegis-essence / 护盾精华 | {"type":"territoryShieldPercent","value":25} | 0,0; 1,0; 1,1 |

### 怪物

| ID / 名称 | 尺寸 | 出生参数 |
| --- | --- | --- |
| enemy-basic / 灰泥怪 | normal | {"unlockWave":1,"hpMultiplier":1,"damageMultiplier":1,"speedMultiplier":1,"cooldownMultiplier":1} |
| enemy-moss / 苔团 | small | {"unlockWave":2,"hpMultiplier":0.8,"damageMultiplier":0.8,"speedMultiplier":0.9,"cooldownMultiplier":1.1,"movementMode":"straight"} |
| enemy-ember / 焰灵 | small | {"unlockWave":3,"hpMultiplier":0.75,"damageMultiplier":1.2,"speedMultiplier":1.2,"cooldownMultiplier":0.9,"movementMode":"huntCharacter"} |
| enemy-frost-moth / 霜蛾 | small | {"unlockWave":4,"hpMultiplier":0.65,"damageMultiplier":0.8,"speedMultiplier":1.35,"cooldownMultiplier":1.1,"movementMode":"huntCharacter"} |
| enemy-shadow-bat / 影蝠 | small | {"unlockWave":6,"hpMultiplier":0.7,"damageMultiplier":1,"speedMultiplier":1.4,"cooldownMultiplier":0.9,"movementMode":"huntCharacter"} |
| enemy-sand-beetle / 砂甲虫 | large | {"unlockWave":8,"hpMultiplier":1.8,"damageMultiplier":1.3,"speedMultiplier":0.7,"cooldownMultiplier":1.2,"movementMode":"straight"} |
| enemy-crystal-crab / 晶蟹 | normal | {"unlockWave":10,"hpMultiplier":1.4,"damageMultiplier":1.15,"speedMultiplier":0.85,"cooldownMultiplier":1} |
| enemy-iron-guard / 铸铁卫 | normal | {"unlockWave":12,"hpMultiplier":1.6,"damageMultiplier":1,"speedMultiplier":0.78,"cooldownMultiplier":1.1,"armor":3} |
| enemy-mire-regenerator / 沼泽再生体 | large | {"unlockWave":14,"hpMultiplier":1.9,"damageMultiplier":0.9,"speedMultiplier":0.75,"cooldownMultiplier":1.2,"movementMode":"straight","regenerationPerSecond":5} |
| enemy-ember-brute / 熔火蛮兽 | large | {"unlockWave":16,"hpMultiplier":2.2,"damageMultiplier":1.7,"speedMultiplier":0.9,"cooldownMultiplier":0.85,"armor":1} |
| enemy-clockwork-scout / 机巧斥候 | small | {"unlockWave":18,"hpMultiplier":0.65,"damageMultiplier":1,"speedMultiplier":1.7,"cooldownMultiplier":0.65,"movementMode":"huntCharacter"} |
| enemy-glacier-shell / 冰川重甲 | huge | {"unlockWave":20,"hpMultiplier":3,"damageMultiplier":1.4,"speedMultiplier":0.42,"cooldownMultiplier":1.5,"movementMode":"straight","armor":6} |
| enemy-void-wisp / 虚空游魂 | small | {"unlockWave":22,"hpMultiplier":0.45,"damageMultiplier":0.9,"speedMultiplier":1.8,"cooldownMultiplier":0.75,"movementMode":"huntCharacter"} |
| enemy-ancient-ent / 古树巨像 | colossal | {"unlockWave":24,"hpMultiplier":4,"damageMultiplier":2,"speedMultiplier":0.35,"cooldownMultiplier":1.7,"movementMode":"straight","regenerationPerSecond":12} |
| enemy-storm-mantis / 雷螳 | normal | {"unlockWave":26,"hpMultiplier":1,"damageMultiplier":1.6,"speedMultiplier":1.3,"cooldownMultiplier":0.55,"movementMode":"huntCharacter"} |
| boss-minor / 小型首领 | large | — |
| boss-major / 大型首领 | huge | — |
| boss-apex / 顶级首领 | colossal | — |

普通怪参数表示解锁波次、基础生命/伤害/速度/冷却的倍率，以及追踪/直行、护甲与恢复；Boss 使用实际波次计划的三档强化，缺省出生参数不代表无法出生。

### 额外法杖模板

| ID | 定义 |
| --- | --- |
| wand-4x4 | {"name":"扩展法杖","width":4,"height":4,"level":1,"grade":"common"} |
| wand-5x5 | {"name":"大型法杖","width":5,"height":5,"level":1,"grade":"common"} |

### 合成配方

| 名称 | 材料 → 产物 | 邻接 |
| --- | --- | --- |
| 火球 | spark + amplify → fireball | 是 |
| 陨石术 | fireball + rock-shot → meteor | 是 |
| 炎矛 | fireball + reach → flame-lance | 是 |
| 熔爆 | fireball + area → cinder-burst | 是 |
| 荆刺 | regrowth + metal-needle → thorn-shot | 是 |
| 生息 | regrowth + amplify → renewal | 是 |
| 潮涌 | water-bolt + area → tidal-orb | 是 |
| 岩刺 | rock-shot + reach → stone-spike | 是 |
| 飞刃 | metal-needle + wind-blade → iron-disc | 是 |
| 风爆 | wind-blade + area → gale-burst | 是 |
| 电弧 | lightning-bolt + double → arc-chain | 是 |
| 光盾 | light-arrow + regrowth → ward | 是 |
| 光束 | light-arrow + focus → solar-ray | 是 |
| 炎流 | flame-lance + focus → ember-ray | 是 |
| 幽光 | dark-orb + focus → void-ray | 是 |
| 跳电 | lightning-bolt + efficiency → spark-hop | 是 |
| 雷链 | arc-chain + amplify → thunder-chain | 是 |
| 雷网 | arc-chain + area → storm-net | 是 |
| 落雷 | lightning-bolt + focus → thunder-strike | 是 |
| 冰环 | water-bolt + wind-blade → frost-ring | 是 |
| 地刺 | stone-spike + area → earth-spikes | 是 |
| 焰域弹 | cinder-burst + efficiency → fire-field-bolt | 是 |
| 雷域弹 | storm-net + focus → thunder-field-bolt | 是 |
| 雷暴 | thunder-field-bolt + area + double → thunderstorm | 是 |
| 风暴 | gale-burst + area → moving-storm | 是 |
| 穿风刃 | iron-disc + reach → piercing-gale | 是 |
| 冰棱贯刺 | water-bolt + amplify → glacial-lance | 是 |
| 烬星 | cinder-burst + amplify → ember-comet | 是 |
| 日耀风暴 | thunderstorm + ember-comet → solar-storm | 是 |
| 潮汐囚笼 | thunder-field-bolt + water-bolt → tidal-prison | 是 |
| 余烬之环 | ember-comet + area → cinder-ring | 是 |
| 震退波 | frost-ring + piercing-gale → repulse-wave | 是 |
| 棱镜光束 | solar-ray + precision → prism-ray | 是 |
| 风暴之矛 | thunder-chain + pierce → storm-spear | 是 |
| 烬火灵 | spark + cinder-burst → ember-familiar | 是 |
| 霜缕灵 | frost-ring + amplify → frost-wisp | 是 |
| 荆棘卫士 | thorn-shot + capacity → thorn-guardian | 是 |
| 烬火炮台 | ember-comet + capacity → ember-turret | 是 |
| 霜纹塔 | frost-ring + focus → frost-pylon | 是 |
| 复苏图腾 | regrowth + duration → restorative-totem | 是 |
| 四发 | double + double → quadruple | 是 |
| 六发 | quadruple + double → sextuple | 是 |
| 小流星雨 | meteor + double → meteor-shower-small | 是 |
| 大流星雨 | meteor-shower-small + quadruple → meteor-shower-large | 是 |
| 灭世陨石 | meteor-shower-large + sextuple + area → worldfall | 是 |
| 三发 | double + focus → triple | 是 |
| 八发 | quadruple + quadruple → octuple | 是 |
| 宏域 | area + area → greater-area | 是 |
| 烈焰 | burn + burn → greater-burn | 是 |
| 远界 | reach + reach → greater-reach | 是 |
| 蒸汽云 | water-bolt + ember-seed → steam-cloud | 是 |
| 鸣潮 | water-bolt + arc-chain → conductive-tide | 是 |
| 熔岩刺 | meteor + reach → magma-lance | 是 |
| 暮光域 | light-arrow + dark-orb → twilight-field | 是 |

<!-- implemented-catalog:end -->

来源快照：https://chatgpt.com/space/page_4f94cd71ed3481918fa01a8892c34e2d（2026-11-03）；草案和待定状态保留。
当前一期范围优先见 ../demo-scope.md。

版本 0.1　更新日期 2026 年 11 月 3 日

本册整理法术、奥术、符文配方、角色、法杖、道具、敌人及环境的内容与参数，供后续选型、制作原型和调整平衡使用。

配套文档：[法杖构筑守城游戏机制设计](https://chatgpt.com/space/page_84ad7750d4008191a274cc5328170d48)，包含玩法流程、运行规则、边界场景与待定决策。

状态沿用机制设计中的约定：已确认内容保留明确标记；新增名称、效果细节与参数均为内容草案，确认后再转为正式规则。

# 1 数据状态与字段约定

本册给出一组便于讨论和制作原型的数据。除表中明确标出的用户例子外，名称、效果细节和数值均为**内容草案**。数值以火花基础伤害 10 为比较起点，用于原型调参，不是已验证的平衡结果。法力相关参数仅在最终采用法力系统时生效。

## 当前已实现原型（新增攻击法术）

下表记录 `src/content/demo.ts` 中原有四个新增攻击法术。它们均为等级1、白板（`common`）的真实单体弹体：命中指定目标时造成一次伤害；不带额外状态、穿透、溅射、减速或连锁效果。下列数值是原型草案，不代表平衡定案；形状均可装入 3×3 法杖。

| ID | 名称 | 属性 | 占格坐标 | 效果 | 伤害 | 法力 | 冷却 | 射程 | 弹速 |
|---|---|---|---|---|---:|---:|---:|---:|---:|
| `water-bolt` | 水弹 | 水 | (0,0)、(0,1) | projectile / Lv1 / common | 8 | 3 | 600 ms | 26 | 60 |
| `lightning-bolt` | 雷矢 | 雷 | (0,0)、(1,0)、(1,1) | projectile / Lv1 / common | 22 | 9 | 1300 ms | 36 | 140 |
| `wind-blade` | 风刃 | 风 | (0,0)、(1,0) | projectile / Lv1 / common | 6 | 2 | 350 ms | 22 | 110 |
| `rock-shot` | 岩弹 | 土 | (0,0)、(1,0)、(0,1)、(1,1) | projectile / Lv1 / common | 36 | 12 | 1800 ms | 30 | 34 |

名称与下方候选内容表有重名或近似处，但这里以固定 ID 和本表参数为准：`lightning-bolt`「雷矢」不是候选表中的 `spell.lightning`「雷击」；`water-bolt`「水弹」、`wind-blade`「风刃」和 `rock-shot`「岩弹」也不继承候选表各自描述的潮湿、穿透或其他附加效果。

### 十二个新增法术原型

以下新增条目全部为等级1、白板（`common`）。占格坐标是本轮原型选择，均连通且不超过 3×3；效果参数与数值均待后续平衡。弹体速度只用于攻击弹体，治疗与护盾没有弹速。

| ID | 名称 | 属性 | 占格坐标 | 效果 / 参数 | 力量 | 法力 | 冷却 | 射程 | 弹速 |
|---|---|---|---|---|---:|---:|---:|---:|---:|
| `flame-lance` | 炎矛 | 火 | (0,0)、(1,0)、(2,0) | projectile / pierce，最多3个目标 | 20 | 9 | 1300 ms | 35 | 105 |
| `cinder-burst` | 熔爆 | 火 | 2×2 | projectile / splash，半径6，最多6个目标 | 30 | 14 | 1800 ms | 30 | 45 |
| `thorn-shot` | 荆刺 | 木 | (0,0)、(1,0) | 普通 projectile | 7 | 2 | 300 ms | 25 | 95 |
| `renewal` | 生息 | 木 | (0,0)、(1,0)、(0,1) | heal | 30 | 15 | 4200 ms | 20 | — |
| `tidal-orb` | 潮涌 | 水 | 2×2 | projectile / splash，半径7，最多7个目标 | 24 | 12 | 1700 ms | 32 | 42 |
| `stone-spike` | 岩刺 | 土 | (0,0)、(1,0)、(2,0) | projectile / pierce，最多2个目标 | 28 | 11 | 1500 ms | 34 | 80 |
| `iron-disc` | 飞刃 | 金 | (0,0)、(1,0)、(1,1) | projectile / pierce，最多3个目标 | 18 | 8 | 1100 ms | 32 | 110 |
| `gale-burst` | 风爆 | 风 | 2×2 | projectile / splash，半径7，最多7个目标 | 15 | 10 | 1200 ms | 28 | 90 |
| `arc-chain` | 电弧 | 雷 | (0,0)、(1,0)、(1,1) | projectile / chain，半径16，最多3个目标，后续伤害系数0.7 | 18 | 12 | 1600 ms | 32 | 115 |
| `light-arrow` | 光矢 | 光 | (0,0)、(1,0) | 普通 projectile | 9 | 3 | 400 ms | 38 | 150 |
| `dark-orb` | 暗蚀 | 暗 | 2×2 | projectile / splash，半径5，最多5个目标 | 32 | 16 | 2000 ms | 30 | 38 |
| `ward` | 光盾 | 光 | (0,0)、(1,0) | shield，上限受领地护盾上限约束 | 25 | 12 | 3500 ms | 20 | — |

穿透弹沿原飞行方向继续前进，后续命中目标构成一条窄带；连锁弹先命中首个目标，再逐段选择半径内的后续目标，后续目标各自成为下一段弹体的实际飞行终点。范围弹以弹体首次接触作为结算中心，并在范围内按上限处理目标。护盾只增加到领地护盾上限，超出部分丢弃，不产生额外法力费用。以上为原型效果说明，具体目标排序、碰撞和边界规则仍以运行时实现为准；数值尚待平衡。

### 三个持续光束原型

下列新增光束同为等级1、白板（`common`）。力量表示**每次脉冲伤害**，不是整段总伤害。光束按施放时的固定方向延伸，目标可以走出光束范围；首个伤害脉冲至少延后100 ms。原型约束为持续时间不超过2400 ms、每脉冲目标数不超过8；以下参数和伤害仍待平衡。

| ID | 名称 | 属性 | 占格坐标 | 光束宽度 | 持续时间 | 脉冲间隔 | 每脉冲最多目标 | 力量 / 脉冲 | 法力 | 冷却 | 射程 |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `solar-ray` | 光束 | 光 | (0,0)、(1,0)、(2,0) | 1.8 | 900 ms | 100 ms | 3 | 5 | 12 | 2200 ms | 38 |
| `ember-ray` | 炎流 | 火 | T形4格 | 5 | 1200 ms | 200 ms | 5 | 8 | 18 | 3200 ms | 30 |
| `void-ray` | 幽光 | 暗 | 2×2 | 3 | 1000 ms | 400 ms | 2 | 18 | 20 | 4000 ms | 34 |

| 对象 | 建议保存的信息 |
|---|---|
| 内容定义 | 稳定 ID、名称、类别、属性归属、玩法与材质标签、效果、成长配置、表现引用 |
| 法术或奥术 | 占格坐标、旋转规则、触发方式、目标与修饰规则、升级与品级配置 |
| 配方 | 材料、相对布局、发现规则、产物、额外费用、等级与品级继承规则 |
| 角色 | 途径、当前序列、晋升要素、特性、属性、携杖规则、可装备内容、等级与品级衔接 |
| 途径与序列 | 前序依赖、各阶称号、能力变化、要素组、检查范围和时机、晋升消耗 |
| 法杖 | 可用格子、固有特性、装备约束、升级与品级配置 |
| 物品实例 | 实例 ID、定义 ID、所属者、位置、朝向、等级、品级 |
| 召唤精灵动物或建筑定义 | 属性、召唤家族或建筑类别、行为、生命或耐久、攻击或辅助效果、碰撞与上限分组 |
| 尸骸或魂能 | 死亡来源、资源实例 ID、位置、存续、归属、可消费条件、上限与消费记录 |
| 战斗实体实例 | 实例 ID、生成者、来源法术与法杖、位置、剩余生命和持续时间 |
| 运行状态 | 冷却、生命、法力、持续效果、寒意与毒层、局部时间倍率及来源 |
| 奖励或掉落 | 内容池、数量、权重、条件、重复处理 |
| 信息披露 | 知识解锁条件与按上下文生成的可见字段 |
| 表现配置 | 文字、图标、图片、动画、音效、尺寸和锚点 |

同类物品的定义 ID 相同，实例 ID 不同。游戏设计文档可以列出完整候选内容，运行时向普通 Agent 提供的目录仍必须经过知识与授权过滤。协议不能直接暴露完整的内部数据表。

## 升级与品级数据

**已确认**
法术、奥术、法杖和角色都有升级机制与品级机制。品级档位、等级上限、成长曲线和消耗表尚未确定。

**数据结构草案**
| 字段 | 用途 |
|---|---|
| level | 当前实例等级；角色与物品分别保存，是否存在额外队伍等级待定 |
| gradeId | 当前实例品级；角色与序列如何衔接待定，物品继续引用品级表 |
| progressionId | 适用的成长配置，决定等级、品级与已确认阶段下的效果 |
| pathwayId 与 sequenceId | 角色当前途径与序列，引用前序依赖和独立称号表 |
| advancementNodes | 已点亮要素、实时条件和专精选择，记录明确的检查范围 |
| upgradeRules | 升级前置条件、材料、费用和允许执行的阶段 |
| gradeRules | 可获得的品级及其影响；是否可升品另定 |
| inheritanceRules | 符文合成或其他转换时如何处理等级和品级 |

这些是建议的数据字段。成长公式、初始值、上限和成本需要按内容定义，不能直接把占位值当作定案。

| 内容类别 | 升级效果候选 | 品级效果候选 | 当前数据状态 |
|---|---|---|---|
| 法术 | 伤害、治疗、状态效果或资源效率成长 | 属性基准、成长上限或特殊效果 | 具体曲线与品级表待定 |
| 奥术 | 增幅强度、代价或适用条件成长 | 修饰特性或成长上限 | 双倍的升级效果也待定，不默认增加施放次数 |
| 法杖 | 固有属性、资源效率或预留格解锁 | 可用区域、固有特性或成长潜力 | 升级与扩槽的关系待定 |
| 角色 | 等级提供基础成长，序列承载关键能力与身份变化 | 角色品级是否由序列表达，或另保留资质待定 | 途径与晋升要素已确认；称号、门槛与成本待定 |

现有各表参数继续作为基础参考值，不自动归为某个已确认的等级或品级。进入实际内容配置前，需要明确其参考等级、参考品级、成长曲线和成本。

用户现已确认奖励沿用装备品级颜色方向：最低白板灰色、中间有紫色档、最高神话橙色。
试玩具体六档配置为白板灰、精良绿、稀有蓝、史诗紫、传说金、神话橙；中间名称及完整成长曲线仍可调整。
普通 Agent 只接收当前玩家有权知道的品级和成长信息。符文是否使用同一套升级与品级机制仍待确认。

### 试玩奖励数据（临时数值）

| 品级 | 本局全队攻击魔法增幅 |
| --- | --- |
| 白板 | +10% |
| 精良 | +15% |
| 稀有 | +20% |
| 史诗 | +30% |
| 传说 | +40% |
| 神话 | +50% |

目前每三波提高增幅候选品级，仅为试玩节奏选择，不是最终掉落概率或平衡定案。
同类攻击百分比加法叠加，与序列/奥术倍率相乘；只提高攻击魔法，不提高治疗。
其他候选包括一个魔法/奥术、恢复35领地生命、招募角色、未装备3×3法杖或20金币。
具体候选受当前队伍/装备容量约束；选择只领取一项。本局增幅随刷新保存，重来清空。

## 可扩展的属性归属与内容分工

**已确认**
属性体系包括金木水火土，并扩展光暗雷风等常见方向；不限定为五系。金木土偏向建筑，各系都有对应元素精灵召唤，木系有更多召唤和治疗技能。

| 系别 | 内容定位草案 | 精灵定位草案 | 建筑候选 |
|---|---|---|---|
| 金 | 穿透、破甲与机关建造 | 金灵，投射物穿透、机关输出、金灵攻击 | 箭塔、剑阵台 |
| 木 | 召唤、治疗与持续生长 | 木灵，召唤持续与容量、治疗、活体建筑 | 荆棘塔、生命树、木栅 |
| 水 | 减速、冲退与流转支援 | 水灵，控制覆盖、资源流转、水灵支援 | 首批侧重直接法术与精灵，建筑另行扩展 |
| 火 | 爆发、范围与灼烧 | 火灵，范围伤害、持续灼烧、火灵攻击 | 首批侧重直接法术与精灵，建筑另行扩展 |
| 土 | 防御、地形与阵地建造 | 土灵，耐久、护盾、土灵承伤与阵地支援 | 石墙、镇地台 |
| 光 | 即时救援、护盾、净化与保护 | 光灵，优先给合格友方提供护盾 | 光辉灯塔候选 |
| 暗 | 诅咒、削弱、汲取与侵蚀 | 暗灵，攻击并削弱目标 | 首批不强制配置建筑 |
| 雷 | 连锁、多目标爆发、短时打断 | 雷灵，攻击在邻近目标间跳跃 | 导电机关作为后续候选 |
| 风 | 推拉、聚拢、投射物与机动支援 | 风灵，提供推退或移动支援 | 首批不强制配置建筑 |
| 冰分支候选 | 寒意、冻结窗口、冰晶防御 | 冰灵，积累寒意 | 冰墙候选 |
| 毒分支候选 | 毒层、持续伤害、有限感染 | 毒灵，攻击附毒；另有毒蜂 | 首批不强制配置建筑 |
| 奥术学派候选 | 魔弹、蓄力、资源与护盾 | 奥术精灵，稳定魔弹输出 | 奥能法阵先作为区域候选 |
| 空间学派候选 | 合法转移、节点与弹道出口 | 空间精灵，短距转移自身 | 折射门节点，实体类别待定 |
| 时间学派候选 | 局部行动、冷却、延迟与有限恢复 | 时灵，局部节奏控制 | 首批不强制配置建筑 |
| 亡灵学派候选 | 骨兵军团、尸骸消费与魂灵役使 | 魂灵，远程攻击与维护联动候选 | 墓碑候选 |

**数据配置草案**
内容分别声明属性归属、玩法类型、召唤家族和材质标签。属性归属与等级、品级分开；奥术可以是通用修饰，也可以限定某系，具体适用对象由效果配置声明。木系额外增加动物召唤、直接治疗、持续治疗和生命树等候选。光暗雷风分别扩展对应法术、精灵、奥术、配方和角色专长，不改变已有物品与角色的升级和品级约定。

雷击与连锁闪电归入雷系，风刃归入风系。冰、毒、奥术、空间、时间五个候选方向已细化，独立列出便于评审；是否全部作为并列基础系仍待定。冰箭和冰霜新星暂移入冰分支草案，奥术弹移入奥术学派草案，既有 ID 保留。冰是否继续接受水系加成、毒与木暗如何关联尚未确定，不能自动重复计入多个系别。

# 2 各系法术数据草案

占格先用形状与格数表达，后续落地为实际格子坐标集合。以下参数为基础比较值，最终效果由角色、法杖、奥术和法术成长共同计算。相同名称的实体攻击间隔与生成法术冷却分别配置。

属性体系扩展及内容偏向已确认。以下具体条目、形状、行为和数值仍为内容草案，原有火花概念及火球配方例子保持其原确认范围。这里的参考参数尚未指定最终等级和品级，法力参数仅在采用法力系统时启用。

## 金系法术

| ID 与名称 | 占格草案 | 效果与参考参数 | 成长方向候选 |
|---|---|---|---|
| spell.metal_needle 金针 | 横向两格 | 发射金针，最多穿透2个目标；伤害8，冷却1.4秒，法力3 | 伤害、穿透上限或资源效率 |
| spell.returning_blade 回旋飞刃 | 三格折角 | 飞刃去返攻击，同目标每段最多命中1次；每次6伤害，冷却2.4秒，法力4 | 飞刃伤害、返回路径或穿透 |
| spell.build_arrow_tower 制造箭塔 | 四格 T 形 | 制造金系机关箭塔，存在30秒；冷却20秒，法力12 | 箭塔伤害、射程或持续时间 |
| spell.build_sword_platform 制造剑阵台 | 五格十字 | 制造机关平台，周期向附近敌人发出短程剑气；存在25秒，冷却24秒，法力14 | 剑气覆盖、输出或机关协同 |
| spell.summon_metal_spirit 召唤金灵 | 三格直线 | 召唤远程飞刃精灵，存在18秒；冷却16秒，法力9 | 精灵攻击、穿透或持续时间 |

## 木系法术

| ID 与名称 | 占格草案 | 效果与参考参数 | 成长方向候选 |
|---|---|---|---|
| spell.regrowth 回春术 | 两格竖条 | 为符合条件的友方每秒恢复4生命，持续3秒；冷却4秒，法力4 | 持续治疗、时长或资源效率 |
| spell.vine_bind 藤缠 | 三格折角 | 缠绕一个目标1秒并造成6伤害；冷却3秒，法力4；首领控制规则待定 | 控制时间、目标数或伤害 |
| spell.summon_wolf 召唤灵狼 | 三格 L 形 | 召唤移动攻击的灵狼，存在15秒；冷却12秒，法力8 | 动物攻击、生命或持续时间 |
| spell.summon_bear 召唤森林熊 | 四格方形 | 召唤森林熊，存在15秒；冷却20秒，法力12；承伤与阻挡待定 | 动物生命、攻击或防护行为 |
| spell.summon_healing_bird 召唤青羽鸟 | 三格折角 | 召唤治疗友方的鸟，存在18秒；冷却15秒，法力8 | 治疗量、辅助范围或持续时间 |
| spell.summon_wood_spirit 召唤木灵 | 四格 L 形 | 召唤优先治疗生命比例较低友方的木灵，存在20秒；冷却18秒，法力10 | 精灵治疗、支援范围或持续时间 |
| spell.build_barricade 制造木栅 | 两格横条 | 制造木系防御建筑，存在20秒；冷却12秒，法力6；路径阻挡待定 | 耐久、持续时间或建造效率 |
| spell.build_thorn_tower 制造荆棘塔 | 四格 T 形 | 制造发射荆棘的木系建筑，存在25秒；冷却20秒，法力10 | 攻击、减速或持续时间 |
| spell.build_life_tree 栽种生命树 | 五格十字 | 制造区域治疗的活体建筑，存在30秒；冷却24秒，法力14 | 治疗、覆盖范围或持续时间 |

## 水系法术

| ID 与名称 | 占格草案 | 效果与参考参数 | 成长方向候选 |
|---|---|---|---|
| spell.water_bolt 水弹 | 单格 | 发射水弹并附加潮湿2秒；伤害8，冷却1.2秒，法力2 | 伤害、潮湿持续或资源效率 |
| spell.tidal_push 涌浪 | 三格横条 | 范围内造成12伤害并推退可被推动的敌人；冷却4秒，法力6 | 波宽、推退或伤害 |
| spell.clear_stream 净流 | 两格竖条 | 清除符合条件友方身上的1个可净化负面状态；冷却6秒，法力5 | 净化目标数或冷却 |
| spell.summon_water_spirit 召唤水灵 | 三格 L 形 | 召唤以减速水弹辅助控场的水灵，存在20秒；冷却18秒，法力9 | 减速、辅助范围或持续时间 |

## 火系法术

| ID 与名称 | 占格草案 | 效果与参考参数 | 成长方向候选 |
|---|---|---|---|
| spell.spark 火花 | 单格 | 向单体发射火焰弹；伤害10，冷却1.2秒，法力2 | 伤害、资源效率或火焰联动 |
| spell.flame_wall 火墙 | 四格直线 | 生成持续5秒的灼烧区域，每秒伤害4；冷却6秒，法力7；这是区域效果而非建筑 | 范围、伤害或存续时间 |
| spell.flame_ring 焰环 | 五格十字 | 在合法目标点造成范围伤害16，并附加3秒灼烧；冷却4秒，法力6 | 范围、爆发或灼烧 |
| spell.summon_fire_spirit 召唤火灵 | 四格 T 形 | 召唤远程火弹精灵，存在15秒；冷却16秒，法力10 | 精灵伤害、爆炸范围或持续时间 |

## 土系法术

| ID 与名称 | 占格草案 | 效果与参考参数 | 成长方向候选 |
|---|---|---|---|
| spell.stone_bolt 岩弹 | 两格横条 | 向单体投射岩块，伤害16；冷却2秒，法力3 | 伤害或冲击效果 |
| spell.earth_spikes 地刺 | 三格直线 | 沿地面直线造成伤害12，并减速20%持续2秒；冷却3秒，法力5 | 长度、伤害或控制 |
| spell.build_stone_wall 制造石墙 | 三格横条 | 制造土系防御建筑，存在25秒；冷却18秒，法力9；封路规则待定 | 耐久、持续时间或防护 |
| spell.build_earth_platform 制造镇地台 | 四格方形 | 制造给周围合格友方定期提供护盾的土系建筑，存在25秒；冷却24秒，法力14 | 护盾、覆盖或持续时间 |
| spell.summon_earth_spirit 召唤土灵 | 五格十字 | 召唤高生命的近战土灵，存在20秒；冷却20秒，法力12 | 精灵生命、攻击或防护行为 |

## 光系法术

| ID 与名称 | 占格草案 | 效果与参考参数 | 成长方向候选 |
|---|---|---|---|
| spell.healing_light 治愈之光 | 三格 L 形 | 治疗符合条件的友方8生命；冷却4秒，法力5；是否能治疗领地待定 | 治疗量、冷却或消耗 |
| spell.radiant_bolt 光矢 | 两格直线 | 远程单体伤害12，冷却1.8秒，法力3 | 伤害、穿透或资源效率 |
| spell.radiant_ward 圣光护佑 | 三格 L 形 | 为合格友方提供12点护盾，持续4秒；冷却5秒，法力5 | 护盾量、覆盖目标或持续时间 |
| spell.build_light_beacon 制造光辉灯塔 | 五格十字 | 制造区域保护建筑，存在25秒；冷却24秒，法力14 | 保护覆盖、护盾或持续时间 |
| spell.summon_light_spirit 召唤光灵 | 四格 L 形 | 召唤保护友方的光灵，存在18秒；冷却18秒，法力10 | 精灵护盾、支援范围或持续时间 |

## 暗系法术

| ID 与名称 | 占格草案 | 效果与参考参数 | 成长方向候选 |
|---|---|---|---|
| spell.shadow_bolt 暗影弹 | 单格 | 单体暗影伤害9，冷却1.2秒，法力3 | 伤害、侵蚀或资源效率 |
| spell.weakening_hex 衰弱咒 | 两格竖条 | 使合格敌人攻击伤害降低15%，持续3秒；冷却4秒，法力4 | 削弱幅度、目标数或持续时间 |
| spell.life_siphon 生命汲取 | 三格折角 | 造成10伤害，并按实际伤害的50%治疗一个允许的受益目标；冷却3秒，法力5 | 伤害、转化效率或受益目标 |
| spell.summon_dark_spirit 召唤暗灵 | 四格折角 | 召唤攻击并削弱敌人的暗灵，存在18秒；冷却18秒，法力10 | 精灵攻击、诅咒或持续时间 |

## 雷系法术

| ID 与名称 | 占格草案 | 效果与参考参数 | 成长方向候选 |
|---|---|---|---|
| spell.lightning 雷击 | 两格横条 | 单目标雷击伤害18，冷却2秒，法力4 | 雷系伤害、跳跃联动或资源效率 |
| spell.arc_spark 电弧 | 三格折角 | 最多命中2个目标，首目标伤害12，下一跳伤害降低25%；冷却2.6秒，法力5 | 跳跃数量、跳跃范围或伤害 |
| spell.thunderclap 雷震 | 四格 T 形 | 范围伤害10并尝试眩晕0.4秒；冷却5秒，法力7；首领控制规则待定 | 范围、打断或伤害 |
| spell.summon_lightning_spirit 召唤雷灵 | 四格折线 | 召唤连锁攻击的雷灵，存在16秒；冷却18秒，法力10 | 精灵伤害、跳跃或持续时间 |

## 风系法术

| ID 与名称 | 占格草案 | 效果与参考参数 | 成长方向候选 |
|---|---|---|---|
| spell.wind_blade 风刃 | 三格直线 | 最多穿透3个目标，每目标伤害7，冷却2秒，法力4 | 风系弹道、穿透或资源效率 |
| spell.gust 疾风推退 | 三格直线 | 对区域敌人造成6伤害并推退合法距离；冷却3秒，法力4 | 推退、范围或冷却 |
| spell.tailwind 顺风 | 两格竖条 | 使合格移动友方的移速提高25%，持续3秒；冷却5秒，法力4 | 机动支援、覆盖或持续时间 |
| spell.summon_wind_spirit 召唤风灵 | 三格 L 形 | 召唤以气流攻击并推退敌人的风灵，存在18秒；冷却17秒，法力9 | 精灵攻击、推退或持续时间 |

## 冰分支法术草案

| ID 与名称 | 占格草案 | 效果与参考参数 | 成长方向候选 |
|---|---|---|---|
| spell.ice_arrow 冰箭 | 两格竖条 | 命中造成8伤害，减速25%持续2秒，并附加1层寒意；冷却1.6秒，法力3；寒意阈值待定 | 寒意效率、控制覆盖或伤害 |
| spell.frost_ring 霜环 | 四格 T 形 | 范围伤害6并附加2层寒意，冷却4秒、法力6；不默认立即冻结首领 | 寒意覆盖、范围或伤害 |
| spell.ice_armor 冰晶护甲 | 三格 L 形 | 为一个合格友方提供15点冰晶护盾，持续5秒；冷却6秒、法力6 | 护盾量、持续时间或碎冰联动 |
| spell.build_ice_wall 制造冰墙 | 三格直线 | 制造冰晶防御建筑，存在15秒；冷却16秒、法力9 | 耐久、阻挡或碎裂效果 |
| spell.summon_ice_spirit 召唤冰灵 | 四格折角 | 召唤施加寒意的冰灵，存在18秒；冷却18秒、法力10 | 精灵寒意、伤害或持续时间 |

## 毒分支法术草案

| ID 与名称 | 占格草案 | 效果与参考参数 | 成长方向候选 |
|---|---|---|---|
| spell.poison_dart 毒针 | 两格直线 | 直接伤害4，附加1层持续5秒的毒；冷却1.4秒、法力3 | 毒层、持续伤害或资源效率 |
| spell.poison_mist 毒雾 | 四格方形 | 生成持续5秒的区域，每秒尝试为目标增加1层毒；冷却7秒、法力8 | 覆盖范围、毒层或持续时间 |
| spell.infection_mark 感染印记 | 三格折角 | 标记目标5秒；其死亡时给最多2个邻近合法目标各附加1层毒，传播不再传播；冷却6秒、法力6 | 目标选择、传播效率或印记时间 |
| spell.summon_poison_wasp 召唤毒蜂 | 三格 L 形 | 召唤攻击附毒的动物，存在15秒；冷却14秒、法力8 | 动物攻击、毒伤或持续时间 |
| spell.summon_poison_spirit 召唤毒灵 | 四格 T 形 | 召唤远程附毒精灵，存在18秒；冷却18秒、法力10 | 精灵毒层、伤害或持续时间 |

## 奥术学派法术草案

| ID 与名称 | 占格草案 | 效果与参考参数 | 成长方向候选 |
|---|---|---|---|
| spell.arcane_bolt 奥术弹 | 单格 | 单体奥能伤害9，冷却1秒，法力2 | 奥能伤害、连发或资源效率 |
| spell.arcane_ray 聚能射线 | 三格直线 | 蓄力0.8秒后对目标造成30伤害；冷却3.5秒、法力7；蓄力中断处理待定 | 蓄力时间、单体伤害或资源效率 |
| spell.arcane_ward 魔能护盾 | 三格 L 形 | 消耗8法力生成16点护盾，持续5秒；冷却6秒；仅在采用法力系统时启用 | 护盾转化、持续时间或消耗 |
| spell.arcane_field 奥能法阵 | 四格方形 | 生成持续20秒的资源区域，每2秒为1个合法资源池回复1法力；冷却24秒、法力10；同源不叠加 | 覆盖、支援对象或回复效率 |
| spell.summon_arcane_spirit 召唤奥术精灵 | 四格折角 | 召唤稳定发射魔弹的精灵，存在18秒；冷却17秒、法力9 | 精灵输出、资源效率或持续时间 |

## 空间学派法术草案

| ID 与名称 | 占格草案 | 效果与参考参数 | 成长方向候选 |
|---|---|---|---|
| spell.spatial_blade 空间刃 | 两格直线 | 在合法目标位置造成14伤害；冷却2.4秒、法力4；不直接绕过目标合法性 | 伤害、作用距离或消耗 |
| spell.blink 折跃 | 三格 L 形 | 将1个存活且可转移的友方移动到合法目的地；冷却8秒、法力6；施法前验证目的地 | 距离、合法对象或冷却 |
| spell.spatial_compression 空间压缩 | 四格折角 | 把范围内最多2个可转移敌人移至中心附近的合法落点；冷却7秒、法力8 | 对象数、区域或部署效率 |
| spell.refracting_gate 折射门 | 五格折线 | 一次创建成对弹道转移节点，存在12秒；冷却16秒、法力10；最多维持1对同源节点 | 节点持续、部署距离或消耗 |
| spell.summon_space_spirit 召唤空间精灵 | 四格 L 形 | 召唤可以短距转移自身的攻击精灵，存在18秒；冷却18秒、法力10 | 精灵攻击、转移间隔或持续时间 |

## 时间学派法术草案

| ID 与名称 | 占格草案 | 效果与参考参数 | 成长方向候选 |
|---|---|---|---|
| spell.temporal_slow 时缓 | 三格折角 | 使合格敌人移动和攻击频率乘以0.75，持续3秒；冷却6秒、法力6；不改变其全部计时 | 局部倍率、覆盖或持续时间 |
| spell.hasten_wand 法杖加速 | 三格直线 | 使指定法杖冷却恢复速度乘以1.2，持续3秒；冷却8秒、法力7；最短冷却另定 | 恢复速度、窗口或资源效率 |
| spell.delayed_burst 延时爆裂 | 四格 T 形 | 登记一次延迟2秒的范围爆裂，伤害18；冷却5秒、法力7；目标提前死亡的处理待定 | 延时、范围或伤害 |
| spell.rewind_guard 回溯护佑 | 四格折角 | 记录单个合格存活友方3秒内损失的生命，结束时最多恢复10；冷却10秒、法力8；不复活 | 窗口、恢复上限或消耗 |
| spell.summon_time_spirit 召唤时灵 | 五格十字 | 召唤以局部时缓辅助战斗的精灵，存在18秒；冷却20秒、法力11 | 精灵控制、输出或持续时间 |

## 亡灵学派法术草案

亡灵以白骨军团、尸骸利用与魂灵役使为内容候选；是否独立成系、伤害属性及尸骸或魂能系统均待定。下面的条目、效果和数值均为草案，不能据此把全部亡灵攻击判定为暗伤害。

| ID 与名称 | 占格草案 | 效果与参考参数 | 成长方向候选 |
|---|---|---|---|
| spell.bone_spear 骨矛 | 两格直线 | 骨矛最多穿透2个敌人，每目标伤害10；冷却1.8秒、法力3；伤害属性待定 | 穿透、伤害或资源效率 |
| spell.summon_skeleton 召唤骷髅卫兵 | 三格 L 形 | 只消耗法力召唤1名卫兵，存在20秒；冷却14秒、法力7 | 亡灵生命、攻击或持续时间 |
| spell.summon_skeletal_archer 召唤骷髅弓手 | 四格折角 | 召唤1名远程亡灵，存在20秒；冷却18秒、法力10 | 远程伤害、射程或持续时间 |
| spell.raise_dead 起尸 | 四格 T 形 | 消费1个合法尸骸，生成模板化亡仆，存在20秒；冷却12秒、法力5；不复制原敌人技能 | 转化效率、亡仆强度或存续 |
| spell.corpse_explosion 尸爆 | 三格折角 | 消费1个合法尸骸，在其位置造成范围伤害24；冷却5秒、法力5；范围与属性待定 | 伤害、范围或资源效率 |
| spell.summon_undead_spirit 召唤魂灵 | 四格 L 形 | 召唤远程魂灵，存在18秒；冷却18秒、法力9；家族归类待定 | 魂灵攻击、支援或持续时间 |
| spell.build_grave_marker 制造墓碑 | 五格十字 | 制造可维护本人亡灵的建筑，存在30秒；冷却24秒、法力12 | 维护量、覆盖或持续时间 |

### 尸骸与魂能数据草案

| 资源或标识 | 含义 | 产生与消费草案 |
|---|---|---|
| corpseInstanceId | 场上一次性尸骸资源实例 | 由符合条件的敌方死亡事件产生，记录位置、来源和存续；起尸或尸爆提交成功时消费一次 |
| deathEventId | 原敌人死亡事件标识 | 用于防止死亡收益重复结算，起尸和友方亡灵死亡不重放原击杀 |
| soulEnergy | 可选魂能资源 | 原型可先不启用；启用后明确归属、合法来源、上限与消费，不默认从友方召唤循环中无限产生 |
| summonFamily | 召唤家族 | 骷髅、亡仆和魂灵可分别声明，亡灵不是一套默认的元素免疫规则 |

普通骷髅召唤不需要尸骸，起尸与尸爆争夺同一批合法尸骸。资源预览只返回当前玩家已知信息，起尸不会把原怪物全部隐藏属性复制到公开结果。

血法、灵魂、精神、契约及其他机制学派的代表技能见下节。亡灵以尸骸和军团循环形成自己的构筑特点，不把所有相关学派都收进亡灵类别。

## 更多机制学派技能候选

以下条目用于比较玩法方向。名称与效果均为内容草案，具体占格、数值、等级、品级、资源和可用阶段尚未确定；它们不构成首版必须实现的全部能力。

### 血法

| ID 与名称 | 效果方向 | 前置与待定 |
|---|---|---|
| spell.blood_shield 血盾 | 扣除一个允许付费的友方部分生命，换取护盾 | 生命支付目标和比例待定，不能擅自扣领地或队友生命 |
| spell.blood_fervor 沸血 | 短时强化施法或攻击，同时承担明确的持续代价 | 窗口结束、目标退场和资源不足的处理待定 |

主题召唤候选：血灵。消耗允许的资源生成短时攻击单位，是否吸取生命需单独配置。

### 灵魂

| ID 与名称 | 效果方向 | 前置与待定 |
|---|---|---|
| spell.soul_ward 护魂印 | 消耗已启用的魂能，为目标提供保护效果 | 护盾、代价与可作用对象待定 |
| spell.soul_link 灵魂连线 | 在有限数量的合格友方之间分配部分伤害或支援 | 分摊上限、死亡断链与是否包含领地待定 |

主题召唤候选：护魂精灵。为合格友方提供护盾或支援，与亡灵起尸分开。

### 精神

| ID 与名称 | 效果方向 | 前置与待定 |
|---|---|---|
| spell.dread_mark 恐惧印 | 使合格敌人短暂远离威胁或停止推进 | 合法移动、首领抗性与连续控制上限待定 |
| spell.charm 魅惑 | 使一个允许被控制的敌人暂时协助作战 | 转阵营前后身份不变，不重复生成原击杀收益 |

主题召唤候选：心灵精灵。对可控制敌人施加短时干扰，不复制完整敌人能力。

### 幻术

| ID 与名称 | 效果方向 | 前置与待定 |
|---|---|---|
| spell.decoy 诱饵幻影 | 在合法位置生成可吸引部分敌人注意的诱饵 | 仇恨优先级、是否可受击与数量待定 |
| spell.mirror_image 镜像术 | 投影角色或召唤物的外观及受限攻击模板 | 不因幻影退场产生完整尸骸、奖励或返还循环 |

主题召唤候选：幻影分身。使用简化攻击和独立寿命，不完整复制角色的全部法杖与资源。

### 炼金

| ID 与名称 | 效果方向 | 前置与待定 |
|---|---|---|
| spell.incendiary_flask 燃烧瓶 | 投掷瓶剂，在合法区域形成火属性灼烧 | 瓶剂与施法资源如何扣除待定 |
| spell.catalysis 催化术 | 触发一个已声明可被催化的地表或状态反应 | 每次结算去重，不让产物无限再次催化自身 |

主题召唤候选：炼金魔像。用已知配方生成构装体，生命与攻击由模板定义。

### 符咒与结界

| ID 与名称 | 效果方向 | 前置与待定 |
|---|---|---|
| spell.trigger_sigil 触发符 | 部署一个在敌人进入区域时触发的符印 | 触发次数、是否消耗符印与所属属性待定 |
| spell.protective_barrier 守护结界 | 在区域内为合格友方提供有限保护 | 护盾、减伤、同源叠加和持续消耗待定 |

主题召唤候选：符灵。围绕已部署符印提供有限攻击或维护，不绕过部署上限。

### 机械与构装

| ID 与名称 | 效果方向 | 前置与待定 |
|---|---|---|
| spell.overclock_turret 过载炮台 | 短时提高一座合格炮台的输出，随后进入恢复阶段 | 过载代价、冷却与可升级目标待定 |
| spell.summon_repair_drone 制造维修机蜂 | 制造维修构装体，为合格目标恢复耐久 | 修理对象、距离、资源与容量待定 |

主题召唤候选：维修机蜂。修理允许的建筑或构装体，不自动等同于生命治疗。

### 契约

| ID 与名称 | 效果方向 | 前置与待定 |
|---|---|---|
| spell.summon_pact_beast 召唤契约兽 | 召唤一个以持续资源维持的强力单位 | 资源归属、数量与断供时离场或衰减待定 |
| spell.pact_blessing 契约赐能 | 接受明确的本局代价，换取一段时间的专长强化 | 代价类型、期限与解除规则待定 |

主题召唤候选：契约兽。具有明确特长与维持条件，不默认需要尸骸或属于亡灵。

### 重力

| ID 与名称 | 效果方向 | 前置与待定 |
|---|---|---|
| spell.gravity_well 重力井 | 持续向中心牵引合格敌人 | 牵引速度、最大聚集和首领抗性待定 |
| spell.crushing_field 重压场 | 降低区域内合格目标的移动能力并周期造成伤害 | 不因名称直接改变所有攻击与现实计时 |

主题召唤候选：重力精灵。维持小型重压或牵引效果，受持续控制上限约束。

### 音律与共鸣

| ID 与名称 | 效果方向 | 前置与待定 |
|---|---|---|
| spell.battle_song 鼓舞战歌 | 在有限区域强化友方施法或攻击节奏 | 作用对象、持续代价与同类叠加待定 |
| spell.resonant_wave 共鸣波 | 积累指定次数的合法施法后释放一次共鸣攻击 | 额外触发是否计数需声明，不能无限自触发 |

主题召唤候选：回音精灵。跟随节奏提供有限回声效果，不让回声递归触发自身。

### 星象

| ID 与名称 | 效果方向 | 前置与待定 |
|---|---|---|
| spell.orbiting_stars 环星护卫 | 生成有限数量的环绕星体，对接触的合法目标攻击 | 每目标命中频率、星体寿命与实体类别待定 |
| spell.starfall_mark 星落标记 | 预告合法区域，短暂延迟后落下星体攻击 | 伤害属性、延迟、范围和重复命中待定 |

主题召唤候选：星灵。按轨道或星相提供攻击与支援，数量和碰撞待定。

### 命运

| ID 与名称 | 效果方向 | 前置与待定 |
|---|---|---|
| spell.fortune_mark 幸运印记 | 让下一次合格攻击或保护事件获得明确的额外收益 | 收益、充能和触发次数需要固定描述 |
| spell.fate_reroll 改运 | 在游戏允许时消耗有限资源刷新一组未领取奖励 | 结果提交后保持稳定，不提供任意回滚和无限重抽 |

主题召唤候选：命运精灵。提供有限次数的保护或印记支援，不公开随机种子与隐藏目录。

## 扩展分支的分类与资源约定

上述扩展方向都是内容草案，独立列出不等于已经确定全部成为并列基础系。奥术学派是法术属性，双倍、放大、分裂等仍是奥术修饰单元。法力、控制阈值、层数、合法落点和局部时间规则按机制文档校验；普通 Agent 只读取当前玩家已知的条目与参数。亡灵学派、伤害属性和召唤家族分别配置，血法、灵魂、精神与契约仍为后续候选。

原型建议按构筑链分批启用，当前内容覆盖金木水火土光暗雷风。先验证基础攻击、各系精灵和已有建筑，再比较木系持续治疗与光系应急保护，以及雷系连锁和风系位移的差异。射程、控制抗性、升级与品级成长仍需确认。本轮新增的冰毒奥术空间时间分支可以按依赖分批验证，不要求所有候选同时进入首版。

## 元素精灵动物与建筑数据草案

各系都有对应精灵召唤是已确认方向。原有九个属性方向之外，本轮为冰、毒、奥术、空间、时间分别补充精灵候选，并增加毒蜂、冰墙和成对空间节点。它们均为内容草案，五个新分支是否独立成系尚未确定。所有数值和行为待验证；持续时间以生成法术条目为准。亡灵另增加魂灵候选及骨兵、亡仆、墓碑，具体家族与元素属性分别声明。

| 生成法术或符文 | 实体 ID 与名称 | 属性与行为草案 | 边界与依赖 |
|---|---|---|---|
| spell.summon_wolf | summon.wolf 灵狼 | 木系动物；生命30，每1.2秒近身攻击造成5伤害 | 移动与容量待定 |
| spell.summon_bear | summon.bear 森林熊 | 木系动物；生命100，每2秒近身攻击造成8伤害 | 承伤、阻挡和仇恨待定 |
| spell.summon_healing_bird | summon.healing_bird 青羽鸟 | 木系动物；生命16，每2秒为1个合格友方恢复3生命 | 不自动赋予跨地形、无敌或领地治疗能力 |
| spell.summon_metal_spirit | summon.metal_spirit 金灵 | 金系精灵；生命25，每1.5秒发射8伤害金刃，可穿透2个敌人 | 目标选择和射程待定 |
| spell.summon_wood_spirit | summon.wood_spirit 木灵 | 木系精灵；生命30，每2秒为生命比例较低的合格友方恢复5生命 | 治疗范围及是否能治疗活体建筑待定 |
| spell.summon_water_spirit | summon.water_spirit 水灵 | 水系精灵；生命30，每1.8秒发射5伤害水弹，减速20%持续2秒 | 与其他减速的叠加规则待定 |
| spell.summon_fire_spirit | summon.fire_spirit 火灵 | 火系精灵；生命22，每1.8秒发射8伤害火弹，小范围爆炸 | 范围和灼烧细节待定 |
| spell.summon_earth_spirit | summon.earth_spirit 土灵 | 土系精灵；生命100，每2.2秒近身攻击造成7伤害 | 是否阻挡或吸引攻击待定 |
| spell.build_arrow_tower | building.arrow_tower 箭塔 | 金系机关；耐久60，每1.8秒射出10伤害箭矢 | 部署点、射程与上限待定 |
| spell.build_sword_platform | building.sword_platform 剑阵台 | 金系机关；耐久70，每2.5秒对附近最多3个敌人分别造成6伤害 | 攻击范围与重复命中待定 |
| spell.build_barricade | building.barricade 木栅 | 木系建筑；耐久150，无攻击 | 路径阻挡和是否有活体标签待定 |
| spell.build_thorn_tower | building.thorn_tower 荆棘塔 | 木系建筑；耐久65，每2秒造成6伤害并减速15%持续1秒 | 控制叠加与射程待定 |
| spell.build_life_tree | building.life_tree 生命树 | 木系活体建筑；耐久80，每2秒为范围内最多3个合格友方各恢复3生命 | 治疗对象、范围、是否排除自身待定 |
| spell.build_stone_wall | building.stone_wall 石墙 | 土系建筑；耐久220，无攻击 | 不得因生成形成非法封路；具体寻路规则待定 |
| spell.build_earth_platform | building.earth_platform 镇地台 | 土系建筑；耐久100，每4秒为最多3个合格友方各提供6点护盾 | 护盾持续4秒；叠加、对象与范围待定 |
| rune.earth_bastion | building.earth_bastion 厚土壁垒 | 土系符文建筑；耐久300，无攻击，存在30秒 | 原型部署和路径校验与石墙相同 |
| spell.summon_light_spirit | summon.light_spirit 光灵 | 光系精灵；生命28，每3秒为1个合格友方提供6点护盾，持续3秒 | 护盾对象、叠加和范围待定 |
| spell.summon_dark_spirit | summon.dark_spirit 暗灵 | 暗系精灵；生命28，每2秒攻击造成5伤害，并使目标攻击伤害降低10%持续2秒 | 诅咒叠加与敌方控制抗性待定 |
| spell.summon_lightning_spirit | summon.lightning_spirit 雷灵 | 雷系精灵；生命24，每2秒攻击最多2个敌人，首目标伤害7，后续降低25% | 跳跃范围与导电联动待定 |
| spell.summon_wind_spirit | summon.wind_spirit 风灵 | 风系精灵；生命26，每2秒造成4伤害并尝试小幅推退 | 重复位移限制、合法落点与首领抗性待定 |
| spell.build_light_beacon | building.light_beacon 光辉灯塔 | 光系建筑；耐久70，每4秒为范围内最多3个合格友方各提供5点护盾，持续3秒 | 对象、范围与重复护盾规则待定 |
| spell.summon_ice_spirit | summon.ice_spirit 冰灵 | 冰分支精灵；生命28，每2秒攻击造成5伤害并附加1层寒意 | 与冰箭共用寒意规则，冻结抗性待定 |
| spell.build_ice_wall | building.ice_wall 冰墙 | 冰晶建筑；耐久90；原型可在被敌方摧毁时产生一次8伤害的碎冰 | 自然到期是否碎裂待定，路径与触发去重必须生效 |
| spell.summon_poison_wasp | summon.poison_wasp 毒蜂 | 毒分支动物；生命12，每1.5秒攻击造成2伤害并附加1层毒 | 不因动物外观自动获得飞行越障或无敌 |
| spell.summon_poison_spirit | summon.poison_spirit 毒灵 | 毒分支精灵；生命24，每2秒攻击造成5伤害并附加1层毒 | 沿用毒层上限和持续时间规则 |
| spell.summon_arcane_spirit | summon.arcane_spirit 奥术精灵 | 奥术学派精灵；生命28，每1.8秒发射造成9伤害的魔弹 | 不自动提供无限法力或复制资源 |
| spell.refracting_gate | node.gate_entry 折射门入口 | 空间节点；与出口共享配对 ID 和剩余12秒存续时间 | 作为节点候选，是否可受击与计入建筑容量待定 |
| spell.refracting_gate | node.gate_exit 折射门出口 | 空间节点；与入口一次创建；投射物保留来源、寿命和命中记录 | 每投射物通过次数与传送位置规则待定 |
| spell.summon_space_spirit | summon.space_spirit 空间精灵 | 空间学派精灵；生命24，每2秒造成8伤害，可按行为规则短距转移自身 | 落点合法，转移不新建实例或重置寿命 |
| spell.summon_time_spirit | summon.time_spirit 时灵 | 时间学派精灵；生命26，每2.5秒造成4伤害并使目标行动频率乘以0.85持续2秒 | 行动倍率与其他时缓的组合、抗性和下限待定 |
| spell.summon_skeleton | summon.skeleton_guard 骷髅卫兵 | 亡灵家族；生命35，每1.6秒近身攻击造成5伤害 | 不默认留可重复利用尸骸或重复发放敌人奖励 |
| spell.summon_skeletal_archer | summon.skeletal_archer 骷髅弓手 | 亡灵家族；生命22，每2秒发射造成6伤害的箭 | 射程、弹道修饰继承与容量待定 |
| spell.raise_dead | summon.risen_thrall 亡仆 | 亡灵家族；生命45，每1.8秒近身攻击造成6伤害；使用受控模板 | 记录原尸骸来源，不完整复制 Boss 技能或原装备 |
| spell.summon_undead_spirit | summon.undead_spirit 魂灵 | 亡灵主题精灵候选；生命24，每2秒远程攻击造成7伤害 | 是否归为元素精灵、魂灵或亡灵家族由数据决定 |
| spell.build_grave_marker | building.grave_marker 墓碑 | 耐久80，每2秒为范围内最多3个本人亡灵恢复2生命 | 属于亡灵维护效果，不自动治疗所有角色或建筑 |
| rune.ossuary_guard | summon.ossuary_guard 重甲骸卫 | 亡灵家族；生命100，每2.4秒近身攻击造成10伤害，存在20秒 | 仍占召唤容量，不默认拥有额外免疫 |

持续时间和召唤冷却见生成法术条目。实体自身的攻击间隔与生成法术的冷却分别保存。角色、法术和法杖的加成继承按机制文档统一处理，不能先加在法术上又重复加到实体。冰墙与召唤物使用战斗模拟时间计时；局部时缓不默认延长其寿命。折射门两个节点共享配对和容量，不能因两个出口被重复计算成两次独立施法。

青羽鸟、木灵与生命树已列入本批木系治疗候选，资源辅助动物和其他特种精灵可以后续扩展。角色品级不默认改变生成实体的品级；实体若有独立成长体系需另行设计。

# 3 奥术修饰单元数据草案

| ID 与名称 | 占格草案 | 作用方式与效果 | 代价或限制草案 | 状态 |
|---|---|---|---|---|
| arcana.double 双倍 | 单格 | 使上下左右相邻法术每次触发施放两次 | 耗蓝与叠加规则待定 | 核心例子已确认 |
| arcana.amplify 放大 | 横向两格 | 使相邻范围法术的作用半径增加25% | 单体无范围法术是否受益待定；可用于火球配方 | 放大与火球配方方向已确认，其余草案 |
| arcana.haste 急速 | 单格 | 相邻法术冷却乘以0.85 | 法力消耗乘以1.15 | 内容草案 |
| arcana.split 分裂 | 四格 T 形 | 相邻投射物增加两个偏转弹体 | 每弹伤害降为基础的50%；非投射物不适用 | 内容草案 |
| arcana.homing 追踪 | 两格竖条 | 相邻投射物在飞行中追踪目标 | 目标失效后只重新选一次，额外法力1 | 内容草案 |
| arcana.focus 聚能 | 三格 L 形 | 相邻法术伤害乘以1.4 | 冷却乘以1.25 | 内容草案 |
| arcana.mana_spring 法力源泉 | 四格方形 | 提供持有角色法力回复 | 每秒回复2；资源归属确认后调整 | 内容草案 |
| arcana.metal_edge 锋锐 | 两格直线 | 限定适配的金系攻击，伤害增加15%；额外穿透为升阶候选 | 不默认作用于治疗或建筑耐久 | 内容草案 |
| arcana.wood_vitality 生息 | 三格 L 形 | 木系直接或持续治疗量增加15% | 精灵、动物与生命树需声明是否通过生成法术继承 | 内容草案 |
| arcana.water_flow 流转 | 两格竖条 | 水系法术消耗降低10% | 采用法力系统时启用；净化次数不自动增加 | 内容草案 |
| arcana.fire_ember 余烬 | 三格折角 | 适配的火系攻击附加每秒2伤害的灼烧，持续3秒 | 多次灼烧按状态规则处理 | 内容草案 |
| arcana.earth_stability 稳固 | 四格方形 | 适配的土系建造或召唤，生成实体最大耐久或生命增加15% | 若同一法术同时有多个效果，仅指定的实体效果受益 | 内容草案 |
| arcana.light_blessing 光佑 | 三格 L 形 | 适配光系治疗或护盾效果提高15% | 明确作用于哪一段效果，生成实体不重复继承 | 内容草案 |
| arcana.dark_echo 暗蚀 | 三格折角 | 适配暗系衰弱或侵蚀持续时间延长20% | 不默认增加吸血比例或叠加无限诅咒 | 内容草案 |
| arcana.lightning_conduction 导电 | 三格折线 | 适配的雷系跳跃攻击增加1个目标 | 仅对具备跳跃能力的效果生效 | 内容草案 |
| arcana.wind_guidance 御风 | 两格直线 | 适配风系投射物速度提高20% | 推退、移速和范围不自动一起提升 | 内容草案 |
| arcana.ice_crystal 凝霜 | 三格折角 | 适配冰分支控制持续时间增加15% | 仍受控制时长上限与目标抗性约束 | 内容草案 |
| arcana.poison_persistence 毒性延续 | 两格竖条 | 适配毒分支持续伤害的持续时间增加20% | 不同时增加毒层、传播次数或所有伤害 | 内容草案 |
| arcana.arcane_concentration 奥能专注 | 三格直线 | 适配奥术学派蓄力攻击伤害增加20%，蓄力时间增加15% | 不等同于通用聚能，非蓄力效果不自动受益 | 内容草案 |
| arcana.spatial_stability 空间稳定 | 四格折角 | 适配空间节点持续时间增加20% | 不重置投射物寿命、通门次数或召唤容量 | 内容草案 |
| arcana.temporal_extension 时效延展 | 四格 T 形 | 适配局部时缓或法杖加速的效果窗口延长15% | 不增加背包暂停时间、服务超时或无限回溯次数 | 内容草案 |
| arcana.necromantic_binding 役使 | 三格折角 | 适配亡灵召唤的持续时间延长20% | 不自动增加数量、原敌人奖励或魂能返还 | 内容草案 |

上述倍率只在该奥术适用的效果类型上生效。多个不同增幅的计算顺序与上限属于机制待定项，不能直接把示例倍率无限相乘。

# 4 符文与配方数据草案

| 产物 ID 与名称 | 材料与布局草案 | 产物形状草案 | 效果与参数草案 | 状态 |
|---|---|---|---|---|
| rune.fireball 火球【火】 | 火花与放大奥术共边相邻 | 三格 L 形 | 命中爆炸，伤害24、半径1.5、冷却2.4秒、法力5 | 配方例子已确认，数值与形状待定 |
| rune.frost_nova 冰霜新星【冰分支候选】 | 冰箭与放大奥术相邻 | 五格十字 | 范围伤害10，减速40%持续3秒，冷却4秒、法力7 | 内容草案 |
| rune.chain_lightning 连锁闪电【雷】 | 雷击与双倍奥术相邻 | 五格折线 | 命中最多3个敌人，后续跳跃伤害乘以0.75；冷却3秒、法力7 | 内容草案 |
| rune.scattered_fireball 散射火球【火】 | 火球符文与分裂奥术相邻 | 六格分叉形 | 每次发射3颗小火球，每颗伤害12，冷却3.5秒、法力9 | 内容草案 |
| rune.seeking_spark 追踪火花【火】 | 火花与追踪奥术相邻 | 两格竖条 | 追踪火焰弹，伤害12、冷却1.5秒、法力3 | 内容草案 |
| rune.piercing_blades 穿云剑【金】 | 金针与聚能奥术按指定方式相邻 | 四格直线 | 发射高穿透剑气，伤害24，最多穿透4个目标，冷却3秒、法力7 | 内容草案 |
| rune.life_pulse 生命脉冲【木】 | 回春术与放大奥术相邻 | 五格十字 | 范围内最多3个合格友方每秒恢复3生命，持续3秒；冷却6秒、法力8 | 内容草案 |
| rune.wolf_pack 灵狼群【木】 | 召唤灵狼与双倍奥术相邻 | 五格折角 | 施放生成2只灵狼，存在15秒，冷却18秒、法力14；仍占用召唤容量 | 内容草案 |
| rune.earth_bastion 厚土壁垒【土】 | 制造石墙与稳固奥术相邻 | 五格折角 | 生成耐久300的防御建筑，存在30秒，冷却24秒、法力14；路径校验仍生效 | 内容草案 |
| rune.radiant_chorus 光辉祷歌【光】 | 治愈之光与双倍奥术相邻 | 五格十字 | 对最多2个合格友方各治疗10并提供5点护盾，冷却7秒、法力10 | 内容草案 |
| rune.shadow_binding 暗影束缚【暗】 | 衰弱咒与聚能奥术相邻 | 四格折角 | 使合格敌人攻击伤害降低20%，减速15%，持续4秒；冷却6秒、法力7 | 内容草案 |
| rune.thunder_field 雷暴场【雷】 | 雷击与放大奥术相邻 | 六格不规则形 | 在目标区域每秒造成8雷电伤害，持续3秒；冷却7秒、法力11；区域效果不算建筑 | 内容草案 |
| rune.vortex 旋风涡流【风】 | 疾风推退与放大奥术相邻 | 五格十字 | 短时聚拢可被位移的敌人并造成共12伤害，冷却6秒、法力8 | 内容草案 |
| rune.shatter_lance 碎冰枪【冰分支】 | 冰箭与聚能奥术相邻 | 四格直线 | 单体伤害24，对已冻结目标额外造成12伤害；冷却3秒、法力7；每次额外伤害只结算一次 | 内容草案 |
| rune.toxic_fan 毒针散射【毒分支】 | 毒针与分裂奥术相邻 | 五格分叉形 | 发射3支毒针，每支直接伤害3并附1层毒；冷却3秒、法力7；毒层上限仍生效 | 内容草案 |
| rune.arcane_barrage 奥能连弹【奥术学派】 | 奥术弹与双倍奥术相邻 | 四格折角 | 连发3枚7伤害魔弹，冷却2.8秒、法力8 | 内容草案 |
| rune.spatial_cut 裂空斩【空间学派】 | 空间刃与放大奥术相邻 | 五格不规则形 | 在合法区域造成20伤害，冷却4秒、法力8；不把区域内单位直接移出战场 | 内容草案 |
| rune.temporal_zone 迟滞领域【时间学派】 | 时缓与放大奥术相邻 | 六格不规则形 | 区域内合格敌人的行动频率乘以0.75，持续3秒；冷却8秒、法力12；不是全局暂停 | 内容草案 |
| rune.skeletal_legion 骷髅军阵【亡灵学派】 | 召唤骷髅卫兵与双倍奥术相邻 | 五格折角 | 同次生成2名卫兵，存在20秒；冷却20秒、法力12；仍占用2个单位容量 | 内容草案 |
| rune.ossuary_guard 重甲骸卫【亡灵学派】 | 召唤骷髅卫兵与聚能奥术相邻 | 六格不规则形 | 生成1名生命100、攻击10的重甲骸卫，存在20秒；冷却22秒、法力14 | 内容草案 |

产物是独立的可装配内容；符文仍可具备主动施法或被动效果。配方是否允许整体旋转、材料等级与品级如何继承、是否保留可拆解材料，分别配置。表中“相邻”配方只是首批草案，后续可以增加直线、包围和特定异形排列。

# 5 角色与法杖数据草案

## 途径序列与晋升数据

**已确认**
角色采用具有前后依赖的途径序列晋升，并需要完成对应晋升要素。各途径为每个序列提供独立称号体系。早期角色模板名称不是最终显示名称。序列还会对特定属性的魔法提供加成。

**结构与命名草案**
角色可展示姓名、途径和当前序列称号，例如“某角色 · 薪火途径 · 序列8 燃灯者”。角色实例 ID 保持稳定，晋升只改变其阶段和能力。当前先示例9 → 8 → 7，序列编号方向和完整长度待定。

| 途径 ID 与暂名 | 序列9 | 序列8 | 序列7 | 构筑定位草案 |
|---|---|---|---|---|
| pathway.ember 薪火途径 | 执烛人 | 燃灯者 | 守焰人 | 火焰、持续输出和火灵联动 |
| pathway.vitality 生息途径 | 拾种人 | 育灵者 | 牧灵人 | 召唤、治疗与照料 |
| pathway.artifice 机巧途径 | 修补匠 | 制器师 | 构装师 | 机关、构装与多杖协同 |

这些途径与称号均为重新命名的草案。正式世界观、其他途径名称和更高序列尚未确定；不用旧角色模板名直接替代所有阶段称号。

### 晋升配置字段草案

| 对象 | 配置内容 |
|---|---|
| 途径定义 | pathwayId、名称、主题、起始序列、序列列表、可选分支 |
| 序列定义 | sequenceId、pathwayId、显示编号、称号、前序依赖、属性亲和加成与继承规则、新能力、晋升要素组、消耗 |
| 晋升要素 | nodeId、名称、前置节点、要求、全部满足或任选其一、点亮成本、检查时机 |
| 条件定义 | 对象类型、定义或标签、最低等级或品级、数量、范围、持有或装备等关系 |
| 角色实例 | 稳定实例 ID、途径、当前序列、角色等级、已点亮节点、专精选择；额外角色品级待定 |
| 晋升预览 | 已达成节点、尚未达成条件、实际扣除物、能力与属性加成变化和允许披露的下一阶段信息 |

检查范围与时机需要分开：条件可以检查本角色、其已装备法杖、背包持有或全队；可以检查曾经完成，也可以要求提交时仍然满足。不是所有条件都意味着消耗物品。

### 序列属性亲和加成草案

**已确认**
序列会对特定属性的魔法提供加成。下表的途径名称、效果选择和百分比均为示例，具体配置待确认。

| 途径与加成项 | 序列9示例 | 序列8示例 | 序列7示例 |
|---|---|---|---|
| 薪火 火系法术伤害 | 增加5% | 增加10% | 增加15% |
| 薪火 火系召唤物攻击 | 无此项 | 增加5% | 增加10% |
| 生息 木系治疗量 | 增加5% | 增加10% | 增加15% |
| 生息 木系召唤物生命 | 增加5% | 增加10% | 增加15% |
| 机巧 金系建筑攻击 | 增加5% | 增加10% | 增加15% |
| 机巧 金系直接攻击伤害 | 无此项 | 增加5% | 增加10% |

建议每列为当前序列的最终加成，不把前三列相加。序列9的5%晋升为序列8的10%时，预览显示净增加5个百分点。旧版角色特性档案中的同类倍率是早期备选，不与本表默认累加。

| 配置项 | 用途 |
|---|---|
| 属性筛选 | 火、木、金或其他已配置属性，双属性判定待定 |
| 效果筛选 | 直接伤害、持续伤害、治疗、护盾、召唤生命、建筑攻击等分别声明 |
| 归属范围 | 本角色施放、本人生成实体、指定法杖或明确的队伍光环 |
| 数值与方式 | 百分比、固定值、条件触发及其计算分组 |
| 继承与去重 | 生成时继承还是实时计算，携带来源标识以避免重复加成 |
| 替换关系 | 当前序列替换同组旧值，或明确声明独立追加；默认方式待确认 |

角色晋升条件和属性加成分别配置：满足火花或法杖等级只是达成晋升要求，不自动把这些物品本身的等级或品级提高。

### 薪火途径晋升示例

以下门槛和能力均为草案，Lv.2 与 Lv.3 等数值用于说明结构，不是已确认平衡参数。

| 目标序列 | 依赖与晋升要素草案 | 消耗草案 | 获得能力草案 |
|---|---|---|---|
| 序列9 执烛人 | 起始阶段；基础施法内容按初始配置提供 | 无晋升消耗 | 能使用基础法杖；起始携杖上限待定 |
| 序列8 燃灯者 | 必须已为序列9；角色Lv.3；本角色装备至少1根Lv.2法杖；其法杖装有Lv.2火花；点亮对应要素 | 金币，具体数量待定；法杖与火花只作条件，不默认消费 | 一个候选为解锁第二携杖位，同时获得火系基础专长 |
| 序列7 守焰人 | 必须已为序列8；角色Lv.5；完成群焰路线或御灵路线之一，并点亮对应要素 | 金币；是否增加材料待定 | 选择一项序列专精，形成不同构筑 |

群焰路线候选要求：本角色装配Lv.2火球和Lv.2放大奥术；候选能力为火球命中后留下短时灼烧区域。御灵路线候选要求：本角色装配Lv.2火灵和Lv.2双倍奥术；候选能力为强化本人火灵的存续或协同。两条路线都需要序列8作为前序，不能直接跳到序列7。

这些是互斥专精、可切换专精还是都能后续学习仍待定。范围条件、召唤能力与携杖解锁需要按最终机制配置，不从称号自动推导。

### 生息与机巧的依赖示例

| 目标序列 | 条件方向草案 | 能力方向草案 |
|---|---|---|
| 生息序列8 育灵者 | 已有拾种人；角色等级达标；本角色装配达标的灵狼或木灵，并装备达标法杖 | 强化召唤与照料，携杖能力另行配置 |
| 生息序列7 牧灵人 | 已有育灵者；回春术与选定召唤路线达标；完成对应节点 | 动物统御或生命照料专精候选 |
| 机巧序列8 制器师 | 已有修补匠；本角色箭塔法术与法杖等级达标；完成机关节点 | 增加合法机关部署容量或解锁机关操控能力 |
| 机巧序列7 构装师 | 已有制器师；箭塔与金灵等协同要素达标；完成对应节点 | 机关与召唤的目标协同，或多杖构装专精候选 |

具体等级、费用、物品要求和前置节点需要逐途径确认。装备条件只在其声明的范围内生效；另一角色的法杖不自动为当前角色达标。晋升后是否持续要求装备、材料是否消费、奖励角色的起始序列和转修规则见机制文档的待定项。

### 等级与角色品级的衔接

建议角色等级负责基础培养，序列负责身份、关键能力和进阶门槛；角色品级可优先由序列表达。是否另外保留同序列资质或稀有度仍待定，不默认要求等级、品级、序列三套系统同时独立升级。法术、奥术与法杖的等级、品级继续独立定义。

## 角色特性与途径映射草案

下面保留早期角色特性档案，用于后续映射到途径、序列能力和专精；它们不是已经定名的正式角色列表。角色显示名称改由姓名、途径和当前序列称号组织。旧 ID 用于追踪已有草案，不要求成为最终职业名称。

| 参考 ID 与特性档案 | 已有特性草案 | 成长候选 | 序列或专精能力候选 | 依赖与待定 |
|---|---|---|---|---|
| character.apprentice 学徒【属性专长待定】 | 无额外倍率，作为基础角色 | 通用施法能力、资源使用效率逐步成长 | 选择一个元素或辅助专长 | 保留基础对照用途；不默认每项属性同时增长 |
| character.ember 薪火方向特性档案【火】 | 本人火系伤害增加15% | 火系伤害、灼烧能力或火系资源效率 | 让部分火系命中产生范围余烬 | 灼烧与额外触发机制尚未确定 |
| character.rime 霜语者【冰分支候选】 | 本人施加的减速持续时间增加25% | 控制持续时间、控制覆盖或冰系效率 | 针对已减速敌人提供额外效果 | 控制上限和首领抗性待定 |
| character.conduit 引流者【通用资源专长】 | 本人法力回复增加20% | 法力上限、回复或施法资源效率 | 为另一根法杖或队友提供有限支援 | 采用法力系统后启用，共享范围待定 |
| character.artificer 制杖师【通用多杖专长】 | 同时装备多杖时施法速度增加10% | 多杖协调或建造效果成长 | 额外携杖位或特殊建筑强化 | 携杖解锁和建造特性均为独立候选 |
| character.beastkeeper 生息方向召唤档案【木】 | 本人木系动物召唤生命增加15% | 动物伤害、生命、持续时间或召唤资源效率 | 额外召唤容量或动物协同行为 | 召唤上限、指挥与加成继承待定 |
| character.architect 筑城师【土】 | 本人土系建筑耐久增加20% | 建筑耐久、攻击或辅助效果、建造资源效率 | 专用部署位、修理能力或额外建筑容量 | 部署、修理、建筑上限和阻挡规则待定 |
| character.metalwright 机巧方向机关档案【金】 | 本人金系机关建筑伤害增加10% | 金系穿透、机关输出或资源效率 | 让金灵与机关形成有限协同 | 精灵和建筑联动规则待定 |
| character.verdant_healer 青木医者【木】 | 本人木系治疗量增加15% | 直接治疗、持续治疗或辅助召唤成长 | 治疗精灵与生命树联动 | 同一来源加成不得在生成和治疗时重复计算 |
| character.dawnwarden 晨辉守护者【光】 | 本人光系护盾量增加15% | 即时救援、护盾或净化专长 | 光灵与灯塔的保护协同 | 不默认光照就揭示全部隐藏信息 |
| character.hexweaver 影咒师【暗】 | 本人暗系削弱持续时间增加20% | 诅咒、汲取或持续影响 | 对受诅咒目标触发有限额外效果 | 目标抗性、受益对象与叠加待定 |
| character.stormcaller 引雷者【雷】 | 本人雷系伤害增加10% | 连锁伤害、跳跃范围或资源效率 | 在关键节点获得一次额外跳跃 | 仅对可跳跃效果生效，上限待定 |
| character.windwalker 逐风者【风】 | 本人风系法术冷却缩短10% | 位移控制、投射物或机动支援 | 风灵和移动召唤物协同 | 静止单位不因移速加成获得额外效果 |
| character.venomcaller 养毒师【毒分支】 | 本人毒持续伤害增加10% | 毒伤、持续时间或有限传播成长 | 毒蜂与感染印记协同 | 不默认免疫所有毒或无限叠层 |
| character.arcanist 奥能贤者【奥术学派】 | 本人奥术学派法术消耗降低10% | 蓄力、魔弹输出或资源效率 | 有限的奥能回复或护盾转化 | 法力系统与资源循环规则待定 |
| character.riftwalker 行界者【空间学派】 | 本人空间节点持续时间增加15% | 部署距离、转移效率或节点稳定 | 空间精灵与折射门协同 | 所有落点、配对与容量仍需合法 |
| character.chronomancer 观时者【时间学派】 | 本人局部节奏效果持续时间增加10% | 加速窗口、延时输出或有限恢复 | 对单根法杖或单个友方的节奏支援 | 不取得回档奖励、物品或世界时间的能力 |
| character.necromancer 死灵术士【亡灵学派】 | 本人亡灵召唤生命增加10% | 亡灵强度、维护、尸骸利用或资源效率 | 在关键节点获得军团容量或特定亡灵强化 | 尸骸、魂能与召唤上限分别设计，不复制原怪物完整能力 |

### 角色成长参数草案

角色升级与品级机制已经确认。上表的角色、初始专长、成长方向和解锁能力仍为内容草案，多个候选效果并不表示同一角色全部获得。

- 角色配置基础属性成长，途径定义前后依赖的序列、称号、能力与晋升节点；具体等级门槛、阶段长度和倍率仍为草案。

- 角色品级与序列的关系需要重新确认，优先考虑由序列表达阶位；是否额外保留资质待定。携杖和召唤数量的关键能力可以配置在指定序列，但不默认所有途径相同。

- 伤害、治疗、资源和范围等加成默认需要声明作用于本人、指定法杖、本人生成实体或队友，实际作用范围待确认。

- 生命与防御字段仅在角色存在独立受击系统时启用。召唤动物与建筑的生命和耐久不依赖角色本身必须拥有生命。

- 数量型成长如携杖、召唤和建筑上限，建议以少量关键节点配置，避免与全部数值成长同时无上限增加。

- 角色实例保存等级、途径、当前序列、已点亮要素和已选专精，角色额外品级是否保留待定；经验来源、重复角色用途、后加入角色追赶与起始序列尚未确定。

## 法杖候选

| ID 与名称 | 可用区域草案 | 固有特性草案 | 获取方向 |
|---|---|---|---|
| wand.training 练习法杖 | 3×3九格 | 无额外加成 | 初始装备候选 |
| wand.ember 余烬法杖 | 4×3区域中开放十格 | 火系伤害增加10% | 火系奖励或首领掉落 |
| wand.conduit 导流法杖 | 2×5十格 | 法力消耗降低10% | 构筑奖励或商店候选 |
| wand.forked 分枝法杖 | 4×4区域中开放十二格，带缺口 | 鼓励异形拼装，无数值加成 | 稀有奖励候选 |
| wand.swift 轻捷法杖 | 2×3六格 | 冷却缩短15% | 小型辅助杖候选 |
| wand.metal_resonance 鸣锋法杖【金】 | 十格折角区域 | 金系攻击伤害增加10% | 金系奖励或掉落候选 |
| wand.verdant 青藤法杖【木】 | 十二格带凹口区域 | 木系治疗量增加10% | 木系奖励或掉落候选 |
| wand.clear_flow 澄流法杖【水】 | 十格长条区域 | 水系控制持续时间增加10% | 水系奖励或掉落候选 |
| wand.earth_anchor 镇岳法杖【土】 | 十二格方形带缺口区域 | 土系建筑耐久增加10% | 土系奖励或掉落候选 |
| wand.dawn 晨辉法杖【光】 | 十格对称区域 | 光系护盾量增加10% | 光系奖励或掉落候选 |
| wand.dusk 暮影法杖【暗】 | 十格折角区域 | 暗系削弱持续时间增加10% | 暗系奖励或掉落候选 |
| wand.storm 雷鸣法杖【雷】 | 十格折线区域 | 雷系攻击伤害增加10% | 雷系奖励或掉落候选 |
| wand.gale 流岚法杖【风】 | 九格分枝区域 | 风系投射物速度增加15% | 风系奖励或掉落候选 |
| wand.frost 凝霜法杖【冰分支】 | 十格折角区域 | 冰分支护盾量增加10% | 冰分支奖励候选 |
| wand.venom 蚀露法杖【毒分支】 | 九格曲折区域 | 毒持续时间增加10% | 毒分支奖励候选 |
| wand.arcane_focus 奥能法杖【奥术学派】 | 十格长条区域 | 奥术学派蓄力伤害增加10% | 奥术学派奖励候选 |
| wand.rift_anchor 界锚法杖【空间学派】 | 十格双翼区域 | 空间节点持续时间增加10% | 空间学派奖励候选 |
| wand.hourglass 流时法杖【时间学派】 | 十格对称区域 | 局部时缓持续时间增加10% | 时间学派奖励候选 |
| wand.ossuary 骸骨法杖【亡灵学派】 | 十格分枝区域 | 亡灵召唤持续时间增加10% | 亡灵学派奖励或首领掉落候选 |

法杖具备升级与品级机制已确认。开放格子的精确坐标、固有特性、具体成长方式、品级效果和装备条件仍待确认。更大空间、更优形状和固有加成可以是不同法杖的价值来源，不能只按格子数量判定强弱。

# 6 道具装备与成长奖励数据草案

## 道具与其他装备

| ID 与名称 | 类型 | 效果草案 | 限制或待定 |
|---|---|---|---|
| item.healing_potion 治疗药水 | 消耗品 | 回复目标最大生命的25% | 可用目标、使用阶段与叠加上限待定 |
| item.mana_potion 法力药水 | 消耗品 | 回复目标最大法力的40% | 是否采用法力系统待定 |
| item.repair_kit 修缮包 | 消耗品 | 回复领地最大生命的20% | 是否仅波间可用待定 |
| item.expansion_stone 扩槽石 | 构筑材料 | 解锁法杖一个预留格 | 可解锁位置与法杖兼容条件待定 |
| item.reroll_ticket 刷新券 | 消耗品 | 刷新一次尚未领取的奖励 | 刷新机制本身待定 |
| robe.apprentice 学徒法袍 | 装备 | 法力上限增加10 | 装备槽与属性归属待定 |
| robe.ward 守护法袍 | 装备 | 角色受到伤害降低10% | 角色受击系统尚未确定 |

法杖、法袍作为装备类别已经提出；具体道具和装备效果均为内容草案。不存在角色生命时，不能直接启用依赖角色受击的法袍效果。

## 波次成长奖励候选

| ID 与名称 | 效果草案 | 相关机制 |
|---|---|---|
| reward.fortify 加固领地 | 最大生命增加10% | 当前生命是否同比增加待定 |
| reward.power 魔力增幅 | 全队法术伤害增加8% | 属性作用范围待确认 |
| reward.haste 施法熟练 | 施法冷却缩短5% | 冷却下限与叠加方式待定 |
| reward.range 远距施法 | 射程增加10% | 治疗与非指向法术是否适用待定 |
| reward.area 扩散掌握 | 作用半径增加8% | 半径与面积的口径需明确 |
| reward.luck 幸运眷顾 | 运气增加1 | 运气到概率的映射待定 |
| reward.income 稳定收益 | 波次基础金币结算增加10% | 怪物掉落是否排除在外待定 |
| reward.recruit 新的同伴 | 从允许的角色池获得一名角色 | 来源、品质、容量与重复处理待定 |
| reward.wand 新的法杖 | 获得一根法杖 | 是否进入背包或待领取区待定 |

生命、防御、攻击倍率、施法速度、距离、范围、运气、经济和恢复等奖励方向已确认；本表具体名称、数值与发放方式均为草案。升级奖励池仍需单独确定，不能直接把本表视作已批准的升级奖励。

# 7 敌人与首领数据草案

## 普通敌人候选

| ID 与名称 | 基础参数草案 | 行为与特点草案 | 对构筑的考验 |
|---|---|---|---|
| enemy.slime 灰泥怪 | 生命30，攻击2，每2秒攻击 | 缓慢接近领地 | 基础输出 |
| enemy.runner 疾行兽 | 生命20，攻击2，每1.5秒攻击 | 移动速度为基础的1.8倍 | 减速与目标选择 |
| enemy.brute 厚皮兽 | 生命100，攻击6，每3秒攻击 | 速度为基础的0.6倍 | 持续单体伤害 |
| enemy.swarm 纸屑群 | 单体生命8，攻击1，每2秒攻击 | 成组出现 | 范围攻击与分裂 |
| enemy.shield_guard 护盾卫 | 生命45，护盾30，攻击3，每2秒攻击 | 护盾先吸收伤害 | 多段攻击与破盾 |
| enemy.hexer 咒术怪 | 生命35，攻击3，每2.5秒攻击 | 接近后短暂停留，远程攻击领地 | 射程与优先目标 |

击败任何怪物必得经验是已确认规则。经验量、金币概率、移动速度单位与怪物分组数量待定。上表为未乘波次成长的初始候选参数。

## 首领候选

| ID 与名称 | 层级候选 | 技能草案 | 掉落倾向草案 |
|---|---|---|---|
| boss.ember_beast 熔核巨兽【火】 | 小 Boss | 周期性获得短时护甲，接近后重击 | 火花、放大、火系法杖 |
| boss.frost_keeper 霜境守卫【冰分支候选】 | 大 Boss | 护盾阶段与召唤快速敌人交替 | 冰分支内容、控制奥术、法袍 |
| boss.arcane_colossus 奥术巨像【奥术学派候选】 | 顶级 Boss | 多阶段防御与召唤；要求兼顾清场和集中输出 | 多杖相关装备、稀有角色或奥术 |
| boss.ossuary_lord 骸骨领主【亡灵学派候选】 | 大 Boss 候选 | 骨盾阶段与召唤可清理骨兵交替 | 亡灵法术、役使奥术、骸骨法杖或死灵术士候选 |

首领名称、技能、层级归属和掉落内容均为草案。每5、10、100波的首领节奏是已确认方向；生命、技能周期、抗性、掉落概率与是否替代其他首领尚未确定。

# 8 状态环境与展示数据草案

## 状态候选

| ID 与名称 | 效果草案 | 叠加或恢复规则草案 |
|---|---|---|
| status.burning 灼烧 | 每秒造成火焰伤害 | 先尝试取最高伤害并刷新持续时间 |
| status.slow 减速 | 降低移动速度 | 多来源先取最强值，设置最低移动速度 |
| status.wet 潮湿 | 作为水系及环境联动标签 | 水雷导电、风火等反应均为候选，倍率与触发规则待定 |
| status.shield 护盾 | 先于生命吸收伤害 | 额度、持续时间与治疗关系待定 |
| status.rooted 缠绕 | 限制可被控制目标的移动 | 是否完全定身、首领抗性与重复控制待定 |
| status.regeneration 回春 | 按来源配置周期恢复生命 | 多来源治疗的叠加与刷新规则待定 |
| status.weakened 衰弱 | 降低敌方攻击伤害 | 强度、覆盖来源、刷新方式与首领抗性待定 |
| status.stunned 眩晕 | 短暂停止合格目标的移动与攻击 | 目标免疫、抗性、连续控制上限待定 |
| status.chill 寒意 | 累积控制进度，到阈值后尝试冻结 | 阈值、衰减、抗性和触发间隔待定 |
| status.frozen 冻结 | 短时限制可控制目标的移动与攻击 | 不无限刷新，首领可减免或只受减速 |
| status.poison 中毒 | 原型每层每秒2伤害，先试最多5层，持续5秒 | 来源共享或独立上限、刷新和抗性待定 |
| status.infected 感染 | 目标死亡时有限传播毒层 | 最多传播到2个合法目标，传播不再次触发传播 |
| status.temporal_slow 局部时缓 | 降低声明的移动与攻击频率 | 不默认影响持续毒、召唤寿命或现实请求超时 |
| status.cooldown_haste 冷却加速 | 提高指定法杖的冷却恢复速度 | 与急速统一计算，最短冷却与倍率上限待定 |
| status.rewind_guard 回溯护佑 | 在短窗口结束时有限恢复净损失生命 | 扣除窗口内已发生的治疗；目标已退场则不复活 |

## 环境候选

| ID 与名称 | 效果草案 | 可预告信息 |
|---|---|---|
| terrain.plain 平原 | 无额外规则 | 基础场地候选 |
| terrain.marsh 沼泽 | 指定区域降低移动速度 | 区域轮廓与减速说明 |
| weather.clear 晴天 | 无额外规则 | 基础天气候选 |
| weather.rain 降雨 | 为符合条件的单位附加潮湿 | 天气持续轮次及已知联动 |
| weather.wind 大风 | 改变部分投射物的飞行表现 | 方向和作用对象 |

这些都是后续内容草案，不构成首版必须实现清单。伤害、减速和环境联动需要先完成统一的状态处理，避免每个法术各自实现一套规则。

## 占位与可替换表现

| 对象 | 前期占位 | 后续可替换内容 |
|---|---|---|
| 角色 | 名称、简单图标、状态条 | 立绘、行走与施法动画、音效 |
| 怪物 | 基础形状、名称、血条 | 角色图像、移动和攻击动画 |
| 法杖 | 名称、网格、开放格标记 | 杖体插画、材质与特效 |
| 法术与奥术 | 名称缩写、图标、真实占格 | 插画、动态图标、施法特效 |
| 符文 | 名称、占格和配方说明 | 符文纹样、合成动画 |
| 战场 | 简单背景与路径线 | 场景图、环境动画 |
| 攻击与受伤 | 线、圆、短暂高亮、数字 | 弹道、粒子、受击与音效 |

占位与正式素材通过表现配置切换，规则与协议引用保持稳定。

# 9 内容确认与后续维护

下一轮可以先确认：首发基础法术与奥术、多角色多法杖的运行方式、火球配方、初始槽位、经验与奖励分工。确定机制后，再校准本册的数据。

每次确认新规则时同步更新两份文档：机制设计记录运行规则和边界，本册记录受影响的内容与参数。新增数据条目保持稳定 ID；修改平衡数值不随意改名或重建实例。只有完成确认的草案才转为“已确认”。

讨论依据包括本聊天中的游戏、Agent 协议、信息披露与素材要求，以及引用的 [Inkra 对话](thread://01a17ea3-2a87-7f71-8744-a275e57db062?hostId=local) 中的游戏设想。组件库发布记录与维护流程不纳入游戏规则。



## 当前原型领地升级数据

以下是可调整的试玩数值，并非最终平衡。费用由升级前的当前等级计算。

| 类别 | 初始等级 / 封顶 | 单次收益 | 金币费用 |
|---|---|---|---|
| 城墙 | 1 / 5 | 生命上限与当前生命各+20，保留已有损伤 | 20 × 当前等级 |
| 护盾 | 1 / 5 | 护盾上限与当前护盾各+10，保留已有损伤 | 15 × 当前等级 |

当前敌人等级取出生波次；普通敌人为白板，小型/大型/顶级首领分别暂映射稀有/史诗/神话。
这个标签不改变原有生命、攻击或掉落公式，仅为现有强度补充可消费的等级/品质元数据。
死亡痕迹默认由红褐到深酒红按品质变化，火花/火球焦黑，雷矢偏深紫焦痕，岩弹范围倍率1.55；
风刃更扁长，金针较窄，水弹新痕迹较稀，真实水弹命中还会局部清洗旧痕迹。
素材与颜色映射可替换，不把血迹状态当作战斗规则。


## 当前试玩随机奖励参数（2026-11-04）

以下均为可调原型数据；不对卡片位置指定类型。每次四张独立有放回抽取。
类型权重为属性45、魔法35、恢复10、角色5、法杖5、金币10，剔除当前不可用项后归一；
满生命不出无效恢复，角色上限3、每角色最多两根法杖。
六档品质依次为白板、精良、稀有、史诗、传说、神话，权重60、22、12、4、1.5、0.5。

| 属性奖励 | 六档对应数值 | 作用 |
|---|---|---|
| 攻击提升 | 10 / 15 / 20 / 30 / 40 / 50% | 本局全队攻击魔法力量加成 |
| 法力上限 | 10 / 15 / 20 / 25 / 35 / 50 | 各角色上限与当前值增加同量 |
| 法力回复 | 1 / 2 / 3 / 4 / 6 / 8每秒 | 各角色回复速率增加 |
| 射程提升 | 5 / 8 / 10 / 15 / 20 / 25% | 法术射程倍率加成 |
| 冷却缩减 | 4 / 6 / 8 / 10 / 12 / 15% | 同类相加，上限70% |

当前可获得目录为26个法术与4个奥术，包括上方12个新增法术和3个持续光束。
伤害、概率与默认属性属于试玩数值，不代表最终平衡。


## 角色基础与装备属性原型（2026-11-04）

基础值按角色实例独立保存。现有存档缺失项补中性默认，避免本次结构调整改变已有战斗平衡。

| 指标 | 当前中性默认 | 装备作用 |
|---|---|---|
| 攻击 | 额外力量0 | 加法，之后参与本局攻击倍率、奥术及元素增幅 |
| 攻速 | 施法频率加成0% | 百分点相加，作用于每个法术的冷却 |
| 弹速 | 飞弹速度加成0% | 与装备百分点相加，乘到法术自身弹速；不改变冷却或射线脉冲 |
| 射程 | 额外射程0 | 世界坐标单位相加，之后参与本局与聚焦倍率 |
| 精准 | 命中率100% | 概率加值，最终限制0–100% |
| 暴击 | 发生率0% | 概率加值，最终限制0–100% |
| 暴伤 | 1.5倍 | 倍率加值，最终限制1–10倍 |
| 幸运 | 0 | 与队伍幸运共同影响真实击杀的金币概率 |
| 元素 | 各系0% | 角色与装备的同系加值相加，再与序列同系增幅相乘 |
| 法力、回复 | 沿用已有角色实例值 | 装备增加有效上限和每秒回复；不重复应用已经写入实例的本局奖励 |

精准不替代弹道接触检查。发生真实接触后才进行命中判断，再按命中条件判断暴击；未命中不触发伤害、击杀或经验。
穿透/连锁每目标、范围打击每目标、射线每脉冲每目标分别结算；概率使用同一个可存档随机源。
已发射攻击保留原施法角色的精准、暴击和幸运快照，后续换装不追溯修改在途攻击。
装备贡献只计算合法归属且实际穿戴的实例，重复引用不能重复叠加。当前法杖可提供属性加成，四个常规装备位保留同一通用数据模型；更多装备内容与穿戴入口后续完善。

### 新增雷系连锁法术原型

以下三项均为等级1、白板（`common`）的雷系弹体法术。形状均连通且可放入3×3法杖。跳电提供短冷却、短跳距的快速连锁；雷链伤害和跳跃半径较高、最多命中4个目标；雷网的单次力量较低、半径较窄，但最多命中6个目标。命中后弹体会实际飞往下一目标，且每次连锁按配置衰减伤害。名称、参数和手感均为待平衡的内容原型。

| ID | 名称 | 占格坐标 | 力量 | 法力 | 冷却 | 射程 | 弹速 | 连锁半径 | 最多目标 | 后续伤害系数 |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `spark-hop` | 跳电 | (0,0)、(1,0) | 8 | 4 | 650 ms | 26 | 125 | 9 | 3 | 0.6 |
| `thunder-chain` | 雷链 | T形4格：(0,0)、(1,0)、(2,0)、(1,1) | 20 | 14 | 1800 ms | 36 | 105 | 22 | 4 | 0.85 |
| `storm-net` | 雷网 | 2×2 | 12 | 16 | 2100 ms | 30 | 110 | 11 | 6 | 0.8 |

## 角色按等级成长（2026-11-04）

角色成长使用静态档案，独立于固有基础、装备和本局奖励。每级基础增量为攻击1、施法速度1个百分点、射程0.1、飞弹速度0.5个百分点、法力上限5、每秒法力恢复0.25。火系档案攻击×2、施法速度×1.5；木系档案攻击×0.75、法力上限×2、恢复×2；均衡档案均×1，未列倍率均为1。此为当前原型数值，不表示平衡定案。

`getCharacterGrowth(character)` 返回档案、倍率、每级实际增量和总成长；总成长为 `(level-1) × 每级实际增量`，不是指数翻倍。`getCharacterStats` 的 `growth` 层在基础、装备加法中只计一次，随后应用原本局与序列倍率。实例 maxMana/manaRegen 已包含历史本局奖励，不再次叠 run 摘要。真实升级逐级用新等级最终法力上限回满；历史高等级恢复只获得对应成长，不回满、不补发历史赠品。缺失或未知档案按原序列稳定回退为 wood/fire/balanced，归一化只保存档案，不永久修改基础属性。

## 怪物体型与可替换素材（2026-11-04）

`content/monsters.ts` 为怪物的体型和素材定义共享来源。像素大小供界面使用，碰撞半径为战场坐标单位，二者按普通体型同比增长。

| 体型 ID | 显示像素 | 碰撞半径 | 当前默认定义 |
|---|---:|---:|---|
| small | 24 | 0.75 | 预留小型怪物 |
| normal | 32 | 1 | enemy-basic |
| large | 48 | 1.5 | boss-minor |
| huge | 64 | 2 | boss-major |
| colossal | 80 | 2.5 | boss-apex |

实例合法的 `bodySize` 可覆盖定义体型，缺失时按定义查找，未知定义回退 normal；不必给每个出生实例重复保存默认值。素材 key 分别为 `monster.basic`、`monster.boss.minor`、`monster.boss.major`、`monster.boss.apex`，可替换图像而不重写体型或战斗规则。

攻击表现复用真正结算伤害时的 `territoryAttacked` 事件，保留 enemyId，并增加 sourceEntityId、targetId=territory、x/y。界面可以驱动怪物图像短暂抬头/低头，不改变模拟坐标或另外计时结算伤害。

## 魔法奖励介绍（2026-11-04）

物品奖励使用 `enrichMagicReward(reward, content)` 展示具体用途，取代“获得此法术或奥术并放入背包”的通用说明。当前26法术与4奥术均有简短效果句：区分直接攻击、加速火球、穿透、范围、逐跳衰减、脉冲射线、领地生命和护盾恢复，以及相邻奥术的增幅、分次连发、同时分支、力量与射程提升。水系真实命中可冲洗附近血迹；火球目前只有加速与接触伤害，不声称范围爆炸。

介绍直接来自实际effect/impact/element及少量稳定行为特例，不增加未实现的持续灼烧、减速或角色生命机制。只修改已知物品的description，保留原ID、品质、效果和详情；未知定义或不支持的效果保原说明。文案为短用途句，不附氛围套话、实现说明或模板最终伤害。新抽卡与现有奖励卡可共用该纯函数，不额外取随机数或重新抽卡。

## 四槽装备与普通消耗品原型（2026-11-04）

装备目录现提供每槽两件、共八件1级白板定义。按用户最新确认，四槽装备统一只占1格，定义shape固定为唯一坐标(0,0)，不具有不同体积；法杖容量独立，普通药水仍可占1至2格。实例通过createGearFromDefinition生成，未穿戴时characterId为null，并保definitionId。属性采用已有共享gradePower表的实例品质/定义品质比例缩放，不永久改角色基础。

| 槽位 | 定义ID | 名称 | 白板基础贡献 |
|---|---|---|---|
| head | apprentice-hat | 学徒帽 | 法力上限15、每秒法力恢复0.5 |
| head | astrologer-hood | 占星兜帽 | 暴击率3个百分点、法力上限10 |
| body | rune-robe | 魔纹袍 | 每秒法力恢复1、法力上限10 |
| body | heartguard-armor | 护心甲 | 攻击3、精准3个百分点 |
| feet | swift-boots | 轻行靴 | 施法速度5个百分点、飞弹速度10个百分点 |
| feet | farwatch-boots | 远望靴 | 射程3、精准2个百分点 |
| accessory | copper-ring | 铜戒 | 攻击2、暴击率2个百分点 |
| accessory | spring-pendant | 灵泉坠 | 法力上限20、每秒法力恢复1 |

装备只提供已生效的角色属性，不宣称角色生命、护甲减伤或移动速度。asset.label采用定性作用介绍，避免白板固定数值被误当作更高品质实例的最终贡献；真实加成读取实例statBonuses并经角色统一getter计算。

普通物品目录提供生命药水health-potion（白板恢复领地生命40）、护盾药水shield-potion（恢复领地护盾30）、法力药水mana-potion（全队角色各恢复法力50），均1级、占1至2格。createSupplyFromDefinition只生成独立的ID/definitionId/level/grade实例，效果定义不复制进实例；使用效果由统一运行时读取定义并按共享品质比例计算。装备与普通物品分别保存在state.gear和state.supplies，不混入魔法items或backpack数组，获得时在各自knowledge列表发现定义。

### 真实击杀掉落原型

每次敌人真实死亡结算后，由根引擎调用grantEnemyLoot一次；模块不另建死亡账本或重复结算伤害。只有本局尚无装备且从未发现装备时，首次装备保底生效，丢弃全部装备不会重置保底。普通装备基础机会8%，以全局幸运加原发射攻击的幸运快照，每点增加0.1个百分点，最高30%；普通药水独立4%。幸运提高装备机会，不改变品质权重。

小首领、大首领和顶级首领保证一件装备，若当前目录无有效装备则回退药水；品质底线依次稀有、史诗、传说。普通品质权重为白板60、精良25、稀有10、史诗4、传说0.8、神话0.2，首领按底线提升；同一次最多装备1件与药水1件。上述概率和品质分布均为可调原型规则，消耗同一存档随机流，不使用额外随机源。

掉落通过定义工厂生成独立实例ID，检查魔法、装备、药水、法杖、角色、实体和背包中的ID以防覆盖，获得时发现对应定义。装备保持未穿戴，不直接替玩家换装；药水不自动使用。lootGranted仅为结构化事件，不默认显示泛成功提示。普通发现接口仍只应展示玩家已知定义，完整静态目录由根协议过滤。

## 三种非发射攻击（2026-11-04）

目录新增落雷、冰环、地刺，现29法术。三者为独立area攻击实体，速度为0、不产生飞弹或beam；作用位置和时间决定真实命中，伤害共用角色攻击、品质、元素、精准/暴击及发射时幸运快照。

| ID | 名称与模式 | 白板力量/法力/冷却 | 射程与区域 | 预兆/展开或残留 |
|---|---|---|---|---|
| thunder-strike | 落雷 strike | 24 / 12 / 1800ms | 锁地射程36，局部半径3，最多3目标 | 300ms / 250ms |
| frost-ring | 冰环 ring | 12 / 14 / 2200ms | 角色中心半径18，最多8目标 | 0ms / 650ms |
| earth-spikes | 地刺 eruption | 30 / 15 / 2600ms | 锁地射程32，局部半径5，最多5目标 | 600ms / 300ms |

落雷与地刺在施放时锁定敌人所在的地面位置，延迟后一次结算范围内仍存活目标，敌人移走可以躲开；不会隐形追踪。冰环从施法角色的共享锚点扩散，按前后波前扫过与敌人身体接触，每敌每环仅一次，未加入冻结、减速或持续伤害。范围与角色/奥术编译结果统一，ring的最终半径来自编译射程，snapshot保实际值。

双重复用120ms分时模式，分裂真实产生多地点或同心多环，各分支独立伤害；同心环同时起扩、展开时长有区分。每次最多8个区域实体、全场32个、每实体最多8目标、总寿命不超过5秒，区域半径最多100。暂停/背包冻结，清波和失败清理，不跨波伤害。事件为areaSpawned/areaActivated与普通damage（areaId来源），不是伪造projectileId；实际伤害和经验按原施法角色归属。

## 九类奥术与完整异名合成路线（2026-11-04）

在增幅、双重、分裂、聚焦之外，新增迅捷haste、节能efficiency、延展reach、疾行velocity、广域area，目录共9奥术。构筑编译分别实际调整冷却、法力消耗、射程、飞弹速度和区域半径/光束宽度/溅射或连锁范围，冰环的广域同时联动实际射程。effects接收编译后的impact/beam/area优先于原模板，不能在生成效果时吞掉几何增益；卡片短介绍不把白板模板百分比冒充角色最终数值。具体配置及品级变化由共享构筑规则负责。

magicRecipes.ts定义9种基础法术：火花、回春、金针、水弹、雷矢、风刃、岩弹、光矢、暗蚀，作为直接获得的起点；20条相邻异名配方覆盖其余法术，首项fireball-recipe保留。配方输入包括法术或奥术材料，必须实际消耗后生成对应法术，不与同名升品质机制混淆。

| 产物 | 输入 |
|---|---|
| 火球 | 火花 + 增幅 |
| 炎矛 | 火球 + 延展 |
| 熔爆 | 火球 + 广域 |
| 荆刺 | 回春 + 金针 |
| 生息 | 回春 + 增幅 |
| 潮涌 | 水弹 + 广域 |
| 岩刺 | 岩弹 + 延展 |
| 飞刃 | 金针 + 风刃 |
| 风爆 | 风刃 + 广域 |
| 电弧 | 雷矢 + 双重 |
| 光盾 | 光矢 + 回春 |
| 光束 | 光矢 + 聚焦 |
| 炎流 | 炎矛 + 聚焦 |
| 幽光 | 暗蚀 + 聚焦 |
| 跳电 | 雷矢 + 节能 |
| 雷链 | 电弧 + 增幅 |
| 雷网 | 电弧 + 广域 |
| 落雷 | 雷矢 + 聚焦 |
| 冰环 | 水弹 + 风刃 |
| 地刺 | 岩刺 + 广域 |

所有配方ID与产物唯一且有向无环，9基础加20产物覆盖全部29法术。手册总览与协议仍按玩家已知知识披露；未发现节点由根界面/投影隐藏名字与效果，完整静态表不等于普通发现端点可全部返回。上述力量、费用、时间、范围与合成关系为本次可玩的原型配置。

## 持续区域与雷系传导配置（2026-11-04）

本批追加四个定义，当前目录为33法术、11奥术、24配方，已接真实战斗与合成；验收记录见battle任务记录。四发与六发复用连发修饰和120ms模拟间隔，基础值分别4/6，可受品级规则提升。

| ID | 名称 | 力量/法力/冷却 | 作用配置 | 配方 |
|---|---|---|---|---|
| fire-field-bolt | 焰域弹 | 6/12/2400ms | 速度60、射程30，接触引爆；半径6，2400ms内每400ms伤害，单pulse最多5敌 | 熔爆+节能 |
| thunder-field-bolt | 雷域弹 | 7/14/2600ms | 速度85、射程34，接触或射程终点引爆；半径5，2000ms内每400ms伤害，单pulse最多6敌 | 雷网+聚焦 |
| thunderstorm | 雷暴 | 8/45/8000ms | 全屏中心50,50，半径75，2000ms内每400ms伤害，单pulse最多64敌 | 雷域弹+广域+双重 |
| moving-storm | 风暴 | 6/24/5000ms | 从角色处移动，速度12；伤害半径8、牵引半径12、牵引强度8世界单位/秒，4000ms内每400ms伤害，单pulse最多8敌 | 风爆+广域 |

焰域弹、雷域弹均占2×2，雷暴为完整3×3，风暴为3×3十字。field飞弹按实际路径累计射程，范围触发忽略沿途接触；接触触发未撞敌则到射程消散；either取先发生者，同点优先接触。引爆不另叠直接伤，第一周期到期后开始结算；每次周期重新选择圈内活敌，同敌可以受到多个周期伤害。雷暴仅影响中心处于x/y均0..100的可见敌人，不伤负y预生怪。风暴为有限寿命移动area，内部hp仅存活标记；确定性路径和周期时钟可存档，牵引每片最多到中心，不是召唤物或宠物。

用户明确纠正电弧、跳电、雷链、雷网的玩法：使用chain效果，首击即时命中射程内最近活敌，随后每80ms从上次命中位置向邻近未命中活敌传导；保留各自chain半径、目标上限及衰减。它们不再生成飞弹或使用飞行速度。双重/四发/六发仍分时启动独立链，分裂同时展开独立链；伤害精准/暴击、幸运与经验归原施法角色。此条替代旧连锁飞弹描述，普通飞弹的原有impact能力保留。

## 七种普通怪物（2026-11-04）

monsters.ts统一定义名称、资产颜色、体型和出生参数；波次从已解锁普通定义按出生序号轮换，首领不占普通轮换序号。首波保持灰泥怪与原友善出生通道，之后逐步加入新种类，波10起全部解锁，波28可实际遇到七种。生命、伤害、速度和攻击间隔为现有波次基础值的倍率，未给移动模式的定义保留原出生序号直行/追角色规则。

| ID | 名称/颜色/体型 | 解锁波 | 生命/伤害/速度/间隔倍率 | 移动 |
|---|---|---|---|---|
| enemy-basic | 灰泥怪/灰褐/normal | 1 | 1/1/1/1 | 原规则 |
| enemy-moss | 苔团/绿色/small | 2 | .8/.8/.9/1.1 | 直行 |
| enemy-ember | 焰灵/橙红/small | 3 | .75/1.2/1.2/.9 | 追角色 |
| enemy-frost-moth | 霜蛾/冰蓝/small | 4 | .65/.8/1.35/1.1 | 追角色 |
| enemy-shadow-bat | 影蝠/紫色/small | 6 | .7/1/1.4/.9 | 追角色 |
| enemy-sand-beetle | 砂甲虫/黄褐/large | 8 | 1.8/1.3/.7/1.2 | 直行 |
| enemy-crystal-crab | 晶蟹/蓝紫/normal | 10 | 1.4/1.15/.85/1 | 原规则 |

新增种类复用现有加速、体型碰撞、追角色后攻击领地及普通击杀掉落规则。首领节点、首领参数、每波最多60实体与每次出生原有单次随机抽样保持，旧存档中已出生怪物不重新套参数，后续出生自然使用新目录。没有加入远程攻击、分裂、免疫或其他尚未实现能力；多色轮廓图稿由UI域消费同一ID映射。

## 命中状态与奖励新规则（2026-11-04）

用户新增真实命中机制后，以下配置替代此前对应法术“未加入迟缓/持续伤害”的旧阶段说明。未配置onHit的技能仍保持原行为，穿透继续由原impact.pierce目标上限和hitIds控制。

| 法术 | 命中效果 |
|---|---|
| 风刃 | 沿真实攻击方向击退2世界单位，边界处以实际位移为准 |
| 水弹 | 移动速度变为75%，持续1200ms |
| 冰环 | 移动速度变为50%，持续1800ms |
| 火球 | 2400ms灼烧，每600ms造成施法伤害快照20%的周期伤害；仍无溅射 |
| 炎流 | 1800ms灼烧，每600ms造成施法伤害快照15%的周期伤害 |

这些效果仅在真实伤害命中且敌人仍活时施加，miss不触发。slow取最强而不相乘，同强刷新剩余时长，弱者不延长强者；burn同一施法角色/物品/定义只刷新，不新增层，最多4来源。burn tick不重新判命中/暴击、不递归触发onHit，保留原施法来源与幸运，经验和掉落走现有统一死亡结算。移动、周期和到期均使用模拟时间，暂停/背包冻结，状态可存档；不是浏览器计时器。

同轮奖励改为按实际语义不重复：同属性增益即使数值/品质不同也算同项，金币不同数量仍同项，不同法术/奥术定义可同时出现。仍可出现四个不同属性增益或四种不同魔法，不设类型位置配额。抽中后移除该语义候选，有限池不足则少发，不无限重试。旧已展示重复奖励只保留每种第一张原卡，替换重复槽且换新ID；已唯一的一组不重抽、不消耗随机序列。此条替代此前“独立有放回、允许重复”的旧阶段规则。

奖励增益新增幸运，按common至mythic六档为+1/+2/+3/+4/+6/+8，参与同轮语义去重。幸运提高实际击杀金币和装备掉落概率；奖励介绍不声称它影响奖励品质或稀有率。采集奖励六档为+5%/+8%/+10%/+15%/+20%/+25%，按同一采集属性去重，描述为全队金币收入增益，覆盖击杀、清波和金币奖励且同类相加；实际收入入口与装备采集属性由根及构筑域统一接线。

## 奖励刷新策略（2026-11-04）

每波免费次数为floor(wave/10)：第1–9波0次，第10–19波每波1次，第20–29波每波2次，依此增加。跨波只重置免费已用次数；同波存档恢复保留已用次数。免费优先消耗，付费刷新次数跨波在本局累积，新局从0开始，下一付费价为3^paidCount，即1、3、9、27……；免费刷新不提高下一付费价。

rewardRefresh.ts只做纯规范化与报价，不修改状态或随机序列。报价须奖励阶段、非空奖励组、足够金币才可执行；付费价格超过安全整数时不可付费，若仍有免费次数则仍可使用。刷新总计数到安全整数上限后禁用以避免新offer ID重复。根runtime负责原子扣费、推进对应计数、替换奖励、知识发现、请求幂等与checkpoint保存；界面读取同一报价，不复制计算规则。

## 幸运、采集奖励与采集符实际数据（2026-11-04）

以下是本次已接入试玩的数据，保持前文其他内容草案的状态。奖励的数值随卡片品级取档；同一轮按`buff:luck`或`buff:gatheringPercent`去重，数值和品级差异不使它们成为不同奖励。

| 条目 | 白板 common | 精良 uncommon | 稀有 rare | 史诗 epic | 传说 legendary | 神话 mythic |
|---|---|---|---|---|---|---|
| 幸运奖励 | +1 | +2 | +3 | +4 | +6 | +8 |
| 采集奖励 | +5% | +8% | +10% | +15% | +20% | +25% |
| 采集符装备加成 | +10% | +12.5% | +15% | +20% | +26% | +34% |

幸运奖励提高实际击杀金币和装备掉落概率，不提高奖励或装备的品级抽样概率。采集奖励增加本局全队金币收入，覆盖怪物金币、清波金币和金币奖励；同类相加，全队奖励只计一次。

采集符ID为`gatherer-charm`，饰品槽、1格（原点单格），1级白板定义提供`gatheringPercent: 10`。其他品级沿用装备统一缩放`目标品级gradePower / 定义品级gradePower`，对应上表10%／12.5%／15%／20%／26%／34%；不另套奖励卡的六档数值。只有角色实际装备的采集符参与全队采集，背包装备不生效。全队基础、装备和本局奖励的合计及正收入小数余量规则见机制文档本次最新确认节。

## 百项目录与构造物进入试玩（2026-11-04）

用户本次授权将召唤与建筑接入当前demo，替代此前只在独立feature开发的范围限制；其他历史草案状态保留。实际目录为48法术、18奥术、18装备、8道具、18怪物及2个法杖模板，共112项；法术由9基础与39条真实配方覆盖，不将不同品级当成新条目。

新增九个攻击组合为穿风刃、冰棱贯刺、烬星、日耀风暴、潮汐囚笼、余烬之环、震退波、棱光束、风暴之矛，分别实际组合已有穿透、溅射、逐跳雷链、光束、持续领域/扩散环、击退/迟缓/灼烧机制；不是仅换名换色。具体集中在expandedSpells.ts。

| ID | 名称/类型 | 模板HP | 寿命 | 攻击或恢复间隔 | 同源上限 | 额外金币费 |
|---|---|---|---|---|---|---|
| ember-familiar | 烬火灵/召唤远程灼烧 | 22 | 10秒 | 1000ms | 3 | 0 |
| frost-wisp | 霜缕灵/召唤远程迟缓 | 20 | 10秒 | 1100ms | 3 | 0 |
| thorn-guardian | 荆棘卫士/召唤近战 | 55 | 14秒 | 1200ms | 2 | 0 |
| ember-turret | 烬火炮台/远程灼烧建筑 | 65 | 16秒 | 1200ms | 3 | 6 |
| frost-pylon | 霜纹塔/远程迟缓建筑 | 75 | 18秒 | 1400ms | 3 | 8 |
| restorative-totem | 复苏图腾/治疗建筑 | 90 | 20秒 | 1600ms | 2 | 10 |

构造物有真实HP、目标、攻击/恢复及寿命。表中为白板模板值，HP与攻击参数读取实际编译结果，不在生成时重复乘品质/元素；延时与扩容奥术可分别提升存续时间和同源容量，执行上限30秒、同源8、全场32、每次最多8。建筑可在合法场内坐标任意预放，不以攻击射程限制部署点；生命、费用、暂停、跨波与失败规则见机制文档本批确认节。

怪物新增铸铁卫、沼泽再生体、熔火蛮兽、机巧斥候、冰川重甲、虚空游魂、古树巨像、雷螳，依次在12/14/16/18/20/22/24/26波解锁。铸铁卫/熔火蛮兽/冰川重甲分别有3/1/6护甲；沼泽再生体/古树巨像每秒恢复5/12生命，仍活时才恢复且不超上限。其余速度、生命、攻频、直行/追角色与体型颜色亦有实际差异，均沿monsters.ts单一定义；不声称额外免疫、远程或分裂能力。
