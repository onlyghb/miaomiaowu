# Docker Compose + Cloudflare Tunnel 部署定制版本

此配置从当前仓库源码构建妙妙屋，包含节点二维码功能。访问路径为：

```text
浏览器 / 订阅客户端 → https://mmw.example.com → Cloudflare Tunnel
                   → cloudflared → http://miaomiaowu:8080
```

`docker-compose.cloudflare.yml` 没有 `ports` 映射，也不使用宿主机网络。`expose: 8080` 只标记容器服务端口，不发布到 VPS。这里转发的是面板及 HTTP 订阅链接；代理节点的流量仍按节点本身的配置连接。

## 1. 准备 Cloudflare Tunnel

需要 Docker Engine、Docker Compose 插件、Cloudflare 账户和已接入 Cloudflare 的域名。

1. 在 Cloudflare 控制台进入 **Networking → Tunnels**，创建一个使用 `cloudflared` 的 Tunnel。旧版 Zero Trust 界面入口可能显示为 **Networks → Tunnels**。
2. 在安装连接器的说明中选择 Docker，取出命令里 `--token` 后面的值。Compose 会启动连接器，不需要额外运行控制台提供的 `docker run` 命令。
3. 为该 Tunnel 添加 **Published application** 路由（旧界面称 Public Hostname）。例如域名 `mmw.example.com`，**Service URL 填 `http://miaomiaowu:8080`**；如果界面拆分类型和地址，选择 HTTP，地址填 `miaomiaowu:8080`。

`miaomiaowu` 是 Compose 的服务名。这里的 `localhost` 会指向 cloudflared 容器，不能用 `http://localhost:8080`。

服务器需要允许 Tunnel 访问 Cloudflare 的出站 `7844` 端口（QUIC 使用 UDP，HTTP/2 使用 TCP），以及正常的 DNS、镜像拉取和构建依赖下载。面板不需要开放 VPS 的入站 `8080`、`80` 或 `443` 端口。[Cloudflare 官方部署说明](https://developers.cloudflare.com/tunnel/get-started/)

## 2. 填写环境文件并启动

在 VPS 上克隆你自己的 Fork，进入仓库根目录：

```bash
cp .env.cloudflare.example .env.cloudflare
chmod 600 .env.cloudflare
```

编辑 `.env.cloudflare`，填写真实 Tunnel token：

```dotenv
CLOUDFLARE_TUNNEL_TOKEN=这里替换为你的TunnelToken
```

此文件已加入 `.gitignore`，并从 Docker 构建上下文排除。Token 通过官方支持的 `TUNNEL_TOKEN` 环境变量传给 cloudflared。[Cloudflare 参数说明](https://developers.cloudflare.com/tunnel/reference/run-parameters/)

```bash
docker compose --env-file .env.cloudflare -f docker-compose.cloudflare.yml config --quiet
docker compose --env-file .env.cloudflare -f docker-compose.cloudflare.yml up -d --build
docker compose --env-file .env.cloudflare -f docker-compose.cloudflare.yml ps
docker compose --env-file .env.cloudflare -f docker-compose.cloudflare.yml logs --tail=100 cloudflared
```

启动后访问 `https://mmw.example.com`，按页面完成初次初始化。cloudflared 会在应用健康检查通过后启动。

**每次都显式指定 `-f docker-compose.cloudflare.yml`。** 默认的 `docker-compose.yml` 会映射宿主机端口；不要将它作为基础文件与此配置叠加。

二维码入口位于“节点管理 → 节点列表”的“复制 URI”旁边，仅对已保存、有 Clash 配置的节点显示。点击后用代理客户端扫码即可导入，二维码与复制 URI 使用同一转换函数。

## 3. 数据与更新

运行数据集中存放在仓库根目录的 `data/` 下：

| 宿主机路径 | 容器路径 | 内容 |
| --- | --- | --- |
| `./data` | `/app/data` | SQLite 数据库、日志及应用数据 |
| `./data/subscribes` | `/app/subscribes` | 订阅文件 |
| `./data/rule_templates` | `/app/rule_templates` | 规则模板 |

容器重建会保留这些目录。若从原 Compose 配置迁移，先停止旧服务并备份，再将原来 `subscribes/` 和 `rule_templates/` 内的运行文件分别迁移到上述目录；复用原来的 `data/` 数据库目录。两份配置默认使用不同的 Compose 项目名，启动新配置不会自动停止旧配置。

在自己的 Fork 合并并验证新代码后，VPS 更新方式为：

```bash
git pull --ff-only origin main
docker compose --env-file .env.cloudflare -f docker-compose.cloudflare.yml up -d --build
```

更新 Tunnel 镜像：

```bash
docker compose --env-file .env.cloudflare -f docker-compose.cloudflare.yml pull cloudflared
docker compose --env-file .env.cloudflare -f docker-compose.cloudflare.yml up -d --no-build
```

备份时可先停应用，以便复制完整的 SQLite 数据文件：

```bash
docker compose --env-file .env.cloudflare -f docker-compose.cloudflare.yml stop miaomiaowu
tar -czf "../mmw-data-$(date +%Y%m%d-%H%M%S).tar.gz" data
docker compose --env-file .env.cloudflare -f docker-compose.cloudflare.yml start miaomiaowu
```

备份文件包含运行数据，应放到仓库外或你自己的备份存储中。

**定制版本请通过源码或自己的镜像更新。** 当前项目的应用内“系统更新”会下载作者发布的二进制，并将其放到 `/app/data/server`。容器入口脚本优先运行这个文件，它会盖过你镜像中的定制版本。若已发生，在停止应用后将宿主机 `data/server` 改名备份，再启动容器；数据库和订阅文件无需删除。

## 4. 使用自己的 GHCR 镜像（可选）

仓库已有 `.github/workflows/docker-ghcr.yml`。启用自己的 Fork 的 Actions 后，推送 `main` 会发布 `ghcr.io/你的用户名/miaomiaowu:main` 和 `:latest`；默认构建 `linux/amd64`，ARM VPS 可在 Actions 手动运行时选择双架构。

在 `.env.cloudflare` 中指定自己的镜像（用户名、仓库名使用小写；部署时也可固定到 `sha-...` 标签）：

```dotenv
MMW_IMAGE=ghcr.io/your-github-name/miaomiaowu:main
```

然后先显式拉取，再启动，跳过源码构建：

```bash
docker pull ghcr.io/your-github-name/miaomiaowu:main
docker compose --env-file .env.cloudflare -f docker-compose.cloudflare.yml up -d --no-build
```

应用的 `pull_policy: never` 让 Compose 使用本地已构建或已拉取的镜像。不要把 `MMW_IMAGE` 指向作者的镜像，那里面不含本次定制。首次发布的 GHCR package 可在 GitHub Packages 中设为 Public；若保持私有，需要在 VPS 先登录 GHCR。

## 5. 排查访问问题

- Tunnel 未连接：检查 token 与 cloudflared 日志、出站网络，以及 Cloudflare 中连接器状态。
- Cloudflare 返回 502：检查应用健康状态，Service URL 应为 `http://miaomiaowu:8080`，不是 HTTPS 或 localhost。
- 开启 Cloudflare Access 后订阅客户端无法刷新：交互式网页登录会拦住普通订阅客户端。为订阅入口设计客户端可用的访问策略，或继续使用应用自身的认证与订阅 token。
- 升级后二维码按钮消失：检查是否使用作者镜像，或 `data/server` 中是否留有应用内更新下载的作者版本。
