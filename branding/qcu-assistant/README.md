# QCU助手标识

用户最终指定：原创图标，名称使用 **QCU助手**。不使用学校校徽。

图形以白色校门和打开的书为主体，蓝色方形底保留小尺寸辨识度；不在图标中塞文字。主蓝 `#174F91`，书页线 `#9AD5F1`，白色 `#FFFFFF`；文字沿用系统中文字体，深色文字参考 `#17324F`，浅色背景参考 `#F0F5FB`。只改变品牌位置，不重做工作台或设置页面。

矢量源为 `icon.svg`。`scripts/render-qcu-icon.swift` 使用同一几何图形生成多尺寸PNG；`scripts/build-brand-assets.py` 生成Mac ICNS、Windows多尺寸ICO及品牌组件。生成物在 `.work/qcu-brand-assets/`，可按构建命令重建。

界面品牌组件通过官方 `sidebar.brand.mark`、`sidebar.brand.name` 和 `conversation.hero.brand.mark` 插槽注册，替代 `ui-brand-official`。品牌组件不是新增教学能力；原九项功能包保持原版本。图标、名称与组件不依赖Hub或联网。

原生Mac图标涉及APP资源和Info.plist，定制后的应用重新使用ad-hoc本地签名，不再声称保留原厂APP签名；嵌套框架不改，ASAR代码摘要保持与rc.2一致。Windows只替换外部窗口/托盘图片并编译自有启动器图标，官方EXE和ASAR保持不变。

RC.3使用新的个人目录。首次准备只识别该平台rc.2固定seed回执，将其数据复制到新目录，保留旧目录；保留模型设置、工作文件及其他个人配置，并加入品牌组件。非匹配回执或含符号链接的源目录拒绝自动复制，交维护人员处理；不扫描或导入原始 `~/.dsh`。旧包继续可用。
