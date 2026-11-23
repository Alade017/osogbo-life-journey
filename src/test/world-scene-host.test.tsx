import { WorldCanvas } from "@/components/3d/WorldCanvas";
import { StrictMode, createContext, useContext, useEffect } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorldSceneProvider, WorldSceneViewport } from "@/components/3d/WorldSceneHost";

const state = vi.hoisted(() => ({
  mounts: 0,
  unmounts: 0,
  props: [] as Record<string, unknown>[],
}));
vi.mock("@react-three/fiber", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-three/fiber")>();
  return {
    ...actual,
    Canvas: (props: Record<string, unknown> & { children?: React.ReactNode }) => {
      useEffect(() => {
        state.mounts++;
        return () => {
          state.unmounts++;
        };
      }, []);
      state.props.push(props);
      return <div data-testid="renderer">{props.children}</div>;
    },
  };
});
const Context = createContext("missing");
function Scene({ name }: { name: string }) {
  return (
    <span>
      {name}:{useContext(Context)}
    </span>
  );
}
function Game({ scene }: { scene: string | null }) {
  return (
    <Context.Provider value="game-session">
      <WorldSceneProvider>
        <WorldSceneViewport />
        {scene && (
          <section data-testid="slot">
            <WorldCanvas key={scene}>
              <Scene name={scene} />
            </WorldCanvas>
          </section>
        )}
      </WorldSceneProvider>
    </Context.Provider>
  );
}
beforeEach(() => {
  state.mounts = 0;
  state.unmounts = 0;
  state.props = [];
});
afterEach(cleanup);

it("keeps the renderer mounted across routes and idle gaps, with a fresh scene camera", async () => {
  const view = render(<Game scene="neighborhood" />);
  const renderer = await screen.findByTestId("renderer");
  const camera = state.props.at(-1)!["camera"];
  expect(screen.getByText("neighborhood:game-session")).toBeVisible();
  expect(screen.getByTestId("slot")).toContainElement(renderer);
  view.rerender(<Game scene={null} />);
  expect(state.unmounts).toBe(0);
  expect(state.props.at(-1)!["frameloop"]).toBe("never");
  expect(document.querySelector(".persistent-world-parking")).toContainElement(renderer);
  expect(screen.queryByText("neighborhood:game-session")).toBeNull();
  view.rerender(<Game scene="workplace" />);
  expect(screen.getByTestId("renderer")).toBe(renderer);
  expect(state.props.at(-1)!["camera"]).not.toBe(camera);
  expect(screen.queryByText("neighborhood:game-session")).toBeNull();
  expect(screen.getByText("workplace:game-session")).toBeVisible();
  expect(state.mounts).toBe(1);
  view.unmount();
  expect(state.unmounts).toBe(1);
  expect(document.querySelector(".persistent-world-renderer")).toBeNull();
  expect(document.querySelector(".persistent-world-parking")).toBeNull();
});

it("keeps a concurrent preview separate, then transfers ownership when the old route leaves", async () => {
  function Views({ primary }: { primary: boolean }) {
    return (
      <WorldSceneProvider>
        <WorldSceneViewport />
        {primary && (
          <section data-testid="primary">
            <WorldCanvas>
              <span>Main world</span>
            </WorldCanvas>
          </section>
        )}
        <section data-testid="secondary">
          <WorldCanvas>
            <span>Preview</span>
          </WorldCanvas>
        </section>
      </WorldSceneProvider>
    );
  }
  const view = render(<Views primary />);
  await screen.findByText("Main world");
  const shared = screen.getByTestId("primary").querySelector('[data-testid="renderer"]');
  expect(screen.getAllByTestId("renderer")).toHaveLength(2);
  view.rerender(<Views primary={false} />);
  expect(screen.getAllByTestId("renderer")).toHaveLength(1);
  expect(screen.getByTestId("secondary")).toContainElement(shared as HTMLElement);
});

it("recovers a failed scene without destroying the shared renderer", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let broken = true;
  function Broken() {
    if (broken) throw new Error("scene failure");
    return <span>Recovered world</span>;
  }
  render(
    <WorldSceneProvider>
      <WorldSceneViewport />
      <WorldCanvas>
        <Broken />
      </WorldCanvas>
    </WorldSceneProvider>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("The 3D scene could not load");
  expect(state.unmounts).toBe(0);
  broken = false;
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Retry scene" })));
  expect(screen.getByText("Recovered world")).toBeVisible();
  expect(state.mounts).toBe(1);
  vi.restoreAllMocks();
});

it("cleans up safely under Strict Mode", async () => {
  const view = render(
    <StrictMode>
      <Game scene="neighborhood" />
    </StrictMode>,
  );
  await screen.findByTestId("renderer");
  expect(screen.getAllByTestId("renderer")).toHaveLength(1);
  view.unmount();
  expect(document.querySelector(".persistent-world-renderer")).toBeNull();
});

it("uses a standalone canvas outside an authenticated scene host", () => {
  render(
    <WorldCanvas>
      <span>Standalone preview</span>
    </WorldCanvas>,
  );
  expect(screen.getByText("Standalone preview")).toBeVisible();
  expect(state.mounts).toBe(1);
});

it("does not move the canvas DOM again when an active scene refreshes its props", async () => {
  const view = render(<Game scene="neighborhood" />);
  const anchor = screen.getByTestId("slot").firstElementChild!;
  const append = vi.spyOn(anchor, "appendChild");
  const renderer = await screen.findByTestId("renderer");
  view.rerender(<Game scene="neighborhood" />);
  expect(append).not.toHaveBeenCalled();
  expect(screen.getByTestId("renderer")).toBe(renderer);
  expect(state.mounts).toBe(1);
  append.mockRestore();
});

it("lets camera-owning overviews explicitly retain their standalone renderer", () => {
  render(
    <WorldSceneProvider>
      <WorldSceneViewport />
      <WorldCanvas persistent={false}>
        <span>Standalone map</span>
      </WorldCanvas>
    </WorldSceneProvider>,
  );
  expect(screen.getByText("Standalone map")).toBeVisible();
  expect(document.querySelector(".persistent-world-renderer")).toBeNull();
});
