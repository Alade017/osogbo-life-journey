import { createRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormattedMessage, MessageFormattingToolbar } from "@/components/game/MessageFormatting";

function ToolbarFixture() {
  const [value, setValue] = useState("hello world");
  const ref = createRef<HTMLTextAreaElement>();
  return (
    <div>
      <MessageFormattingToolbar textareaRef={ref} value={value} onChange={setValue} />
      <textarea
        ref={ref}
        aria-label="Message"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  );
}

describe("message formatting UI", () => {
  it("wraps the current selection with the same markers accepted by the parser", () => {
    render(<ToolbarFixture />);
    const input = screen.getByLabelText("Message") as HTMLTextAreaElement;
    input.setSelectionRange(6, 11);
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(input).toHaveValue("hello *world*");
  });

  it("renders formatted content as elements without injecting HTML", () => {
    const { container } = render(<FormattedMessage body="*safe* <img src=x>" />);
    expect(container.querySelector("strong")).toHaveTextContent("safe");
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("<img src=x>");
  });
});
