// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EntityPicker,
  entityPickerTestExports,
  type EntityPickerSelection
} from "../../src/client/components/shared/EntityPicker.js";

const users = [
  {
    id: "user-1",
    displayName: "Alex Rivera",
    userPrincipalName: "alex@example.test",
    mail: "alex.rivera@example.test"
  },
  {
    id: "user-2",
    displayName: "Alicia Chen",
    userPrincipalName: "alicia@example.test",
    mail: null
  }
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function renderPicker(onSelect = vi.fn()) {
  render(
    <EntityPicker
      label="Primary user"
      value={null}
      onSelect={onSelect}
    />
  );
  return onSelect;
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  global.fetch = vi.fn(async () => jsonResponse(users)) as typeof fetch;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("EntityPicker", () => {
  it("clears the selected user when the search text changes", () => {
    const onClear = vi.fn();
    render(
      <EntityPicker
        label="Primary user"
        value={{ ...users[0], label: "Alex Rivera" }}
        onSelect={vi.fn()}
        onClear={onClear}
      />
    );

    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("Alex Rivera");

    fireEvent.change(input, { target: { value: "Alicia" } });

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("Alicia");
  });

  it("debounces user search by 300ms", async () => {
    renderPicker();

    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "al" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(global.fetch).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/graph/users?q=al",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("selects a highlighted result with the keyboard", async () => {
    const onSelect = renderPicker();

    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "al" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-2",
        label: "Alicia Chen"
      })
    );
  });

  it("closes on Escape", () => {
    renderPicker();

    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("renders loading, empty, and error states", async () => {
    let resolveFetch: (response: Response) => void = () => undefined;
    global.fetch = vi.fn(
      () => new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    ) as typeof fetch;

    renderPicker();
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zz" } });
    expect(screen.getByText("Searching users…")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
      resolveFetch(jsonResponse([]));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("No users found.")).toBeInTheDocument();

    cleanup();
    global.fetch = vi.fn(async () => jsonResponse({ message: "Graph is unavailable." }, 500)) as typeof fetch;
    renderPicker();
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "er" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.getByText("Graph is unavailable.")).toBeInTheDocument();
  });

  it("shows recent picks and expires old entries", () => {
    const fresh: EntityPickerSelection = {
      ...users[0],
      label: "Alex Rivera"
    };
    const expired: EntityPickerSelection = {
      ...users[1],
      label: "Alicia Chen"
    };
    window.localStorage.setItem(
      entityPickerTestExports.RECENT_USERS_KEY,
      JSON.stringify([
        { user: fresh, pickedAt: new Date().toISOString() },
        {
          user: expired,
          pickedAt: new Date(Date.now() - entityPickerTestExports.RECENT_TTL_MS - 1000).toISOString()
        }
      ])
    );

    renderPicker();
    fireEvent.focus(screen.getByRole("combobox"));

    expect(screen.getByText("Recent users")).toBeInTheDocument();
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.queryByText("Alicia Chen")).not.toBeInTheDocument();
  });
});
