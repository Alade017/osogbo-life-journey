import { act } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { mountSceneOverlay } from "@/components/3d/scene-overlay-root";

it.each(["detached", "moved"])("cleans a focused overlay after its host was %s", async (mode) => {
  const target = document.createElement("div");
  const other = document.createElement("div");
  document.body.append(target, other);
  const entry = mountSceneOverlay(target);
  await act(async () => entry.root.render(<button>Landmark</button>));
  entry.element.querySelector("button")!.focus();
  if (mode === "moved") other.appendChild(entry.element);
  else entry.element.remove();
  const unmount = vi.spyOn(entry.root, "unmount");
  await act(async () => {
    entry.dispose();
    entry.dispose();
    expect(unmount).not.toHaveBeenCalled();
    await Promise.resolve();
  });
  expect(unmount).toHaveBeenCalledTimes(1);
  expect(other.childNodes).toHaveLength(0);
  target.remove();
  other.remove();
});

it("keeps a replayed overlay isolated from deferred cleanup of the previous root", async () => {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const first = mountSceneOverlay(target);
  await act(async () => first.root.render(<button>Old</button>));
  let second!: ReturnType<typeof mountSceneOverlay>;
  await act(async () => {
    first.dispose();
    second = mountSceneOverlay(target);
    second.root.render(<button>New</button>);
    await Promise.resolve();
  });
  expect(target.textContent).toBe("New");
  expect(target.querySelectorAll("[data-scene-overlay]")).toHaveLength(1);
  await act(async () => {
    second.dispose();
    await Promise.resolve();
  });
  target.remove();
});
