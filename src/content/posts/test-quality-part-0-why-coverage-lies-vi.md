---
title: "Vì sao Code Coverage đánh lừa bạn (và bản năng hoài nghi của bạn đúng ở đâu)"
description: "Coverage chỉ đo việc test có chạy qua một dòng code hay không, không đo việc test có nhận ra dòng đó sai hay không. Phần mở đầu series đi qua mô hình RIPR, bằng chứng thực nghiệm về 'khoảng cách oracle', và vì sao lấy coverage làm mục tiêu lại phản tác dụng."
pubDatetime: 2026-07-01T00:05:00Z
lang: vi
tags:
  - testing
  - code-coverage
  - mutation-testing
  - software-quality
  - vietnamese
multiLangKey: "test-quality-metrics-0"
---

> **"Vượt ra ngoài Code Coverage — Metric chất lượng test cho vòng lặp agentic" — Phần 0/7.** Vì sao code coverage (độ phủ mã) là một chỉ báo âm hữu ích nhưng gần như vô dụng khi dùng làm chỉ báo dương cho chất lượng test. Mở đầu một loạt bài dịch từ báo cáo nghiên cứu song ngữ về metric chất lượng test cho vòng lặp phát triển agentic — nơi AI tự viết test và tự merge.

- Sự hoài nghi về code coverage là có cơ sở khoa học: coverage đo việc test có _chạy qua_ một dòng hay không, chứ không đo việc test có _nhận ra_ dòng đó sai hay không.
- Một test chỉ bắt được lỗi khi vượt qua đủ bốn cổng theo mô hình **R-I-P-R**: Reachability → Infection → Propagation → Reveal. Coverage chỉ đo đến cổng đầu tiên.
- Nhiều nghiên cứu thực nghiệm xác nhận "khoảng cách oracle (oracle gap)": không ít file coverage cao vẫn thiếu assertion, branch coverage cao vẫn để lọt mutant.
- Định luật Goodhart giải thích vì sao lấy coverage làm _mục tiêu_ bắt buộc sẽ khiến nó tự phản tác dụng — đặc biệt nguy hiểm khi mục tiêu đó giao cho một agent AI.

---

## 1. Diễn đạt trong một câu

Một test chỉ bắt được lỗi khi vượt qua **bốn** cổng theo thứ tự — **R-I-P-R**:

1. **Reachability** — test thực thi dòng lỗi.
2. **Infection** — đoạn code lỗi thực sự làm hỏng trạng thái chương trình với đầu vào đó.
3. **Propagation** — trạng thái bị hỏng lan đến một đầu ra có thể quan sát được.
4. **Reveal** — một **assertion (câu lệnh kiểm chứng)** kiểm tra đầu ra đó và _thất bại_.

**Coverage chỉ đo đến cổng 1.** Mọi thứ tạo nên giá trị của một test — infection, propagation, và đặc biệt là assertion phát hiện lỗi — đều vô hình với coverage.

![Phễu RIPR: Reachability → Infection → Propagation → Reveal, bốn cổng một test phải vượt qua để bắt được lỗi](/memo/diagrams/test-quality-metrics/01-ripr-funnel.svg)
_Coverage chỉ đo được cổng đầu tiên (Reachability); ba cổng còn lại — nơi quyết định một test có thực sự "nhận ra" lỗi hay không — nằm ngoài tầm với của nó._

Đây là lý do tại sao một bộ test có thể đạt 90% line coverage mà vẫn "mù": nó chạy toàn bộ code và không kiểm chứng bất cứ điều gì có ý nghĩa.

## 2. Bằng chứng

**Coverage nhạy với việc thực thi, không phải với việc xác minh.** Một phân tích từ thực tiễn nêu thẳng vấn đề: _"code coverage chỉ nhạy với việc thực thi, nhưng … không nhạy với việc thực sự kiểm thử / xác minh / kiểm chứng kết quả."_ Coverage cao _"có thể cùng tồn tại với các test không assert gì cả và không bắt được bất kỳ regression nào."_ Cùng nguồn này định nghĩa cách sử dụng trung thực duy nhất của coverage: một **chỉ báo âm hợp lệ** — coverage thấp cho bạn biết bạn đang "mù" ở đâu; coverage cao không cho bạn biết gì về chất lượng. <sup>[optivem]</sup>

**Khoảng cách oracle là có thật và đã được đo lường.** Một nghiên cứu thực nghiệm năm 2023 về coverage so với mutation score (điểm đột biến) trên một kho dữ liệu lớn phát hiện ra rằng hai chỉ số này tương quan dương nhưng _không_ hoàn hảo: chúng theo nhau ở mức coverage thấp, nhưng _"các file được phủ tốt hơn cho thấy sự biến thiên đáng kể hơn nhiều, với các khoảng cách dương lớn thường xuyên giữa coverage và mutation score — chỉ ra code được thực thi nhưng kiểm tra kém."_ ✅ _(đã xác minh đối nghịch, 3-0)_ <sup>[oraclegap]</sup>

Con số cụ thể và đáng lo ngại từ cùng nghiên cứu đó: trong **26 file có statement coverage > 80% và mutation score < 20%, ít nhất 12 file có nhiều câu lệnh `assert` còn thiếu** — các test chạy code nhưng không bắt được các lỗi được đưa vào một cách rõ ràng. ✅ _(đã xác minh, 3-0)_ <sup>[oraclegap]</sup>

![Khoảng cách giữa coverage và mutation score: nhiều file được thực thi đầy đủ nhưng vẫn để lọt mutant vì thiếu assertion](/memo/diagrams/test-quality-metrics/02-oracle-gap.svg)
_Ở coverage thấp, hai chỉ số đi cùng nhau; càng lên cao, khoảng cách dương giữa coverage và mutation score càng lớn — dấu hiệu của code "được chạy nhưng không được kiểm tra."_

**Branch coverage cũng không cứu bạn.** Một nghiên cứu công nghiệp năm 2021 phát hiện rằng branch coverage và mutation coverage chỉ nhất quán với nhau ở **47%** số class, với tương quan hạng yếu (Kendall τ-b ≈ 0.25). Trong **8% số class, branch coverage cao trong khi mutation coverage thấp** — các test đi qua mọi nhánh nhưng không bắt được bất kỳ lỗi nào được đưa vào. Các tác giả kết luận _"việc chỉ sử dụng branch coverage có thể đánh lừa nhà phát triển về chất lượng của các test."_ ✅ _(đã xác minh, 3-0)_ <sup>[branchcov]</sup>

**Coverage hầu như không dự đoán được lỗi thực tế.** Một nghiên cứu về các hệ thống Apache phát hiện rằng _"các đặc tính test có thể tính toán động như code coverage có mối liên hệ với các lỗi sau khi phát hành, nhưng chỉ ở mức biên."_ <sup>[apache]</sup>

## 3. Định luật Goodhart: khoảnh khắc bạn lấy coverage làm mục tiêu, nó chết đi

> _"Khi một thước đo trở thành mục tiêu, nó không còn là thước đo tốt nữa."_

Tác giả .NET Mark Seemann lập luận trực tiếp rằng coverage như một _mục tiêu bắt buộc_ là tự đánh bại — _"mọi người phản ứng với các động cơ khuyến khích, mặc dù không nhất thiết theo những cách có thể dự đoán được."_ Nói với một nhóm (hoặc một agent AI) phải đạt 80% coverage và họ sẽ đạt 80% coverage: bằng cách viết các test không có assertion, test getter tầm thường, và các nghi thức `Assert.NotNull` thực thi code mà không xác minh bất cứ điều gì. <sup>[ploeh]</sup> Metric trở thành xanh; bộ test _tệ hơn_, vì bây giờ nó đầy nhiễu trông như thể là bảo vệ.

Điều này còn quan trọng gấp đôi đối với vòng lặp agentic. Một LLM được bảo "tăng coverage" là một cỗ máy Goodhart cực kỳ hiệu quả — nó sẽ tạo ra chính xác các test vô nghĩa thỏa mãn đúng nghĩa đen của metric. (Xem [Phần 5](/memo/posts/test-quality-part-5-grading-ai-tests-vi/).)

## 4. Vậy coverage có vô dụng không? Không — đó là nền, không phải trần

Hãy giữ coverage, nhưng hạ cấp nó về đúng vai trò trung thực:

- **Dùng nó như một bộ lọc âm.** Một file có 0–20% coverage trên các dòng thay đổi là _chắc chắn_ chưa được kiểm thử đủ. Sửa những chỗ đó trước. Điều này rẻ và đáng tin cậy.
- **Không bao giờ dùng nó như mục tiêu dương.** "Chúng tôi đang ở 85%" không phải là bằng chứng bộ test tốt. Đó là bằng chứng code đang được _thực thi_.
- **Chú ý khoảng cách.** Tín hiệu thú vị là `coverage − mutation_score`. Khoảng cách lớn là ngón tay chỉ chính xác vào "code bạn chạy nhưng không kiểm tra."

Phần còn lại của series này nói về các metric đo lường những gì coverage không thể: **liệu bộ test có thực sự nhận ra khi nào code sai không?**

---

→ [Phần 1: Danh mục metric chất lượng test](/memo/posts/test-quality-part-1-metric-catalog-vi/)

---

**Nguồn tham khảo:**

- **[oraclegap]** Sapozhnikov et al., _empirical study of coverage vs. mutation score_, arXiv 2309.02395. https://arxiv.org/pdf/2309.02395 — cả hai trích dẫn đã được xác minh đối nghịch (3-0).
- **[branchcov]** _Branch coverage vs. mutation coverage_, industrial study, arXiv 2104.11767. https://arxiv.org/pdf/2104.11767 — đã xác minh (3-0 / 2-1).
- **[apache]** _Test characteristics and post-release defects in Apache systems_, Springer EMSE. https://link.springer.com/article/10.1007/s10664-020-09891-y
- **[ploeh]** Mark Seemann, _"Code coverage is a useless target measure."_ https://blog.ploeh.dk/2015/11/16/code-coverage-is-a-useless-target-measure/
- **[optivem]** Optivem Journal, _"Code coverage targets: a recipe for disaster."_ https://journal.optivem.com/p/code-coverage-targets-recipe-for-disaster
