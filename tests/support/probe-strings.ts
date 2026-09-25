/** IP52: the escaping probe's two literals. PROBE_HOSTILE is the positive control: rendered by Obsidian it must
 *  produce every link, embed, tag, highlight, math span, external link and HTML element, and hide the `%%`
 *  comment. PROBE_ESCAPED is the same text with every marker backslash-escaped: it must produce none of them.
 *  Task 2 pins `noteText(PROBE_HOSTILE) === PROBE_ESCAPED`, so the native proof applies to the real function.
 *  IPF15: the URL host must contain a dot (`x.io`, not `x`), or Obsidian never autolinks the bare URL. */
export const PROBE_HOSTILE = '[[x]] ![[x]] #tag $x$ %%c%% ==x== ^block https://x.io www.x.io <b>h</b>';
export const PROBE_ESCAPED = '\\[\\[x\\]\\] \\!\\[\\[x\\]\\] \\#tag \\$x\\$ \\%\\%c\\%\\% \\=\\=x\\=\\= \\^block https\\://x.io www\\.x.io \\<b\\>h\\</b\\>';
