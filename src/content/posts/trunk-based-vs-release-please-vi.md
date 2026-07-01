---
title: "Trunk-Based Development vs 'Release-Please': Ba Bài Toán Bị Tưởng Là Một"
description: "Đối mặt với tranh staging và 'mất code khi merge', nhiều team dùng một cơ chế release-branch + cherry-pick mà họ gọi là 'release-please'. Bài này gỡ ba bài toán bị tưởng là một, fact-check release-please thật sự làm gì, chỉ ra vì sao cherry-pick-để-chọn-lọc tái tạo đúng con bug nó định sửa, và trình bày một playbook trunk-based tổng quát."
pubDatetime: 2026-07-01T09:00:00Z
lang: vi
tags:
  - trunk-based-development
  - release-please
  - cherry-pick
  - feature-flags
  - staging-environments
  - git
  - ci-cd
  - vietnamese
multiLangKey: "trunk-based-vs-release-please"
---

## Tóm tắt nhanh (TL;DR)

1. **Ba bài toán đội chung một cái mặt nạ.** *"Tranh nhau staging"*, *"merge mệt / mất code"*, và *"chọn cái gì để ship"* là **ba bài toán khác nhau với ba lời giải khác nhau**. Dùng một chiến lược nhánh (branching strategy) để giải cả ba cùng lúc — đó là sai lầm gốc.
2. **"Release-please" không phải thứ đa số nghĩ.** Công cụ thật (`googleapis/release-please`) **không cherry-pick và không curate release branch**. Nó theo dõi trunk và tự động hoá version + changelog + tag. Nó là automation **nằm TRÊN** trunk-based development — **ngược lại** với "cắt release branch rồi cherry-pick các commit mình muốn."
3. **Cherry-pick để chọn lọc bản release là tự bắn vào chân.** Nó tái tạo đúng con bug "mất code" mà bạn đang chạy trốn — và làm nó **im lặng**. Một cú cherry-pick bị quên hoặc sai thứ tự vẫn compile, vẫn pass test lẻ, và ship; lỗ hổng vài tuần sau mới lòi ra dưới dạng "regression". Đổi một lỗi **ồn ào** (merge conflict) lấy một lỗi **im lặng** (drop âm thầm) là một cú đổi tệ — càng tệ với code xử lý tiền.
4. **Tranh staging là bài toán môi trường, không phải branching.** `tranh chấp = (số người cần validate độc lập) ÷ (số staging dùng được)`. Không chiến lược nhánh nào đổi được tỉ số đó. Ephemeral environment, feature-flag targeting theo user, hoặc booking queue mới đổi được.
5. **Kết luận.** Giữa hai lựa chọn theo cách hay được nêu, **trunk-based development thắng dứt khoát** ở trục merge/mất-code và hoà (bằng 0) ở trục staging. Nhưng đây là **nhị phân giả** — release-please chạy *TRÊN* trunk-based development. Hãy dùng trunk-based làm kỷ luật nhánh, dùng **feature flags + release-train snapshot** (không cherry-pick chọn lọc) để kiểm soát cái gì ship, và giải staging **riêng** bằng một chiến lược môi trường.

---

## 1. Bối cảnh (đã ẩn danh)

Một team vận hành một service với **một môi trường staging dùng chung duy nhất**. Nhiều lập trình viên làm feature cùng lúc, và mọi feature đều phải validate trên đúng môi trường đó — nên họ **giành nhau** quyền deploy lên staging.

Họ đã thử hai cách chữa cháy:

- **Một nhánh tích hợp dùng chung (shared integration branch).** Việc đang làm dở của mọi người được merge vào một nhánh, deploy lên staging, và — khi một feature pass — merge tiếp lên `master`; nhánh tích hợp thỉnh thoảng được re-sync bằng cách merge `master` ngược vào. Cái đau: merge hai chiều liên tục, **kiệt sức**.
- **Luôn merge thẳng vào `master`.** Họ bỏ nhánh tích hợp. Đau mới: khi merge, thay đổi bị **"miss" / mất** — code âm thầm biến mất.

Ý tưởng họ đề xuất, mà họ gọi là **"release-please"**: cứ merge vào `master`; đến khi cần release thì **cắt một release branch riêng và cherry-pick các commit mong muốn vào đó**, rồi release từ đấy.

Phần còn lại của ghi chú này lập luận rằng cách khung hoá đó gộp nhầm ba bài toán, rằng cái nhãn "release-please" là sai về mặt sự kiện, và rằng kế hoạch cherry-pick tái nhập chính con bug nó định giải — đồng thời chỉ ra cái gì *thực sự* chữa từng bài toán.

## 2. Ba bài toán, không phải một

Đây là điểm mấu chốt. Gỡ chúng ra thì mỗi cái có một lời giải riêng, đã được hiểu rõ:

| Bài toán | Bản chất thật | Lớp giải đúng |
| --- | --- | --- |
| Tranh 1 staging | **Môi trường / tài nguyên** (topology) | Ephemeral env, feature-flag targeting, booking/lock |
| Merge mệt + mất code | **Tích hợp / vệ sinh git** | Trunk-based: nhánh ngắn, merge nhỏ một chiều |
| Quyết định cái gì lên production | **Quản lý release** | Feature flags / release train / release-please (công cụ) |

Bài toán staging bị chi phối bởi một tỉ số:

```
tranh chấp = (số người cần validate độc lập) ÷ (số staging dùng được)
           = N ÷ 1    ← hôm nay
```

Đổi cách commit tới `master` **không đụng vào mẫu số**. Giữ nguyên workflow hiện tại nhưng thêm một staging → tranh chấp giảm. Chuyển sang trunk-based thuần nhưng vẫn một staging → tranh chấp *y hệt* (thậm chí tệ hơn: merge nhỏ, thường xuyên hơn, mỗi cái lại đòi một slot validate). Lời giải nằm ở **topology môi trường, không phải topology quản lý phiên bản (version-control)**.

## 3. "Release-please" thật ra là gì (đập tan ngộ nhận)

Đã fact-check với repo chính thức (`googleapis/release-please`, `README.md` + `docs/design.md`):

- Nó **theo dõi một nhánh duy nhất — thường là nhánh mặc định/trunk.**
- Nó parse **Conventional Commits** kể từ tag release gần nhất và duy trì **một "Release PR" cuộn** *trên chính nhánh đó*, tự bump version và cập nhật `CHANGELOG.md`. **Merge PR đó chính là release** (tag + release notes).
- Nó **khuyến nghị squash-merge / lịch sử tuyến tính** và chạy kém với merge commit rối.
- Nó giả định **mọi commit đã lên trunk đều đáng release.** **Không có cherry-pick và không có release branch curated ở bất kỳ đâu trong thiết kế của nó** — kể cả ở chế độ maintenance/LTS tuỳ chọn, nơi con người (hoặc một backport bot riêng), chứ không phải release-please, mới là bên di chuyển commit.

Vậy release-please là **automation phủ lên trunk-based development**, không phải một lựa chọn thay thế nó, và là thái cực đối lập với "cắt release branch rồi bốc tay từng commit."

Cái mà bối cảnh đang mô tả có một tên thật, cũ hơn: **pattern "Release Branch" của Fowler** / **"Branch For Release" của trunk-based development.** Mượn tên "release-please" cho một workflow cherry-pick không phải là gán nhãn sai vô hại — nó vay uy tín của một công cụ được thiết kế tốt để gán cho một pattern hành xử ngược lại, và sẽ làm rối bất kỳ ai sau này dùng công cụ thật mà kỳ vọng nó "curate".

## 4. Vì sao cherry-pick-để-chọn-lọc tái tạo "mất code"

Cáo buộc trung tâm. Cherry-pick một tập commit đã chọn lọc lên release branch **không loại bỏ** lỗi "mất code khi merge" — nó **dời** lỗi đó sang một mối nối mới nguy hiểm hơn và **tước mất khả năng của git để phát hiện nó**.

Cơ chế (từ tài liệu git, bài *"Stop cherry-picking, start merging"* của Raymond Chen, và tài liệu Branch-For-Release):

1. **Cherry-pick tạo một commit mới với SHA mới, không có liên kết tổ tiên (ancestry)** với commit gốc. Vì thế git **không thể trả lời "cái này đã port chưa?"** — việc theo dõi đó trở thành 100% trí nhớ con người (một danh sách SHA, một changelog, tribal knowledge). Đúng cái loại theo dõi vỡ trận dưới áp lực ngày release → **quên cherry-pick → một con bug "đã fix" ship lại vài tuần sau.**
2. **Hiểm hoạ thứ tự phụ thuộc (dependency-order).** Pick commit *B* nhưng quên *A* mà *B* phụ thuộc, thì *B* có thể apply **không hề conflict về mặt text**, compile được, pass test lẻ — nhưng sai về mặt ngữ nghĩa trong bối cảnh release. Không có conflict marker nào cảnh báo.
3. **Mất hunk âm thầm.** Resolve một conflict khi cherry-pick **không có merge-base chung** để đối chiếu, và phải làm lại từ đầu mỗi lần release. Raymond Chen gọi trường hợp *không có conflict* là **"còn tệ hơn"** conflict ồn ào — vì không ai nhận ra code đã biến mất.

**Ồn ào vs im lặng mới là điểm chí mạng.** Cái đau hiện tại ("merge mệt") là lỗi **ồn ào**: conflict chặn bạn và ai cũng thấy. Kế hoạch cherry-pick đổi nó lấy lỗi **im lặng**: một commit bị drop vẫn ship và vài tuần sau mới bị phát hiện. Với code xử lý tiền (idempotency, các invariant về tính đúng đắn), một thay đổi bị drop âm thầm **tệ hơn hẳn** một conflict ồn ào. Và nó **co giãn ngược hướng**: càng nhiều feature song song, tập cần chọn lọc mỗi release càng phình, nên bề mặt lỗi *lớn lên khi team lớn lên*.

## 5. Trực giác không sai hoàn toàn (steelman)

Công bằng mà nói — vài phần của ý tưởng là đúng:

- **"Luôn merge vào `master`" (một chiều) là đúng.** Thủ phạm tệ nhất gây mất code là merge **hai chiều** giữa các nhánh sống lâu (feature vào nhánh tích hợp, `master` ngược vào nó, lặp đi lặp lại) — bối cảnh dẫn tới merge-base cũ và "evil merge". Đi một chiều lên `master` giết cơ chế đó. Giữ nửa này lại.
- **Release branch là hợp lệ — cho đúng việc:** cô lập một hotfix, đỡ nhiều phiên bản production cùng lúc, hoặc một cửa release theo lịch/theo quy định. Chỉ là **không** dùng làm cơ chế thường ngày để chọn feature nào ship.
- **Sự hoài nghi rằng "đổi branching sẽ chữa staging" là đúng** — và trunk-based development cũng không chữa nó.

Lời giải cho "kiểm soát cái gì ship" trong trunk-based development là **feature flags** (một quyết định lúc runtime), không phải **cào lịch sử git** (một quyết định dễ lỗi âm thầm).

## 6. Trunk-based development không phải thuốc tiên

Nếu ai đó nói "cứ chơi trunk-based development đi", đó là lời khuyên **cần-nhưng-chưa-đủ**. Nó chữa **một** trong ba bài toán (tích hợp/mất-code) và đòi các điều kiện tiên quyết:

1. **Một CI gate đủ mạnh để chặn merge** (compile + unit nhanh + integration test). *Bỏ qua cái này chính xác là cách "always merge to master" đã tạo ra mất code lần đầu — đó là cơ chế trung tâm của trunk-based nhưng thiếu lưới an toàn.*
2. **Hạ tầng feature-flag + kỷ luật** để merge việc dở dang an toàn. Flag mang theo lớp rủi ro riêng: một đường code flag cũ/nằm im từng khiến một hãng giao dịch mất **~460 triệu USD trong 45 phút.** Trong hệ xử lý tiền, hãy audit flag quanh code idempotency/khoá một cách có chủ đích.
3. **Review nhanh** (nhánh sống theo giờ–ngày, không phải tuần) nếu không nhánh "ngắn hạn" âm thầm biến thành sống lâu và cái đau merge quay lại.
4. **Văn hoá PR nhỏ** trên toàn bộ người đóng góp.

Ngoài ra: **tương quan trunk-based của DORA là một *bó năng lực*** (trunk-based + test tự động + pipeline deploy tin cậy + batch nhỏ), **không phải một cần gạt đơn lẻ.** Lấy nửa branching mà thiếu nửa test/pipeline thì chỉ nhận rủi ro chứ không nhận lợi ích.

## 7. Tranh staging = bài toán môi trường (bậc thang)

Coi "một môi trường cô lập cho mỗi thay đổi" là một **interface**, rồi chọn hiện thực theo ngân sách. Tất cả đều **không phụ thuộc stack**:

| Bậc | Pattern | Chi phí | Có giảm tranh chấp thật không? | Ghi chú |
| --- | --- | --- | --- | --- |
| 0 | **Booking / lock queue** (concurrency group của CD; bot "ai đang giữ staging") | rất thấp | ❌ chỉ làm cho công bằng | mọi CD system đều có primitive concurrency/lock |
| 1 | **Feature-flag targeting** (nhiều feature sống chung một env; mỗi tester thấy state riêng) | thấp–TB | ✅ *nếu* flag hỗ trợ targeting theo user/session | flag global on/off **không** giảm tranh chấp |
| 2 | **Shift-left** (dependency thật trong CI, ví dụ DB/queue chạy container) → cần staging ít hơn | TB | ✅ gián tiếp (giảm nhu cầu) | giảm lượng việc *phải* lên staging chung |
| 3 | **Ephemeral per-PR environment** (mỗi PR một stack cô lập) | cao, co giãn theo độ stateful | ✅ lời giải cấu trúc thật sự | yếu tố chi phí = seed DB + cô lập queue + cô lập config |
| 3b | **Request-level isolation** (một baseline + route theo header) | cao ban đầu, rẻ mỗi PR | ✅ hợp hệ nhiều state | tránh nhân bản datastore mỗi PR |

**Luật chọn:** bắt đầu bậc 0+1 ngay (cầm máu), đầu tư bậc 2 song song, tiến tới 3/3b khi ROI rõ. **Cảnh báo:** ephemeral environment *mục ruỗng* nếu thiếu owner và seed data tự động — team mất niềm tin và âm thầm quay lại staging chung. Bậc 3 cần seed pipeline và TTL, không thì đừng làm.

## 8. Playbook tổng quát

### Mô hình đích (mọi stack)

```
  ┌─ nhánh ngắn (giờ→1-2 ngày, một chủ sở hữu)
  │     │  PR + CI gate (phải xanh) + review nhanh
  ▼     ▼
main (trunk) ───────────────────────────────►  LUÔN releasable
  │   ▲  việc chưa xong ẩn sau một FEATURE FLAG (không giữ trên nhánh)
  │   └── merge nhỏ, thường xuyên, MỘT CHIỀU; không sync hai chiều nhánh sống lâu
  │
  ├──► Release = deploy/tag trunk theo cadence   ← default đơn giản nhất
  │        (release-please tự sinh tag + CHANGELOG, tuỳ chọn)
  │
  └──► Chỉ khi một repo THẬT SỰ cần cửa ổn định → "release train":
           cắt release/<date> = một SNAPSHOT NGUYÊN VẸN của trunk (không cherry-pick chọn lọc)
           hotfix = sửa trên trunk trước → cherry-pick -x TIẾN tới snapshot (cô lập, có truy vết)
           cái gì chưa sẵn qua flag thì đi chuyến tàu sau
```

### Ba luật bất di bất dịch

1. **Nhánh sống ngắn, merge một chiều vào trunk.** Không nhánh tích hợp dùng chung, không re-sync hai chiều.
2. **"Cái gì ship" quyết bằng feature flag (runtime), không bằng cào lịch sử git.** Bỏ code-freeze branch và cherry-pick-để-chọn-feature.
3. **Cherry-pick chỉ cho hotfix cô lập, một chiều (trunk → release), gắn `-x`.** Không bao giờ để curate một bản release.

### Trình tự chuyển đổi (mỗi repo)

- **Ngay:** bật `git rerere` (tự phát lại cách resolve conflict); bắt buộc PR + CI xanh mới merge (branch protection). Chi phí gần bằng 0, bảo vệ mất-code tức thì.
- **Kế:** ngừng merge hai chiều; giới hạn đời nhánh ~2 ngày; tháo dỡ nhánh tích hợp dùng chung.
- **Kế:** thay code-freeze bằng một **release train** (snapshot, không curate); hotfix qua `cherry-pick -x` tiến tới.
- **Song song:** feature flags (ưu tiên targeting theo user — nó cũng mở khoá bậc 1 của staging); audit flag quanh code tiền/khoá.
- **Tuỳ chọn:** thêm release-please cho tag + changelog (release *từ trunk*).

### Nhân bản ra nhiều repo

Đừng giải lại cho từng repo. Đóng gói mô hình thành **năng lực dùng chung**: template pipeline CI/CD chung mà mọi repo `extends`; default branch-protection cấp tổ chức trong một file cấu hình; một nền tảng **feature-flag** dùng chung và một nền tảng **preview-environment** dùng chung (đây là nơi staging được giải *một lần* cho tất cả); và một **golden-path repo template** để repo mới clone.

## 9. Kết luận

- **Giữa hai lựa chọn như đã nêu → trunk-based development, dứt khoát.** Nó thắng ở merge/mất-code và hoà (bằng 0) ở staging. Kế hoạch cherry-pick bị *dominated*: không hơn ở staging, tệ hơn rõ rệt ở trục nó đụng vào, và im lặng ở đúng chỗ cái đau hiện tại đang ồn ào.
- **Nhưng không phải chọn một trong hai.** Release-please chạy trên trunk-based development. Thiết kế thật là phân lớp: **trunk-based** cho branching, **feature flags + release-train snapshot** cho việc-gì-ship, **một chiến lược môi trường** cho staging, và **release-please (công cụ, từ trunk)** cho bookkeeping release. Trực giác "luôn merge vào master" là đúng; trực giác "cherry-pick để curate" mới là phần cần bỏ.

## Nguồn

- Trunk Based Development — trunkbaseddevelopment.com (đặc biệt *Short-Lived Feature Branches*, *Branch For Release*, *Feature Flags*)
- DORA / Accelerate — năng lực *Trunk-based development* (dora.dev)
- Martin Fowler — *Patterns for Managing Source Code Branches* (pattern Release Branch)
- Raymond Chen — *Stop cherry-picking, start merging* (The Old New Thing, Microsoft)
- Tài liệu `git-cherry-pick`; glossary *evil merge* của git; các bài *reoccurring conflicts after squash-merge*
- `googleapis/release-please` — `README.md`, `docs/design.md`; Conventional Commits v1.0.0
- Ephemeral/preview environment & feature-flag targeting — các bài trung lập với vendor (preview environment, request isolation); nợ kỹ thuật feature-flag / vụ ~460 triệu USD do flag cũ
