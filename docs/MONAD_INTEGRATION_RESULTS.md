# GENESIS × Monad 集成执行结果

日期：2026-11-19（Asia/Shanghai）  
执行分支：`feat/monad-integration`  
基线提交：`129bdf074a931d316d9cda52a263b386ad5ad9a6`

延迟基线补测：2026-11-19 14:40（Asia/Shanghai）

原始报告：[`docs/examples/monad-latency-baseline.json`](examples/monad-latency-baseline.json)

> 本文件包含同一结果的两个版本。第一部分给不熟悉技术的队友阅读，第二部分给技术队友复核。本文只记录实际执行结果，不把本地验证写成 Monad 公网部署。

---

## 版本 A：给不会技术的队友

### 目前进展

我们已经确认，当前共建浮岛合约本身能够正常编译，13 项自动化合约测试全部通过；网页内置的合约版本也与当前源码一致。Monad 测试网可以正常连接，返回的网络编号是 10143。

当前共建浮岛合约已经真实部署到 Monad Testnet，并完成一笔真实建造。部署和建造交易均成功，且所在区块已经进入 finalized 高度。项目自己的前端网关也验证了链上合约代码确实是当前版本，而不是同地址下的其它合约。

### 已经完成

- 创建了独立工作分支，不影响玩法开发。
- 使用指定的 Solidity 0.8.29 编译合约。
- 13 项合约测试全部通过，0 项失败。
- 确认网页使用的合约字节码没有发生意外变化。
- 确认 Monad Testnet RPC 可以访问。
- 确认 Monad Testnet Chain ID 为 10143。
- 成功读取到测试网区块 `80,900,046`，证明 RPC 当时在线。
- 将 `GenesisCommunity` 部署到 Monad Testnet。
- 部署交易成功，链上合约地址为 `0xb1EEA6F45B37098f62Fe6cA484441F846eb42C1A`。
- 提交一笔真实建造交易，在地块 39 建造风塔。
- 建造后的链上状态与预期一致：1 位参与者、版本 1、剩余额度 7。
- 链上合约代码哈希与网页内置版本完全一致。
- 使用项目自身前端网关成功读取公网房间。
- 另建一个独立测试房间，连续完成 3 笔真实建造交易，用来测量 Monad 的确认速度。
- 三笔交易全部成功，WebSocket 也都收到了 proposed、voted 和 finalized 通知。

### 实际速度

三笔真实建造交易的中位数结果如下：

| 用户关心的阶段 | 中位时间 | 含义 |
|---|---:|---|
| 收到交易哈希 | 约 1.17 秒 | 钱包提交已被 RPC 接收 |
| 进入 proposed 区块 | 约 1.70 秒 | 可以开始给用户快速反馈 |
| 查到成功回执 | 约 1.77 秒 | 可以确认本次操作执行成功 |
| 达到 safe | 约 2.15 秒 | 区块进入更稳妥的确认阶段 |
| 达到 finalized | 约 2.35 秒 | 区块最终确认 |

这说明 Monad 本身的确认速度不是当前体验的主要瓶颈。网页目前每 5 到 7 秒轮询一次，可能比链上最终确认还慢；下一阶段应优先优化网页读取和实时通知。

这组数据来自 3 笔测试网交易，只作为当前开发基线，不代表任何时间、网络负载下都固定达到同样速度。

### 仍待完成

- 尚未用真实浏览器钱包完成点击建造；本次真实交易由同一测试钱包通过 Foundry `cast` 签名提交。
- 尚未完成浏览器视觉验收和手机验收。
- 尚未使用三个不同钱包完成整局。
- 尚未把 WebSocket 接入游戏刷新逻辑；本次仅确认 WebSocket 可用并记录其通知时间。

### 公开记录

合约地址：

```text
0xb1EEA6F45B37098f62Fe6cA484441F846eb42C1A
```

部署交易：

```text
0xac2bd2a1534d330a7160f7ab4357a62d509a05c3154d3cd36a641c5925dfdbf8
```

首笔建造交易：

```text
0xe725b141b84d040494791bd859bda44fcf1fc4774e7a713983bccc9d1122bc3a
```

下一阶段可以开始优化 RPC 读取和 WebSocket，但在此之前还应补一次真实浏览器钱包及多手机验收。

### 对外可以怎么说

现在可以说：

> GENESIS 共建合约已经部署到 Monad Testnet，完成了一笔真实建造交易；链上代码版本、交易回执和建造后的房间状态均已验证。

现在不能说：

> 已经完成三钱包、真实手机和完整 90 秒公网共建彩排。

后一句目前还不能说，因为这次只完成了部署、单钱包建造及程序化前端网关验证。

---

## 版本 B：给会技术的队友

### 1. 工作区与工具链

| 项目 | 实际结果 |
|---|---|
| Git 分支 | `feat/monad-integration` |
| 基线提交 | `129bdf074a931d316d9cda52a263b386ad5ad9a6` |
| Forge | `1.8.4` |
| Cast | `1.8.4` |
| Solidity | `0.8.29+commit.ab55807c` |
| 部署账户 | `0xc338e05fD4F8322E1562DB052c42995223254B97` |
| 凭证来源 | Git 忽略、权限 0600 的本地 `.env` |
| 部署前余额 | `23.968998465410000000` 测试 MON |

报告、命令输出和 Git 变更中没有记录私钥。私钥值不在本文档中。

### 2. 合约测试

执行命令：

```bash
forge test --root contracts --use 0.8.29 -vv
```

结果：

- `CommunityTest`：11 passed
- `BlueprintsTest`：2 passed
- 合计：**13 passed, 0 failed, 0 skipped**
- `testFuzzRefundConservesAllowance`：256 runs

首次执行因受限环境无法下载 Solc 失败；取得网络权限后下载 Solc 0.8.29，重新执行通过。该初次网络失败不计为测试失败。

Foundry lint 输出了现有警告，包括 `block.timestamp`、访问控制相关状态缺少独立事件，以及一个未显式初始化的局部变量。测试未因此失败。本轮目标是不改变玩法，因此没有修改合约来消除这些警告。

### 3. 构建产物一致性

执行命令：

```bash
forge build --root contracts --use 0.8.29
python3 tools/export_community.py
git diff --check
```

结果：

- 编译成功。
- `frontend/community/build.json` 导出前后 SHA-256 相同：

  ```text
  f8948132582b06eac09e9bda45f710594a10aeb0d115c437a9544e6bdd0b8848
  ```

- `GenesisCommunity` runtime bytecode SHA-256：

  ```text
  d533e927d7ac30954d1c1491663c42058021f26754395fcb8fc728a8d52d5b2b
  ```

- 导出过程没有改变 `build.json`，说明当前前端内置的 creation bytecode/runtime hash 与本次编译一致。
- `git diff --check` 通过。

### 4. Monad Testnet RPC 基线

执行命令：

```bash
cast chain-id --rpc-url https://testnet-rpc.monad.xyz
cast block-number --rpc-url https://testnet-rpc.monad.xyz
```

实际结果：

```text
chain_id: 10143
observed_block: 80900046
```

这一步证明配置的 RPC 在检查时可以读取 Monad Testnet；随后已通过同一 RPC 完成真实部署和建造。

### 5. 公网部署记录

状态：**DEPLOYED AND VERIFIED**

部署命令：

```bash
forge create \
  --root contracts \
  --use 0.8.29 \
  GenesisCommunity.sol:GenesisCommunity \
  --rpc-url "$GENESIS_MONAD_RPC_URL" \
  --private-key "$GENESIS_MONAD_PRIVATE_KEY" \
  --broadcast \
  --json
```

部署结果：

| 字段 | 结果 |
|---|---|
| Deployer | `0xc338e05fD4F8322E1562DB052c42995223254B97` |
| Contract | `0xb1EEA6F45B37098f62Fe6cA484441F846eb42C1A` |
| Transaction | `0xac2bd2a1534d330a7160f7ab4357a62d509a05c3154d3cd36a641c5925dfdbf8` |
| Status | `1 (success)` |
| Block | `80,901,673` |
| Block hash | `0x64ac7bd282f45e9c8419ce66c1f93db7906858383e8cc90bc90d4a801cd9faba` |
| Gas used | `1,928,259` |
| Effective gas price | `102,500,000,000 wei` |
| Fee | `0.1976465475` 测试 MON |
| Runtime bytes | `8,493` |
| Runtime SHA-256 | `d533e927d7ac30954d1c1491663c42058021f26754395fcb8fc728a8d52d5b2b` |

链上 runtime SHA-256 与 `frontend/community/build.json` 的 `runtimeHash` 完全一致。部署后 `roundState()` 返回 phase `0`、endsAt `0`，符合空房间预期。

### 6. 真实建造基线

调用：

```text
build(cell=39, kind=2, rotation=0)
```

结果：

| 字段 | 结果 |
|---|---|
| Transaction | `0xe725b141b84d040494791bd859bda44fcf1fc4774e7a713983bccc9d1122bc3a` |
| Status | `1 (success)` |
| Block | `80,901,818` |
| Block hash | `0x60e4ac460ea7891ad83554427971e7e2455df86ccbeab56b561c158b74634b3b` |
| Gas used | `214,491` |
| Effective gas price | `100,000,000,001 wei` |
| Fee | `0.021449100000214491` 测试 MON |
| Tool observed wall time | 约 `6.5 s`，包含命令/RPC开销，不等同于纯链上最终确认时间 |

建造后权威状态：

```text
cell 39 kind: 2
revision: 1
participants: 1
deployer allowance: 7
phase at first verification: 1
```

检查时 finalized block 已到 `80,901,911`，高于建造区块 `80,901,818`，因此该建造区块当时已经 finalized。

### 7. 六项公网完成标准

| 完成标准 | 状态 | 证据/原因 |
|---|---|---|
| 获得真实 Monad 合约地址 | 完成 | `0xb1EE...2C1A` |
| 获得部署交易哈希 | 完成 | `0xac2b...dbf8` |
| 前端 runtime hash 校验通过 | 完成 | 实际运行 `CommunityGateway.check()` 通过 |
| 钱包成功提交一笔 `build()` | 完成 | `0xe725...c3a`，由测试钱包通过 `cast` 签名 |
| 浏览器显示已确认建筑 | 未完成 | 前端网关读取通过，但尚未进行真实浏览器视觉验收 |
| 记录真实 Gas 与确认时间 | 完成 | 首笔建造 Gas 已记录；另以 3 笔交易测得 proposed/receipt/safe/finalized 延迟 |

### 8. 前端网关公网验证

使用项目真实代码构造：

```text
CommunityGateway(publicRpc, contract, MONAD.id, build.runtimeHash)
```

`gateway.check()` 和 `gateway.read(deployer)` 均成功。解析结果：

```json
{
  "gatewayCheck": "passed",
  "block": 80901960,
  "revision": 1,
  "participants": 1,
  "balance": 7,
  "cell39": 2,
  "supply": 7,
  "used": 0,
  "phase": 1
}
```

这验证了生产前端的数据层可以连接、校验并解析该公网房间，但不替代真实浏览器/WebGL视觉验收。

### 9. Monad 延迟与 WebSocket 基线

为避免原部署房间状态影响测量，测速脚本部署了一个独立的 `GenesisCommunity` 房间，并连续提交 3 笔 `build()` 交易。测速没有修改合约、前端或玩法代码。

测试对象：

| 字段 | 结果 |
|---|---|
| 测试合约 | `0xe786F0d333DA0d4d4d4a6Febd25F3Cf0A7B463B3` |
| 部署交易 | `0x0f84f9eb2d312f06dc21f37f19bad2e559d0b8f281652bc2789b2f77770baed9` |
| Runtime SHA-256 | `d533e927d7ac30954d1c1491663c42058021f26754395fcb8fc728a8d52d5b2b` |
| HTTP RPC | `https://testnet-rpc.monad.xyz` |
| WebSocket | `wss://testnet-rpc.monad.xyz` |
| 样本数 | 3 |

三笔交易：

| Cell | Transaction | Block | Gas used |
|---:|---|---:|---:|
| 39 | `0xd0fcaffad672a4926e686966c294570ca3feeeb965b2311ccb042cb00c81dd47` | `80,966,790` | `214,267` |
| 38 | `0x1d6e9ec93756cd4ae348b5df2bbeeb3257e49708987e0e6e93bd62860e90e27b` | `80,966,798` | `127,109` |
| 37 | `0x3928f1749458bd7cd33fdb21c1ba8376009461f8b093eaab6a920d8542c4a72f` | `80,966,808` | `131,787` |

端到端中位延迟（从开始提交交易计时）：

| 阶段 | 中位延迟 |
|---|---:|
| 返回 transaction hash | `1,165.701 ms` |
| WebSocket proposed | `1,698.472 ms` |
| HTTP receipt | `1,768.045 ms` |
| WebSocket voted | `2,007.268 ms` |
| HTTP safe | `2,154.358 ms` |
| HTTP finalized | `2,347.393 ms` |

验证结果：

- 3 笔交易的 receipt 均为成功。
- `monadLogs` 成功捕获 proposed、voted 和 finalized 阶段。
- 测试结束后链上 `cell 39/38/37` 均为 `kind=1`，`revision=3`、`participants=1`、剩余额度 `9`。
- 测试合约 runtime hash 与前端预期值一致。
- 原始 JSON 不包含私钥，仅包含公开链上数据和测量结果。
- `verifiedLatencyMs` 为 `null`，表示本轮没有等待/测量 verified 阶段，不表示交易失败。

完整机器可读结果见 [`docs/examples/monad-latency-baseline.json`](examples/monad-latency-baseline.json)。样本量只有 3，适合作为后续 Batch RPC 和 WebSocket 优化的对照基线，不应解释为性能保证。

### 10. 下一步

1. 使用注入钱包的真实浏览器打开 `play.html?room=0xb1EEA6F45B37098f62Fe6cA484441F846eb42C1A`。
2. 完成视觉、拒签、刷新恢复和手机测试。
3. 用三个不同测试钱包部署新房间并完成整局，因为当前基线房间在首笔建造后已启动90秒计时。
4. 对当前 `CommunityGateway.read()` 做 30 次读取基线，记录请求数、P50/P95 和一致性。
5. 在保持按同一区块读取语义的前提下实现 Batch RPC，并保留逐项调用回退。
6. 使用 WebSocket 事件触发权威状态重读，同时保留轮询和断线补读。

### 11. 本轮没有进行的操作

- 没有修改玩法。
- 没有修改 `GenesisCommunity.sol`。
- 没有修改前端 RPC 或确认逻辑。
- 没有把私钥写入 Git 或报告。
- 没有执行区块浏览器源码验证。
- 没有执行浏览器/WebGL视觉验收。
- 没有开始 WebSocket、Batch RPC 或存储结构优化。

