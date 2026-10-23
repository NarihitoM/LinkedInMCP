const RESERVED = /[\\|{}@[\]()<>#*_~]/g;
const HASHTAG = /(^|\s)#([\p{L}\p{N}_]+)/gu;

export function escapeLittleText(text: string): string {
  return text.replace(RESERVED, (character) => `\\${character}`);
}

export function toCommentary(text: string): string {
  const parts: string[] = [];
  let cursor = 0;

  for (const match of text.matchAll(HASHTAG)) {
    const [whole, leading = "", tag = ""] = match;
    const start = match.index;
    parts.push(escapeLittleText(text.slice(cursor, start) + leading));
    parts.push(`{hashtag|\\#|${escapeLittleText(tag)}}`);
    cursor = start + whole.length;
  }

  parts.push(escapeLittleText(text.slice(cursor)));
  return parts.join("");
}
