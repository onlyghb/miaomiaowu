# 推送自己的定制版本，并持续同步作者更新

推荐在 GitHub **Fork `iluobei/miaomiaowu`**，然后继续使用现有的本地 clone，不需要重新下载。Fork 让 GitHub 识别上游关系，方便比较和同步；普通独立仓库也能用 Git 的 `upstream` 合并，但本项目提供的同步 PR Action 依赖 Fork 关系。

建议让你自己的 `main` 保存定制版本；平时开发可从 `main` 新建功能分支，通过 PR 合并回来。上游更新通过 merge 引入，保留双方历史。[GitHub 官方 Fork 同步说明](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/syncing-a-fork)

## 1. 首次推送

先在 GitHub 打开作者仓库，点击 **Fork**，创建 `你的用户名/miaomiaowu`。下方命令假定你仍在现有 clone 中，当前 `origin` 指向作者，分支为 `main`。

```bash
# 原作者仓库改叫 upstream，自己的仓库叫 origin
git remote rename origin upstream
git remote add origin https://github.com/YOUR_GITHUB_NAME/miaomiaowu.git
git remote -v

# 提交本次定制；环境文件和运行数据无需加入 Git
git add .gitignore .dockerignore README.md \
  .env.cloudflare.example docker-compose.cloudflare.yml \
  .github/workflows/sync-upstream.yml docs/cloudflare-tunnel.md docs/fork-and-sync.md \
  miaomiaowu/src/routes/nodes.index.tsx \
  miaomiaowu/src/components/node-qr-code-dialog.tsx
git commit -m "Add node QR codes and Cloudflare Tunnel deployment"

# Fork 创建时可能比本地 clone 更新，先合并它的 main
git fetch origin
git merge origin/main
git push -u origin main
```

将 `YOUR_GITHUB_NAME` 替换成你的 GitHub 用户名。HTTPS 推送使用 GitHub 的令牌或凭据管理器认证，不是账户密码；若你已配置 SSH，也可以使用 `git@github.com:YOUR_GITHUB_NAME/miaomiaowu.git`。

如果 origin/main 的合并产生冲突，按下一节解决后再推送。以上设置只做一次：已有 `upstream` 时不要再次 rename；可以用 `git remote set-url origin ...` 修改自己的目标地址。

## 2. 后续手动同步（无需 GitHub Actions）

先提交当前工作，保持工作目录干净：

```bash
git switch main
git pull --ff-only origin main
git fetch upstream
git merge upstream/main
```

没有冲突时，两边提交都会保留。如果有冲突：

```bash
git status
# 编辑冲突文件，删除冲突标记，保留需要的上游和定制代码
git add <已解决的冲突文件>
git merge --continue
```

想取消本次未完成的合并，可以执行 `git merge --abort`。

合并完成后验证、推送：

```bash
cd miaomiaowu
npm ci
npm run build
cd ..
git push origin main
```

后端也有改动时，在具备项目要求的 Go 环境中运行相应 Go 测试或 Docker 构建。推送后按 [Tunnel 部署说明](cloudflare-tunnel.md) 更新 VPS。

不要用 `reset --hard upstream/main` 或强制覆盖同步来更新定制分支，它们可能丢弃自己的提交。GitHub 的 **Sync fork → Update branch** 也可以同步；发生冲突时仍需手工处理。[GitHub 同步说明](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/syncing-a-fork)

## 3. 可选 Action：发现更新时创建同步 PR

已提供 `.github/workflows/sync-upstream.yml`：

- 手动触发，比较作者 `main` 与你自己的 `main`；作者有新提交时，在你的 Fork 创建一个以作者 `main` 为来源的 PR。
- 如果已有开放的同步 PR，就复用它；作者后续推送会自动反映在该 PR 中。
- 不直接改写你的分支，也不自动合并。你检查改动并验证后合并；代码冲突需要手工解决。
- 仅在 Fork 中运行，使用仓库自带的 `GITHUB_TOKEN`，权限为读取代码和创建 PR；无需额外 PAT，也无需 Cloudflare token。

使用步骤：

1. 在自己的 Fork 的 **Actions** 页面启用工作流。
2. 在 **Settings → Actions → General → Workflow permissions** 中允许 **Allow GitHub Actions to create and approve pull requests**；组织仓库还可能受组织策略限制。[GitHub 权限说明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)
3. 在 **Actions → Sync upstream → Run workflow** 运行，并查看运行摘要中的 PR 链接。
4. 检查 PR，构建验证后使用 **Create a merge commit** 合并，以保留上游提交历史。用 Squash/Rebase 合并同步 PR 可能让已同步的上游提交在下一次比较时再次出现。

若 PR 有冲突，直接按“后续手动同步”在本地 merge 上游、解决冲突并推送，再检查该 PR 是否已关闭。该 PR 的来源分支属于作者，你不能指望 Action 自动修改作者的分支。

想自动定期检查，取消工作流开头 `schedule` 两行的注释，默认示例为每周一 UTC 00:00（新加坡/北京时间 08:00）。定时工作流在默认分支上运行，Fork 的定时工作流及长期无活动仓库可能需要重新启用。[GitHub 工作流启用说明](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)

当前仓库没有为同步 PR 单独提供自动构建检查；合并前请自行验证。若以后添加 `pull_request` CI，由 `GITHUB_TOKEN` 创建的 PR 所触发的工作流可能需要在 PR 中点击 **Approve workflows to run**。[GitHub 触发规则](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)

## 4. 镜像构建与上游同步是两件事

已有的 **Docker GHCR** Action 在推送 `main` 后构建并发布你自己的镜像，镜像名由 `${{ github.repository }}` 自动决定，无需修改作者用户名。

新加的 **Sync upstream** Action 只负责提出同步 PR。你合并 PR 后，对 `main` 的推送才触发自己的镜像发布；随后 VPS 拉取该镜像，或从自己的最新源码重新构建。

**Git 同步代码 → 验证合并 → 构建自己的镜像 → 更新 VPS**，这四步可以分开完成。不要通过应用内“系统更新”更新定制版本，原因见 [部署说明](cloudflare-tunnel.md)。
