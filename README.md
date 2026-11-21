# GENESIS GARAGE · 废铁工坊

**接手擂主车，只改一个零件（预算≤5），合约算圈速，跑赢就换你当擂主。**

零件价格、预算校验、圈速计算和擂主更替全在合约里，页面只是提交入口和展示——链是裁判，不是账本。

合约地址 `0xe1e1E8498ff909Bf1d2B8fD95ff849ec9C932c10` · Monad Testnet (chain 10143)
Demo → **https://mia03ther.github.io/monad-garage/garage.html**

---

## 圈速公式（链上固定，不可改）

三段赛道各有基准时间，零件和 Boost 叠加偏移，总时间越小越快：

```
lapTime = Σ (base[i] + motor[i] + tires[i] + boost_if_used[i])

base      = [4200, 5100, 4600]  ms  (码头直道 / 积水弯 / 碎石坡)

motor:  旧电机(0)=[0,0,0]  扭矩(1)=[+220,+90,-720]  涡轮(2)=[-750,+480,-280]
tires:  公路(0)=[-150,+550,+180]  雨地(1)=[+100,-650,+220]  钉齿(2)=[+360,-300,-390]
boost:  码头=-530  积水弯=+420  碎石坡=-850
```

同一套规则对所有人，提交后合约 revert 超预算的组合。

---

## 玩法

1. 扫码或打开 demo URL
2. 选电机 + 轮胎（总费用 ≤ 5），选一个 Boost 赛段
3. 点「挑战擂主」，钱包签名（或 relayer 代签）
4. 合约算出你的圈速，跑赢当前擂主 → 你直接成为新擂主，链上记录永久保留

---

## 合约

| 文件 | 说明 |
|---|---|
| `contracts/GenesisGarage.sol` | 核心：`lapTime()` 算圈速，`publish()` 验预算+判胜负+换擂主 |

```bash
# 本地跑前端
python -m http.server 8022 --directory frontend
# 打开 http://localhost:8022/garage.html
```

Monad Testnet RPC: `https://testnet-rpc.monad.xyz`
