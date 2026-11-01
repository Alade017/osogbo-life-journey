import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MessageBubble } from "@/components/game/MessageBubble";

class Pointer extends MouseEvent {
  pointerType: string;
  constructor(type: string, init: PointerEventInit) {
    super(type, init);
    this.pointerType = init.pointerType ?? "mouse";
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("PointerEvent", Pointer);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function mount() {
  const actions = vi.fn(),
    reply = vi.fn(),
    star = vi.fn();
  const view = render(
    <ol>
      <MessageBubble
        messageId="m"
        label="Message actions"
        className="phone-message-bubble"
        onActions={actions}
        onReply={reply}
        onStar={star}
      >
        Hello<button type="button">Play audio</button>
      </MessageBubble>
    </ol>,
  );
  return { ...view, bubble: screen.getByRole("listitem"), actions, reply, star };
}
it("opens actions on a single click or keyboard and stars on double click", () => {
  const { bubble, actions, star } = mount();
  fireEvent.click(bubble);
  vi.advanceTimersByTime(270);
  expect(actions).toHaveBeenCalledOnce();
  actions.mockClear();
  fireEvent.click(bubble);
  fireEvent.doubleClick(bubble);
  vi.advanceTimersByTime(300);
  expect(star).toHaveBeenCalledOnce();
  expect(actions).not.toHaveBeenCalled();
  fireEvent.keyDown(bubble, { key: "Enter" });
  expect(actions).toHaveBeenCalledOnce();
});
it("replies on a horizontal swipe without triggering a menu", () => {
  const { bubble, reply, actions } = mount();
  fireEvent.pointerDown(bubble, { clientX: 10, clientY: 20, pointerType: "touch", button: 0 });
  fireEvent.pointerMove(bubble, { clientX: 90, clientY: 22 });
  fireEvent.pointerUp(bubble, { clientX: 90, clientY: 22, pointerType: "touch" });
  fireEvent.click(bubble);
  vi.advanceTimersByTime(600);
  expect(reply).toHaveBeenCalledOnce();
  expect(actions).not.toHaveBeenCalled();
});
it("does not interpret vertical scrolling or playback controls as message actions", () => {
  const { bubble, reply, actions } = mount();
  fireEvent.pointerDown(bubble, { clientX: 10, clientY: 20, button: 0 });
  fireEvent.pointerMove(bubble, { clientX: 15, clientY: 100 });
  fireEvent.pointerUp(bubble, { clientX: 15, clientY: 100 });
  fireEvent.click(screen.getByRole("button", { name: "Play audio" }));
  vi.advanceTimersByTime(600);
  expect(reply).not.toHaveBeenCalled();
  expect(actions).not.toHaveBeenCalled();
});
it("supports touch double-tap and long press without duplicate actions", () => {
  const { bubble, star, actions } = mount();
  for (let index = 0; index < 2; index++) {
    fireEvent.pointerDown(bubble, { pointerType: "touch", button: 0 });
    fireEvent.pointerUp(bubble, { pointerType: "touch" });
    fireEvent.click(bubble);
    vi.advanceTimersByTime(60);
  }
  vi.advanceTimersByTime(400);
  expect(star).toHaveBeenCalledOnce();
  expect(actions).not.toHaveBeenCalled();
  fireEvent.pointerDown(bubble, { pointerType: "touch", button: 0 });
  vi.advanceTimersByTime(510);
  fireEvent.pointerUp(bubble, { pointerType: "touch" });
  fireEvent.click(bubble);
  expect(actions).toHaveBeenCalledOnce();
});
