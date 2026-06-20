---
title: "grep, BM25, semantic — ba tầng tìm kiếm, không phải hai"
description: 'Phần 2 của series gộp grep và BM25 chung một rổ "lexical". Đúng, nhưng chúng không giống nhau: grep là cái lọc, BM25 là cái xếp hạng, còn semantic mới là cái hiểu nghĩa. Tui mổ một con tool thật cố tình chọn BM25 và bỏ vector, kèm demo Go chấm điểm BM25 chạy thật, output verbatim.'
pubDatetime: 2026-06-19T08:00:00Z
tags:
  [
    "semantic",
    "bm25",
    "lexical-search",
    "information-retrieval",
    "grep",
    "vietnamese",
    "semantic-series",
  ]
lang: "vi"
---

> **Ghi chú đào sâu — series "Giải mã chữ semantic".**
> Bài này nới rộng [Phần 2 — "Tool này không có semantic search"](/memo/posts/semantic-search-la-gi/), chỗ tui gộp `grep` và `BM25` chung một rổ "lexical". Gộp vậy đúng về phe, nhưng giấu mất một chuyện: trong cái rổ đó, `grep` và `BM25` **không cùng loại việc**.
> Đọc từ đầu: [mục lục series](/memo/posts/chu-semantic-mot-chu-nhieu-nghia/)

## Tóm tắt nhanh

- **grep = cái lọc (filter).** Hỏi "doc này CÓ chứa từ không?" → trả lời có/không. Mọi doc khớp đều ngang nhau, in ra theo thứ tự kho. Không có khái niệm "liên quan hơn".
- **BM25 = cái xếp hạng (ranker).** Hỏi "doc nào LIÊN QUAN NHẤT?" → chấm điểm rồi sắp xếp. Điểm dựa trên ba thứ grep không có: **TF** (từ xuất hiện nhiều lần), **IDF** (từ càng hiếm càng đắt), **chuẩn hoá độ dài** (doc dài bị phạt).
- **semantic = cái hiểu nghĩa.** Biến câu thành **vector embedding** rồi đo nghĩa — bắt được câu cùng nghĩa khác chữ. Đây là tầng [Phần 2](/memo/posts/semantic-search-la-gi/) đã mổ.
- Một dòng nhớ: **grep = có/không theo ký tự · BM25 = xếp hạng theo TỪ · semantic = xếp hạng theo NGHĨA.**
- Demo Go chạy thật: cùng truy vấn, grep ra 3 hit ngang nhau, BM25 xếp `auth-token (0.90) > middleware (0.63) > login-flow (0.43)`.

---

## 1. Câu hỏi khơi ra bài này: "con tool này có semantic search không?"

Tui đang đọc code một con tool tên **ymir** — đại khái nó là **bộ sinh harness (khung ràng buộc) cho Claude Code**: tự dựng rules, lint, CI, và một cái wiki để chứa tri thức dự án. Trong wiki đó có lệnh `wiki query "..."` để tra cứu.

Câu hỏi bật ra rất tự nhiên, đúng cái câu mở màn [Phần 2](/memo/posts/semantic-search-la-gi/): _con này tìm bằng gì — có semantic search không?_

Tui lần theo code. Lệnh `query` không tự tìm, nó gọi ra một công cụ ngoài tên `qmd`:

```ts
// commands/query.ts
return run("qmd", ["search", i.q, "--json", "--files"]);
```

Và lúc đánh index, nó chỉ làm đúng một việc (lệnh `reindex.ts` gọi ra):

```bash
qmd collection add <root> --name <project>-wiki
```

**Không có bước `qmd embed`.** Và cái thiếu đó là cố ý — file `SCHEMA.md` của nó ghi thẳng:

> Search is keyword-only (BM25) — lightweight, no embeddings and no local LLM, so there is no `qmd embed` step.

Vậy là rõ: ymir **không** có semantic search. Nó dùng **BM25**. Tới đây thì theo cách phân loại của Phần 2, mình xếp gọn: "à, lexical, cùng phe với grep." Nhưng rồi tui khựng lại một nhịp.

Nếu nó "cùng phe với grep", thì sao người ta không xài thẳng `grep` cho rồi? Sao phải lôi nguyên một cái máy tên BM25 vô?

Câu trả lời là: **grep và BM25 không làm cùng một việc.** Và đó là cả bài này.

## 2. grep: cái lọc — có/không, không thứ hạng

`grep` (và họ hàng: `CTRL+F`, `LIKE` trong SQL, regex) làm một việc duy nhất: **so mẫu**. Bạn đưa một mẫu chữ, nó quét từng dòng, dòng nào khớp thì in ra.

Để ý cái bản chất: kết quả là **nhị phân (binary — có hoặc không)**. Một dòng hoặc khớp, hoặc không. Không có "khớp 70%", không có "dòng này liên quan hơn dòng kia". `grep` in ra theo **thứ tự file**, không phải theo độ liên quan — vì nó **không có** khái niệm độ liên quan để mà sắp.

Hình dung `grep` như cái rây bột: hạt nào lọt lỗ thì xuống, không lọt thì ở lại. Cái rây không xếp hạng các hạt đã lọt. Nó chỉ chia hai phe.

Điều đó làm `grep` **mạnh** ở chỗ nó giỏi: tìm chính xác một chuỗi, một mã lỗi, một biến trong code, một regex phức tạp (`\d{3}-\d{4}`). Khi bạn biết chính xác mình tìm cái gì, cái rây là đủ.

Nhưng khi bạn hỏi _"tài liệu nào nói về token nhiều nhất?"_ — `grep` chịu. Nó trả về mọi doc có chữ "token", quăng cho bạn một đống bằng nhau, tự đi mà đọc.

## 3. BM25: cái xếp hạng — vẫn theo chữ, nhưng biết "đắt rẻ"

**BM25 (Best Matching 25)** là một hàm chấm điểm trong **truy hồi thông tin (information retrieval)** — cái chạy bên dưới Elasticsearch, Lucene, và đúng rồi, cả `qmd` của ymir. Nó vẫn là **lexical** (so theo chữ, không hiểu nghĩa) — y như `grep`. Nhưng việc nó làm khác hẳn: thay vì chia hai phe, nó **gán cho mỗi doc một con điểm** rồi xếp hạng.

Điểm đó dựa trên ba thứ mà `grep` hoàn toàn không có:

1. **TF — term frequency (tần suất từ).** Từ khoá xuất hiện càng nhiều lần trong một doc → doc đó càng được điểm. Nhưng tăng có **bão hoà**: từ lần thứ 10 sang lần thứ 11 gần như không thêm gì. (Tham số `k1` chỉnh độ bão hoà này.)
2. **IDF — inverse document frequency (nghịch tần suất tài liệu).** Từ càng **hiếm** trong toàn kho → càng **đắt giá**. "của", "là", "the" gặp ở mọi doc → gần như vô giá trị. "authentication" chỉ ở vài doc → khớp được nó là tín hiệu mạnh. `grep` coi mọi từ ngang nhau; BM25 thì không.
3. **Chuẩn hoá độ dài (length normalization).** Doc dài tự nhiên chứa nhiều từ hơn, dễ "ăn may" trùng. BM25 phạt độ dài để doc dài không thắng oan. (Tham số `b` chỉnh mức phạt.)

Công thức đầy đủ, để đó cho ai tò mò — phần ruột là ba ý trên:

```
                    f(qᵢ, D) · (k₁ + 1)
score(D,Q) = Σ IDF(qᵢ) · ─────────────────────────────────
              qᵢ          f(qᵢ, D) + k₁ · (1 − b + b · |D|/avgdl)
```

Trong đó `f(qᵢ, D)` là TF, `|D|` là độ dài doc, `avgdl` là độ dài trung bình của kho. Mặc định kinh điển: `k₁ = 1.5`, `b = 0.75`.

Nói gọn: **BM25 là grep có não.** Vẫn mù trước nghĩa, nhưng biết từ nào quan trọng và doc nào đáng lên đầu.

## 4. Demo Go: cùng truy vấn, grep ra 3 hit ngang nhau, BM25 xếp hạng

Nói thì dễ. Để thấy tận mắt, tui viết một cái BM25 nhỏ bằng Go, chạy trên năm "trang wiki" giả. Cùng một truy vấn `"token"`, in cả kết quả kiểu-grep lẫn xếp hạng BM25 để đặt cạnh nhau.

File: `05-bm25/main.go` (chạy thật, output ở dưới copy thẳng từ terminal).

```go
// 05-bm25: vì sao BM25 KHÁC grep — grep lọc, BM25 xếp hạng.
// Cùng một truy vấn, grep trả về các doc CÓ chứa từ (nhị phân, không thứ hạng).
// BM25 chấm điểm từng doc theo TF (tần suất từ), IDF (độ hiếm của từ) và
// chuẩn hoá độ dài doc — rồi xếp hạng. Đây là cơ chế thật của lexical ranking
// (Elasticsearch/Lucene, qmd... đều dùng họ BM25).
package main

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"unicode"
)

type Doc struct {
	ID     string
	Text   string
	tokens []string
}

// tokenize: tách theo ký tự chữ (unicode), hạ thường. Đủ cho demo tiếng Việt.
func tokenize(s string) []string {
	return strings.FieldsFunc(strings.ToLower(s), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})
}

// tf đếm số lần từ term xuất hiện trong doc.
func tf(term string, d Doc) int {
	n := 0
	for _, t := range d.tokens {
		if t == term {
			n++
		}
	}
	return n
}

// df đếm số doc CÓ chứa term (document frequency).
func df(term string, docs []Doc) int {
	n := 0
	for _, d := range docs {
		if tf(term, d) > 0 {
			n++
		}
	}
	return n
}

// idf: từ càng hiếm (df nhỏ) → giá trị càng cao. Công thức BM25 chuẩn.
func idf(term string, docs []Doc) float64 {
	N := float64(len(docs))
	n := float64(df(term, docs))
	return math.Log(1 + (N-n+0.5)/(n+0.5))
}

// bm25 chấm điểm 1 doc cho 1 truy vấn nhiều từ.
// k1: bão hoà tần suất; b: mức chuẩn hoá độ dài.
func bm25(query []string, d Doc, docs []Doc, avgdl float64) float64 {
	const k1, b = 1.5, 0.75
	dl := float64(len(d.tokens))
	var score float64
	for _, q := range query {
		f := float64(tf(q, d))
		if f == 0 {
			continue
		}
		num := f * (k1 + 1)
		den := f + k1*(1-b+b*dl/avgdl)
		score += idf(q, docs) * num / den
	}
	return score
}

func main() {
	docs := []Doc{
		{ID: "auth-token", Text: "xác thực dùng token. token hết hạn thì refresh token"},
		{ID: "login-flow", Text: "luồng đăng nhập kiểm tra mật khẩu rồi cấp token phiên cho người dùng tiếp tục"},
		{ID: "middleware", Text: "middleware đọc header rồi giải mã token"},
		{ID: "ci-pipeline", Text: "ci chạy linter và build trên mỗi lần push"},
		{ID: "wiki-index", Text: "wiki dựng index tự động sau mỗi lần ghi"},
	}
	var total float64
	for i := range docs {
		docs[i].tokens = tokenize(docs[i].Text)
		total += float64(len(docs[i].tokens))
	}
	avgdl := total / float64(len(docs))

	fmt.Printf("Kho %d doc, độ dài trung bình avgdl = %.1f token\n", len(docs), avgdl)
	fmt.Println("─────────────────────────────────────────────────────────────")
	for _, d := range docs {
		fmt.Printf("  %-11s len=%2d  tf(token)=%d  | %s\n", d.ID, len(d.tokens), tf("token", d), d.Text)
	}

	query := []string{"token"}
	fmt.Printf("\nTruy vấn: %q\n", strings.Join(query, " "))
	fmt.Println("─────────────────────────────────────────────────────────────")

	// grep: nhị phân — doc nào CÓ chứa từ, theo đúng thứ tự kho. Không thứ hạng.
	fmt.Println("grep (lọc — match/không, thứ tự kho, mọi hit ngang nhau):")
	for _, d := range docs {
		if tf("token", d) > 0 {
			fmt.Printf("  ✓ %s\n", d.ID)
		}
	}

	// BM25: chấm điểm rồi xếp hạng.
	type scored struct {
		id    string
		score float64
	}
	ranked := []scored{}
	for _, d := range docs {
		s := bm25(query, d, docs, avgdl)
		if s > 0 {
			ranked = append(ranked, scored{d.ID, s})
		}
	}
	sort.Slice(ranked, func(i, j int) bool { return ranked[i].score > ranked[j].score })
	fmt.Println("\nBM25 (xếp hạng theo điểm — cao nhất lên đầu):")
	for i, r := range ranked {
		fmt.Printf("  %d. %-11s score = %.4f\n", i+1, r.id, r.score)
	}

	fmt.Println("\nIDF — vì sao từ hiếm 'đắt' hơn từ phổ biến:")
	for _, term := range []string{"token", "wiki", "build"} {
		fmt.Printf("  idf %-6s = %.4f   (df = %d/%d doc)\n", term, idf(term, docs), df(term, docs), len(docs))
	}

	fmt.Println("\nNhận xét:")
	fmt.Println("  grep: 3 hit, không phân biệt cái nào liên quan hơn.")
	fmt.Println("  BM25: auth-token lên đầu (token xuất hiện 3 lần + doc ngắn);")
	fmt.Println("        login-flow xuống chót (1 lần + doc dài → bị chuẩn hoá độ dài phạt).")
	fmt.Println("  IDF : 'wiki'/'build' (1/5 doc) đắt hơn 'token' (3/5 doc).")
}
```

Chạy:

```bash
go run ./05-bm25/main.go
```

Output thật (verbatim từ máy tui):

```text
Kho 5 doc, độ dài trung bình avgdl = 10.2 token
─────────────────────────────────────────────────────────────
  auth-token  len=10  tf(token)=3  | xác thực dùng token. token hết hạn thì refresh token
  login-flow  len=16  tf(token)=1  | luồng đăng nhập kiểm tra mật khẩu rồi cấp token phiên cho người dùng tiếp tục
  middleware  len= 7  tf(token)=1  | middleware đọc header rồi giải mã token
  ci-pipeline len= 9  tf(token)=0  | ci chạy linter và build trên mỗi lần push
  wiki-index  len= 9  tf(token)=0  | wiki dựng index tự động sau mỗi lần ghi

Truy vấn: "token"
─────────────────────────────────────────────────────────────
grep (lọc — match/không, thứ tự kho, mọi hit ngang nhau):
  ✓ auth-token
  ✓ login-flow
  ✓ middleware

BM25 (xếp hạng theo điểm — cao nhất lên đầu):
  1. auth-token  score = 0.9028
  2. middleware  score = 0.6276
  3. login-flow  score = 0.4292

IDF — vì sao từ hiếm 'đắt' hơn từ phổ biến:
  idf token  = 0.5390   (df = 3/5 doc)
  idf wiki   = 1.3863   (df = 1/5 doc)
  idf build  = 1.3863   (df = 1/5 doc)

Nhận xét:
  grep: 3 hit, không phân biệt cái nào liên quan hơn.
  BM25: auth-token lên đầu (token xuất hiện 3 lần + doc ngắn);
        login-flow xuống chót (1 lần + doc dài → bị chuẩn hoá độ dài phạt).
  IDF : 'wiki'/'build' (1/5 doc) đắt hơn 'token' (3/5 doc).
```

Nhìn vô output, cái khác lộ ra ngay:

- **grep** trả về ba doc: `auth-token`, `login-flow`, `middleware` — theo đúng thứ tự trong kho, **ngang nhau hết**. Nó không nói được cái nào đáng đọc trước.
- **BM25** cũng đúng ba doc đó, nhưng **xếp hạng**: `auth-token` (0.9028) lên đầu vì chữ "token" xuất hiện **3 lần** và doc lại **ngắn**. `middleware` (0.6276) trên `login-flow` (0.4292) dù cả hai chỉ có "token" **một lần** — vì `middleware` ngắn (7 token) còn `login-flow` dài (16 token) nên bị **chuẩn hoá độ dài phạt**.

Và cái bảng IDF cuối cho thấy điều `grep` không bao giờ biết: chữ "wiki" và "build" (mỗi cái chỉ ở 1/5 doc) **đắt gấp ~2,6 lần** chữ "token" (ở 3/5 doc). Nếu truy vấn có nhiều từ, BM25 sẽ ưu tiên doc khớp được cái từ **hiếm** đó.

Đó là toàn bộ khoảng cách giữa "lọc" và "xếp hạng".

## 5. Ba tầng, không phải hai

Phần 2 chia thế giới làm hai: lexical (grep, BM25) vs semantic. Đúng — nhưng nhìn kỹ thì cái trục thật sự có **ba nấc**, phân theo câu hỏi "khớp theo **đơn vị** gì?":

![Ba tầng tìm kiếm: grep lọc theo ký tự, BM25 xếp hạng theo từ, semantic xếp hạng theo nghĩa](/memo/diagrams/semantic/06-grep-bm25-semantic.svg)

_Cùng một truy vấn. grep chia hai phe theo ký tự; BM25 xếp hạng theo từ có trọng số; semantic xếp hạng theo nghĩa bằng vector._

| Tiêu chí                | **grep**            | **BM25**                    | **semantic**                  |
| ----------------------- | ------------------- | --------------------------- | ----------------------------- |
| Bản chất                | Lọc (match/không)   | Xếp hạng theo độ liên quan  | Xếp hạng theo độ gần nghĩa    |
| Khớp theo               | Ký tự / regex       | **Từ** (token, có trọng số) | **Nghĩa** (vector)            |
| Có thứ hạng?            | Không (thứ tự file) | Có (điểm BM25)              | Có (cosine similarity)        |
| Biết từ hiếm/phổ biến?  | Không               | Có (IDF)                    | Có (ngầm trong vector)        |
| "ô tô" tìm ra "xe hơi"? | Không               | Không                       | **Có**                        |
| Sức mạnh regex?         | **Có, mạnh**        | Không                       | Không                         |
| Cần mô hình/embedding?  | Không               | Không                       | **Có**                        |
| Chi phí                 | Rất nhẹ             | Nhẹ                         | Nặng hơn (model + bước embed) |

Để ý cái ranh giới quan trọng: **grep và BM25 ở chung phe "theo chữ"** — cả hai đều mù trước nghĩa, "ô tô" không bao giờ ra "xe hơi". Cái ranh giới nghĩa nằm giữa **BM25 và semantic**, không phải giữa grep và BM25.

Nhưng trong phe "theo chữ" đó, grep và BM25 vẫn là **hai loại việc khác nhau**: một cái lọc, một cái xếp hạng. Gộp chúng làm một là bỏ sót đúng cái lý do người ta xây BM25.

## 6. Vòng lại ymir: vì sao một con tool cố tình chọn BM25, bỏ semantic

Giờ thì câu chuyện ymir ở đầu bài sáng nghĩa.

Ymir cần tra cứu wiki tri thức dự án — chuyện kiểu "tìm trang nói nhiều nhất về authentication". `grep` không đủ: nó không xếp hạng, quăng ra một đống bằng nhau. Semantic thì **quá tay**: phải kéo về một mô hình embedding, chạy bước `qmd embed`, nuôi thêm một local LLM hoặc gọi API — nặng, tốn, và thêm một mắt xích có thể hỏng.

BM25 nằm đúng điểm ngọt ở giữa: **xếp hạng được tài liệu liên quan, mà không cần mô hình nào hết.** Chỉ cần index văn bản. Đó là lý do `SCHEMA.md` của ymir ghi thẳng "keyword-only (BM25) — lightweight, no embeddings and no local LLM". Không phải họ quên semantic. Họ **cân nhắc rồi bỏ** — đổi "hiểu nghĩa" lấy "nhẹ và không phụ thuộc".

Cái thú vị: công cụ `qmd` mà ymir gọi thật ra **có thể** làm vector (bản thiết kế đầu của ymir từng định xài "hybrid BM25 + vector + rerank"). Nhưng bản ship cuối cùng **rút xuống chỉ BM25**. Một quyết định kiến trúc tỉnh táo: chọn nấc thấp hơn trên cái thang ba tầng, vì nấc đó đủ cho bài toán và rẻ hơn nhiều.

Biết ba tầng khác nhau, bạn đọc được quyết định đó. Không biết, bạn chỉ thấy "à nó không có AI search" rồi bỏ qua mất cái hay.

## 7. Punchline: nhớ ba nấc, đừng gộp thành hai

Lần sau nghe ai nói "search của mình chỉ là lexical thôi", đừng dừng ở đó. Hỏi tiếp một câu: **grep hay BM25?**

- Nếu là **grep**: bạn đang có cái lọc. Tìm chính xác thì tuyệt, mà "tài liệu nào liên quan nhất" thì chịu.
- Nếu là **BM25**: bạn đã có cái xếp hạng — biết doc nào đáng đọc trước, biết từ nào quan trọng. Vẫn mù nghĩa, nhưng đã xa grep một quãng.
- Chỉ khi cần **"khác chữ mà cùng nghĩa"** thì mới bước sang **semantic** — và trả giá bằng một mô hình embedding.

Ba nấc, ba bài toán, ba mức chi phí. Cái bẫy không phải là lộn lexical với semantic — Phần 2 đã gỡ cái đó. Cái bẫy tinh vi hơn là **gộp grep với BM25** rồi tưởng "theo chữ" thì cái nào cũng như cái nào.

> [!NOTE]
> Một mẹo thực dụng khi chọn search cho hệ thống của bạn: bắt đầu từ BM25. Nó cho 80% giá trị với 20% chi phí — xếp hạng tử tế mà không nuôi mô hình. Chỉ leo lên semantic khi bạn **đo được** rằng người dùng đang hỏi "khác chữ cùng nghĩa" và BM25 đang trượt. Đừng nhảy thẳng lên vector vì nghe sang.

Một dòng để mang về: **grep chia hai phe, BM25 xếp hạng đám đã khớp, semantic mới hiểu cái bạn thật sự hỏi.**

---

← [Phần 2: "Tool này không có semantic search" — chữ semantic kiểu embeddings](/memo/posts/semantic-search-la-gi/)

[Xem mục lục series →](/memo/posts/chu-semantic-mot-chu-nhieu-nghia/)

---

**Nguồn chính:**

- Okapi BM25 — Manning, Raghavan & Schütze, _Introduction to Information Retrieval_ (công thức + giải thích TF/IDF/length norm): [nlp.stanford.edu/IR-book/…/okapi-bm25](https://nlp.stanford.edu/IR-book/html/htmledition/okapi-bm25-a-non-binary-model-1.html). Gốc BM25 là Robertson & Zaragoza, "The Probabilistic Relevance Framework: BM25 and Beyond".
- Elasticsearch — "Practical BM25" (giải thích TF/IDF/length norm có ví dụ): [elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables](https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables)
- Demo Go: `05-bm25/main.go` (chạy thật, output verbatim)
- Case study: code `ymir` (`commands/query.ts`, `reindex.ts`, `wiki/SCHEMA.md`) — đọc trực tiếp từ repo
