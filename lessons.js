'use strict';
/* Dữ liệu bài học và bộ máy sinh bài của "Phím Vàng".
   Nạp bằng <script src="lessons.js"> thường (không module). Tạo hằng toàn cục PV.

   Cấu trúc một bài (PV.lessons[i]):
   {
     id:      '1-2'                 // khóa ổn định dùng khi lưu tiến độ: <chặng>-<số thứ tự trong chặng>
     stage:   1,                    // số chặng (1..7)
     n:       2,                    // số thứ tự trong chặng (từ 1)
     title:   'Phím D K',
     final:   false,                // true nếu là bài ôn cuối chặng
     kind:    'keys' | 'words' | 'sentences' | 'telex',
     new:     ['d','k'],            // phím mới (kind 'keys'): được trộn nhiều hơn
     review:  ['f','j'],            // phím cũ để ôn (kind 'keys')
     words / sentences / items      // nguồn chữ cho các kind còn lại
   }
   Lưu ý: nếu đổi id hoặc thứ tự bài thì phải tăng SAVE_VER trong index.html. */

const PV = (() => {
  const CFG = {
    PASS_ACCURACY: 90,      // % chính xác tối thiểu để qua bài (so sánh với số đã làm tròn hiển thị)
    LINES_PER_LESSON: 5,    // số dòng mỗi bài
    MAX_LEN_KEYS: 20,       // độ dài tối đa một dòng phím
    MAX_LEN_WORDS: 22,      // độ dài tối đa một dòng từ
    NEW_RATIO: 0.65,        // xác suất mỗi ký tự lấy từ phím mới (phần còn lại là phím cũ)
  };

  /* ---------- Dữ liệu 7 chặng ---------- */
  // groups: mỗi nhóm là chuỗi phím mới, hoặc [chuỗi phím, tiêu đề]. base: phím luôn có để ôn.
  const STAGES = [
    { id: 1, title: 'Hàng cơ sở', sub: 'Đặt tay lên a s d f  j k l ;', base: '',
      prefix: 'Phím ', groups: ['fj', 'dk', 'sl', 'a;', 'gh'],
      finalTitle: 'Ôn hàng cơ sở', finalKind: 'words',
      words: 'ask dad sad lad had gas flag glad salad hall fall all lag ash dash hash slash'.split(' ') },
    { id: 2, title: 'Hàng trên', sub: 'Ngón vươn lên q w e r t y u i o p', base: 'asdfghjkl;',
      prefix: 'Phím ', groups: ['ru', 'ei', 'wo', 'qp', 'ty'],
      finalTitle: 'Ôn hàng trên', finalKind: 'words',
      words: 'you the out pet quit yes wipe tire tour pie pot tip port write tree sky top use out jet'.split(' ') },
    { id: 3, title: 'Hàng dưới', sub: 'Ngón thu xuống z x c v b n m , . /', base: 'asdfghjkl;qwertyuiop',
      prefix: 'Phím ', groups: ['vm', 'c,', 'x.', 'z/', 'bn'],
      finalTitle: 'Ôn hàng dưới', finalKind: 'words',
      words: 'cat dog van box zip bus mix bean zoo number name cave zebra black mouse moon nice'.split(' ') },
    { id: 4, title: 'Shift và dấu câu', sub: 'Chữ hoa, dấu hỏi, dấu chấm than...', base: 'asdfjkl',
      groups: [['FJ', 'Chữ hoa F J'], ['DK', 'Chữ hoa D K'], ['SL', 'Chữ hoa S L'], ['AH', 'Chữ hoa A H'],
               ['RU', 'Chữ hoa R U'], ['EI', 'Chữ hoa E I'], ['WO', 'Chữ hoa W O'], ['TY', 'Chữ hoa T Y'],
               ['QP', 'Chữ hoa Q P'], ['NM', 'Chữ hoa N M'], ["'-", "Dấu ' và -"], ['?!', 'Dấu ? và !'], [':', 'Dấu :']],
      finalTitle: 'Ôn chữ hoa và dấu câu', finalKind: 'sentences',
      sentences: ['Hello, Mia!', 'I am Nam.', 'Is it a cat?', 'My name is An.', 'Look: a big sun!',
                  'Dog, cat, and pig.', 'Tom has a red hat.', 'Yes, I do!', 'Who is Kim?', "It's a fish."] },
    { id: 5, title: 'Hàng số', sub: 'Số 1 2 3 4 5 6 7 8 9 0', base: 'asdfghjkl;',
      prefix: 'Số ', groups: ['45', '67', '38', '29', '10'],
      finalTitle: 'Ôn hàng số', finalKind: 'sentences',
      sentences: ['so 1 2 3 4 5', 'so 6 7 8 9 10', 'toi 7 tuoi', 'co 10 ngon tay', 'lop 2 co 30 ban',
                  'ngay 12 thang 5', 'so 2468 va 1357', 'em dem tu 1 den 20', 'nha so 19', 'co 5 qua cam'] },
    { id: 6, title: 'Từ và câu', sub: 'Tiếng Việt không dấu và tiếng Anh dễ',
      lessons: [
        { title: 'Gia đình', kind: 'words', words: 'ba me anh chi em ong ba bac chu di con co'.split(' ') },
        { title: 'Con vật', kind: 'words', words: 'meo cho ga vit heo bo de ca chim tho cua tom'.split(' ') },
        { title: 'Đồ ăn', kind: 'words', words: 'com chao banh sua trung canh rau thit chuoi cam xoai kem'.split(' ') },
        { title: 'Màu sắc', kind: 'words', words: 'do vang xanh trang den tim nau hong cam xam'.split(' ') },
        { title: 'Tiếng Anh: đồ vật', kind: 'words', words: 'cat dog sun red big hat map pen box cup bus bed'.split(' ') },
        { title: 'Tiếng Anh: dễ thương', kind: 'words', words: 'apple book milk fish tree star moon green blue home love'.split(' ') },
        { title: 'Câu ngắn tiếng Việt', kind: 'sentences',
          sentences: ['ba di lam', 'me nau com', 'em di hoc', 'con meo ngu', 'be an com ngon', 'ong ba rat vui',
                      'em yeu me', 'troi co nang', 'ca boi trong ao', 'nha em co hoa'] },
        { title: 'Câu ngắn tiếng Anh', kind: 'sentences',
          sentences: ['the sun is hot', 'i like milk', 'a cat can run', 'we love our home', 'the fish can swim',
                      'my dog is big', 'look at the moon', 'i see a star', 'it is a red hat', 'we play a game'] },
        { title: 'Ôn từ và câu', kind: 'sentences', final: true,
          sentences: ['em di hoc ve nha', 'the cat and the dog', 'ba me yeu em', 'i like blue and red', 'meo an ca',
                      'we go to school', 'con cho chay nhanh', 'my home is nice', 'ca nha cung vui', 'the sun is up'] },
      ] },
    { id: 7, title: 'Telex tiếng Việt', sub: 'Tùy chọn, làm khi đã quen tay', optional: true,
      // Gõ đúng chuỗi phím Telex (không bật bộ gõ). Dòng ghi chú cho biết chữ sẽ ra khi dùng bộ gõ thật.
      lessons: [
        { title: 'Chữ có mũ: aa ee oo', kind: 'telex',
          items: [['caan', 'cân'], ['mee', 'mê'], ['coo', 'cô'], ['baan', 'bân'], ['nee', 'nê'], ['too', 'tô']] },
        { title: 'Chữ ơ ư ă: w', kind: 'telex',
          items: [['mow', 'mơ'], ['tuw', 'tư'], ['nawm', 'năm'], ['cuwa', 'cưa'], ['bow', 'bơ'], ['rawng', 'răng']] },
        { title: 'Chữ đ: dd', kind: 'telex',
          items: [['ddi', 'đi'], ['dden', 'đen'], ['ddau', 'đau'], ['ddo', 'đo'], ['ddaif', 'đài'], ['ddem', 'đem']] },
        { title: 'Dấu thanh: s f r x j', kind: 'telex',
          items: [['mas', 'má'], ['maf', 'mà'], ['mar', 'mả'], ['max', 'mã'], ['maj', 'mạ'], ['bas', 'bá']] },
        { title: 'Từ hoàn chỉnh', kind: 'telex', final: true,
          items: [['Vieetj', 'Việt'], ['Nam', 'Nam'], ['toots', 'tốt'], ['ddi', 'đi'], ['hocj', 'học'], ['ngoan', 'ngoan'], ['meof', 'mèo']] },
      ] },
  ];

  /* ---------- Dựng danh sách bài phẳng từ dữ liệu chặng ---------- */
  const uniq = a => [...new Set(a)];
  const lessons = [];
  for (const S of STAGES) {
    let n = 0;
    const add = o => lessons.push(Object.assign({ stage: S.id, n: ++n, id: `${S.id}-${n}`, final: false }, o));
    if (S.groups) {
      const seen = [];
      S.groups.forEach(g => {
        const keys = (Array.isArray(g) ? g[0] : g).split('');
        const title = Array.isArray(g) ? g[1] : S.prefix + keys.map(k => k.toUpperCase()).join(' ');
        const review = uniq([...S.base.split(''), ...seen, ...keys.map(k => k.toLowerCase())]).filter(k => !keys.includes(k));
        add({ title, kind: 'keys', new: keys, review });
        seen.push(...keys);
      });
      if (S.finalKind === 'words') add({ title: S.finalTitle, kind: 'words', final: true, words: S.words });
      else add({ title: S.finalTitle, kind: 'sentences', final: true, sentences: S.sentences });
    } else {
      S.lessons.forEach(L => add(L));
    }
  }
  const byId = Object.fromEntries(lessons.map(l => [l.id, l]));
  const stageOf = id => STAGES.find(s => s.id === id);

  /* ---------- Bộ máy sinh dòng luyện ---------- */
  const rand = n => Math.floor(Math.random() * n);
  const pick = a => a[rand(a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function keyLine(L, first) {
    const nw = L.new, rv = L.review, max = CFG.MAX_LEN_KEYS;
    const pc = () => (!rv.length || Math.random() < CFG.NEW_RATIO) ? pick(nw) : pick(rv);
    const token = () => {
      const n = 3 + rand(2), style = rand(3);
      if (style === 0) return pc().repeat(n);
      if (style === 1) { const a = pc(), b = pc(); let s = ''; for (let i = 0; i < n; i++) s += i % 2 ? b : a; return s; }
      let s = ''; for (let i = 0; i < n; i++) s += pc(); return s;
    };
    let best = '';
    for (let t = 0; t < 40; t++) {
      const toks = first ? nw.map(k => k.repeat(3)) : [];
      let len = toks.join(' ').length;
      for (let guard = 0; guard < 12 && len < max - 4; guard++) {
        const tk = token();
        if (tk === toks[toks.length - 1]) continue;
        if (len + (len ? 1 : 0) + tk.length > max) continue;
        toks.push(tk); len += (len ? 1 : 0) + tk.length;
      }
      const text = toks.join(' ');
      best = text;
      const chars = text.replace(/ /g, '');
      const newCount = [...chars].filter(c => nw.includes(c)).length;
      const hasAll = nw.every(k => chars.includes(k));
      if (hasAll && (!rv.length || newCount / chars.length >= 0.55)) return text;
    }
    return best;
  }

  function wordLine(L) {
    const max = CFG.MAX_LEN_WORDS;
    let bag = shuffle(L.words), s = '';
    for (let i = 0; i < 30; i++) {
      if (!bag.length) bag = shuffle(L.words);
      const w = bag.pop();
      const next = s ? s + ' ' + w : w;
      if (next.length > max) { if (s.split(' ').length >= 2) break; continue; }
      s = next;
      if (s.length >= max - 5) break;
    }
    return s;
  }

  /** Sinh các dòng cho một bài. Trả về mảng {text, note?}. Mỗi lần gọi cho kết quả khác nhau. */
  function genLines(L, count = CFG.LINES_PER_LESSON) {
    const out = [], used = new Set();
    let sentenceBag = L.sentences ? shuffle(L.sentences) : null;
    for (let i = 0; i < count; i++) {
      let line = null;
      for (let t = 0; t < 25; t++) {
        let cand;
        if (L.kind === 'keys') cand = { text: keyLine(L, i === 0) };
        else if (L.kind === 'words') cand = { text: wordLine(L) };
        else if (L.kind === 'sentences') {
          if (!sentenceBag.length) sentenceBag = shuffle(L.sentences);
          cand = { text: sentenceBag.pop() };
        } else { // telex
          const picks = shuffle(L.items).slice(0, 3);
          cand = { text: picks.map(p => p[0]).join(' '), note: picks.map(p => p[1]).join('   ') };
        }
        if (!used.has(cand.text)) { line = cand; break; }
        line = cand;
      }
      used.add(line.text);
      out.push(line);
    }
    return out;
  }

  return { CFG, STAGES, lessons, byId, stageOf, genLines };
})();
