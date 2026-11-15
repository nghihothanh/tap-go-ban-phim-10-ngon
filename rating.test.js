// Kiểm thử hàm tính điểm. Chạy: node rating.test.js
const assert = require('assert');
const R = require('./rating.js');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

t('độ khó: 800 + 20 x thứ tự, bài ôn cuối chặng +40', () => {
  assert.strictEqual(R.difficulty(0, false), 800);
  assert.strictEqual(R.difficulty(10, false), 1000);
  assert.strictEqual(R.difficulty(5, true), 940);
});
t('E: cùng điểm thì 0,5; hơn 400 điểm thì 10/11', () => {
  near(R.expected(800, 800), 0.5);
  near(R.expected(1200, 800), 10 / 11);
  near(R.expected(800, 1200), 1 / 11);
});
t('A kẹp từ 80% đến 100%', () => {
  assert.strictEqual(R.accuracyScore(70), 0);
  assert.strictEqual(R.accuracyScore(80), 0);
  near(R.accuracyScore(90), 0.5);
  assert.strictEqual(R.accuracyScore(100), 1);
});
t('tốc độ mục tiêu: 40 chặng 1, +10 mỗi chặng, chặng 7 = 100', () => {
  assert.strictEqual(R.targetCpm(1), 40);
  assert.strictEqual(R.targetCpm(2), 50);
  assert.strictEqual(R.targetCpm(7), 100);
  near(R.speedScore(20, 1), 0.5);
  assert.strictEqual(R.speedScore(500, 3), 1);
});
t('thời gian bài: bỏ quãng nghỉ trên 5 giây, giữ đúng 5 giây', () => {
  assert.strictEqual(R.activeSeconds([0, 1000, 2000]), 2);
  assert.strictEqual(R.activeSeconds([0, 1000, 7000, 8000]), 2);        // quãng 6 giây bị bỏ
  assert.strictEqual(R.activeSeconds([0, 5000, 10000]), 10);            // đúng 5 giây vẫn tính
  assert.strictEqual(R.activeSeconds([0]), 0);
  assert.strictEqual(R.activeSeconds([]), 0);
});
t('ký tự đúng mỗi phút', () => {
  near(R.charsPerMinute(40, Array.from({ length: 31 }, (_, i) => i * 1000)), 80);   // 40 ký tự trong 30 giây
  assert.strictEqual(R.charsPerMinute(10, [0]), 0);
});
t('K: 32 cho 10 bài đầu, 16 sau đó; nhân hệ số phần', () => {
  assert.strictEqual(R.kFactor(0), 32);
  assert.strictEqual(R.kFactor(9), 32);
  assert.strictEqual(R.kFactor(10), 16);
  assert.strictEqual(R.kFactor(0, 0.5), 16);
  assert.strictEqual(R.kFactor(0, 1.5), 48);
  assert.strictEqual(R.kFactor(20, 1.5), 24);
});
t('một bài hoàn hảo, bằng điểm bài: +16 (K=32, S=1, E=0,5)', () => {
  // 100% chính xác, 40 ký tự đúng trong đúng 1 phút (nhiều phím cách nhau 1,5 giây)
  const times = Array.from({ length: 41 }, (_, i) => i * 1500);
  const r = R.rateLesson({ rating: 800, index: 0, final: false, acc: 100, ok: 40, times, stage: 1, ratedCount: 0, kMul: 1, gained: 0, lost: 0 });
  near(r.cpm, 40); near(r.S, 1); near(r.E, 0.5);
  assert.strictEqual(r.delta, 16);
  assert.strictEqual(r.newRating, 816);
  assert.strictEqual(r.gained, 16); assert.strictEqual(r.lost, 0);
});
t('chính xác 90%, tốc độ đủ: S = 0,6, +3', () => {
  const times = Array.from({ length: 41 }, (_, i) => i * 1500);
  const r = R.rateLesson({ rating: 800, index: 0, acc: 90, ok: 40, times, stage: 1, ratedCount: 0, kMul: 1 });
  near(r.S, 0.6); assert.strictEqual(r.delta, 3);
});
t('chính xác 80% trở xuống: S = 0 (chậm) nên trừ K x E', () => {
  const r = R.rateLesson({ rating: 800, index: 0, acc: 75, ok: 10, times: [0], stage: 1, ratedCount: 20, kMul: 1 });
  near(r.S, 0); assert.strictEqual(r.delta, -8); assert.strictEqual(r.newRating, 792); assert.strictEqual(r.lost, 8);
});
t('khởi động dùng K/2, thử thách dùng K x 1,5', () => {
  const base = { rating: 800, index: 0, acc: 100, ok: 40, times: Array.from({ length: 41 }, (_, i) => i * 1500), stage: 1, ratedCount: 0 };
  assert.strictEqual(R.rateLesson({ ...base, kMul: 0.5 }).delta, 8);
  assert.strictEqual(R.rateLesson({ ...base, kMul: 1.5 }).delta, 24);
});
t('trần cộng 60 mỗi ngày: chỉ cộng phần còn lại, rồi không cộng nữa', () => {
  let r = R.applyDelta(900, 24, 50, 0);
  assert.strictEqual(r.applied, 10); assert.strictEqual(r.newRating, 910); assert.strictEqual(r.gained, 60); assert.ok(r.capped);
  r = R.applyDelta(910, 24, 60, 0);
  assert.strictEqual(r.applied, 0); assert.strictEqual(r.newRating, 910); assert.strictEqual(r.gained, 60);
});
t('trần trừ 30 mỗi ngày', () => {
  let r = R.applyDelta(900, -16, 0, 20);
  assert.strictEqual(r.applied, -10); assert.strictEqual(r.lost, 30); assert.ok(r.capped);
  r = R.applyDelta(890, -16, 0, 30);
  assert.strictEqual(r.applied, 0); assert.strictEqual(r.newRating, 890);
});
t('trần cộng và trừ tính riêng, không bù trừ cho nhau', () => {
  const r = R.applyDelta(900, 10, 60, 30);   // đã chạm cả hai trần
  assert.strictEqual(r.applied, 0);
});
t('điểm không bao giờ dưới 100', () => {
  const r = R.applyDelta(105, -16, 0, 0);
  assert.strictEqual(r.newRating, 100); assert.strictEqual(r.applied, -5); assert.strictEqual(r.lost, 5);
  assert.strictEqual(R.applyDelta(100, -16, 0, 0).newRating, 100);
});
t('SESSION_PARTS: 4 phần, tổng 15 phút', () => {
  assert.strictEqual(R.SESSION_PARTS.length, 4);
  assert.strictEqual(R.SESSION_PARTS.reduce((s, p) => s + p.seconds, 0), 900);
  assert.deepStrictEqual(R.SESSION_PARTS.map(p => p.seconds), [120, 300, 300, 180]);
});
console.log(`\n${n} nhóm kiểm thử đạt`);
