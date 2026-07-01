---
title: "Shim là gì, và vì sao Function luôn thắng Binary trong zsh"
description: "Khi bạn gõ một lệnh như node, zsh tìm nó theo một thứ tự ưu tiên cố định. Hiểu rõ thứ tự đó chính là chìa khóa để hiểu shim là gì, vì sao nó hoạt động, và vì sao đặt một binary lên đầu PATH không phải lúc nào cũng đủ để nó thắng."
pubDatetime: 2026-07-01T00:30:00Z
lang: vi
tags:
  - shell
  - shim
  - zsh
  - path
  - vietnamese
---

## Tóm tắt nhanh (TL;DR)

- **Shim** (miếng chêm) là một lớp đứng chen vào giữa, mang **cùng tên** với một lệnh thật, để bắt lấy lời gọi trước rồi làm gì đó — ghi log, đổi tham số, nạp chậm (lazy-load), chọn đúng phiên bản — trước khi (hoặc thay vì) chạy lệnh thật.
- Khi bạn gõ `node`, zsh tìm nó theo một thứ tự ưu tiên cố định, dừng lại ở tầng đầu tiên khớp: **reserved word → alias → function → builtin → binary trong `$PATH`**.
- Hệ quả quan trọng nhất: **function luôn thắng binary**, bất kể binary nằm ở đâu trong `$PATH`. Đặt một binary lên đầu `$PATH` chỉ giúp nó thắng **các binary khác**, chứ không thắng nổi một function cùng tên.
- Có ba nhóm cách tạo shim: **shell-level** (function, alias, `hash` override), **filesystem/PATH-level** (binary, symlink, thư mục `shims/`), và **fallback** (`command_not_found_handler`).
- Muốn xuyên qua function/alias để gọi thẳng lệnh thật: `command node`. Muốn gọi builtin thật khi nó bị function che: `builtin cd`.

---

## 1. Shim là gì?

"Shim" (miếng chêm) là một lớp mỏng đứng chen vào giữa người gọi và lệnh thật, **mang cùng tên** với lệnh thật, để giành quyền chạy trước. Một khi đã giành được quyền đó, nó có thể:

- tự làm xong việc rồi **thay thế hoàn toàn** lệnh thật, hoặc
- làm một việc gì đó — ghi log, sửa biến môi trường, nạp chậm (lazy-load), chọn đúng phiên bản — rồi **ủy quyền** xuống lệnh thật.

Vài shim quen thuộc trong đời thực:

- `nvm`, `pyenv`, `rbenv`, `asdf`, `volta` — mỗi công cụ đặt ra một loạt shim để khi bạn gõ `node`/`python`/`ruby`, nó tự chọn đúng phiên bản theo từng dự án.
- Một thư mục như `~/.local/bin/<tool>` đặt trước trong `$PATH` để ghi đè (override) công cụ hệ thống.
- Hook nạp chậm `nvm` (xem mục 5) — về bản chất là một function shim bắt lấy lần gọi đầu tiên.

Điểm mấu chốt của mọi shim: **cùng tên, và được resolve trước lệnh thật**. Muốn hiểu shim, trước hết phải hiểu shell resolve tên lệnh theo thứ tự nào.

## 2. Khi gõ `node`, shell tìm gì? Thứ tự ưu tiên trong zsh

Khi bạn gõ một lệnh không chứa dấu `/` (ví dụ `node`, khác với `./node` hay `/usr/bin/node`), zsh đi tìm theo đúng thứ tự dưới đây, và **dừng ngay** ở tầng đầu tiên khớp:

| #   | Tầng                                      | Ví dụ                                    | Ghi chú                                           |
| --- | ----------------------------------------- | ---------------------------------------- | ------------------------------------------------- |
| 1   | **Reserved word**                         | `if`, `for`, `while`, `function`, `time` | từ khóa của shell, ưu tiên cao nhất ở vị trí lệnh |
| 2   | **Alias**                                 | `alias ll='ls -la'`                      | được bung ra từ lúc _parse_ (trước khi chạy)      |
| 3   | **Function**                              | `node() { ... }`                         | **chỗ function shim sống**                        |
| 4   | **Builtin**                               | `cd`, `echo`, `type`, `hash`             | lệnh dựng sẵn (built-in) của shell                |
| 5   | **Hashed command / Binary trong `$PATH`** | `/usr/bin/node`                          | **chỗ binary shim sống**                          |

Hai điểm hay gây nhầm lẫn:

1. **Alias được xử lý ngay lúc parse**, chứ không phải lúc chạy — vì vậy nó chỉ áp dụng cho từ **đầu tiên** của lệnh, và mặc định chỉ trong shell tương tác (interactive).
2. **Function đứng trên cả builtin lẫn binary.** Đây chính là lý do bạn có thể viết `cd() { ... }` để bọc lại `cd`, hay `node() { ... }` để bọc lại `node` — function của bạn sẽ chạy, còn builtin/binary thật bị che khuất (shadowed).

### Tầng 5 — bảng hash: tối ưu tốc độ, và một cái bẫy nhỏ

zsh không quét lại `$PATH` mỗi lần bạn gõ một lệnh. Lần đầu tìm thấy `node`, nó **ghi nhớ (hash)** đường dẫn vào một bảng băm để lần sau khỏi phải quét lại. Hệ quả:

- Nếu bạn **thêm một binary `node` mới vào đầu `$PATH`** giữa chừng một phiên làm việc, zsh vẫn có thể chạy đường dẫn **cũ đã được hash**. Gõ `rehash` (hoặc mở một shell mới) để cập nhật.
- Bạn cũng có thể **ép thẳng** bảng hash: `hash node=/đường/dẫn/khác` — bỏ qua hoàn toàn việc tìm trong `$PATH`. (Đây cũng là một kiểu shim, xem mục 3.)

### Xuyên qua các tầng

| Muốn                                               | Lệnh                             | Tác dụng              |
| -------------------------------------------------- | -------------------------------- | --------------------- |
| Bỏ qua alias + function, chạy thẳng binary/builtin | `command node`                   | nhảy xuống tầng 4–5   |
| Ép gọi **builtin** thật (khi bị function che)      | `builtin cd`                     | chỉ ở tầng 4          |
| Bỏ qua **alias** cho một lần gõ                    | `\node` hoặc `'node'`            | tắt việc bung alias   |
| Xem cái nào sẽ chạy                                | `type node`                      | in ra tầng đang thắng |
| Xem **tất cả** các tầng có cùng tên                | `type -a node` / `which -a node` | liệt kê hết           |

> bash gần như hệt zsh (alias → function → builtin → `$PATH`), chỉ khác một chút ở nhóm "POSIX special builtins" và tên hook (`command_not_found_handle`, không có `r` ở cuối — trong zsh là `command_not_found_handler`).

## 3. Có bao nhiêu hướng để tạo shim?

Có thể gom thành ba nhóm, theo "shim đó sống ở đâu":

### Nhóm A — Shell-level (chỉ tồn tại trong shell hiện tại)

| Cách                | Cú pháp                            | Ưu điểm                                                                           | Nhược điểm                                                                                              |
| ------------------- | ---------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Function**        | `node() { …; command node "$@"; }` | logic tùy ý, đè được cả builtin lẫn binary, gọi lại lệnh thật dễ dàng (`command`) | chỉ có hiệu lực trong shell đó; **script/tiến trình con không hề thấy**                                 |
| **Alias**           | `alias node='…'`                   | đơn giản, ưu tiên cao nhất                                                        | chỉ thay thế văn bản, chỉ áp dụng ở đầu câu lệnh, mặc định chỉ trong shell tương tác, khó truyền `"$@"` |
| **`hash` override** | `hash node=/path`                  | ép thẳng vị trí binary, không cần sửa `$PATH`                                     | chỉ có hiệu lực trong shell đó; là ghi đè đường dẫn, không phải chèn logic                              |

### Nhóm B — Filesystem/PATH-level (mọi tiến trình đều thấy)

| Cách                            | Làm gì                                                         | Ưu điểm                                                                                  | Nhược điểm                                                                                    |
| ------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Binary/script trong `$PATH`** | một file thực thi tên `node` đặt ở thư mục nằm **đầu `$PATH`** | **mọi chương trình con & script đều dùng** (vì được resolve qua PATH)                    | thua function ngay trong shell; phải lo `rehash`; phải tự gọi lệnh thật bằng đường dẫn đầy đủ |
| **Symlink**                     | symlink `node` trỏ tới một dispatcher                          | gọn nhẹ, kiểu busybox/version-manager                                                    | như trên                                                                                      |
| **Thư mục `shims/`**            | prepend một thư mục đầy các wrapper nhỏ vào `$PATH`            | bản "công nghiệp" của hai cách trên — chính là cách **asdf/pyenv/rbenv/volta** hoạt động | cần cơ chế sinh shim + lệnh `rehash` riêng của công cụ                                        |

### Nhóm C — Fallback (chỉ chạy khi không khớp gì cả)

| Cách                                  | Cú pháp                             | Khi nào chạy                                                                  |
| ------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| **`command_not_found_handler`** (zsh) | `command_not_found_handler() { … }` | chỉ khi cả năm tầng trên đều trượt — kiểu "command not found → gợi ý cài gói" |

**Khác biệt cốt lõi để chọn nhóm:**

- Chỉ cần đổi hành vi **trong chính terminal của bạn** → dùng **function** (linh hoạt nhất).
- Cần **mọi script/chương trình con** cũng đi qua shim → dùng **binary/thư mục shim** (nhóm B), vì function và alias **không di truyền** sang tiến trình con.

## 4. Thực nghiệm: hai shim cùng tên `node` — cái nào thắng?

Phần thực nghiệm dưới đây chạy trên zsh 5.9 (macOS). Có hai shim, cùng tên `node`, được cố tình đặt cạnh nhau để xem cái nào thắng:

1. **Binary shim**: một script thực thi, đặt ở **đầu `$PATH`**.
2. **Function shim**: `node()` được định nghĩa ngay trong shell.

Binary shim (một file `bin/node` đơn giản):

```sh
#!/bin/sh
echo "[BINARY SHIM] /demo/bin/node chạy — args: $*"
```

Script demo đầy đủ:

```zsh
#!/bin/zsh
# Demo: chứng minh thứ tự ưu tiên khi shell resolve lệnh `node`.
# Có 2 shim cùng tên "node":
#   1. BINARY SHIM : demo/bin/node  (đặt ở ĐẦU $PATH)
#   2. FUNCTION SHIM: node() định nghĩa trong shell
# Câu hỏi: khi gõ `node`, cái nào chạy?

set -e
HERE="${0:A:h}"                 # thư mục chứa script này
chmod +x "$HERE/bin/node"

echo "TÌNH HUỐNG 1: chỉ có BINARY SHIM ở đầu PATH (chưa có function)"
PATH="$HERE/bin:$PATH"
type node
node hello

echo "TÌNH HUỐNG 2: thêm FUNCTION shim node() (đè lên binary shim)"
node() { echo "[FUNCTION SHIM] node() chạy — args: $*"; }
type node
node hello

echo "TÌNH HUỐNG 3: dùng \`command node\` để XUYÊN qua function"
command node hello

echo "TÌNH HUỐNG 4: gỡ function (unset -f) -> rớt lại xuống binary"
unset -f node
type node
node hello
```

Output thật khi chạy `zsh demo/run.sh`:

```
TÌNH HUỐNG 1: chỉ có BINARY SHIM ở đầu PATH (chưa có function)
> type node
node is /…/demo/bin/node
> node hello
[BINARY SHIM] /demo/bin/node chạy — args: hello

TÌNH HUỐNG 2: thêm FUNCTION shim node() (đè lên binary shim)
> type node
node is a shell function from run.sh
> node hello
[FUNCTION SHIM] node() chạy — args: hello          ← FUNCTION THẮNG

TÌNH HUỐNG 3: dùng `command node` để XUYÊN qua function
> command node hello
[BINARY SHIM] /demo/bin/node chạy — args: hello     ← bỏ qua function

TÌNH HUỐNG 4: gỡ function (unset -f) -> rớt lại xuống binary
> type node
node is /…/demo/bin/node
> node hello
[BINARY SHIM] /demo/bin/node chạy — args: hello
```

Dù binary shim nằm ở **đầu `$PATH`**, ngay khi có function `node()`, **function vẫn thắng** (tầng 3 luôn đứng trước tầng 5). Đặt một binary lên đầu `$PATH` chỉ giúp nó thắng _các binary khác_. Muốn ép xuống binary: `command node`, hoặc gỡ hẳn function bằng `unset -f node`.

### Bảng tổng kết: gõ `node` thì cái gì chạy?

| Tình huống                       | Chạy cái gì                             |
| -------------------------------- | --------------------------------------- |
| Chỉ có binary shim ở đầu `$PATH` | **Binary shim**                         |
| Chỉ có `node()` function         | **Function**                            |
| Có **cả hai**                    | **Function** (binary bị che)            |
| Gõ `command node`                | **Binary** (đầu `$PATH` là binary shim) |

Một script thứ hai, `verify-precedence.zsh`, chứng minh nốt các tầng còn lại — cũng là output thật khi chạy:

```zsh
#!/bin/zsh
# Chứng minh các tầng còn lại của thứ tự resolve + các kiểu shim khác.
# Chạy: zsh verify-precedence.zsh

echo "== 1) Function ĐÈ builtin (định nghĩa cd()) =="
cd() { echo "[func cd] chạy, KHÔNG phải builtin"; }
cd /tmp
echo "-> dùng 'builtin cd' để xuyên xuống builtin thật:"
builtin cd /tmp && echo "[builtin cd] ok, pwd=$(pwd)"
unset -f cd

echo
echo "== 2) hash ÉP vị trí binary (bỏ qua việc tìm trong PATH) =="
mkdir -p /tmp/fakebin
printf '#!/bin/sh\necho HASHED-FAKE chạy\n' > /tmp/fakebin/foofoo
chmod +x /tmp/fakebin/foofoo
hash foofoo=/tmp/fakebin/foofoo      # ép foofoo -> /tmp/fakebin/foofoo
hash | grep foofoo
foofoo

echo
echo "== 3) command_not_found_handler = shim FALLBACK (chỉ chạy khi không match gì) =="
command_not_found_handler() { echo "[fallback] '$1' không có ở đâu -> handler chạy"; return 127; }
this_cmd_surely_does_not_exist_123
unset -f command_not_found_handler
```

Ba điều nó chứng minh:

- **Function đè builtin:** định nghĩa `cd()` → gõ `cd` chạy function, không phải builtin; phải `builtin cd` mới gọi được builtin thật.
- **`hash` override:** `hash foofoo=/tmp/fakebin/foofoo` → gõ `foofoo` chạy đúng file bị ép, bỏ qua hẳn việc tìm trong `$PATH`.
- **`command_not_found_handler`:** gõ một lệnh không tồn tại → handler chạy (fallback, tầng cuối cùng).

## 5. Ứng dụng thực tế: nạp chậm (lazy-load) `nvm` bằng function shim

`nvm` nạp eager (source file `nvm.sh` khoảng 3.500 dòng mỗi lần mở shell), làm chậm thời gian khởi động khoảng 0.5–0.6 giây. Có thể dùng một **function shim** để chỉ nạp khi thật sự cần:

```zsh
export NVM_DIR="$HOME/.nvm"

_load_nvm() {
  unset -f nvm node npm npx 2>/dev/null     # gỡ bẫy: xóa 4 stub trước khi gọi lệnh thật
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
}

# Stub: bắt lần gọi đầu tiên, nạp nvm, rồi chạy lại lệnh thật
nvm()  { _load_nvm; nvm  "$@"; }
node() { _load_nvm; node "$@"; }
npm()  { _load_nvm; npm  "$@"; }
npx()  { _load_nvm; npx  "$@"; }
```

Cơ chế này khớp đúng với mục 2: ta đặt **function** `node`/`npm`/… (tầng 3) để chặn trước **binary** (tầng 5). Lần gõ `node` đầu tiên trong một phiên:

1. function `node()` chạy → gọi `_load_nvm`.
2. `unset -f nvm node npm npx` **xóa cả 4 stub** — nếu không xóa, function sẽ tự gọi lại chính nó → **đệ quy vô hạn**, shell treo.
3. `nvm.sh` thật được nạp (đưa `node` thật vào `$PATH`).
4. quay lại `node "$@"`: giờ tầng 3 đã trống, nên rớt xuống binary thật, chạy đúng `node` với nguyên tham số ban đầu.

Lưu ý: phải stub cả `node`/`npm`/`npx`, không chỉ `nvm` — vì người ta gõ `node` nhiều hơn gõ `nvm`; nếu chỉ stub `nvm`, nó sẽ không bao giờ được nạp nếu bạn chỉ gõ `node`.

### Cái giá phải trả của lazy-load

- **Lần gọi `node`/`npm`/`nvm` đầu tiên trong mỗi shell chậm khoảng 0.5 giây** (trả phí nạp ngay lúc đó). Mọi lần sau thì tức thì.
- **Mất tính năng tự chuyển phiên bản theo `.nvmrc` khi `cd`.** Nạp eager thì hook `nvm_auto` đọc `.nvmrc` ngay lúc khởi động; với shim thì việc đó không còn tự động nữa (phải tự gõ `nvm use`, hoặc thêm một hook `chpwd` nhẹ để tự đọc `.nvmrc`).
- **Một tiến trình/script chạy `node` rất sớm** sẽ kích hoạt việc nạp ngay tại đó.
- Nói chung: chi phí được chuyển từ "mỗi lần mở shell" sang "lần đầu dùng đến Node" — đáng đánh đổi nếu phần lớn các shell mở ra không đụng đến Node.

## 6. Cheat sheet

```
# Xem cái gì sẽ chạy / tất cả các tầng
type node            # tầng đang thắng
type -a node         # liệt kê mọi tầng cùng tên
which -a node

# Xuyên qua từng tầng
command node …       # bỏ qua alias + function -> binary/builtin
builtin cd …         # ép builtin (khi bị function che)
\node / 'node'       # bỏ qua alias cho 1 lần gõ

# Bảng hash
hash                 # xem bảng đã hash
hash node=/path      # ép node -> /path (bỏ qua tìm PATH)
rehash               # quét lại PATH (sau khi đổi PATH/đổi binary)
hash -r              # xóa sạch hash

# Định nghĩa / gỡ shim
node() { … }         # tạo function shim
unset -f node        # gỡ function shim
alias node='…'       # alias shim
unalias node         # gỡ alias
```

---

> **Ý chính:** shell luôn resolve tên lệnh theo cùng một thứ tự cố định — alias, rồi function, rồi builtin, rồi binary trong `$PATH`. Một shim chỉ đơn giản là tận dụng thứ tự đó: chen vào một tầng cao hơn để được chạy trước. Hiểu rõ năm tầng này, bạn sẽ biết chính xác vì sao một shim hoạt động — và cách nào để xuyên qua nó khi cần.
