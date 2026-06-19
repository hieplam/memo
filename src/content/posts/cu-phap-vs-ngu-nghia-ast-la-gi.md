---
title: "Cú pháp vs Ngữ nghĩa: AST thật ra là gì (và không là gì)"
description: "Phần 1 — Mổ xẻ abstract syntax tree (cây cú pháp trừu tượng). Chạy go/ast thật, chứng minh AST chỉ biết hình dạng code chứ không biết kiểu, không biết giá trị, không biết cái tên trỏ tới đâu. Đặt nền cho tầng semantic ở Phần 3."
pubDatetime: 2026-06-19T05:00:00Z
tags:
  [
    "semantic",
    "ast",
    "compiler",
    "go",
    "roslyn",
    "vietnamese",
    "semantic-series",
  ]
lang: "vi"
---

> **Series "Giải mã chữ semantic" — Phần 1/5.**
> ← [Mục lục series](/memo/posts/chu-semantic-mot-chu-nhieu-nghia/) · Tiếp theo → [Phần 2: "Semantic search" là gì](/memo/posts/semantic-search-la-gi/)

## Tóm tắt nhanh

- Compiler đi qua ba khâu chính: **lexical analysis (phân tích từ vựng)** → **parsing (phân tích cú pháp)** → **semantic analysis (phân tích ngữ nghĩa)**. AST nằm ở _cuối khâu cú pháp_, trước khi ngữ nghĩa bắt đầu.
- **Parse tree** giữ mọi nốt ngữ pháp (kể cả dấu ngoặc, dấu chấm phẩy). **AST** lược bớt những gì không cần cho downstream — gọn hơn, nhưng vẫn là _cú pháp thuần_.
- Chạy `go run ./01-ast` xác nhận: mỗi `x` trong cây chỉ là `*ast.Ident{Name:"x"}` — không có trường kiểu, không có giá trị. `2 + 3` là `BinaryExpr`, _không_ phải số 5.
- Trường `.Obj` trong `go/ast` có vẻ là một nhánh tới thông tin ngữ nghĩa, nhưng **đã bị deprecated** và không mang thông tin kiểu — đừng tin vô nó.
- Cái AST **không** biết: kiểu của `x`, ý nghĩa của `+`, cái tên trỏ tới khai báo nào. Đó là việc của tầng semantic — một _cấu trúc riêng_, không phải AST "được tô màu thêm".

---

Hồi tui mới học compiler, tui đọc đâu đó câu _"AST là trái tim của compiler"_. Nghe hoành tráng. Nhưng tui lộn chỗ: tui cứ nghĩ cái "trái tim" đó biết _tất cả_ — kiểu dữ liệu, giá trị, mọi thứ. Mất một lúc gỡ debug cái linter đầu tiên tui viết, tui mới thấm: AST thật ra biết rất ít. Và cái nó _không_ biết mới là phần thú vị.

Bài này chứng minh điều đó bằng code chạy được, không bằng lời.

## 1. Đường ống compiler: cú pháp trước, ý nghĩa sau

Trước khi nói AST, cần thấy nó nằm ở đâu trong đường ống.

Source code đi qua ba giai đoạn lớn ([nguồn: Crafting Interpreters, "A Map of the Territory"](https://craftinginterpreters.com/a-map-of-the-territory.html)):

1. **Lexical analysis — phân tích từ vựng (scanning):** Đọc chuỗi ký tự thô, cắt ra thành **tokens** (đơn vị từ vựng). `x := 2 + 3` thành `[IDENT "x", DEFINE ":=", INT "2", ADD "+", INT "3"]`. Không hiểu quan hệ giữa chúng — chỉ nhận diện "từ".

2. **Parsing — phân tích cú pháp:** Nhận danh sách token, kiểm tra xem chúng có xếp đúng ngữ pháp không, rồi dựng ra **abstract syntax tree (cây cú pháp trừu tượng — AST)**. Kết quả là một cấu trúc cây biểu diễn _hình dạng_ của code. Khâu này kết thúc là xong phần **cú pháp (syntax)**.

3. **Semantic analysis — phân tích ngữ nghĩa:** Nhận AST, đi qua và hỏi những câu mà cú pháp không trả lời được: cái tên `x` này trỏ tới khai báo nào? Kiểu của biểu thức đó là gì? Phép gán có hợp lệ kiểu không? Khâu này là **ngữ nghĩa (semantics)** — và nó _tiêu thụ_ AST, không _sản xuất_ nó ([nguồn: Crafting Interpreters, "Resolving and Binding"](https://craftinginterpreters.com/resolving-and-binding.html)).

![Sơ đồ đường ống compiler: mã nguồn → tokens → AST (cú pháp) → semantic model (ngữ nghĩa)](/memo/diagrams/semantic/01-pipeline.svg)

_Đường ống compiler: cú pháp (scan → parse → AST) nằm trước ngữ nghĩa. AST là đầu ra của khâu cú pháp, là đầu vào của khâu ngữ nghĩa — hai việc khác nhau._

**Điểm cốt lõi:** AST là _sản phẩm cuối_ của khâu cú pháp. Nó chưa biết gì về _ý nghĩa_ của chương trình. Semantic analysis là một bước riêng, sau đó, dựng thêm thông tin bên cạnh AST.

## 2. Parse tree vs AST: lược bớt cái gì và tại sao

Thường gặp lộn lẫn giữa hai khái niệm này.

**Parse tree (cây phân tích cú pháp — còn gọi là concrete syntax tree)** là cái gần như gương phản chiếu của ngữ pháp (grammar): mỗi luật sản xuất (production rule) trong grammar đều có một nốt tương ứng trong cây. Dấu ngoặc, dấu chấm phẩy, các luật trung gian chỉ để "nhóm" biểu thức — tất cả đều có mặt. Parse tree _đầy đủ_ nhưng _rườm rà_.

**AST (abstract syntax tree)** là parse tree đã được _lược bỏ_ những gì downstream không cần ([nguồn: Crafting Interpreters, "Representing Code"](https://craftinginterpreters.com/representing-code.html)):

- Dấu ngoặc trong `(2 + 3)` → không cần nốt riêng; thứ tự phép tính đã được mã hoá vô _cấu trúc cây_.
- Dấu chấm phẩy cuối câu → bỏ.
- Các luật ngữ pháp trung gian một-nốt (single-production chains) → dẹp luôn.

Cùng một source code, AST _gọn hơn_ và _trực tiếp hơn_ để làm việc. Nhưng cả hai — parse tree lẫn AST — đều là **cú pháp thuần**. Cả hai đều chưa biết kiểu, chưa biết binding (ràng buộc tên → ký hiệu).

> [!NOTE]
> Tên gọi "abstract" trong AST không có nghĩa là "trừu tượng về mặt ngữ nghĩa". Nó "trừu tượng" theo nghĩa đã _lược bớt_ các chi tiết ngữ pháp bề mặt không cần thiết — vẫn là cú pháp.

## 3. Demo Go: AST thật sự trông như thế nào

Đủ lý thuyết. Chạy code.

Package `go/ast` trong thư viện chuẩn Go cho phép parse source code và walk qua cây AST. File demo `01-ast/main.go` parse một chương trình nhỏ rồi in ra ba quan sát:

```go
const src = `package sample

func f(n int) int { return n }

func demo() {
    x := 2 + 3
    y := x * f(x)
    _ = y
}`
```

Chạy ([source trên GitHub](https://github.com/hieplam/semantic-series-go-proof/blob/main/01-ast/main.go)):

```
go run ./01-ast
```

Output thật (copy từ terminal):

```text
== 1a. The raw syntax tree of `x := 2 + 3` (structure only) ==
     0  *ast.AssignStmt {
     1  .  Lhs: []ast.Expr (len = 1) {
     2  .  .  0: *ast.Ident {
     3  .  .  .  NamePos: sample.go:6:2
     4  .  .  .  Name: "x"
     5  .  .  .  Obj: *ast.Object {
     6  .  .  .  .  Kind: var
     7  .  .  .  .  Name: "x"
     8  .  .  .  .  Decl: *(obj @ 0)
     9  .  .  .  }
    10  .  .  }
    11  .  }
    12  .  TokPos: sample.go:6:4
    13  .  Tok: :=
    14  .  Rhs: []ast.Expr (len = 1) {
    15  .  .  0: *ast.BinaryExpr {
    16  .  .  .  X: *ast.BasicLit {
    17  .  .  .  .  ValuePos: sample.go:6:7
    18  .  .  .  .  ValueEnd: sample.go:6:8
    19  .  .  .  .  Kind: INT
    20  .  .  .  .  Value: "2"
    21  .  .  .  }
    22  .  .  .  OpPos: sample.go:6:9
    23  .  .  .  Op: +
    24  .  .  .  Y: *ast.BasicLit {
    25  .  .  .  .  ValuePos: sample.go:6:11
    26  .  .  .  .  ValueEnd: sample.go:6:12
    27  .  .  .  .  Kind: INT
    28  .  .  .  .  Value: "3"
    29  .  .  .  }
    30  .  .  }
    31  .  }
    32  }

== 1b. Every 'x' is the SAME bare node: *ast.Ident{Name:"x"} ==
  sample.go:6:2 -> *ast.Ident{Name:"x"}  (no type, no value)
  sample.go:7:7 -> *ast.Ident{Name:"x"}  (no type, no value)
  sample.go:7:13 -> *ast.Ident{Name:"x"}  (no type, no value)

== 1c. '2 + 3' is a BinaryExpr, NOT the number 5 ==
  found 2 + 3  — the tree stores the operation, never evaluates it
```

**Đọc output này, ba điều hiện ra ngay:**

**1a — Cấu trúc, không phải giá trị.** Câu `x := 2 + 3` được biểu diễn là một `*ast.AssignStmt`. Vế phải là `*ast.BinaryExpr` chứa hai `*ast.BasicLit` với `Value: "2"` và `Value: "3"`. Chú ý: `Value` ở đây là _chuỗi_ `"2"` và `"3"`, không phải số nguyên. Và không có đâu lưu kết quả `5` cả — AST lưu _phép tính_, không _kết quả_.

**1b — Ba `x` y hệt nhau.** Ở dòng khai báo (`x := ...`), ở `x * f(x)` (biến), và ở `f(x)` (đối số) — ba chỗ dùng `x` đều ra cùng một loại node: `*ast.Ident{Name:"x"}`. AST _không_ phân biệt được đây là cùng một biến hay ba thứ khác nhau trùng tên. Đó là việc của tầng semantic.

**1c — `2 + 3` là `BinaryExpr`, không phải `5`.** AST không evaluate. Nó lưu _ý định_ ("cộng hai cái này"), không _kết quả_. Constant folding (tính trước hằng số tại compile time) là một trong ba việc của `go/types` — tầng semantic.

## 4. Chuyện về trường `.Obj` — một cái bẫy hay gặp

Nhìn vô output 1a, bạn thấy `*ast.Ident` có trường `.Obj: *ast.Object`. Trông có vẻ như cây AST _có_ liên kết scope rồi đó — có `Kind: var`, có `Name: "x"`.

Đừng tin vô nó.

Docs chính thức `go/ast` ghi rõ: trường `Scope` và `Object` trong `go/ast` đã **deprecated** — và tài liệu redirect thẳng về [`go/types`](https://pkg.go.dev/go/types) ([nguồn: pkg.go.dev/go/ast](https://pkg.go.dev/go/ast)). `.Obj` là một cơ chế scope _sơ khai_ từ thời ban đầu của package, _không_ mang thông tin kiểu. Nó không phải tầng semantic — nó là dấu vết của một attempt thiếu sót, và người dùng ngày nay không nên dựa vô.

> [!WARNING]
> `.Obj` trong `go/ast` trông như "AST biết thêm về semantics", nhưng thực ra nó đã deprecated và không cho bạn kiểu hay binding đúng nghĩa. Tầng semantic thật sự là `go/types` — một side-map riêng biệt, không phải field trong AST node.

Cái bẫy hay xảy ra là: người ta nhìn thấy `.Obj`, nghĩ "ồ, AST cũng có ít nhiều ngữ nghĩa", rồi kết luận sai rằng semantic analysis "tô màu lên" AST. Không phải vậy. Trong Go, `types.Info` là một **side-map** hoàn toàn riêng, ánh xạ từ `*ast.Ident` → `Object`, từ `ast.Expr` → `TypeAndValue`. AST gốc _bất biến_, không bị ghi thêm gì.

## 5. Cái AST không biết — và tại sao điều đó quan trọng

Tổng kết những gì demo vừa cho thấy. AST của `x := 2 + 3` _không_ biết:

| Câu hỏi                                              | Trả lời của AST              | Ai trả lời được                   |
| ---------------------------------------------------- | ---------------------------- | --------------------------------- |
| `x` kiểu gì?                                         | Không biết — chỉ có tên      | `go/types` → `int`                |
| `2 + 3` bằng mấy?                                    | Không biết — chỉ có cấu trúc | `go/types` constant folding → `5` |
| Ba `x` này là cùng một biến không?                   | Không biết                   | `go/types` name resolution        |
| `+` ở đây nghĩa là gì (int cộng, hay string concat)? | Không biết                   | `go/types` type deduction         |

Đây chính là lý do semantic analysis tồn tại: nó trả lời những câu mà _hình dạng code_ không đủ để trả lời. Và theo cách Go thiết kế, câu trả lời đó nằm trong `types.Info` — một cấu trúc _bên cạnh_ AST, không phải bên trong nó. (Roslyn làm tương tự với `SemanticModel` — ta sẽ thấy ở Phần 3.)

## 6. Ghé ngang C#: SyntaxTree vs SemanticModel

Để cân bằng với Roslyn (vì chữ "semantic model" vốn là thuật ngữ của Roslyn): trong C#, AST tương ứng là `SyntaxTree` — sản phẩm của khâu parse.

```csharp
// minh hoạ, đối chiếu Microsoft Learn — không chạy được trên máy này
SyntaxTree tree = CSharpSyntaxTree.ParseText(source);
// tree: cấu trúc cú pháp, CHƯA biết kiểu, chưa biết binding
```

Tài liệu Roslyn nói thẳng (trích nguyên văn từ [Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/work-with-semantics)): _"Syntax trees represent the lexical and syntactic structure of source code. Although this information alone is enough to describe all the declarations and logic in the source, it is **not enough information to identify what is being referenced**."_

Câu đó chính xác là bản Roslyn của demo Go ở trên. Để biết "được referenced" là gì, bạn cần `SemanticModel` — và `SemanticModel` chỉ tồn tại trong ngữ cảnh của `Compilation`, không phải của `SyntaxTree` riêng lẻ. Nhưng đó là câu chuyện Phần 3.

## 7. Nhìn về phía trước: vì sao ranh giới này quan trọng với AI agent

Bài 4 và 5 của series sẽ nói về dùng AST (và tầng semantic) để _ghì cương_ AI agent code bậy. Một câu spoiler ngắn để bạn thấy tại sao hiểu ranh giới này không phải học thuật thuần tuý:

- **Lint dựa trên AST thuần** (như ESLint `no-restricted-syntax`, hay một Go analyzer đơn giản): kiểm tra _hình dạng_ code. Đủ để chặn `chrome.runtime.onMessage.addListener` xuất hiện trực tiếp trong source — không cần biết kiểu.
- **Lint cần tầng semantic** (như Roslyn analyzer nhận `SemanticModel`): kiểm tra _ý nghĩa_. Cần để phân biệt "cái `.Getenv()` này gọi `os.Getenv` (đọc secret) hay một mock trong test?" — AST không thể trả lời, vì nó chỉ thấy tên `Getenv`, không thấy nó được resolve về đâu.

Ranh giới cú pháp / ngữ nghĩa quyết định bạn dùng tool nào để làm harness (bộ rào). Biết AST là gì — và _không là gì_ — là bước đầu để thiết kế cái harness đó đúng chỗ.

---

**Tóm lại bài này:** AST là cây cú pháp — nó lưu hình dạng của code (statement, expression, operator) nhưng không biết kiểu, không evaluate, không resolve tên. Trường `.Obj` trong `go/ast` nhìn có vẻ ngữ nghĩa nhưng đã deprecated và không đáng tin. Tầng semantic là cấu trúc riêng biệt, bước tiếp theo — và đó là chủ đề của Phần 3.

Phần 2 sẽ tạm rời compiler để nhảy sang thế giới kia của chữ "semantic": semantic search là gì, nó dùng _vector embeddings_ thay vì _symbol table_, và tại sao hai chữ "semantic" này không nên bị gộp chung.

→ Tiếp theo: [Phần 2 — "Tool này không có semantic search" nghĩa là gì](/memo/posts/semantic-search-la-gi/)

← Quay lại: [Mục lục series](/memo/posts/chu-semantic-mot-chu-nhieu-nghia/)
