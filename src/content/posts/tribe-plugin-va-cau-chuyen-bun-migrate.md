---
title: 'Bun port 1 triệu dòng code trong 11 ngày — và cái plugin tui viết vì hết tin nổi chữ "done"'
description: "Câu chuyện team Bun migrate Zig sang Rust bằng 64 con Claude chạy song song, và cách nó thành bản thiết kế cho Tribe — plugin 5 agent giao việc theo dây chuyền mệnh lệnh, nơi không ai được tin lời ai."
pubDatetime: 2026-07-25T06:00:00Z
tags: ["ai-agents", "claude-code", "multi-agent", "workflow", "vietnamese"]
lang: "vi"
---

## Chuyện bên Bun, tháng 5 vừa rồi

Đầu tháng 5/2026, [Jarred Sumner — cha đẻ của Bun — đăng một bài porting guide](https://www.theregister.com/software/2026/05/05/anthrophics-bun-team-trials-port-from-zig-to-rust/5222094): một file `PORTING.md` chứa khoảng 300 rule mô tả cách dịch từng idiom của Zig sang Rust. Lúc đó ổng còn nói kiểu thăm dò, đại ý là chưa cam kết gì, chỉ tò mò coi một bản Rust chạy được sẽ trông ra sao.

Rồi chuyện xảy ra nhanh hơn mọi người nghĩ. Khoảng 11 ngày, hơn 1 triệu dòng code, 6.778 commit, **64 con Claude chạy song song**, và ngày 10/5 Jarred công bố bản Rust pass **99,8% test suite** sẵn có trên Linux x64. [The Pragmatic Engineer có bài mổ xẻ riêng](https://blog.pragmaticengineer.com/the-pulse-what-can-we-learn-from-buns-rapid-rust-rewrite-with-ai/) về vụ này.

Tui đọc xong, cái đọng lại không phải là con số 11 ngày.

## Cái đọng lại là hình dạng của cuộc chơi

Nhìn kỹ cách họ làm, nó có ba tầng rõ rệt:

1. **Contract viết trước.** `PORTING.md` với ~300 rule ra đời _trước_ khi con AI nào bắt đầu port. Người giỏi nhất không ngồi gõ code — họ ngồi viết luật.
2. **Thợ thi công máy móc.** 64 con Claude không được quyền sáng tạo. Mỗi con port từng file theo đúng guide, không hỏi han triết lý.
3. **Giám khảo là máy, không phải lời kể.** Không ai hỏi con AI "mày port ổn không?". Câu trả lời duy nhất được chấp nhận là test suite: 99,8% pass. Chấm hết.

Không tầng nào tin tầng nào. Người viết luật không tin thợ, nên mới có 300 rule. Không ai tin lời thợ tự khen, nên giám khảo là bộ test có sẵn từ trước — thứ mà thợ không được sửa.

Ba tầng đó đập trúng ngay cái vấn đề tui đang loay hoay.

## Vấn đề của tui: chữ "done" rẻ quá

Ai xài coding agent một thời gian đều gặp cảnh này: agent báo "Done! All tests passing ✅", mình vô coi thì test nó viết là test rỗng, requirement thiếu một nửa, còn cái bug chính thì được try/catch nuốt mất tiêu. Hồi đó tui nghĩ prompt kỹ hơn là hết. Sai.

Vấn đề không nằm ở prompt. Vấn đề là **cùng một con agent vừa viết code, vừa tự chấm, vừa tự tuyên bố xong**. Nó giống một công ty mà kế toán, thủ quỹ và kiểm toán là cùng một người — người đó không cần gian, chỉ cần _muốn tin_ là sổ sách sẽ đẹp.

Nên tui làm theo hướng của vụ Bun: đừng sửa tính cách của một agent, hãy **tách quyền ra nhiều agent**. Kết quả là plugin tui đặt tên là **Tribe** — một bộ lạc 5 vai cho Claude Code, giao việc theo dây chuyền mệnh lệnh.

## Tribe: năm vai, không ai được lấn sân

```
Owner ⇄ Shaman (What/Why) ⇄ Warchief (How) ⇄ Hunter (build, TDD)
                                  │
                   audit: 2 × Skinner (báo cáo, không phán quyết)
```

- **Shaman** quyết _làm gì và tại sao_. Mỗi ý tưởng phải thành một card có mục tiêu đo được — "first token hiện dưới 1 giây" thì được, "làm cho app cảm giác nhanh hơn" là bị trả về.
- **Warchief** quyết _làm thế nào_: viết spec, viết plan, điều phối, phán quyết audit, giữ quyền merge. Nhưng charter cấm nó viết code feature — thấy nó sửa source sản phẩm là nó đã fail vai.
- **Hunter** là thợ: một task, TDD nghiêm — test đỏ trước, code tối thiểu cho xanh, đúng một commit. Và nó **không có tool để spawn agent hay merge** — muốn lấn sân cũng không có tay để lấn.
- **Skinner ×2** là hai reviewer đối kháng. Đây là chỗ hay nhất, tui kể riêng.
- **Tracker** soi diff theo rule _đã viết ra_ của repo, cấm bịa "best practice" theo khẩu vị.

## Chỗ tinh túy nhất: hai reviewer không bao giờ được thấy nhau

Mỗi lần Hunter xong một task, Warchief thả **hai con Skinner cùng một lúc, trong cùng một message** — vì nếu thả tuần tự, nghĩa là mình đã đọc report con thứ nhất rồi mới viết brief cho con thứ hai, và cái brief đó hết sạch trong. Charter ghi thẳng: dispatch tuần tự _tự nó đã là vi phạm_.

Hai con nhận hai khẩu phần thông tin cố tình khác nhau:

- **Contract lens** cầm spec + plan + diff, và phải **tự chạy** test, typecheck, lint — đọc lời kể không tính.
- **Cold lens** chỉ được cầm **đúng cái diff trần**, kèm một câu duy nhất: _giả định code này sai, đi tìm lý do nó không chạy._ Nó không biết code này _đáng lẽ_ phải làm gì — và chính vì vậy nó bắt được loại bug mà không dòng requirement nào gọi tên: sai thứ tự evaluate, rò tài nguyên, bug lifetime.

Và luật sắt: **không con nào được cầm verdict**. Tụi nó chỉ nộp findings. Warchief phán quyết từng finding một, bằng bằng chứng, với mấy cái sàn cứng không lách được: finding Critical thì cấm ghi nợ (DEBT) để ship cho kịp; muốn bác một finding (REFUTED) thì phải trưng bằng chứng dương, tay không là không hợp lệ.

Còn một luật nữa mà tui khoái nhất. Nếu brief gửi cho Skinner lỡ dính một câu kiểu _"Hunter nó làm kỹ lắm, test pass hết rồi"_ — con Skinner **từ chối audit luôn**, trả về `AUDIT: FAIL — CONTAMINATED`. Lý do ghi trong charter đọc rất đã:

> "Once the narrative is in your context window, ignoring it is unverifiable."

Một khi lời tự sự đã lọt vô context, chuyện "tui đọc rồi nhưng tui bỏ qua" là thứ không ai kiểm chứng được. Cách duy nhất để không bị thuyết phục là **không được nghe**. Văn xuôi thì thuyết phục người ta; artifact thì bị đem ra chạy. Bên viết code muốn nói gì với reviewer? Commit nó vô diff — dưới dạng test, dưới dạng assertion — rồi reviewer sẽ _chạy_ nó.

## Và chữ "done" thì phải kiểm được bằng máy

Trong Tribe, "done" không phải câu nói. Nó là một trạng thái có hình dạng: PR merge vô default branch bằng **regular merge có đúng 2 parent** (cấm squash — vì 2 parent là thứ script kiểm được), CI xanh, evidence before/after đính kèm. Và khi Warchief báo `SHIPPED`, Shaman cũng không tin — nó chạy một script kiểm lại bốn điều đó bằng `gh` và `git`. Kiểm fail thì coi như chưa ship, khỏi cãi.

Cái vòng Bun lặp lại y chang, mọi người thấy không? Contract trước. Thợ máy móc. Giám khảo là máy. Bun làm ở thang 1 triệu dòng với 64 instance; Tribe gói cùng triết lý đó lại cho cỡ dự án cá nhân, thêm một tầng mà vụ Bun không cần tới: khi mọi thứ _mơ hồ_ — spec đọc được hai kiểu, hai reviewer đòi hai hướng ngược nhau — hệ thống không nghiền tiếp, nó **dừng và đẩy câu hỏi lên người có quyền quyết**, tối đa 3 vòng sửa là cắt.

## Nói thiệt

Bài này là bài khoe, nhưng khoe thì cũng phải theo luật của chính cái plugin: claim nào cũng phải có bằng chứng, kể cả claim bất lợi.

Tuần này tui build một bộ benchmark cho Tribe: 34 tình huống kiểm tra xem từng agent có giữ đúng luật của nó không. Kết quả baseline: 29/33 pass. Trong 4 ca fail, soi kỹ evidence thì 2 ca là do tui viết ca kiểm thử sai (agent làm đúng — có một ca Skinner từ chối audit vì chính tui viết prompt dính contamination, đúng y luật nó được dạy), 1 ca chưa đủ dữ liệu để kết luận, và **1 ca là lỗi thật**: Warchief giữ được nửa dễ của một luật nhưng trượt nửa tinh vi. Baseline mới chạy 1 lần mỗi ca nên chưa nói được gì về độ ổn định — đó là việc kế tiếp, trước khi tui dám tune prompt.

Tức là: cỗ máy này chưa hoàn hảo, và tui biết _chính xác_ nó chưa hoàn hảo chỗ nào. Với tui, đó mới là điểm đáng khoe nhất. Một hệ thống xây trên nguyên tắc "không tin lời kể, chỉ tin bằng chứng" mà bản thân nó không dám tự đo, thì nó chỉ là văn mẫu.

Còn nếu mọi người chỉ mang về một câu, thì mang câu này: **đừng cố làm agent giỏi lên bằng cách năn nỉ nó trong prompt — hãy thiết kế để nó không thể tự chấm bài của chính mình.** Team Bun không tin 64 con Claude, họ tin 300 rule và một bộ test suite. Tui cũng vậy.

---

_Nguồn cho vụ Bun: [The Register — Bun posts Rust porting guide](https://www.theregister.com/software/2026/05/05/anthrophics-bun-team-trials-port-from-zig-to-rust/5222094), [The Pragmatic Engineer — What can we learn from Bun's rapid Rust rewrite with AI?](https://blog.pragmaticengineer.com/the-pulse-what-can-we-learn-from-buns-rapid-rust-rewrite-with-ai/)._

**Đọc thêm:** con Tracker nhắc ở trên còn giữ một bài toán riêng — soi rule thì dễ, nhưng làm sao
cho mỗi lỗ hổng nó phát hiện một cái ID sống được qua nhiều lần chạy, trong khi bản thân nó không
nhớ gì giữa các lần đó? Tui kể trong [Đóng băng, đừng băm: cho một agent không tất định một danh
tính tất định](/memo/posts/freeze-dont-hash-gap-ids-vi/).
