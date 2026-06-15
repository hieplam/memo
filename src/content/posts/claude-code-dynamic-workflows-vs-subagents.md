---
title: "Claude Code: Dynamic Workflow vs Subagent — phân biệt đầy đủ"
description: "Khi nào Claude Code dùng subagent, khi nào dùng dynamic workflow? Khác biệt cốt lõi nằm ở chỗ 'ai giữ kế hoạch'. Tổng hợp có dẫn nguồn về cơ chế kích hoạt, vòng đời, Script API, và các quality pattern của workflow, kèm một thí nghiệm 2 session thực tế."
pubDatetime: 2026-06-15T00:00:00Z
lang: vi
tags:
  - claude-code
  - ai-agents
  - workflows
  - subagents
  - llm
  - vietnamese
---

> Ghi chú kiến thức — xác minh ngày 2026-06-12. Nguồn: (1) transcript 2 session thực tế trên máy local, (2) tài liệu chính thức Claude Code Docs (`code.claude.com/docs`), (3) mô tả tool `Workflow`/`Agent` trong system prompt của Claude Code. Mọi fact được tag `[source]`; suy đoán chưa kiểm chứng được tag `[unverified]`.

---

## Mục lục

1. [Bối cảnh thí nghiệm — 2 session thực tế](#1-bối-cảnh-thí-nghiệm--2-session-thực-tế)
2. [Câu 1: Khi nào model dùng subagent, khi nào dùng workflow?](#2-câu-1-khi-nào-model-dùng-subagent-khi-nào-dùng-workflow)
3. [Câu 2: Khác biệt cốt lõi — "ai giữ kế hoạch"](#3-câu-2-khác-biệt-cốt-lõi--ai-giữ-kế-hoạch)
4. [Chi tiết về Subagents](#4-chi-tiết-về-subagents)
5. [Chi tiết về Dynamic Workflows](#5-chi-tiết-về-dynamic-workflows)
6. [Script API của Workflow](#6-script-api-của-workflow)
7. [Quality patterns trong workflow](#7-quality-patterns-trong-workflow)
8. [Khi nào dùng cái nào](#8-khi-nào-dùng-cái-nào)
9. [Nguồn](#9-nguồn)

---

## 1. Bối cảnh thí nghiệm — 2 session thực tế

Cùng một prompt (tìm giá Mac mini M4 24GB/512GB thấp nhất ở VN), chạy 2 lần trên model Fable/Opus:

| | Session 1 | Session 2 |
|---|---|---|
| Session ID | `4d981e63-6621-426d-93fc-2bda9dc877fc` | `d0a2ae0a-2347-4e2a-9453-df99fbe20d8a` |
| Prompt có nhắc workflow? | **Không** | **Có** — nguyên văn "tạo dynamic workflows" |
| Setting | `/effort max` | `/model` Opus 4.8 (1M context) |
| Model đã làm gì | Gọi tool **`Agent` 4 lần** (fan-out subagent) + 5 WebFetch + 1 Bash + 2 Read | Gọi tool **`Workflow` 1 lần** |
| Quy mô | ~4 subagent | Workflow spawn **14 agents, 416,398 tokens, 341 tool uses, ~10.7 phút**, chạy background |

[source: transcript `~/.claude/projects/-Users-todd-lam-WORK-ogp-ai-docs/{4d981e63...,d0a2ae0a...}.jsonl` — đếm tool_use bằng jq]

**Kết luận từ thí nghiệm:** hành vi không ngẫu nhiên. Không yêu cầu workflow → model dùng `Agent` (subagent). Yêu cầu rõ → model dùng `Workflow`. Đúng chính xác quy tắc thiết kế ở mục 2.

---

## 2. Câu 1: Khi nào model dùng subagent, khi nào dùng workflow?

### Nguyên tắc: Workflow là opt-in, Subagent là mặc định

**Subagent (tool `Agent`) không cần opt-in.** Claude tự quyết định delegate dựa trên mô tả task: *"When Claude encounters a task that matches a subagent's description, it delegates to that subagent, which works independently and returns results."* [source: [Subagents docs](https://code.claude.com/docs/en/sub-agents)]

**Workflow (tool `Workflow`) bắt buộc opt-in.** Mô tả tool trong system prompt ghi nguyên văn: *"ONLY call this tool when the user has explicitly opted into multi-agent orchestration. Workflows can spawn dozens of agents and consume a large amount of tokens; the user must request that scale, not have it inferred... For any other task — even one that would clearly benefit from parallelism — do NOT call this tool. Use the Agent tool for individual subagents."* [source: Workflow tool spec trong system prompt Claude Code]

### 4 con đường kích hoạt workflow

[source: [Dynamic workflows docs](https://code.claude.com/docs/en/workflows) + Workflow tool spec]

1. **Yêu cầu bằng lời trong prompt**: "use a workflow", "run a workflow", "fan out agents", "orchestrate this with subagents", "tạo dynamic workflows"... — *"Claude treats a direct request as the same opt-in"*. Yêu cầu phải nằm trong lời của user, không phải do model tự suy ra task "sẽ có lợi".
   - **Lưu ý lịch sử**: trước v2.1.160, từ khóa kích hoạt nguyên văn là `workflow`; từ v2.1.160 là `ultracode` (natural-language vẫn hoạt động ở cả hai). Claude Code highlight từ khóa trong input; bấm `Option+W` (macOS) / `Alt+W` để bỏ kích hoạt cho prompt đó; tắt hẳn keyword trigger trong `/config`.
2. **Từ khóa `ultracode` trong prompt**: chạy 1 task đơn lẻ dưới dạng workflow mà không đổi effort của session.
3. **`/effort ultracode` cho cả session**: kết hợp reasoning effort `xhigh` + tự động orchestration. Khi bật, Claude **tự quyết** dùng workflow cho mọi task lớn — 1 request có thể thành nhiều workflow nối tiếp (understand → change → verify). Reset khi mở session mới. Chỉ có trên model hỗ trợ `xhigh`.
   - **Quan trọng**: `/effort max` (dùng ở session 1) **không** kích hoạt workflow tự động — chỉ `ultracode` mới có cơ chế này.
4. **Chạy workflow có sẵn**: bundled workflow như `/deep-research`, workflow đã save (`.claude/workflows/` hoặc `~/.claude/workflows/`), hoặc một skill/slash command mà instructions của nó chỉ định gọi Workflow.

### Nếu thấy model dùng workflow mà không yêu cầu?

Nguyên nhân khả dĩ: (a) session đang bật `/effort ultracode`, (b) một skill tự gọi Workflow (hợp lệ theo opt-in rule), (c) model sampling không deterministic nên đôi khi diễn giải lệch — riêng (c) là **[unverified]**, không có transcript để kiểm chứng.

### Phê duyệt trước khi chạy (approval)

[source: Dynamic workflows docs]

| Permission mode | Khi nào bị hỏi |
|---|---|
| Default, accept edits | Mỗi lần chạy, trừ khi đã chọn "Yes, and don't ask again" cho workflow đó trong project đó |
| Auto | Chỉ lần đầu; chọn Yes thì ghi consent vào user settings. Bỏ qua hoàn toàn khi ultracode bật |
| Bypass permissions, `claude -p`, Agent SDK | Không bao giờ hỏi — chạy ngay |

Prompt phê duyệt hiển thị các phase dự kiến; `Ctrl+G` mở script trong editor, `Tab` chỉnh prompt trước khi chạy. **Subagent do workflow spawn luôn chạy ở mode `acceptEdits`** và kế thừa tool allowlist của bạn, bất kể mode của session — file edits được auto-approve; Bash/WebFetch/MCP ngoài allowlist vẫn có thể prompt giữa chừng.

---

## 3. Câu 2: Khác biệt cốt lõi — "ai giữ kế hoạch"

**Workflow không phải là "loại agent khác" — nó là một script JavaScript do Claude viết, để runtime thực thi, điều phối chính các subagent ở quy mô lớn.** Subagent là "the worker primitive workflows orchestrate". [source: Dynamic workflows docs]

Bảng so sánh đầy đủ 4 cơ chế multi-step, lấy nguyên từ docs chính thức [source]:

| | Subagents | Skills | Agent teams | Workflows |
|---|---|---|---|---|
| Bản chất | Một worker do Claude spawn | Instructions Claude làm theo | Một lead agent giám sát các peer session | Một script do runtime thực thi |
| Ai quyết bước tiếp theo | Claude, từng lượt | Claude, theo prompt | Lead agent, từng lượt | **Chính script** |
| Kết quả trung gian nằm đâu | Context window của Claude | Context window của Claude | Shared task list | **Biến trong script** |
| Cái gì tái sử dụng được | Định nghĩa worker | Instructions | Định nghĩa team | **Toàn bộ orchestration** |
| Quy mô | Vài task mỗi lượt | Như subagents | Vài peer chạy dài | **Hàng chục–hàng trăm agent mỗi run** |
| Bị ngắt | Chạy lại lượt | Chạy lại lượt | Teammates chạy tiếp | **Resume được trong cùng session** |

Trích docs: *"A workflow moves the plan into code. With subagents, skills, and agent teams, Claude is the orchestrator: it decides turn by turn what to spawn or assign next, and every result lands in a context window. A workflow script holds the loop, the branching, and the intermediate results itself, so Claude's context holds only the final answer."* [source]

Hệ quả thực tế:

- **Context**: subagent trả kết quả về context chính và ăn token (docs cảnh báo: *"Running many subagents that each return detailed results can consume significant context"*); workflow giữ state trong biến script, context chính chỉ nhận đáp án cuối. Đây là lý do session 2 chạy 14 agents/416k tokens mà conversation vẫn gọn.
- **Background**: workflow luôn chạy nền, session vẫn responsive; theo dõi bằng `/workflows` (xem phase, agent count, token, elapsed; phím `p` pause/resume, `x` stop, `r` restart agent, `s` save).
- **Deterministic control flow**: loop, if/else, fan-out nằm trong code — lặp lại được, đọc được, diff được giữa các run.
- **Chi phí**: workflow tốn token hơn đáng kể → đó là lý do Anthropic thiết kế opt-in (vòng lại câu 1).

---

## 4. Chi tiết về Subagents

[source: [Subagents docs](https://code.claude.com/docs/en/sub-agents)]

### Bản chất

- Mỗi subagent chạy trong **context window riêng**, với system prompt riêng, tool access riêng, permission riêng. Làm việc độc lập và trả về kết quả (summary) cho conversation chính.
- Dùng khi side task sẽ làm ngập context chính bằng search results / logs / file contents mà bạn không cần tham chiếu lại.
- Lợi ích: preserve context, enforce constraints (giới hạn tool), reuse config, specialize behavior, control cost (route task sang model rẻ như Haiku).
- **Subagent không thể spawn subagent khác** (không nesting). Tool `Task` được đổi tên thành `Agent` từ v2.1.63 (alias cũ vẫn chạy).

### Built-in subagents

| Agent | Model | Tools | Mục đích |
|---|---|---|---|
| **Explore** | Haiku | Read-only | Tìm file, search code, khám phá codebase. Có 3 mức thoroughness: quick / medium / very thorough |
| **Plan** | Inherit | Read-only | Research trong plan mode |
| **general-purpose** | Inherit | Tất cả | Task phức tạp nhiều bước, vừa explore vừa sửa |
| statusline-setup | Sonnet | — | Khi chạy `/statusline` |
| claude-code-guide | Haiku | — | Câu hỏi về tính năng Claude Code |

Explore và Plan **bỏ qua CLAUDE.md và git status** để chạy nhanh/rẻ; mọi subagent khác load cả hai. Explore/Plan là one-shot, không resume được.

### Context khởi tạo của subagent (non-fork)

Subagent bắt đầu với context **mới hoàn toàn** — không thấy lịch sử hội thoại, không thấy file Claude đã đọc. Context gồm: (1) system prompt riêng của agent + environment details (không phải full system prompt của Claude Code), (2) task message do Claude viết khi delegate, (3) CLAUDE.md toàn bộ hierarchy (trừ Explore/Plan), (4) git status snapshot (trừ Explore/Plan), (5) skills được preload qua field `skills`.

### Custom subagent

File Markdown + YAML frontmatter, đặt tại (ưu tiên giảm dần): managed settings → `--agents` CLI flag → `.claude/agents/` (project) → `~/.claude/agents/` (user) → plugin `agents/`. Quản lý qua lệnh `/agents`.

Frontmatter fields chính: `name`, `description` (bắt buộc — Claude dựa vào description để quyết định delegate); `tools` / `disallowedTools`; `model` (`sonnet`/`opus`/`haiku`/`fable`/full ID/`inherit`); `permissionMode`; `maxTurns`; `skills` (preload full nội dung skill); `mcpServers` (scope MCP riêng cho subagent); `hooks` (PreToolUse/PostToolUse/Stop scoped theo subagent); `memory` (`user`/`project`/`local` — thư mục persistent memory xuyên session); `background`; `effort`; `isolation: worktree` (chạy trong git worktree tạm, tự dọn nếu không có thay đổi); `color`; `initialPrompt`.

Thứ tự resolve model của subagent: env `CLAUDE_CODE_SUBAGENT_MODEL` → param `model` per-invocation → frontmatter `model` → model của conversation chính.

### Cách gọi

- **Tự động**: Claude match task với `description` (thêm "use proactively" vào description để khuyến khích).
- **Natural language**: "Use the test-runner subagent to fix failing tests".
- **@-mention**: `@"code-reviewer (agent)" ...` — đảm bảo subagent đó chạy.
- **Cả session là 1 agent**: `claude --agent code-reviewer` hoặc setting `"agent"` trong `.claude/settings.json`.

### Foreground vs Background

- **Foreground**: block conversation chính; permission prompt chuyển cho user.
- **Background**: chạy song song; dùng permission đã cấp trong session, **auto-deny** mọi tool call cần prompt. Ctrl+B để background một task đang chạy. Tắt bằng `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`.

### Resume & transcript

- Subagent (trừ Explore/Plan) trả về agent ID khi xong; resume qua `SendMessage` (cần `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) — giữ nguyên toàn bộ lịch sử, tiếp tục đúng chỗ dừng.
- Transcript lưu tại `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`, độc lập với compaction của conversation chính, dọn theo `cleanupPeriodDays` (mặc định 30 ngày).
- Subagent có auto-compaction riêng (mặc định ~95% capacity, chỉnh bằng `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`).

### Fork (biến thể đặc biệt)

Fork = subagent **kế thừa toàn bộ hội thoại** thay vì bắt đầu mới (cùng system prompt, tools, model, history). Tool calls của fork vẫn không vào context chính — chỉ kết quả cuối quay về. Rẻ hơn spawn subagent mới vì reuse prompt cache của parent. Gọi bằng `/fork <directive>` (mặc định bật từ v2.1.161). Fork không thể fork tiếp.

### Tắt subagent

`permissions.deny: ["Agent(Explore)", ...]` để chặn từng loại; deny tool `Agent` để chặn toàn bộ delegation.

---

## 5. Chi tiết về Dynamic Workflows

[source: [Dynamic workflows docs](https://code.claude.com/docs/en/workflows) + Workflow tool spec trong system prompt]

### Bản chất & yêu cầu

- Là **script JavaScript** Claude viết cho task bạn mô tả; **runtime thực thi ở background trong môi trường cô lập**, tách khỏi conversation.
- Yêu cầu Claude Code **v2.1.154+**; có trên mọi paid plan (Pro phải bật trong `/config`), Anthropic API, Bedrock, Vertex AI, Microsoft Foundry.
- Dùng cho: codebase-wide bug sweep, migration 500 file, research cần cross-check nguồn, draft plan từ nhiều góc độc lập trước khi chốt.

### Vòng đời một run

1. Claude viết script (bắt đầu bằng `export const meta = {name, description, phases}` — pure literal).
2. User phê duyệt (tùy permission mode — xem mục 2).
3. Runtime chạy nền; script được ghi ra file dưới `~/.claude/projects/<session>/` — đọc được, diff được, sửa được rồi relaunch bằng `{scriptPath}`.
4. Theo dõi qua `/workflows` hoặc task panel dưới ô input.
5. Kết quả cuối đổ về session một lần duy nhất.

### Giới hạn runtime

| Giới hạn | Lý do |
|---|---|
| Không nhận input user giữa run (chỉ permission prompt mới pause được) | Cần sign-off giữa các stage → chạy mỗi stage thành workflow riêng |
| Script không có filesystem/shell/Node API — agents mới là người đọc/ghi/chạy lệnh | Script chỉ điều phối |
| Tối đa **16 agent đồng thời** (= min(16, cores − 2)), ít hơn trên máy yếu | Giới hạn tài nguyên local |
| Tối đa **1.000 agent / run** | Chặn runaway loop |
| Tối đa 4.096 items / 1 lệnh pipeline()/parallel() | Lỗi tường minh, không silent truncate |
| `Date.now()`, `Math.random()`, `new Date()` không args → throw | Bảo toàn khả năng resume |

### Resume

Stop/pause rồi resume: agent đã hoàn thành trả **kết quả cache**, phần còn lại chạy live. Cùng script + cùng args → 100% cache hit. Resume chỉ trong **cùng session** — thoát Claude Code khi workflow đang chạy thì session sau chạy lại từ đầu. Relaunch bằng `Workflow({scriptPath, resumeFromRunId})`.

### Save & tái sử dụng

- `/workflows` → chọn run → phím `s` → save vào `.claude/workflows/` (project, share qua repo) hoặc `~/.claude/workflows/` (cá nhân, mọi project). Sau đó chạy như slash command `/<name>`. Trùng tên thì bản project thắng.
- Workflow đã save nhận input qua `args` (script đọc global `args`) — truyền array/object thật, không stringify.
- Bundled: `/deep-research <question>` — fan-out search nhiều góc, fetch + cross-check nguồn, vote từng claim, trả report có citation (claim không qua cross-check bị lọc).

### Chi phí & model

- Mỗi agent trong workflow dùng **model của session** trừ khi script route stage sang model khác (`opts.model`). Check `/model` trước run lớn; có thể yêu cầu dùng model nhỏ cho stage đơn giản.
- Run tính vào usage/rate limit của plan như session thường. Nên chạy thử trên slice nhỏ trước để ước chi phí.

### Tắt workflow

Toggle trong `/config`; hoặc `"disableWorkflows": true` trong `~/.claude/settings.json`; hoặc env `CLAUDE_CODE_DISABLE_WORKFLOWS=1`; org-wide qua managed settings. Khi tắt: bundled workflow biến mất, từ khóa `ultracode` vô hiệu, `ultracode` rời menu `/effort`.

---

## 6. Script API của Workflow

[source: Workflow tool spec trong system prompt Claude Code — chi tiết API này chưa thấy liệt kê đầy đủ trên trang docs public, mức độ đầy đủ của docs public là **[unverified]**]

Script là **plain JavaScript** (không TypeScript), body chạy trong async context. Các hàm có sẵn:

- **`agent(prompt, opts?)`** → Promise — spawn 1 subagent. `opts`: `label` (tên hiển thị), `phase` (gán nhóm progress), `schema` (JSON Schema → subagent bị buộc trả structured output đã validate, model tự retry nếu sai schema), `model` (override — mặc định inherit model session), `isolation: 'worktree'` (chỉ khi nhiều agent sửa file song song — tốn ~200–500ms setup + disk), `agentType` (dùng custom subagent type như `Explore`, `code-reviewer` — cùng registry với tool Agent). Trả `null` nếu user skip hoặc agent chết vì lỗi API.
- **`pipeline(items, stage1, stage2, ...)`** — mỗi item chạy qua các stage **độc lập, không barrier**: item A có thể ở stage 3 khi item B còn ở stage 1. Đây là **mặc định** cho multi-stage. Mỗi stage callback nhận `(prevResult, originalItem, index)`. Stage throw → item đó thành `null`, bỏ qua stage còn lại.
- **`parallel(thunks)`** — chạy đồng thời, **có barrier** (đợi tất cả xong). Thunk lỗi → `null` trong mảng kết quả (không bao giờ reject) → `.filter(Boolean)`. Chỉ dùng khi stage sau cần **toàn bộ** kết quả stage trước (dedup/merge toàn cục, early-exit theo tổng số, prompt tham chiếu "các finding khác").
- **`phase(title)`** — mở phase mới, nhóm các agent() sau đó trong progress view.
- **`log(message)`** — báo tiến độ cho user (narrator line).
- **`args`** — input truyền từ ngoài vào, nguyên trạng.
- **`budget`** — `{total, spent(), remaining()}`: token target từ directive kiểu "+500k" của user; hard ceiling — vượt là `agent()` throw. Dùng cho loop-until-budget.
- **`workflow(nameOrRef, args?)`** — chạy workflow khác lồng bên trong (chỉ 1 cấp), chia sẻ concurrency cap / abort / budget với run cha.

Subagent trong workflow được dặn rằng text cuối của nó **là return value** (raw data), không phải tin nhắn cho người đọc. Mọi MCP tool của session đều với tới được qua ToolSearch.

---

## 7. Quality patterns trong workflow

[source: Workflow tool spec; docs public xác nhận ý tưởng "independent agents adversarially review each other's findings" và "draft a plan from several angles"]

Vì plan nằm trong code, các pattern này chạy **deterministic và lặp lại được** — điều fan-out subagent thuần (Claude tự quyết từng lượt) không đảm bảo:

- **Adversarial verify**: với mỗi finding, spawn N skeptic độc lập được prompt để **bác bỏ**; giữ finding khi đa số không bác được. Chặn finding "nghe hợp lý nhưng sai".
- **Perspective-diverse verify**: mỗi verifier một lens khác nhau (correctness, security, perf, repro) thay vì N bản sao giống nhau.
- **Judge panel**: sinh N phương án độc lập từ các góc khác nhau (MVP-first, risk-first, user-first), chấm điểm bằng judges song song, synthesize từ bản thắng + ghép ý hay của bản thua.
- **Loop-until-dry**: với discovery không biết trước quy mô (bug, edge case), tiếp tục spawn finder tới khi K vòng liên tiếp không ra gì mới — đếm `while count < N` sẽ sót đuôi.
- **Multi-modal sweep**: các agent song song, mỗi agent search theo một cách khác (by-container, by-content, by-entity, by-time).
- **Completeness critic**: agent cuối hỏi "còn thiếu gì — modality chưa chạy, claim chưa verify, source chưa đọc?" — output thành vòng việc tiếp theo.
- **No silent caps**: nếu workflow giới hạn coverage (top-N, sampling) thì phải `log()` phần bị bỏ.

Session 2 của thí nghiệm chính là pattern **fan-out + synthesis**: 14 agent search giá song song nhiều nguồn, kết quả tổng hợp một lần.

---

## 8. Khi nào dùng cái nào

[source: tổng hợp từ cả hai trang docs]

- **Main conversation**: task cần back-and-forth, các phase chia sẻ nhiều context, thay đổi nhỏ nhanh, latency quan trọng.
- **Subagent**: side task tạo output dài mà context chính không cần (chạy test, đọc log, fetch docs); cần giới hạn tool/permission; việc tự gói gọn, trả về summary. Vài task mỗi lượt.
- **Skill**: muốn prompt/workflow tái sử dụng chạy **trong** context chính.
- **Agent teams**: cần các session độc lập chạy dài, giao tiếp với nhau qua shared task list.
- **Workflow**: task cần nhiều agent hơn mức một conversation điều phối nổi (hàng chục–trăm), hoặc muốn orchestration thành script đọc/sửa/chạy lại được, hoặc cần quality pattern lặp lại được (adversarial verify, judge panel). Chấp nhận tốn token hơn và phải opt-in.

---

## 9. Nguồn

- [Orchestrate subagents at scale with dynamic workflows — Claude Code Docs](https://code.claude.com/docs/en/workflows) (fetch 2026-06-12)
- [Create custom subagents — Claude Code Docs](https://code.claude.com/docs/en/sub-agents) (fetch 2026-06-12)
- [Introducing dynamic workflows in Claude Code — Anthropic blog](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code)
- Mô tả tool `Workflow` / `Agent` trong system prompt Claude Code (phiên bản đang chạy 2026-06-12)
- Transcript local: `~/.claude/projects/-Users-todd-lam-WORK-ogp-ai-docs/{4d981e63-6621-426d-93fc-2bda9dc877fc,d0a2ae0a-2347-4e2a-9453-df99fbe20d8a}.jsonl`
