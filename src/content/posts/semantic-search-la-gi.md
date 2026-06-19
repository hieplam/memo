---
title: '"Tool này không có semantic search" — chữ semantic kiểu embeddings'
description: 'Khi ai đó nói "tool này không có semantic search", họ đang nói về embeddings và cosine similarity — hoàn toàn khác chữ semantic của compiler. Bài này tách hai thế giới đó ra, chạy demo Go minh hoạ cơ chế cosine, và giải thích tại sao hai chữ "semantic" này chỉ chung gốc Hy Lạp chứ không chung máy móc gì hết.'
pubDatetime: 2026-06-19T04:00:00Z
tags:
  [
    "semantic",
    "embeddings",
    "semantic-search",
    "information-retrieval",
    "vietnamese",
    "semantic-series",
  ]
lang: "vi"
---

> **Series "Giải mã chữ semantic"** — [xem mục lục đầy đủ](/memo/posts/chu-semantic-mot-chu-nhieu-nghia/)
> Phần trước: [Phần 1 — Cú pháp vs Ngữ nghĩa: AST thật ra là gì](/memo/posts/cu-phap-vs-ngu-nghia-ast-la-gi/)
> Phần sau: [Phần 3 — "Roslyn có semantic model": tầng nghĩa trên AST](/memo/posts/semantic-model-roslyn-go-types/)

## Tóm tắt nhanh

- **Lexical search (tìm kiếm từ khoá)**: so trùng ký tự — như `grep`, BM25. Câu truy vấn phải dùng đúng chữ thì mới ra kết quả.
- **Semantic search (tìm kiếm ngữ nghĩa)**: biến câu thành **vector embedding** rồi đo khoảng cách bằng **cosine similarity** — bắt được câu cùng nghĩa dù dùng chữ khác hẳn.
- Demo Go chạy thật: hai câu "cùng nghĩa, khác chữ" cho cosine ≈ 0.9988; câu "khác nghĩa" cho cosine ≈ 0.19.
- Embedding _thật_ do mô hình học ra (ví dụ [Sentence-BERT](https://arxiv.org/pdf/1908.10084)); demo chỉ minh hoạ cơ chế toán học.
- Chữ "semantic" ở đây — embeddings/vector — **không liên quan gì** tới "semantic model" của compiler (Phần 3). Hai ngành, hai máy, một nhãn chữ.

---

Hồi tui mới bắt đầu xây tính năng tìm kiếm cho một sản phẩm nội bộ, có một cậu junior chạy vô hỏi: _"anh ơi tool search của mình dùng cái gì, em thấy nó không có semantic search?"_ Tui hỏi lại: _"semantic search là sao?"_ Cậu ta trả lời: _"thì... như AI ấy, thông minh hơn grep."_

Câu trả lời đó không sai, nhưng cũng chẳng giải thích được gì. Bài này là để bạn có câu trả lời rõ ràng hơn — và hiểu tại sao nó lại dùng chữ "semantic" giống hệt chỗ compiler dùng mà lại là hai thứ hoàn toàn khác nhau.

## 1. Trước tiên: lexical search là gì và tại sao nó không đủ

**Lexical search (tìm kiếm từ khoá — theo nghĩa đen của chữ)** là cách tìm kiếm mà bạn đang dùng mỗi ngày mà không để ý: `grep`, `CTRL+F` trong trình duyệt, full-text search kiểu BM25 trong Elasticsearch, SQLite `LIKE`.

Nguyên lý đơn giản: so **chữ với chữ**. Bạn tìm "hướng dẫn sử dụng", hệ thống quét kho tài liệu xem tài liệu nào có cụm đó, hoặc các từ đó. Nếu tài liệu viết "cách dùng" hay "hướng dẫn vận hành" thay vì đúng "hướng dẫn sử dụng", nó **rớt** — không ra — dù nghĩa giống nhau.

Đây không phải lỗi kỹ thuật. Đây là **giới hạn thiết kế**: lexical search không "hiểu" nghĩa, nó đo _sự trùng khớp ký hiệu_. Hoàn toàn phù hợp cho nhiều bài toán (tìm log, trace ID, mã lỗi). Chỉ không phù hợp khi bạn cần _"tìm những thứ có cùng ý nghĩa"_.

## 2. Semantic search: biến câu thành vector, đo khoảng cách

**Semantic search (tìm kiếm ngữ nghĩa)** giải quyết bài toán đó theo hướng hoàn toàn khác.

Ý tưởng cốt lõi: nếu mình biến mỗi câu thành một **vector (véc-tơ)** số thực nhiều chiều — gọi là **vector embedding (véc-tơ nhúng)** — sao cho các câu có nghĩa gần nhau thì vector của chúng cũng nằm gần nhau trong không gian đó, thì bài toán "tìm câu cùng nghĩa" trở thành bài toán hình học: _"tìm các vector nằm gần vector truy vấn"_.

Khoảng cách thường dùng nhất là **cosine similarity (độ tương đồng cosine)**: thay vì đo khoảng cách Euclid (gần xa về độ lớn), ta đo **góc** giữa hai vector. Hai vector cùng hướng (góc 0°) → cosine = 1.0; vuông góc (góc 90°) → cosine = 0; ngược hướng → cosine = −1.

![Sơ đồ: lexical search so từ khoá, semantic search so nghĩa bằng vector embeddings](/memo/diagrams/semantic/02-lexical-vs-semantic-search.svg)

_Cùng một truy vấn, lexical bỏ sót câu s1 (cùng nghĩa, khác chữ); semantic đo góc vector và BẮT được nó._

Công thức:

```
cosine(A, B) = (A · B) / (‖A‖ × ‖B‖)
```

Trong đó `A · B` là tích vô hướng (dot product), `‖A‖` là độ dài vector (L2 norm).

## 3. Demo Go: cosine similarity với vector đồ chơi

Tui viết một chương trình Go nhỏ minh hoạ đúng cơ chế này. Trước khi chạy, có vài điều cần nói thẳng:

> [!NOTE]
> **Embedding thật** là output của mô hình ngôn ngữ — ví dụ [Sentence-BERT](https://arxiv.org/pdf/1908.10084) — với nhiều chiều, học từ dữ liệu lớn. Không ai ngồi gõ tay từng con số. Demo dưới đây dùng **vector 3 chiều hard-code** chỉ để thấy _cơ chế toán học hoạt động thế nào_ — không giả vờ là embedding thật.

File: [`04-cosine/main.go`](https://github.com/hieplam/semantic-series-go-proof/blob/main/04-cosine/main.go)

```go
// 04-cosine: minh hoạ cơ chế cosine similarity — embedding ĐỒ CHƠI.
// Vài vector 3 chiều được hard-code tay, KHÔNG phải output của mô hình thật.
// Mục đích: thấy được tại sao hai câu "cùng nghĩa, khác chữ" cho cosine cao,
// còn câu "khác nghĩa" cho cosine thấp.
// Embedding thật do mô hình học từ dữ liệu (ví dụ Sentence-BERT); đây chỉ là
// cơ chế toán học bên dưới.
package main

import (
	"fmt"
	"math"
)

// Sentence gói câu và vector embedding đồ chơi của nó.
type Sentence struct {
	Text   string
	Vector []float64
}

// dot tính tích vô hướng (dot product) của hai vector cùng chiều.
func dot(a, b []float64) float64 {
	var sum float64
	for i := range a {
		sum += a[i] * b[i]
	}
	return sum
}

// norm tính độ dài (L2 norm) của vector.
func norm(v []float64) float64 {
	return math.Sqrt(dot(v, v))
}

// cosine tính cosine similarity ∈ [-1, 1].
// Hai vector cùng hướng → 1.0; vuông góc → 0.0; ngược hướng → -1.0.
func cosine(a, b []float64) float64 {
	denom := norm(a) * norm(b)
	if denom == 0 {
		return 0
	}
	return dot(a, b) / denom
}

func main() {
	// Ba "câu" với vector đồ chơi 3 chiều.
	// Chiều 0: ngữ nghĩa "truy vấn/tìm kiếm"
	// Chiều 1: ngữ nghĩa "văn bản/tài liệu"
	// Chiều 2: ngữ nghĩa "thời tiết/khí hậu"
	//
	// q  và s1 gần nhau (cùng vùng tìm kiếm tài liệu) → cosine cao
	// q  và s2 xa nhau (thời tiết, khác vùng)          → cosine thấp
	sentences := []Sentence{
		{
			Text:   "q : tìm tài liệu hướng dẫn sử dụng",
			Vector: []float64{0.9, 0.8, 0.1},
		},
		{
			Text:   "s1: cách tra cứu tài liệu kỹ thuật (cùng nghĩa, khác chữ)",
			Vector: []float64{0.85, 0.75, 0.15},
		},
		{
			Text:   "s2: thời tiết hôm nay trời nắng (khác nghĩa hoàn toàn)",
			Vector: []float64{0.05, 0.1, 0.95},
		},
	}

	q := sentences[0]
	fmt.Printf("Truy vấn: %s\n", q.Text)
	fmt.Println("─────────────────────────────────────────────────────")
	for _, s := range sentences[1:] {
		sim := cosine(q.Vector, s.Vector)
		fmt.Printf("  %-55s cosine = %.4f\n", s.Text, sim)
	}

	fmt.Println()
	fmt.Println("Nhận xét:")
	fmt.Println("  s1 (cùng nghĩa, khác chữ) → cosine gần 1.0: semantic search BẮT ĐƯỢC")
	fmt.Println("  s2 (khác nghĩa)            → cosine thấp   : semantic search BỎ QUA đúng")
	fmt.Println()
	fmt.Println("⚠  Đây là vector hard-code tay để minh hoạ cơ chế,")
	fmt.Println("   không phải output của mô hình (Sentence-BERT, v.v.).")
	fmt.Println("   Embedding thật do mô hình HỌC ra từ dữ liệu — không ai ngồi gõ tay.")
}
```

Chạy:

```bash
go run ./04-cosine/main.go
```

Output thật (verbatim từ máy tui):

```text
Truy vấn: q : tìm tài liệu hướng dẫn sử dụng
─────────────────────────────────────────────────────
  s1: cách tra cứu tài liệu kỹ thuật (cùng nghĩa, khác chữ) cosine = 0.9988
  s2: thời tiết hôm nay trời nắng (khác nghĩa hoàn toàn)  cosine = 0.1903

Nhận xét:
  s1 (cùng nghĩa, khác chữ) → cosine gần 1.0: semantic search BẮT ĐƯỢC
  s2 (khác nghĩa)            → cosine thấp   : semantic search BỎ QUA đúng

⚠  Đây là vector hard-code tay để minh hoạ cơ chế,
   không phải output của mô hình (Sentence-BERT, v.v.).
   Embedding thật do mô hình HỌC ra từ dữ liệu — không ai ngồi gõ tay.
```

Số nói lên tất cả: s1 ("cách tra cứu tài liệu kỹ thuật") có cosine = **0.9988** với truy vấn "tìm tài liệu hướng dẫn sử dụng" — hai câu dùng chữ khác nhau nhưng nằm trong cùng vùng ngữ nghĩa. s2 ("thời tiết hôm nay trời nắng") chỉ có cosine = **0.1903** — nó ở vùng khác hoàn toàn.

Lexical search bỏ sót s1 (không trùng chữ nào). Semantic search bắt được s1 và loại s2 — đúng như bạn muốn.

## 4. Embedding thật đến từ đâu?

Trong demo tui đặt tay vector cho đẹp. Ngoài đời, không ai làm vậy — không ai ngồi nghĩ "cái câu này thì chiều 0 = 0.85, chiều 1 = 0.75...". Thực tế, không gian có nhiều chiều hơn nhiều, và **mỗi chiều không có nghĩa cụ thể** như tui đặt trong demo.

Vector đến từ **mô hình embedding** — một mạng nơ-ron được huấn luyện để map câu/đoạn văn vô không gian vector sao cho câu cùng nghĩa thì gần nhau. Ví dụ được nghiên cứu kỹ là [Sentence-BERT (SBERT)](https://arxiv.org/pdf/1908.10084) — một mô hình được huấn luyện để tạo ra vector câu (sentence embedding) sao cho câu cùng nghĩa thì cosine similarity cao.

> [!NOTE]
> Tui sẽ không kể số benchmark ở đây — các con số thay đổi theo dataset, task, và phiên bản mô hình. Điều tui muốn bạn nhớ là **cơ chế**: embedding + cosine. Còn chọn mô hình nào thì phụ thuộc bài toán cụ thể của bạn.

Trong hệ thống thực, luồng thường như sau:

1. Lúc đánh index: chạy từng tài liệu qua mô hình embedding → lưu vector vô **vector database (cơ sở dữ liệu vector)** hoặc một cấu trúc dữ liệu hỗ trợ tìm kiếm láng giềng gần (approximate nearest neighbor — ANN).
2. Lúc truy vấn: câu tìm kiếm cũng chạy qua cùng mô hình embedding → lấy vector → tìm các vector trong index có cosine cao nhất → trả về tài liệu tương ứng.

Đơn giản về ý tưởng, nhưng đằng sau là một mô hình ngôn ngữ đã học từ dữ liệu lớn. Đó là phần "thông minh" thật sự — không phải cosine (cosine chỉ là phép đo góc, học sinh cấp 3 cũng biết).

## 5. Vậy thì chữ "semantic" ở đây có nghĩa là gì?

Nhìn lại từ đầu: tại sao người ta gọi nó là "semantic search"?

Vì nó tìm theo **nghĩa** (semantics — ngữ nghĩa) của câu, không phải theo hình thức chữ viết. "Hướng dẫn sử dụng" và "cách tra cứu kỹ thuật" có **nghĩa gần nhau** dù không trùng chữ nào. Hệ thống embedding nắm được điều đó — nên nó được gọi là "semantic".

Chữ "semantic" ở đây mang nghĩa **nguyên gốc Hy Lạp** của nó: _semantikos_ — "thuộc về ý nghĩa". Đó là điểm chung duy nhất với "semantic model" trong compiler.

Còn lại: **khác hoàn toàn.**

|                              | Semantic Search (IR/ML)    | Semantic Model (Compiler)       |
| ---------------------------- | -------------------------- | ------------------------------- |
| **Đầu vào**                  | Câu văn bản                | Source code                     |
| **Cấu trúc dữ liệu cốt lõi** | Vector embedding (số thực) | Symbol table, type graph        |
| **Phép đo**                  | Cosine similarity          | Name resolution, type checking  |
| **Bài toán giải**            | "Câu nào cùng nghĩa?"      | "Tên này trỏ tới đâu, kiểu gì?" |
| **Dùng bởi**                 | IR engineer, ML engineer   | Compiler, IDE, linter           |
| **Liên quan tới AST không?** | Không                      | Có — là tầng xây trên AST       |

Như tui nói ở [mục lục series](/memo/posts/chu-semantic-mot-chu-nhieu-nghia/): hai cái này như "con chuột" trên bàn và "con chuột" trong hang — cùng nhãn chữ, khác loài hoàn toàn.

## 6. Cú punchline: tại sao quan trọng mà biết điều này?

Vì khi có người nói "tool này cần có semantic search", bạn ngay lập tức biết họ đang nói tới **embeddings, vector database, mô hình ngôn ngữ** — không phải tới AST hay type system.

Và ngược lại: khi Phần 3 nói về "semantic model của Roslyn" hay `go/types` trong Go, bạn biết ngay đó là chuyện **compiler biết tên biến trỏ tới đâu, kiểu trả về của hàm là gì** — không phải chuyện vector hay cosine.

Hai chữ. Hai máy. Một gốc Hy Lạp. Đừng để gốc chữ đó đánh lừa bạn.

> [!WARNING]
> Một bẫy phổ biến: nghe "semantic layer" hay "semantic understanding" trong một context AI/LLM nào đó, rồi nghĩ _à chắc là dùng embeddings_. Chưa chắc. Phải hỏi: "bạn đang nói về vector search, hay về tầng phân tích kiểu/tên của compiler?" Câu hỏi đó phân biệt ngay.

---

Phần tiếp theo sẽ mổ xẻ chữ "semantic" theo nghĩa compiler — cụ thể là Roslyn của C# và `go/types` của Go. Đó là tầng **semantic model** thật sự: từ một cái tên trong code, hỏi được _"nó trỏ tới Object nào, kiểu gì, có phải constant không"_ — và tại sao tầng đó là một cấu trúc **riêng biệt**, không phải AST được tô màu.

→ [Phần 3: "Roslyn có semantic model" — tầng ngữ nghĩa trên AST (Go + C#)](/memo/posts/semantic-model-roslyn-go-types/)

← [Phần 1: Cú pháp vs Ngữ nghĩa — AST thật ra là gì (và không là gì)](/memo/posts/cu-phap-vs-ngu-nghia-ast-la-gi/)

[Xem mục lục series →](/memo/posts/chu-semantic-mot-chu-nhieu-nghia/)

---

**Nguồn chính:**

- Sentence-BERT (SBERT): [arxiv.org/pdf/1908.10084](https://arxiv.org/pdf/1908.10084)
- Semantic Textual Similarity — SBERT docs: [sbert.net/docs/…/semantic_textual_similarity.html](https://www.sbert.net/docs/sentence_transformer/usage/semantic_textual_similarity.html)
- Demo Go: `04-cosine/main.go` (chạy thật, output verbatim)
