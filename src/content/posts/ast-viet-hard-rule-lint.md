---
title: "Lấy AST viết hard-rule: cái lint nhỏ mà chặn được code sai"
description: "Dùng AST và tầng semantic (go/types) để viết luật lint cứng — cái chặn build thật sự. Demo Go: luật cấm import thì AST đủ, nhưng luật cấm os.Getenv phải có go/types mới không dính oan f.Getenv."
pubDatetime: 2026-06-19T02:00:00Z
tags:
  ["semantic", "ast", "compiler", "lint", "go", "vietnamese", "semantic-series"]
lang: "vi"
---

> **Series "Gỡ rối chữ semantic" — Phần 4/5.**
> ← [Phần 3: "Roslyn có semantic model" — tầng nghĩa dựng trên AST](/memo/posts/semantic-model-roslyn-go-types/)
> → [Phần 5: Ghì cương AI agent bằng kiến trúc, không bằng lời dặn](/memo/posts/ghi-cuong-ai-agent-bang-construction/)
> Đọc từ đầu: [mục lục series](/memo/posts/chu-semantic-mot-chu-nhieu-nghia/)

## Tóm tắt nhanh

- Một cái **lint cứng** (hard-rule) là đoạn code duyệt AST — và khi cần, hỏi tầng semantic — rồi **phát lỗi chặn build** nếu vi phạm.
- **Luật về cấu trúc** (cấm import package X, cấm câu `for-range` trên loại Y) → **AST là đủ**, không cần tầng semantic.
- **Luật về ý nghĩa** (cấm gọi hàm `os.Getenv` thật sự) → **phải qua go/types** (hoặc SemanticModel trong Roslyn), vì chỉ có tầng đó mới biết cái `.Getenv()` đó là của `os` hay của một struct giả tên giống.
- Demo Go chạy thật, **exit 1 là cố ý** — đúng như harness phải làm: có vi phạm thì chặn.
- Đây chính là cái cổng mà [Phần 5](/memo/posts/ghi-cuong-ai-agent-bang-construction/) sẽ gắn vào để ghì cương AI agent.

---

Có một câu tôi nghe nhiều trong các buổi review gần đây: _"Mình đã để trong prompt rồi, nó không được dùng package đó."_ Rồi một tuần sau: _"Sao con agent nó lại gọi `os.Getenv` thẳng vậy?"_

Chuyện hiển nhiên — nó **không tuân theo lời dặn**, vì markdown trong prompt không có enforcement mechanism (cơ chế cưỡng bức). Muốn thật sự chặn, phải dùng máy: lint, type-checker, analyzer. Và đây là chỗ hiểu biết về AST và tầng semantic có giá trị thực tế.

Bài này là bằng chứng cụ thể. Code Go ~63 dòng logic (105 dòng file), chạy được, output copy thẳng từ terminal.

## 1. Tinh thần: "viết cái lint nhỏ, thấy code sai thì ban"

Một **hard-rule lint** — tôi hay gọi vui là "luật thép" — không phải cái gì ghê gớm. Nó chỉ là một chương trình con làm ba việc:

1. **Parse** đoạn code cần kiểm tra thành AST (cây cú pháp trừu tượng — abstract syntax tree).
2. **Duyệt** cái cây đó (và nếu cần, truy vấn tầng semantic).
3. **Báo lỗi** — và nếu có vi phạm, **thoát với exit code khác 0**, làm CI/build bị đỏ.

Bước 1–2 mượn đúng cái pipeline compiler đã nói ở các phần trước: lexical → parse → AST → semantic. Bước 3 là phần "cứng" — không phải warning, không phải suggestion, mà **chặn thật**.

Giá trị thực là ở chỗ nào thì phải dùng AST thôi, và chỗ nào _bắt buộc_ phải dùng thêm tầng semantic. Ranh giới đó quan trọng hơn nhiều người nghĩ.

## 2. Demo Go: hai luật, hai mức sâu

Tôi chuẩn bị sẵn một harness nhỏ (`03-harness`) với đoạn code giả bị đem đi "kiểm tra". Đoạn code đó vi phạm **hai luật**:

- **Luật A (cú pháp):** Không được `import "net/http"` trong file service.
- **Luật B (ngữ nghĩa):** Không được gọi `os.Getenv` trực tiếp (phải đọc config qua wrapper).

Quan trọng: trong đoạn code dưới kiểm tra có **một cái bẫy** — một method `f.Getenv(...)` trên một struct giả tên `fake`. Cái bẫy đó **không vi phạm** Luật B vì nó không phải `os.Getenv` thật, chỉ là một method cùng tên. Một luật viết kém (khớp tên thô) sẽ dính cái bẫy này.

Chạy harness ([source trên GitHub](https://github.com/hieplam/semantic-series-go-proof/blob/main/03-harness/main.go)):

```bash
go run ./03-harness; echo "exit=$?"
```

Output thật — copy nguyên xi từ terminal:

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
exit=1
```

**Exit 1 là cố ý và đúng.** Có vi phạm thật sự (1 import + 1 gọi hàm), harness chặn build. Đó chính xác là hành vi ta muốn.

## 3. Phân tích output: ranh giới cú pháp / ngữ nghĩa hiện ra rõ ràng

### Luật A: AST là đủ

`import "net/http"` là một **cấu trúc cú pháp** — nó nằm thẳng trong cây AST ở `file.Imports`. Không cần biết package `net/http` khai báo gì, không cần giải symbol, chỉ cần khớp chuỗi:

```go
for _, imp := range file.Imports {
    if imp.Path.Value == `"net/http"` {
        // vi phạm
    }
}
```

Đơn giản vậy thôi. **Luật về cấu trúc — AST là đủ.**

### Luật B: naive AST dính bẫy

Bước "naive" duyệt toàn bộ cây tìm `SelectorExpr` (biểu thức dạng `x.Y`) có tên `.Sel.Name == "Getenv"`. Nó tìm thấy **hai chỗ**: dòng 14 (`os.Getenv`) và dòng 16 (`f.Getenv`). Cả hai đều bị flagged.

Dòng 16 là **false positive** (kết quả dương tính giả) — `f` là biến của struct `fake`, method `Getenv` của nó hoàn toàn vô hại. Khớp tên thô không phân biệt được điều đó.

### Luật B: go/types giải quyết đúng

Bước semantic dùng `info.ObjectOf(sel.Sel)` — đây là convenience method kiểm tra cả hai map `types.Info.Uses` (tham chiếu) và `types.Info.Defs` (khai báo) trong cái side-map (cấu trúc riêng biệt, không phải AST được tô màu thêm) mà `go/types` xây dựng sau khi phân tích ngữ nghĩa. Với call-site selector như `os.Getenv`, kết quả đến từ `Uses`:

```go
obj := info.ObjectOf(sel.Sel)
if obj != nil && obj.Pkg() != nil &&
   obj.Pkg().Path() == "os" && obj.Name() == "Getenv" {
    // đây mới là vi phạm thật
}
```

`obj.Pkg().Path()` trả về `"os"` cho `os.Getenv`, và trả về `"svc"` cho `f.Getenv`. **Chỉ cái trước mới bị ban.** Không dính oan.

> [!NOTE]
> Theo tài liệu `go/types`, `types.Info.Uses` map ánh xạ mỗi `*ast.Ident` (tên định danh) tới `Object` mà nó **tham chiếu** tới — và `Object.Pkg()` cho biết package chứa symbol đó. Đây là phân giải tên (name resolution) — một trong ba việc `go/types` làm cùng lúc với type deduction và constant folding. ([pkg.go.dev/go/types](https://pkg.go.dev/go/types))

![Sơ đồ: luật cú pháp chỉ đi qua AST, luật ngữ nghĩa đi qua go/types để phân giải symbol](/memo/diagrams/semantic/04-syntactic-vs-semantic-rule.svg)

_Luật cú pháp (Luật A) chỉ cần đi qua AST — khớp node là xong. Luật ngữ nghĩa (Luật B) phải xuống tầng go/types để phân giải symbol, tránh dính oan f.Getenv của struct fake._

## 4. Bài học: cấu trúc vs ý nghĩa — chọn đúng tầng

Sau demo trên, quy tắc ngón tay cái tôi dùng:

| Câu hỏi luật hỏi                                                                                            | Tầng cần dùng                                    |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| "Đoạn code có hình dạng X không?" (cấm import, cấm kiểu loop, cấm từ khóa)                                  | **AST đủ**                                       |
| "Cái này _thực chất_ là gì?" (đây có phải hàm `os.Getenv` không, type này có implement interface kia không) | **Cần tầng semantic** (go/types / SemanticModel) |

Nói ngắn hơn: **luật về cấu trúc → AST; luật về danh tính → semantic layer.**

Đây không phải tôi tự bịa — đây là đúng kiến trúc các công cụ phân tích code thật sự xây dựng.

## 5. Các công cụ thật làm đúng vậy

### Go: golang.org/x/tools/go/analysis

Framework chuẩn để viết analyzer trong Go ecosystem là [`golang.org/x/tools/go/analysis`](https://pkg.go.dev/golang.org/x/tools/go/analysis). Mỗi `Analyzer` nhận một `Pass` có đủ:

- `Pass.Fset` và `Pass.Files` — AST của package đang kiểm tra.
- `Pass.TypesInfo *types.Info` — tầng semantic (đã được `go/types` phân giải xong).

`go vet` được xây trên chính framework này. Harness demo trong bài cũng theo đúng tinh thần đó, chỉ khởi tạo thủ công thay vì qua `analysis.Pass`.

### ESLint: rule duyệt AST (ESTree)

ESLint rules duyệt **AST theo chuẩn ESTree** (JavaScript AST). Rule `no-restricted-syntax` cho phép viết **CSS-selector-like syntax** để cấm các node shape nhất định — ví dụ cấm `SequenceExpression`, cấm `WithStatement`.

Trong series anh em của series này — _"Bắt LLM code đúng bằng kiến trúc"_ — tôi có một luật thật: dùng `no-restricted-syntax` với selector cấm raw `chrome.runtime.onMessage.addListener` trực tiếp trong content script, ép mọi listener phải đi qua một wrapper có validation. _(Đây là ví dụ từ audit của chính tôi trên `ai-dict`, không phải nguồn web nào.)_

Với ESLint, phần lớn luật kiểu "cấm cấu trúc này" đều dừng ở tầng AST — tương đương Luật A của demo. ESLint không có type inference mạnh như Go/TypeScript; để đạt độ chính xác của Luật B, cần dùng typescript-eslint với type-aware rules (mới đi qua được TypeScript's type checker).

### Roslyn: SemanticModel sẵn có trong mọi analyzer

Trong C#/Roslyn, khi viết analyzer, bạn luôn có quyền truy cập `SemanticModel`. Như Roslyn docs nói (tôi trích nguyên văn): _"Syntax trees represent the lexical and syntactic structure of source code. Although this information alone is enough to describe all the declarations and logic in the source, it is **not enough information to identify what is being referenced**."_ ([Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/work-with-semantics))

Vì vậy, Roslyn analyzer thường lấy `SemanticModel` qua `context.SemanticModel` (trong diagnostic analyzer callback) rồi gọi `GetSymbolInfo(node)` để biết symbol thật — tương đương `info.ObjectOf()` trong Go. _(Minh hoạ, đối chiếu Microsoft Learn — máy tôi không có .NET để chạy.)_

> [!WARNING]
> Một lỗi phổ biến: dùng `GetTypeInfo()` rồi mong nhận `INamedTypeSymbol` trực tiếp. Sai — `GetTypeInfo()` trả về `TypeInfo` **struct**, `.Type` của nó mới là `ITypeSymbol`. Sự khác biệt nhỏ nhưng code sẽ không compile nếu gán nhầm.

## 6. Tại sao ranh giới này quan trọng cho AI agent

Nếu bạn đã đọc các phần trước, câu hỏi tự nhiên là: _"Vậy viết hard-rule kiểu này thì dùng vào AI agent chỗ nào?"_

Câu trả lời đơn giản: **đây chính là cái cổng kiểm tra output của agent.**

AI agent viết code xong → code đó chạy qua lint/type-checker → nếu vi phạm luật kiến trúc → build đỏ → agent phải viết lại. Không cần tin vào lời dặn trong prompt. Không cần review tay. Máy chặn.

Nhưng để cái cổng đó chặn đúng chỗ (không dính oan, không bỏ sót), bạn cần hiểu luật nào cần AST và luật nào cần tầng semantic — đúng cái bài học của demo trên.

Phần 5 sẽ đi sâu vào cách nối cái cổng đó vào luồng AI agent thực tế — không phải lý thuyết, mà là pattern cụ thể từ series anh em _"Bắt LLM code đúng bằng kiến trúc"_ mà tôi đang làm trên chính codebase `ai-dict`.

---

**Tiếp theo:** [Phần 5 — Ghì cương AI agent bằng kiến trúc, không bằng lời dặn](/memo/posts/ghi-cuong-ai-agent-bang-construction/)

**Quay lại:** [Phần 3 — "Roslyn có semantic model" — tầng nghĩa dựng trên AST](/memo/posts/semantic-model-roslyn-go-types/) | [Mục lục series](/memo/posts/chu-semantic-mot-chu-nhieu-nghia/)

---

_Nguồn chính cho bài này: [`pkg.go.dev/golang.org/x/tools/go/analysis`](https://pkg.go.dev/golang.org/x/tools/go/analysis) · [`pkg.go.dev/go/types`](https://pkg.go.dev/go/types) · [Roslyn SDK — Work with semantics](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/work-with-semantics) · [Crafting Interpreters — Representing Code](https://craftinginterpreters.com/representing-code.html). ESLint selector ví dụ: kinh nghiệm cá nhân của tác giả trên `ai-dict`, không phải nguồn web._
