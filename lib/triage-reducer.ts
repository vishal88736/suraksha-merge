/**
 * Triage desk state.
 *
 * The desk shows a result and the message that produced it. Keeping those in
 * separate useState calls let them drift, so they live in one reducer: an
 * edit marks the desk dirty, and the view derives staleness from the state
 * instead of from a flag that can disagree with the payload on screen.
 */
import { triage, type TriageInput, type TriageResult } from "./engine.ts";
import { SCENARIOS } from "./content/scenarios.ts";

export type TriageStatus = "idle" | "dirty" | "running" | "error";

export type TriageState = {
  /** What the operator is editing. */
  input: TriageInput;
  /** The last computed or fetched result. */
  result: TriageResult;
  /** The exact message that produced `result`. */
  submittedMessage: string;
  status: TriageStatus;
  error: string | null;
  /** Whether the message is shown with PII masked. */
  masked: boolean;
  /** Whether raw PII is temporarily revealed. */
  revealed: boolean;
  /** Epoch millis after which the raw view hides itself again. */
  revealUntil: number;
};

export type TriageAction =
  | { type: "scenario/select"; index: number }
  | { type: "input/edit"; patch: Partial<TriageInput> }
  | { type: "input/replace"; input: TriageInput }
  | { type: "run/start" }
  | { type: "run/success"; result: TriageResult; submitted: string }
  | { type: "run/error"; message: string }
  | { type: "privacy/toggle" }
  | { type: "privacy/hide" };

/** How long the unmasked message stays on screen. */
export const REVEAL_WINDOW_MS = 15_000;

export function initialTriageState(): TriageState {
  const first = SCENARIOS[0]!.input;
  return {
    input: { ...first },
    result: triage(first),
    submittedMessage: first.message,
    status: "idle",
    error: null,
    masked: true,
    revealed: false,
    revealUntil: 0,
  };
}

export function triageReducer(
  state: TriageState,
  action: TriageAction,
): TriageState {
  switch (action.type) {
    case "scenario/select": {
      const next = SCENARIOS[action.index]!.input;
      return {
        ...state,
        input: { ...next },
        result: triage(next),
        submittedMessage: next.message,
        status: "idle",
        error: null,
        // A new scenario must never inherit an unmasked view.
        masked: true,
        revealed: false,
        revealUntil: 0,
      };
    }
    case "input/edit":
      return {
        ...state,
        input: { ...state.input, ...action.patch },
        // The result on screen no longer describes the message in the box.
        status: state.status === "running" ? "running" : "dirty",
      };
    case "input/replace":
      return {
        ...state,
        input: { ...action.input },
        status: state.status === "running" ? "running" : "dirty",
      };
    case "run/start":
      return { ...state, status: "running", error: null };
    case "run/success":
      return {
        ...state,
        result: action.result,
        submittedMessage: action.submitted,
        status: "idle",
        error: null,
        masked: true,
        revealed: false,
        revealUntil: 0,
      };
    case "run/error":
      return { ...state, status: "error", error: action.message };
    case "privacy/toggle":
      if (state.masked)
        return {
          ...state,
          masked: false,
          revealed: true,
          revealUntil: Date.now() + REVEAL_WINDOW_MS,
        };
      return { ...state, masked: true, revealed: false, revealUntil: 0 };
    case "privacy/hide":
      return { ...state, masked: true, revealed: false, revealUntil: 0 };
    default:
      return state;
  }
}

/** True when the result on screen does not match the message in the box. */
export function isStale(state: TriageState): boolean {
  return state.submittedMessage !== state.input.message;
}
