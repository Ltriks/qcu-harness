// Generated display metadata from reviewed package skill-bundle.json; no instruction bodies.
export const departmentSuites=Object.freeze({
  "qcu-accounting-suite": {
    "schemaVersion": 1,
    "id": "qcu-accounting-suite",
    "version": "0.1.0-pilot.1",
    "title": "会计系教学技能包（示例）",
    "description": "基础会计教学：分录实训、凭证审核、报表勾稽和课堂案例；统一安装，成员独立使用。",
    "skills": [
      {
        "title": "会计系技能选用入口",
        "description": "会计系基础教学技能包的选用入口，按分录实训、凭证审核、报表勾稽或课堂案例需求选择对应方法。",
        "file": "SKILL.md",
        "sha256": "a0ff4f834df6976441fd717cc04d62e62fd9d5fb4d6a4425b033bd197d2a6e04",
        "id": "qcu-accounting-suite",
        "entrypoint": true
      },
      {
        "title": "会计分录实训",
        "description": "为基础会计教学设计借贷记账与分录练习，分开学生题目和教师参考，并核对借贷及账户余额。",
        "file": "skills/qcu-accounting-journals/SKILL.md",
        "sha256": "d3f1b06ee44790fb4719dff308e19ea98da1dac1285c947a39754137da7da054",
        "id": "qcu-accounting-journals",
        "entrypoint": false
      },
      {
        "title": "凭证审核模拟",
        "description": "对虚构或已脱敏的教学记账凭证做模拟审核，区分金额错误、科目疑点、证据不足和需教师判断的问题。",
        "file": "skills/qcu-accounting-vouchers/SKILL.md",
        "sha256": "40caaf5c3db39793ff5fd97a425327fb7cb2fe7668d6280ca104ca6671f7dc24",
        "id": "qcu-accounting-vouchers",
        "entrypoint": false
      },
      {
        "title": "报表勾稽练习",
        "description": "用基础会计教学数据生成试算与报表勾稽练习，核对账户余额、利润和资产负债关系，不代做正式报表。",
        "file": "skills/qcu-accounting-statements/SKILL.md",
        "sha256": "a822d5fceb1ecb9796c2c45c9d4de262c4e898c3dc9eabe417fdd00047393206",
        "id": "qcu-accounting-statements",
        "entrypoint": false
      },
      {
        "title": "课堂案例设计",
        "description": "将会计教学主题或虚构业务组织成课堂案例、分层任务与评价要点，供教师修改和试讲。",
        "file": "skills/qcu-accounting-lessons/SKILL.md",
        "sha256": "0c6f3627515849188d2c43b351453642d3469a162e21e15c5d414a56bc4aac66",
        "id": "qcu-accounting-lessons",
        "entrypoint": false
      }
    ]
  }
})
