---
title: "zsh startup files: Vì sao .zshrc không chặn được lệnh khi một công cụ tự động chạy nó"
description: "zsh đọc các file cấu hình khác nhau tùy loại shell — login/non-login, interactive/non-interactive. Bài viết đi qua thứ tự .zshenv → .zprofile → .zshrc → .zlogin, và giải thích vì sao một stub trong .zshrc chặn được lúc bạn gõ tay nhưng không chặn được khi một script hay công cụ tự động chạy lệnh."
pubDatetime: 2026-07-01T00:35:00Z
lang: vi
tags:
  - zsh
  - shell
  - startup-files
  - vietnamese
---

## Tóm tắt nhanh (TL;DR)

- zsh phân loại mỗi shell theo hai trục độc lập: **login/non-login** và **interactive/non-interactive**. Mỗi tổ hợp đọc một tập file cấu hình khác nhau.
- Thứ tự đọc: **`.zshenv` → `.zprofile` → `.zshrc` → `.zlogin`** (rồi `.zlogout` lúc một login shell thoát).
- **`.zshenv` luôn được đọc**, bởi mọi shell — kể cả một script chạy ngầm.
- **`.zshrc` chỉ được đọc bởi shell interactive.** Một script, `zsh -c "..."`, hay một công cụ tự động chạy lệnh thay bạn đều là _non-interactive_ → chúng **bỏ qua `.zshrc`**.
- Hệ quả: muốn một thứ áp dụng cho **cả** lệnh chạy ngầm lẫn lúc bạn gõ tay, hãy đặt nó ở **`.zshenv`**, không phải `.zshrc`.
- Function/alias **không di truyền** sang tiến trình con — muốn chặn một lệnh ở _mọi_ tiến trình, phải dùng **executable shim đặt trong `$PATH`** (xem bài viết về shim).

---

## 1. Hai trục phân loại một shell

Một shell zsh, tại bất kỳ thời điểm nào, mang hai thuộc tính độc lập với nhau.

### a) Login và non-login

- **Login shell**: shell đầu tiên được tạo ra khi bạn "đăng nhập" vào một phiên làm việc. Mở iTerm/Terminal.app theo cấu hình mặc định sẽ tạo ra một **login shell**. `zsh -l`, hay `ssh user@host`, cũng thuộc loại này.
- **Non-login**: một shell con được mở ra từ bên trong một shell đã có sẵn (gõ `zsh`), hay phần lớn các script.

### b) Interactive và non-interactive

- **Interactive**: có **người trực tiếp gõ lệnh** — có prompt, đọc bàn phím. Đó là cửa sổ iTerm bạn đang gõ. Cờ tương ứng: `zsh -i`. Kiểm tra bằng `[[ -o interactive ]]`.
- **Non-interactive**: **chạy ngầm**, không có ai gõ — thực thi một loạt lệnh rồi thoát. Bao gồm: **script** (`zsh script.zsh`), **`zsh -c "lệnh"`**, và **các công cụ tự động thực thi lệnh thay bạn** — CI, cron job, hook, hay một trợ lý AI chạy lệnh qua một shell ngầm.

Bốn tổ hợp đều có thể xảy ra trên lý thuyết, nhưng hai tổ hợp bạn gặp nhiều nhất là:

- **iTerm, lúc bạn gõ tay** = _login + interactive_
- **Script hoặc công cụ tự động** = _non-login + non-interactive_

## 2. File nào đọc khi nào?

Thứ tự đọc: `.zshenv` → (nếu là login) `.zprofile` → (nếu là interactive) `.zshrc` → (nếu là login) `.zlogin`.

| File            | Đọc bởi shell nào                                       | Dùng để làm gì                                                                         |
| --------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **`.zshenv`**   | **mọi shell** (mọi lúc, kể cả script & non-interactive) | biến môi trường cần có ở khắp nơi: `PATH` lõi, `EDITOR`…                               |
| **`.zprofile`** | chỉ shell **login** (trước `.zshrc`)                    | những việc chạy một lần lúc đăng nhập (ví dụ `brew shellenv`)                          |
| **`.zshrc`**    | chỉ shell **interactive**                               | mọi thứ phục vụ trải nghiệm gõ tay: alias, prompt, theme, plugin, function, completion |
| **`.zlogin`**   | chỉ shell **login** (sau `.zshrc`)                      | việc chạy cuối cùng khi login                                                          |
| **`.zlogout`**  | lúc một shell **login** thoát                           | dọn dẹp                                                                                |

Chiếu vào hai trường hợp thực tế:

| Trường hợp                              | login? | interactive? | Đọc `.zshenv`? | Đọc `.zshrc`? |
| --------------------------------------- | :----: | :----------: | :------------: | :-----------: |
| **iTerm, bạn gõ tay**                   |   có   |      có      |       có       |      có       |
| **Script / `zsh -c` / công cụ tự động** | không  |    không     |       có       |   **không**   |

Đây là toàn bộ câu chuyện: `.zshrc` chỉ chạy khi có người thật sự gõ lệnh. Bất cứ thứ gì chạy ngầm đều bỏ qua nó, chỉ còn `.zshenv` được đọc.

## 3. Chứng minh bằng thí nghiệm

Giả sử `.zshrc` có định nghĩa một function `node()` (một stub để nạp chậm `nvm`). Câu hỏi: cả shell interactive lẫn non-interactive có "thấy" nó không?

```bash
# A) Shell INTERACTIVE (giống lúc bạn gõ trong iTerm)
$ zsh -ic 'type node | head -1'
node is a shell function from ~/.zshrc                    # ← THẤY function

# B) Shell NON-interactive (giống một script hay công cụ tự động)
$ zsh -c 'type node | head -1'
node is ~/.nvm/.../bin/node                               # ← KHÔNG thấy: chạy binary thật
```

Cùng một `.zshrc`, cùng một stub: **(A) interactive thấy function, (B) non-interactive không thấy** — vì nó không đọc `.zshrc`.

Kiểm tra xem một shell có phải interactive hay không:

```bash
$ zsh -c '[[ -o interactive ]] && echo INTERACTIVE || echo NON-interactive'
NON-interactive

# .zshenv thì shell non-interactive VẪN đọc:
$ printf '\nexport _MARK=loaded\n' >> ~/.zshenv
$ zsh -c 'echo $_MARK'
loaded                                                     # ← .zshenv luôn chạy
```

## 4. Vì sao điều này quan trọng — một bài học thực chiến

### Tình huống: muốn chặn một lệnh mutate dữ liệu do một công cụ tự động chạy

- Một công cụ tự động (ví dụ một trợ lý AI thực thi lệnh thay bạn) chạy `sqlcmd` như một tiến trình **non-interactive** → **không đọc `.zshrc`**.
- ⇒ Đặt một function `sqlcmd()` **trong `.zshrc`** sẽ chặn được lúc **bạn gõ tay**, nhưng **không chặn được** công cụ tự động — ngược hẳn với điều bạn muốn.

### Hai cách sửa đúng

1. **Đặt ở `.zshenv`**, không phải `.zshrc` — vì `.zshenv` được đọc bởi _cả_ shell non-interactive lẫn interactive.
2. **Dùng executable shim trong `$PATH`**, không phải function — vì:
   - Function/alias **không di truyền** sang tiến trình con (`sqlcmd` chạy như một tiến trình riêng). Một function `sqlcmd()` chỉ tồn tại trong chính shell định nghĩa ra nó.
   - Một **file thực thi tên `sqlcmd`** đặt ở thư mục đứng đầu `$PATH` thì **mọi tiến trình** — bạn, script, công cụ tự động, và tiến trình con của chúng — khi tìm `sqlcmd` đều gặp nó trước tiên. (Cơ chế resolve chi tiết: xem bài viết về shim.)

Cài đặt thực tế:

```zsh
# ~/.zshenv  (đọc bởi MỌI shell, kể cả các tiến trình chạy ngầm)
export PATH="$HOME/.local/sqlcmd-guard/bin:$PATH"
```

```zsh
# ~/.zshrc  (chèn lại lần cuối, để thắng cả khi gõ tay —
#            vì .zprofile/.zshrc của login shell có thể prepend thứ khác SAU .zshenv)
export PATH="$HOME/.local/sqlcmd-guard/bin:$PATH"
```

### Một cái bẫy về thứ tự PATH cần nhớ

Với một shell **login + interactive**, thứ tự đọc là `.zshenv` → `.zprofile` → `.zshrc`. Nếu `.zshenv` prepend một thư mục X, nhưng `.zprofile` (ví dụ `eval "$(brew shellenv)"`) lại prepend `/opt/homebrew/bin` **sau đó**, thì Homebrew sẽ nhảy lên **trước** X — shim trong X thua. Cách chắc ăn: prepend X **một lần nữa ở `.zshrc`** (chạy sau `.zprofile`) cho shell interactive; còn shell non-interactive thì chỉ có `.zshenv` nên X vẫn đứng đầu, không hề bị `.zprofile` phá.

## 5. Cheat sheet

```bash
# Kiểm tra trạng thái shell hiện tại
[[ -o interactive ]] && echo interactive || echo non-interactive
[[ -o login ]]       && echo login       || echo non-login
echo $0               # -zsh = login shell; zsh = non-login

# Tạo từng loại shell để test config
zsh -c '...'    # non-login, non-interactive  (giống script / công cụ tự động)
zsh -ic '...'   # interactive                  (giống lúc bạn gõ tay)
zsh -lic '...'  # login + interactive          (giống mở iTerm)
zsh -f          # KHÔNG đọc file rc nào (NO_RCS) — debug sạch

# Đặt thứ gì ở đâu?
#   biến môi trường / PATH cần ở MỌI shell (kể cả script, công cụ tự động) -> .zshenv
#   alias, prompt, theme, function, completion (chỉ khi gõ tay)           -> .zshrc
#   chạy 1 lần lúc login (brew shellenv, ssh-agent)                       -> .zprofile
```

## 6. Liên hệ

- Cơ chế shell **resolve** một lệnh (alias > function > builtin > PATH) và cách làm **shim**: xem bài viết "Shim là gì, và vì sao Function luôn thắng Binary trong zsh".
- Ứng dụng thực tế: nạp chậm (lazy-load) `nvm` bằng function shim (đặt trong `.zshrc`), và một guard chặn lệnh mutate bằng executable shim đặt trong `$PATH` qua `.zshenv` — hai ví dụ minh họa đúng bảng ở mục 2.

---

> **Ý chính:** zsh không đọc cùng một bộ file cấu hình cho mọi shell — nó phân biệt login/non-login và interactive/non-interactive, và mỗi tổ hợp có tập file riêng. Chỉ có `.zshenv` được đọc tuyệt đối mọi lúc. Nếu bạn muốn một quy tắc áp dụng cho cả người gõ tay lẫn máy chạy ngầm, đặt nó ở `.zshenv` — và nếu muốn nó lan tới cả tiến trình con, dùng một executable shim trong `$PATH`, không phải một function.
