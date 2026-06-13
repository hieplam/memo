---
title: 'What is a Terminal? (and "hardware terminal", emulators, and PTYs)'
description: "A plain-language explainer building up from the physical terminal device to the abstract idea, answering whether your keyboard and monitor are a terminal today."
pubDatetime: 2026-05-30T00:00:00Z
tags:
  - terminal
  - explainer
---

> A plain-language explainer building up from the physical device to the
> abstract idea, and answering: *is my keyboard + monitor a terminal today?*
>
> Companion to the PTY deep-dive. Date: 2026-05-30

---

## 1. A terminal is the "end point" where a human meets a computer

The word comes from **"terminal point"** — literally the end of the wire. It's
the device a person uses to *send input to* and *receive output from* a computer.
Keyboard in, text out. Nothing more.

The key historical fact: **in the early days, the terminal was NOT the
computer.** The computer was a room-sized, expensive machine. The terminal was a
cheap, separate device sitting on your desk, connected to that distant computer
by a cable.

```
   YOUR DESK                          COMPUTER ROOM
 ┌──────────────┐                  ┌──────────────────┐
 │   TERMINAL   │ ───── cable ───► │   THE COMPUTER    │
 │ (keyboard +  │ ◄──── cable ──── │ (does the actual  │
 │  printer or  │                  │   computing)      │
 │  screen)     │                  └──────────────────┘
 └──────────────┘
   dumb, cheap                        smart, expensive
```

The terminal itself was "dumb" — it had almost no brain. Its only jobs were: turn
your keystrokes into characters and send them down the wire, and take characters
coming back up the wire and print/display them.

---

## 2. A "hardware terminal" is the physical box that does this

A **hardware terminal** is a real, physical device — an actual piece of equipment
you could put on a desk. Two generations:

**Teletype (TTY), ~1900s–1960s** — an electromechanical typewriter. You typed, it
sent the characters over a wire and *physically printed* the computer's responses
onto a roll of paper. This is literally where the abbreviation **TTY**
(teletypewriter) comes from. There was no screen — your "scrollback" was the
paper coming out of the machine.

**Video terminal / "glass TTY," 1970s onward** — the famous example is the
**DEC VT100** (1978). Same idea, but a CRT screen instead of paper. A keyboard and
a green-on-black monitor in one unit, connected to the computer by a **serial
cable** (RS-232). Still no real computing power of its own — just "send keys,
show text."

So "hardware terminal" = **the actual physical keyboard-and-screen appliance**,
as opposed to a *program* pretending to be one.

---

## 3. Why this matters for PTYs

The operating system was built around the assumption that programs talk to one of
these physical boxes over a serial line. The kernel's terminal driver (the line
discipline) exists to manage that conversation — echoing keystrokes, handling
backspace, turning `Ctrl-C` into a signal.

Then the hardware terminal **disappeared**. Today nobody has a VT100 on their
desk. Instead you have:

```
  PHYSICAL TERMINAL ERA          MODERN ERA
 ┌────────────────────┐        ┌─────────────────────────────────┐
 │  VT100 ──cable──►   │        │  Terminal-emulator window       │
 │  real hardware      │   →    │  (a PROGRAM drawing a fake       │
 │                     │        │   terminal in a GUI window)      │
 └────────────────────┘        └─────────────────────────────────┘
```

A **terminal emulator** (iTerm, GNOME Terminal, the VS Code terminal) is a piece
of software that *imitates* a VT100 in a window — it even still speaks the
VT100's control codes for colors and cursor movement.

But the operating system and your shell still expect a real terminal device to
talk to. **That gap is exactly what the PTY (pseudo-terminal) fills.** The PTY is
the kernel object that lets the shell believe it's wired to a hardware terminal,
while in reality a terminal-emulator *program* is holding the other end.

The three meanings, stacked:

| Term | What it is |
|---|---|
| **Terminal** (the abstract idea) | The endpoint where a human types in and reads out — a contract: keys in, text out |
| **Hardware terminal** | The *physical* device that fulfilled that contract — teletype, then VT100-style video terminal |
| **Terminal emulator** | A *program* that imitates a hardware terminal in a window |
| **PTY** | The kernel plumbing that lets a program (emulator, SSH, tmux) stand in for the now-absent hardware terminal |

In one line: **a terminal is the *role* (the human's I/O endpoint); a hardware
terminal was the *physical device* that used to play that role; a PTY is what
lets software play that role today.**

---

## 4. Is my keyboard + monitor a terminal today?

Conceptually close, but **technically NO.** The "terminal" role has been split up
and scattered in modern systems.

### The trap: a physical keyboard + monitor ≠ a terminal

On an old VT100, the keyboard and screen were **one unit that WAS the terminal**
— it turned keystrokes into characters and displayed incoming characters itself.
All the "terminal logic" lived in that box.

Your keyboard and monitor today are **dumber than a VT100**. They know nothing
about characters or terminals:

- **The keyboard** just sends "key #38 was pressed" over USB. It doesn't send the
  letter "k", it sends a *scancode*.
- **The monitor** just receives an array of pixels over HDMI and lights up. It
  has no concept of "text" — it only paints colored dots.

```
  KEYBOARD ──USB scancode──►  ┌──────────────────────────┐
                              │   OPERATING SYSTEM        │
                              │  (where the real          │
  MONITOR ◄──HDMI pixels───   │   "terminal" now lives)   │
                              └──────────────────────────┘
```

So a physical keyboard + monitor today are just **raw I/O devices**, not a
terminal. The terminal role moved into software.

### So where is the "terminal" today?

Two cases:

**Case 1 — You open a terminal window in a GUI (most common)**

When you open iTerm / GNOME Terminal / the VS Code terminal, the thing playing
the terminal role is **that emulator program**, not the hardware. The physical
keyboard and monitor are just the OS's hands; the emulator program holds the PTY
master end and plays "terminal" for the shell.

```
Physical keyboard → OS → Emulator window (the REAL terminal is here) → PTY → shell
Physical monitor  ← OS ← Emulator window ←─────────────────────────── PTY ← shell
```

**Case 2 — You press Ctrl+Alt+F3 on Linux into a full-screen text console (no GUI)**

There is **no emulator program** here. The **Linux kernel itself** emulates a
terminal in software, called a **virtual console** (e.g. `/dev/tty1`). The kernel
reads scancodes straight from the keyboard and draws text straight to the screen.

In this case you could say the **whole combo of "keyboard + monitor + the
kernel's terminal-emulation code" is one terminal** — and it's the closest thing
to the spirit of an old physical terminal. But note: what *makes* it a terminal
is still the software in the kernel, not the keyboard and monitor themselves.

### Direct answer

> Are my physical keyboard and monitor a terminal today?

**No.** By themselves they are just raw input/output devices. The thing that *is*
a terminal is the **software** playing that role:

- In a GUI → the **terminal emulator program**.
- Outside a GUI (full-screen console) → the **Linux kernel's virtual console** code.

The keyboard and monitor merely *participate in* a terminal; they are not the
terminal.

| Era | What the "terminal" actually is |
|---|---|
| Old VT100 | The hardware box — keyboard + screen + logic, all in one |
| Today, in a GUI | The **terminal emulator** program (iTerm, etc.) |
| Today, full-screen text console | The **virtual console** emulated by the Linux kernel in software |

Memory hook: in the old days a terminal was **something you touched**; today a
terminal is **software running inside the machine**, while the keyboard and
monitor are just its doors in and out.
