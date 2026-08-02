---
title: "Self Improvement Loop: Vòng lặp khép kín"
description: "Tui đọc được ý niệm self improvement loop từ một bài viết của Boris, nhưng bài đó chỉ nói ý, không nói cách. Hôm nay làm pet project, Claude Code hỏi tui một câu về unwritten convention, và tui ngộ ra nó là gì."
pubDatetime: 2026-07-26T02:00:00Z
featured: true
lang: "vi"
tags:
  - ai-agents
  - claude-code
  - workflow
  - tech-debt
  - vietnamese
multiLangKey: "self-improvement-loop"
---

> Bài viết này người viết tự viết, có nhờ AI tỉa nhẹ lại câu chữ. Mang tính chia sẻ, tự sự.
>
> Ngày: 26/07/2026

---

## 1. Mở Đầu

Tui nhớ tui đã từng đọc một bài viết của Boris, hình như là bài về **Steps of AI Adoption** — bốn cấp độ của con người khi AI để code. Tui cũng không chắc tui đang ở level mấy, nhưng ít nhất tui mừng vì tui không nằm ở Level 0 😅

Quay về nội dung chính. Tui nhớ có một ý ở khoảng level 3 hay 4: khi con người càng muốn thoát ra khỏi cái vòng loop của AI trong workflow, thì phải tạo ra được một **self improvement loop** — vòng lặp tự cải thiện.

Đại loại theo tui hiểu là phải dựng được một workflow mà AI có thể tự sửa lỗi của nó, hoặc tự tốt lên dần dần. Bài viết chỉ thuần đưa ra ý niệm, không hề chỉ cách làm như thế nào. Nên tui cứ suy nghĩ hoài: làm sao để làm được việc đó?

Và tui cũng chợt nhận ra: từ ngày tui xài Claude Code, tui gần như không còn code nữa — cả project công ty lẫn project cá nhân. Nhưng tui vẫn chưa hề tạo ra được một self improvement loop nào như vậy cả.

## 2. Linh cảm: 1% mỗi ngày, nhưng phải làm đều đặn

Dựa theo kinh nghiệm bản thân, tui lờ mờ đoán được là nó phải có **incremental improvement** — cải thiện từng chút một.

Nghĩa là không cần phải cải thiện ngay tức thì. Mỗi lần 1% là đủ. Cái cốt lõi là phải luôn **resilience**, nghĩa là phải liên tục làm được điều đó. Không nhất thiết phải ngày qua ngày, miễn là vẫn kiên trì.

**Cặm cụi làm.** Đây là từ mà sếp cũ nhận xét tui. Tới bây giờ tui mới hiểu lý do.

Đây là triết lý tui ngộ ra sau một khoảng thời gian vô định, tự học đủ thứ skill mà chả giúp ích được gì cho sự nghiệp (đa phần là hao tài, tiêu sản 🙃).

## 3. Cái câu hỏi làm tui khựng lại

Bỗng hôm nay, khi tui đang làm pet project, thì Claude Code hỏi tui một câu: agent review code của tui phát hiện **unwritten convention**, muốn tui xử lý sao?

Tui cũng chả hiểu unwritten convention là cái gì. Nên mới back and forth với Claude Code, rồi mới hiểu ra:

> **Unwritten convention** là các rule, các convention **không được ghi ra** trong project. LLM chỉ đơn giản thấy một pattern nào đó lặp lại nhiều lần trong code base hoặc trong surrounding context (đoạn code xung quanh chỗ nó đang sửa), rồi nó tự cho rằng đó là pattern của dự án.

Một trong các option Claude Code đưa cho tui là: **chỉ report lại thôi và vẫn cho pass**. Nghĩa là pass qua vòng reviewer, rồi sẽ đi tiếp tới vòng PR → merge.

## 4. Chuyện MediatR ở dự án công ty

Điều này làm tui chợt nhớ tới một cái lỗi mà LLM rất hay mắc phải.

Ví dụ, dự án ở công ty tui dùng **MediatR** — một thư viện .NET, thay vì gọi thẳng service, mọi thao tác được gói thành một `Command` hoặc `Query`, rồi bắn qua một trung gian để tìm đúng `Handler` xử lý.

Pattern này không xấu. Nhưng với đa số scope của dự án tụi tui thì nó hơi overkill. Cái pain point của nó là engineer đặt naming cho handler không đúng, dẫn tới việc rất khó tìm ra handler. Và một pain point nữa cũng về naming: đặt tên là `Command` nhưng bên trong lại chỉ query DB, hoặc đặt là `Query` nhưng bên trong lại update DB...

Team tui cũng dần không muốn dùng nó nữa, thay vào đó viết thẳng class service cho dễ trace.

Và khi LLM gen code, nó thường check surrounding context — thấy xung quanh toàn MediatR — rồi lại viết code mới bằng MediatR.

Đó chính xác là unwritten convention. Không ai ghi ra rằng "dự án này dùng MediatR". Cũng không ai ghi ra rằng "tụi tui đang bỏ MediatR". LLM chỉ nhìn code cũ rồi đoán. Và nó đoán theo hướng ngược lại với ý team.

## 5. Không cho pass. Escalate.

Quay lại vấn đề. Lúc đó tui prompt lại với Claude Code rằng tui **không muốn unwritten convention được pass**. Thay vào đó phải escalate lên, theo hai nhánh:

1. **Nếu nó là convention thật** → tạo convention đó ra, ghi thành văn bản, biến nó thành **public convention** với LLM. Từ đó về sau LLM đọc rule chứ không phải đoán.
2. **Nếu nó là anti-pattern** (như MediatR ở trên) → tạo thành **non-goal rule** hoặc **anti-pattern rule**, và **mark đoạn code đó là cần refactor**.

Qua dần dần, convention sẽ càng ngày càng nhiều và đủ. Tech debt sẽ dần biến mất.

Sau đó tui đọc phần thinking của LLM, và chợt nhận ra: đây chính là một ví dụ của improvement loop.

## 6. Vì sao nó là một cái loop

Nhìn lại thì cái vòng nó chạy như vầy:

```
Agent review code
   └─> phát hiện một pattern không có rule nào phủ
        └─> KHÔNG cho pass, escalate
             ├─> pattern tốt  → viết thành rule
             └─> pattern xấu → viết thành anti-pattern rule + mark refactor
                  └─> lần review sau, LLM đọc rule mới
                       └─> quay lại đầu vòng
```

Mỗi lần chạy, tập rule dày thêm một chút. Mỗi lần chạy, chỗ mù của LLM hẹp lại một chút. Không có lần nào tạo ra bước nhảy vọt. Nhưng lần sau luôn tốt hơn lần trước một xíu.

Đúng cái 1% mà tui nói ở trên.

Và điều quan trọng nhất: **tui không phải là người ngồi nghĩ ra rule**. Cái loop tự lôi rule ra từ chính code base, tui chỉ đứng ở chỗ quyết định "cái này là convention hay là anti-pattern". Đó là chỗ mà con người bắt đầu rời khỏi vòng lặp của AI.

## 7. Chốt

Tui vẫn chưa dám nói là mình đã dựng xong một self improvement loop hoàn chỉnh. Nhưng ít nhất tui đã thấy được hình dáng của nó, sau một thời gian dài chỉ đọc được cái ý niệm mà không biết bắt đầu từ đâu.

Hóa ra nó không nằm ở chỗ làm cái gì đó thật to. Nó nằm ở chỗ: mỗi lần agent định cho một thứ mơ hồ đi qua, mình chặn lại và bắt nó ghi ra thành chữ.

Mà nghĩ kỹ lại, cốt lõi của cái self improvement loop này vẫn y chang như thời chưa có AI. Trong team lúc nào cũng có một cách để tự improve — vòng retrospective cuối mỗi sprint là một ví dụ điển hình.

Nhưng thời đó AI chưa phổ cập, phần lớn con người phải tự quyết định. Mà con người thì lười, không kỷ luật. Nên đa phần mấy vòng loop đó không được tuân thủ chặt chẽ.

Còn bây giờ, cái phần cặm cụi đó tui giao lại cho agent. Phần của tui chỉ còn là quyết định đúng hay sai.

Chỉ vậy thôi. Nhưng phải làm hoài.
