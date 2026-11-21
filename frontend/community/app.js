import {
  Practice,
  TYPES,
  LABELS,
  COST,
  CREWS,
  cellFor,
  nextContribution,
  sceneView,
  validateAction,
} from "./domain.js";
import {
  CommunityGateway,
  MONAD,
  PUBLIC_APP,
  publicRpc,
  publicBatchRpc,
  localPost,
} from "./gateway.js";
import { MonadRoomStream } from "./stream.js";
import { mount } from "../sandbox/scene.js";
import qrcode from "../vendor/qrcode.mjs";

const $ = (id) => document.getElementById(id),
  query = new URLSearchParams(location.search),
  wall = query.get("wall") === "1";
const STORAGE = "genesis.community.practice.v1",
  BRIEFING = "genesis.community.briefing.v2",
  short = (s) => (s && s.length > 16 ? s.slice(0, 6) + "…" + s.slice(-4) : s);
let mode = "practice",
  world = new Practice(),
  snapshot = world.snapshot(),
  role = readSession("genesis.role") ?? "A",
  actor = "",
  gateway = null,
  info = null,
  build = null,
  scene = null,
  selected = 2,
  rotation = 0,
  choice = null,
  busy = false,
  pending = null,
  polling = false,
  timer = null,
  roomStream = null,
  streamRefreshTimer = null,
  streamRefreshPending = false,
  lastRevision = -1,
  lastBlock = null,
  feed = [],
  tourRunning = false,
  advancedMode = false,
  activeCrew = readSession("genesis.crew") ?? "power",
  confirmationSamples = [];
if (!CREWS.some((crew) => crew.id === activeCrew)) activeCrew = "power";
function readSession(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
let practicePersistence = true;
if (!["A", "B", "C"].includes(role)) role = "A";
let clockSample = performance.now(),
  clockTimer = null;
let receiptTimer = null;
function queueReceipt() {
  if (pending?.tx && !receiptTimer)
    receiptTimer = setTimeout(() => {
      receiptTimer = null;
      poll(true);
    }, 1000);
}
function tickClock() {
  if (mode === "practice") {
    $("clock").textContent = "无计时";
    return;
  }
  if (!snapshot.block) {
    $("clock").textContent = "同步中";
    return;
  }
  if (snapshot.phase === 0) {
    $("clock").textContent = "等待开局";
    return;
  }
  if (snapshot.phase === 2) {
    $("clock").textContent = "任务完成";
    return;
  }
  if (snapshot.phase === 3) {
    $("clock").textContent = "已超时";
    return;
  }
  const left = Math.max(
    0,
    Math.ceil(
      snapshot.endsAt -
        snapshot.chainTime -
        (performance.now() - clockSample) / 1000,
    ),
  );
  $("clock").textContent = left ? left + " 秒" : "确认中";
}
document.body.classList.toggle("wall", wall);
const message = (text) => ($("message").textContent = text);
const roomMessage = (text) => ($("room-result").textContent = text);
const uuid = () =>
  crypto.randomUUID?.() ??
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
const localRequest = async (method, params) =>
  (await localPost("api/rpc", { method, params })).result;
function balance() {
  if (mode === "practice") return world.balances[role] ?? 12;
  if (!actor) return null;
  return snapshot.balance === 0 &&
    !snapshot.owners.some((o) => o.toLowerCase() === actor.toLowerCase())
    ? 12
    : snapshot.balance;
}
function roomUrl(projector = false) {
  const u = new URL(
    mode === "monad"
      ? PUBLIC_APP
      : mode === "local" && info?.shareUrl
        ? info.shareUrl
        : new URL("play.html", location.href),
  );
  if (mode === "monad") u.searchParams.set("room", gateway.contract);
  if (mode === "local") u.searchParams.set("local", "1");
  if (projector) u.searchParams.set("wall", "1");
  return u.href;
}
function svg(url) {
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  return qr.createSvgTag({ cellSize: 5, margin: 20, scalable: true });
}
function invitations() {
  const url = roomUrl();
  $("share-url").value = url;
  $("share-note").textContent =
    mode === "practice"
      ? "This is a local practice entry. It does not connect to another private practice save."
      : mode === "local"
        ? "Trusted LAN only. This is an Anvil rehearsal, not Monad Testnet."
        : "One contract, one city. Viewing is wallet-free; building requires a test wallet and test MON.";
  $("qr").innerHTML = svg(url);
  $("projection").href = roomUrl(true);
  $("wall-qr").innerHTML = svg(url);
  $("wall-url").textContent = url;
  $("wall-source").textContent =
    mode === "practice"
      ? "LOCAL PRACTICE · OFFCHAIN"
      : mode === "local"
        ? "ANVIL LOCAL · 31337"
        : "MONAD TESTNET · 10143";
}
function showFeed() {
  const items = feed.slice(-5).reverse();
  $("feed").replaceChildren(
    ...items.map((e) => {
      const li = document.createElement("li");
      li.append(
        document.createTextNode(
          `${short(e.actor)} ${e.type === "build" ? "deployed " + LABELS[e.kind] : "reclaimed a module"} · #${e.revision}`,
        ),
      );
      if (e.tx && mode === "monad") {
        const a = document.createElement("a");
        a.href = MONAD.explorer + "/tx/" + e.tx;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = " VIEW TX";
        li.append(a);
      }
      return li;
    }),
  );
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent =
      mode === "practice" ? "先接通第一座风力塔。" : "等待下一笔已确认贡献。";
    $("feed").append(li);
  }
}
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
function renderCrewConsole() {
  const crew = CREWS.find((item) => item.id === activeCrew) ?? CREWS[0];
  const action = nextContribution(snapshot, crew.id);
  for (const button of $("crews").children)
    button.setAttribute("aria-pressed", String(button.dataset.crew === crew.id));
  const quick = $("quick-action");
  quick.disabled =
    busy || tourRunning || snapshot.phase === 3 || snapshot.restored || !action;
  quick.querySelector("small").textContent = `${crew.label} / ${crew.zh}`;
  quick.querySelector("strong").textContent = snapshot.restored
    ? "CITY ZERO ONLINE"
    : action
      ? crew.verb
      : "本组任务已完成";
  quick.querySelector("span").textContent =
    mode === "practice"
      ? "点击立即模拟 · 现场模式等待链上确认"
      : "ONE TAP · ONE CONFIRMED TRANSACTION";
}
function render(force = false) {
  document.body.classList.toggle(
    "restored",
    Boolean(snapshot.phase === 2 || snapshot.restored),
  );
  $("objective-copy").textContent =
    mode === "practice"
      ? "选模块，接到核心旁边。"
      : snapshot.phase === 2
        ? "城市已复苏。"
        : snapshot.phase === 3
          ? "任务失败。重新开始。"
          : snapshot.phase === 0
            ? "等人齐。第一笔确认后开始倒计时。"
            : "完成下面四项任务。";
  if (!clockTimer) clockTimer = setInterval(tickClock, 250);
  tickClock();
  $("restart-room").hidden =
    mode !== "local" ||
    !actor ||
    actor.toLowerCase() !== info?.hostAddress?.toLowerCase();
  if (force || lastRevision !== snapshot.revision) {
    scene?.rebuild(sceneView(snapshot));
    lastRevision = snapshot.revision;
  }
  $("mode").textContent =
    mode === "practice" && query.has("room") && !gateway
      ? "CONNECTING TO ROOM…"
      : mode === "practice"
        ? "LOCAL PRACTICE · OFFCHAIN"
        : mode === "local"
          ? "ANVIL LOCAL · 现场演练"
          : "MONAD TESTNET · 现场房间";
  $("people-label").textContent = mode === "practice" ? "角色" : "队员";
  $("people").textContent = snapshot.participants;
  $("power").textContent = `${snapshot.used}/${snapshot.supply}`;
  $("homes").textContent = `${snapshot.homes}/2`;
  $("confirmed-actions").textContent = snapshot.revision;
  const p50 = median(confirmationSamples);
  $("median-latency").textContent = p50 === null ? "—" : `${p50.toFixed(1)}s`;
  $("goals").replaceChildren(
    ...[
      [snapshot.supply > 1, "接通风力塔"],
      [snapshot.homes >= 2, "部署两座居住舱"],
      [snapshot.gardens >= 1 && snapshot.beacons >= 1, "恢复生态与信号"],
      [
        snapshot.participants >= 3,
        mode === "practice" ? "三个练习角色协作" : "三个地址共同参与",
      ],
    ].map(([done, text]) => {
      const p = document.createElement("div");
      p.className = done ? "goal-done" : "";
      p.textContent = (done ? "✓ " : "○ ") + text;
      return p;
    }),
  );
  $("headline").innerHTML =
    snapshot.phase === 2 || snapshot.restored
      ? "CITY ZERO<br>LIVES."
      : snapshot.phase === 3
        ? "MISSION FAILED.<br>RUN IT AGAIN."
        : "CITY ZERO IS<br>LOSING POWER.";
  $("identity").textContent =
    mode === "practice"
      ? `练习角色 ${role}`
      : actor
        ? (info?.session?.name ?? short(actor))
        : "正在观看 · 尚未加入";
  $("budget").textContent =
    balance() === null ? "加入后获得 12 额度" : `${balance()} 建造额度`;
  $("provenance").textContent =
    mode === "practice"
      ? "Local practice uses three simulated roles. They are not online players."
      : !snapshot.block
        ? "Reading confirmed room state. Stand by."
        : `网关校验通过 · ${mode === "local" ? "ANVIL LOCAL" : "MONAD TESTNET"} · CONFIRMED REV ${snapshot.revision} · BLOCK ${parseInt(snapshot.block, 16)} · BUILD CREDITS ARE NON-TRANSFERABLE AND ARE NOT TOKENS.`;
  $("role").hidden = mode !== "practice";
  $("role").textContent = `切换角色 ${role}`;
  $("tour").hidden = mode !== "practice" || wall;
  $("tour").disabled = tourRunning;
  $("confirm").disabled =
    busy ||
    tourRunning ||
    (choice?.type === "remove" &&
      snapshot.owners[choice.cell]?.toLowerCase() !==
        (mode === "practice" ? role : actor)?.toLowerCase());
  $("download").disabled = busy;
  renderCrewConsole();
  showFeed();
  $("room-explain").textContent =
    mode === "local"
      ? "Local Anvil rehearsal: no wallet required. Up to nine operators share one contract through disposable host accounts."
      : mode === "monad"
        ? "This is a Monad Testnet room. Viewing is wallet-free; building requires wallet approval and test MON for gas."
        : "Run local practice, or create and join a real testnet room.";
  if (mode === "practice" && practicePersistence)
    try {
      localStorage.setItem(STORAGE, world.export());
    } catch {
      message("Autosave is unavailable. Export the coordination trace.");
    }
}
function clearChoice() {
  choice = null;
  $("action").hidden = true;
}
function selectCell({ x, z }) {
  if (wall || busy || tourRunning) return;
  if (!advancedMode) {
    message("主玩法不需要选地块：选择小队，然后点击底部的大按钮。");
    return;
  }
  if (snapshot.phase === 3) {
    message("Mission timeout. The host can reset CITY ZERO for another run.");
    return;
  }
  if (mode !== "practice" && !snapshot.block) {
    message("Waiting for confirmed room state.");
    return;
  }
  const cell = cellFor(x, z);
  if (cell === 40) {
    message(
      "The Genesis Core is protected. Connect a turbine, then coordinate habitats and the bio-garden.",
    );
    return;
  }
  const existing = snapshot.kinds[cell];
  choice = existing
    ? { type: "remove", cell }
    : { type: "build", cell, kind: selected, rotation };
  $("action-caption").textContent = `地块 ${x}, ${z}`;
  $("action-title").textContent = existing
    ? LABELS[existing]
    : LABELS[selected];
  const own = mode === "practice" ? role : actor;
  $("action-detail").textContent = existing
    ? `建造者 ${short(snapshot.owners[cell])} · 拆除后退回额度`
    : `${COST[selected]} 额度 · 必须连接已有建筑`;
  $("confirm").textContent = existing
    ? "拆回我的模块"
    : mode === "practice"
      ? "确认组装"
      : mode === "local"
        ? "提交到本地链"
        : "在钱包中确认";
  $("action").hidden = false;
  if (existing && snapshot.owners[cell]?.toLowerCase() !== own?.toLowerCase()) {
    $("confirm").disabled = true;
    $("action-detail").textContent +=
      " You may inspect it, but only its operator can reclaim it.";
  } else $("confirm").disabled = false;
}
function pendingKey() {
  return (
    "genesis.pending." +
    (mode === "local" ? info.instance : (gateway?.contract ?? "practice"))
  );
}
function savePending() {
  try {
    if (pending) sessionStorage.setItem(pendingKey(), JSON.stringify(pending));
    else sessionStorage.removeItem(pendingKey());
  } catch {
    /* tracking remains active in memory */
  }
}
async function poll(fast = false) {
  if (mode === "practice" || !gateway || polling || document.hidden) return;
  polling = true;
  const g = gateway,
    readingActor = actor;
  try {
    if (mode === "local") {
      const fresh = await fetch("api/info").then((r) => r.json());
      if (fresh.instance !== info.instance) {
        location.reload();
        return;
      }
    }
    if (pending?.tx) {
      const receipt = await g.receipt(pending.tx);
      if (g !== gateway) return;
      if (!receipt && fast) return;
      if (receipt) {
        const elapsed = pending.startedAt
            ? Math.max(0, (Date.now() - pending.startedAt) / 1000)
            : null,
          network = mode === "monad" ? "MONAD" : "ANVIL LOCAL";
        if (receipt.status !== "0x1") {
          $("latency").textContent = network + " · FAILED";
          message(
            "Action failed. Confirmed onchain credits remain authoritative.",
          );
        } else {
          if (elapsed !== null) confirmationSamples.push(elapsed);
          confirmationSamples = confirmationSamples.slice(-31);
          $("latency").textContent =
            network +
            (elapsed === null ? " · CONFIRMED" : ` · ${elapsed.toFixed(1)}S`);
          message(
            `${network} 已确认${elapsed === null ? "" : ` · ${elapsed.toFixed(1)} 秒`}。城市状态已更新。`,
          );
        }
        pending = null;
        busy = false;
        savePending();
        clearChoice();
      }
    }
    const next = await g.read(readingActor);
    if (g !== gateway || readingActor !== actor) return;
    if (snapshot.block && BigInt(next.block) < BigInt(snapshot.block)) return;
    snapshot = next;
    clockSample = performance.now();
    render();
    const start =
      lastBlock === null
        ? BigInt(next.block) > 100n
          ? BigInt(next.block) - 100n
          : 0n
        : BigInt(lastBlock) + 1n;
    if (start <= BigInt(next.block)) {
      try {
        const events = await g.events("0x" + start.toString(16), next.block);
        if (g !== gateway) return;
        feed = [...feed, ...events].slice(-30);
        lastBlock = next.block;
        showFeed();
      } catch {
        message(
          "World synchronized. Event trace unavailable; retrying on the next refresh.",
        );
      }
    }
    if (pending?.tx)
      message(
        "Action broadcast. Waiting for confirmation; the city will not change early.",
      );
  } catch (e) {
    message(
      "Room sync unavailable: " +
        e.message +
        ". Last confirmed state is preserved.",
    );
  } finally {
    polling = false;
    queueReceipt();
  }
}
function loop() {
  clearInterval(timer);
  timer = setInterval(poll, 5000 + Math.floor(Math.random() * 2000));
}
function queueStreamRefresh() {
  streamRefreshPending = true;
  if (streamRefreshTimer !== null) return;
  streamRefreshTimer = setTimeout(async () => {
    streamRefreshTimer = null;
    if (!streamRefreshPending) return;
    if (polling) {
      queueStreamRefresh();
      return;
    }
    streamRefreshPending = false;
    await poll();
    if (streamRefreshPending) queueStreamRefresh();
  }, 100);
}
function stopRoomStream() {
  roomStream?.stop();
  roomStream = null;
  streamRefreshPending = false;
  if (streamRefreshTimer !== null) {
    clearTimeout(streamRefreshTimer);
    streamRefreshTimer = null;
  }
}
async function join() {
  if (snapshot.phase === 3)
    throw Error("Mission timed out. Wait for the host to reset CITY ZERO.");
  if (mode === "practice") {
    actor = role;
    $("room-dialog").close();
    return;
  }
  if (mode === "local") {
    info.session = await localPost("api/join", { name: $("nickname").value });
    actor = info.session.address;
  } else {
    if (!window.ethereum)
      throw Error(
        "Open the invite in a wallet browser to build. Standard browsers can still spectate.",
      );
    if (
      (await window.ethereum.request({ method: "eth_chainId", params: [] })) !==
      MONAD.id
    )
      throw Error("Switch your wallet to Monad Testnet (10143)");
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
      params: [],
    });
    actor = accounts[0] ?? "";
    if (!/^0x[0-9a-f]{40}$/i.test(actor))
      throw Error("Test wallet is not authorized");
  }
  const joinedGateway = gateway,
    joinedActor = actor;
  const joinedState = await joinedGateway.read(joinedActor);
  if (joinedGateway !== gateway || joinedActor !== actor)
    throw Error("Room or wallet changed. Join the mission again.");
  snapshot = joinedState;
  clockSample = performance.now();
  render();
  $("room-dialog").close();
  message("加入成功。选择一个模块，完成你的第一步。");
}
async function submit() {
  if (snapshot.phase === 3) {
    message("Mission timeout. Ask the host to start a new run.");
    clearChoice();
    return;
  }
  if (busy || tourRunning || !choice) return;
  if (mode !== "practice" && !actor) {
    $("room-dialog").showModal();
    return;
  }
  const action = { ...choice };
  try {
    validateAction(
      snapshot,
      mode === "practice" ? role : actor,
      balance(),
      action,
    );
  } catch (e) {
    message(e.message);
    return;
  }
  if (mode === "practice") {
    try {
      world.apply(role, action);
      snapshot = world.snapshot();
      feed = world.trace.slice(-30).map((a, i) => ({
        ...a,
        revision: Math.max(
          1,
          world.revision - world.trace.slice(-30).length + 1 + i,
        ),
      }));
      clearChoice();
      render();
      message(
        snapshot.restored
          ? "CITY ZERO is online. Reclaim the turbine and restore the grid again."
          : "Deployment complete. Switch roles or invite a crew into an onchain room.",
      );
    } catch (e) {
      message(e.message);
    }
    return;
  }
  busy = true;
  render();
  message(
    mode === "local"
      ? "SUBMITTING TO LOCAL CHAIN…"
      : "WAITING FOR WALLET APPROVAL. TEST MON GAS ONLY.",
  );
  try {
    let tx;
    if (mode === "local") {
      const id = uuid();
      const send = () => localPost("api/action", action, id, info.instance);
      let response;
      try {
        response = await send();
      } catch (e) {
        if (
          e instanceof TypeError ||
          e.name === "TimeoutError" ||
          e.name === "AbortError"
        )
          response = await send();
        else throw e;
      }
      tx = response.tx;
    } else
      tx = await new CommunityGateway(
        (method, params) => window.ethereum.request({ method, params }),
        gateway.contract,
        MONAD.id,
        build.runtimeHash,
      ).submit(actor, action);
    pending = { tx, startedAt: Date.now() };
    savePending();
    clearChoice();
    message("已广播，等待链上确认。");
    await poll(true);
    queueReceipt();
  } catch (e) {
    busy = false;
    message(
      "ACTION NOT CONFIRMED: " +
        e.message +
        (mode === "monad"
          ? ". If the wallet broadcast it, check wallet activity before retrying."
          : ""),
    );
    render();
  }
}
async function quickContribution() {
  if (busy || tourRunning || snapshot.phase === 3 || snapshot.restored) return;
  const action = nextContribution(snapshot, activeCrew);
  if (!action) {
    message("这个小队的目标已经完成。选择另一个仍在闪烁的小队。");
    return;
  }
  if (mode === "practice") {
    role = { power: "A", habitat: "B", lifeline: "C" }[activeCrew];
    try {
      sessionStorage.setItem("genesis.role", role);
    } catch {}
  }
  choice = action;
  await submit();
}
async function openMonad(address) {
  const g = new CommunityGateway(
    publicRpc,
    address,
    MONAD.id,
    build.runtimeHash,
    publicBatchRpc,
  );
  await g.check();
  stopRoomStream();
  gateway = g;
  mode = "monad";
  actor = "";
  snapshot = { ...new Practice().snapshot(), block: null };
  lastBlock = null;
  lastRevision = -1;
  feed = [];
  info = null;
  pending = null;
  const url = new URL(location.href);
  url.searchParams.delete("local");
  url.searchParams.set("room", address);
  history.replaceState(null, "", url);
  try {
    pending = JSON.parse(sessionStorage.getItem(pendingKey()) ?? "null");
  } catch {}
  busy = !!pending;
  await poll();
  loop();
  roomStream = new MonadRoomStream(MONAD.ws, address, queueStreamRefresh);
  roomStream.start();
  invitations();
  $("room-dialog").close();
}
async function create() {
  if (!window.ethereum)
    throw Error("Creating a room requires a browser with an injected wallet");
  if (
    (await window.ethereum.request({ method: "eth_chainId", params: [] })) !==
    MONAD.id
  )
    throw Error("Switch your wallet to Monad Testnet first");
  const [from] = await window.ethereum.request({
    method: "eth_requestAccounts",
    params: [],
  });
  const tx = await window.ethereum.request({
    method: "eth_sendTransaction",
    params: [{ from, value: "0x0", data: build.creationBytecode }],
  });
  roomMessage("DEPLOYMENT BROADCAST: " + tx + ". WAITING FOR CONFIRMATION…");
  for (let i = 0; i < 60; i++) {
    const r = await window.ethereum.request({
      method: "eth_getTransactionReceipt",
      params: [tx],
    });
    if (r) {
      if (r.status !== "0x1")
        throw Error("Deployment failed. Check wallet activity");
      await openMonad(r.contractAddress);
      $("address").value = r.contractAddress;
      message("ROOM CONFIRMED. Invite the crew into CITY ZERO.");
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw Error(
    "Deployment is still pending. Find the contract address in wallet activity, then open the room after confirmation.",
  );
}
let settingUp = false;
function guarded(id, fn) {
  $(id).onclick = async () => {
    if (settingUp) return;
    if (busy) {
      message("Wait for the current transaction before changing rooms.");
      return;
    }
    settingUp = true;
    const controls = ["join", "open-room", "create-room", "restart-room"].map(
      $,
    );
    controls.forEach((b) => (b.disabled = true));
    try {
      await fn();
    } catch (e) {
      roomMessage(e.message);
      message(e.message);
    } finally {
      settingUp = false;
      controls.forEach((b) => (b.disabled = false));
    }
  };
}
for (const k of [2, 3, 4, 7, 1]) {
  const b = document.createElement("button");
  b.dataset.kind = k;
  b.innerHTML = `${k} · ${LABELS[k]}<small>${COST[k]} 建造额度</small>`;
  b.setAttribute("aria-pressed", String(k === selected));
  b.onclick = () => {
    selected = k;
    for (const c of $("palette").children)
      c.setAttribute("aria-pressed", String(+c.dataset.kind === k));
    clearChoice();
    message("已选择 " + LABELS[k] + "，请选择相邻地块。");
  };
  $("palette").append(b);
}
for (const crew of CREWS) {
  const button = document.createElement("button");
  button.dataset.crew = crew.id;
  button.innerHTML = `<b>${crew.label}</b><span>${crew.zh}</span>`;
  button.setAttribute("aria-pressed", String(crew.id === activeCrew));
  button.onclick = () => {
    activeCrew = crew.id;
    try {
      sessionStorage.setItem("genesis.crew", activeCrew);
    } catch {}
    renderCrewConsole();
    message(`${crew.zh}已就位。点击主按钮贡献下一步。`);
  };
  $("crews").append(button);
}
$("quick-action").onclick = quickContribution;
$("confirm").onclick = submit;
$("cancel").onclick = clearChoice;
$("rotate").onclick = () => {
  rotation = (rotation + 1) % 4;
  $("rotate").textContent = `旋转 R · ${rotation * 90}°`;
  if (choice?.type === "build") {
    choice.rotation = rotation;
    message("ORIENTATION UPDATED: " + rotation * 90 + "°");
  }
};
$("advanced").onclick = () => {
  advancedMode = !advancedMode;
  $("manual-tools").hidden = !advancedMode;
  $("advanced").textContent = advancedMode ? "退出高级建造" : "高级建造";
  clearChoice();
  message(
    advancedMode
      ? "高级建造已开启：选择模块，再点击相邻地块。"
      : "回到现场玩法：选择小队，一键贡献。",
  );
};
$("walk").onclick = () => {
  const walking = scene.toggleWalk();
  document.body.classList.toggle("walking", walking);
  $("walk").textContent = walking ? "返回组装" : "进入城市";
  message(
    walking
      ? "WASD to move, Space to jump, drag to look; use the touch pad on mobile."
      : "Select a module, choose a tile, confirm deployment.",
  );
};
for (const b of document.querySelectorAll("[data-move]")) {
  b.onpointerdown = (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    scene?.setKey(b.dataset.move, true);
  };
  b.onpointerup =
    b.onpointercancel =
    b.onlostpointercapture =
      () => scene?.setKey(b.dataset.move, false);
}
$("role").onclick = () => {
  role = ["A", "B", "C"][(["A", "B", "C"].indexOf(role) + 1) % 3];
  try {
    sessionStorage.setItem("genesis.role", role);
  } catch {
    /* role remains usable in memory */
  }
  clearChoice();
  render();
  message("练习角色 " + role + " 已启用；三个角色均由本机模拟。");
};
$("tour").onclick = async () => {
  if (world.trace.length || tourRunning) {
    message(
      "Mission preview needs an empty grid. Export the trace, then reset practice from the room menu.",
    );
    return;
  }
  tourRunning = true;
  render();
  try {
    for (const [a, cell, kind] of [
      ["A", 41, 2],
      ["B", 49, 3],
      ["C", 39, 4],
      ["B", 50, 3],
      ["C", 31, 7],
    ]) {
      world.apply(a, { type: "build", cell, kind, rotation: 0 });
      snapshot = world.snapshot();
      feed = world.trace.map((e, i) => ({ ...e, revision: i + 1 }));
      render();
      message(`练习角色 ${a} 部署了 ${LABELS[kind]}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
    message(
      "THREE ROLES BROUGHT CITY ZERO ONLINE. Keep building or create a real testnet room.",
    );
  } finally {
    tourRunning = false;
    render();
  }
};
function rememberBriefing() {
  try {
    localStorage.setItem(BRIEFING, "seen");
  } catch {
    /* the briefing remains dismissible when storage is blocked */
  }
}
function closeBriefing() {
  rememberBriefing();
  $("briefing-dialog").close();
}
$("help").onclick = () => $("briefing-dialog").showModal();
$("briefing-close").onclick = closeBriefing;
$("briefing-start").onclick = () => {
  closeBriefing();
  activeCrew = "power";
  renderCrewConsole();
  message("先选择 POWER，然后点击底部的大按钮。");
};
$("briefing-live").onclick = () => {
  closeBriefing();
  $("room-dialog").showModal();
};
$("menu").onclick = () => {
  $("room-dialog").showModal();
};
$("room-close").onclick = () => $("room-dialog").close();
$("invite-close").onclick = () => $("invite-dialog").close();
$("invite").onclick = () => {
  invitations();
  $("invite-dialog").showModal();
};
$("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("share-url").value);
    $("share-note").textContent = "INVITE LINK COPIED.";
  } catch {
    $("share-url").select();
    $("share-note").textContent = "PRESS AND HOLD THE INVITE URL TO COPY.";
  }
};
guarded("join", join);
guarded("open-room", () => openMonad($("address").value.trim()));
guarded("create-room", create);
guarded("restart-room", async () => {
  if (
    mode !== "local" ||
    actor?.toLowerCase() !== info.hostAddress?.toLowerCase()
  )
    throw Error("Only the local rehearsal host can start a new run");
  if (
    !confirm(
      "A new run replaces the live district for every participant. Export anything you need first. Continue?",
    )
  )
    return;
  await localPost("api/restart", {});
  location.reload();
});
$("practice").onclick = () => {
  const url = new URL("play.html", location.href);
  location.href = url.href;
};
$("reset-practice").onclick = () => {
  if (tourRunning) {
    roomMessage("Wait for the live mission to finish before resetting.");
    return;
  }
  if (mode !== "practice") {
    roomMessage("Onchain rooms cannot be cleared from the browser.");
    return;
  }
  if (
    (world.trace.length || !practicePersistence) &&
    !confirm("Reset local practice? Export any trace you want to keep first.")
  )
    return;
  practicePersistence = true;
  world = new Practice();
  snapshot = world.snapshot();
  feed = [];
  lastRevision = -1;
  clearChoice();
  render();
  $("room-dialog").close();
};
$("download").onclick = () => {
  const payload =
    mode === "practice"
      ? world.export()
      : JSON.stringify(
          {
            format: "genesis.community.snapshot",
            version: 1,
            mode,
            chainId: gateway.chainId,
            contract: gateway.contract,
            block: snapshot.block,
            revision: snapshot.revision,
            kinds: snapshot.kinds,
            rotations: snapshot.rotations,
            builders: snapshot.owners,
            active: [...snapshot.active],
            restored: snapshot.restored,
            events: feed,
          },
          null,
          2,
        );
  const url = URL.createObjectURL(
      new Blob([payload], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "genesis-community.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
document.addEventListener("keydown", (e) => {
  if (
    e.repeat ||
    e.target.closest?.("input,button,a") ||
    document.querySelector("dialog[open]")
  )
    return;
  if (e.key.toLowerCase() === "r") $("rotate").click();
  if (+e.key >= 1 && +e.key <= 7)
    document.querySelector(`[data-kind="${+e.key}"]`)?.click();
  if (e.key === "Escape") clearChoice();
});
window.addEventListener("storage", (e) => {
  if (mode === "practice" && e.key === STORAGE && e.newValue) {
    try {
      world = Practice.restore(e.newValue);
      snapshot = world.snapshot();
      lastRevision = -1;
      render();
    } catch {
      message(
        "Another practice window sent an invalid trace. Current state is preserved.",
      );
    }
  }
});
window.ethereum?.on?.("accountsChanged", () => {
  actor = "";
  if (mode === "monad") {
    message("Wallet account changed. Join the room again.");
    render();
  }
});
window.ethereum?.on?.("chainChanged", () => {
  if (mode === "monad") {
    actor = "";
    message("Wallet network changed. Check the network and rejoin.");
    render();
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) poll();
});
window.addEventListener("beforeunload", stopRoomStream);
async function boot() {
  try {
    try {
      const saved = localStorage.getItem(STORAGE);
      if (saved) world = Practice.restore(saved);
    } catch {
      practicePersistence = false;
      message(
        "Practice trace was not loaded. Original storage is preserved and autosave is disabled; export or explicitly reset to continue.",
      );
    }
    snapshot = world.snapshot();
    scene = mount($("scene"), selectCell);
    render();
    build = await fetch(new URL("./build.json", import.meta.url)).then((r) => {
      if (!r.ok) throw Error("Room contract bundle failed to load");
      return r.json();
    });
    if (query.has("room")) {
      await openMonad(query.get("room"));
      $("address").value = gateway.contract;
    } else {
      try {
        const r = await fetch("api/info", {
          signal: AbortSignal.timeout(1500),
        });
        if (r.ok) {
          const d = await r.json();
          if (d.mode === "anvil-local") {
            info = d;
            mode = "local";
            gateway = new CommunityGateway(
              localRequest,
              d.contract,
              d.chainId,
              build.runtimeHash,
            );
            await gateway.check();
            actor = d.session?.address ?? "";
            snapshot = { ...new Practice().snapshot(), block: null };
            lastRevision = -1;
            lastBlock = null;
            await poll();
            try {
              pending = JSON.parse(
                sessionStorage.getItem(pendingKey()) ?? "null",
              );
              busy = !!pending;
            } catch {}
            loop();
          }
        }
      } catch (error) {
        if (query.has("local") || mode === "local")
          throw Error(
            "Local room service is offline. Ask the host to run python -m genesis.live.",
          );
      }
    }
    invitations();
    render();
    if (wall) $("wall-invite").hidden = false;
    const needsRoom =
        query.has("create") || (mode === "local" && !actor && !wall),
      briefingSeen = (() => {
        try {
          return localStorage.getItem(BRIEFING) === "seen";
        } catch {
          return false;
        }
      })();
    if (
      !wall &&
      !needsRoom &&
      mode === "practice" &&
      !query.has("room") &&
      !briefingSeen
    )
      $("briefing-dialog").showModal();
    else if (needsRoom) $("room-dialog").showModal();
  } catch (e) {
    message(e.message);
    $("mode").textContent = "ROOM CONNECTION FAILED";
    roomMessage(e.message);
    $("room-dialog").showModal();
  }
}
window.addEventListener(
  "pagehide",
  () => {
    stopRoomStream();
    clearInterval(timer);
    clearInterval(clockTimer);
    clearTimeout(receiptTimer);
    scene?.dispose();
  },
  { once: true },
);
window.addEventListener("pageshow", (e) => {
  if (e.persisted) location.reload();
});
void boot();
