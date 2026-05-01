// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HelpTooltip, resetHiddenHelpTips } from "../../src/client/components/shared/HelpTooltip.js";

describe("HelpTooltip", () => {
  it("opens on keyboard focus and can be dismissed and reset", () => {
    window.localStorage.clear();

    const { rerender } = render(
      <HelpTooltip id="unit-tip">Helpful explanation for a focused control.</HelpTooltip>,
    );

    const button = screen.getByRole("button", { name: /show help/i });
    fireEvent.focus(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Helpful explanation");

    fireEvent.click(screen.getByRole("button", { name: /got it, hide this/i }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    rerender(<HelpTooltip id="unit-tip">Helpful explanation for a focused control.</HelpTooltip>);
    expect(screen.queryByRole("button", { name: /show help/i })).not.toBeInTheDocument();

    resetHiddenHelpTips();
    rerender(<HelpTooltip id="unit-tip">Helpful explanation for a focused control.</HelpTooltip>);
    expect(screen.getByRole("button", { name: /show help/i })).toBeInTheDocument();
  });
});
