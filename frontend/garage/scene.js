const WIDTH = 400, HEIGHT = 225;
const PURPLE = ["#a18bff", "#6f4bf1", "#43218e"];
const MOTORS = ["#ffb682", "#72e8bf", "#f7d271"];

export function makeScene(canvas) {
  const ctx = canvas.getContext("2d");
  const rect = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };

  function shape(points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fill();
  }

  function buggy(x, y, scale, build, { ghost = false, selected = "", lift = 0 } = {}) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    ctx.globalAlpha = ghost ? 0.68 : 1;
    const [light, mid, dark] = ghost ? ["#d0c8e5", "#88809b", "#4b4361"] : PURPLE;
    const rubber = ["#262738", "#3c4161", "#55426a"][build.tires];
    rect(-75, 25, 151, 8, "#0b0714");
    shape([[-74, 0], [-68, -19], [-28, -21], [-10, -49], [29, -49], [49, -21], [70, -19], [81, -7], [81, 13], [74, 20], [-77, 20], [-81, 11]], "#120b21");
    shape([[-75, 0], [-64, -14], [-25, -15], [-6, -43], [27, -43], [46, -16], [68, -14], [76, -5], [76, 13], [-76, 13]], mid);
    shape([[-18, -15], [-2, -36], [25, -36], [41, -15]], "#1a142b");
    shape([[-16, -16], [-2, -34], [13, -34], [4, -16]], "#54467e");
    rect(-10, -44, 40, 4, light);
    rect(-66, -15, 39, 4, light);
    rect(46, -16, 23, 4, light);
    rect(-74, 6, 149, 9, dark);
    rect(-37, -3, 75, 3, light);
    rect(34, 2, 17, 7, "#201436");
    rect(-73, -9, 8, 5, "#f16b95");
    rect(68, -8, 9, 5, "#e6ff9a");
    rect(74, 4, 10, 5, "#aeb4c5");
    rect(-81, 3, 10, 5, "#aeb4c5");

    const engineY = -23 - (selected === "motor" ? lift : 0);
    rect(-63, engineY, 30, 14, "#111020");
    rect(-61, engineY + 2, 26, 7, ghost ? "#cbc4d8" : MOTORS[build.motor]);
    for (let i = 0; i < 3 + build.motor; i++) rect(-59 + i * 5, engineY + 3, 2, 9, "#312338");
    const offset = selected === "tires" ? lift / 2 : 0;
    for (const wheel of [-49 - offset, 52 + offset]) {
      shape([[wheel - 13, 2], [wheel + 13, 2], [wheel + 19, 8], [wheel + 19, 25], [wheel + 13, 31], [wheel - 13, 31], [wheel - 19, 25], [wheel - 19, 8]], "#100d19");
      rect(wheel - 14, 6, 28, 22, rubber);
      rect(wheel - 8, 10, 16, 15, "#161225");
      rect(wheel - 5, 13, 10, 9, light);
      rect(wheel - 2, 15, 4, 5, dark);
      if (build.tires === 1) rect(wheel - 12, 7, 3, 19, "#7fbfd3");
      if (build.tires === 2) for (let i = -12; i <= 12; i += 6) rect(wheel + i, 3, 3, 4, "#cfb8ed");
    }
    ctx.restore();
  }

  function workshop(build, part, lift) {
    rect(0, 0, WIDTH, HEIGHT, "#100d1b");
    rect(0, 47, WIDTH, 113, "#1d172a");
    rect(0, 101, WIDTH, 59, "#221832");
    rect(0, 155, WIDTH, 70, "#161122");
    rect(0, 155, WIDTH, 2, "#685271");
    for (let row = 173; row < 225; row += (row - 144) / 3) rect(0, row, WIDTH, 1, "#2d223a");
    for (let x = -80; x < 480; x += 42) shape([[200 + (x - 200) * .5, 156], [x + 2, 225], [x, 225]], "#2e223c");
    rect(112, 62, 178, 71, "#100c1a");
    rect(117, 67, 168, 61, "#33224a");
    for (let x = 120; x < 284; x += 12) {
      const h = 14 + (x * 13 % 32);
      rect(x, 126 - h, 9, h, "#201633");
      rect(x + 2, 129 - h, 2, 2, "#a873a1");
    }
    for (const x of [158, 200, 241]) rect(x, 65, 3, 66, "#140f20");
    for (const x of [16, 96, 296, 376]) {
      rect(x, 38, 9, 119, "#2b203b");
      rect(x + 7, 38, 2, 119, "#4d355d");
    }
    rect(47, 43, 306, 5, "#402a53");
    rect(115, 44, 170, 2, "#8b62cb");
    rect(140, 47, 120, 2, "#c9a8ff");
    rect(26, 116, 59, 24, "#381f34");
    rect(23, 115, 65, 3, "#8f5573");
    for (const y of [121, 128, 135]) rect(29, y, 45, 1, "#b9688e");
    rect(323, 98, 41, 47, "#29213e");
    rect(326, 102, 35, 21, "#131022");
    rect(330, 107, 19, 2, "#9be2c1");
    rect(330, 112, 13, 2, "#668e85");
    rect(329, 130, 23, 2, "#816c9b");
    shape([[134, 155], [269, 155], [342, 190], [58, 190]], "#33244c");
    shape([[58, 190], [342, 190], [352, 197], [48, 197]], "#b288f3");
    rect(49, 197, 302, 4, "#3e2c5a");
    for (let x = 64; x < 96; x += 8) rect(x, 182, 4, 2, "#e7c083");
    for (let x = 304; x < 336; x += 8) rect(x, 182, 4, 2, "#e7c083");
    buggy(201, 143, 1.27, build, { selected: part, lift });
  }

  function course(player, reference, build, ghost, elapsed, boosted) {
    rect(0, 0, WIDTH, HEIGHT, "#151122");
    rect(0, 52, WIDTH, 83, "#291b39");
    rect(302, 28, 23, 23, "#c3839f");
    for (let y = 32; y < 51; y += 7) rect(302, y, 23, 2, "#1f142e");
    for (let x = 0; x < WIDTH; x += 15) {
      const h = 8 + (x * 17 % 35);
      rect(x, 106 - h, 13, h, "#181328");
      if (x % 4) rect(x + 3, 110 - h, 6, 1, "#b68ba3");
    }
    rect(0, 104, WIDTH, 11, "#161122");
    rect(0, 115, WIDTH, 77, "#302844");
    rect(134, 116, 130, 75, "#352e51");
    rect(269, 116, 131, 75, "#443044");
    for (let x = 148; x < 264; x += 13) rect(x, 134 + (x * 3 % 49), 12, 1, "#7a679b");
    for (let x = 274; x < 386; x += 11) rect(x, 130 + (x * 3 % 47), 3, 2, "#9e777c");
    for (let x = 12; x < WIDTH; x += 17) rect(x, 151, 9, 2, "#8a789b");
    for (const x of [27, 382]) for (let i = 0; i < 22; i++) {
      rect(x + 3 * (i % 2), 116 + i * 3, 3, 3, "#ded4ee");
    }
    for (const x of [134, 264]) for (let y = 121; y < 190; y += 8) rect(x, y, 1, 3, "#ae8dde");
    rect(0, 191, WIDTH, 2, "#9172be");
    rect(0, 193, WIDTH, 32, "#171220");
    const position = (p) => 31 + (p / 3) * 340;
    buggy(position(reference), 132, 0.39, ghost, { ghost: true });
    if (boosted) {
      const x = position(player);
      rect(x - 43, 168, 14, 3, "#c7ff7e");
      rect(x - 48, 171, 17, 2, "#e5a9ff");
    }
    buggy(position(player), 170, 0.49, build);
    if (player >= 1 && player < 2 && build.tires === 0) {
      for (let i = 0; i < 4; i++) rect(position(player) - 40 - i * 6, 180 + ((elapsed / 110 + i * 3) % 7), 5, 1, "#ac9cd2");
    }
  }

  return { workshop, course };
}
