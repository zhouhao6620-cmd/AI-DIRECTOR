# AI DIRECTOR

AI 视频导演剪辑工作台 R3：独立研发项目，Legacy 仅作为迁移与复用证据，不作为运行时依赖。

## 在线预览

- [素材准备工作台](https://zhouhao6620-cmd.github.io/AI-DIRECTOR/)
- [完整设计规范](https://zhouhao6620-cmd.github.io/AI-DIRECTOR/design-spec.html)
- [HyperFrames 组件资产库](https://zhouhao6620-cmd.github.io/AI-DIRECTOR/library/)
- [研发控制中心](https://zhouhao6620-cmd.github.io/AI-DIRECTOR/development-control-center.html)

## 本地开发

需要 Node.js 22+ 与 pnpm：

```sh
pnpm install
pnpm run dev
```

GitHub Pages 预览构建由 `pnpm run build:pages` 生成，源码推送到 `main` 后自动部署。

## 部署边界

在线页面是公开静态预览。需要本地服务的内容理解、组件渲染等 `/api` 能力不会由 GitHub Pages 提供；这些能力仍需后续单独部署后端。不要把真实视频素材、客户项目或密钥提交到公开仓库。

第三方组件与资产许可见 [`resources/licenses/THIRD_PARTY_NOTICES.md`](resources/licenses/THIRD_PARTY_NOTICES.md)。
