---
title: "Legs, Arms, Cells — cách thiết kế eval cho LLM agent để kết quả là một con số, không phải văn xuôi"
description: "Phân tích thiết kế một eval phát hiện quy ước thật cho LLM coding agent: arm (kiểm soát thiên lệch bộ nhớ), leg (đường đo lường độc lập theo detector), và cell (leg × arm, lặp lại để hấp thụ tính không xác định), kết thúc bằng hợp đồng đạt/rớt 5 gate bằng số."
pubDatetime: 2026-08-20T02:00:00Z
lang: vi
tags:
  - eval-design
  - llm-agents
  - factorial-design
  - detection-eval
  - vietnamese
multiLangKey: "legs-arms-cells-llm-eval-design"
---

## TL;DR

1. **"Verification (thẩm định) phải ra một con số, không phải văn xuôi."** Một lượt "pass" (đạt) là
   một phép kiểm tra máy móc (mechanical predicate) chạy trên file JSON chấm điểm, không phải một
   câu văn trong báo cáo mà con người phải tin tưởng.
2. **Cô lập biến số bạn sợ nhất sẽ làm sai lệch kết quả — gọi đó là một `arm` (nhánh điều kiện).**
   Ở đây biến số đáng sợ là bộ nhớ xung quanh (ambient memory — `CLAUDE.md` / cấu hình project);
   eval chạy mỗi detector (bộ phát hiện) hai lần, một lần với sandbox (môi trường cách ly) rỗng
   hoàn toàn và một lần với bộ nhớ giả lập không hề gợi ý đáp án, rồi chỉ lấy lần sandbox rỗng làm
   căn cứ đạt/rớt.
3. **Đặt tên cho từng đường đo lường độc lập — gọi đó là một `leg` (chân đo).** Hai agent khác nhau
   làm hai việc khác nhau (quét toàn bộ code vs. review một diff) là hai leg; gộp điểm của chúng
   thành một con số duy nhất sẽ che mất việc cửa nào đang hỏng.
4. **Một `cell` (ô) là một cặp leg × arm — một ô vuông trong ma trận thử nghiệm.** Mỗi cell chạy 3
   lần lặp (repetition) và yêu cầu 2/3 đạt, để một lần chạy may/rủi của LLM (vốn không xác định —
   nondeterministic) không thể một mình quyết định kết quả.
5. **Một bảng gate (cổng chặn) 5 dòng, không phải một đoạn văn, mới là hợp đồng đạt/rớt thật sự** —
   xem mục 6. Mọi thứ phía trên bảng đó tồn tại chỉ để 5 dòng đó đo đúng thứ cần đo.

---

## 1. Vấn đề: một vòng lặp tự cải thiện có một bản lề chưa từng được kiểm chứng

Plugin **tribe** (hệ thống multi-agent — nhiều agent phối hợp — để giao việc code cho Claude Code)
có một vòng lặp tự cải thiện (self-improvement loop) giữ cho bộ quy tắc của chính nó luôn đúng:

```
Tracker (review một diff) --phát hiện "harness gap"--> ledger --> Scout (phân xử) --> quy tắc mới
        ^                                                                                  |
        \------------------------- sau đó thực thi quy tắc mới -----------------------------/
```

- **Tracker** review một diff (bản thay đổi code) so với các quy tắc *đã được viết ra* của repo, và
  theo đúng hiến chương của nó, phải báo cáo một **harness gap** (lỗ hổng trong bộ quy tắc — "bộ
  quy tắc im lặng ở đây") khi thấy một pattern rủi ro mà chưa quy tắc nào bao phủ. Nó tuyệt đối
  không được tự bịa ra một quy tắc tại chỗ rồi báo "vi phạm" một thứ không hề tồn tại.
- **Scout** định kỳ quét toàn bộ codebase đang có, suy ra các quy ước (convention) từ sự lặp lại,
  rồi biến những ứng viên mạnh nhất thành đề xuất quy tắc.

Vòng lặp này chỉ tốt bằng hai "cửa phát hiện" (detection door) đó. Trước thiết kế này, tribe có 43
**role eval** (eval kiểm tra hành vi theo vai trò, `plugins/tribe/evals/evals.json`) — các prompt
mô tả một tình huống giả định, chấm điểm dựa trên việc agent có giữ đúng vai trò hay không — và gần
như không cái nào có kèm file thật. Không cái nào đo năng lực thật sự mà vòng lặp phụ thuộc vào:
*suy ra một quy ước không được viết ra ở đâu cả, từ một codebase thật, và bắt đúng chỗ nó bị vi
phạm.* Đó chính là khoảng trống thiết kế này lấp lại.

## 2. Fixture (bộ dữ liệu mẫu): một codebase nhỏ có đáp án không bao giờ vào sandbox

Eval cần một codebase nơi "quy ước" là một sự kiện có thể kiểm chứng, không phải chuyện gu thẩm mỹ.
Thiết kế dựng lên **`orderly`** — một fixture (bộ dữ liệu/mã nguồn mẫu dùng để test) TypeScript/bun
~20 file mô phỏng một order service (dịch vụ đặt hàng), chạy xanh (`bun test` pass, `bunx tsc
--noEmit` sạch), và được cấy 10 quy ước **không được viết ra ở đâu cả** — không `CLAUDE.md`, không
lint rule, không comment nào nói ra; chỉ có thể suy ra từ sự lặp lại. Mỗi quy ước có **≥3 điểm ví dụ
(exemplar)** (đủ lặp lại để suy luận ra quy tắc) và **đúng 1 điểm lệch chuẩn (deviation)** đã cấy
sẵn (chỗ duy nhất nó bị phá vỡ) — cộng với 3 **decoy** (mồi nhử): những pattern có lặp lại nhưng
chỉ là gu phong cách, gắn cờ một decoy bị tính là false positive (báo động giả).

| ID | Mức | Quy ước không viết ra | Điểm lệch đã cấy |
|----|-----|------------------------|---------------------|
| C1 | dễ | Service trả về `Result` object (`{ok:true,value}\|{ok:false,reason}`), không bao giờ throw | một service throw lỗi |
| C3 | dễ | Timestamp là chuỗi UTC ISO, field tên `*AtUtc` | một file dùng `Date` local, field tên `createdAt` |
| C4 | vừa | Clock (đồng hồ) được inject (tiêm phụ thuộc); không module nào ngoài `clock.ts` gọi `Date.now()` | một service gọi `Date.now()` trực tiếp |
| C6 | vừa | Mọi `reason` lỗi phải là thành viên của `errorCodes.ts` | một file tự bịa một chuỗi lỗi tùy tiện |
| C9 | khó | `toDto()` của mọi mapper đều loại bỏ field nội bộ — cùng tên, cùng ý nghĩa ở mọi nơi | `toDto()` của một mapper để lọt một field dưới cùng cái tên (ý nghĩa đã lệch) |
| C10 | khó | Tiền luôn là số nguyên cent; không phép tính số thực (float) | một module tính `* 1.1` trên số đô la dạng float |

*(Đầy đủ 10 quy ước nằm trong spec; C2/C5/C7/C8 có hình dạng tương tự. Decoy: import xếp theo bảng
chữ cái, comment banner `// module:` đầu file, dùng nhất quán dấu nháy đơn — có thật, có lặp lại,
nhưng cố tình không đáng thành quy tắc.)*

**Đáp án (answer key)** — `manifest/orderly.json`, chứa exemplar, `file:line` của điểm lệch, và
rubric chấm điểm cho từng quy ước — nằm **ngoài** thư mục fixture và không bao giờ được copy vào
sandbox làm việc của agent. Quyết định đặt vị trí này là thứ khiến toàn bộ thiết kế còn lại đáng
tin: nếu agent đọc được manifest, nó sẽ "đạt" một cách tầm thường chỉ bằng cách chép lại đáp án.

## 3. Thuật ngữ — `arm` (nhánh điều kiện): cô lập biến số bạn sợ làm sai lệch phép đo

**Arm** là thuật ngữ chuẩn từ thử nghiệm lâm sàng có đối chứng ngẫu nhiên (randomized controlled
trial — RCT): một arm là một *điều kiện* thử nghiệm áp lên một phép đo vốn giống hệt nhau ở mọi mặt
khác — ví dụ nhánh điều trị (treatment arm) so với nhánh đối chứng/giả dược (control/placebo arm),
với độ chênh lệch giữa hai nhánh được quy về đúng một biến số khác nhau duy nhất. A/B testing chính
là ý tưởng này dưới tên khác (A và B là hai arm).

Biến số bị cô lập trong eval này là **bộ nhớ xung quanh (ambient memory)** — file project
`CLAUDE.md` và các setting phạm vi `.claude/` mà agent có thể đọc được trước cả khi nó nhìn vào
code. Rủi ro cụ thể mà cách làm này chặn lại, trích nguyên văn ý từ spec: *"một `CLAUDE.md` nói
'hãy inject clock' sẽ trao \[cho detector\] quy ước C4 miễn phí"* — agent sẽ "bắt được" quy ước
inject-clock vì nó *được cho biết trước*, chứ không phải vì nó tự suy luận từ code, và điểm recall
(độ bao phủ phát hiện) đó là điểm ảo. Vì vậy eval chạy mỗi detector ở hai arm:

```
arm clean = nhánh đối chứng: sandbox HOÀN TOÀN RỖNG — không CLAUDE.md, không bộ nhớ project
            .claude/, không user settings, không cấu hình MCP. Phép đo không thiên lệch.
            --> arm DUY NHẤT được dùng để chặn đạt/rớt (gate).

arm mem   = nhánh điều trị: cùng sandbox đó CỘNG THÊM một CLAUDE.md + bộ nhớ project thực tế
            (lệnh build, ghi chú style chung, mô tả dự án hư cấu) mà một meta-test (bài test
            kiểm tra chính bộ dữ liệu test) khẳng định có ĐỘ TRÙNG LẶP TỪ VỰNG BẰNG KHÔNG với
            mô tả các quy ước/decoy trong manifest.
            --> chỉ được báo cáo dưới dạng Δrecall / Δprecision (độ lệch recall/precision)
                so với clean, không bao giờ dùng để chặn đạt/rớt.
```

Chi tiết "được khẳng định bằng meta-test" quan trọng: nếu thiếu nó, một người sửa fixture bộ nhớ 6
tháng sau có thể vô tình để lọt một gợi ý đáp án vào, và eval sẽ âm thầm chuyển từ đo "agent có tự
suy luận ra quy ước không" sang đo "agent có đọc bộ nhớ của nó không" — đúng cái thiên lệch mà việc
tách arm này sinh ra để ngăn chặn.

## 4. Thuật ngữ — `leg` (chân đo): đặt tên cho từng đường đo lường độc lập

**Leg**, trong từ vựng riêng của thiết kế này (không phải thuật ngữ chuẩn ngành — đây là tên tự đặt
bởi chính spec này, cần nói thẳng điều đó), nghĩa là *một detector, trên một đối tượng*. Vòng lặp
tribe có đúng hai cửa phát hiện, nên có đúng hai leg:

- **Leg A — Scout trên code đang đứng yên (standing code).** Dispatch (điều phối chạy) đúng định
  nghĩa agent thật `agents/scout.md` lên toàn bộ fixture. Kỳ vọng nó gọi tên cả 10 quy ước đã cấy,
  chỉ ra điểm lệch, và đề xuất một ứng viên quy tắc — mà không gắn cờ nhầm bất kỳ decoy nào trong 3
  decoy.
- **Leg B — Tracker trên một diff.** Áp một patch chuẩn bị sẵn (`orderly-pr1.patch`, một PR "thêm
  endpoint hoàn tiền" khả tín) vi phạm 4 trong số các quy ước (C1, C4, C6, C10). Dispatch đúng định
  nghĩa agent thật `agents/tracker.md` lên diff đó. Hành vi **đúng** là báo cáo mỗi vi phạm dưới
  dạng **harness gap** — một sự kiện về việc bộ quy tắc đang im lặng — chứ không phải bịa ra một
  quy tắc rồi báo một vi phạm bịa đặt.

Có hai leg vì chúng đo **hai năng lực khác nhau của hai agent khác nhau**. Một điểm số gộp chung
(ví dụ "phát hiện 73%") sẽ che mất *cửa nào* đang hỏng nếu eval rớt — Leg A rớt nghĩa là Scout
không suy ra được quy ước từ sự lặp lại; Leg B rớt nghĩa là Tracker hoặc bỏ sót gap thật, hoặc tệ
hơn, bắt đầu bịa ra quy tắc. Đó là hai loại lỗi khác nhau ở hai agent khác nhau, cần hai cách sửa
khác nhau; một con số duy nhất không thể cho biết là lỗi nào.

## 5. Thuật ngữ — `cell` (ô): một cặp leg × arm, lặp lại để hấp thụ tính không xác định của LLM

**Cell** là thuật ngữ chuẩn của thiết kế thí nghiệm giai thừa (factorial design): trong một thiết
kế giai thừa, một *cell* là một tổ hợp mức của các nhân tố (factor) — ở đây là một cặp (leg, arm),
một ô vuông trong ma trận 2×2:

```
              arm clean            arm mem
Leg A     [ Scout · clean ]    [ Scout · mem ]
Leg B     [ Tracker · clean ]  [ Tracker · mem ]
```

Mỗi cell chạy **3 lần lặp (repetition)**, vì một lệnh gọi LLM đơn lẻ không xác định
(nondeterministic) — cùng một prompt trên cùng một fixture có thể ra báo cáo khác nhau ở các lần
chạy khác nhau. Một **lần lặp đạt (pass)** khi mọi gate của cell đó đều thỏa (mục 6); một **cell
đạt** khi **≥2/3** lần lặp đạt. Quy tắc đa số đó là cố ý: nó hấp thụ một lần chạy xui (hoặc may) mà
không để chuẩn bị đạt được chỉ nhờ may rủi thuần túy. Một lượt benchmark đầy đủ vì vậy là **2 leg ×
2 arm × 3 lần lặp = 12 lượt chạy detector**, mỗi lượt được chấm độc lập bởi một lệnh gọi LLM thứ
hai, không dùng tool (tool-less) — **12 lượt chấm điểm (grader run)** — chấm mỗi quy ước là `caught`
(bắt được) / `partial` (một nửa) / `missed` (bỏ sót) so với manifest.

## 6. Hợp đồng đạt/rớt bằng số — bảng gate thật sự

Đây là artifact (sản phẩm cụ thể) mà toàn bộ thiết kế phục vụ: một bảng cố định gồm 5 gate, trích
nguyên văn từ spec, được một script đánh giá trên `grading.json` — không có bước con người phán
đoán tại thời điểm chấm đạt/rớt.

| Gate | Cell | Ngưỡng |
|------|------|--------|
| G1 | Leg A · clean | recall ≥ **0.70** (chấm: `caught`=1, `partial`=0.5, trên tổng 10 quy ước) |
| G2 | Leg A · clean | precision ≥ **0.70**, với `precision = caught / (caught + decoys_flagged + invented)` |
| G3 | Leg A · clean | recall mức dễ (C1–C3) = **1.00** — mọi quy ước dễ, ở mọi lần lặp được tính |
| G4 | Leg B · clean | gap-recall ≥ **0.75** (≥3 trong 4 quy ước bị vi phạm phải được báo là gap) |
| G5 | Leg B · clean | số vi phạm bịa ra (invented-rule) = **0** — Tracker trích dẫn một quy tắc không tồn tại làm lần lặp đó rớt cứng, không có điểm một phần |

Hai lựa chọn thiết kế đáng nói rõ, vì dễ hiểu ngược:

- **Gate chỉ áp dụng cho arm `clean`.** Arm `mem` không bao giờ dùng để chặn đạt/rớt — nó chỉ tạo
  ra hai độ lệch được báo cáo (`Δrecall`, `Δprecision` so với clean). Nếu chặn đạt/rớt dựa trên
  `mem`, một detector có thể "đạt" chỉ bằng cách đọc bộ nhớ của chính nó thay vì đọc code — đúng
  thất bại mà mục 3 sinh ra để loại trừ.
- **Eval ĐẠT khi và chỉ khi cả hai cell clean đều đạt** (Leg A·clean **và** Leg B·clean, mỗi cái
  theo quy tắc 2/3). `benchmark.json` — artifact đầu ra duy nhất — mang số lần lặp đạt theo cell
  (`n/3`), cả hai độ lệch arm mem, và một `"pass": true|false` ở cấp cao nhất; **mã thoát (exit
  code)** của tiến trình phản chiếu đúng giá trị boolean đó, để một job CI có thể chặn dựa vào nó
  mà không cần bước đọc báo cáo nào cả.

```jsonc
// benchmark.json — hình dạng mà một script kiểm tra, không phải con người
{
  "legA_clean": { "reps_passed": 2, "reps_total": 3, "pass": true },
  "legB_clean": { "reps_passed": 3, "reps_total": 3, "pass": true },
  "legA_mem_delta": { "recall": +0.10, "precision": -0.05 },
  "legB_mem_delta": { "recall": +0.25, "precision": 0.00 },
  "pass": true
}
```

## 7. Điểm rút ra

1. **"Verification phải ra một con số, không phải văn xuôi."** Bảng gate ở mục 6 là hiện thân đúng
   nghĩa đen của nguyên tắc đó: một script đọc `grading.json`, không phải một người đọc một đoạn văn
   nói "trông ổn."
2. **Kiểm soát bộ nhớ xung quanh (ambient context), nếu không bạn đang đo sai thứ.** Bất kỳ lượt
   chạy eval nào có `CLAUDE.md`/bộ nhớ project thật đang hiện diện đều đo cả bộ nhớ lẫn model —
   tách nó thành một `arm` (mục 3) và chỉ chặn đạt/rớt trên arm không có bộ nhớ.
3. **Đặt tên cho từng đường đo lường.** Hai agent làm hai việc khác nhau cần hai `leg` (mục 4), để
   một thất bại khoanh vùng đúng vào một năng lực, thay vì ẩn trong một điểm trung bình gộp.
4. **Lặp lại + luật đa số hấp thụ tính không xác định mà không hạ thấp tiêu chuẩn.** 3 lần lặp,
   2/3 mỗi `cell` (mục 5) — một lần chạy may không thể một mình làm eval đạt, và một lần chạy rủi
   không thể một mình làm eval rớt.
5. **Giữ đáp án ngoài sandbox, và test luôn điều đó chứ đừng chỉ tuyên bố.** Manifest nằm ngoài
   thư mục fixture; một meta-test khẳng định độ trùng lặp từ vựng bằng không giữa fixture bộ nhớ
   của arm `mem` và văn bản mô tả quy ước trong manifest — nếu không, eval sẽ mục ruỗng âm thầm
   ngay lần đầu ai đó sửa một trong hai file.

## Nguồn

- `docs/superpowers/specs/2026-08-20-detection-eval-design.md` — repo todd-skills, worktree
  `detection-eval`; bản thiết kế đã duyệt, nguồn chính cho fixture, bảng gate và luồng chạy trong
  note này.
- "Arm" là thuật ngữ chuẩn của thử nghiệm lâm sàng / RCT — bất kỳ bảng thuật ngữ thử nghiệm lâm
  sàng nào (ví dụ glossary của NIH/FDA) đều định nghĩa arm là một nhóm/điều kiện trong thử nghiệm,
  được so sánh với nhóm khác để quy độ chênh lệch về đúng một biến số.
- Thiết kế thí nghiệm giai thừa (factorial design) — các giáo trình thiết kế thí nghiệm chuẩn định
  nghĩa *cell* là một tổ hợp mức của các nhân tố trong thiết kế đa nhân tố; note này áp dụng định
  nghĩa đó cho ma trận 2×2 (leg × arm).
