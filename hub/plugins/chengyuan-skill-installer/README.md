# 城院 Skill 安装器

从校内目录站安装已审 `SKILL.md` 包到 `~/.dsh/skills/`，避免学生手解压 zip。

默认目录：`http://127.0.0.1:8080`
只装 `chengyuan-*` 且 `status=published` 的条目。

每位师生在本机运行 DSH Web（`http://127.0.0.1:3080`），仅共用 `192.168.1.0/24` 局域网目录站下载安装器和技能，无需展机 LAN 放宽补丁。

## 推荐：从目录站装插件（师生）

```bash
curl -fsSL -o /tmp/chengyuan-skill-installer-0.1.0.tgz \
  http://127.0.0.1:8080/plugins/chengyuan-skill-installer-0.1.0.tgz
npx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add /tmp/chengyuan-skill-installer-0.1.0.tgz
```

重启 `dsh web` 后，对话里可让模型调用：

- `chengyuan_skill_list`
- `chengyuan_skill_install`（参数 `id` / `category` / `all`）

Windows（PowerShell，先浏览器下载 tgz 到当前目录）：

```powershell
npx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add .\chengyuan-skill-installer-0.1.0.tgz
```

## 开发机：link 调试（可选）

```bash
npx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add link:/绝对路径/…/plugins/chengyuan-skill-installer
```

## CLI（不装插件也能用）

若本机已有源码或解压了 tgz：

```bash
node bin/chengyuan-skill.js list
node bin/chengyuan-skill.js install chengyuan-study-coach
node bin/chengyuan-skill.js install --category 通用
node bin/chengyuan-skill.js install --all
```

装完后 **新开 DSH 会话**。

环境变量：`CHENGYUAN_CATALOG_URL`、`CHENGYUAN_SKILLS_DIR`、`DSH_HOME`。

目录站优先级：插件显式 `catalogBaseUrl` > `CHENGYUAN_CATALOG_URL` > `lib/config.js` 中的默认地址。随包 `cordis.patch.yml` 不固定目录站，CLI 帮助复用同一个默认常量。

覆盖地址时，在运行安装脚本、CLI 和启动 DSH 的终端中设置 `CHENGYUAN_CATALOG_URL`（macOS 用 `export`，PowerShell 用 `$env:CHENGYUAN_CATALOG_URL`）；修改后重启 DSH。旧安装若在 web profile 中保存了旧 `catalogBaseUrl`，请移除或更新该字段。网络接入见 [局域网访问城院目录站](../../docs/局域网访问城院目录站.md)。

## 研发发布插件新版本

```bash
cd infra/skill-catalog-mvp
bash scripts/publish-plugin.sh plugins/chengyuan-skill-installer
# 更新 data/catalog.json 的 file / install / version 后：
# rsync 到 Mini 并 bash scripts/deploy-catalog.sh
```

## 安全

- 不跟随跨站跳转下载
- zip 文件名只允许简单 basename
- 校验 `SKILL.md` 的 `name:` 与 id 一致
- 不安装非 `chengyuan-`、未 published 的条目
