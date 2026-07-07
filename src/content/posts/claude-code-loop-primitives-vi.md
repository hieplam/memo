---
title: 'Loop trong Claude Code: "Thiết kế loop" thiệt ra là gì — và mấy chuyện docs không nói'
description: "Lên X mười phút là thấy chữ 'loop' bị mỗi người hiểu một kiểu. Bài này chia bốn loại loop của Claude Code theo cái bạn giao lại cho máy, rồi verify luôn mấy chỗ bài viết gốc lướt qua: /goal không có cap tích hợp, /loop chết theo session, /schedule còn đang research preview."
pubDatetime: 2026-07-07T09:00:00Z
lang: "vi"
tags:
  - claude-code
  - ai-agents
  - loops
  - automation
  - dynamic-workflows
  - vietnamese
multiLangKey: "claude-code-loop-primitives"
---

Lên X đọc chừng mười phút về chuyện "thiết kế loop" cho coding agent là tui thấy liền: chẳng ai hiểu chữ "loop" giống ai. Người thì coi nó là một cron job chạy định kỳ. Người thì coi loop là "cứ để Claude tự thử tới khi test pass". Người khác lại coi nó là cả một pipeline điều phối nhiều agent. Cùng một chữ, ba mô hình trong đầu khác hẳn nhau — mà lỡ dựng mô hình từ cái sai, tới lúc cần là bạn chọn lộn công cụ.

Đội Claude Code định nghĩa gọn hơn nhiều: **loop là một agent lặp lại các chu kỳ công việc cho tới khi đạt điều kiện dừng (stop condition).** Mọi thứ còn lại — cái gì kích hoạt (trigger) nó, nó dừng kiểu gì, dùng cơ chế (primitive) nào — chỉ là biến số. Nhìn theo kiểu này thì "cần loại loop nào" hết còn là cảm tính, nó thành một checklist: mình đang giao lại cái gì, và mình còn giữ quyền kiểm soát cái gì.

Bài này chưng cất từ một phiên deep-research (108 sub-agent, 25 nguồn, 24/25 claim được xác minh độc lập, 1 bị bác bỏ) — fact-check bài viết ClaudeDevs ["Getting started with loops"](https://x.com/ClaudeDevs/article/2074208949205881033) (@delba_oliveira) đối chiếu với docs thật của Claude Code. Khung phân loại bên dưới là của bài gốc; phần cơ chế là cái đã qua được vòng verify. Trích dẫn đầy đủ nằm ở [research note song ngữ](https://github.com/hieplam/research/blob/master/raw/claude-code-loop-primitives-vi.md).

## Bốn loại loop, chia theo cái bạn giao lại

| Loop       | Bạn giao lại     | Dùng khi                              | Dùng công cụ                        |
| ---------- | ---------------- | ------------------------------------- | ----------------------------------- |
| Turn-based | Bước kiểm tra    | Bạn đang khám phá hoặc cân nhắc       | Verification skill tự viết          |
| Goal-based | Điều kiện dừng   | Bạn biết rõ "xong" trông ra sao       | `/goal`                             |
| Time-based | Yếu tố kích hoạt | Việc diễn ra ngoài project, theo lịch | `/loop`, `/schedule`                |
| Proactive  | Cả câu prompt    | Việc lặp lại và đã định nghĩa rõ      | Tất cả trên, cộng dynamic workflows |

Mọi prompt bình thường bạn gõ đã là một loop thủ công rồi — Claude gom context, hành động, tự kiểm việc mình làm, lặp lại nếu cần, rồi trả quyền lại cho bạn. Ba cơ chế bên dưới chỉ là lần lượt nhận thêm phần việc đó, đổi lại bạn nói ít hơn ở từng lượt.

Đó là khung. Còn đây là phần bài viết gốc không nói rõ về cách từng cái vận hành thiệt sự — phần quan trọng khi bạn dựa vô nó cho việc không phải ví dụ chơi chơi.

## `/goal`: không có cap tích hợp, và nó không thấy được cái gì bạn không nói ra

`/goal` cho một session cứ lặp tới khi đạt điều kiện bằng ngôn ngữ tự nhiên, thay vì dừng sau một lượt. Cơ chế, đã verify nhất trí 3-0 qua nhiều lần kiểm độc lập: sau mỗi lượt, một model nhỏ nhanh (mặc định Haiku) đọc điều kiện của bạn cộng transcript (bản ghi hội thoại), rồi trả có/không kèm lý do ngắn. "Không" thì lý do đó được đưa ngược vô lượt kế của Claude.

Hai chuyện nên biết trước khi dựa vô cái này cho việc gì không có người canh:

- **Không có turn cap hay time cap tích hợp sẵn.** Ví dụ trong docs — `/goal get the homepage Lighthouse score to 90 or above, stop after 5 tries` — chạy được là vì _chính bạn_ viết "stop after 5 tries" vô câu điều kiện. Có một cầu dao cứng khoảng 500 lần Stop-hook tiếp tục để chặn chạy vô hạn, nhưng đó là lưới an toàn cuối cùng, không phải cái nút bạn chỉnh được. Không viết cap vô điều kiện thì coi như không có cap.
- **Evaluator chỉ thấy transcript — không tool, không đụng được file.** Nó đang chấm cái Claude _nói_ là đã xảy ra, chứ không tự kiểm tra xem thiệt sự có xảy ra không. Điều kiện của bạn là "build pass" thì phải viết sao cho Claude buộc phải dán exit code hay output test thiệt vô hội thoại — không thì evaluator đang chấm một lời khẳng định, không phải một sự thiệt. Điều kiện giới hạn 4.000 ký tự, và hướng dẫn chính thức của Anthropic là nó phải xác định (deterministic): một trạng thái kết thúc đo được, một phép kiểm Claude chứng minh được qua output, các bất biến (invariant) rõ ràng không được đổi dọc đường.

## `/loop`: nó là một Skill, và chết theo session của bạn

`/loop` chạy lại một prompt trong khi session còn mở — hoặc theo nhịp cố định (`/loop 5m check my PR...`), hoặc — bỏ interval — tự định nhịp: Claude tự chọn độ trễ mỗi vòng (1 phút tới 1 giờ) qua tool `ScheduleWakeup`, dựa trên cái nó quan sát được, và có thể tự dừng loop bằng cách gọi tool đó với `stop: true`.

Chi tiết quan trọng về mặt vận hành: **`/loop` chạy local và gắn theo session.** Đóng terminal, đóng laptop, kết thúc session — loop dừng. Có một lưới an toàn (một vòng quên reschedule hay dừng thì Claude Code tự đặt một wakeup dự phòng khoảng 20 phút sau), nhưng không có tính bền (persistence) qua một session đã đóng. Cần loop sống sót qua việc bạn đóng laptop thì `/loop` là sai công cụ — đó là việc của `/schedule`.

## `/schedule`: thiệt sự bền trên cloud, nhưng còn gắn nhãn research preview

`/schedule` đưa cùng ý tưởng đó lên hạ tầng cloud do Anthropic quản lý, dưới dạng một "routine" (thói quen) — cấu hình bằng hội thoại, không cần file config. Cái đổi lấy so với `/loop`: routine sống sót qua việc bạn tắt laptop và chạy **không một permission prompt (hộp thoại xin quyền) nào** — một mô hình tin cậy khác hẳn. Ba cơ chế lên lịch khác nhau rõ rệt ở chỗ này:

| Cơ chế                      | Permission prompt                    |
| --------------------------- | ------------------------------------ |
| Cloud routine (`/schedule`) | Không có — chạy hoàn toàn tự động    |
| Desktop scheduled task      | Cấu hình được theo từng task         |
| `/loop`                     | Kế thừa setting của session hiện tại |

Một chi tiết về an toàn đáng biết: kể từ Claude Code v2.1.196, một lần `/loop` chạy theo lịch chỉ tự thực thi skill hay lệnh mà Claude vốn đã được phép gọi mà không cần giám sát — cái nào bị chặn bởi `disable-model-invocation`, luật deny của `skillOverrides`, hay lệnh built-in như `/permissions` thì tới nơi dưới dạng văn bản trơ thay vì chạy. Một lần chạy theo lịch không thể tự leo thang quyền cho chính nó.

Lưu ý mang theo suốt: `/schedule` — và tính năng agent teams riêng, opt-in — được chính Anthropic gắn nhãn **research preview / experimental**. Coi cơ chế cụ thể và các mốc version là đúng tại thời điểm snapshot này, không phải một API ổn định để xây cả một quy trình nghiệp vụ lên mà không kiểm lại.

## Dynamic workflows: harness không tốn gì, giám khảo cần context riêng

Dynamic workflows (workflow động) cho Claude tự viết script điều phối — một file JS với các hàm để spawn và điều phối subagent — ngay tại chỗ. Bản thân code điều phối **không tốn token model**; chỉ việc của các agent được spawn mới tốn. Script định tuyến được từng subagent sang model khác nhau và tuỳ chọn chạy trong git worktree cô lập, nên bạn migrate được mỗi component trong một bản copy riêng không đụng nhau, hay thử ba hướng sửa bug cạnh tranh song song.

Mẫu (pattern) đáng "chôm" cho bất kỳ việc điều phối nào bạn tự xây: cả dynamic workflows lẫn tính năng agent teams thử nghiệm đều ghi cùng một cách chống **self-preferential bias** (thiên vị-tự-tin-vô-kết-quả-của-chính-mình) — một model có xu hướng thiên vị kết quả cũ của chính nó khi bên tạo và bên chấm dùng chung context. Cách chữa nằm ở cấu trúc, không phải ở mẹo viết prompt: chạy giám khảo như một _agent spawn riêng, ở cửa sổ context tách biệt_, chấm output của bên tạo theo rubric. Docs của agent teams mở rộng điều này cụ thể sang debug: nhiều teammate độc lập điều tra và chủ động tìm cách bác bỏ giả thuyết của nhau hội tụ về nguyên nhân gốc thiệt nhanh hơn một agent neo (anchor) vô giả thuyết đầu tiên nó nghĩ ra.

Với việc chạy không giám sát, xử lý quyền tập trung ở lead, không phân tán — và có một chi tiết quan trọng nếu bạn nối nhiều agent lại: **classifier của auto mode coi một "sự phê duyệt" được chuyển tiếp từ agent này qua agent khác là input không đáng tin, không bao giờ là sự đồng ý của người dùng.** Một agent không thể thay mặt bạn bảo lãnh cho agent khác.

## Verification skill: không đến từ bài viết loops, mà từ docs viết skill

Bài viết gốc chỉ lướt qua ý "mã hoá cái gì là tốt bằng skill" — nhưng hướng dẫn cụ thể qua được vòng verify lại nằm ở tài liệu best-practices viết skill riêng của Anthropic: mẫu **plan-validate-execute** (viết plan có cấu trúc trước, một script validate nó, rồi mới thực thi), một vòng **"chạy validator → sửa lỗi → lặp lại"** tường minh, và ưu tiên script xác định (deterministic) hơn code Claude tự sinh — vì mã nguồn của script không bao giờ nạp vô context, chỉ output mới tốn token.

Có một claim cụ thể từ bài viết gốc đáng nêu tên riêng, vì nó nghe hợp lý tới mức dễ bị coi là chân lý luôn: gợi ý rằng verification skill nên bắt buộc dùng browser-automation chụp/so ảnh và audit Core Web Vitals qua Chrome DevTools MCP **đã không qua được vòng verify đối kháng** — bị bác bỏ 0-3. Không phải "test bằng browser là sai" — mà là chính cái toa thuốc cụ thể này không phải best practice đã được xác nhận chính thức, khác với plan-validate-execute. Viết verification skill thì đặt nền trên mẫu validator-loop và hai skill đóng gói sẵn `/run`/`/verify`, đừng đặt nền trên đúng cái công thức đó.

## Bắt đầu, mà đừng xây quá tay

Không phải việc nào cũng cần loop — bắt đầu bằng một prompt một lượt bình thường, chỉ cần tới mấy cái này khi bạn gọi tên được cái mình đang giao lại:

- **Viết được bước kiểm tra chưa?** → một verification skill, vẫn là turn-based.
- **Biết rõ "xong" trông ra sao, chính xác chưa?** → `/goal`, nhớ viết cap vô câu điều kiện.
- **Việc có tới theo lịch, và cần sống sót qua việc bạn đóng laptop không?** → `/schedule`; không thì `/loop` là đủ.
- **Việc lặp lại, đã định nghĩa rõ, và cần điều tra song song hay một ý kiến thứ hai?** → dynamic workflows, giám khảo đặt ở context riêng.

Chọn cơ chế nhỏ nhất khớp với cái bạn thiệt sự đang giao lại, chạy nó, coi chỗ nào nó khựng lại hay làm quá tay, rồi mới tính tới cái lớn hơn.
