# Historical deployment notes (superseded by root DEPLOY.md)

## 一、推到 GitHub（需要用户重新授权后执行）

```bash
cd ~/workspace/project-genesis
git push origin main
```

如果 push 要求输入凭证：用 GitHub Personal Access Token（classic，勾 `repo`）
当密码用。不要用旧的 token——之前那个报 401，已经失效。

## 二、发布试玩页到 GitHub Pages（观众扫码就能玩）

```bash
cd ~/workspace/project-genesis
git subtree push --prefix frontend origin gh-pages
```

然后在 GitHub 仓库页面：Settings → Pages → Source 选 `gh-pages` 分支 → Save。
约 1 分钟后生效，地址：

**https://mia03ther.github.io/project-genesis/**

二维码见 `docs/qr-play.png`（已生成，对应上面这个地址）。
现场大屏 / 幻灯片最后一页放这个码，观众扫码打开就能自己玩一局，
不用钱包、不用注册。

## 三、现场演示的启动方式（必须用 http.server，不能双击打开）

```bash
cd frontend && python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

双击 index.html 会进“本地文件模式”，实时对局加载不了，
只显示种子 42 的存档。**务必提前在比赛电脑上跑一遍上面这条命令。**

## 四、演示用的那一局（已彩排通过）

- 种子 42，天数 60（打开页面就是这个默认值，不用改）
- 已知结果：**Cinder 赢**（确定性引擎，同样种子重跑结果一字不差）
- 下注：Cinder 100 + Boreas 100 → 总池 200
- 点 ⏩ 快进 → Cinder 拿回 200（净赚 +100），Boreas 归零
- 快进实测 313ms；完整彩排脚本见 `frontend/rehearse_demo.mjs`
  （`node frontend/rehearse_demo.mjs`，5/5 检查通过）
