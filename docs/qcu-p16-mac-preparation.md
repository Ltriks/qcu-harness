# QCU-P16-MAC-PREP：rc4.3 源码交接

本轮只准备源码并验证打包、启动和输入契约，没有构建完整 App。最终 branding / market 归档必须由主线程完成审阅和冻结后提供。不能把测试目录里的合成清单或包当作发行输入。

## 合入范围

- builder、verifier、`start.cjs`、`integrated.cjs` 及相关契约测试。
- `scripts/generate-integrated-teacher-macos-config.py`：生成新的 rc43 配置及主题六文件 staging。
- 当前 rc4.3 教师指南；rc41、rc42 历史指南分别按 HEAD / `6776825` 的原始字节保存。rc3、rc4 原件和原 rc41 配置未改。
- `release/integrated-teacher-macos-rc42.json` 是公开提交 `67768251d96aa189a2819c0da18a63d0f0d9bdec` 的逐字节副本，用作原始十二项 pin 的入口。

没有合入该公开提交的 branding 业务代码、旧根指南或版本修改；没有修改任何插件或课程源码。任务稿原先已在 worktree 中未跟踪，非本轮创建。私有回执按任务约定由主线程处理；本轮工作状态和证据只放在本 worktree 的 `.work/mac-prep/`。

## 主线程提供最终输入

从主线程审阅后的 `.work/product-polish-review/RESULT.json` 取出 **最终** branding 和 market 的清单路径、清单 SHA256、归档路径。不要沿用早期 pilot.16.0 包，不要从工作源码重新打包冒充已冻结归档。

生成器要求：

- App 固定为 `0.1.0-rc.4.3`，market 固定为 `0.1.0-pilot.16.1`。
- branding 默认为 `0.2.6-pilot.2`；只有主线程批准静态 Help 调整并提供最终归档后，才显式传 `--branding-version 0.2.6-pilot.3`。不接受其他主题或套件版本。
- course 固定 `0.1.0-pilot.1.3.font.1`，归档 `d46ba9e2deb27f7cd6296a5bfd24b3e8db0f0d99bcc4cddc734f82b794197411` / 54521 bytes。
- expert 固定 `0.2.0-pilot.3.font.1`，归档 `4835ab751ccef3f11089a5b5ad198ea22d1ef7d34a334ac231ef83052cdbad93` / 59991 bytes。
- 默认使用任务指定的两份 font.1 清单。可显式提供其逐字节副本，清单自身和归档必须仍匹配脚本中的固定哈希。
- 原始十二项 pin 均检查；程序、参考解释器、SDK anchor、managed-updates 脚本和定制 ASAR pin 保持不变。旧 `courseSource` 仅保留为原始历史来源 pin，不代表重新构建或重新验收 font.1。
- market 按现有 packer 的原始格式读取：`package:"qcu-market"`、无顶层 `runtime`，清单和 TGZ 内 package.json 的九项精确 host peers 必须齐全且一致。不会给不可变清单补字段或归一化重写。branding / course / expert 保持其原始 `id` / `runtime` 格式。

以下命令中的尖括号是需要从主线程审阅结果填写的参数说明，未执行，也不是生成的配置：

```sh
rtk proxy python3 -B scripts/generate-integrated-teacher-macos-config.py \
  --base-config release/integrated-teacher-macos-rc42.json \
  --branding-version 0.2.6-pilot.2 \
  --branding-manifest '<reviewed-branding-MANIFEST.json>' \
  --branding-manifest-sha256 '<reviewed-branding-manifest-sha256>' \
  --branding-archive '<reviewed-branding.tgz>' \
  --market-manifest '<reviewed-market-MANIFEST.json>' \
  --market-manifest-sha256 '<reviewed-market-manifest-sha256>' \
  --market-archive '<reviewed-market.tgz>' \
  --output release/integrated-teacher-macos-rc43.json \
  --staging .work/mac-rc43-candidate/final-theme
```

输出和 staging 必须全新。生成器先完成所有输入校验，再从 TGZ 的普通 USTAR 成员写主题六文件与去除 `package/` 前缀的 inventory；重建 TGZ 必须与最终归档逐字节一致。构建仍使用最终 TGZ 的原始文件名和字节。验证拒绝路径穿越、链接、目录、重复/额外/缺失成员、PAX/GNU 扩展、特殊模式、脚本/运行依赖和不兼容 peers。生成器不执行包内代码。

## 合入并批准后的完整构建与验证命令

这些是主线程后续操作，本轮未执行。使用新目录，不覆盖 rc41/rc42、已安装 App 或任何已有 Home。

```sh
rtk proxy python3 -B scripts/build-integrated-teacher-macos.py \
  --config release/integrated-teacher-macos-rc43.json \
  --out .work/mac-rc43-candidate/build

rtk proxy python3 -B scripts/verify-integrated-teacher-macos.py \
  --archive .work/mac-rc43-candidate/build/QCU-Teacher-0.1.0-rc.4.3-mac-arm64.zip \
  --proofs .work/mac-rc43-candidate/build \
  --out .work/mac-rc43-candidate/verify \
  --native-prepare
```

verifier 默认使用配置里固定的参考解释器，读取新 App 的实际 ASAR / 客户端模块。若要单列参考 SDK 的冷加载证据，另用新验证目录并显式传配置中 `trustedRuntime.path` 给 `--validation-runtime`；该模式会在结果中保留 SDK 与原生解析的区别。`--native-prepare` 是一次有界的 `--prepare-only` 检查；首次失败就不继续重复原生探测，分别保存原始 stdout / stderr、退出码与超时状态后继续其他检查。它不打开 GUI，不修改 OS 安全策略；历史 rc4.2 的非零空日志结果仍然有效，不能被新结果覆盖。

App Info / manifest 是套件版本依据。客户端契约读取实际 seed 中的 `qcu-branding/package.json` 并核对 About 的组件版本；rc4.3 About 不应写死 App 版本。当前指南会根据明确固定的主题版本替换其主题标签。课程和专家团仅做包完整性与模块注册检查，不做新业务或模型验收。

## 用户包与操作证据

ZIP 只含 `QCU助手.app`、README、先读我、开始使用页、教师指南、guide-package 和 composition。不会把 build-test-home、输入清单的本机路径、合成账号、日志、旧手工导入目录或操作证明装入用户包。

`composition.json` 一次性记录 App / 内置客户端 / 十二组件的版本、归档字节和哈希，以及 `candidate-not-published` 状态。候选、已安装与 Hub 的状态分别判断。原生 launcher 比较、签名日志、input-pins、app-files、payload-files、vendor-proof、BUILD 和 SHA256SUMS 留在 build 输出目录，verifier 通过 `--proofs` 读取。ZIP 在解压前先核对整包 pin 及每个成员的名称、字节、模式、链接；解压后再次核对。

新电脑使用完整候选；已有电脑保留原 App、Home 和 Key，使用主线程审阅的组件更新。无自动迁移、配置修复或回执删除。只在新输出副本上做 ad-hoc 签名，不涉及 Developer ID、公证、安装、发布或 Hub 部署。

## 本轮验证与待验收

源码契约可重跑：

```sh
rtk proxy python3 -B -m unittest discover -s tests -p test_integrated_macos_prep.py -v
rtk proxy node --test tests/teacher-final-contract.test.cjs
```

启动契约通过 `tests/support/make-integrated-prep-fixture.py` 为 rc41、rc42、rc43/pilot.2、rc43/pilot.3 建立独立、带标记的合成种子，再将其路径传给 `QCU_INTEGRATED_TEST_KIT` 运行 `tests/teacher-integrated.test.cjs`。该 fixture 中的 JSON 解析器只是源代码诊断测试替身，不是实际 ASAR，不能据此声明新 App 客户端验收。

真实 market16.1（86354 bytes、24 成员、SHA256 `fc25da801af9da4c583225c95352547791c5eb59feb4bc2febdfd2f8df0d6f8f`）已按主线程审查单提供的路径只读验证，并经过 inspect_package → 生成器 → prepare_inputs 回归；该测试的 branding 仍是合成输入，未生成真实 rc43 配置。

精确已通过项、早期测试夹具错误、命令、日志和受保护目录前后哈希见 `.work/mac-prep/RESULT.json`。最终 branding 和完整组合、完整构建、新 App 签名/实际模块/原生准备、GUI 首次打开、新电脑、真实模型与教师试用均需主线程后续执行和分别记录。
