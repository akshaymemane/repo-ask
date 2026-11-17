Reviewed exact commit `4853bb1`, its fix diff and Round 3 handoff. No files changed.

1. **History restoration: resolved — `repoask/web/ask.js:89`.** The shell test “returning to Ask from any page restores conversations…” passes, including Ask → Sessions → Settings → Ask and retained rail-node identity within Ask. The late-history-response test also passes. No republish loop found.

2. **Quadratic parsing: resolved — `repoask/web/ui.js:149–166`.** The adversarial parsing test passes. Independent Node measurements with caps lifted, median of nine runs, milliseconds:

   | Input unit | 16k chars | 32k chars | 64k chars |
   |---|---:|---:|---:|
   | `" **a"` | 0.384 | 0.627 | 1.298 |
   | `"**a "` | 0.305 | 0.744 | 1.314 |
   | backtick | 0.025 | 0.047 | 0.087 |
   | space + backtick + a | 3.615 | 4.659 | 17.110 |
   | `"** "` | 1.406 | 0.808 | 1.434 |
   | `"**`a"` | 1.756 | 4.364 | 20.203 |

3. **P2 — Output cap: not fully resolved — `repoask/web/ui.js:180`.** Paragraph flushing processes every accumulated line after the budget is exhausted. `inline()` still appends remaining text at line 166, and paragraph newline nodes are unbudgeted. Independent reproduction with `renderMarkdown("x\n".repeat(9000))` creates **18,007 descendant nodes**, despite the 600-node limit. The existing bullet-cap test passes but misses this case. Stop paragraph iteration on budget exhaustion and count all emitted nodes; add a multiline-paragraph regression test.

Additional checks passed: truncation marker and full-source disclosure each contain one text node; tested cap boundaries preserve element structure; HTML-like source remains literal; no new `innerHTML`.

UI suite: **259 passed; 4 environment-blocked failures** from temporary-directory restrictions.

Verdict: request changes