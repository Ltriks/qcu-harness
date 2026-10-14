# QCU 提交模板

`submission.template.json` 保留 devkit1 原字段，增加 schema 和本地材料引用。它刻意不能通过完成态检查。填完后设 `templateOnly:false`，保持 `published:false`。原 devkit1 文件无需修改。

`generate-example.py` 是本仓库可信的 Python 3.9+ stdlib 夹具生成器；生成完整的 PLUGIN-SPEC、BUILD、SOURCE、许可、四阶段证据、成员 manifest、固定 TGZ 和 submission。产物只有合成文字，不是可上架产品，也不得安装。

在仓库根运行（输出父目录须已存在，`examples` 必须不存在）：

```sh
rtk proxy python3 -B templates/qcu-submission/generate-example.py --output "$HOME/Artifacts/qcu-harness/0.1.0-pilot.10.1/examples"
rtk proxy python3 -B scripts/qcu-check-submission.py --submission "$HOME/Artifacts/qcu-harness/0.1.0-pilot.10.1/examples/static-pass/submission.json"
rtk proxy python3 -B scripts/qcu-check-submission.py --submission "$HOME/Artifacts/qcu-harness/0.1.0-pilot.10.1/examples/reject/submission.json"
```

预期：第一份退出 0、静态通过、仍需人工/原生/教师复核；第二份退出 1，有 `archive.byte_mismatch` 和 `evidence.failed`。`passed` 的合成 source/preview 状态只用于检查状态解析，不声称真的执行过 UI 或业务测试。两份样例 TGZ 相同、字节可重复生成；拒绝样例只改元数据。

开发者应另写真正的接口契约：教师任务与输入输出、不包含范围、Host/Client/slot、Skill 名称/provider、RPC/工具参数及大小、错误/超时/幂等、副作用确认、授权入口与撤销、重启/断连、数据隔离、停用清理与成果保留、依赖/来源/许可、构建版本和成员白名单。检查器不能替代这些材料的人工阅读。

完整字段、限制和迁移见[检查器说明](../../docs/qcu-market-p10-submission-check.md)，上架前流程见[维护指南](../../docs/qcu-market-p10-maintainer-guide.md)。
