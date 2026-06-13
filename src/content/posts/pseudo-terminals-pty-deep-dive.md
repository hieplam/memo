---
title: "Pseudo-terminals (PTYs): a deep dive"
description: "A deep dive into pseudo-terminals (PTYs): the software-faked terminal devices that let shells like bash believe they are talking to real hardware while a third program sits in the middle."
pubDatetime: 2026-05-30T00:00:00Z
tags:
  - terminal
  - pty
  - unix
  - deep-dive
---

> Research report generated via a fan-out / fetch / adversarial-verify / synthesize
> workflow (105 agents, 23 sources fetched, 97 claims extracted, 25 verified —
> 15 confirmed, 10 refuted). Findings tagged ✅ were machine-verified; the
> history section (§5) is flagged as background knowledge that the verification
> pass could **not** confirm.
>
> Date: 2026-05-30

---

## 1. The big picture — in one breath

A **pseudo-terminal** is a fake terminal made of software. It's a pair of
connected virtual devices that lets one program *pretend to be a
keyboard-and-screen terminal* for another program, while a third program quietly
sits in the middle reading and writing everything.

That's the whole trick. A shell like `bash` is written to talk to a physical
terminal. A PTY lets `bash` keep believing it's wired to real hardware, while in
reality its "terminal" is just another program — your terminal-emulator window,
an SSH server, or `tmux`. The PTY is the impersonation layer that makes this lie
seamless.

> **Terminology note:** the classic names are **master** and **slave**. POSIX
> Issue 8 (2024) renamed them **manager** and **subsidiary** for inclusive
> language, but the Linux kernel and nearly all man pages still use master/slave.
> The architecture is identical — only the words changed. This document uses
> master/slave to match the code and docs you'll encounter.

---

## 2. First, what's a TTY? (you can't understand PTY without it)

"TTY" is short for **teletypewriter** — a 1900s electromechanical
typewriter-over-wire. In the 1970s, Unix machines were accessed through these
(and later "glass TTYs," i.e. screen terminals) over serial cables. So in Unix,
**"tty" became the generic word for "the terminal device a program is attached
to."**

The kernel piece that manages a terminal has three layers:

```
   hardware / cable            kernel                         your program
 ┌────────────────────┐   ┌──────────────────────┐      ┌───────────────────┐
 │ serial port / UART │ → │ TTY driver           │      │  shell, vim, etc. │
 │ (real terminal)    │   │   ↕                  │ ←──→ │  reads/writes fd  │
 └────────────────────┘   │ LINE DISCIPLINE      │      └───────────────────┘
                          │ (cooked-mode logic)  │
                          └──────────────────────┘
```

The middle layer, the **line discipline**, is the important one.
✅ *(Verified, kernel docs)* It "processes all incoming and outgoing characters
from/to a tty device." Concretely it does the stuff you take for granted at a
shell prompt:

- **Line editing** — backspace erases a character before the program ever sees
  the line ("cooked mode").
- **Echo** — what you type appears on screen.
- **Signal generation** — `Ctrl-C` becomes a SIGINT to the foreground program,
  `Ctrl-Z` a SIGTSTP.
- **Translation** — e.g. carriage-return ↔ newline mapping.

A program can switch the line discipline to **raw mode** (vim, less, a password
prompt) to handle keystrokes itself.

**So: a TTY is the broader concept — the kernel terminal subsystem.** A PTY is a
*specific kind of TTY* whose "hardware" is replaced by software.

> ⚠️ **Refuted (0–3):** the neat claim that "TTY = physical terminals + PTYs as
> two subcategories." It's a useful teaching simplification, but the kernel
> doesn't carve the world that cleanly — a PTY *is* a tty device that happens to
> be backed by a software driver, not a separate sibling category. Treat the
> TTY/PTY split as "general concept vs. software-backed instance," not a strict
> taxonomy.

---

## 3. What a PTY actually is (verified core)

✅ *(Verified, pty(7) man page + HandWiki, voted 3–0)*

A PTY is **a pair of virtual character devices providing a bidirectional
channel**:

```
                       THE PTY PAIR (one kernel object, two ends)

  terminal emulator /        ┌──────────────────────────┐        shell / vim /
  ssh server / tmux          │                          │        test harness
        │                    │   ┌─────┐      ┌──────┐  │              │
        │   write keystrokes │   │     │ ldisc│      │  │   reads like │
        └───────────────────►│ M │◄───►│ slave│◄─────┼──┤   a real tty │
        ◄────────────────────│ A │     │ (pts)│      │  │              │
            program output   │ S │     └──────┘      │  │              │
                             │ T │                   │  │              │
                             │ E │                   │  │              │
                             │ R │                   │  │              │
                             └───┴───────────────────┘  │
                            /dev/ptmx              /dev/pts/N
```

- **The slave end** behaves *exactly like a classical terminal*. The shell opens
  `/dev/pts/N`, gets all the line-discipline goodies (cooked mode, signals,
  window size), and is none the wiser.
- **The master end** is the puppeteer. Whatever the master *writes* arrives at
  the slave as if typed on a keyboard; whatever the slave program *prints* comes
  back out of the master to be displayed or forwarded.

So when you type `ls` in your terminal window:

1. The emulator (master) writes `l`, `s`, `\r` into `/dev/ptmx`.
2. The line discipline cooks it, echoes it, and hands the line to the shell on
   `/dev/pts/N`.
3. The shell runs `ls`, prints output to `/dev/pts/N`.
4. That output flows back out the master, and the emulator paints it on your
   screen.

> ⚠️ **Refuted nuance (1–2):** the claim that "the master can directly generate
> SIGINT to the slave's foreground process group." The reality is subtler —
> signals come from the **line discipline** interpreting control characters (the
> master writes `\x03`, the ldisc turns it into SIGINT), not from the master
> "sending signals" directly.

**Driver-level fact** ✅ *(Verified, kernel tty_internals, voted 3–0):* PTY
drivers need *special handling* inside the kernel, distinct from ordinary TTY
drivers — they don't allocate the usual port arrays, they apply a special
termios reset on first open, and they refuse to let the master be re-opened
(returns `-EIO`). A PTY only *looks* like ordinary terminal hardware from the
outside.

---

## 4. The APIs — how you actually create one

There are two layers: the **portable POSIX (Unix98) sequence**, and the **BSD
convenience wrappers** that hide it.

### 4a. The canonical POSIX / Unix98 sequence ✅ *(Verified 3–0)*

```c
int master = posix_openpt(O_RDWR | O_NOCTTY); // open an unused master (/dev/ptmx)
grantpt(master);                              // fix up slave ownership/permissions
unlockpt(master);                             // unlock the slave so it can be opened
char *slave_name = ptsname(master);           // get the slave's path, e.g. /dev/pts/3
int slave = open(slave_name, O_RDWR);         // open the slave end
```

| Call | What it does | Verified detail |
|---|---|---|
| `posix_openpt()` | Opens an unused master device, returns an fd. Reference impl is literally `open("/dev/ptmx", flags)`. | ✅ 3–0 |
| `grantpt()` | Sets the slave's **owner = your real UID**, group = unspecified (e.g. `tty`), **mode = 0620** (`crw--w----`). | ✅ 3–0 |
| `unlockpt()` | Clears the internal lock so the slave can be opened. | ✅ (sequence 3–0) |
| `ptsname()` | Returns the slave device's pathname. | ✅ |

✅ *(Verified 3–0)* The **slave pathname only exists while the master is open** —
close the master and the slave node disappears. This is a lifecycle guarantee,
not a convention.

**Historical footnote** ✅ *(Verified 3–0):* `grantpt()` used to run a
set-user-ID helper binary named **`pt_chown`** to fix slave permissions (since a
normal user can't `chown` a device node). glibc carried this until **version
2.33**, when it was **removed** — on modern Linux the kernel sets permissions at
allocation time, so `grantpt()` is effectively a **no-op**. But portable code
*must still call it*, because other Unixes (Solaris, the BSDs) may still need it.

> ⚠️ Three POSIX-detail claims were **refuted (0–3)** — useful corrections:
> - `posix_openpt()` does **not** accept "only O_RDWR and O_NOCTTY." Other flags
>   exist/are permitted.
> - It's **not** accurate to say posix_openpt + grantpt + unlockpt + ptsname is
>   "the complete standardized PTY API" — that overstates it.
> - The controlling-terminal setup is **not** a single fixed
>   `TIOCNOTTY → setsid → TIOCSCTTY` recipe; it's more situational.

### 4b. The BSD convenience wrappers ✅ *(Verified 3–0)*

Almost nobody writes the five-step dance by hand. They use:

- **`openpty()`** — does the whole allocation and hands you back **two separate
  file descriptors**, one master and one slave, in a single call.
- **`forkpty()`** — combines `openpty()` + `fork()` + `login_tty()`: it allocates
  a PTY, forks a child, and attaches the child to the slave as its controlling
  terminal. This is how a terminal emulator spawns your shell in one shot.
- **`login_tty()`** — the glue that makes the slave the child's *controlling
  terminal*. ✅ *(Verified 3–0)* It performs exactly four steps on the slave fd:
  1. `setsid()` — start a new session,
  2. make the fd the session's controlling terminal,
  3. `dup` it onto stdin/stdout/stderr,
  4. close the original fd.

This is verifiable in real code: OpenSSH's `sshpty.c` calls
`openpty(&ptyfd, &ttyfd, ...)` to get its two fds.

> ⚠️ **Refuted (0–3):** the claim that "`openpty()` is literally implemented as
> posix_openpt→grantpt→unlockpt→ptsname internally" — a plausible-sounding but
> unverified implementation detail; the actual implementation varies by libc.

### 4c. Window size — the one ioctl everyone uses

When you resize your terminal window, the emulator issues a `TIOCSWINSZ` ioctl
carrying a `struct winsize` (rows, cols, pixels). The kernel then sends
**SIGWINCH** to the foreground program so vim/tmux can redraw.

> ⚠️ **Refuted (0–3):** the over-specific claim that `TIOCSWINSZ` is applied "on
> the master fd, never anywhere else." In practice the side it's set on is more
> flexible than that absolute phrasing allowed.

---

## 5. History and evolution

> **⚠️ Honesty marker:** this is the one section the verification pass left thin.
> Two specific historical claims were actively **refuted** (the "1967 DEC PDP-6"
> origin and the "1983 Eighth Edition Unix" origin both failed, 1–2), and *no
> surviving verified claim* covered the BSD → System V → Unix98 → devpts
> timeline. The workflow flagged the history as **substantively unanswered**.
> What follows is the standard, widely-documented account from background
> knowledge — **treat it as well-established lore, not machine-verified.**

The evolution, roughly:

```
1870s   Physical teletype (TTY) — typewriter over a wire
  │
1960s-70s  Early Unix: serial terminals over UARTs; kernel grows the
  │        tty driver + line discipline to manage them
  │
~early    PTYs appear so software could feed a terminal interface to a
1980s     program with no real hardware behind it (early networking,
  │        windowing systems, "script" recording, remote login)
  │
  ├── BSD pty devices: statically pre-created device-node PAIRS named
  │     /dev/ptyXY (master) ↔ /dev/ttyXY (slave). You'd scan the pool
  │     for a free pair. Simple, but a fixed ceiling and racy to grab.
  │
  ├── System V / STREAMS ptmx: cleaner, on-demand model. Open the single
  │     "pty multiplexer" /dev/ptmx → kernel hands you a fresh master and
  │     auto-creates the matching slave under /dev/pts/. No pre-made pool,
  │     no scanning. Slaves were built as a STREAMS device stack.
  │
1998  Unix98 PTYs (Single UNIX Specification v2): standardizes exactly the
  │     /dev/ptmx + /dev/pts/N model and the posix_openpt/grantpt/
  │     unlockpt/ptsname API. This is why the API above is "the Unix98 API."
  │
  └── Linux devpts: a dedicated virtual filesystem mounted at /dev/pts
        that implements the Unix98 model — open /dev/ptmx, get master fd,
        slave appears as /dev/pts/N. Later gained per-container namespacing
        so each mount namespace has its own private pts numbering.
```

The throughline: **statically pre-created pairs (BSD)** → **dynamically
allocated on demand (System V ptmx)** → **standardized (Unix98)** →
**filesystem-backed and namespace-aware (Linux devpts)**.

---

## 6. Why PTYs exist — the problems they solve

PTYs are the single primitive behind a surprising amount of everyday
infrastructure:

- **Terminal emulators** (GNOME Terminal, iTerm, Alacritty, VS Code's terminal).
  There's no serial cable to your GPU. The emulator owns the master, runs your
  shell on the slave via `forkpty()`, and translates between bytes and
  pixels/keystrokes.
- **Remote login — SSH / Telnet.** The remote shell needs a terminal, but it's on
  another machine with no physical console. ✅ The cited OpenSSH `sshpty.c`
  allocates a PTY so your remote `bash` gets a proper controlling terminal —
  that's what lets `Ctrl-C`, job control, and full-screen apps work over SSH.
- **Terminal multiplexers — tmux / screen.** Each pane/window is a separate PTY
  whose master tmux owns. tmux multiplexes many slave-attached shells into one
  real terminal, and can detach (keep the slaves alive with no master attached)
  and reattach later.
- **Automation — Expect / pexpect.** Many programs behave differently when they
  detect they're *not* talking to a terminal (e.g. `ssh`/`sudo` password prompts
  read straight from the tty, not stdin). ✅ The cited `pexpect` drives such
  programs by putting a PTY between itself and the target, so the program thinks
  a human is at a terminal. This is also why CI tools allocate a PTY to get
  colored output and progress bars.
- **Containers.** `docker run -t` allocates a PTY so the containerized process
  gets an interactive terminal; without `-t` there's no tty and programs fall
  back to non-interactive behavior. Linux devpts namespacing gives each container
  its own private `/dev/pts`.
- **`script` / session recording, IDE consoles, serial-console emulation** — all
  the same pattern.

The unifying need: **a program insists on a terminal, but no hardware terminal
exists (or you want to programmatically sit between the program and its
terminal).** PTY is the answer every time.

---

## 7. TTY vs PTY — the crisp summary

| | TTY (general) | PTY (pseudo) |
|---|---|---|
| Backing | The kernel terminal subsystem; classically real hardware (serial, console) | Pure software — a master/slave device pair |
| "Hardware" end | A UART / physical console | A program holding the **master** fd |
| Program-facing end | The terminal device | The **slave** (`/dev/pts/N`), indistinguishable to the program |
| Line discipline | Yes | Yes — that's the whole point of the impersonation |
| Examples | `/dev/ttyS0` (serial), `/dev/tty1` (console) | `/dev/pts/3` behind your terminal window, SSH session, tmux pane |

Mental model: **TTY is the interface contract; PTY is a software implementation
of that contract with another program standing in for the hardware.**

---

## 8. Open questions (honest gaps)

The workflow explicitly left these unresolved — good next directions if you want
to go deeper:

1. The **precise dated history** of BSD pty → System V STREAMS ptmx → Unix98 →
   devpts (this run couldn't verify specific dates/origins).
2. Does the master endpoint **bypass the line discipline**, or does data pass
   through it before the master's `read()`? (The asymmetry between the two ends
   is genuinely subtle.)
3. Which **ioctls beyond TIOCSWINSZ** matter in practice (TIOCSCTTY,
   TIOCGPGRP/TIOCSPGRP) and which side — master or slave — each applies to.
4. How **Linux devpts internally** tears down the slave dentry when the master fd
   closes.

---

## Appendix A — Confirmed findings (verified ✅)

1. **PTY = master/slave pair of virtual character devices.** Master controlled by
   emulator/login server; slave emulates a hardware serial port and is used by
   shells. *(3–0)*
2. **Line discipline is the intermediate layer; PTY drivers need special kernel
   handling at init.** *(2–1 ldisc, 3–0 special handling)*
3. **Canonical allocation sequence** `posix_openpt → grantpt → unlockpt →
   ptsname → open(slave)`; slave pathname exists only while master is open.
   *(3–0 sequence, 2–1 slave lifetime)*
4. **`grantpt()` sets slave owner=real UID, group=unspecified, mode=0620; used
   `pt_chown` historically, removed in glibc 2.33, no-op on modern Linux; POSIX.1
   conformant.** *(3–0)*
5. **BSD wrappers:** `openpty()` returns two fds; `forkpty()` = openpty + fork +
   login_tty; `login_tty()` does setsid → set controlling tty → dup to
   stdio → close. *(3–0)*

## Appendix B — Refuted claims (killed by verification)

| Claim | Vote |
|---|---|
| "TTY = physical terminals + PTYs as two clean subcategories" | 0–3 |
| "posix_openpt() accepts only O_RDWR and O_NOCTTY" | 0–3 |
| "posix_openpt + grantpt + ptsname + unlockpt = the complete standardized API" | 0–3 |
| "Master can directly generate SIGINT to slave's foreground group" | 1–2 |
| "openpty() is implemented as posix_openpt→grantpt→unlockpt→ptsname internally" | 0–3 |
| "Controlling-terminal setup is a fixed TIOCNOTTY→setsid→TIOCSCTTY sequence" | 0–3 |
| "TIOCSWINSZ applies to the master fd, never anywhere else" | 0–3 |
| Specific `tty_struct` field list | 1–2 |
| "Line discipline attached with refcount 1, locked during read+write" | 0–3 |
| "PTYs originated 1967 DEC PDP-6 / modern PTYs 1983 Eighth Edition Unix" | 1–2 |

## Appendix C — Sources

**Primary (highest trust):**

- pty(7) — <https://www.man7.org/linux/man-pages/man7/pty.7.html>
- posix_openpt(3) — <https://www.man7.org/linux/man-pages/man3/posix_openpt.3.html>
- grantpt(3) — <https://man7.org/linux/man-pages/man3/grantpt.3.html>
- POSIX posix_openpt — <https://pubs.opengroup.org/onlinepubs/009695099/functions/posix_openpt.html>
- Linux kernel — TTY line discipline — <https://docs.kernel.org/driver-api/tty/tty_ldisc.html>
- Linux kernel — TTY internals — <https://docs.kernel.org/driver-api/tty/tty_internals.html>
- Oracle forkpty(3C) — <https://docs.oracle.com/cd/E88353_01/html/E37843/forkpty-3c.html>
- OpenSSH sshpty.c — <https://github.com/openssh/openssh-portable/blob/master/sshpty.c>

**Secondary:**

- Wikipedia: Pseudoterminal — <https://en.wikipedia.org/wiki/Pseudoterminal>
- HandWiki: Pseudoterminal — <https://handwiki.org/wiki/Software:Pseudoterminal>
- pexpect — <https://github.com/pexpect/pexpect>

**Background / practitioner blogs:**

- Linus Åkesson — "The TTY demystified" — <https://www.linusakesson.net/programming/tty/>
- computer.rip — "A History of the TTY" — <https://computer.rip/2024-02-25-a-history-of-the-tty.html>
- poor.dev — "Terminal anatomy" — <https://poor.dev/blog/terminal-anatomy/>
- uninformativ.de — writing a terminal — <https://www.uninformativ.de/blog/postings/2018-02-24/0/POSTING-en.html>
- dev.to/napicella — Linux terminals: tty, pty, shell — <https://dev.to/napicella/linux-terminals-tty-pty-and-shell-192e>

---

## Research stats

- Search angles: 5
- Sources fetched: 23 (5 URL duplicates removed)
- Claims extracted: 97
- Claims verified: 25 → **15 confirmed, 10 killed**
- Findings after synthesis: 5
- Agent calls: 105
