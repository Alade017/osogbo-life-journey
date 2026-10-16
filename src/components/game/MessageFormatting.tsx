import { useState, type ClipboardEvent, type ReactNode, type RefObject } from "react";
import { Bold, Italic, MoreHorizontal, Strikethrough } from "lucide-react";
import { parseInlineFormat, type FormatNode } from "@/shared/format/inline-format";

const markerByFormat = { bold: "*", italic: "_", strike: "~" } as const;

function renderNodes(nodes: FormatNode[]): ReactNode {
  return nodes.map((node, index) => {
    if (node.type === "text") return node.value;
    const children = renderNodes(node.children);
    if (node.type === "bold") return <strong key={index}>{children}</strong>;
    if (node.type === "italic") return <em key={index}>{children}</em>;
    return <del key={index}>{children}</del>;
  });
}

export function FormattedMessage({ body }: { body: string }) {
  const preserveMarkers = (event: ClipboardEvent<HTMLSpanElement>) => {
    if (!window.getSelection()?.toString()) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", body);
  };
  return (
    <span className="formatted-message" onCopy={preserveMarkers}>
      {renderNodes(parseInlineFormat(body))}
    </span>
  );
}

export function MessageFormattingToolbar({
  textareaRef,
  value,
  onChange,
  disabled,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  const wrapSelection = (format: keyof typeof markerByFormat) => {
    const input = textareaRef.current;
    if (!input || disabled) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const marker = markerByFormat[format];
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + marker + selected + marker + value.slice(end);
    if (next.length > 1_000) return;
    onChange(next);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + 1, end + 1);
    });
    setMoreOpen(false);
  };

  return (
    <div className="message-format-toolbar" aria-label="Message formatting">
      <button
        type="button"
        disabled={disabled}
        aria-label="Bold"
        onClick={() => wrapSelection("bold")}
      >
        <Bold aria-hidden="true" />
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label="Italic"
        onClick={() => wrapSelection("italic")}
      >
        <Italic aria-hidden="true" />
      </button>
      <span className="message-format-more">
        <button
          type="button"
          disabled={disabled}
          aria-label="More formatting"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <MoreHorizontal aria-hidden="true" />
        </button>
        {moreOpen && (
          <button
            type="button"
            className="message-format-popover"
            aria-label="Strikethrough"
            onClick={() => wrapSelection("strike")}
          >
            <Strikethrough aria-hidden="true" /> Strikethrough
          </button>
        )}
      </span>
    </div>
  );
}
