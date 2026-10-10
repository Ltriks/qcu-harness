# QCU市场p2源码改进

用户报告 `Sentinel_0d4869535fd88191a0f8e8db470a2d71`：在Mini完成p1真实UI安装启用，看到QCU市场，但按钮灰、没有图标、样式简陋。本条是**用户报告的p1入口可见PASS**；当时没有截图或代理视觉证据，不据此宣布返回、重复点击、复制、主题或回滚通过。

固定p1仍是 `qcu-market@0.1.0-pilot.1`，TGZ 8239字节，SHA256 `04f6e3609d841ecff25e59c8452d7c5eeae2cea8837118af88ca5fff914cf01b`。没有覆盖原包、访问Mini或修改已装实例。

p2源码版本为 `0.1.0-pilot.2`；本轮未生成p2 TGZ，已按随后提供截图调整源码，待真实升级授权后再固定包。

## 变化

- 官方Office卡片显示“官方内置能力 · 本实例未验证”，可展开“查看用法”。不会直接调用能力或发送对话。
- 五项QCU草案显示“开发中 · 纯Skill草案”，可展开“了解草案”。去掉所有未接通的灰色安装主按钮，页面明确暂不提供安装。
- 卡片优先显示图标、来源、标题、状态、用途；示例和版本/前提/测试/风险/来源/许可分层展开。完整信息仍来自唯一 `hub/market/catalog.json`。
- 为Plugin Manager补上官方支持的manifest `icon` 和中英 `locale/*` meta说明。新增原创MIT通用书本图标和六场景SVG，不使用校徽、外部图标/字体/CDN。p1已有侧栏线条图形，因此未凭“没图标”反馈推断具体缺失位置；p2覆盖manifest图标和卡片图标两处。
- 所有UI颜色引用固定rc.2 `--dsw-alias-*`语义token，CSS限定在自有 `.qcu-market` 内，不触碰官方root、审批DOM或其他插件选择器。独立manifest图标是静态原创双色素材。
- 场景筛选用原生button和aria-pressed；说明用原生details/summary；增加focus-visible、每卡标题关联、SVG装饰语义和结果播报。复制等待保留按钮焦点，真实完成反馈与卸载保护延续p1。

## 采用的官方规范

只读核对固定源码的 `cordis-plugin-development/SKILL.md` 及其 UI/practices/host-plugin/verification/user-actions 参考、官方Button样式和Plugin Manager卡片样式、ui-theme design-platform.css。官方实践明确纯JS Client不要直接require不稳定的Harness组件包，因此沿用原生控件并匹配宿主token；仅require官方React。当前没有实时cordis_inspect工具，不冒充实时检查。界面内容以中文为主，manifest有中英meta，完整ctx.locale多语言仍未做。

## 验证与边界

14项本地测试通过：新增检查3个“查看用法”、5个“了解草案”、没有永久disabled安装控件、8卡标题关联、装饰SVG、场景筛选及选中语义、局部CSS/语义token/焦点、manifest图标与locale资源闭包。原有目录schema、来源许可、复制失败、重复复制与卸载保护继续通过。

真实rc.2 Cordis/SlotRegistry/LayoutController集成测试通过，覆盖注册、8卡React静态渲染、导航重复点击、返回与卸载；这不是像素验收。预构建Client语法与模块工厂检查通过。语义token在固定官方明暗定义中存在，实际明暗对比、窗口大小、键盘视觉焦点与图标显示仍未实测。

没有绕过此前Chrome file策略，不启动浏览器替代通道、栅格化器或新模拟页面。没有p2安装、升级、自动Skill注册、模型调用、线上改动或新网络行为。

下一步：取得用户截图后针对真实布局修正；获明确p2升级授权后，另产不可变TGZ/hash及清单，并按官方替换流程与正常重启加载新JS代际。旧p1归档与限定回滚材料保留，不把同一slot ID当升级已生效证据。

## 两张截图核对与p1根因（后续证据）

已通过Library读取并实际查看 `libfile_ee6509c2f5308191baac31793b948364`（参考）和 `libfile_6ed7fc972a588191ab886b9597b03973`（当前QCU）像素。参考图为搜索/分类加紧凑多列卡片，彩色图标、名称、短描述和明确动作；使用量与品牌属于参考产品，未复制。QCU截图显示默认按钮/大标题、两列长卡片、黑色圆角边框和技术字段全部展开。截图未展示完整DSH侧栏，不能定位用户“无图标”究竟指哪个入口。

直接审计固定p1 TGZ：无CSS文件、无style元素、无主题token；Client确实只有少量inline布局（grid、padding、圆角、`1px solid currentColor`）和浏览器默认按钮/标题；manifest没有icon，卡片没有图标调用。截图中的grid与圆角边框符合已写代码正在生效。因此确认主因为**p1未实现完整样式及卡片层级**，不是发现某个已存在CSS文件漏打包。未读实时DOM、computed style或控制台，不能据截图排除额外环境问题。

p2将CSS文本直接编入Client并随Market组件渲染style元素；不依赖独立CSS加载或相对资源路径。新增测试确认生成Client包含与源码完全相同的CSS和全部SVG路径。卸载随组件移除style，不向全局document.body追加元素。

按参考图进一步压缩：图标与名称并排，简短用途、真实状态和动作留首页，全部技术信息在details内；自适应最小260px卡片与1280px内容宽度，窄屏单列。新增有标签的本地搜索（名称/用途/分类/标识）、清除搜索和无结果反馈，与六场景筛选叠加。使用官方语义颜色做装饰图标分组，不虚构数量/排名或校徽。实际p2明暗像素、窄屏与键盘操作仍未运行验证。
