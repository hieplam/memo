---
title: "Claude Code Workflow: Prompt Của Từng Agent Đang Nằm Ở Đâu Trên Đĩa?"
description: "Sau khi một Workflow trong Claude Code chạy xong, prompt và kết quả đầy đủ của từng agent được lưu ở đâu? Bài này lần theo ba loại ID (taskId, runId, agentId), năm vị trí lưu trên đĩa, và cách gom lại thành một file đọc được để tự học cách mình đã ra lệnh cho agent."
pubDatetime: 2026-07-01T00:25:00Z
lang: vi
tags:
  - claude-code
  - ai-agents
  - workflows
  - prompt-engineering
  - vietnamese
---

## Tóm tắt nhanh (TL;DR)

- Sau khi một `Workflow` chạy xong, Claude Code đã lưu sẵn mọi thứ trên đĩa — script, prompt đầy đủ và kết quả đầy đủ của từng agent — nhưng rải rác ở nhiều nơi, định dạng phục vụ runtime (lúc chạy) chứ không phải cho người đọc.
- Có ba loại ID với ba phạm vi khác nhau: **taskId** (của hệ thống background task — tác vụ chạy nền — chung), **runId** (của riêng workflow engine), và **agentId** (của từng agent bên trong run) — nhầm giữa ba cái này là nguồn gốc phần lớn sự bối rối.
- File `tasks/<taskId>.output` chỉ chứa kết quả cuối cùng; **prompt đầy đủ + tool call + kết quả đầy đủ của từng agent chỉ nằm ở file `agent-<agentId>.jsonl`** — đây là nơi duy nhất "đủ để học".
- Có thể viết một script gom **journal** (nhật ký chạy — file `wf_<runId>.json`) và các file `.jsonl` thành một Markdown dễ đọc, rồi tự động hoá việc export bằng `Stop` hook (không phải `PostToolUse`, vì `Workflow` chạy nền và trả kết quả tool call ngay lập tức).
- Đọc lại **prompt thật** đã gửi (khác với prompt viết trong script, vì harness tự chèn thêm context) là cách thiết thực nhất để cải thiện kỹ năng viết prompt cho workflow sau này.

---

## Mục lục

1. [Vấn đề](#1-vấn-đề)
2. [Khi gọi `Workflow()` — bên dưới chạy gì](#2-khi-gọi-workflow--bên-dưới-chạy-gì)
3. [Ba loại ID: taskId / runId / agentId](#3-ba-loại-id-taskid--runid--agentid)
4. [Cấu trúc lưu trên đĩa (5 vị trí)](#4-cấu-trúc-lưu-trên-đĩa-5-vị-trí)
5. [Tìm lại taskId / runId](#5-tìm-lại-taskid--runid)
6. [Đọc lại prompt + output từng agent](#6-đọc-lại-prompt--output-từng-agent)
7. [Dùng để improve prompting skill](#7-dùng-để-improve-prompting-skill)
8. [Tự verify](#8-tự-verify)

---

## 1. Vấn đề

> Ghi chú kiến thức — xác minh ngày 2026-06-24. Nguồn: (1) kiểm tra trực tiếp **18 workflow run thật** trên đĩa local, (2) mô tả tool `Workflow` trong system prompt của Claude Code. Fact đã kiểm chứng gắn `[verified]`; suy luận chưa quan sát trực tiếp gắn `[unverified]`. Mọi path/tên riêng/tên dự án đã được mask theo quy ước repo (`~`, `<project>`, `<you>`).

Bạn nhờ Claude chạy một `Workflow` — ví dụ điều tra 1 bug: 18 agent chạy song song, đọc code, kiểm chứng giả thuyết, tổng hợp nguyên nhân; mất ~12 phút, tốn ~537k token. Xong rồi bạn muốn xem lại:

> _Mình đã ra lệnh gì cho từng agent? Nó trả lời gì? Prompt đó tốt hay dở ở chỗ nào?_

Câu trả lời **đã nằm sẵn trên đĩa** — Claude Code lưu hết: script bạn viết, prompt đầy đủ + kết quả đầy đủ của từng agent. Nhưng nó **rải rác ở 3 nơi**, định dạng phục vụ runtime chứ không phải cho người đọc để học. Bài này map chính xác chỗ lưu, giải thích 3 loại ID, và cách gom lại thành 1 file đọc được để nghiên cứu prompt của chính mình.

---

## 2. Khi gọi `Workflow()` — bên dưới chạy gì

`[verified]` `Workflow` là một **background task** (tác vụ chạy nền): tool call **trả về NGAY LẬP TỨC** với 2 ID (taskId + runId), **không chờ** agent chạy xong. Agent chạy ngầm; khi xong mới bắn `<task-notification>` về.

```
Bạn gõ: "điều tra bug này"
        │
        ▼
Claude gọi Workflow(script)            ← script JS: meta + agent()/parallel()/pipeline()
        │
        ├── Harness tạo 1 background TASK ────────────► taskId: wsoyz2kvx
        │     trả về NGAY, không chờ; ghi kết quả cuối vào tasks/<taskId>.output
        │
        ├── Workflow engine đăng ký RUN ─────────────► runId: wf_1e5340ac-a1e
        │
        └── Engine spawn N subagent (mỗi agent() = 1 con)
                ├── agent 1: model:drain-loop ───────► agentId: ac4d0edb6bcf3f12f
                ├── agent 2: model:lock-repository ──► agentId: a6985674d3d0c666f
                ├── ...
                └── agent 18: synthesize ────────────► agentId: a8a469b1f98189d7e

                Mỗi agent: Read/Grep/Bash..., rồi trả StructuredOutput hoặc text.
                18 con chạy đồng thời (tối đa ~16 con một lúc).
```

**Hệ quả quan trọng:** vì tool call trả về trước khi agent xong, _thời điểm_ ghi file kết quả ≠ thời điểm bạn nhận lại runId. Đây là lý do về sau auto-export phải dùng `Stop` hook chứ không phải `PostToolUse` (mục 6).

---

## 3. Ba loại ID: taskId / runId / agentId

`[verified]` Có **3 loại ID, 3 scope (phạm vi) khác nhau**:

| ID          | Ví dụ               | Của ai                                       | Vai trò                                                | Lưu ở                                                       |
| ----------- | ------------------- | -------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| **taskId**  | `wsoyz2kvx`         | Harness (hệ thống background-task **chung**) | Track "task xong chưa, output đâu"                     | `tasks/<taskId>.output`                                     |
| **runId**   | `wf_1e5340ac-a1e`   | Workflow engine (**riêng** workflow)         | Namespace cho cả run: script, agents, phases, progress | `workflows/wf_<runId>.json`, `subagents/workflows/<runId>/` |
| **agentId** | `ac4d0edb6bcf3f12f` | Workflow engine                              | Định danh **1 agent bên trong** run                    | `agent-<agentId>.jsonl`                                     |

Những điều đã kiểm chứng từ 18 run:

- **taskId KHÔNG riêng gì workflow.** Mọi thứ chạy ngầm đều có taskId. Trong tasks dir có cả `b*` (ví dụ output của 1 lệnh Bash ngầm — không hề có runId/journal) lẫn `w*` (workflow). Pattern quan sát: workflow → `w*`, task ngầm khác → `b*` (`[unverified]` đây có phải luật cứng không).
- **1 workflow = đúng 1 taskId.** Grep 18 run: taskId 1:1 với runId, không cái nào trùng. Resume (`resumeFromRunId`) = một lần gọi `Workflow` mới → task mới → taskId/runId mới.
- **Agent bên trong KHÔNG có taskId.** 18 agent chỉ có `agentId` + `agentType: "workflow-subagent"`, và **không** có file `tasks/<agentId>.output`. Tức harness chỉ "thấy" đúng **1 task** cho cả workflow; còn agent do workflow engine quản lý bằng agentId.

```
1 lần gọi Workflow(...) = 1 background task = 1 taskId = 1 runId
        └── bên trong: N agent → mỗi con 1 agentId (KHÔNG phải taskId)
```

---

## 4. Cấu trúc lưu trên đĩa (5 vị trí)

`[verified]` Gốc của 1 session:
`~/.claude/projects/<project>/<session-id>/`
(riêng `tasks/` nằm ở scratch tạm: `/private/tmp/.../<spawning-session-id>/tasks/`)

> **Đính chính (verified 2026-06-24, qua 1 workflow 7-agent):** `<session-id>` trong path `tasks/` là UUID của **session ĐANG GỌI** workflow (spawning session), **có thể KHÁC** UUID của session chứa `workflows/wf_<runId>.json`. Ví dụ thực: journal nằm ở session `9c59a87a-…` nhưng `tasks/wsoyz2kvx.output` nằm ở `/private/tmp/claude-503/.../e0d8b953-…/tasks/`. File `.output` là artifact tạm của scratchpad từng session → có thể bị dọn (chỉ 3/19 run còn file lúc kiểm tra).

| #   | File                                                    | Nội dung                                                                                                                                                                                                                                                                                                                                      | Đủ để học prompt?                 |
| --- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | `tasks/<taskId>.output`                                 | **CHỈ kết quả CUỐI** (summary + result tổng)                                                                                                                                                                                                                                                                                                  | ❌ **Không** — 0 prompt của agent |
| 2   | `workflows/wf_<runId>.json`                             | "journal": `script`, `result` tổng, `logs` (**`string[]`** — mỗi phần tử là 1 câu tóm tắt phase, KHÔNG phải object), `phases` (**`{title, detail}[]`** — shape đơn giản, KHÁC phase row trong `workflowProgress`), `workflowProgress[]` (mỗi agent 1 dòng: label, model, tokens, **promptPreview/resultPreview bị cắt đúng 400 ký tự + `…`**) | ⚠️ Một phần                       |
| 3   | `subagents/workflows/<runId>/agent-<agentId>.jsonl`     | **TOÀN BỘ** hội thoại 1 agent: prompt đầy đủ (user message đầu) + mọi tool call + result đầy đủ (StructuredOutput hoặc text cuối)                                                                                                                                                                                                             | ✅ **Đầy đủ nhất**                |
| 4   | `workflows/scripts/<name>-wf_<runId>.js`                | Script chạy lại được (`Workflow({scriptPath})`)                                                                                                                                                                                                                                                                                               | ✅                                |
| 5   | `subagents/workflows/<runId>/agent-<agentId>.meta.json` | `{"agentType":"workflow-subagent"}`                                                                                                                                                                                                                                                                                                           | (metadata)                        |

**Cạm bẫy thường gặp:** nhiều người mở `tasks/<taskId>.output` tưởng có hết — nhưng nó **chỉ là return value cuối** của workflow, **không chứa prompt từng agent**. Prompt đầy đủ **chỉ** có ở file `.jsonl` (#3).

> **"Journal" là term của Claude Code**, không phải tự đặt. Mô tả tool `Workflow` (mục Resume) có câu: _"Fallback when no journal is available: Read agent-`<id>`.jsonl files…"_. Journal = bản ghi trạng thái run để **resume/replay cache** (chạy lại thì prefix `agent()` chưa đổi sẽ trả kết quả từ cache, không chạy lại). File `wf_<runId>.json` chính là journal đó. `[unverified]` Claude Code không đặt _tên file_ chính thức — chỉ tham chiếu qua `scriptPath`/`resumeFromRunId`.

---

## 5. Tìm lại taskId / runId

`[verified]` Ba cách, từ nhanh tới chắc ăn:

**a) Ngay trong chat lúc launch.** Tool result in nguyên văn:

```
Workflow launched in background. Task ID: wsoyz2kvx     ◄ taskId
Run ID: wf_1e5340ac-a1e                                  ◄ runId
```

⚠️ Trong UI khối tool result thường **bị thu gọn** — bấm `Ctrl+R` (hoặc click) để bung. Tắt session là không xem lại kiểu này được.

**b) Gõ `/workflows`** — liệt kê run đang chạy / vừa xong trong session.

**c) Quét từ đĩa** (chắc nhất, đọc lại lúc nào cũng được). Tên file journal = runId; field `taskId` bên trong = taskId:

```bash
python3 -c "
import json, glob
for f in sorted(glob.glob('$HOME/.claude/projects/*/*/workflows/wf_*.json')):
    d = json.load(open(f))
    print(d.get('timestamp','?')[:19], d.get('taskId','?'), d.get('runId','?'), d.get('workflowName','?'))
" | sort -r
```

Nếu chỉ có file `<taskId>.output` → tìm runId tương ứng:

```bash
grep -rl '"taskId": *"<taskId>"' ~/.claude/projects/*/*/workflows/wf_*.json
```

**Quy tắc nhớ:** runId = **tên file** `wf_<runId>.json`; taskId = **field bên trong** journal & = tên file `tasks/<taskId>.output`. Journal chứa cả 2 nên từ ID nào cũng map ra được.

---

## 6. Đọc lại prompt + output từng agent

`.jsonl` thô rất nhiễu. Cách thực dụng: viết 1 script gom `journal + agent .jsonl` thành **1 file Markdown**: bảng index + **cặp prompt đầy đủ → result đầy đủ** mỗi agent + script + result tổng.

Logic cốt lõi của script:

1. Nhận `taskId | runId | journal path` → tìm `wf_<runId>.json`.
2. Đọc `workflowProgress[]` để biết thứ tự + metadata (label, model, tokens, tools) từng agent.
3. Mỗi agent: mở `agent-<agentId>.jsonl` → lấy **prompt đầy đủ** (user message đầu tiên có text) + **result đầy đủ** (input của tool `StructuredOutput`, hoặc text assistant cuối). Thiếu `.jsonl` → fallback `promptPreview/resultPreview` trong journal.
4. Xuất 1 file `.md`.

**Auto-export bằng `Stop` hook (không phải `PostToolUse`).** Vì `Workflow` chạy ngầm và tool call trả về NGAY (mục 2), `PostToolUse` trên `Workflow` sẽ fire lúc journal **chưa** có kết quả. Ngược lại `Stop` hook chạy cuối mỗi lượt: lúc đó quét journal nào `status == "completed"` mà chưa export → export đúng-một-lần (đánh dấu bằng file marker), bất kể workflow xong ở lượt nào.

```
hooks.Stop → python3 ~/.claude/scripts/wf-export.py --hook
   → đọc transcript_path từ stdin → suy ra session dir
   → quét workflows/wf_*.json status=completed, bỏ cái đã có marker
   → render .md, ghi marker
```

---

## 7. Dùng để improve prompting skill

Khi đã có file `.md` cho mỗi run, đây là cách đọc để rút kinh nghiệm:

| Tín hiệu trong file                       | Nghĩa là                                       | Cách sửa prompt                                                     |
| ----------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| 1 agent **tokens/tools cao bất thường**   | Prompt mơ hồ → agent đi lan man, đọc thừa file | Ràng buộc phạm vi: chỉ rõ file/đường dẫn, "đừng đọc ngoài X"        |
| Result **dài dòng văn xuôi** thay vì data | Quên ép cấu trúc đầu ra                        | Dùng `schema` (StructuredOutput) thay vì để agent tự do             |
| Nhiều agent **đụng cùng vùng**            | Chia việc bị chồng                             | Tách trục rõ ràng (theo file / theo lớp / theo giả thuyết)          |
| Result **chung chung, không cite**        | Prompt thiếu yêu cầu bằng chứng                | Bắt buộc "cite file:line", "trả raw data, không phải văn cho người" |

**Insight quan trọng nhất:** so **prompt bạn viết trong `script`** với **prompt THẬT gửi cho agent** (lấy từ `.jsonl`). Hai cái có thể khác nhau vì harness chèn thêm context (ví dụ rule trong `CLAUDE.md`, system context của project). Hiểu phần "chèn thêm" này giúp bạn viết prompt gọn hơn — không lặp lại thứ harness đã tự thêm.

---

## 8. Tự verify

Mọi fact trong bài tự kiểm chứng được trên máy bạn:

```bash
# 1 workflow có đúng 1 taskId? (kỳ vọng: 1:1, không trùng)
python3 -c "
import json, glob
from collections import Counter
P=[(json.load(open(f)).get('taskId'), json.load(open(f)).get('runId'))
   for f in glob.glob('$HOME/.claude/projects/*/*/workflows/wf_*.json')]
print('runs:', len(P), '| taskId trùng:', [t for t,n in Counter(t for t,_ in P).items() if n>1] or 'KHÔNG')
"

# Agent nội bộ có dùng task system không? (kỳ vọng: KHÔNG có tasks/<agentId>.output)
# → liệt kê agentId trong 1 run rồi tìm file .output cùng tên: sẽ không thấy.

# "journal" là term Claude Code? → tìm trong mô tả tool Workflow (mục Resume):
#   "Fallback when no journal is available: Read agent-<id>.jsonl files…"
```

---

> **Liên quan:** [Claude Code: Dynamic Workflow vs Subagent — phân biệt đầy đủ](/memo/posts/claude-code-dynamic-workflows-vs-subagents/) — khi nào dùng workflow vs subagent ("ai giữ kế hoạch").
