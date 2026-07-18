---
title: "Đừng Tin Bundle Rule: A/B Eval Từng Thành Phần Trước Khi Ship"
description: "Tui dán một mớ gợi ý từ Gemini vô global Claude rules, kèm luôn dòng tui khoái nhất — làm một lượt luôn. Output tốt hơn thiệt, nhưng hỏi tại sao thì chịu. Nên tui làm hẳn một eval A/B 30 run cho ra lẽ, và dòng tui khoái nhất hóa ra là cái vô dụng nhất."
pubDatetime: 2026-07-18T09:00:00Z
lang: vi
tags:
  - prompt-engineering
  - evals
  - llm-judge
  - ai-agents
  - claude-code
  - vietnamese
multiLangKey: "explaining-rules-ab-eval"
---

Tui có viết một đoạn chỉ dẫn đứng (standing instruction) cho các phiên LLM, với một điều khoản "Antigoal": mọi thuật ngữ mới phải được dẫn nhập kèm ngữ cảnh — phòng thủ trực tiếp trước cái gọi là **Curse of Knowledge** (lời nguyền tri thức), tức thói quen LLM hay viết kiểu chuyên gia-nói-với-chuyên gia, thả jargon (thuật ngữ chuyên môn) mà chẳng thèm dẫn nhập gì hết. Một phiên Gemini, lúc được nhờ review đoạn chỉ dẫn đó, gợi ý tái cấu trúc lại và lập luận rằng LLM tuân theo chỉ dẫn **khẳng định** (affirmative — "làm X") đáng tin hơn chỉ dẫn **phủ định** (negated — "đừng làm Y"). Tui thấy hay, dán thẳng vô global rules kèm luôn dòng tự viết của mình — rồi ship, không test gì hết.

Đó là cái sai bài này nói tới, và cách tui quay lại sửa bằng một eval thiệt.

---

## Tóm tắt nhanh (TL;DR)

- Một bundle "chạy tốt" **không nói được thành phần nào** mới thực sự có công. Tui dán gợi ý từ một phiên Gemini vô global Claude rules **cùng lúc** với dòng tự viết của mình ("ground claim with truth, code or fact"). Output tốt hơn — nhưng không biết vì sao. Giả thuyết lúc đó của chính tui ("có thể là do câu ground claim") hóa ra sai.
- Một phiên Claude.AI sau đó kiểm tra hai luận điểm học thuật đứng sau đề xuất tái cấu trúc (chỉ dẫn khẳng định tốt hơn chỉ dẫn phủ định; persona prompting — mớm cho model một vai trò/nhân dạng), thấy cả hai đều có thật nhưng đã cũ (2022 / 2024), và thiết kế hẳn một **bộ A/B eval** thay vì ship thêm rule dựa trên cảm tính.
- Một phiên Claude Code xác minh lại cả 4 trích dẫn gốc (**đều đúng**), bổ sung thêm tài liệu 2025–26 mà lượt trước chưa có, rồi chạy eval thiệt: **5 arm (nhánh) × 3 prompt × 2 lần lặp = 30 run**, chấm mù (blind) bởi một model khác.
- **Kết quả: dòng tui tâm đắc nhất lại vô dụng.** Rule kỷ luật thuật ngữ (term-discipline, A2) mới là thành phần chủ lực cho mật độ thuật ngữ không định nghĩa (−56% khi đứng một mình); dòng grounding của tui (A1) đứng một mình **không** giúp gì cho metric đó. Cặp A3 = A1+A2 thắng ở mọi metric. Một rule ứng viên thứ tư (khung "reader-model" — giả định trình độ người đọc, A4) làm **tệ đi** metric chính và bị loại.
- **Ba lỗi hạ tầng eval bị bắt được giữa chừng** (nhiễm skill có sẵn, trùng seed ID mù, LLM grader đếm thừa) — mỗi lỗi nếu không phát hiện sẽ âm thầm làm sai lệch số liệu. Chỉ cặp A3 sống sót được ship, kèm số liệu và biên độ ngay trong skill (`todd-skills` PR #43, plugin `explaining`, đã merge ngày 2026-07-18).

---

## 1. Cái ngứa ban đầu

Tui có viết một prompt cho các phiên LLM với một điều khoản "Antigoal": mọi thuật ngữ mới phải được dẫn nhập kèm ngữ cảnh — phòng thủ trực tiếp trước **Curse of Knowledge**, thói quen LLM hay viết kiểu chuyên gia-nói-với-chuyên gia, thả jargon mà không dẫn nhập. Một phiên Gemini, lúc được nhờ review prompt đó, gợi ý tái cấu trúc thành 3 template (Guidelines + Anti-goals, persona, direct rules), với lập luận rằng LLM tuân theo chỉ dẫn khẳng định ("làm X") đáng tin hơn chỉ dẫn phủ định ("đừng làm Y").

## 2. Sai lầm gộp bundle

Tui dán gợi ý từ Gemini vô global Claude rules **và** thêm luôn dòng tự viết của mình ("ground claim with truth, code or fact") — trong cùng một lần sửa. Output tốt hơn. Nhưng thành phần nào có công? Không biết — các biến chưa từng được tách riêng. Lời của chính tui lúc đó: *"có thể là do câu ground claim"* — một giả thuyết, chưa phải một phát hiện. Biến thể persona còn lan qua `CLAUDE.md` của một repo thứ hai: bundle đã trôi giạt thành 2 bản khác nhau trước khi ai kiểm tra xem phần nào trong đó thật sự có ích.

Hồi đó tui tin cái dòng grounding là chân ái. Sai khá nặng — chuyện đó tới cuối bài mới lòi ra.

## 3. Lượt xác minh (Claude.AI)

Một phiên Claude.AI kiểm tra các luận điểm đứng sau đề xuất tái cấu trúc, đối chiếu nguồn gốc:

- **(a) khẳng định tốt hơn phủ định** dựa trên Jang, Ye & Seo 2022, "Can Large Language Models Truly Understand Prompts? A Case Study with Negated Prompts" (arXiv:2209.12711) — có thật, nhưng test trên model đời 2022 (OPT, GPT-3, InstructGPT), ở mức **phủ định cấp tác vụ** (task-level negation — "đừng trả lời câu này"), không phải ràng buộc phong cách kiểu "đừng dùng jargon".
- **(b) persona prompting** không cải thiện đáng tin hiệu năng tác vụ dựa-trên-sự-thật — Zheng et al. 2024, "When 'A Helpful Assistant' Is Not Really Helpful…", Findings of EMNLP 2024 (arXiv:2311.10054): hiệu ứng từng persona lên tác vụ factual gần như ngẫu nhiên.

Từ đó nó thiết kế một bộ A/B (các arm + metric, bên dưới) và một skill khung sườn, **từ chối ship rule khi chưa có số liệu** — quyết định đúng, vì sau này eval đã bác bỏ chính thành phần tui tâm đắc nhất.

## 4. Xác minh lại độc lập

Một phiên Claude Code xác minh lại cả 4 trích dẫn gốc — **đều đúng** — và bổ sung tài liệu 2025–26 mà lượt bàn giao trước chưa có:

- Rana 2026, "Semantic Gravity Wells: Why Negative Constraints Backfire" (arXiv:2601.08070, tháng 1/2026) — 87.5% các vi phạm phủ định là **lỗi priming** (mồi): gọi tên thứ bị cấm lại kích hoạt chính nó.
- "Negation: A Pink Elephant in the LLMs' Room?" (arXiv:2503.22395).
- Elkins & Chun, "Framing Instability…" (arXiv:2601.21433) — độ đồng thuận giữa các model rớt từ 73% → 59% khi có phủ định.
- Zhou et al. 2023, "Instruction-Following Evaluation for Large Language Models" (IFEval, arXiv:2311.07911).
- Zheng et al. 2023, "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena", NeurIPS 2023 D&B — thiên lệch của LLM-judge (dài dòng, thiên vị chính mình), liên quan trực tiếp tới cách grader của chính eval này được thiết lập (§6).

**Kết luận chung:** lưu ý trước đó ("chưa được nghiên cứu trên model hiện đại") đã lỗi thời tính tới 2026 — bằng chứng mới **củng cố thêm** việc ưu tiên diễn đạt khẳng định thay vì ràng buộc phủ định, chứ không chỉ để ngỏ câu hỏi.

## 5. Thiết kế eval

Theo bộ kit đã thiết kế ở §3:

- **5 arm:** A0 không rule; A1 = nguyên văn dòng grounding của tui; A2 = rule kỷ luật thuật ngữ (define/dẫn nhập ở lần dùng đầu); A3 = A1+A2; A4 = A3 + một dòng "reader-model" ("Reader: senior .NET backend developer… chỉ định nghĩa thuật ngữ ngoài baseline đó").
- **3 prompt cố định:** P1 NATS JetStream acks, P2 .NET `Channel<T>` backpressure, P3 Claude API prompt caching.
- **Cách ly:** mỗi cell (ô eval) = một `claude -p` mới, cwd trắng tinh, `--setting-sources project --strict-mcp-config` (để global rules của chính tui khỏi lây vô baseline), text rule bơm qua `--append-system-prompt`. Model sinh: Opus 4.8. 2 lần lặp → **30 run**.
- **Chấm điểm:** output bị mù bằng ID ngẫu nhiên, chấm bởi Sonnet (model khác, phiên mới cho mỗi file) với rubric chỉ đếm số; ~13% được kiểm tra tay.
- **Metric:** M1 = số thuật ngữ chưa định nghĩa / 1k từ (↓ tốt hơn); M2 = số khẳng định trừu tượng có grounding / tổng số (↑ tốt hơn); M3 = số thuật ngữ baseline bị giải thích thừa (↓ tốt hơn).

## 6. Ba lỗi hạ tầng đáng nhớ (suýt làm eval nói dối)

Ba lỗi này phát hiện được giữa lúc chạy, đáng có riêng một mục — chúng âm thầm làm sai số liệu eval nếu không bắt được:

- **Nhiễm skill có sẵn (built-in).** Cả 10 run P3 (chủ đề prompt-caching) đều kích hoạt skill `claude-api` có sẵn của Claude Code → sinh ra tool call, và 2 run trả về từ chối kiểu meta thay vì giải thích. P3 bị **loại khỏi phân tích sạch**. Bài học: một phiên `claude -p` "cách ly" vẫn mang theo skill có sẵn; một chủ đề trúng skill sẽ phá hỏng cả cell.
- **Trùng seed ID mù.** Script làm mù dùng RNG với seed hằng số → batch thứ hai (run Fable transfer, §8) rút ra **cùng** ID ngẫu nhiên như batch đầu → grader bỏ qua hết (điểm đã tồn tại sẵn cho các ID đó) và điểm cũ âm thầm giả làm kết quả mới. Bắt được vì số liệu giống hệt nhau theo từng file giữa hai batch lẽ ra phải độc lập. Bài học: seed theo batch tag; xem cache kiểu "skip existing" là một cái bẫy.
- **LLM grader đếm thừa.** Kiểm tra tay phát hiện grader đếm cả câu cụt (ví dụ "Your p99 is destroyed") là "thuật ngữ chưa định nghĩa", và một lần liệt một thuật ngữ đã được định nghĩa rõ thành chưa định nghĩa. Nhiễu này áp lên mọi arm gần như đều nhau, nên **so sánh vẫn đứng vững**, nhưng số tuyệt đối bị thổi phồng. Bài học: số của LLM-judge mang tính **so sánh, không phải tuyệt đối**.

## 7. Kết quả — các run sạch

Chỉ tính P1+P2 (P3 bị loại theo §6), n=4/arm, Opus 4.8, trung bình ±sd:

| Arm | M1 undef/1k ↓ | M2 grounding ↑ | M3 over-expl ↓ | words |
| --- | --- | --- | --- | --- |
| A0 baseline | 12.18 ±4.30 | 0.38 ±0.12 | 0.25 ±0.50 | 823 |
| A1 grounding only | 11.17 ±7.69 | 0.44 ±0.32 | 0.25 ±0.50 | 820 |
| A2 term-discipline only | 5.41 ±2.93 | 0.43 ±0.27 | 1.25 ±1.50 | 780 |
| **A3 both** | **4.06 ±3.13** | **0.47 ±0.18** | **0.75 ±0.96** | 908 |
| A4 + reader-model | 10.04 ±4.27 | 0.42 ±0.09 | 0.75 ±0.96 | 1071 |

A2 là thành phần chủ lực cho M1 (−56% khi đứng một mình) nhưng làm tăng gấp đôi over-explanation khi đứng một mình; A1 đứng một mình **không** làm gì cho M1 (giả thuyết "có thể do câu grounding" của tui **bị bác bỏ** với vai trò động lực chính — nó chỉ giúp nhẹ cho M2); A3 (cặp đôi) áp đảo (−67% M1, M2 tốt nhất, M3 được kìm lại); dòng reader-model của A4 làm **tệ đi** M1 và làm tăng độ dài +18% — bị bác bỏ.

## 8. Chuyển giao qua Fable 5

A0 so với A3, P1+P2, n=4: A0 M1 = 8.92 ±3.49; A3 M1 = 8.20 ±1.34. Baseline của Fable vốn đã gần mức của rule; cặp A3 chủ yếu **thu hẹp phương sai** (tính nhất quán), không gây hại đo được (M2 0.50→0.52; M3 0.50→0.75, nằm trong nhiễu). Kết luận thành thật: **độ lớn hiệu ứng phụ thuộc vô model** — lợi ích lớn nhất trên model mặc định hay dùng jargon (Opus), lợi ích nhất quán ở model khác.

## 9. Cái gì được ship

`todd-skills` PR #43 — plugin `explaining` (một skill), chỉ ship **duy nhất** cặp A3 + bước tự kiểm + một ghi chú bằng chứng kèm số liệu và biên độ của chúng. Bị loại: rule reader-model (bị A4 bác bỏ), khung persona (bị arXiv:2311.10054 bác bỏ), và một rule "điều kiện dừng" chưa được test (M3 dư ra = 0.75 được ghi lại như một giới hạn đã biết, thay vì bị "sửa" bằng một rule chưa kiểm chứng). Fixture hồi quy nằm ở `plugins/explaining/evals/evals.json` (đúng khuôn eval-harness của repo). Bằng chứng đầy đủ: `docs/superpowers/evidence/2026-07-18-explaining-skill-ab-eval.json` (30 dòng dữ liệu từng run, phương pháp sinh/chấm, và log quyết định).

PR trải qua hai vòng review độc lập trước khi merge: một **rules reviewer** bắt được lỗi sai component id trong ADR (`c3-218` → `c3-201`), thiếu wiring C3 architecture-doc / codemap cho `plugins/explaining/**`, và một lỗi lệch category; một **adversarial auditor** độc lập xác nhận cùng nhóm lỗi đó. Tất cả được sửa và xác minh lại trước khi merge — một minh chứng nhỏ, ngay trong tooling của chính dự án, cho nguyên tắc "xác minh trước khi ship" mà bản thân cái eval này đang nói tới. PR #43 merge bằng một merge commit 2-cha bình thường `98b35db`; skill giờ đã sống trên máy này qua `~/.claude/skills/explaining` → thư mục skill của plugin, nên nó tự áp dụng cho các phiên làm việc kể từ giờ.

---

## Đúc kết chính

1. Một bundle "chạy tốt" không nói được **phần nào** thực sự có công; thành phần tui tâm đắc nhất hóa ra vô dụng với metric chính.
2. Xác minh ≠ cảm tính: 2/4 rule ứng viên chết khi va vô dữ liệu thật; những rule sống sót mang theo số liệu ngay trong skill đã ship, để mọi chỉnh sửa sau này vẫn phải qua cửa bằng chứng.
3. Hạ tầng eval có thể hỏng âm thầm (nhiễm skill có sẵn, trùng ID, grader đếm thừa) — việc eval lại chính cái eval quan trọng không kém bản thân eval.
4. Rà lại tài liệu: ưu tiên chỉ dẫn khẳng định hơn ràng buộc phủ định và persona — giờ có thêm nghiên cứu cơ chế 2025-26 hậu thuẫn, không chỉ dừng ở inverse-scaling 2022.

Bài học cay nhất với tui: cái dòng tui khoái nhất, tự tay viết, lại là cái vô dụng nhất khi đo bằng số. Vậy nên giờ tui không tin "nghe có lý" nữa — tui tin cái bảng số.

## Nguồn

- Jang, Ye & Seo 2022, "Can Large Language Models Truly Understand Prompts? A Case Study with Negated Prompts", arXiv:2209.12711 — <https://arxiv.org/abs/2209.12711>
- Zheng et al. 2024, "When 'A Helpful Assistant' Is Not Really Helpful…", Findings of EMNLP 2024, arXiv:2311.10054 — <https://arxiv.org/abs/2311.10054>
- Zhou et al. 2023, "Instruction-Following Evaluation for Large Language Models" (IFEval), arXiv:2311.07911 — <https://arxiv.org/abs/2311.07911>
- Rana 2026, "Semantic Gravity Wells: Why Negative Constraints Backfire", arXiv:2601.08070
- Elkins & Chun 2026, "Framing Instability in LLM Ethical Stance…", arXiv:2601.21433
- "Negation: A Pink Elephant in the Large Language Models' Room?", arXiv:2503.22395
- Zheng et al. 2023, "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena", NeurIPS 2023 D&B
- Bằng chứng đầy đủ và skill đã ship: repo `todd-skills`, PR #43 (đã merge, commit `98b35db`), `docs/superpowers/evidence/2026-07-18-explaining-skill-ab-eval.json`
