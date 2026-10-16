export type TextFormatNode = { type: "text"; value: string };
export type StyledFormatNode = {
  type: "bold" | "italic" | "strike";
  children: FormatNode[];
};
export type FormatNode = TextFormatNode | StyledFormatNode;

const nodeType = {
  "*": "bold",
  _: "italic",
  "~": "strike",
} as const;
type Marker = keyof typeof nodeType;

function appendText(nodes: FormatNode[], value: string) {
  if (!value) return;
  const previous = nodes.at(-1);
  if (previous?.type === "text") previous.value += value;
  else nodes.push({ type: "text", value });
}

function parseLine(line: string): FormatNode[] {
  type Frame = { marker: Marker; children: FormatNode[] };
  const root: FormatNode[] = [];
  const stack: Frame[] = [];
  const target = () => stack.at(-1)?.children ?? root;
  let inCode = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index]!;
    if (character === "`") {
      inCode = !inCode;
      appendText(target(), character);
      continue;
    }
    if (inCode || !(character in nodeType)) {
      appendText(target(), character);
      continue;
    }

    const marker = character as Marker;
    const previous = line[index - 1] ?? "";
    const next = line[index + 1] ?? "";
    if (next === marker) {
      appendText(target(), marker + marker);
      index++;
      continue;
    }
    const canOpen = next !== "" && !/\s/u.test(next);
    const canClose = previous !== "" && !/\s/u.test(previous);
    const top = stack.at(-1);

    if (top?.marker === marker && canClose) {
      stack.pop();
      target().push({ type: nodeType[marker], children: top.children });
      continue;
    }
    if (stack.some((frame) => frame.marker === marker) && canClose) {
      return [{ type: "text", value: line }];
    }
    if (canOpen) {
      stack.push({ marker, children: [] });
      continue;
    }
    appendText(target(), marker);
  }

  return stack.length ? [{ type: "text", value: line }] : root;
}

/** Parses a small, safe formatting whitelist. Malformed input is always returned as text. */
export function parseInlineFormat(text: string): FormatNode[] {
  try {
    const lines = text.split("\n");
    const nodes: FormatNode[] = [];
    lines.forEach((line, index) => {
      const parsed = parseLine(line);
      for (const node of parsed) {
        if (node.type === "text") appendText(nodes, node.value);
        else nodes.push(node);
      }
      if (index < lines.length - 1) appendText(nodes, "\n");
    });
    return nodes;
  } catch {
    return [{ type: "text", value: text }];
  }
}

function flatten(nodes: FormatNode[]): string {
  return nodes.map((node) => (node.type === "text" ? node.value : flatten(node.children))).join("");
}

/** Removes only valid format markers for inbox previews, notifications, and search. */
export function stripFormat(text: string): string {
  return flatten(parseInlineFormat(text));
}
