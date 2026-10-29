# 参与开发

Cupnote 是一个小规模的原生 JavaScript 项目。优先保持记录流程简单、旧数据兼容、运行依赖少。

## 开始

```sh
git clone https://github.com/Habby-me/cupnote.git
cd cupnote
npm ci
npm start
```

界面由 `dist/` 直接提供，没有构建步骤。修改后刷新页面即可。

## 提交改动

1. 从 `main` 创建功能分支，例如 `codex/receipt-search`。
2. 聚焦一个实际问题。品牌配置放在 `dist/lib/brands.js`，数据规则放在 `dist/lib/journal.js`。
3. 为数据规则、日历边界或持久化行为提供有意义的回归测试。
4. 运行 `npm run verify`。界面变化另外运行 `npx playwright install chromium` 和 `npm run test:e2e`。
5. 在 PR 中说明触发条件、前后行为、验证结果及已知限制。

推荐使用 `feat:`、`fix:`、`test:`、`docs:` 等说明实际变化的提交信息。不要为了贡献图拆出无意义的提交。

## 数据与隐私

- 请使用示例或合成记录，不要提交自己的真实备份。
- 不要将密钥、Cookie、部署凭据或浏览器数据写入仓库。
- 修改存储结构前需提供迁移方案，并验证已有 v1 JSON 备份。
- 所有用户输入进入 HTML 前必须转义；CSV 需防止公式注入。
- 品牌名称用于识别个人饮品记录，不能把主题小票描述成官方订单凭证。

## 问题反馈

使用仓库 Issue 模板提供浏览器、设备、复现步骤及预期结果。新增功能请说明使用场景，未实现的计划见 [路线图](docs/ROADMAP.md)。
