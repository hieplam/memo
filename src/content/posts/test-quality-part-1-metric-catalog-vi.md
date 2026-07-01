---
title: "Danh mục metric chất lượng test: đọc bộ test của bạn như một cái tháp bốn tầng"
description: "Không có một con số duy nhất nào là 'chất lượng test'. Phần này đề xuất đọc bộ test của bạn như một stack bốn tầng — reachability, effectiveness, risk targeting, trust & health — trong đó tầng quyết định là mutation score, không phải coverage."
pubDatetime: 2026-07-01T00:05:00Z
lang: vi
tags:
  - testing
  - code-coverage
  - mutation-testing
  - test-metrics
  - vietnamese
multiLangKey: "test-quality-metrics-1"
---

> **"Vượt ra ngoài Code Coverage — Metric chất lượng test cho vòng lặp agentic" — Phần 1/7.** Một danh mục có hệ thống cho mọi metric chất lượng test, sắp xếp thành bốn tầng theo câu hỏi chúng thực sự trả lời. Tiếp theo [Phần 0](/memo/posts/test-quality-part-0-why-coverage-lies-vi/), nơi ta đã thấy coverage chỉ là nền, không phải trần.

- Đọc bộ test như một **stack bốn tầng**: Reachability (coverage) → Effectiveness (oracle) → Risk targeting (diff/critical-path) → Trust & health (flakiness/tốc độ).
- Tầng quyết định "tốt" là **Effectiveness**, đo bằng **mutation score**, chất lượng assertion, và việc không có test smell.
- Bạn xây stack từ dưới lên và kiểm soát cổng từ dưới lên: sửa coverage-zero trước, chứng minh độ mạnh oracle, rồi mới hướng vào diff và đường dẫn quan trọng.

---

## 1. Cách tư duy: bốn tầng, bốn câu hỏi

| Tầng                    | Câu hỏi nó trả lời                                          | Metric chính                                                                            | Loại chỉ báo                       |
| ----------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------- |
| **1 · Reachability**    | Test có _chạy qua_ code này không?                          | Line/statement, branch/condition, MC/DC coverage                                        | **Chỉ âm** (thấp = xấu; cao ⇏ tốt) |
| **2 · Effectiveness** ★ | Test có _nhận ra_ nếu code sai không?                       | **Mutation score**, mật độ & chất lượng assertion, không có test smell                  | **Dương** — đây là "tốt"           |
| **3 · Risk targeting**  | Các phần _thay đổi_ và _quan trọng_ có được kiểm thử không? | Diff/changed-line coverage, critical-path coverage, property-based testing              | Dương (có phạm vi)                 |
| **4 · Trust & health**  | Tín hiệu có đủ đáng tin cậy để kiểm soát merge không?       | Tỷ lệ flakiness (tính bất định/chập chờn), tốc độ bộ test, tính xác định, pass-on-rerun | Điều kiện tiên quyết cho cổng      |

![Stack bốn tầng của metric chất lượng test: Reachability, Effectiveness, Risk targeting, Trust & health](/memo/diagrams/test-quality-metrics/03-metric-stack.svg)
_Mỗi tầng trả lời một câu hỏi khác nhau; leo từ dưới lên, và chỉ tin cậy tầng trên khi tầng dưới đã vững._

Bạn xây dựng stack **từ dưới lên** và kiểm soát cổng **từ dưới lên**: sửa các chỗ có coverage bằng không, sau đó chứng minh độ mạnh oracle, sau đó hướng vào diff và các đường dẫn quan trọng, và chỉ tin tưởng nó để kiểm soát merge khi nó đã đáng tin cậy.

## 2. Tầng 1 — Reachability (họ metric coverage)

- **Line / statement coverage** — % câu lệnh được thực thi. Thô nhất. Dễ gian lận nhất.
- **Branch / condition coverage** — % kết quả quyết định (true _và_ false) được thực thi. Mạnh hơn line, nhưng vẫn chỉ là thực thi. Lưu ý: chỉ nhất quán với mutation ở khoảng 47% số class ([Phần 0](/memo/posts/test-quality-part-0-why-coverage-lies-vi/)).
- **MC/DC (Modified Condition/Decision Coverage)** — mỗi điều kiện boolean con được chứng minh độc lập ảnh hưởng đến kết quả. Bắt buộc trong avionics an toàn-tới hạn (DO-178C). Mạnh về mặt cấu trúc, nhưng _vẫn_ chỉ trả lời "đây có được thực thi không?", không phải "kết quả sai có bị bắt không?"

**Sử dụng:** chỉ báo âm + mẫu số cho biết công cụ mutation biết nơi nào đáng đặt mutant.

## 3. Tầng 2 — Effectiveness (tầng oracle) ★

Đây là trái tim. Các metric này đo lường liệu **assertion** có thể bắt được một regression.

![Khoảng cách giữa coverage và mutation score — tầng Effectiveness đo đúng thứ Reachability bỏ sót](/memo/diagrams/test-quality-metrics/02-oracle-gap.svg)
_Reachability chỉ nói code có chạy hay không; Effectiveness mới nói test có bắt được lỗi hay không — đó là khoảng cách oracle từ Phần 0._

- **Mutation score** — đưa các lỗi nhỏ ("mutant") vào code; điểm là % mà bộ test _kill_ (phát hiện thông qua test thất bại). Đây là proxy trực tiếp nhất cho "các test của tôi có bắt được lỗi ở đây không?" Được giải thích đầy đủ trong **[Phần 2](/memo/posts/test-quality-part-2-mutation-testing-vi/)**. Lưu ý sự trung thực: mutation score là **công cụ chẩn đoán mạnh mẽ về độ mạnh oracle**, nhưng _không phải_ là oracle dự đoán lỗi thực tế độc lập — xem **[Phần 3](/memo/posts/test-quality-part-3-empirical-evidence-vi/)**.
- **Assertion density** — số assertion trên mỗi test. Cảnh báo thô nhưng hữu ích: một test với **zero** assertion không xác minh gì cả (mùi _Assertion-Free Test_), nhưng vẫn tính vào coverage. Mật độ một mình có thể bị gian lận (bạn có thể thêm assertion yếu), vì vậy hãy kết hợp với mutation score.
- **Chất lượng assertion** — assertion có kiểm tra _hành vi_ (đầu ra/hợp đồng dự kiến) hay _triển khai_ (nội bộ ngẫu nhiên)? Một test oracle (bộ phán định kết quả) _mạnh_ "phát hiện sai lệch so với hành vi chương trình dự kiến"; tính đúng đắn (không có báo động giả) và độ mạnh là **trực giao** — một oracle đúng vẫn có thể yếu. <sup>[oracle]</sup>
- **Không có test smell (mùi mã test)** — không có các mùi được ghi chép kỹ lưỡng làm hỏng thầm lặng khả năng phát hiện lỗi:
  - _Assertion-Free Test_ / _Empty Test_ — không có xác minh. Một test rỗng "nguy hiểm hơn là không có test" vì framework báo cáo nó là **đang pass**. <sup>[smells]</sup>
  - _Test Tautology_ — các assertion đã được định trước về mặt logic là sẽ pass.
  - _Assertion Roulette_ — nhiều assert không có nhãn; khi thất bại bạn không biết cái nào bị hỏng.
  - _Eager Test_ — một test thực hiện nhiều hành vi, nên khi thất bại là mơ hồ.
  - _Mystery Guest_ / _Magic Number Test_ / _Conditional Test Logic_ / _Sleepy Test_ (`sleep` tùy ý). Danh mục chuẩn liệt kê ~19 loại. <sup>[smells]</sup>

## 4. Tầng 3 — Risk targeting

Effectiveness tốn kém; hãy chi nó ở nơi quan trọng.

- **Diff / changed-line coverage** — trong các dòng mà PR này thay đổi, bao nhiêu được kiểm thử? Đây là cổng kiểm soát thực tế nhất hàng ngày, và là đơn vị tự nhiên cho một codebase kế thừa (bạn không cần toàn bộ repo xanh — chỉ cần diff).
- **Critical-path coverage** — kiểm thử rõ ràng, độ mạnh cao các đường dẫn money/auth/data-loss. Ví dụ trong một domain điển hình: tính toán hoa hồng, đợt thanh toán định kỳ (payment run), idempotency, các quy tắc due-date.
- **Property-based testing** — thay vì các ví dụ cố định, kiểm chứng _các bất biến_ trên đầu vào được tạo ra (Go: `testing/quick`, `gopter`, `rapid`; .NET: `FsCheck`, `CsCheck`). Tín hiệu chất lượng mạnh vì nó buộc bạn phải phát biểu _điều gì luôn phải đúng_, và nó khám phá các đầu vào bạn sẽ không bao giờ chọn thủ công. Tuyệt vời cho toán học tiền tệ: "tổng đã trả không bao giờ vượt quá số tiền còn nợ," "làm tròn không bao giờ mất một xu."

## 5. Tầng 4 — Trust & health

Một bộ test có thể hiệu quả mà vẫn không đáng tin cậy như một cổng kiểm soát.

- **Flakiness rate** — % test với pass/fail không xác định. Cổng flaky (tính bất định/chập chờn) là _không có cổng_: nó huấn luyện con người (và agent) thử lại cho đến khi xanh, điều này âm thầm vô hiệu hóa sự bảo vệ. Pipeline của Meta chạy lại các test ứng viên **5×** và loại bỏ bất kỳ cái nào không ổn định. <sup>[testgen]</sup>
- **Tốc độ / sức khỏe bộ test** — nếu cổng mất vài giờ, nó sẽ không chạy trên mỗi PR. Các lần chạy diff-scoped giữ nó trong vài phút.
- **Tính xác định** — không phụ thuộc vào wall-clock, thứ tự, mạng, hoặc trạng thái chia sẻ. (Liên quan trực tiếp đến logic `DateTime.Now` / due-date theo lịch định kỳ của bạn — thời gian môi trường là nguồn flakiness cổ điển.)

## 6. Điều này có nghĩa gì với "tôi đã viết đủ test chưa?"

Hãy ngừng hỏi "tỷ lệ coverage của tôi là bao nhiêu?" Hỏi, theo từng module, theo thứ tự này:

1. **Có coverage bằng không trên code thay đổi/quan trọng không?** (Tầng 1 — rẻ để tìm.)
2. **Có mutant sống sót trên các dòng đó không?** tức là, tôi có thể phá vỡ code và các test vẫn pass không? (Tầng 2 — câu trả lời thực sự.)
3. **Các assertion có mang tính hành vi và không có smell không?** (Tầng 2.)
4. **Diff và đường dẫn money có được phủ với oracle mạnh không?** (Tầng 3.)
5. **Bộ test có đủ nhanh và không có flake để tin tưởng khi không giám sát không?** (Tầng 4.)

Một bộ test kế thừa "đủ tốt" là bộ test mà, đối với code bạn đang thay đổi, các câu trả lời là _không có zero, ít survivor, assert mang tính hành vi, không có flake_. Đó là điều kiện tiên quyết cho vòng lặp agentic — được định lượng trong **[Phần 6](/memo/posts/test-quality-part-6-readiness-rubric-vi/)**.

---

← [Phần 0: Vì sao Code Coverage đánh lừa bạn](/memo/posts/test-quality-part-0-why-coverage-lies-vi/) · [Phần 2: Mutation Testing, được giải thích đúng đắn](/memo/posts/test-quality-part-2-mutation-testing-vi/) →

---

**Nguồn tham khảo:**

- **[smells]** testsmells.org catalog & test-smell catalog. https://testsmells.org/pages/testsmells.html · https://test-smell-catalog.readthedocs.io/en/latest/
- **[oracle]** _Test oracle strength vs. correctness_ (orthogonality), arXiv 2405.x. https://arxiv.org/html/2405.03786
- **[testgen]** Alshahwan et al., _Automated Unit Test Improvement using LLMs at Meta (TestGen-LLM)_, FSE 2024. https://arxiv.org/abs/2402.09171
- **[oraclegap]/[branchcov]** xem nguồn của [Phần 0](/memo/posts/test-quality-part-0-why-coverage-lies-vi/).
