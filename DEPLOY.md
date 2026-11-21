# GENESIS 现场部署

## 公网入口：GitHub Pages

静态网站目录是 `frontend/`，不需要 Node 构建。新首页 `/`，建造 `/play.html`，大屏 `/play.html?wall=1`；旧实验 `/legacy.html`。Pages 不能运行 Python 本地演练网关。

在已提交并审核当前源码后，发布整个前端到专用 `gh-pages` 分支，不需要合并 main：

```powershell
$pagesCommit = git subtree split --prefix frontend HEAD
git push origin "${pagesCommit}:gh-pages"
```

若远程分支已被别人更新，正常推送会拒绝；不要强推覆盖。仓库 Settings → Pages 应指向 `gh-pages` 根目录。线上地址：

https://mia03ther.github.io/project-genesis/

`docs/genesis-qr.png` 指向公网首页，只是入口二维码，不代表某个测试网房间。主持人创建已确认的 Monad Testnet 房间后，使用页面内生成的房间二维码，观众才会进入同一份公开链状态。练习入口不会自动变成公网多人房间。

## 无钱包现场演练：一台电脑加几台手机

```powershell
Set-Location D:\Github\project-genesis-studio
$env:Path = "$env:USERPROFILE\.foundry\bin;$env:Path"
.\.venv\Scripts\python.exe -m genesis.live --host 0.0.0.0 --port 8030
```

第一次运行按 README 创建 Python 3.12 虚拟环境并安装开发依赖。需要 Foundry，首次下载 Solc 0.8.29 可能较慢。服务自行启动只绑定 loopback 的 Anvil（31337），部署新房间，给至多九个浏览器会话分配不同临时账户。

主持人先在电脑进入 `/play.html` 加入；首个会话拥有本地“新开一局”按钮。第一块建筑确认后，链上 90 秒开始；可以等观众都加入再动手。成功后解锁自由组装，失败后只读。大屏 `/play.html?wall=1` 展示同一房间。

手机与电脑需在同一可信局域网。邀请二维码应使用电脑的局域网地址，不能是 localhost。自动选择到错误网卡时显式指定：

```powershell
.\.venv\Scripts\python.exe -m genesis.live --host 0.0.0.0 --port 8030 --advertise-host 192.168.1.23
```

替换成实际 IP。没有自动改变防火墙或路由器隔离设置。默认 `--host 127.0.0.1` 仅供单机。该标准库 HTTP 服务不是公网生产后端，不要把它直接暴露到互联网。

## 公开 Monad 彩排

1. 先确认各建造者有测试钱包和测试 MON；只使用测试网。
2. 从公网首页创建测试网房间，用户在钱包确认部署，等页面校验合约成功。
3. 用页面内邀请二维码让其他手机进入同一房间。观看不需要钱包；建造需要各自签名和测试 gas。
4. 三个地址分工建设风塔、两座居民舱、生态园与信标。确认前不应提前出现在地图。
5. 核对合约判定的成功/超时，打开实际交易记录，刷新另一客户端确认地图一致。
6. 验证拒签、网络失败、抢占同一格、账号切换、页面重载及主持人重新开房间。

目前实际执行的是本地 Anvil/HTTP 三会话彩排。尚未执行公开钱包部署、实际手机或本轮浏览器视觉验收；不可把以上清单写成已经通过。完整限制和实测结果见 `docs/RELAUNCH.md` 与 `docs/validation/RELAUNCH_CHECKS.md`。

## 合约更新

```powershell
forge build --root contracts --use 0.8.29
.\.venv\Scripts\python.exe tools/export_community.py
```

更新代码后重新部署房间，并重新发布静态文件。旧合约不会被新前端冒充成相同版本：运行时代码不匹配会明确拒绝连接。不要将真实钱包密钥放进网站、日志或 Git 仓库。
