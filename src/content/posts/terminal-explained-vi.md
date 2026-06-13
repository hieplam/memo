---
title: 'Terminal là gì? (và "hardware terminal", emulator, PTY)'
description: "Bài giải thích bằng ngôn ngữ đời thường, đi từ thiết bị vật lý đến ý niệm trừu tượng, trả lời câu hỏi bàn phím và màn hình của bạn ngày nay có phải là terminal không."
pubDatetime: 2026-05-30T00:00:00Z
tags:
  - terminal
  - explainer
  - vietnamese
---

> Bài giải thích bằng ngôn ngữ đời thường, đi từ thiết bị vật lý đến ý niệm trừu
> tượng, và trả lời câu hỏi: *bàn phím + màn hình của tôi ngày nay có phải là
> terminal không?*
>
> Đi kèm với bài deep-dive về PTY. Ngày: 2026-05-30

---

## 1. Terminal là "điểm cuối" nơi con người gặp máy tính

Từ này bắt nguồn từ **"terminal point"** — nghĩa đen là điểm cuối của sợi dây. Nó
là thiết bị mà một người dùng để *gửi dữ liệu vào* và *nhận kết quả ra* từ máy
tính. Gõ phím vào, chữ hiện ra. Chỉ vậy thôi.

Sự thật lịch sử quan trọng: **thời kỳ đầu, terminal KHÔNG phải là máy tính.** Máy
tính là cỗ máy to bằng cả căn phòng, rất đắt tiền. Terminal là thiết bị rẻ tiền,
riêng biệt, đặt trên bàn của bạn, nối với cái máy tính ở xa đó bằng một sợi cáp.

```
   BÀN CỦA BẠN                       PHÒNG MÁY TÍNH
 ┌──────────────┐                  ┌──────────────────┐
 │   TERMINAL   │ ───── cáp ─────► │   MÁY TÍNH        │
 │ (bàn phím +  │ ◄──── cáp ────── │ (làm việc tính    │
 │  máy in hoặc │                  │   toán thực sự)   │
 │  màn hình)   │                  └──────────────────┘
 └──────────────┘
  ngu, rẻ tiền                       thông minh, đắt tiền
```

Bản thân terminal thì "ngu" (dumb) — gần như không có bộ não. Việc duy nhất của
nó là: biến phím bạn gõ thành ký tự rồi gửi xuống dây, và nhận ký tự đi ngược lên
dây để in/hiển thị ra.

---

## 2. "Hardware terminal" là cái hộp vật lý làm việc đó

**Hardware terminal** (terminal phần cứng) là một thiết bị vật lý thật sự — một
món thiết bị thật mà bạn có thể đặt lên bàn. Có hai thế hệ:

**Teletype (TTY), khoảng 1900s–1960s** — một máy đánh chữ cơ điện. Bạn gõ, nó gửi
ký tự qua dây và *in vật lý* câu trả lời của máy tính lên một cuộn giấy. Đây chính
là nguồn gốc của chữ viết tắt **TTY** (teletypewriter — máy đánh chữ từ xa). Không
có màn hình — "lịch sử cuộn lên xuống" của bạn chính là tờ giấy chui ra từ máy.

**Video terminal / "glass TTY", từ 1970s trở đi** — ví dụ nổi tiếng là
**DEC VT100** (1978). Cùng ý tưởng, nhưng dùng màn hình CRT thay vì giấy. Một bàn
phím và màn hình chữ xanh trên nền đen gộp thành một khối, nối với máy tính bằng
**cáp serial** (RS-232). Vẫn không có sức mạnh tính toán riêng — chỉ "gửi phím,
hiện chữ".

Vậy "hardware terminal" = **cái thiết bị bàn phím-và-màn hình vật lý thật sự**,
khác với một *chương trình* giả vờ làm terminal.

---

## 3. Tại sao điều này quan trọng với PTY

Hệ điều hành được xây dựng dựa trên giả định rằng các chương trình nói chuyện với
một trong những cái hộp vật lý này qua đường truyền serial. Trình điều khiển
terminal của nhân (cái "line discipline") tồn tại để quản lý cuộc hội thoại đó —
hiển thị lại phím gõ, xử lý phím backspace, biến `Ctrl-C` thành tín hiệu (signal).

Rồi hardware terminal **biến mất**. Ngày nay không ai có một cái VT100 trên bàn
cả. Thay vào đó bạn có:

```
  THỜI TERMINAL VẬT LÝ           THỜI HIỆN ĐẠI
 ┌────────────────────┐        ┌─────────────────────────────────┐
 │  VT100 ──cáp──►     │        │  Cửa sổ terminal-emulator       │
 │  phần cứng thật     │   →    │  (một CHƯƠNG TRÌNH vẽ ra một    │
 │                     │        │   terminal giả trong cửa sổ GUI) │
 └────────────────────┘        └─────────────────────────────────┘
```

Một **terminal emulator** (iTerm, GNOME Terminal, terminal trong VS Code) là một
phần mềm *bắt chước* chiếc VT100 trong một cửa sổ — nó thậm chí vẫn nói "ngôn ngữ"
mã điều khiển của VT100 để hiển thị màu sắc và di chuyển con trỏ.

Nhưng hệ điều hành và shell của bạn vẫn mong đợi có một thiết bị terminal thật để
nói chuyện. **Khoảng trống đó chính là cái mà PTY (pseudo-terminal) lấp vào.** PTY
là đối tượng trong nhân giúp shell tin rằng nó đang được nối với một hardware
terminal, trong khi thực tế thì một *chương trình* terminal emulator đang giữ đầu
dây bên kia.

Ba ý nghĩa, xếp chồng lên nhau:

| Thuật ngữ | Nó là gì |
|---|---|
| **Terminal** (ý niệm trừu tượng) | Điểm cuối nơi con người gõ vào và đọc ra — một "hợp đồng": phím vào, chữ ra |
| **Hardware terminal** | Thiết bị *vật lý* từng thực hiện hợp đồng đó — teletype, rồi đến video terminal kiểu VT100 |
| **Terminal emulator** | Một *chương trình* bắt chước hardware terminal trong một cửa sổ |
| **PTY** | Đường ống trong nhân giúp một chương trình (emulator, SSH, tmux) đóng thế vai trò của hardware terminal nay đã không còn |

Tóm gọn một câu: **terminal là *vai trò* (điểm vào/ra của con người); hardware
terminal là *thiết bị vật lý* từng đóng vai trò đó; còn PTY là thứ giúp phần mềm
đóng vai trò đó ngày nay.**

---

## 4. Bàn phím + màn hình của tôi ngày nay có phải là terminal không?

Gần đúng về mặt ý niệm, nhưng **về mặt kỹ thuật thì KHÔNG.** Vai trò "terminal"
ngày nay đã bị tách ra và phân mảnh trong các hệ thống hiện đại.

### Cái bẫy: bàn phím + màn hình vật lý ≠ terminal

Trên chiếc VT100 ngày xưa, bàn phím và màn hình là **một khối duy nhất, tự nó là
terminal** — nó tự biến phím gõ thành ký tự gửi đi, tự nhận ký tự về và hiển thị.
Toàn bộ "logic terminal" nằm trong cái hộp đó.

Bàn phím và màn hình trên bàn bạn ngày nay thì **"câm" hơn cả VT100**. Chúng không
biết gì về ký tự, về terminal cả:

- **Bàn phím** chỉ gửi đi tín hiệu "phím số 38 vừa được nhấn xuống" qua cổng USB.
  Nó không gửi chữ "k", nó gửi một *mã quét* (scancode).
- **Màn hình** chỉ nhận một mảng điểm ảnh (pixel) qua cáp HDMI và sáng đèn lên. Nó
  không biết "chữ" là gì — nó chỉ vẽ các chấm màu.

```
  BÀN PHÍM ──scancode USB──►  ┌──────────────────────────┐
                              │      HỆ ĐIỀU HÀNH         │
                              │  (mới là nơi "terminal"   │
  MÀN HÌNH ◄──pixel HDMI───   │   thực sự sống bây giờ)   │
                              └──────────────────────────┘
```

Vậy bàn phím + màn hình vật lý ngày nay chỉ là **thiết bị nhập/xuất thô (raw
I/O)**, không phải terminal. Vai trò terminal đã chạy vào trong phần mềm rồi.

### Vậy "terminal" ngày nay nằm ở đâu?

Có hai trường hợp:

**Trường hợp 1 — Bạn mở một cửa sổ terminal trong giao diện đồ họa (thường gặp nhất)**

Khi bạn mở iTerm / GNOME Terminal / terminal trong VS Code, cái đóng vai trò
terminal là **chương trình terminal emulator đó**, chứ không phải phần cứng. Bàn
phím và màn hình vật lý chỉ là tay chân của hệ điều hành; chính chương trình
emulator mới giữ đầu dây PTY (master) và đóng vai "terminal" cho shell.

```
Bàn phím vật lý → HĐH → Cửa sổ emulator (TERMINAL thật sự ở đây) → PTY → shell
Màn hình vật lý ← HĐH ← Cửa sổ emulator ←──────────────────────── PTY ← shell
```

**Trường hợp 2 — Bạn nhấn Ctrl+Alt+F3 trên Linux, vào màn hình chữ đen toàn màn hình (không có giao diện đồ họa)**

Lúc này **không có chương trình emulator nào cả**. Chính **nhân Linux** giả lập
một terminal bằng phần mềm, gọi là **virtual console** (console ảo, ví dụ
`/dev/tty1`). Nhân đọc thẳng scancode từ bàn phím và vẽ chữ thẳng lên màn hình.

Trong trường hợp này, có thể nói **toàn bộ tổ hợp "bàn phím + màn hình + đoạn code
giả lập terminal trong nhân" mới là một terminal** — và nó gần với tinh thần
"terminal vật lý" ngày xưa nhất. Nhưng lưu ý: cái làm cho nó *thành* terminal vẫn
là phần mềm trong nhân, không phải bản thân cái bàn phím với màn hình.

### Trả lời thẳng

> Bàn phím và màn hình vật lý ngày nay có phải là terminal không?

**Không.** Tự thân chúng chỉ là thiết bị nhập/xuất thô. Cái *là* terminal là
**phần mềm** đóng vai trò đó:

- Trong giao diện đồ họa → là **chương trình terminal emulator**.
- Ngoài giao diện đồ họa (console toàn màn hình) → là **đoạn code virtual console
  trong nhân Linux**.

Bàn phím và màn hình chỉ "tham gia" vào terminal, chứ không *là* terminal.

| Thời | "Terminal" thực sự là gì |
|---|---|
| VT100 ngày xưa | Cái hộp phần cứng — bàn phím + màn hình + logic, tất cả trong một |
| Ngày nay, trong GUI | Chương trình **terminal emulator** (iTerm, v.v.) |
| Ngày nay, console đen toàn màn hình | **Virtual console** do nhân Linux giả lập bằng phần mềm |

Cách nhớ gọn: ngày xưa terminal là **đồ vật bạn chạm tay vào**; ngày nay terminal
là **phần mềm chạy bên trong máy**, còn bàn phím với màn hình chỉ là cửa ra vào
của nó.
