import qrcode from "../vendor/qrcode.mjs";
import { MONAD, publicRpc } from "../community/gateway.js";
import { ADDRESS, GarageRegistry, versionId } from "./chain.js";
import { BUDGET, MOTORS, TIRES, SECTIONS, STOCK, cost, key, parseBuild, score, trackPosition } from "./rules.js";
import { makeScene } from "./scene.js";

const $ = (id) => document.getElementById(id);
const scene = makeScene($("scene"));
const query = new URLSearchParams(location.search);
const wallMode = query.get("wall") === "1";
const linkBuild = query.get("build");
const sharedBuild = query.get("v") === "1" ? parseBuild(linkBuild) : null;
const parts = [
  { slot: "motor", name: "电机", options: MOTORS },
  { slot: "tires", name: "轮胎", options: TIRES },
];
const add = (parent, tag, text, className) => {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  parent.append(element);
  return element;
};

let reference = sharedBuild ?? STOCK;
let loadout = { ...reference, boost: 0 };
let run = null;
let result = null;
let registry = null;
let eventMode = null;
let parentVersion = 0n;
let pending = null;
let publishing = false;
let sectorIndex = -1;
let liftFrame = 0;

const sectors = SECTIONS.map(({ name }) => add($("sectors"), "li", name));
for (const part of parts) {
  const field = add($("parts"), "fieldset");
  add(field, "legend", part.name);
  const options = add(field, "div", "", "part-options");
  part.buttons = part.options.map(({ name, cost: price }, id) => {
    const button = add(options, "button", "", "part");
    button.type = "button";
    add(button, "strong", name);
    add(button, "small", `${price} 点`);
    button.addEventListener("click", () => {
      if (run || result || loadout[part.slot] === id || cost({ ...loadout, [part.slot]: id }) > BUDGET) return;
      const previous = loadout;
      loadout = { ...loadout, [part.slot]: id };
      updateOptions();
      $("status").textContent = `${part.options[previous[part.slot]].name}已拆下，${name}已装上。`;
      changeAnimation(previous, part.slot);
    });
    return button;
  });
  part.note = add(field, "p", "", "part-note");
}

function seconds(milliseconds) { return (milliseconds / 1000).toFixed(3); }
function delta(milliseconds) { return `${milliseconds > 0 ? "+" : ""}${seconds(milliseconds)}s`; }

function qrMarkup(url) {
  const qr = qrcode(0, "M");
  qr.addData(url.href);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
}

function renderWall(records, champion, challengeUrl) {
  if (!wallMode) return;
  $("arena-board").hidden = false;
  $("wall-champion").textContent = `V${champion}`;
  $("wall-qr").innerHTML = qrMarkup(challengeUrl);
  $("challenge-tree").replaceChildren();
  for (const record of records) {
    const car = add($("challenge-tree"), "div", `V${record.version}`, "tree-car");
    if (record.beatParent) car.classList.add("won");
    if (record.version === champion) car.classList.add("champion");
    add(car, "small", record.version === 0n ? "初代 · 13.950s" : `← V${record.parent} · ${seconds(record.timeMs)}s`);
  }
}

function timeText(target, ms) {
  const units = document.createElement("span");
  units.textContent = "s";
  target.replaceChildren(seconds(ms), units);
}

function updateOptions() {
  $("budget").textContent = `${cost(loadout)} / ${BUDGET} 点`;
  for (const part of parts) {
    part.note.textContent = part.options[loadout[part.slot]].note;
    part.buttons.forEach((button, id) => {
      button.setAttribute("aria-pressed", String(loadout[part.slot] === id));
      button.disabled = cost({ ...loadout, [part.slot]: id }) > BUDGET;
      button.title = button.disabled ? "超出改装预算" : part.options[id].note;
    });
  }
}

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
function changeAnimation(previous, slot) {
  cancelAnimationFrame(liftFrame);
  if (reducedMotion.matches) {
    scene.workshop(loadout);
    return;
  }
  const start = performance.now();
  const next = loadout;
  function frame(now) {
    const progress = Math.min((now - start) / 420, 1);
    scene.workshop(progress < 0.5 ? previous : next, slot, Math.sin(progress * Math.PI) * 32);
    if (progress < 1) liftFrame = requestAnimationFrame(frame);
  }
  liftFrame = requestAnimationFrame(frame);
}

function garage() {
  result = null;
  $("panel-title").textContent = "改装台";
  $("scene-label").textContent = "PIT · 改装台";
  $("scene").setAttribute("aria-label", "霓虹工坊里待改装的越野车");
  $("parts").hidden = false;
  $("budget").hidden = false;
  $("race").hidden = true;
  $("result").hidden = true;
  $("run").hidden = false;
  $("retry").hidden = true;
  $("share").hidden = true;
  $("boost").hidden = true;
  $("invite").hidden = false;
  $("status").textContent = "";
  showSector(-1);
  updateOptions();
  updatePublish();
  scene.workshop(loadout);
}

function showSector(index) {
  sectorIndex = index;
  sectors.forEach((sector, i) => {
    if (i === index) sector.setAttribute("aria-current", "step");
    else sector.removeAttribute("aria-current");
  });
  if (index < 0) return;
  $("race-section").textContent = SECTIONS[index].name;
  $("race-hint").textContent = run.build.boost
    ? `冲刺已用在${SECTIONS[run.build.boost - 1].name}。`
    : index === 1 ? "积水弯冲刺容易打滑。" : "整圈只有一次冲刺。";
}

// Screen playback is accelerated. The scored inputs are the parts and the chosen sector.
const PLAYBACK_SPEED = 1.55;

function frame(now) {
  const elapsed = Math.max(0, (now - run.startedAt) * PLAYBACK_SPEED);
  const { splits, ms } = score(run.build);
  const player = trackPosition(splits, elapsed);
  const ghost = trackPosition(run.reference.splits, elapsed);
  const next = Math.min(SECTIONS.length - 1, Math.floor(player));
  if (next !== sectorIndex) showSector(next);
  $("boost").disabled = run.build.boost !== 0 || player >= SECTIONS.length;
  timeText($("time"), Math.min(ms, Math.round(elapsed)));
  scene.course(reducedMotion.matches ? Math.floor(player) : player,
    reducedMotion.matches ? Math.floor(ghost) : ghost,
    run.build, reference, elapsed, elapsed < run.flashUntil);

  if (elapsed < Math.max(ms, run.reference.ms)) requestAnimationFrame(frame);
  else finish(run.build, { splits, ms });
}

function start() {
  if (run || publishing) return;
  cancelAnimationFrame(liftFrame);
  run = { build: { ...loadout, boost: 0 }, reference: score(reference), startedAt: performance.now(), flashUntil: 0 };
  $("panel-title").textContent = "擂台赛";
  $("scene-label").textContent = "LIVE · 挑战中";
  $("scene").setAttribute("aria-label", "紫色挑战车与灰色擂主车同屏比赛");
  $("parts").hidden = true;
  $("budget").hidden = true;
  $("run").hidden = true;
  $("invite").hidden = true;
  $("race").hidden = false;
  $("boost").disabled = false;
  $("boost").hidden = false;
  $("status").textContent = "";
  showSector(0);
  $("boost").focus({ preventScroll: true });
  requestAnimationFrame(frame);
}

function boost() {
  if (!run || run.build.boost !== 0) return;
  const elapsed = (performance.now() - run.startedAt) * PLAYBACK_SPEED;
  const actualSector = Math.floor(trackPosition(score(run.build).splits, elapsed));
  if (actualSector >= SECTIONS.length) return;
  run.build.boost = actualSector + 1;
  run.flashUntil = elapsed + 950;
  showSector(actualSector);
  $("boost").disabled = true;
  $("status").textContent = `冲刺：${SECTIONS[actualSector].name}`;
}

function finish(build, lap) {
  const against = run.reference;
  result = { build, version: null };
  run = null;
  const diff = lap.ms - against.ms;
  $("panel-title").textContent = diff < 0 ? "挑战成功" : "挑战失败";
  $("scene-label").textContent = "FINISH · 完赛";
  $("race").hidden = true;
  $("boost").hidden = true;
  $("result").hidden = false;
  $("retry").hidden = false;
  $("share").hidden = false;
  $("status").textContent = "";
  $("splits").replaceChildren();
  $("verdict").textContent = diff === 0 ? "打平也不能夺擂" :
    `${diff < 0 ? "跑赢擂主" : "未能夺擂"} · ${diff < 0 ? "快" : "慢"} ${seconds(Math.abs(diff))} 秒`;
  $("verdict").classList.toggle("slower", diff >= 0);
  timeText($("result-time"), lap.ms);
  lap.splits.forEach((ms, i) => {
    const change = ms - against.splits[i];
    const row = add($("splits"), "li");
    add(row, "span", SECTIONS[i].name);
    add(row, "strong", delta(change), change < 0 ? "faster" : change > 0 ? "slower" : "");
  });
  updatePublish();
  $("retry").focus({ preventScroll: true });
}

function share(build, version) {
  const url = eventMode?.shareUrl
    ? new URL(eventMode.shareUrl)
    : registry && version !== null ? versionLink(version) : new URL("garage.html", location.href);
  url.searchParams.delete("wall");
  if (!url.searchParams.has("registry")) {
    if (!eventMode) {
      url.searchParams.set("v", "1");
      url.searchParams.set("build", key(build));
    }
  }
  $("qr").innerHTML = qrMarkup(url);
  $("share-link").value = url.href;
  $("share-status").textContent = "";
  $("share-dialog").showModal();
}

function versionLink(version) {
  const url = new URL("garage.html", location.href);
  url.searchParams.set("registry", registry.address);
  url.searchParams.set("version", version.toString());
  return url;
}

function updatePublish() {
  const changed = result && key(result.build) !== key(reference);
  $("publish").hidden = !registry || (!result && !pending);
  $("publish").disabled = publishing || !registry || (!pending && (!changed || result.version !== null));
  $("publish").textContent = pending ? "查询链上确认" : eventMode ? "免钱包提交到 Monad" : "用测试钱包提交";
  $("retry").disabled = publishing;
}

async function loadRegistry(address, id) {
  // A link can choose an address and version, but the page always pins the network and bytecode.
  if (!ADDRESS.test(address)) throw Error("无效工坊合约地址");
  const response = await fetch(new URL("./build.json", import.meta.url));
  if (!response.ok) throw Error("无法加载工坊合约配置");
  const gateway = new GarageRegistry(publicRpc, address, MONAD.id, await response.json());
  await gateway.check();
  const version = id === "champion" ? await gateway.champion() : versionId(id);
  const [record, champion, count] = await Promise.all([gateway.read(version), gateway.champion(), gateway.count()]);
  registry = gateway;
  parentVersion = record.version;
  reference = record.build;
  loadout = { ...reference, boost: 0 };
  $("mode").textContent = "MONAD TESTNET";
  $("ghost-label").textContent = record.version === champion ? `擂主 V${parentVersion}` : `历史车 V${parentVersion}`;
  $("chain-status").textContent = record.version === champion ? "已载入当前擂主。" : `这是一辆历史车；当前擂主是 V${champion}。`;
  $("version-details").hidden = false;
  $("version-number").textContent = `V${parentVersion}`;
  $("version-score").textContent = `${seconds(record.timeMs)}s`;
  $("version-author").textContent = record.version === 0n ? "原装车" : record.author;
  $("champion-version").href = versionLink(champion).href;
  $("champion-version").textContent = `打开当前擂主 V${champion}`;
  $("champion-version").hidden = record.version === champion;
  if (record.version > 0n) {
    $("parent-version").href = versionLink(record.parent).href;
    $("parent-version").textContent = `改自 V${record.parent}`;
    $("parent-version").hidden = false;
  }
  $("champion-version").href = versionLink(champion).href;
  $("champion-version").textContent = `当前擂主 V${champion}`;
  $("champion-version").hidden = record.version === champion;
  if (wallMode) {
    const first = count > 24n ? count - 24n : 0n;
    const records = await Promise.all(Array.from({ length: Number(count - first) }, (_, index) => gateway.read(first + BigInt(index))));
    renderWall(records, champion, versionLink(champion));
  }
  garage();
}

async function loadDefaultRegistry() {
  const response = await fetch(new URL("./deployment.json", import.meta.url), { cache: "no-store" });
  if (!response.ok) return;
  const deployment = await response.json();
  if (deployment.chainId !== MONAD.id || !deployment.registry) return;
  if (!ADDRESS.test(deployment.registry)) throw Error("默认擂台地址无效");
  $("registry").value = deployment.registry;
  $("registry-form").closest("details").open = true;
  $("chain-status").textContent = "正在进入 Monad 擂台…";
  $("run").disabled = true;
  try {
    await loadRegistry(deployment.registry, "champion");
    $("version-input").value = parentVersion.toString();
  } finally {
    $("run").disabled = false;
  }
}

async function eventRequest(path, options = {}) {
  const response = await fetch(path, options);
  let body = {};
  try { body = await response.json(); } catch { /* a missing relay falls back to wallet mode */ }
  if (!response.ok) throw Error(body.error || `现场中继返回 ${response.status}`);
  return body;
}

async function loadEventMode() {
  let info;
  try {
    const response = await fetch("/api/garage/info", { cache: "no-store" });
    if (!response.ok) return false;
    info = await response.json();
  } catch {
    return false;
  }
  if (info.mode !== "monad-event-relay" || info.chainId !== MONAD.id || !ADDRESS.test(info.contract) ||
      !ADDRESS.test(info.relayer) || typeof info.instance !== "string") return false;
  await eventRequest("/api/garage/join", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  eventMode = info;
  await loadRegistry(info.contract, "champion");
  $("mode").textContent = "MONAD EVENT · 免钱包";
  $("chain-status").textContent = "活动方赞助测试网 Gas；合约判定擂主。";
  if (wallMode && info.shareUrl) {
    const challenge = new URL(info.shareUrl);
    challenge.searchParams.delete("wall");
    $("wall-qr").innerHTML = qrMarkup(challenge);
  }
  return true;
}

async function submitEventChallenge(build, requestId) {
  const options = {
    method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestId, "X-Garage-Instance": eventMode.instance },
    body: JSON.stringify({ parent: Number(parentVersion), motor: build.motor, tires: build.tires, boost: build.boost }),
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await eventRequest("/api/garage/challenge", options); }
    catch (error) {
      if (!(error instanceof TypeError) || attempt === 1) throw error;
    }
  }
}

async function publish() {
  if (publishing || !registry || (!pending && !result)) return;
  publishing = true;
  updatePublish();
  try {
    if (!pending) {
      const build = result.build;
      let hash, from;
      if (eventMode) {
        $("chain-status").textContent = "活动方正在赞助本次挑战…";
        const submitted = await submitEventChallenge(build, crypto.randomUUID());
        hash = submitted.tx;
        from = eventMode.relayer;
      } else {
        const wallet = window.ethereum;
        if (!wallet?.request) throw Error("请使用现场二维码免钱包参与，或在测试钱包浏览器中打开");
        $("chain-status").textContent = "请在钱包中确认测试网账号和交易。";
        const accounts = await wallet.request({ method: "eth_requestAccounts" });
        if (await wallet.request({ method: "eth_chainId" }) !== MONAD.id) {
          await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: MONAD.id }] });
        }
        if (await wallet.request({ method: "eth_chainId" }) !== MONAD.id) throw Error("请切换到 Monad Testnet");
        [from] = await wallet.request({ method: "eth_accounts" });
        if (!accounts.length || !from) throw Error("未连接测试钱包账号");
        const tx = registry.transaction(from, parentVersion, build);
        hash = await wallet.request({ method: "eth_sendTransaction", params: [tx] });
      }
      if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw Error("没有返回有效交易哈希");
      pending = { hash, from, parent: parentVersion, build, broadcastAt: performance.now(), result };
      $("transaction").href = `${MONAD.explorer}/tx/${hash}`;
      $("transaction").hidden = false;
    }
    $("chain-status").textContent = "已广播，等待最终确认。";
    for (let i = 0; i < 15; i++) {
      const confirmed = await registry.confirmed(pending.hash, pending);
      if (confirmed) {
        const elapsed = Math.round(performance.now() - pending.broadcastAt);
        pending.result.version = confirmed.version;
        $("published-version").href = versionLink(confirmed.version).href;
        $("published-version").textContent = `打开 V${confirmed.version}`;
        $("published-version").hidden = false;
        const outcome = confirmed.promoted ? "挑战成功，成为新擂主" :
          confirmed.beatParent ? "跑赢了这辆车，但当前擂主已变化；成绩保留" : "未跑赢，成绩保留";
        $("chain-status").textContent = `${outcome} · V${confirmed.version} · 确认 ${elapsed} ms`;
        pending = null;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    $("chain-status").textContent = "仍在等待，可查询本笔交易的确认结果。";
  } catch (error) {
    if (error.code === "GARAGE_REVERTED") pending = null;
    $("chain-status").textContent = error.message || "无法读取交易结果";
  } finally {
    publishing = false;
    updatePublish();
  }
}

$("run").addEventListener("click", start);
$("boost").addEventListener("click", boost);
$("retry").addEventListener("click", () => { garage(); $("run").focus({ preventScroll: true }); });
$("invite").addEventListener("click", () => share(reference, registry ? parentVersion : null));
$("share").addEventListener("click", () => share(result.build, result.version));
$("publish").addEventListener("click", publish);
$("registry-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const url = new URL("garage.html", location.href);
  url.searchParams.set("registry", $("registry").value.trim());
  try {
    url.searchParams.set("version", versionId($("version-input").value).toString());
  } catch (error) {
    $("chain-status").textContent = error.message;
    return;
  }
  location.assign(url.href);
});
$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("share-link").value);
    $("share-status").textContent = "链接已复制";
  } catch {
    $("share-link").focus();
    $("share-link").select();
    $("share-status").textContent = "请复制选中的挑战链接";
  }
});
window.addEventListener("keydown", (event) => {
  if (event.code === "Space" && run && !event.repeat && !event.target.closest("input, textarea, button, summary, a")) {
    event.preventDefault();
    boost();
  }
});

garage();
if (wallMode && !query.has("registry")) {
  const challenge = new URL("garage.html", location.href);
  challenge.searchParams.delete("wall");
  renderWall([{ version: 0n, parent: 0n, timeMs: score(STOCK).ms, beatParent: false }], 0n, challenge);
}
if (sharedBuild) $("ghost-label").textContent = "好友擂主车";
if (linkBuild && !sharedBuild) $("status").textContent = "挑战链接无效，已载入原装车。";
if (query.has("registry")) {
  $("registry-form").closest("details").open = true;
  $("registry").value = query.get("registry");
  $("version-input").value = query.get("version") ?? "0";
  $("chain-status").textContent = "读取链上车辆…";
  $("run").disabled = true;
  loadRegistry($("registry").value, $("version-input").value)
    .catch((error) => { $("chain-status").textContent = error.message; })
    .finally(() => { $("run").disabled = false; });
} else {
  loadEventMode().then((loaded) => loaded || loadDefaultRegistry())
    .catch((error) => { $("chain-status").textContent = error.message; });
}
