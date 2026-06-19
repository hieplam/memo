---
title: "Ghì cương AI agent bằng kiến trúc, không bằng lời dặn"
description: 'Kết series "Giải mã chữ semantic": tầng ngữ nghĩa (semantic model) + lint AST trở thành cái harness máy móc ghì cương AI coding agent. Tại sao lời dặn trong markdown lờ được, còn compiler + type-checker thì không. Phân biệt grammar-constrained decoding (chặn lúc sinh token) vs analyzer/lint (hậu kiểm ngữ nghĩa) — hai thứ bổ sung, không thay nhau.'
pubDatetime: 2026-06-19T01:00:00Z
tags:
  [
    "semantic",
    "ast",
    "compiler",
    "ai-agents",
    "linter",
    "vietnamese",
    "semantic-series",
  ]
lang: "vi"
---

> Phần cuối của series. Đọc từ đầu: [mục lục series](/memo/posts/chu-semantic-mot-chu-nhieu-nghia/).
> Bài trước: [Phần 4 — Lấy AST viết hard-rule: cái lint chặn code sai](/memo/posts/ast-viet-hard-rule-lint/).

## Tóm tắt nhanh

- LLM code bằng cách **bắt chước** — nó không đọc rule, nó đọc pattern. Lời dặn trong markdown thì lờ được, cổng máy thì không.
- **Constrain by construction** (ghì bằng kiến trúc): dựng compiler + type-checker + lint AST để **cách sai không gọi/biên dịch được** — đó là ý nghĩa của "harness".
- Tầng semantic (Phần 3) là **vật liệu**; lint AST/semantic (Phần 4) là **cơ chế**; bài này nối hai cái lại và chỉ rõ chúng ghì AI agent như thế nào.
- **Phân biệt quan trọng:** grammar-constrained decoding (giải mã bị ràng buộc theo ngữ pháp) ép _từng token lúc sinh_ phải hợp cú pháp — **khác** với analyzer/type-checker là _hậu kiểm_ bắt sai ngữ nghĩa (gọi hàm không tồn tại, phá hợp đồng). Hai cái **bổ sung nhau**, không thay nhau.
- Đây là điểm đến của cả series: chữ "semantic" đã được gỡ, và đúng cái nghĩa-compiler đó là thứ ghì cương được AI.

---

Có một câu hỏi tui bị hỏi nhiều nhất kể từ khi AI coding agent nổi lên: _"Làm sao biết nó không tự tiện làm bậy?"_ Câu trả lời ngắn là: **đừng tin lời dặn, dựng đường ray**. Câu trả lời dài là cả series này — và bài kết sẽ buộc mấy đầu mối lại.

## 1. Vấn đề gốc: LLM code bằng cách bắt chước

LLM không đọc spec rồi suy luận từ đầu. Nó nhìn **context xung quanh** — file bạn đang mở, file gần đó, chat history — rồi **bắt chước pattern** phổ biến nhất mà nó thấy. Đây là sức mạnh của nó (viết code trông rất "đúng gu repo") đồng thời là điểm yếu cố hữu của nó.

Nếu context xung quanh đầy `os.Getenv()`, nó sẽ viết `os.Getenv()`. Nếu repo có hai chỗ `import "net/http"` thẳng trong service layer, nó sẽ làm đúng vậy. Bạn có viết to trong `CONTRIBUTING.md` "**KHÔNG** gọi `os.Getenv` trực tiếp, phải qua config layer" thì nó vẫn không nhất thiết làm theo — nó đọc _code_, không đọc markdown như con người đọc.

Cái "lời dặn trong markdown" là **by instruction** (kiểm soát bằng chỉ thị): bạn nói, nó có thể nghe hoặc không, tuỳ context, tuỳ model, tuỳ may mắn. Không có gì ép buộc về mặt cơ học.

> [!WARNING]
> Đây không phải chê AI hay khen AI. Đây là mô tả kỹ thuật. LLM là bộ dự đoán token — nó không có "ý chí" để lờ bạn, nhưng cũng không có "cơ chế" để _bắt buộc_ tuân theo rule nếu rule chỉ tồn tại dưới dạng văn bản tự nhiên trong một file nào đó.

## 2. Constrain by construction: dựng đường ray bằng máy

Nguyên lý đối lập là **by construction** (ghì bằng kiến trúc): thay vì _dặn_, hãy _xây_ — để **cách sai không gọi được, không biên dịch được**.

Tui hay dùng cái phép so sánh Entity Framework (EF) này: nếu codebase quy định _chỉ được đụng database qua EF_, và mọi thứ trực tiếp vô `SqlConnection` đều bị type system chặn hoặc lint đá ra trước khi vô CI — thì ngoài EF còn cửa nào đâu? Không phải vì ai "nhớ rule" mà vì con đường đó **bị bịt lại bằng máy**. AI agent hay người thật cũng vậy — cổng là cổng.

Cái cổng đó trong codebase là **exit 1**: compile lỗi, type-check lỗi, lint lỗi. Bất kỳ code nào sinh ra — từ AI hay từ tay người — đều phải qua đó. Không qua được thì không merge được.

![Sơ đồ: LLM sinh code qua cổng compile + type-check + lint AST; lời dặn markdown thì đi vòng được](/memo/diagrams/semantic/05-agent-harness-gate.svg)

_LLM sinh code, cổng máy (compile + type-check + lint AST/semantic) chặn cái sai bằng exit 1; lời dặn markdown thì đi vòng được; grammar-constrained decoding ở khâu sinh token — khác, và ở một chỗ khác trong luồng._

## 3. Vật liệu + cơ chế: nối Phần 3 và Phần 4

Phần 3 đã giải thích **tầng semantic** là gì: sau khi AST (cây cú pháp trừu tượng — abstract syntax tree) được dựng lên từ code, một bước riêng biệt _phân tích ngữ nghĩa_ — name resolution (ánh xạ tên về ký hiệu), type checking (kiểm tra kiểu), binding (ràng buộc) — tạo ra một cấu trúc **riêng**, không phải AST được "tô màu". Trong Go đó là `types.Info` (side-map nằm bên cạnh AST); trong Roslyn đó là `SemanticModel` (lấy qua `Compilation.GetSemanticModel(syntaxTree)`).

Tại sao cần phân biệt AST và semantic? Vì một lint chỉ dùng AST có thể bị lừa.

Phần 4 đã dựng một harness Go nhỏ để chứng minh đúng điều đó. Đây là output thật khi chạy nó:

```text
== Rule A (syntactic): ban import "net/http" ==
  ✖ svc.go:4:2  forbidden import "net/http"

== Rule B (naive AST match on the name "Getenv") ==
  ? svc.go:14:6  flagged `.Getenv(...)`
  ? svc.go:16:6  flagged `.Getenv(...)`
  -> naive flagged 2 call(s) (one is the harmless decoy = FALSE POSITIVE)

== Rule B (semantic): resolve the callee, ban only the REAL os.Getenv ==
  ✖ svc.go:14:6  forbidden call os.Getenv (read config instead)

Real violations: 2. Build blocked — exit 1.
```

_(Chạy thật: [`go run ./03-harness/main.go`](https://github.com/hieplam/semantic-series-go-proof/blob/main/03-harness/main.go) — exit 1 là đúng, đó là cổng hoạt động.)_

Rule A (cấm import `net/http`) chỉ cần AST — đơn giản, đủ. Rule B (cấm gọi `os.Getenv`) thì AST không đủ: naive match cũng chặn cả method `f.Getenv()` của một struct nội bộ (false positive). Chỉ khi đi qua tầng semantic — dùng `info.ObjectOf(sel.Sel)` để hỏi `go/types` "cái selector này thực chất trỏ về object nào, ở package nào?" — thì mới bắt đúng và bỏ qua decoy.

Đây là lý do tầng semantic không phải "nice to have" với harness AI: rule càng sát với ngữ nghĩa kiến trúc (không gọi secret trực tiếp, không phá dependency direction, không bypass abstraction layer), thì càng cần tầng semantic để phân biệt đúng / sai mà AST nhìn giống nhau.

## 4. Phân biệt quan trọng: grammar-constrained decoding vs analyzer/type-checker

Đây là chỗ tui thấy hay bị gộp lộn nhất trong các bài viết về "AI agent an toàn".

**Grammar-constrained decoding** (còn gọi là structured decoding — giải mã có cấu trúc) là kỹ thuật ép _từng bước sinh token_ của LLM phải hợp một ngữ pháp cho trước (ví dụ GBNF, Outlines, llama.cpp grammar). Ở mỗi bước, chỉ những token hợp lệ theo ngữ pháp hiện tại mới được phép chọn — rác cú pháp bị loại **ngay lúc đẻ ra**. Đây là can thiệp ở tầng **sinh** (generation-time).

**Analyzer / type-checker / lint** là can thiệp **hậu kiểm** (post-hoc): code đã được sinh ra đầy đủ, rồi mới chạy qua công cụ phân tích. Nó bắt được những lỗi mà cú pháp vẫn hoàn toàn đúng nhưng ngữ nghĩa sai — gọi method không tồn tại, truyền sai kiểu, vi phạm dependency rule, gọi hàm bị cấm.

Hai thứ này **bổ sung nhau, không thay thế nhau** ([nguồn: pkg.go.dev/golang.org/x/tools/go/analysis](https://pkg.go.dev/golang.org/x/tools/go/analysis)):

|                                | Grammar-constrained decoding         | Analyzer / type-checker                        |
| ------------------------------ | ------------------------------------ | ---------------------------------------------- |
| **Thời điểm**                  | Lúc sinh (generation-time)           | Sau khi có code (post-hoc)                     |
| **Chặn được gì**               | Rác cú pháp — code không parse được  | Sai ngữ nghĩa — cú pháp đúng nhưng nghĩa sai   |
| **Ví dụ**                      | JSON không đóng ngoặc, GBNF sai nhịp | Gọi `os.Getenv` bị cấm, import không được phép |
| **Cần full compiler context?** | Không — chỉ cần ngữ pháp             | Có — cần type info, symbol resolution          |

Nói gọn: structured decoding là cái **rào trước cổng** (đừng để rác vô), analyzer là cái **bộ lọc trong kho** (thứ vô được rồi nhưng sai rule thì không qua).

> [!NOTE]
> Hai cách can thiệp này tui đối chiếu nguồn [pkg.go.dev/golang.org/x/tools/go/analysis](https://pkg.go.dev/golang.org/x/tools/go/analysis) và [Roslyn analyzer docs](https://github.com/dotnet/roslyn/blob/main/docs/wiki/How-To-Write-a-C%23-Analyzer-and-Code-Fix.md). Blog của factory.ai có đề cập đến việc dùng linter để hướng agent ([factory.ai/news/using-linters-to-direct-agents](https://factory.ai/news/using-linters-to-direct-agents)) — đó là góc nhìn thực hành (practitioner), không phải nguồn quyền uy kỹ thuật.

## 5. Harness thực tế trông như thế nào

Tui kiểm lại điều này trong một audit thực tế trên repo `ai-dict` (kinh nghiệm cá nhân tác giả — local provenance, không phải web fact): rule cấm gọi `chrome.runtime.onMessage.addListener` trực tiếp được encode thành ESLint `no-restricted-syntax` với AST selector. Không phải comment trong code, không phải dòng chữ trong `CONTRIBUTING.md` — mà là **ESLint rule chạy trong CI**, bắt đúng node shape trong AST (ESTree), exit 1 nếu vi phạm.

ESLint xử lý ở tầng cú pháp (AST đủ để match node shape). Nhưng nguyên lý giống hệt Rule B ở Phần 4 — quyết định "cho qua hay không" được đưa ra bởi máy, không phải bởi con người nhớ rule.

Khi AI agent viết code cho repo đó:

1. Nó sinh code (có thể dùng grammar-constrained decoding để đảm bảo code parse được).
2. Nó chạy `bun run lint` — cổng đầu tiên (AST rule, dependency rule).
3. Nó chạy compile/type-check — cổng thứ hai (semantic rule: gọi đúng hàm không? kiểu đúng không?).
4. Nếu cả hai qua thì mới vô CI.

Bước nào fail là bước đó explain lại bằng machine-readable error. Agent đọc error, sửa, chạy lại. Vòng lặp này không cần "tin tưởng" agent — nó **ép buộc** về mặt cơ học.

## 6. Khép series: chữ "semantic" đã được gỡ

Hồi Phần 1, tui đặt câu hỏi: tại sao một ông kỹ sư già lại đi viết sáu bài về một chữ?

Đây là đáp án đầy đủ:

- **"Semantic search"** (Phần 2) và **"semantic model"** (Phần 3) là hai chữ dùng cùng từ nhưng chỉ hai thứ chẳng liên quan — embedding vector vs bảng ký hiệu compiler. Hiểu lầm này thì hiểu lầm cả hai.
- **AST** (Phần 1) chỉ là cú pháp — hình dạng code. Tầng semantic là một cấu trúc riêng, dựng **trên** AST, trả lời câu hỏi "cái này trỏ tới đâu, kiểu gì" mà AST không biết.
- Tầng semantic đó (Phần 3) + lint viết từ nó (Phần 4) = **harness ghì cương AI** (bài này).
- Và cái ghì đó hoạt động bởi nó là **by construction** — không phải by instruction.

Series liên kết _"Bắt LLM code đúng bằng kiến trúc"_ đi sâu hơn vô mặt kiến trúc: port/adapter pattern, dependency injection, rule viết bằng lint thay vì viết bằng comment — tất cả đều cùng một nguyên lý. Nếu series này gỡ được cái chữ cho bạn, series đó sẽ chỉ cho bạn cách dùng cái gỡ được đó.

---

_← [Phần 4: Lấy AST viết hard-rule — cái lint chặn code sai](/memo/posts/ast-viet-hard-rule-lint/)_
_↑ [Mục lục series](/memo/posts/chu-semantic-mot-chu-nhieu-nghia/)_
