import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Loader2, Search, UserRound } from "lucide-react";

import { apiRequest } from "../../lib/api.js";
import { cn } from "../../lib/utils.js";

export interface UserEntity {
  id: string;
  displayName: string | null;
  userPrincipalName: string | null;
  mail: string | null;
}

export interface EntityPickerSelection extends UserEntity {
  label: string;
}

interface StoredRecent {
  user: EntityPickerSelection;
  pickedAt: string;
}

const RECENT_USERS_KEY = "runway.entityPicker.recentUsers.v1";
const RECENT_LIMIT = 10;
const RECENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function entityLabel(user: UserEntity) {
  return user.displayName || user.userPrincipalName || user.mail || user.id;
}

function entitySubLabel(user: UserEntity) {
  return [user.userPrincipalName, user.mail]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(" · ");
}

function toSelection(user: UserEntity): EntityPickerSelection {
  return { ...user, label: entityLabel(user) };
}

function readRecentUsers(now = Date.now()): EntityPickerSelection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_USERS_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredRecent[]) : [];
    const fresh = parsed.filter((entry) => {
      const pickedAt = Date.parse(entry.pickedAt);
      return Number.isFinite(pickedAt) && now - pickedAt <= RECENT_TTL_MS;
    });
    if (fresh.length !== parsed.length) {
      window.localStorage.setItem(RECENT_USERS_KEY, JSON.stringify(fresh));
    }
    return fresh.map((entry) => entry.user).slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

function storeRecentUser(user: EntityPickerSelection) {
  if (typeof window === "undefined") return;
  const current = readRecentUsers();
  const next = [
    { user, pickedAt: new Date().toISOString() },
    ...current.filter((entry) => entry.id !== user.id).map((entry) => ({
      user: entry,
      pickedAt: new Date().toISOString()
    }))
  ].slice(0, RECENT_LIMIT);
  window.localStorage.setItem(RECENT_USERS_KEY, JSON.stringify(next));
}

export function EntityPicker({
  id,
  label,
  placeholder = "Search users by name, UPN, or mail",
  value,
  onSelect,
  onClear,
  autoFocus
}: {
  id?: string;
  label: string;
  placeholder?: string;
  value: EntityPickerSelection | null;
  onSelect: (user: EntityPickerSelection) => void;
  onClear?: () => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UserEntity[]>([]);
  const [recentUsers, setRecentUsers] = useState<EntityPickerSelection[]>(() => readRecentUsers());
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (value) setQuery(value.label);
  }, [value?.id, value?.label]);

  useEffect(() => {
    if (!open) return;
    setRecentUsers(readRecentUsers());
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < 2) {
      setLoading(false);
      setError(null);
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      apiRequest<UserEntity[]>(
        `/api/graph/users?q=${encodeURIComponent(trimmed)}`,
        { signal: controller.signal }
      )
        .then((users) => {
          setResults(users);
          setActiveIndex(0);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setResults([]);
          setError(err instanceof Error ? err.message : "Could not search users.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open, query]);

  const options = useMemo(() => {
    const trimmed = query.trim();
    return trimmed.length >= 2
      ? results.map(toSelection)
      : recentUsers;
  }, [query, recentUsers, results]);

  const choose = (user: EntityPickerSelection) => {
    setQuery(user.label);
    storeRecentUser(user);
    setRecentUsers(readRecentUsers());
    setOpen(false);
    onSelect(user);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(options.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter" && open && options[activeIndex]) {
      event.preventDefault();
      choose(options[activeIndex]);
    }
  };

  const trimmed = query.trim();
  const showShortQuery = open && trimmed.length > 0 && trimmed.length < 2;
  const showEmpty = open && trimmed.length >= 2 && !loading && !error && results.length === 0;
  const showRecentEmpty = open && trimmed.length === 0 && recentUsers.length === 0;

  return (
    <div className="relative">
      <label
        htmlFor={id}
        className="block text-[11px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]"
      >
        {label}
      </label>
      <div className="relative mt-1.5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--pc-text-muted)]" />
        <input
          ref={inputRef}
          id={id}
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            if (value && nextQuery !== value.label) {
              onClear?.();
            }
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls={id ? `${id}-options` : undefined}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="flex h-10 w-full rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] py-2 pl-8 pr-8 text-sm text-[var(--pc-text)] placeholder:text-[var(--pc-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pc-accent)] disabled:cursor-not-allowed disabled:opacity-50"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-[var(--pc-text-muted)]" />
        ) : null}
      </div>

      {open ? (
        <div
          id={id ? `${id}-options` : undefined}
          role="listbox"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface)] p-1 shadow-xl"
        >
          {trimmed.length === 0 && recentUsers.length > 0 ? (
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
              Recent users
            </div>
          ) : null}

          {options.map((user, index) => (
            <button
              key={user.id}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                choose(user);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                "flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left",
                index === activeIndex
                  ? "bg-[var(--pc-accent-muted)] text-[var(--pc-text)]"
                  : "text-[var(--pc-text-secondary)] hover:bg-[var(--pc-surface-raised)]"
              )}
            >
              <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--pc-accent)]" />
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-medium">{user.label}</span>
                <span className="block truncate text-[11px] text-[var(--pc-text-muted)]">
                  {entitySubLabel(user) || user.id}
                </span>
              </span>
            </button>
          ))}

          {loading ? (
            <div className="px-3 py-3 text-[12px] text-[var(--pc-text-muted)]">Searching users…</div>
          ) : null}
          {showShortQuery ? (
            <div className="px-3 py-3 text-[12px] text-[var(--pc-text-muted)]">
              Type at least 2 characters.
            </div>
          ) : null}
          {showEmpty ? (
            <div className="px-3 py-3 text-[12px] text-[var(--pc-text-muted)]">
              No users found.
            </div>
          ) : null}
          {showRecentEmpty ? (
            <div className="px-3 py-3 text-[12px] text-[var(--pc-text-muted)]">
              Search for a user to assign.
            </div>
          ) : null}
          {error ? (
            <div className="px-3 py-3 text-[12px] text-[var(--pc-critical)]">{error}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const entityPickerTestExports = {
  RECENT_USERS_KEY,
  RECENT_TTL_MS,
  readRecentUsers
};
