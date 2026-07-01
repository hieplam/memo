---
title: "Công cụ đo chất lượng test cho Go và .NET: Coverlet, Stryker, gremlins"
description: "Coverlet và go test -cover cho coverage, Stryker.NET và gremlins cho mutation score, FsCheck/CsCheck và gopter/rapid cho property testing. Phần công cụ, kèm bí quyết chạy mutation testing trên codebase kế thừa mà không tốn cả ngày CI."
pubDatetime: 2026-07-01T00:05:00Z
lang: vi
tags:
  - testing
  - mutation-testing
  - dotnet
  - golang
  - vietnamese
multiLangKey: "test-quality-metrics-4"
---

> **"Vượt ra ngoài Code Coverage — Metric chất lượng test cho vòng lặp agentic" — Phần 4/7.** Bộ công cụ cụ thể cho .NET và Go — coverage, mutation, property-based testing — cùng bí quyết chạy mutation testing diff-scoped trên codebase kế thừa mà không tốn cả ngày CI. Tiếp theo [Phần 3](/memo/posts/test-quality-part-3-empirical-evidence-vi/).

- **.NET:** `coverlet` cho coverage (bộ lọc âm), **Stryker.NET** cho mutation score (công cụ chẩn đoán oracle), `FsCheck`/`CsCheck` cho property.
- **Go:** `go test -cover` tích hợp sẵn + `go-carpet`, **gremlins** (hoặc `go-mutesting`/`ooze`) cho mutation, `gopter`/`rapid` cho property.
- Bí quyết không thể thiếu trên codebase kế thừa: chạy mutation **diff-scoped và gia tăng**, không bao giờ trên toàn repo.

> ⚠️ **Lưu ý về nguồn:** chi tiết flag/threshold của Stryker.NET dưới đây được lấy từ tài liệu chính thức của Stryker. Các tuyên bố cụ thể đó _đã được xếp hàng để xác minh đối nghịch nhưng bị lỗi_ (giới hạn phiên) trong lần chạy nghiên cứu này, vì vậy hãy coi chúng là **"theo tài liệu chính thức, xác nhận với phiên bản cài đặt của bạn."** Hướng dẫn khái niệm là chắc chắn; hãy xác nhận tên flag chính xác với phiên bản Stryker.NET của bạn.

---

## 1. Stack .NET

### Coverage — Coverlet

```bash
dotnet test --collect:"XPlat Code Coverage"          # coverlet.collector
# hoặc để lấy số line/branch + threshold:
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=cobertura \
            /p:Threshold=0 /p:ThresholdType=line
```

Chỉ sử dụng đầu ra Coverlet để **tìm các dòng thay đổi có coverage bằng không**. Đưa chúng vào ReportGenerator để xem diff view. Đừng đặt `/p:Threshold` cao như một cổng chất lượng — đó là bẫy Goodhart ([Phần 0](/memo/posts/test-quality-part-0-why-coverage-lies-vi/)).

### Mutation — Stryker.NET

```bash
dotnet tool install -g dotnet-stryker
dotnet stryker                       # full run (chậm — tránh trên repo kế thừa)
dotnet stryker --since:main          # CHỈ mutate file thay đổi từ main  ← thân thiện với kế thừa
dotnet stryker --with-baseline:main  # gia tăng: tái sử dụng kết quả trước, chỉ test lại mutant bị ảnh hưởng
dotnet stryker --break-at 80         # FAIL build nếu mutation score < 80 (cổng cứng)
```

Các thực tế quan trọng (theo tài liệu chính thức):

- **Threshold mặc định** là `high: 80`, `low: 60`, `break: 0` — điểm **< 60 được đánh dấu "nguy hiểm,"** **≥ 80 "tốt."** Đây là baseline ngành hợp lý cho "đủ tốt" trên một module .NET.
- **`--since:<branch>`** giới hạn mutation vào các file thay đổi từ một git committish — chạy tỷ lệ với **diff**, không phải repo. Đây là thứ làm cho Stryker có thể quản lý được trên một hệ thống kế thừa lớn.
- **`--with-baseline`** lưu trữ kết quả trước đó và chỉ test lại các mutant bị ảnh hưởng bởi source thay đổi hoặc test thay đổi — các lần chạy gia tăng tái sử dụng công việc trước đó. Lý tưởng cho cổng agentic mỗi PR.
- **`--break-at <score>`** biến mutation score thành cổng chất lượng CI.

### Property — FsCheck / CsCheck

```csharp
// CsCheck — bất biến: khoản thanh toán hoa hồng không bao giờ vượt quá số tiền còn nợ
Gen.Decimal[0, 1_000_000m].Sample(owed => {
    var paid = CommissionCalculator.Pay(owed);
    Assert.True(paid <= owed);
});
```

Property là oracle có giá trị nhất cho toán học tiền tệ — chúng kiểm chứng _điều gì luôn phải đúng_ và khám phá các đầu vào bạn sẽ không bao giờ liệt kê được.

## 2. Stack Go

### Coverage — tích hợp sẵn

```bash
go test ./... -coverprofile=cover.out
go tool cover -func=cover.out          # % theo từng hàm
go tool cover -html=cover.out          # trực quan
go-carpet                              # heat map terminal của các dòng chưa được phủ
```

### Mutation — gremlins (khuyến nghị), go-mutesting, ooze

```bash
go install github.com/go-gremlins/gremlins/cmd/gremlins@latest
gremlins unleash ./...                 # full run
gremlins unleash --diff main ./...     # diff-scoped (thân thiện với kế thừa)
gremlins unleash --dry-run             # liệt kê mutant mà không chạy test (ước tính chi phí)
```

gremlins báo cáo hai con số riêng biệt — hãy giữ chúng tách biệt ([Phần 2](/memo/posts/test-quality-part-2-mutation-testing-vi/)):

- **Test Efficacy** = `KILLED / (KILLED + LIVED)` → độ mạnh oracle.
- **Mutant Coverage** = `(KILLED + LIVED) / (KILLED + LIVED + NOT_COVERED)` → reachability.

Các thay thế: **go-mutesting** (cũ hơn, bộ toán tử rộng hơn), **ooze** (kiểu thư viện, nhúng vào tooling của bạn). Tất cả chia sẻ nguyên tắc diff-scoping.

### Property — gopter / rapid / testing/quick

```go
// rapid — bất biến: làm tròn đến xu không bao giờ mất hoặc tạo tiền
rapid.Check(t, func(t *rapid.T) {
    owed := rapid.Float64Range(0, 1e6).Draw(t, "owed")
    paid := commission.Pay(owed)
    require.LessOrEqual(t, paid, owed)
})
```

## 3. Tài liệu tham khảo chuẩn: PIT (Java)

Khi bạn đọc về độ trưởng thành của mutation testing, tiêu chuẩn vàng là **PIT / Pitest** (Java). Stryker (`.NET`/JS/Scala) và gremlins (Go) là các phiên bản kế thừa về tinh thần. PIT đã tiên phong các kỹ thuật thực tế mà bạn nên sao chép: **mutation bytecode để tăng tốc, phân tích gia tăng, và chọn mutant có hướng dẫn bởi coverage** (chỉ mutate các dòng được phủ). Nếu bạn muốn hiểu _tại sao_ một tính năng tồn tại trong Stryker/gremlins, tài liệu PIT thường giải thích nó trước.

## 4. Chạy mutation testing trên codebase kế thừa mà không tốn cả ngày

Đây là mối quan tâm vận hành then chốt. Các quy tắc:

1. **Giới hạn phạm vi mọi thứ vào diff.** Chỉ mutate các file/dòng thay đổi trong PR (`--since` / `--diff`). Thực hành công nghiệp của Google mutate dựa trên diff và bỏ qua các dòng "cằn cỗi" (chưa được phủ/không thú vị), điều này _"làm giảm đáng kể số lượng mutant."_ <sup>[google]</sup>
2. **Chỉ mutate các dòng được phủ.** Một mutant trên dòng chưa được phủ được đảm bảo sống sót và không cho bạn biết gì mới (bạn đã biết nó chưa được phủ). Coverage trở thành _bộ lọc đầu vào_ cho mutation — đây là một trong số ít cách sử dụng thực sự tốt của coverage.
3. **Đặt ngân sách thời gian.** Giới hạn wall-clock mỗi lần chạy (ví dụ: 10 phút). Nếu diff quá lớn, hãy lấy mẫu mutant. **Ghi lại những gì bạn bỏ qua** — đừng bao giờ để giới hạn âm thầm giả vờ là "tất cả xanh."
4. **Sử dụng chế độ baseline/gia tăng.** Lưu trữ kết quả; chỉ test lại mutant bị ảnh hưởng bởi thay đổi (`--with-baseline`).
5. **Phân loại mutant tương đương một lần, ngăn chặn mãi mãi.** Duy trì danh sách bỏ qua các mutant tương đương đã biết để chúng không làm phiền lại mỗi lần chạy.
6. **Bắt đầu với các viên ngọc quý.** Đừng cố làm tất cả. Bật diff-mutation cho các module rủi ro cao nhất trước — ví dụ trong một hệ thống thanh toán hoa hồng cho đối tác: tính toán hoa hồng, điều phối đợt thanh toán định kỳ (payment run), idempotency/tính duy nhất của mã tham chiếu giao dịch, các quy tắc due-date. Mở rộng ra ngoài dần dần.

---

← [Phần 3: Nghiên cứu thực sự nói gì](/memo/posts/test-quality-part-3-empirical-evidence-vi/) · [Phần 5: Chấm điểm test do AI viết](/memo/posts/test-quality-part-5-grading-ai-tests-vi/) →

---

**Nguồn tham khảo:**

- **[stryker]** Stryker.NET configuration & pipeline docs. https://stryker-mutator.io/docs/stryker-net/configuration/ · https://stryker-mutator.io/docs/stryker-net/stryker-in-pipeline/ — chi tiết flag/threshold theo tài liệu, không được xác minh lại độc lập trong lần chạy này.
- **[gremlins]** go-gremlins. https://github.com/go-gremlins/gremlins · https://gremlins.dev/
- **[google]** _State of Mutation Testing at Google._ https://research.google/pubs/state-of-mutation-testing-at-google/ — cách tiếp cận arid-lines/diff đã xác minh (2-1).
- PIT/Pitest reference: https://pitest.org/
