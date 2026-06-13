---
title: "Terminal ảo (PTYs): Tìm hiểu sâu"
description: "Tìm hiểu sâu về pseudo-terminal (terminal ảo): cặp thiết bị ảo cho phép một chương trình giả lập làm terminal bàn phím-màn hình cho một chương trình khác."
pubDatetime: 2026-05-30T00:00:00Z
tags:
  - terminal
  - pty
  - unix
  - vietnamese
---

> Báo cáo nghiên cứu được tạo thông qua quy trình làm việc phân nhánh / thu thập / xác minh đối kháng / tổng hợp
> (105 tác nhân, 23 nguồn được thu thập, 97 tuyên bố được trích xuất, 25 tuyên bố được xác minh —
> 15 được xác nhận, 10 bị bác bỏ). Các phát hiện được gắn thẻ ✅ đã được xác minh bằng máy;
> phần lịch sử (§5) được đánh dấu là kiến thức nền tảng mà quá trình xác minh đã **không thể** xác nhận.
>
> Ngày: 2026-05-30

---

## 1. Bức tranh toàn cảnh — tóm tắt nhanh

Một **pseudo-terminal** (terminal ảo) là một terminal giả lập được tạo bằng phần mềm. Nó là một cặp thiết bị ảo được kết nối với nhau, cho phép một chương trình *giả vờ làm một terminal gồm bàn phím và màn hình* đối với một chương trình khác, trong khi một chương trình thứ ba lặng lẽ ngồi ở giữa đọc và ghi lại mọi thứ.

Đó là toàn bộ thủ thuật. Một shell như `bash` được viết để giao tiếp với một terminal vật lý. Một PTY cho phép `bash` tiếp tục tin rằng nó được kết nối với phần cứng thật, trong khi thực tế "terminal" của nó chỉ là một chương trình khác — cửa sổ terminal-emulator (trình giả lập terminal) của bạn, một máy chủ SSH, hoặc `tmux`. PTY là lớp đóng giả làm cho lời nói dối này trở nên hoàn hảo.

> **Lưu ý về thuật ngữ:** các tên gọi cổ điển là **master** và **slave**. POSIX Issue 8 (2024) đã đổi tên chúng thành **manager** và **subsidiary** vì ngôn ngữ bao hàm, nhưng nhân Linux và hầu hết các trang man (hướng dẫn) vẫn sử dụng master/slave. Kiến trúc là giống hệt nhau — chỉ có từ ngữ thay đổi. Tài liệu này sử dụng master/slave để khớp với mã nguồn và tài liệu bạn sẽ gặp.

---

## 2. Trước tiên, TTY là gì? (bạn không thể hiểu PTY nếu không có nó)

"TTY" là viết tắt của **teletypewriter** — một loại máy đánh chữ điện cơ truyền qua dây dẫn từ những năm 1900. Vào những năm 1970, các máy Unix được truy cập thông qua những máy này (và sau này là "glass TTYs," tức là terminal màn hình) qua cáp nối tiếp. Vì vậy trong Unix, **"tty" trở thành từ chung để chỉ "thiết bị terminal mà một chương trình được gắn vào."**

Phần nhân (kernel) quản lý một terminal có ba lớp:

```text
   phần cứng / cáp             nhân (kernel)                  chương trình
 ┌────────────────────┐   ┌──────────────────────┐      ┌───────────────────┐
 │ cổng serial / UART │ → │ Trình điều khiển TTY │      │  shell, vim, v.v. │
 │ (terminal thật)    │   │   ↕                  │ ←──→ │  đọc/ghi vào fd   │
 └────────────────────┘   │ LINE DISCIPLINE      │      └───────────────────┘
                          │ (logic chế độ cooked)│
                          └──────────────────────┘
```

Lớp ở giữa, **line discipline** (kỷ luật đường truyền), là lớp quan trọng.
✅ *(Đã xác minh, tài liệu kernel)* Nó "xử lý tất cả các ký tự đến và đi từ/đến một thiết bị tty." Cụ thể, nó làm những việc mà bạn coi là hiển nhiên tại dấu nhắc shell:

- **Chỉnh sửa dòng** — phím backspace xóa một ký tự trước khi chương trình kịp nhìn thấy dòng đó ("chế độ cooked").
- **Phản hồi (Echo)** — những gì bạn gõ sẽ xuất hiện trên màn hình.
- **Tạo tín hiệu** — `Ctrl-C` trở thành SIGINT gửi đến chương trình chạy ở foreground (tiền cảnh), `Ctrl-Z` thành SIGTSTP.
- **Dịch (Translation)** — ví dụ: ánh xạ giữa carriage-return (xuống dòng) ↔ newline (dòng mới).

Một chương trình có thể chuyển line discipline sang **chế độ raw (thô)** (như vim, less, dấu nhắc mật khẩu) để tự xử lý các thao tác gõ phím.

**Vì vậy: TTY là khái niệm rộng hơn — hệ thống con terminal của kernel.** Một PTY là một *loại TTY cụ thể* mà "phần cứng" của nó được thay thế bằng phần mềm.

> ⚠️ **Bị bác bỏ (0–3):** tuyên bố gọn gàng rằng "TTY = terminal vật lý + PTY như hai danh mục con." Đó là một sự đơn giản hóa hữu ích cho việc giảng dạy, nhưng kernel không chia thế giới một cách rõ ràng như vậy — một PTY *là* một thiết bị tty tình cờ được hỗ trợ bởi một trình điều khiển phần mềm, chứ không phải là một danh mục anh em riêng biệt. Hãy coi sự phân chia TTY/PTY là "khái niệm chung so với phiên bản được hỗ trợ bằng phần mềm", chứ không phải là một hệ thống phân loại nghiêm ngặt.

---

## 3. PTY thực sự là gì (phần cốt lõi đã xác minh)

✅ *(Đã xác minh, trang man pty(7) + HandWiki, bình chọn 3–0)*

Một PTY là **một cặp thiết bị ký tự ảo cung cấp một kênh hai chiều**:

```text
                       CẶP PTY (một đối tượng kernel, hai đầu)

  trình giả lập terminal /   ┌──────────────────────────┐        shell / vim /
  máy chủ ssh / tmux         │                          │        bộ kiểm thử
        │                    │   ┌─────┐      ┌──────┐  │              │
        │   ghi phím gõ      │   │     │ ldisc│      │  │    đọc giống │
        └───────────────────►│ M │◄───►│ slave│◄─────┼──┤ một tty thật │
        ◄────────────────────│ A │     │ (pts)│      │  │              │
         đầu ra chương trình │ S │     └──────┘      │  │              │
                             │ T │                   │  │              │
                             │ E │                   │  │              │
                             │ R │                   │  │              │
                             └───┴───────────────────┘  │
                            /dev/ptmx              /dev/pts/N
```

- **Đầu slave** hoạt động *chính xác như một terminal cổ điển*. Shell mở `/dev/pts/N`, nhận được tất cả những thứ hữu ích của line-discipline (chế độ cooked, tín hiệu, kích thước cửa sổ) mà không hề hay biết gì.
- **Đầu master** là người giật dây. Bất cứ thứ gì master *ghi* sẽ đến slave như thể được gõ trên bàn phím; bất cứ thứ gì chương trình slave *in ra* sẽ quay trở lại từ master để được hiển thị hoặc chuyển tiếp.

Vì vậy, khi bạn gõ `ls` trong cửa sổ terminal của mình:

1. Trình giả lập (master) ghi `l`, `s`, `\r` vào `/dev/ptmx`.
2. Line discipline sẽ xử lý nó, phản hồi (echo) nó và giao dòng đó cho shell trên `/dev/pts/N`.
3. Shell chạy `ls`, in đầu ra tới `/dev/pts/N`.
4. Đầu ra đó chảy ngược ra qua master, và trình giả lập vẽ nó lên màn hình của bạn.

> ⚠️ **Sắc thái bị bác bỏ (1–2):** tuyên bố rằng "master có thể trực tiếp tạo SIGINT cho nhóm tiến trình foreground của slave." Thực tế tinh tế hơn — các tín hiệu đến từ **line discipline** diễn dịch các ký tự điều khiển (master ghi `\x03`, ldisc biến nó thành SIGINT), chứ không phải từ việc master "gửi tín hiệu" trực tiếp.

**Thực tế ở cấp độ trình điều khiển** ✅ *(Đã xác minh, tty_internals của kernel, bình chọn 3–0):* Trình điều khiển PTY cần *xử lý đặc biệt* bên trong kernel, khác với trình điều khiển TTY thông thường — chúng không phân bổ các mảng cổng thông thường, chúng áp dụng một thiết lập lại termios đặc biệt ở lần mở đầu tiên và chúng từ chối cho phép master được mở lại (trả về `-EIO`). Một PTY từ bên ngoài chỉ *trông giống* như phần cứng terminal thông thường.

---

## 4. Các API — cách bạn thực sự tạo ra một PTY

Có hai lớp: **trình tự POSIX (Unix98) di động**, và **các wrapper tiện ích BSD** dùng để ẩn đi trình tự đó.

### 4a. Trình tự POSIX / Unix98 chuẩn ✅ *(Đã xác minh 3–0)*

```c
int master = posix_openpt(O_RDWR | O_NOCTTY); // mở một master chưa sử dụng (/dev/ptmx)
grantpt(master);                              // thiết lập quyền sở hữu/truy cập cho slave
unlockpt(master);                             // mở khóa slave để nó có thể được mở
char *slave_name = ptsname(master);           // lấy đường dẫn của slave, vd: /dev/pts/3
int slave = open(slave_name, O_RDWR);         // mở đầu slave
```

| Lời gọi | Chức năng | Chi tiết đã xác minh |
|---|---|---|
| `posix_openpt()` | Mở một thiết bị master chưa sử dụng, trả về một fd. Bản triển khai tham chiếu thực chất chính là `open("/dev/ptmx", flags)`. | ✅ 3–0 |
| `grantpt()` | Đặt **chủ sở hữu (owner) = UID thực của bạn** cho slave, nhóm = không chỉ định (ví dụ: `tty`), **chế độ = 0620** (`crw--w----`). | ✅ 3–0 |
| `unlockpt()` | Xóa khóa nội bộ để slave có thể được mở. | ✅ (trình tự 3–0) |
| `ptsname()` | Trả về tên đường dẫn của thiết bị slave. | ✅ |

✅ *(Đã xác minh 3–0)* **Tên đường dẫn slave chỉ tồn tại trong khi master đang mở** — đóng master lại và node slave sẽ biến mất. Đây là sự đảm bảo về vòng đời, không phải là quy ước.

**Chú thích lịch sử** ✅ *(Đã xác minh 3–0):* `grantpt()` từng dùng để chạy một tệp nhị phân trợ giúp set-user-ID có tên là **`pt_chown`** để khắc phục các quyền của slave (vì người dùng bình thường không thể dùng `chown` với một thiết bị). glibc đã mang theo tệp này cho đến **phiên bản 2.33**, khi nó bị **loại bỏ** — trên Linux hiện đại, kernel thiết lập quyền vào thời điểm phân bổ, do đó `grantpt()` thực sự không thực hiện **hoạt động nào (no-op)**. Nhưng mã di động *vẫn phải gọi nó*, bởi vì các Unix khác (Solaris, dòng BSD) có thể vẫn cần đến nó.

> ⚠️ Ba tuyên bố về chi tiết POSIX đã **bị bác bỏ (0–3)** — những sửa chữa hữu ích:
> - `posix_openpt()` **không** chỉ chấp nhận "chỉ O_RDWR và O_NOCTTY." Các cờ khác vẫn tồn tại/được cho phép.
> - Sẽ **không** chính xác nếu nói posix_openpt + grantpt + unlockpt + ptsname là "toàn bộ API PTY được tiêu chuẩn hóa" — nói như vậy là phóng đại.
> - Thiết lập controlling-terminal (terminal điều khiển) **không** phải là một công thức cố định `TIOCNOTTY → setsid → TIOCSCTTY` duy nhất; nó tùy thuộc vào từng tình huống hơn.

### 4b. Các wrapper tiện ích BSD ✅ *(Đã xác minh 3–0)*

Hầu như không ai tự viết điệu nhảy năm bước này. Họ sử dụng:

- **`openpty()`** — thực hiện toàn bộ việc phân bổ và trả về cho bạn **hai file descriptor riêng biệt**, một master và một slave, trong một lời gọi duy nhất.
- **`forkpty()`** — kết hợp `openpty()` + `fork()` + `login_tty()`: nó phân bổ một PTY, fork một tiến trình con, và gắn tiến trình con vào slave làm controlling terminal của nó. Đây là cách trình giả lập terminal sinh ra shell của bạn chỉ trong một lần.
- **`login_tty()`** — lớp keo dán biến slave thành *controlling terminal* của tiến trình con. ✅ *(Đã xác minh 3–0)* Nó thực hiện chính xác bốn bước trên fd của slave:
  1. `setsid()` — bắt đầu một phiên (session) mới,
  2. biến fd thành controlling terminal của phiên đó,
  3. `dup` nó lên stdin/stdout/stderr,
  4. đóng fd ban đầu.

Điều này có thể được xác minh trong mã thực: `sshpty.c` của OpenSSH gọi `openpty(&ptyfd, &ttyfd, ...)` để lấy hai fd của nó.

> ⚠️ **Bị bác bỏ (0–3):** tuyên bố rằng "`openpty()` được triển khai nguyên văn nội bộ là posix_openpt→grantpt→unlockpt→ptsname" — một chi tiết triển khai nghe có vẻ hợp lý nhưng chưa được xác minh; thực tế việc triển khai khác nhau tùy theo libc.

### 4c. Kích thước cửa sổ — ioctl duy nhất mà mọi người đều sử dụng

Khi bạn thay đổi kích thước cửa sổ terminal của mình, trình giả lập sẽ phát ra một ioctl `TIOCSWINSZ` mang theo một `struct winsize` (hàng, cột, pixel). Kernel sau đó gửi **SIGWINCH** đến chương trình foreground để vim/tmux có thể vẽ lại màn hình.

> ⚠️ **Bị bác bỏ (0–3):** tuyên bố quá cụ thể rằng `TIOCSWINSZ` được áp dụng "trên fd của master, không bao giờ ở bất kỳ nơi nào khác." Trên thực tế, phía mà nó được thiết lập linh hoạt hơn so với cách diễn đạt tuyệt đối đó.

---

## 5. Lịch sử và quá trình phát triển

> **⚠️ Dấu hiệu trung thực:** đây là phần duy nhất mà quá trình xác minh còn mỏng. Hai tuyên bố lịch sử cụ thể đã bị **bác bỏ** rõ ràng (nguồn gốc "DEC PDP-6 năm 1967" và "Unix Phiên bản thứ tám năm 1983" đều thất bại, 1–2), và *không có tuyên bố nào được xác minh còn tồn tại* bao trùm dòng thời gian BSD → System V → Unix98 → devpts. Quy trình làm việc đã gắn cờ phần lịch sử là **về cơ bản chưa được trả lời**. Những gì tiếp theo là lời giải thích tiêu chuẩn, được ghi chép rộng rãi từ kiến thức nền tảng — **hãy coi nó là truyền thuyết đã được thiết lập tốt, không phải là kiến thức đã được xác minh bằng máy.**

Quá trình phát triển, về cơ bản:

```text
1870s   Teletype vật lý (TTY) — máy đánh chữ qua dây dẫn
  │
1960s-70s  Unix sơ khai: terminal nối tiếp qua UART; kernel phát triển trình
  │        điều khiển tty + line discipline để quản lý chúng
  │
~đầu      Các PTY xuất hiện để phần mềm có thể cung cấp giao diện terminal cho một
1980s     chương trình mà không cần phần cứng thực phía sau (mạng sơ khai,
  │        hệ thống cửa sổ, ghi lại "script", đăng nhập từ xa)
  │
  ├── Thiết bị pty BSD: CẶP node thiết bị được tạo sẵn tĩnh có tên
  │     /dev/ptyXY (master) ↔ /dev/ttyXY (slave). Bạn sẽ quét pool
  │     để tìm cặp trống. Đơn giản, nhưng có giới hạn trần cố định và dễ xung đột.
  │
  ├── System V / STREAMS ptmx: mô hình theo yêu cầu, sạch hơn. Mở "pty
  │     multiplexer" duy nhất /dev/ptmx → kernel cung cấp cho bạn một master
  │     mới và tự động tạo slave tương ứng dưới /dev/pts/. Không có pool
  │     tạo sẵn, không cần quét. Các slave được xây dựng như một ngăn xếp STREAMS.
  │
1998  Unix98 PTYs (Single UNIX Specification v2): tiêu chuẩn hóa chính xác mô
  │     hình /dev/ptmx + /dev/pts/N và API posix_openpt/grantpt/
  │     unlockpt/ptsname. Đây là lý do tại sao API ở trên là "API Unix98."
  │
  └── Linux devpts: hệ thống tệp ảo chuyên dụng được mount tại /dev/pts
        triển khai mô hình Unix98 — mở /dev/ptmx, lấy fd của master,
        slave xuất hiện dưới dạng /dev/pts/N. Sau này có tính năng không gian
        tên (namespacing) cho từng container nên mỗi mount namespace có hệ thống số pts riêng.
```

Điểm xuyên suốt: **các cặp được tạo sẵn tĩnh (BSD)** → **được phân bổ động theo yêu cầu (System V ptmx)** → **được tiêu chuẩn hóa (Unix98)** → **được hỗ trợ bởi hệ thống tệp và nhận biết không gian tên (Linux devpts)**.

---

## 6. Tại sao PTY tồn tại — những vấn đề chúng giải quyết

PTY là nền tảng nguyên thủy duy nhất đằng sau một lượng lớn cơ sở hạ tầng hàng ngày đến mức đáng ngạc nhiên:

- **Trình giả lập terminal** (GNOME Terminal, iTerm, Alacritty, terminal của VS Code). Không có cáp nối tiếp nào đến GPU của bạn. Trình giả lập sở hữu master, chạy shell của bạn trên slave qua `forkpty()`, và dịch giữa các byte với pixel/các phím bấm.
- **Đăng nhập từ xa — SSH / Telnet.** Shell từ xa cần một terminal, nhưng nó nằm trên một máy khác không có console vật lý. ✅ `sshpty.c` của OpenSSH được trích dẫn phân bổ một PTY để `bash` từ xa của bạn nhận được một controlling terminal phù hợp — đó là thứ cho phép `Ctrl-C`, kiểm soát tác vụ, và các ứng dụng toàn màn hình hoạt động qua SSH.
- **Bộ ghép kênh terminal — tmux / screen.** Mỗi khung (pane)/cửa sổ là một PTY riêng biệt có master do tmux sở hữu. tmux ghép nhiều shell gắn với slave vào một terminal thực duy nhất, và có thể tách (giữ các slave tồn tại mà không có master nào được gắn vào) và gắn lại sau đó.
- **Tự động hóa — Expect / pexpect.** Nhiều chương trình hoạt động khác đi khi chúng phát hiện ra rằng chúng *không* nói chuyện với một terminal (ví dụ: dấu nhắc mật khẩu `ssh`/`sudo` đọc thẳng từ tty, không phải stdin). ✅ `pexpect` được trích dẫn điều khiển các chương trình như vậy bằng cách đặt một PTY giữa chính nó và mục tiêu, để chương trình nghĩ rằng một con người đang ở terminal. Đây cũng là lý do tại sao các công cụ CI phân bổ một PTY để nhận đầu ra có màu và thanh tiến trình.
- **Container.** `docker run -t` phân bổ một PTY để tiến trình trong container có được một interactive terminal; nếu không có `-t`, sẽ không có tty và các chương trình quay trở lại hành vi non-interactive (không tương tác). Namespacing của Linux devpts cung cấp cho mỗi container một thư mục `/dev/pts` riêng tư.
- **`script` / ghi lại phiên, bảng điều khiển IDE, giả lập serial-console** — tất cả đều có chung một kiểu mẫu.

Nhu cầu thống nhất: **một chương trình khăng khăng đòi một terminal, nhưng không có terminal phần cứng nào tồn tại (hoặc bạn muốn lập trình đứng giữa chương trình và terminal của nó).** PTY luôn là câu trả lời trong mọi trường hợp.

---

## 7. TTY so với PTY — tóm tắt ngắn gọn

| | TTY (chung) | PTY (ảo) |
|---|---|---|
| Nền tảng | Hệ thống con terminal của kernel; theo truyền thống là phần cứng thật (nối tiếp, console) | Thuần phần mềm — một cặp thiết bị master/slave |
| Đầu "Phần cứng" | Một UART / console vật lý | Một chương trình giữ fd của **master** |
| Đầu hướng tới chương trình | Thiết bị terminal | **Slave** (`/dev/pts/N`), không thể phân biệt được đối với chương trình |
| Line discipline | Có | Có — đó là toàn bộ mục đích của việc đóng giả |
| Ví dụ | `/dev/ttyS0` (nối tiếp), `/dev/tty1` (console) | `/dev/pts/3` phía sau cửa sổ terminal, phiên SSH, khung tmux của bạn |

Mô hình tư duy: **TTY là hợp đồng giao diện; PTY là phần mềm triển khai hợp đồng đó với một chương trình khác đóng vai trò thay thế cho phần cứng.**

---

## 8. Những câu hỏi mở (những lỗ hổng trung thực)

Quy trình làm việc rõ ràng đã để lại những điều chưa được giải quyết này — những hướng đi tiếp theo tốt nếu bạn muốn tìm hiểu sâu hơn:

1. **Lịch sử ngày tháng chính xác** của pty BSD → STREAMS ptmx của System V → Unix98 → devpts (lần chạy này không thể xác minh ngày/nguồn gốc cụ thể).
2. Liệu điểm cuối của master có **bỏ qua line discipline không**, hay dữ liệu đi qua nó trước khi master thực hiện `read()`? (Sự bất đối xứng giữa hai đầu thực sự rất tinh tế.)
3. Những **ioctl nào ngoài TIOCSWINSZ** quan trọng trong thực tế (TIOCSCTTY, TIOCGPGRP/TIOCSPGRP) và mỗi cái áp dụng cho bên nào — master hay slave.
4. Cách **Linux devpts giải phóng nội bộ** dentry của slave khi fd của master đóng lại.

---

## Phụ lục A — Các phát hiện đã xác nhận (đã xác minh ✅)

1. **PTY = cặp thiết bị ký tự ảo master/slave.** Master được kiểm soát bởi trình giả lập/máy chủ đăng nhập; slave mô phỏng một cổng nối tiếp phần cứng và được shell sử dụng. *(3–0)*
2. **Line discipline là lớp trung gian; trình điều khiển PTY cần xử lý kernel đặc biệt lúc khởi tạo.** *(ldisc 2–1, xử lý đặc biệt 3–0)*
3. **Trình tự phân bổ chuẩn** `posix_openpt → grantpt → unlockpt → ptsname → open(slave)`; tên đường dẫn slave chỉ tồn tại khi master đang mở. *(trình tự 3–0, vòng đời slave 2–1)*
4. **`grantpt()` đặt owner của slave = UID thực, group = không chỉ định, mode = 0620; sử dụng `pt_chown` trong lịch sử, đã bị xóa trong glibc 2.33, là no-op trên Linux hiện đại; tuân thủ POSIX.1.** *(3–0)*
5. **Các wrapper BSD:** `openpty()` trả về hai fd; `forkpty()` = openpty + fork + login_tty; `login_tty()` thực hiện setsid → đặt controlling tty → dup vào stdio → close. *(3–0)*

## Phụ lục B — Các tuyên bố bị bác bỏ (bị loại bỏ bởi quá trình xác minh)

| Tuyên bố | Bình chọn |
|---|---|
| "TTY = terminal vật lý + PTY như hai danh mục con rõ ràng" | 0–3 |
| "posix_openpt() chỉ chấp nhận O_RDWR và O_NOCTTY" | 0–3 |
| "posix_openpt + grantpt + ptsname + unlockpt = toàn bộ API được tiêu chuẩn hóa" | 0–3 |
| "Master có thể trực tiếp tạo SIGINT cho nhóm foreground của slave" | 1–2 |
| "openpty() được triển khai nội bộ dưới dạng posix_openpt→grantpt→unlockpt→ptsname" | 0–3 |
| "Thiết lập controlling-terminal là một trình tự TIOCNOTTY→setsid→TIOCSCTTY cố định" | 0–3 |
| "TIOCSWINSZ áp dụng cho fd của master, không bao giờ ở bất kỳ nơi nào khác" | 0–3 |
| Danh sách trường `tty_struct` cụ thể | 1–2 |
| "Line discipline được đính kèm với refcount 1, bị khóa trong quá trình đọc+ghi" | 0–3 |
| "PTY bắt nguồn từ máy DEC PDP-6 năm 1967 / PTY hiện đại từ Unix Phiên bản thứ tám năm 1983" | 1–2 |

## Phụ lục C — Nguồn tài liệu

**Sơ cấp (độ tin cậy cao nhất):**

- pty(7) — <https://www.man7.org/linux/man-pages/man7/pty.7.html>
- posix_openpt(3) — <https://www.man7.org/linux/man-pages/man3/posix_openpt.3.html>
- grantpt(3) — <https://man7.org/linux/man-pages/man3/grantpt.3.html>
- POSIX posix_openpt — <https://pubs.opengroup.org/onlinepubs/009695099/functions/posix_openpt.html>
- Linux kernel — TTY line discipline — <https://docs.kernel.org/driver-api/tty/tty_ldisc.html>
- Linux kernel — TTY internals — <https://docs.kernel.org/driver-api/tty/tty_internals.html>
- Oracle forkpty(3C) — <https://docs.oracle.com/cd/E88353_01/html/E37843/forkpty-3c.html>
- OpenSSH sshpty.c — <https://github.com/openssh/openssh-portable/blob/master/sshpty.c>

**Thứ cấp:**

- Wikipedia: Pseudoterminal — <https://en.wikipedia.org/wiki/Pseudoterminal>
- HandWiki: Pseudoterminal — <https://handwiki.org/wiki/Software:Pseudoterminal>
- pexpect — <https://github.com/pexpect/pexpect>

**Nền tảng / blog của người thực hành:**

- Linus Åkesson — "The TTY demystified" — <https://www.linusakesson.net/programming/tty/>
- computer.rip — "A History of the TTY" — <https://computer.rip/2024-02-25-a-history-of-the-tty.html>
- poor.dev — "Terminal anatomy" — <https://poor.dev/blog/terminal-anatomy/>
- uninformativ.de — writing a terminal — <https://www.uninformativ.de/blog/postings/2018-02-24/0/POSTING-en.html>
- dev.to/napicella — Linux terminals: tty, pty, shell — <https://dev.to/napicella/linux-terminals-tty-pty-and-shell-192e>

---

## Thống kê nghiên cứu

- Các góc độ tìm kiếm: 5
- Nguồn đã thu thập: 23 (đã xóa 5 URL trùng lặp)
- Tuyên bố đã trích xuất: 97
- Tuyên bố đã xác minh: 25 → **15 được xác nhận, 10 bị loại bỏ**
- Các phát hiện sau khi tổng hợp: 5
- Lời gọi tác nhân: 105
