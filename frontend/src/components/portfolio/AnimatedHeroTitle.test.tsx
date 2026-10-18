import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AnimatedHeroTitle from "./AnimatedHeroTitle";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Animated hero title", () => {
  it("waits for entrance, types both lines, pauses, deletes and repeats", () => {
    vi.useFakeTimers();
    const { container, unmount } = render(<AnimatedHeroTitle role="Go" tagline="Dev" />);
    const text = () => Array.from(container.querySelectorAll(".typing-text")).map(node => node.textContent).join("");
    expect(screen.getByRole("heading", { name: "Go Dev" })).toBeInTheDocument();
    expect(text()).toBe("");
    act(() => vi.advanceTimersByTime(1099));
    expect(text()).toBe("");
    act(() => vi.advanceTimersByTime(1));
    expect(text()).toBe("G");
    act(() => vi.advanceTimersByTime(4 * 120));
    expect(text()).toBe("GoDev");
    act(() => vi.advanceTimersByTime(2999));
    expect(text()).toBe("GoDev");
    act(() => vi.advanceTimersByTime(1 + 4 * 35));
    expect(text()).toBe("");
    act(() => vi.advanceTimersByTime(120));
    expect(text()).toBe("G");
    expect(container.querySelector(".typing-space")).toHaveTextContent("Go");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shows the complete text without timers for reduced motion", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const { container } = render(<AnimatedHeroTitle role="Go" tagline="Dev" />);
    expect(container.querySelectorAll(".typing-text")[0]).toHaveTextContent("Go");
    expect(container.querySelectorAll(".typing-text")[1]).toHaveTextContent("Dev");
    expect(container.querySelector(".typing-cursor")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
