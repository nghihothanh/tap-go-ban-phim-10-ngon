'use strict';
/* Điểm kiểu ELO và các phần của buổi tập của "Phím Vàng".
   Nạp bằng <script src="rating.js"> thường (sau lessons.js); cũng nạp được bằng require() trong node để kiểm thử
   (xem rating.test.js). Chỉ gồm hàm thuần, không đụng tới giao diện hay localStorage.

   Cách tính cho mỗi bài làm xong trong buổi:
     D = 800 + 20 x (thứ tự bài, từ 0) (+40 nếu là bài ôn cuối chặng)
     E = 1 / (1 + 10^((D - R) / 400))                  điểm kỳ vọng
     S = 0,8 x A + 0,2 x T                              điểm thực tế
        A = kẹp((chính xác% - 80) / 20, 0, 1)
        T = kẹp(ký tự đúng mỗi phút / tốc độ mục tiêu, 0, 1)
     R mới = R + K x (S - E), làm tròn
   K = 32 cho 10 bài tính điểm đầu tiên, sau đó 16; nhân thêm kMul của phần (khởi động 0,5, thử thách 1,5).
   Mỗi ngày: tổng cộng tối đa 60, tổng trừ tối đa 30; điểm không dưới 100. */

const RATING = (() => {
  const CFG = {
    START: 800,            // điểm khởi đầu
    MIN: 100,              // điểm thấp nhất
    DIFF_BASE: 800,        // độ khó bài đầu tiên
    DIFF_STEP: 20,         // mỗi bài sau khó hơn bấy nhiêu
    FINAL_BONUS: 40,       // bài ôn cuối chặng khó thêm
    W_ACC: 0.8,            // trọng số độ chính xác trong S
    W_SPEED: 0.2,          // trọng số tốc độ trong S
    ACC_FLOOR: 80,         // dưới mức này (%) thì A = 0
    ACC_SPAN: 20,          // từ ACC_FLOOR tăng thêm bấy nhiêu thì A = 1
    TARGET_BASE: 40,       // tốc độ mục tiêu chặng 1 (ký tự đúng mỗi phút)
    TARGET_STEP: 10,       // mỗi chặng sau cao hơn bấy nhiêu
    PAUSE_MS: 5000,        // quãng nghỉ giữa hai phím dài hơn mức này thì không tính vào thời gian bài
    K_FIRST: 32,           // hệ số K cho các bài tính điểm đầu tiên
    K_AFTER: 16,           // hệ số K sau đó
    FIRST_N: 10,           // số bài tính điểm đầu tiên dùng K_FIRST
    DAY_MAX_GAIN: 60,      // tổng điểm cộng tối đa mỗi ngày
    DAY_MAX_LOSS: 30,      // tổng điểm trừ tối đa mỗi ngày
  };

  /* Các phần của một buổi tập. Đổi thời gian ở đây (giây).
     lines: số dòng mỗi bài trong phần đó (mặc định của bài là PV.CFG.LINES_PER_LESSON = 5).
     kMul: hệ số nhân của K. */
  const SESSION_PARTS = [
    { id: 'warm',      name: 'Khởi động', seconds: 120, lines: 3, kMul: 0.5 },
    { id: 'new',       name: 'Bài mới',   seconds: 300, lines: 5, kMul: 1 },
    { id: 'practice',  name: 'Luyện tập', seconds: 300, lines: 5, kMul: 1 },
    { id: 'challenge', name: 'Thử thách', seconds: 180, lines: 3, kMul: 1.5 },
  ];

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  /** Độ khó của bài thứ index (từ 0 theo PV.lessons); isFinal = bài ôn cuối chặng. */
  const difficulty = (index, isFinal) => CFG.DIFF_BASE + CFG.DIFF_STEP * index + (isFinal ? CFG.FINAL_BONUS : 0);

  /** Xác suất "thắng" kỳ vọng của người có điểm R trước bài có độ khó D. */
  const expected = (R, D) => 1 / (1 + Math.pow(10, (D - R) / 400));

  /** Điểm độ chính xác A: 80% trở xuống = 0, 100% = 1. */
  const accuracyScore = accPct => clamp((accPct - CFG.ACC_FLOOR) / CFG.ACC_SPAN, 0, 1);

  /** Tốc độ mục tiêu (ký tự đúng mỗi phút) của chặng stage (từ 1). */
  const targetCpm = stage => CFG.TARGET_BASE + CFG.TARGET_STEP * (stage - 1);

  /** Điểm tốc độ T. */
  const speedScore = (cpm, stage) => clamp(cpm / targetCpm(stage), 0, 1);

  /** Tổng số giây gõ thật: cộng các quãng giữa hai phím liên tiếp, bỏ quãng nghỉ dài hơn PAUSE_MS.
      times: thời điểm mỗi lần bấm phím, đơn vị mili giây, tăng dần. */
  function activeSeconds(times) {
    let ms = 0;
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      if (gap >= 0 && gap <= CFG.PAUSE_MS) ms += gap;
    }
    return ms / 1000;
  }

  /** Ký tự đúng mỗi phút. Không đo được thời gian thì trả 0. */
  function charsPerMinute(okChars, times) {
    const sec = activeSeconds(times);
    return sec > 0 ? okChars * 60 / sec : 0;
  }

  /** Hệ số K theo số bài đã tính điểm trước đó và hệ số của phần. */
  const kFactor = (ratedCount, kMul = 1) => (ratedCount < CFG.FIRST_N ? CFG.K_FIRST : CFG.K_AFTER) * kMul;

  /** Điểm thực tế S của một bài. */
  const lessonScore = (accPct, cpm, stage) =>
    CFG.W_ACC * accuracyScore(accPct) + CFG.W_SPEED * speedScore(cpm, stage);

  /** Áp trần cộng/trừ của ngày. Trả về { newRating, gained, lost, applied, capped }.
      gained/lost: tổng đã cộng/trừ trong ngày trước bài này. */
  function applyDelta(rating, delta, gained, lost) {
    let applied = delta;
    if (delta > 0) applied = Math.min(delta, Math.max(0, CFG.DAY_MAX_GAIN - gained));
    else if (delta < 0) applied = Math.max(delta, -Math.max(0, CFG.DAY_MAX_LOSS - lost));
    const capped = applied !== delta;
    const newRating = Math.max(CFG.MIN, rating + applied);
    applied = newRating - rating;     // nếu chạm sàn 100 thì mức trừ thật nhỏ hơn
    return {
      newRating, applied, capped,
      gained: gained + Math.max(applied, 0),
      lost: lost + Math.max(-applied, 0),
    };
  }

  /** Chấm một bài trong buổi.
      o: { rating, index, final, acc (%), ok (số ký tự đúng), times (ms), stage, ratedCount, kMul, gained, lost } */
  function rateLesson(o) {
    const D = difficulty(o.index, !!o.final);
    const E = expected(o.rating, D);
    const cpm = charsPerMinute(o.ok, o.times || []);
    const A = accuracyScore(o.acc), T = speedScore(cpm, o.stage);
    const S = CFG.W_ACC * A + CFG.W_SPEED * T;
    const K = kFactor(o.ratedCount, o.kMul == null ? 1 : o.kMul);
    const delta = Math.round(K * (S - E));
    const r = applyDelta(o.rating, delta, o.gained || 0, o.lost || 0);
    return Object.assign({ D, E, A, T, S, K, cpm, delta }, r);
  }

  return { CFG, SESSION_PARTS, difficulty, expected, accuracyScore, targetCpm, speedScore, activeSeconds,
           charsPerMinute, kFactor, lessonScore, applyDelta, rateLesson };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = RATING;
