export const BUDGET = 5;
export const MOTORS = [
  { name: "旧电机", en: "Stock", cost: 1, note: "均衡", splits: [0, 0, 0] },
  { name: "扭矩电机", en: "Torque", cost: 2, note: "爬坡快 · 起步慢", splits: [220, 90, -720] },
  { name: "涡轮电机", en: "Turbo", cost: 3, note: "直线快 · 湿地易滑", splits: [-750, 480, -280] },
];
export const TIRES = [
  { name: "公路胎", en: "Street", cost: 1, note: "直线快 · 雨天打滑", splits: [-150, 550, 180] },
  { name: "雨地胎", en: "Rain", cost: 2, note: "湿弯稳 · 碎石慢", splits: [100, -650, 220] },
  { name: "钉齿胎", en: "Claw", cost: 3, note: "碎石抓地 · 直线慢", splits: [360, -300, -390] },
];
export const SECTIONS = [
  { name: "码头直道", en: "DOCK STRAIGHT", base: 4200, boost: -530 },
  { name: "积水弯", en: "FLOODED TURN", base: 5100, boost: 420 },
  { name: "碎石坡", en: "SCRAP CLIMB", base: 4600, boost: -850 },
];
export const STOCK = Object.freeze({ motor: 0, tires: 0, boost: 1 });

export function cost({ motor, tires }) {
  return (MOTORS[motor]?.cost ?? Infinity) + (TIRES[tires]?.cost ?? Infinity);
}

export function validBuild(build) {
  return !!build && Number.isInteger(build.motor) && build.motor >= 0 && build.motor < MOTORS.length &&
    Number.isInteger(build.tires) && build.tires >= 0 && build.tires < TIRES.length &&
    Number.isInteger(build.boost) && build.boost >= 0 && build.boost <= SECTIONS.length && cost(build) <= BUDGET;
}

export function key(build) {
  if (!validBuild(build)) throw Error("Invalid garage build");
  return `${build.motor}${build.tires}${build.boost}`;
}

export function parseBuild(value) {
  if (typeof value !== "string" || !/^[0-2][0-2][0-3]$/.test(value)) return null;
  const [motor, tires, boost] = Array.from(value, Number);
  const build = { motor, tires, boost };
  return validBuild(build) ? build : null;
}

export function score(build) {
  if (!validBuild(build)) throw Error("Invalid garage build");
  const splits = SECTIONS.map((section, i) => section.base + MOTORS[build.motor].splits[i] +
    TIRES[build.tires].splits[i] + (build.boost === i + 1 ? section.boost : 0));
  return { splits, ms: splits.reduce((sum, value) => sum + value, 0) };
}

export function trackPosition(splits, elapsed) {
  let remaining = Math.max(elapsed, 0);
  for (let i = 0; i < splits.length; i++) {
    if (remaining < splits[i]) return i + remaining / splits[i];
    remaining -= splits[i];
  }
  return splits.length;
}
