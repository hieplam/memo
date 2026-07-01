---
title: "Chấm điểm test do AI viết: làm sao để chúng không là rác"
description: "Test thô từ LLM gần một nửa là rác, và những cái trông ổn có xu hướng cementing bug hiện có thay vì bắt lỗi. Phần này trình bày bộ lọc gauntlet sáu cổng — mô hình theo TestGen-LLM của Meta — để một test do AI viết chỉ được merge khi nó thực sự kill được một mutant mới."
pubDatetime: 2026-07-01T00:05:00Z
lang: vi
tags:
  - testing
  - ai
  - llm
  - mutation-testing
  - vietnamese
multiLangKey: "test-quality-metrics-5"
---

> **"Vượt ra ngoài Code Coverage — Metric chất lượng test cho vòng lặp agentic" — Phần 5/7.** Chương quyết định mục tiêu của bạn thành hay bại: cách chấm điểm test do AI viết bằng một bộ lọc gauntlet, để chúng không là vô nghĩa. Tiếp theo [Phần 4](/memo/posts/test-quality-part-4-tooling-go-dotnet-vi/) về công cụ Go/.NET.

- Đầu ra test thô từ LLM **gần một nửa là rác** (lỗi biên dịch, flake, assert vô nghĩa).
- Mối nguy đặc thù: LLM có xu hướng assert _những gì code hiện tại làm_ — **cementing các lỗi hiện có** thay vì bắt chúng.
- Giải pháp là một **bộ lọc gauntlet sáu cổng**, mô hình theo TestGen-LLM của Meta: một test chỉ được chấp nhận nếu nó build, pass, ổn định (5×), và **kill một mutant mà không có test hiện tại nào kill** — với oracle trên đường dẫn quan trọng thuộc sở hữu của spec/con người, không phải model.

---

## 1. Đầu ra test LLM thô tệ đến mức nào?

TestGen-LLM của Meta (điểm dữ liệu công nghiệp có thẩm quyền nhất) đã đo lường _đầu ra thô của chính nó_: chỉ **75% test case được tạo ra build đúng, và chỉ 57% pass một cách đáng tin cậy.** <sup>[testgen]</sup> Gần một nửa đầu ra thô là không hoạt động trước khi bạn thậm chí hỏi liệu nó có kiểm tra gì có ý nghĩa hay không.

Và các test còn lại có các khiếm khuyết đặc trưng:

- **Test smell Magic Number Test gần như phổ quát** trong các bộ test được tạo bởi LLM — hiện diện trong **99.78–100%** các bộ test cấp class trên GPT-3.5, GPT-4, Mistral 7B, và Mixtral 8×7B. <sup>[smellsllm]</sup>
- Các test được tạo tự động thể hiện **13 danh mục test smell (mùi mã test)** không phổ biến trong test của con người, được nhóm thành _Act-Assert Mismatch_ (ví dụ: side effect / giá trị trả về không được assert), _Redundant Code_, _Failed Setup_, và _Testing Only Field Accessors/Constants._ <sup>[autosmells]</sup>

Vì vậy "AI đã viết test và coverage tăng lên" _không_ phải là bằng chứng về an toàn. Nó có thể là bằng chứng về các test vô nghĩa thực thi code và không assert gì cả — chính xác là lỗi Goodhart từ [Phần 0](/memo/posts/test-quality-part-0-why-coverage-lies-vi/).

## 2. Mối nguy duy nhất: oracle lock-in bug

Đây là cái sẽ cắn một vòng lặp tự trị mạnh nhất. Các LLM tạo ra **oracle test** (các assertion) _"bị lệch về triển khai thực tế (có thể là lỗi) thay vì hành vi dự kiến"_ — độ chính xác phân loại oracle của chúng _"giảm đáng kể khi có code lỗi."_ <sup>[bias]</sup>

Cụ thể: trỏ một LLM vào một hàm tính toán hoa hồng hơi sai, và nó sẽ vui vẻ viết `Assert.Equal(wrongValue, result)` — một test **pass, tăng coverage, và cố định vĩnh viễn lỗi.** Tệ hơn, mỗi thay đổi đúng trong tương lai sẽ "phá vỡ một test," vì vậy agent (hoặc một con người mệt mỏi) sẽ có xu hướng _cập nhật test cho phù hợp với code lỗi_ thay vì sửa code.

Giải pháp phòng thủ: **oracle cho hành vi quan trọng phải đến từ spec, không phải code hiện tại.** Trên các đường dẫn quan trọng, một con người (hoặc một spec/property mà con người viết) định nghĩa những gì là đúng; AI có thể viết scaffolding và edge case, nhưng nó không được phép _định nghĩa sự thật_ cho logic money/auth/data-loss.

## 3. Tại sao bạn KHÔNG được kiểm soát cổng test AI bằng coverage

Bản năng là "chấp nhận test AI nếu nó tăng coverage." Dữ liệu nói rằng điều đó ném bỏ các test tốt nhất của bạn. Trong các lần chạy có hướng dẫn mutation của Meta, trong **571 test bắt lỗi mà mọi test hiện tại bỏ lỡ, 277 (~một nửa) không thêm line coverage mới nào.** Một pipeline kiểm soát cổng bằng coverage sẽ đã _loại bỏ một nửa số test thực sự tìm thấy lỗi._ <sup>[coverage-discard]</sup>

> **Kiểm soát cổng test AI bằng mutant bị kill, không phải bằng coverage đạt được.** Một test kill một mutant đã sống sót trước đó đang chứng minh là đang tăng cường oracle của bạn. Một test chỉ thêm coverage thì, tốt nhất, là reachability — và tệ nhất, là vô nghĩa.

## 4. Bộ lọc gauntlet (dùng cái này như pipeline chấp nhận/từ chối của bạn)

Một test được tạo bởi máy được chấp nhận vào bộ test **chỉ khi nó vượt qua mọi cổng**:

| #   | Cổng               | Từ chối nếu…                       | Cách kiểm tra                                                                                                         |
| --- | ------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | **Build**          | không compile                      | CI build                                                                                                              |
| 2   | **Pass**           | đỏ khi chạy lần đầu                | chạy một lần                                                                                                          |
| 3   | **Ổn định**        | flaky (tính bất định)              | chạy **5×**, yêu cầu kết quả giống hệt nhau <sup>[testgen]</sup>                                                      |
| 4   | **Tăng cường** ★   | không kill mutant mới nào          | chạy mutation trên diff; yêu cầu ≥1 mutant mới bị kill                                                                |
| 5   | **Sạch**           | có test smell                      | scan: không có assertion-free / magic-number / conditional-logic / act-assert-mismatch                                |
| 6   | **Oracle hành vi** | assert triển khai, không phải spec | trên các đường dẫn quan trọng, oracle truy nguyên đến spec/property do con người sở hữu, không phải "đầu ra hiện tại" |

![Bộ lọc gauntlet sáu cổng cho test do AI sinh: Build → Pass → Ổn định → Tăng cường (mutant mới) → Sạch → Oracle hành vi](/memo/diagrams/test-quality-metrics/04-ai-test-gauntlet.svg)
_Một test do AI viết chỉ merge sau khi vượt hết sáu cổng — cổng 4 là cổng phân tách test thực sự với test vô nghĩa._

Cổng 1–3 là bộ lọc đã xuất bản của Meta (build → pass → không-flake). **Cổng 4 là cổng mà hầu hết các nhóm bỏ qua và là cái thực sự phân tách test thực sự với test vô nghĩa.** Cổng 5–6 bảo vệ khỏi các chế độ lỗi đặc thù của AI ở trên.

Đây là ý nghĩa vận hành của _"Assured LLM-based Software Engineering"_: không bao giờ tin tưởng đầu ra model thô — chỉ giữ lại các thay đổi có giá trị được **đo lường cơ học**.

## 5. Điều này đưa bạn đến đâu trong vòng lặp đầy đủ

Mục tiêu đã phát biểu của bạn là _tin tưởng các test do AI tạo ra đủ để bỏ qua kiểm thử thủ công trước khi merge._ Điều đó có thể đạt được, nhưng sự tin tưởng được kiếm bởi **gauntlet**, không phải bởi model:

- Agent tạo test tự do.
- Gauntlet (cổng 1–6) chạy trong CI, một cách xác định.
- Chỉ các test kill mutant, không có smell, được neo vào spec mới merge.
- Các mutant sống sót trên diff mà _không có gì_ kill → cổng **chặn merge** và cho agent biết chính xác cần test gì tiếp theo.

Trong thiết kế này bạn không tin tưởng phán đoán của AI — bạn tin tưởng một **phép đo** mà AI phải thỏa mãn. Đó là sự khác biệt giữa "vibe-merging" và một vòng lặp tự trị bạn có thể bảo vệ. Các ngưỡng làm cho điều này cụ thể nằm ở phần tiếp theo.

---

← [Phần 4: Công cụ cho Go và .NET](/memo/posts/test-quality-part-4-tooling-go-dotnet-vi/) · [Phần 6: Rubric sẵn sàng cho merge gate agentic](/memo/posts/test-quality-part-6-readiness-rubric-vi/) →

---

**Nguồn tham khảo:**

- **[testgen]** Alshahwan et al., _Automated Unit Test Improvement using LLMs at Meta (TestGen-LLM)_, FSE 2024. https://arxiv.org/abs/2402.09171 — tỷ lệ build-pass 75%/57% và bộ lọc flake 5× từ bài báo.
- **[coverage-discard]** Meta follow-up on mutation-guided LLM test generation (277/571 add no coverage). https://arxiv.org/abs/2501.12862
- **[bias]** _LLM test-oracle bias toward buggy implementations._ https://arxiv.org/abs/2410.10628 · https://arxiv.org/html/2410.21136v1
- **[smellsllm]** _Test smells in LLM-generated unit tests_ (Magic Number Test 99.78–100%). https://arxiv.org/html/2410.21136v1
- **[autosmells]** _13 test-smell categories in automatically generated tests._ https://arxiv.org/html/2405.03786
- _Các trích dẫn trong phần này được trích xuất từ các nguồn chính ở trên; các phát hiện tiêu đề TestGen-LLM và oracle-bias là cơ sở của các tuyên bố đã xác minh, nhưng một số chi tiết theo từng hình không được xác minh lại độc lập trong lần chạy này — xác nhận với các bài báo trước khi trích dẫn ra bên ngoài._
