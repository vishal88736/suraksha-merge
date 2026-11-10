import { inputSchema, triage, type TriageInput, type TriageResult } from "./engine.ts";
import { SCENARIOS } from "./content/scenarios.ts";
export type TriageStatus = "idle" | "dirty" | "running" | "error";
export type TriageState = {
  input: TriageInput; submittedInput: TriageInput; submittedMessage: string;
  result: TriageResult; status: TriageStatus; error: string | null; hasRun: boolean;
  requestId: string | null; pendingInput: TriageInput | null;
  masked: boolean; revealed: boolean; revealUntil: number;
};
export type TriageAction =
  | { type: "scenario/select"; index: number }
  | { type: "input/edit"; patch: Partial<TriageInput> }
  | { type: "input/replace"; input: TriageInput }
  | { type: "run/start"; requestId: string; input: TriageInput }
  | { type: "run/success"; requestId: string; result: TriageResult }
  | { type: "run/error"; requestId: string; message: string }
  | { type: "run/cancel"; requestId?: string }
  | { type: "privacy/toggle" } | { type: "privacy/hide" };
export const REVEAL_WINDOW_MS = 15_000;
/** Include every field that can affect a decision; normalize default/unknown forms. */
export function inputsMatch(left: TriageInput, right: TriageInput): boolean {
  const a = inputSchema.safeParse(left), b = inputSchema.safeParse(right);
  if (!a.success || !b.success) return false;
  const normalize = (v: typeof a.data) => v ? { ...v, reporting_delay_working_days: v.reporting_delay_working_days ?? null, elapsed_calendar_days: v.elapsed_calendar_days ?? null, transaction_date: v.transaction_date ?? null } : null;
  return JSON.stringify(normalize(a.data)) === JSON.stringify(normalize(b.data));
}
export function initialTriageState(): TriageState {
  const input = { ...SCENARIOS[0]!.input };
  return { input, submittedInput: { ...input }, submittedMessage: input.message, result: triage(input), status: "idle", error: null, hasRun: false, requestId: null, pendingInput: null, masked: true, revealed: false, revealUntil: 0 };
}
export const isStale = (state: TriageState) => !inputsMatch(state.input, state.submittedInput);
export function triageReducer(state: TriageState, action: TriageAction): TriageState {
  switch (action.type) {
    case "scenario/select": {
      const scenario = SCENARIOS[action.index];
      if (!scenario) return state;
      const input = { ...scenario.input };
      return { ...initialTriageState(), input, submittedInput: { ...input }, submittedMessage: input.message, result: triage(input) };
    }
    case "input/edit":
    case "input/replace": {
      const input = action.type === "input/edit" ? { ...state.input, ...action.patch } : { ...action.input };
      return { ...state, input, error: null, status: state.status === "running" ? "running" : inputsMatch(input, state.submittedInput) ? "idle" : "dirty" };
    }
    case "run/start": return { ...state, requestId: action.requestId, pendingInput: { ...action.input }, status: "running", error: null, masked: true, revealed: false, revealUntil: 0 };
    case "run/success": {
      if (state.requestId !== action.requestId || !state.pendingInput) return state;
      return { ...state, submittedInput: { ...state.pendingInput }, submittedMessage: state.pendingInput.message, result: action.result, status: inputsMatch(state.input, state.pendingInput) ? "idle" : "dirty", error: null, hasRun: true, requestId: null, pendingInput: null, masked: true, revealed: false, revealUntil: 0 };
    }
    case "run/error":
      if (state.requestId !== action.requestId) return state;
      return { ...state, status: "error", error: action.message, requestId: null, pendingInput: null };
    case "run/cancel":
      if (action.requestId && state.requestId !== action.requestId) return state;
      return { ...state, status: isStale(state) ? "dirty" : "idle", error: null, requestId: null, pendingInput: null };
    case "privacy/toggle": return state.masked ? { ...state, masked: false, revealed: true, revealUntil: Date.now() + REVEAL_WINDOW_MS } : { ...state, masked: true, revealed: false, revealUntil: 0 };
    case "privacy/hide": return { ...state, masked: true, revealed: false, revealUntil: 0 };
  }
}
