---
title: "Rubric sẵn sàng: khi nào một PR được merge mà không cần test tay"
description: "Chấm điểm diff, không phải repo. Phần khép lại series đưa ra thẻ điểm sáu chiều, thang bậc tự trị L0→L3, và quy trình quyết định để biết khi nào một thay đổi thực sự an toàn để agent merge mà không cần kiểm thử thủ công."
pubDatetime: 2026-07-01T00:05:00Z
lang: vi
tags:
  - testing
  - mutation-testing
  - ci-cd
  - agentic-ai
  - vietnamese
multiLangKey: "test-quality-metrics-6"
---

> **"Vượt ra ngoài Code Coverage — Metric chất lượng test cho vòng lặp agentic" — Phần 6/7 (khép lại series).** Rubric sẵn sàng cho merge gate agentic: chấm điểm diff, thang bậc tự trị, và checklist một màn hình để biết khi nào một thay đổi an toàn để merge mà không cần con người kiểm thử tay. Tiếp theo [Phần 5](/memo/posts/test-quality-part-5-grading-ai-tests-vi/) về chấm điểm test AI.

- Chấm điểm **diff**, không phải repo. Một thay đổi an toàn để merge mà không cần kiểm thử thủ công khi, trên các dòng nó chạm vào: mutation score ≥ 80%, diff coverage ≥ 90%, không có test smell, flakiness ≈ 0%, và các đường dẫn quan trọng mang oracle mạnh (mutation + property).
- Bạn đạt đến vòng lặp **theo từng module**, cứng hóa các viên ngọc quý trước — không bao giờ bằng cách đuổi theo một con số toàn repo.
- Bước nhảy thực sự mang lại vòng lặp là **L1 → L2**: thêm cổng _mutation_, thứ dừng các merge được kiểm thử _vô nghĩa_ — bao gồm cả test vô nghĩa của AI.

---

## 1. Thẻ điểm (áp dụng theo từng PR, vào code thay đổi)

| Chiều                      | Metric                                             | 🔴 Chưa sẵn sàng | 🟡 Có thể chấp nhận | 🟢 Sẵn sàng cho vòng lặp       |
| -------------------------- | -------------------------------------------------- | ---------------- | ------------------- | ------------------------------ |
| **Độ mạnh oracle** ★       | Mutation score trên diff                           | < 50%            | 60–75%              | **≥ 80%**                      |
| **Thay đổi được thực thi** | Diff / changed-line coverage                       | < 60%            | 70–80%              | **≥ 90%**                      |
| **Assertion tồn tại**      | Mật độ assertion + scan smell                      | có smell         | ≥1 assert/test      | **0 smell, mang tính hành vi** |
| **Độ tin cậy**             | Flakiness (rerun 5×)                               | > 1%             | ≤ 0.5%              | **≈ 0%, flake được cách ly**   |
| **Đường dẫn quan trọng**   | Mutation + property test trên money/auth/data-loss | có khoảng trống  | được phủ            | **≥ 90% mutation + bất biến**  |
| **Tốc độ**                 | Thời gian chạy bộ test + diff-mutation             | nhiều giờ        | ~10 phút            | **diff-scoped, vài phút**      |

![Thẻ điểm sẵn sàng: sáu chiều từ độ mạnh oracle đến tốc độ, mỗi chiều có ngưỡng đỏ/vàng/xanh](/memo/diagrams/test-quality-metrics/05-readiness-scorecard.svg)
_Sáu chiều, chấm trên diff chứ không phải toàn repo — một PR chỉ "sẵn sàng cho vòng lặp" khi cả sáu đều xanh._

Đây là **giá trị mặc định khởi đầu** (baseline `high:80 / low:60` của Stryker.NET; diff gate của Meta/ngành), cần được **tinh chỉnh theo rủi ro của từng module** — không phải là quy luật tự nhiên. Đường dẫn thanh toán nên chặt hơn; một helper logging có thể lỏng hơn.

## 2. Thang bậc tự trị — kiếm từng bậc bằng bằng chứng

Bạn không lật một công tắc sang "tự trị." Bạn leo lên:

- **L0 · Thủ công** — chỉ có coverage, có smell, flaky. Con người kiểm thử mỗi PR. _(Hầu hết code kế thừa bắt đầu ở đây.)_
- **L1 · Có hỗ trợ** — diff-coverage gate + smell scan là xanh. Con người vẫn review và kiểm thử nhẹ.
- **L2 · Tự động có giám sát** — diff-**mutation** gate xanh + ngân sách flakiness được giữ. Merge khi xanh, con người spot-check.
- **L3 · Tự trị** — tất cả sáu chiều thẻ điểm xanh trên diff, các đường dẫn quan trọng mang property. **Không cần kiểm thử thủ công trước khi merge.**

Bước nhảy thực sự mang lại vòng lặp là **L1 → L2**: thêm cổng _mutation_. Cổng coverage (L1) dừng các merge rõ ràng chưa được kiểm thử; cổng mutation (L2) dừng các merge được kiểm thử _vô nghĩa_ — bao gồm cả các test vô nghĩa của AI ([Phần 5](/memo/posts/test-quality-part-5-grading-ai-tests-vi/)).

## 3. "Bộ test kế thừa của tôi có đủ tốt không?" — quy trình quyết định

Chạy quy trình này, theo thứ tự, giới hạn phạm vi vào code mà một thay đổi cụ thể chạm vào:

1. **Coverage bằng không?** Bất kỳ dòng thay đổi/quan trọng nào ở 0% → chưa sẵn sàng. _(Coverlet / `go test -cover`.)_ Rẻ, làm trước.
2. **Mutant sống sót?** Chạy mutation diff-scoped (`stryker --since` / `gremlins --diff`). **Đọc các survivor.** Mỗi cái là assertion hoặc trường hợp còn thiếu. Zero survivor không tương đương trên diff = tín hiệu mạnh bạn muốn.
3. **Scan smell sạch?** Không có test assertion-free, magic-number, conditional-logic, hoặc act-assert-mismatch trên thay đổi.
4. **Đường dẫn quan trọng được cứng hóa?** Đối với money/auth/data-loss, có test _property/bất biến_ không, không chỉ là ví dụ?
5. **Không flake và nhanh?** Ổn định qua rerun 5×; lần chạy hoàn thành trong vài phút.

Nếu 1–5 pass trên diff, thay đổi đó **sẵn sàng cho vòng lặp** ngay cả khi _phần còn lại_ của repo kế thừa là đầm lầy. Đó là toàn bộ ý nghĩa: **bạn không cần phải sửa toàn bộ repo kế thừa để bắt đầu vòng lặp — bạn cần phải sửa blast radius của mỗi thay đổi.**

## 4. Chiến lược triển khai cho codebase kế thừa

1. **Chọn các viên ngọc quý.** Xác định các module nơi một lỗi âm thầm là thảm họa. Ví dụ trong một hệ thống thanh toán hoa hồng cho đối tác: **tính toán** hoa hồng, điều phối **đợt thanh toán định kỳ (payment run)** hàng tuần, **idempotency thanh toán** (tính duy nhất của mã tham chiếu giao dịch), các quy tắc **due-date**, làm tròn tiền (`decimal(18,2)`).
2. **Thiết lập baseline.** Chạy mutation một lần trên các module đó. Danh sách survivor _là_ backlog cứng hóa test của bạn — được ưu tiên theo rủi ro, được trao cho bạn (hoặc agent) miễn phí.
3. **Bật diff gate** (`--since` / `--diff`) trong CI cho các module đó ở ngưỡng L2.
4. **Thêm property vào toán học.** Các bất biến trên đầu vào được tạo ra ("paid ≤ owed", "rounding bảo toàn xu", "due date luôn rơi vào đúng ngày trong chu kỳ") bắt được các lớp lỗi mà ví dụ bỏ lỡ.
5. **Cách ly flake không thương tiếc.** Cổng flaky là không có cổng. Logic phụ thuộc thời gian (`DateTime.Now`, tính toán ngày đến hạn theo chu kỳ) thường là thủ phạm — inject clock để test xác định.
6. **Mở rộng ra ngoài** theo từng module. Theo dõi _coverage của diff_ và _mutation score của diff_ theo thời gian, không phải tỷ lệ toàn repo.
7. **Kết nối gauntlet AI** ([Phần 5](/memo/posts/test-quality-part-5-grading-ai-tests-vi/)): các test do agent tạo ra phải kill một mutant mới để merge.

## 5. "Đủ test" cuối cùng có nghĩa là gì

Không phải một con số coverage. **Đủ** là khi, đối với code bạn đang thay đổi:

> **không có mutant không tương đương sống sót**, **các assertion mang tính hành vi và không có smell**, **các bất biến quan trọng là property**, và **bộ test nhanh và không có flake** — vì vậy một build xanh là bằng chứng thực sự rằng thay đổi an toàn.

Khi điều đó đúng với một module, bạn có thể để agent thay đổi module đó và merge khi xanh mà không cần kiểm thử thủ công — vì _phép đo_, không phải sự tự tin của model, là thứ đang bảo lãnh cho thay đổi. Đó là vòng lặp agentic đầy đủ, được kiếm chứ không phải được giả định.

## 6. Checklist một màn hình (ghim cái này)

```
PER-PR MERGE-GATE (scoped to the diff)
[ ] Diff coverage ≥ 90%            (Coverlet / go test -cover)
[ ] No coverage zeros on changed/critical lines
[ ] Diff mutation score ≥ 80%      (Stryker --since / gremlins --diff)
[ ] Zero surviving non-equivalent mutants on changed lines
[ ] Smell scan clean (no assertion-free / magic-number / cond-logic / act-assert mismatch)
[ ] Critical paths: property/invariant tests present (FsCheck/CsCheck · gopter/rapid)
[ ] Flakiness ≈ 0 (5× rerun stable); time/network injected, not ambient
[ ] Gate runs in minutes (diff-scoped, baseline/incremental)
[ ] AI-generated tests: each kills ≥1 new mutant; oracle traces to spec, not current code
```

---

← [Phần 5: Chấm điểm test do AI viết](/memo/posts/test-quality-part-5-grading-ai-tests-vi/) · [Bắt đầu lại từ Phần 0: Vì sao Code Coverage đánh lừa bạn](/memo/posts/test-quality-part-0-why-coverage-lies-vi/)

---

**Nguồn tham khảo:**

- Stryker.NET thresholds/flags (defaults `high:80/low:60`): https://stryker-mutator.io/docs/stryker-net/configuration/ _(theo tài liệu; không được xác minh lại độc lập trong lần chạy này)._
- Diff-based industrial mutation: _State of Mutation Testing at Google_, https://research.google/pubs/state-of-mutation-testing-at-google/ _(đã xác minh 2-1)._
- AI-test gating on mutants not coverage: Meta TestGen-LLM & follow-up, https://arxiv.org/abs/2402.09171 · https://arxiv.org/abs/2501.12862.
- Incremental gate starting points (achievable diff thresholds, raise over time): practitioner guidance, https://getautonoma.com/blog/quality-gate-vibe-coding.
