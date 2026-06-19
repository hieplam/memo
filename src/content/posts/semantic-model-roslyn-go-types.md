---
title: '"Roslyn có semantic model" — tầng nghĩa dựng trên AST'
description: 'Phần 3: Semantic model của compiler là gì, và nó KHÔNG phải AST được tô màu. Demo Go chạy thật: cùng tên "x" nhưng shadowing cho ra 2 biến khác nhau — go/types phân giải chính xác từng chỗ dùng qua side-map riêng. Đối chiếu Roslyn (C#): 3 tầng SyntaxTree / Compilation / SemanticModel và cách gọi đúng API.'
pubDatetime: 2026-06-19T03:00:00Z
tags:
  [
    "semantic",
    "ast",
    "compiler",
    "roslyn",
    "go",
    "go-types",
    "vietnamese",
    "semantic-series",
  ]
lang: "vi"
---

> **Series "Giải mã chữ semantic"** — bạn đang đọc Phần 3.
> ← [Phần 2: "Semantic search" là gì](/memo/posts/semantic-search-la-gi/) | [Mục lục series](/memo/posts/chu-semantic-mot-chu-nhieu-nghia/) | [Phần 4: Lấy AST viết hard-rule →](/memo/posts/ast-viet-hard-rule-lint/)

## Tóm tắt nhanh

- **AST chỉ biết hình dạng.** Nó không trả lời được: tên `x` này trỏ khai báo nào, kiểu gì, biểu thức `2 + 3` ra giá trị mấy.
- **Semantic model** là tầng riêng — không phải AST được "tô màu" — trả lời đúng những câu đó.
- **Go demo chạy thật:** cùng chữ `x` viết 4 lần (2 khai báo + 2 chỗ dùng), nhưng shadowing tạo 2 biến khác loại (`int` / `string`). `go/types` phân giải từng chỗ dùng vô đúng biến, lưu kết quả trong **`types.Info`** — một side-map tách hẳn cây AST.
- **Roslyn nói thẳng** (3 tầng): `SyntaxTree` (cú pháp bất biến) → `Compilation` (toàn cảnh build) → `SemanticModel` (hỏi-nghĩa, lấy từ `Compilation`, không phải từ `SyntaxTree`).
- **Cái bẫy hay gặp:** `types.Info.Types` KHÔNG chứa kiểu của _mọi_ identifier; `GetTypeInfo` trả `TypeInfo` struct, không phải `INamedTypeSymbol`.

---

Hồi tui mới tiếp cận Roslyn, tui đọc thấy câu "Roslyn có semantic model" rồi tự hỏi: _model đó nằm ở đâu, trong cái cây AST ấy à?_ Tra mấy bài blog thì thấy người ta hay nói kiểu "semantic analysis **tô màu** lên AST" — annotated AST, decorated AST. Nghe xuôi. Nhưng sai.

Bài này ta sẽ đi từ câu hỏi cụ thể mà AST không trả lời được, dùng Go chạy thật để thấy cái side-map thực sự trông như thế nào, rồi đối chiếu với Roslyn để hiểu ba tầng của nó.

## 1. Bốn câu AST không trả lời được

Lấy đoạn code Go nhỏ:

```go
func demo() {
    x := 2 + 3        // outer x
    {
        x := "hi"     // inner x — shadow outer x
        fmt.Println(x) // dùng x nào?
    }
    fmt.Println(x)     // dùng x nào?
}
```

AST (abstract syntax tree — cây cú pháp trừu tượng) nhìn vô đây thấy gì? Nó thấy: có hai phép khai báo (`:=`), hai lời gọi `fmt.Println`, và bốn node `Ident` cùng tên `"x"` (2 nút khai báo + 2 nút tham chiếu). Đó là tất cả. Cấu trúc ngữ pháp hoàn toàn ổn.

Nhưng nếu bạn hỏi:

1. `x` ở dòng `fmt.Println(x)` đầu tiên trỏ đến khai báo nào?
2. `x` ở `fmt.Println(x)` thứ hai trỏ đến khai báo nào?
3. Hai cái `x` trong cùng hàm này — một loại hay hai loại?
4. `2 + 3` là biểu thức gì ở run-time, hay compile-time tính được luôn?

AST im. Nó không biết. Theo đúng tài liệu Roslyn (verbatim): _"Syntax trees represent the lexical and syntactic structure of source code. Although this information alone is enough to describe all the declarations and logic in the source, it is **not enough information to identify what is being referenced**."_ [(Microsoft Learn)](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/work-with-semantics)

Bốn câu trên là việc của tầng **semantic** — và Go gọi tầng đó là `go/types`.

## 2. Demo Go: go/types phân giải shadowing

Chạy thật ([source trên GitHub](https://github.com/hieplam/semantic-series-go-proof/blob/main/02-types/main.go)):

```bash
go run ./02-types
```

Output (verbatim từ máy tui):

```text
== 2a. Every 'x' resolves to a concrete object WITH a type ==
  sample.go:6:2 DECL  x#1 : int
  sample.go:8:3 DECL  x#2 : string
  sample.go:9:15 USE   x : string   -> resolves to x#2 (declared at sample.go:8:3)
  sample.go:11:14 USE   x : int      -> resolves to x#1 (declared at sample.go:6:2)

== 2b. The two declarations are DIFFERENT objects ==
  go/types created 2 distinct 'x' variables (AST saw 1 spelling, 4 nodes)

== 2c. '2 + 3' is the constant int 5 — the semantic layer evaluates it ==
  expr `2 + 3`  type=int  value=5  (the AST only stored the operation)
```

Đọc từng dòng:

- **`sample.go:6:2 DECL x#1 : int`** — khai báo `x := 2 + 3` tạo ra một biến, `go/types` đặt tên nội bộ `x#1`, kiểu `int`.
- **`sample.go:8:3 DECL x#2 : string`** — khai báo `x := "hi"` trong block con tạo ra một biến _khác_, `x#2`, kiểu `string`.
- **`sample.go:9:15 USE x : string → x#2`** — `fmt.Println(x)` trong block con dùng đúng `x#2` (string).
- **`sample.go:11:14 USE x : int → x#1`** — `fmt.Println(x)` bên ngoài dùng đúng `x#1` (int).
- **`2 + 3` → `type=int value=5`** — biểu thức compile-time constant được `go/types` tính ra luôn (constant folding — tính hằng tại compile-time), không chờ runtime.

AST thấy bốn node đều tên `"x"`. `go/types` biết đó là hai đối tượng khác nhau và phân giải chính xác từng chỗ dùng. **Đây chính là semantic model làm việc.**

## 3. Cái insight quan trọng: side-map, không phải AST tô màu

Đây là điểm hay bị blog nói sai nhất, nên tui sẽ nói thẳng.

`go/types` **không chỉnh sửa AST**. Nó để kết quả vô `types.Info` — một cấu trúc dữ liệu **riêng**, tách hẳn cây. [(pkg.go.dev/go/types)](https://pkg.go.dev/go/types)

```go
info := &types.Info{
    Defs:  map[*ast.Ident]types.Object{},       // khai báo
    Uses:  map[*ast.Ident]types.Object{},       // chỗ dùng
    Types: map[ast.Expr]types.TypeAndValue{},   // kiểu + giá trị hằng
}
```

Ba trường chính:

| Trường  | Khoá         | Giá trị              | Ý nghĩa                                                                   |
| ------- | ------------ | -------------------- | ------------------------------------------------------------------------- |
| `Defs`  | `*ast.Ident` | `types.Object`       | Nơi **định nghĩa** — nút khai báo; bất biến: `Defs[id].Pos() == id.Pos()` |
| `Uses`  | `*ast.Ident` | `types.Object`       | Nơi **dùng** — nút tham chiếu; `Uses[id].Pos() != id.Pos()`               |
| `Types` | `ast.Expr`   | `types.TypeAndValue` | Kiểu + giá trị hằng của biểu thức                                         |

> [!WARNING]
> **`types.Info.Types` KHÔNG chứa kiểu của mọi identifier.** Selector `x.f` đi vô `Selections`. Khai báo `var z int` đi vô `Defs`. Package `p` trong `p.X` đi vô `Uses`. Nhiều bài blog nói "bạn tra `Types[ident]` là ra kiểu" — không đúng với mọi trường hợp. [(Alan Donovan, go-types guide)](https://github.com/golang/example/blob/master/gotypes/go-types.md)

Lý do thiết kế như vậy? `go/types` phải làm ba việc cùng lúc vì chúng phụ thuộc lẫn nhau: phân giải tên (name resolution), suy kiểu (type deduction), và tính hằng (constant folding). Giá trị của `unsafe.Sizeof(x)` phụ thuộc kiểu; kiểu mảng `[N]T` phụ thuộc hằng `N`; key của composite literal `T{k:0}` phụ thuộc việc biết `T`. Không làm riêng lẻ được. [(pkg.go.dev/go/types — verbatim)](https://pkg.go.dev/go/types)

![Sơ đồ: bốn node x trong AST được go/types phân giải thành hai biến qua side-map types.Info](/memo/diagrams/semantic/03-ast-vs-model.svg)

_Bốn node `x` trông y hệt trong AST được phân giải thành 2 biến khác nhau qua map riêng `types.Info` — không phải "tô màu" lên cây._

## 4. Roslyn nói gì: ba tầng tách biệt

Roslyn (C#) đặt tên rõ hơn cho ba tầng này. Tui sẽ dùng đây là minh hoạ đối chiếu — máy tui không có .NET nên mấy đoạn C# bên dưới là **minh hoạ, đối chiếu Microsoft Learn**, không phải output chạy thật.

**Tầng 1: `SyntaxTree`** — cấu trúc cú pháp thuần tuý, **bất biến**. Nó không biết symbol, không biết kiểu. Giống hệt `go/ast.File` bên Go.

**Tầng 2: `Compilation`** — theo tài liệu Roslyn (verbatim): _"a representation of everything needed to compile … all the assembly references, compiler options, and source files."_ [(Microsoft Learn)](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/compiler-api-model) Tức là `Compilation` là ngữ cảnh đầy đủ của cả build.

**Tầng 3: `SemanticModel`** — tầng hỏi-nghĩa, **lấy từ `Compilation`**, không phải từ `SyntaxTree`:

```csharp
// minh hoạ, đối chiếu Microsoft Learn
SemanticModel model = compilation.GetSemanticModel(syntaxTree);
```

> [!NOTE]
> `SemanticModel` lấy bằng `Compilation.GetSemanticModel(syntaxTree)` — không phải từ `syntaxTree` trực tiếp. API đầy đủ: `public SemanticModel GetSemanticModel(SyntaxTree syntaxTree, bool ignoreAccessibility = false)`. [(docs)](https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.semanticmodel)

Ba API chính của `SemanticModel`:

```csharp
// minh hoạ, đối chiếu Microsoft Learn

// 1. Hỏi: node này là symbol gì?
SymbolInfo si = model.GetSymbolInfo(node);
ISymbol sym = si.Symbol; // ví dụ ILocalSymbol, IMethodSymbol, ...

// 2. Hỏi: expression này có kiểu gì?
TypeInfo ti = model.GetTypeInfo(expr);
// ti là TypeInfo struct — KHÔNG phải INamedTypeSymbol trực tiếp
ITypeSymbol type = ti.Type;
ITypeSymbol convertedType = ti.ConvertedType;

// 3. Hỏi: node khai báo này khai báo symbol gì?
ISymbol declared = model.GetDeclaredSymbol(declNode);
// GetDeclaredSymbol — tên API public đúng
```

Tương tự với Go: `GetSymbolInfo` ↔ `info.Uses[ident]`, `GetDeclaredSymbol` ↔ `info.Defs[ident]`, `GetTypeInfo` ↔ `info.Types[expr]`.

> [!WARNING]
> Hai lỗi hay gặp trong blog viết về Roslyn:
>
> - **`GetTypeInfo` trả `TypeInfo` struct**, không phải `INamedTypeSymbol` trực tiếp. Bạn phải `.Type` để lấy `ITypeSymbol`.
> - Tên API public là **`GetDeclaredSymbol`** — không phải `GetDeclaredSymbolForNode` (tên đó là internal). [(Microsoft Learn)](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/work-with-semantics)

Roslyn cũng đặt tên chính xác cho "binding" — việc `SemanticModel` làm: _"The process of associating names and expressions with Symbols."_ Đó là lý do tại sao cái tầng này tên là binding (ràng buộc tên → ký hiệu), và `SemanticModel` là cái máy chạy binding đó.

## 5. So sánh nhanh Go vs C#

|                         | Go (`go/types`)                | C# (Roslyn)                        |
| ----------------------- | ------------------------------ | ---------------------------------- |
| Tầng cú pháp            | `*ast.File`                    | `SyntaxTree`                       |
| Ngữ cảnh build          | `types.Config` + `Importer`    | `Compilation`                      |
| Side-map kết quả        | `types.Info` (Defs/Uses/Types) | `SemanticModel`                    |
| Lấy symbol tại khai báo | `info.Defs[ident]`             | `model.GetDeclaredSymbol(node)`    |
| Lấy symbol tại chỗ dùng | `info.Uses[ident]`             | `model.GetSymbolInfo(node).Symbol` |
| Lấy kiểu của expression | `info.Types[expr].Type`        | `model.GetTypeInfo(expr).Type`     |
| AST có bị sửa không?    | Không — side-map tách biệt     | Không — `SyntaxTree` bất biến      |

Điểm chung quan trọng nhất: **cả hai đều giữ cây cú pháp nguyên vẹn**, không gắn thêm metadata vô nó. Kết quả semantic sống trong cấu trúc riêng.

## 6. Tại sao điều này quan trọng với bài tiếp theo

Bạn sẽ hỏi: "Ok, biết `go/types` lưu kết quả vô side-map, thì sao?"

Sao thì thế này: khi bạn viết một **analyzer** (bộ phân tích — công cụ kiểm tra code), bạn có thể lựa chọn:

- Chỉ cần **cú pháp** (hình dạng code) → xài AST, không cần `go/types`.
- Cần **ngữ nghĩa** (kiểu, symbol, binding) → xài `types.Info`, đặt câu hỏi cho semantic layer.

Một rule "không import package X" chỉ cần AST — nhìn import path là đủ. Nhưng một rule "không gọi hàm này từ tầng này" cần semantic layer — vì bạn phải biết cái `.Read()` đang được gọi là method của object nào, không phải chỉ nhìn tên.

Phần 4 sẽ viết thật một linter nhỏ, đi qua từng loại câu hỏi đó. Biết ranh giới cú pháp / ngữ nghĩa thì mới biết chọn đúng tool.

→ [Phần 4: Lấy AST viết hard-rule — cái lint chặn code sai](/memo/posts/ast-viet-hard-rule-lint/)

---

**Nguồn chính:**

- [pkg.go.dev/go/types](https://pkg.go.dev/go/types) — spec chính thức `go/types`, mô tả Defs/Uses/Types và mutual deps
- [Alan Donovan — go-types guide](https://github.com/golang/example/blob/master/gotypes/go-types.md) — giải thích tại sao ba việc phải làm cùng nhau
- [Microsoft Learn — Work with semantics](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/work-with-semantics) — SemanticModel API, binding definition
- [Microsoft Learn — Compiler API model](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/compiler-api-model) — mô tả ba tầng Roslyn, verbatim quotes
- [Microsoft Learn — SemanticModel API ref](https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.semanticmodel) — GetSemanticModel signature

← [Phần 2: "Semantic search" là gì](/memo/posts/semantic-search-la-gi/) | [Mục lục series](/memo/posts/chu-semantic-mot-chu-nhieu-nghia/) | [Phần 4: Lấy AST viết hard-rule →](/memo/posts/ast-viet-hard-rule-lint/)
