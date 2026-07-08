---
title: "/loop với /schedule trong Claude Code: cùng ý tưởng, hai cỗ máy khác hẳn nhau"
description: "/loop với /schedule đều lặp lại một prompt, nhưng tụi nó không phải hai nấc của cùng một cái nút vặn. /loop là cron chạy local, gắn chặt vô session đang sống; /schedule là job cloud biệt lập. Lộn giả định của hai cái là y chang cách tui tạo ra một cron tự nhân bản mỗi 30 phút — bug tui gặp và sửa ngay tại trận."
pubDatetime: 2026-07-08T02:00:00Z
lang: "vi"
tags:
  - claude-code
  - ai-agents
  - loops
  - automation
  - cron
  - vietnamese
multiLangKey: "claude-code-loop-vs-schedule"
---

Tui đang canh một workflow Claude Code chạy dài — mười cái improvement card, mỗi cái được implement, rồi ba lens độc lập review kiểu adversarial, xong mới merge, từng cái một. Nó cứ chết giữa chừng, không phải vì bug mà vì đụng giới hạn token 5 tiếng của session. Dừng, resume, dừng, resume. Vậy nên tui set `/loop 30m` để nó tự resume, khỏi phải gõ "continue" hoài.

Ba mươi phút sau, một lệnh `/loop` tự nhảy ra mà tui đâu có gõ. Không phải ảo giác, cũng không phải gõ lộn phím — cái schedule tui dựng lên đang chạy đúng y như cấu hình. Chỉ có điều cấu hình đó sai, sai kiểu mà để yên là nó âm thầm nhân đôi lên mỗi nửa tiếng. Lần theo cái đó mới lòi ra cơ chế thiệt sự đằng sau `/loop` với `/schedule` — hóa ra không phải "hai tốc độ của cùng một thứ" như tui tưởng.

## Hai cái không chung một cái máy

Docs mô tả cả hai như là cách để lặp lại một prompt. Đúng ở mức ý định, và đó cũng là chỗ sự giống nhau dừng lại.

**`/loop` ở chế độ khoảng thời gian cố định chỉ là lớp wrapper mỏng bọc quanh đúng cái primitive mình có thể gọi trực tiếp: `CronCreate`.** Không có engine loop riêng nào hết — `/loop 30m <prompt>` với việc tự tay gọi `CronCreate({cron: "*/30 * * * *", prompt: ...})` là cùng một thứ bên dưới. (Chế độ _dynamic_ của `/loop`, tức không cho khoảng thời gian, thì khác — nó tự canh nhịp qua `ScheduleWakeup`, tự chọn độ trễ mỗi lần lặp.)

**`/schedule` thì không đụng gì tới cron của session hết.** Nó gọi một API khác (`RemoteTrigger`), cấp một job trên hạ tầng cloud của Anthropic — một hệ thống hoàn toàn tách biệt với bất cứ thứ gì đang chạy trên máy mình.

Cái tách biệt về cơ chế đó là lý do hai bên khác nhau ở mọi trục thực tế quan trọng:

|                                     | `/loop` (khoảng thời gian cố định)                                   | `/schedule` (routine)                                                 |
| ----------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Chạy ở đâu                          | Máy mình, bên trong session hiện tại                                 | Cloud của Anthropic — mỗi lần chạy là một session biệt lập, mới toanh |
| Sống sót khi đóng session / tắt máy | Không — chết theo session                                            | Có — chạy không người canh, vô thời hạn                               |
| Tuổi thọ                            | Tự hết hạn sau 7 ngày                                                | Chạy tới khi mình tắt hoặc xóa                                        |
| Ngữ cảnh                            | Truy cập đầy đủ session đang sống — file, tool, trạng thái đang chạy | Không có ngữ cảnh trước đó; mỗi lần bắt đầu từ git checkout sạch      |
| Khoảng thời gian tối thiểu          | 1 phút                                                               | **1 tiếng**                                                           |
| Quyền hạn                           | Kế thừa trạng thái quyền hiện tại của session                        | Tự chủ hoàn toàn, không hỏi quyền (research preview)                  |

Đọc lại bảng này theo cách lẽ ra tui phải đọc từ đầu: **`/loop` là để canh chừng cái gì đó đang diễn ra ngay trước mắt mình.** `/schedule` là cho việc phải xảy ra bất kể mình — hay cái session này — có tồn tại hay không. Hai cái không thay thế nhau được, mà chọn lộn cái nào cho việc gì là y chang cái bug tui vừa gặp.

## Cái bug: một loop tự lên lịch lại chính nó

Đây là cái tui thiệt sự đã dựng, rút gọn còn phần quan trọng:

```
CronCreate({
  cron: "*/30 * * * *",
  prompt: "/loop 30m Auto-resume the workflow...",
  recurring: true
})
```

Nghe hợp lý — cái prompt chỉ nói tui muốn làm gì mỗi 30 phút. Nhưng `/loop` là một _skill_, không phải chữ chết. Khi prompt là `/loop 30m <task>`, bắn nó ra không phải chạy `<task>` — mà là **quay lại vô skill `/loop`**, nó parse lại khoảng thời gian với prompt, rồi gọi `CronCreate` lần nữa.

Lần theo dòng thời gian: cron A bắn → tạo ra cron B → lịch của cron A vẫn còn đó → cron A bắn tiếp → tạo ra cron C → cứ vậy. Không cái nào crash. Không lỗi gì hết. Chỉ là âm thầm chất đống lịch chạy, mỗi cái giờ cũng có khả năng đẻ thêm cái khác, tới lúc — sớm muộn gì — mình có cả đống job chồng lên nhau cùng làm một việc cùng lúc.

Sửa chỉ tốn đúng một khúc hiểu biết: **prompt lưu trong cron phải là task trần trụi, không bao giờ được bọc lại trong chính lệnh gọi nó.**

```
CronCreate({
  cron: "*/30 * * * *",
  prompt: "Auto-resume watchdog for the workflow. Do NOT call /loop or CronCreate — just run the check once and end the turn.",
  recurring: true
})
```

Vẫn nhịp đó, vẫn ý định đó — nhưng giờ mỗi lần bắn là chạy task rồi dừng, chớ không kích hoạt lại cái máy đã tạo ra nó.

## Bài học rút ra

Nếu mọi người đang gắn việc lặp lại trong Claude Code, câu hỏi thiệt sự quan trọng không phải "bao lâu một lần" — mà là **"cái này có sống được khi không có mình không, và cái prompt của nó có tự biết là không được tự lên lịch lại chính nó không?"**

- Việc mình đang canh trực tiếp, gắn vô session này, cần biến mất khi mình đóng máy → `/loop`, và nhớ đảm bảo prompt lưu trong đó là task trần trụi, không phải một lệnh `/loop` khác.
- Việc phải chạy bất kể mình hay session này có tồn tại hay không, nhịp từ một tiếng trở lên → `/schedule`.

Cái lỗi tui gặp không hiện ra bằng thông báo lỗi. Nó hiện ra bằng một lệnh mình chưa từng gõ, bắn ra đúng giờ mà mình đã quên là mình đặt — và đó chính là lý do đáng để hiểu cơ chế, chớ không chỉ nhớ tên lệnh.
