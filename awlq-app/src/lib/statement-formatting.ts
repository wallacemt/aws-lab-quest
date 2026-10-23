export type StatementSegment = {
  type: "prose" | "code";
  text: string;
  language?: "json" | "text";
};

// Scan balanced containers, respecting JSON strings, so braces in prose and quoted values stay intact.
export function formatStatement(text: string): StatementSegment[] {
  const segments: StatementSegment[] = [];
  const containerPattern = /[\[{]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = containerPattern.exec(text))) {
    const start = match.index;
    const stack = [match[0] === "{" ? "}" : "]"];
    let quoted = false;
    let escaped = false;
    let end = start + 1;

    for (; end < text.length && stack.length; end++) {
      const char = text[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === "{" || char === "[") stack.push(char === "{" ? "}" : "]");
      else if (char === "}" || char === "]") {
        if (stack.at(-1) !== char) break;
        stack.pop();
      }
    }
    if (stack.length) continue;

    const raw = text.slice(start, end);
    let json: string | undefined;
    try {
      json = JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      continue;
    }
    if (start > cursor) segments.push({ type: "prose", text: text.slice(cursor, start) });
    segments.push({ type: "code", language: "json", text: json });
    cursor = end;
    containerPattern.lastIndex = end;
  }

  const rest = text.slice(cursor);
  const cliError = /(?:A client error \([^)]+\) occurred|An error occurred \([^)]+\))/i.exec(rest);
  if (cliError) {
    const errorStart = cursor + cliError.index;
    if (errorStart > cursor) segments.push({ type: "prose", text: text.slice(cursor, errorStart) });
    segments.push({ type: "code", language: "text", text: rest.slice(cliError.index).trim() });
  } else if (cursor < text.length) segments.push({ type: "prose", text: rest });
  return segments.length ? segments : [{ type: "prose", text }];
}
