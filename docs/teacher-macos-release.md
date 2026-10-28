# Mac教师预装版交付记录（2026-10-22）

用户要求Mac也改成预装版，老师无需学习安装脚本。当前生成0.1.0-rc.2 Apple Silicon候选，macOS13+。固定取包与使用说明见主仓库[releases/README.md](../../../releases/README.md)。

## 用户操作

解压后双击“城院助手.app”，也可把整个APP移到“应用程序”。无需另装官方客户端或运行终端，九项能力已预装启用，无QCU市场。首次由维护人员配置模型，飞书由本人授权。不卸载旧DSH，不复制其账号/配置/会话。

个人目录为 `~/Library/Application Support/QCU-DSH/teacher/0.1.0-rc.2/`，与旧DSH及rc.1安装版分开。移动APP不移动个人数据，重复准备保留配置；不要重新分发用过的个人目录。

## 实现与来源

- `scripts/build-teacher-macos.py` 从SHA256固定的官方DMG只读挂载复制完整客户端，逐文件、权限和符号链接验证一致。原厂APP签名保持有效，不重新签名原厂代码。
- `tools/teacher-suite/Launcher.m` 编译为arm64 Cocoa原生入口；不启动终端。调用官方Electron内置Node准备环境，再设置独立DSH_HOME、agents、Electron user-data和工作目录启动GUI。出现错误使用原生提示框，诊断模式 `--prepare-only` 不启动GUI。
- 复用 `tools/teacher-suite/start.cjs` 的库存校验、原子准备及已有数据保护；补充Mac数据路径和CLI权限检查。Windows既有五项测试仍通过；另加两项Mac保护测试，共七项通过。Windows已发行ZIP不修改。
- 干净模板仅含冻结发布的九包及原生LarkCLI1.0.84，不复制开发者数据、凭据、聊天、模型配置和缓存；包版本与Windows教师版产品基线一致。
- `scripts/verify-teacher-macos.py` 验证实际ZIP，在中文空格目录解压，核对APP及原厂字节/权限/链接和签名，执行原生首次准备、移动后重复准备、数据保留、受网络/子进程阻断的JS准备及真实技能注册表读取。

构建：

```sh
python3 scripts/build-teacher-macos.py --inputs .work/inputs --out <全新输出目录> --zip
python3 scripts/verify-teacher-macos.py --archive <输出ZIP> --out <全新验收目录>
node --test tests/teacher-suite.test.cjs
```

挂载和系统证书校验可能需要在沙箱外正常运行；不得把沙箱内的系统证书校验失败直接认定为原厂代码已改。最终验证使用了正常系统环境。

## 实际验收

- 最终归档 `.work/mac-teacher-final/QCU-Teacher-0.1.0-rc.2-mac-arm64.zip`，397317789字节，SHA256 `24870f0a1a8379fa47d9f838447ee0761be88cabd1db086277b34686c3a3bf14`。
- 最终ZIP验收 `.work/mac-teacher-final-verification-native/result.json`及同目录日志；九模块导入、七技能正文、九能力启用，无市场、无包管理缓存，受保护流程无联网或子进程尝试；原生LarkCLI版本1.0.84。
- 最终ZIP复制至主仓库固定releases目录并再次核对摘要；额外解压一份供本机手动打开。早期 `.work/teacher-release/0.1.0-rc.2/` 下同名Mac包是构建试样，不是最终交付，以固定releases目录及上述摘要为准。
- 桌面工具两次返回 `Sky Computer Use native pipe startup failed`，未观察GUI；已请求用户手动双击固定目录APP。不能将原生准备模式、导入测试或WindowsGUI验收写成MacGUI成功。

## 待验收与分发边界

MacGUI、工作台和技能可见、正常退出重开、模型实际回答、飞书授权、第二台Mac及跨电脑下载首次打开待验收。系统签名身份查询返回0个有效身份；自有启动器仅ad-hoc本地签名，没有Developer ID和Apple公证。当前交付为本机内测候选，正式面向教师分发仍需签名/公证或学校维护人员的一次部署验收，不能承诺无安全确认，也不要求教师关闭防护。依据[Apple Gatekeeper说明](https://support.apple.com/guide/security/gatekeeper-and-runtime-protection-sec5599b66df/web)。

代码和交接资料未提交/推送Git；保留原有README修改及历史包，不自动部署或发布Hub。
