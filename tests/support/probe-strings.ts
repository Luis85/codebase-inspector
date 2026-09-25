/** IP52: the escaping probe's two literals. PROBE_HOSTILE is the positive control: rendered by Obsidian it must
 *  produce every link, embed, tag, highlight, math span, external link and HTML element, hide the `%%` comment and
 *  register its end-of-paragraph block id. PROBE_ESCAPED is the same text with every marker backslash-escaped: it
 *  must produce none of them. Task 2 pins `noteText(PROBE_HOSTILE) === PROBE_ESCAPED`, so the native proof applies
 *  to the real function.
 *  IPF15: the URL host must contain a dot (`x.io`, not `x`), or Obsidian never autolinks the bare URL.
 *  E2: the mid-paragraph `^block` is never a block id; the trailing ` ^probe-id` is the block-id control. */
export const PROBE_HOSTILE = '[[x]] ![[x]] #tag $x$ %%c%% ==x== ^block https://x.io www.x.io <b>h</b> ^probe-id';
export const PROBE_ESCAPED = '\\[\\[x\\]\\] \\!\\[\\[x\\]\\] \\#tag \\$x\\$ \\%\\%c\\%\\% \\=\\=x\\=\\= \\^block https\\://x.io www\\.x.io \\<b\\>h\\</b\\> \\^probe-id';
