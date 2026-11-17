No findings in `4853bb1..e7caae9`. The output-cap leak is resolved.

- All six input shapes stayed within 600 descendant nodes, including text and truncation markers, with default caps and the character cap lifted.
- Truncation preserved valid element structures; disclosure retained exact source as one text node.
- Isolated parser timings at 16k/32k/64k were linear: `" **a"` 0.36/0.67/1.30 ms; `"**`a"` 0.32/0.62/1.61 ms.
- No new `innerHTML` or other diff regressions found.
- UI suite: 265 passed; four environment-blocked failures from temporary-directory restrictions. No files edited.

Verdict: approve exact commit e7caae9