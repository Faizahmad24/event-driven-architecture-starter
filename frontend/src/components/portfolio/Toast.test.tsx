import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Toast from "./Toast";

afterEach(() => vi.useRealTimers());

describe("Dashboard toast", () => {
  it("dismisses success after four seconds", () => {
    vi.useFakeTimers();
    const close = vi.fn();
    render(<Toast notification={{ type: "success", message: "Changes published successfully." }} onClose={close} />);
    expect(screen.getByRole("status")).toHaveTextContent("Changes published successfully.");
    act(() => vi.advanceTimersByTime(3999));
    expect(close).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(close).toHaveBeenCalledOnce();
  });
  it("keeps errors until the user dismisses them", () => {
    vi.useFakeTimers();
    const close = vi.fn();
    render(<Toast notification={{ type: "error", message: "Unable to save content." }} onClose={close} />);
    act(() => vi.advanceTimersByTime(10000));
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to save content.");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(close).toHaveBeenCalledOnce();
  });
});
