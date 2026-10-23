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
  const cliError = /(?:A client error \([^)]+\) occurred|An error occurred \([^)]+\)|Mensagem de falha codificada:)/i.exec(rest);
  if (cliError) {
    const errorStart = cursor + cliError.index;
    const errorText = rest.slice(cliError.index);
    // A long whitespace-free token marks the CLI payload; prose resumes after its next whitespace.
    const payload = /\S{40,}/.exec(errorText);
    const isAwsError = /^A client error|^An error occurred/i.test(errorText);
    const payloadStart = payload?.index ?? 0;
    const end = payload ? payloadStart + payload[0].length : errorText.length;
    if (!isAwsError && payload) {
      const labelEnd = errorText.indexOf(":") + 1;
      segments.push({ type: "prose", text: text.slice(cursor, errorStart + labelEnd + 1) });
    } else if (errorStart > cursor) segments.push({ type: "prose", text: text.slice(cursor, errorStart) });
    segments.push({ type: "code", language: "text", text: (isAwsError ? errorText.slice(0, end) : errorText.slice(payloadStart, end)).trim() });
    if (end < errorText.length) segments.push({ type: "prose", text: errorText.slice(end) });
  } else if (cursor < text.length) {
    appendTextSegments(segments, rest);
  }
  return segments.length ? segments : [{ type: "prose", text }];
}

function appendTextSegments(segments: StatementSegment[], text: string) {
  const lines = text.split("\n");
  let prose = "";
  const isYaml = (line: string) => /^\s*[\w-]+:(?:\s|$)|^\s*-\s/.test(line);
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const newline = index < lines.length - 1 ? "\n" : "";
    if (/^\s*(?:\$|aws\s|curl\s)/.test(line) || /`[^`]+`/.test(line)) {
      if (prose) segments.push({ type: "prose", text: prose });
      prose = "";
      segments.push({ type: "code", language: "text", text: line.replace(/`/g, "").trim() });
      index++;
      continue;
    }
    if (isYaml(line)) {
      const start = index;
      while (index < lines.length && isYaml(lines[index])) index++;
      if (index - start >= 3) {
        if (prose) segments.push({ type: "prose", text: prose });
        prose = "";
        segments.push({ type: "code", language: "text", text: lines.slice(start, index).join("\n") });
      } else {
        prose += `${lines.slice(start, index).join("\n")}${index < lines.length ? "\n" : ""}`;
      }
      continue;
    }
    prose += `${line}${newline}`;
    index++;
  }
  if (prose) segments.push({ type: "prose", text: prose });
}
