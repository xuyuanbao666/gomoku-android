const fs = require('fs');

const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'gomoku.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) throw new Error('script not found');
let code = m[1];

const hook = `
  global.__T = {
    place: place, undo: undo, reset: resetGame, aiMove: aiMove,
    setDelay: function (v) { AI_DELAY = v; },
    setLevel: function (v) { level = v; },
    setCur: function (v) { cur = v; },
    setPos: function (x, y, c) { board[y][x] = c; history.push({ x: x, y: y, p: c }); },
    clearAll: function () { freshBoard(); history = []; winCells = []; over = false; cur = BLACK; thinking = false; overlay.classList.add('hidden'); },
    board: function () { return board; },
    cur: function () { return cur; },
    over: function () { return over; },
    thinking: function () { return thinking; },
    hist: function () { return history; },
    win: function () { return winCells; },
    scores: function () { return scores; },
    mode: function () { return mode; },
    level: function () { return level; },
    cellScore: cellScore, ownValue: ownValue, checkWin: checkWin
  };
})();
`;
if (!/\}\)\(\);\s*$/.test(code)) throw new Error('tail not found');
code = code.replace(/\}\)\(\);\s*$/, hook);

/* ---- DOM stubs ---- */
function makeEl(id) {
  const e = {
    id, style: {}, listeners: {},
    classList: { s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, contains(c) { return this.s.has(c); } },
    addEventListener(t, f) { this.listeners[t] = f; },
    textContent: '', innerHTML: '', disabled: false,
    clientWidth: 360, clientHeight: 520
  };
  return e;
}
const ctx = new Proxy({}, {
  get(t, p) {
    if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (p in t) return t[p];
    return function () {};
  },
  set(t, p, v) { t[p] = v; return true; }
});
const els = {};
const canvas = makeEl('board');
canvas.getContext = () => ctx;
canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 360, height: 360 });
els['board'] = canvas;

global.document = {
  getElementById(id) { return els[id] || (els[id] = makeEl(id)); },
  addEventListener() {}
};
global.window = { addEventListener() {}, devicePixelRatio: 1 };
global.navigator = {};

eval(code);
const T = global.__T;
T.setDelay(0);

const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : '')); }
}
function empties() {
  const b = T.board(), out = [];
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) if (b[y][x] === 0) out.push([x, y]);
  return out;
}
function click(id) { const el = els[id]; el.listeners['click'].call(el); }

/* ---- Test 1: pvp 五连获胜 ---- */
(async () => {
  console.log('== T1: 双人模式五连胜利 ==');
  click('btnMode');               // ai -> pvp
  ok('mode is pvp', T.mode() === 'pvp', T.mode());
  T.clearAll();
  // 黑 0,7 1,7 2,7 3,7 4,7 ；白在第10行
  const whites = [[0, 10], [1, 10], [2, 10], [3, 10]];
  for (let i = 0; i < 4; i++) {
    T.place(i, 7);                       // 黑
    if (T.over()) { ok('不应提前结束', false, i); break; }
    T.place(whites[i][0], whites[i][1]); // 白
  }
  if (!T.over()) T.place(4, 7);          // 黑第五子
  ok('黑棋获胜', T.over() === true, { over: T.over(), cur: T.cur() });
  ok('胜利连线为5子', T.win().length === 5, T.win().length);
  ok('比分 1:0', T.scores()[1] === 1 && T.scores()[2] === 0, T.scores());
  ok('胜利方向正确', T.win().every(c => c[1] === 7), T.win());

  /* ---- Test 2: 悔棋（人机，退两步） ---- */
  console.log('== T2: 人机模式悔棋 ==');
  click('btnMode');               // pvp -> ai
  ok('mode is ai', T.mode() === 'ai', T.mode());
  T.reset();
  ok('重开后比分保留', T.scores()[1] === 1, T.scores());
  T.place(7, 7);                  // 黑
  await sleep(20);
  const hAfterAI = T.hist().length;
  ok('AI 已应手', hAfterAI === 2, hAfterAI);
  T.undo();
  ok('悔棋后回到空盘', T.hist().length === 0, T.hist().length);
  ok('轮到黑棋', T.cur() === 1, T.cur());

  /* ---- Test 3: AI 必堵四连 ---- */
  console.log('== T3: AI 堵黑棋四连 ==');
  T.clearAll();
  T.setPos(3, 7, 1); T.setPos(4, 7, 1); T.setPos(5, 7, 1); T.setPos(6, 7, 1); // 黑横向四连
  T.setPos(0, 0, 1); T.setPos(1, 1, 1);                                       // 黑零散子
  T.setCur(2);                    // 白
  T.setLevel(2);
  T.aiMove();
  const b = T.board();
  ok('堵住横向四连', b[7][2] === 2 || b[7][8] === 2, { a: b[7][2], c: b[7][8] });

  /* ---- Test 4: AI 抢先成五 ---- */
  console.log('== T4: AI 抢五取胜 ==');
  T.clearAll();
  T.setPos(3, 8, 2); T.setPos(4, 8, 2); T.setPos(5, 8, 2); T.setPos(6, 8, 2); // 白四连
  T.setPos(7, 7, 1); T.setPos(7, 8, 1); T.setPos(8, 7, 1);                    // 黑干扰
  T.setCur(2);
  T.aiMove();
  const b4 = T.board();
  ok('白棋成五', b4[8][2] === 2 || b4[8][7] === 2, { a: b4[8][2], c: b4[8][7] });

  /* ---- Test 5: AI 双活三优先级 ---- */
  console.log('== T5: 困难AI制造双威胁 ==');
  T.clearAll();
  // 黑在中腹两对子，白未布局：白应当选择构筑自己威胁/压制
  T.setPos(7, 7, 1); T.setPos(8, 7, 1);
  T.setPos(7, 9, 1); T.setPos(8, 9, 1);
  T.setPos(0, 0, 2); T.setPos(14, 14, 2); // 白已有两子(角落，几乎无用)
  T.setCur(2);
  T.setLevel(2);
  T.aiMove();
  const b5 = T.board();
  let near = false;
  for (let y = 6; y <= 10; y++) for (let x = 6; x <= 9; x++) if (b5[y][x] === 2 && x !== 0) near = true;
  ok('白棋在中腹应手', near, null);

  /* ---- Test 6: 对局压力测试 ---- */
  console.log('== T6: 困难AI随机对手 x6 局 ==');
  let aiWin = 0, humanWin = 0, draws = 0, errors = 0;
  for (let g = 0; g < 6; g++) {
    T.reset();
    T.scores()[1] = 0; T.scores()[2] = 0;
    T.setLevel(2);
    try {
      let steps = 0;
      while (!T.over() && steps < 400) {
        steps++;
        if (T.cur() === 1) {
          const e = empties();
          if (!e.length) break;
          const pick = e[(Math.random() * e.length) | 0];
          T.place(pick[0], pick[1]);
        } else {
          await sleep(8);
        }
      }
      if (T.over()) {
        const w = T.win();
        if (w.length >= 5) {
          const last = T.hist()[T.hist().length - 1];
          const valid = T.checkWin(last.x, last.y, last.p);
          if (!valid) { errors++; console.log('    胜利校验失败 @', last); }
          if (last.p === 2) aiWin++; else humanWin++;
        } else draws++;
      }
    } catch (err) { errors++; console.log('    EXCEPTION', err.message); }
  }
  ok('无异常', errors === 0, errors);
  ok('AI 至少赢2局(随机对手)', aiWin >= 2, { aiWin, humanWin, draws });
  console.log('    统计: AI胜 ' + aiWin + ' / 随机胜 ' + humanWin + ' / 和棋 ' + draws);

  /* ---- Test 7: 双人模式整局 ---- */
  console.log('== T7: 双人随机整局 x3 ==');
  click('btnMode'); // pvp
  let ok7 = 0;
  for (let g = 0; g < 3; g++) {
    T.reset();
    try {
      let steps = 0;
      while (!T.over() && steps < 226) {
        const e = empties();
        if (!e.length) break;
        const p = e[(Math.random() * e.length) | 0];
        T.place(p[0], p[1]);
        steps++;
      }
      const w = T.win();
      if (T.over()) {
        if (w.length >= 5) {
          const last = T.hist()[T.hist().length - 1];
          if (T.checkWin(last.x, last.y, last.p)) ok7++;
          else { console.log('    五连校验失败'); }
        } else ok7++; // 和棋也算正常结束
      }
    } catch (err) { console.log('    EXCEPTION', err.message); }
  }
  ok('双人整局正常', ok7 === 3, ok7);

  /* ---- Test 8: 简单难度不崩溃 ---- */
  console.log('== T8: 简单/普通难度 ==');
  click('btnMode'); // ai
  let e8 = 0;
  for (const lv of [0, 1]) {
    T.reset();
    T.setLevel(lv);
    try {
      let steps = 0;
      while (!T.over() && steps < 300) {
        steps++;
        if (T.cur() === 1) {
          const e = empties();
          const p = e[(Math.random() * e.length) | 0];
          T.place(p[0], p[1]);
        } else await sleep(8);
      }
    } catch (err) { e8++; console.log('    EXCEPTION lv' + lv, err.message); }
  }
  ok('低难度无异常', e8 === 0, e8);

  /* ---- Test 9: 悔棋分数回滚 ---- */
  console.log('== T9: 胜利后悔棋比分回滚 ==');
  click('btnMode'); // pvp
  T.reset();
  T.scores()[1] = 0; T.scores()[2] = 0;
  for (let i = 0; i < 4; i++) { T.place(i, 7); T.place(i, 4); }
  T.place(4, 7);
  ok('黑胜', T.over() && T.scores()[1] === 1, T.scores());
  T.undo();
  ok('悔棋后over=false', T.over() === false, T.over());
  ok('比分已回滚', T.scores()[1] === 0, T.scores());
  ok('盘面剩8子', T.hist().length === 8, T.hist().length);

  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})();
