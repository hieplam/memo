---
title: 'Chữ "semantic": một chữ, hai thế giới — và tại sao ta hay nhầm'
description: 'Mục lục một series nhỏ gỡ rối chữ "semantic". Tại sao "tool này không có semantic search" và "Roslyn có semantic model" là HAI chữ semantic khác nhau, cùng dính gì tới AST, và vì sao tầng ngữ nghĩa lại là cái harness ghì cương được AI agent. Code Go chạy được, C# đối chiếu, mọi khẳng định có nguồn.'
pubDatetime: 2026-06-19T06:00:00Z
tags:
  [
    "semantic",
    "ast",
    "compiler",
    "embeddings",
    "ai-agents",
    "vietnamese",
    "semantic-series",
  ]
lang: "vi"
---

> **Series "Gỡ rối chữ semantic" — đọc cái này trước.**
> Sáu bài, đi từ một chữ bị xài chồng nghĩa tới chỗ nó thành cái rào chặn AI agent code bậy.
> Code Go trong series **chạy thật, output là output thật** (máy tôi không có .NET nên C#/Roslyn để ở dạng minh hoạ, đối chiếu docs Microsoft). Mọi khẳng định về compiler/API đều trỏ về nguồn gốc — không tin bài báo nào nói suông.
> Ngày: 2026-06-19.

## Tóm tắt nhanh (TL;DR)

- Chữ **"semantic" (ngữ nghĩa)** bị xài cho **hai thứ chẳng liên quan**, chỉ chung một gốc chữ Hy Lạp.
- **"semantic search"** = tìm theo _nghĩa_ bằng vector embeddings (thế giới ML/tìm kiếm).
- **"semantic model"** (Roslyn, go/types) = tầng _ý nghĩa_ của chương trình, **dựng trên AST** (thế giới compiler).
- **AST** chỉ là _cú pháp_ — hình dạng code. Nó **không** biết "x kiểu gì, trỏ tới đâu". Cái đó là tầng semantic, một cấu trúc **riêng**.
- Đúng cái tầng semantic đó (qua type-checker + lint) là **cái harness** ép code của AI agent phải đúng — chặn bằng máy, không phải bằng lời dặn.

---

Hồi mới vào nghề, tôi từng gật gù trong một buổi review mà thật ra chẳng hiểu gì. Một anh senior chê cái công cụ search của team: _"tool này có mỗi grep, làm gì có semantic search."_ Hôm sau, anh khác khoe: _"đổi qua Roslyn đi, nó cho mình cái semantic model, sướng lắm."_ Tôi về tra "semantic", thấy toàn nói về **AST** (cây cú pháp), thế là trong đầu kết luận gọn: _à, semantic = AST, cùng một họ._

Sai. Sai khá nặng. Và phải mất kha khá năm tôi mới gỡ được cái nút đó trong đầu. Bài này (và cả series) là để bạn không phải mất từng đó thời gian.

## 1. Một chữ, hai thế giới

Vấn đề nằm ở chỗ tiếng Anh lười: chữ **semantic** (gốc Hy Lạp _semantikos_, nghĩa là "thuộc về ý nghĩa") bị mượn cho hai ngành khác hẳn nhau. Nghe giống nhau, viết giống nhau, nhưng bên trong là **hai cái máy không liên quan gì**.

![Sơ đồ: chữ “semantic” và hai thế giới — semantic model (compiler) và semantic search (embeddings)](/memo/diagrams/semantic/00-two-worlds.svg)

_Cùng một gốc chữ "ý nghĩa", nhưng một bên là bảng ký hiệu của compiler, một bên là vector embeddings. Đừng gộp._

- **Thế giới COMPILER — "semantic model".** Khi anh em nói "Roslyn có semantic model", ý là: ngoài cái cây cú pháp (AST) ra, trình biên dịch còn dựng thêm một tầng **hiểu nghĩa** chương trình — biết cái tên `user` này trỏ tới biến nào, kiểu gì, gọi đúng hàm không. Đây là chuyện **phân tích chương trình** (program analysis).
- **Thế giới IR/ML — "semantic search".** Khi anh em nói "tool này không có semantic search", ý là: nó chỉ so **từ khoá** (trùng chữ thì ra), chứ không tìm theo **nghĩa**. Tìm-theo-nghĩa ở đây làm bằng cách biến câu chữ thành **vector** (embedding) rồi đo độ gần nhau. Chuyện này thuộc về **truy hồi thông tin** (information retrieval) và máy học, _chẳng dính gì tới compiler_.

Hai cái dùng **cấu trúc dữ liệu khác nhau** (bảng ký hiệu vs vector), do **hai nhóm kỹ sư khác nhau** xài, giải **hai bài toán khác nhau**. Điểm chung duy nhất là... cái nhãn chữ. Như kiểu "con chuột" trên bàn và "con chuột" trong hang — cùng tên, khác loài.

## 2. Vậy "semantic" có liên quan gì tới AST?

Có — nhưng chỉ ở **một** trong hai thế giới, và quan hệ của nó tinh tế hơn ta tưởng.

Trong thế giới compiler, code đi qua một đường ống: **chuỗi ký tự → tokens → AST → semantic model**. Cái **AST (abstract syntax tree — cây cú pháp trừu tượng)** là sản phẩm của khâu _cú pháp_: nó ghi lại **hình dạng** của code ("đây là phép gán, vế phải là phép cộng hai số"). Nhưng nó **không** biết hai số đó cộng ra mấy, không biết biến bên trái kiểu gì, không biết cái tên bạn viết trỏ tới khai báo nào.

Tầng trả lời mấy câu đó — **semantic** — là một bước **sau** AST, và quan trọng: nó là một **cấu trúc riêng**, không phải AST được "tô màu" thêm. Đây chính là chỗ tôi (và rất nhiều bài blog) từng hiểu sai, nên cả series sẽ chứng minh nó bằng code chạy được, không nói miệng.

> [!NOTE]
> Một câu để nhớ cả series: **AST là cú pháp (hình thức). Semantic model là ý nghĩa (dựng trên cú pháp đó).** "Tool không có semantic search" lại là chữ semantic của một thế giới hoàn toàn khác.

## 3. Sợi chỉ xuyên suốt: từ chữ nghĩa tới ghì cương AI

Tại sao một ông kỹ sư già lại đi viết sáu bài về một chữ? Vì cái hiểu lầm này không vô hại. Nó chặn bạn hiểu được một thứ rất thời sự: **làm sao bắt mấy con AI agent code cho đúng.**

Bạn để ý mà xem — người ta hay bảo _"AST được dùng để viết hard-rule cho AI agent"_. Đúng. Nhưng nửa sự thật. Cái lint chặn `import` lung tung thì AST là đủ. Còn cái lint chặn "gọi nhầm hàm đọc secret" thì AST **không đủ** — phải có tầng semantic mới biết cái `.Getenv()` kia _thực chất_ là hàm nào. Hiểu được ranh giới cú pháp / ngữ nghĩa, bạn mới thiết kế được cái **harness** (bộ rào) đúng chỗ.

Và đó là cú nối tới một series anh em của bài này — _"Bắt LLM code đúng bằng kiến trúc"_ — nơi nguyên lý là: đừng _dặn_ LLM bằng markdown (nó lờ được), hãy **dựng đường ray bằng máy** (compiler, type, lint) để cách sai _không gọi được_. Tầng semantic chính là vật liệu làm đường ray đó.

## 4. Bản đồ series

Đọc theo thứ tự là mượt nhất, nhưng bài nào cũng đứng riêng được.

| #   | Bài                                                                                             | Trả lời câu hỏi                | Bằng chứng               |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------ |
| 1   | [Cú pháp vs Ngữ nghĩa: AST thật ra là gì](/memo/posts/cu-phap-vs-ngu-nghia-ast-la-gi/)          | "semantic dính gì tới AST?"    | Go `go/ast` chạy thật    |
| 2   | ["Tool này không có semantic search" nghĩa là gì](/memo/posts/semantic-search-la-gi/)           | chữ semantic kiểu _embeddings_ | sơ đồ lexical vs vector  |
| 3   | ["Roslyn có semantic model" — tầng nghĩa trên AST](/memo/posts/semantic-model-roslyn-go-types/) | chữ semantic kiểu _compiler_   | Go `go/types` + Roslyn   |
| 4   | [Lấy AST viết hard-rule: cái lint chặn code sai](/memo/posts/ast-viet-hard-rule-lint/)          | "AST viết harness hard-rule"   | Go linter ~40 dòng       |
| 5   | [Ghì cương AI agent bằng kiến trúc](/memo/posts/ghi-cuong-ai-agent-bang-construction/)          | "...trong AI agent"            | nối series constrain-llm |

## 5. Giao kèo: không tin báo nào, chạy được mới tin

Tôi có một tật nghề: **không tin câu "nó hoạt động vậy đó".** Cái gì kiểm được thì kiểm. Nên series này theo đúng tinh thần đó:

- **Go là ngôn ngữ trụ, và code Go _chạy thật_.** Mọi output bạn thấy trong bài là copy từ terminal ra, không phải tôi tự gõ cho đẹp. Bạn cài Go vào chạy lại y hệt.
- **C#/Roslyn ở vai phụ, dạng minh hoạ.** Máy tôi không có .NET, nên tôi không dám nói "tôi chạy rồi"; mấy đoạn C# là đối chiếu thẳng tài liệu Microsoft Learn (vì "semantic model" vốn là thuật ngữ gốc của Roslyn, bỏ qua thì phí).
- **Mọi khẳng định về compiler/embeddings đều có nguồn**, và tôi sẽ chỉ rõ chỗ nào là sự thật có-thể-tra, chỗ nào là kinh nghiệm cá nhân tôi.

Có vài chỗ blog ngoài kia hay nói sai mà nghe rất xuôi tai — ví dụ "semantic analysis tô màu lên cây AST". Tôi sẽ chỉ mặt từng cái, kèm lý do tại sao sai. Đó mới là phần vui.

Rồi, đủ dạo đầu. Vào bài 1 — ta mổ cái AST ra xem bên trong nó _thật sự_ biết gì và không biết gì.

→ [Phần 1: Cú pháp vs Ngữ nghĩa — AST thật ra là gì (và không là gì)](/memo/posts/cu-phap-vs-ngu-nghia-ast-la-gi/)
