import type { AppTheme } from "@/lib/app-theme";

/**
 * Undo, as a reducer.
 *
 * Every edit already went through one setter, so the whole editor gets an
 * undo by that setter remembering where it has been. A reducer rather than a
 * pile of setState calls because the push has to happen in the same step as
 * the change — remembering the old theme in a separate effect races the next
 * edit, and the two disagree exactly when someone is typing fast.
 *
 * Typing is coalesced: thirty keystrokes in one field is one thing the person
 * did, and an undo that walks back through them a letter at a time is not an
 * undo anybody wants. Two edits merge only when they are the same field and
 * close together in time, so changing a heading and then a colour stays two
 * steps.
 */
export type History = { past: AppTheme[]; present: AppTheme | null; future: AppTheme[]; tag: string; at: number };

export type Update = AppTheme | null | ((d: AppTheme | null) => AppTheme | null);

export type Action =
  | { kind: "load"; theme: AppTheme }
  | { kind: "set"; update: Update; tag: string; at: number }
  | { kind: "undo" }
  | { kind: "redo" };

/** Far more than anyone walks back, far less than a memory problem. */
export const HISTORY_LIMIT = 80;
export const COALESCE_MS = 900;

export function historyReducer(state: History, action: Action): History {
  switch (action.kind) {
    case "load":
      return { past: [], present: action.theme, future: [], tag: "", at: 0 };

    case "set": {
      const next =
        typeof action.update === "function" ? action.update(state.present) : action.update;
      if (!state.present || !next) return { ...state, present: next };
      // An edit that changed nothing is not a step to walk back through.
      if (JSON.stringify(next) === JSON.stringify(state.present)) return state;

      const merge =
        Boolean(action.tag) && action.tag === state.tag && action.at - state.at < COALESCE_MS;

      return {
        past: merge ? state.past : [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
        tag: action.tag,
        at: action.at,
      };
    }

    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous || !state.present) return state;
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        tag: "",
        at: 0,
      };
    }

    case "redo": {
      const [next, ...rest] = state.future;
      if (!next || !state.present) return state;
      return {
        past: [...state.past, state.present],
        present: next,
        future: rest,
        tag: "",
        at: 0,
      };
    }
  }
}

