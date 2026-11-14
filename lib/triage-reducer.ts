import {
  inputSchema,
  triage,
  type TriageInput,
  type TriageResult,
} from "./engine.ts";
import { SCENARIOS } from "./content/scenarios.ts";
export type TriageStatus = "idle" | "dirty" | "running" | "error";
export type TriageState = {
  /**
   * The message of the sample scenario whose operator details (days elapsed,
   * responsibility...) are still in the inputs; null once the user owns them.
   */
  scenarioMessage: string | null;
  input: TriageInput;
  submittedInput: TriageInput;
  submittedMessage: string;
  result: TriageResult;
  status: TriageStatus;
  error: string | null;
  hasRun: boolean;
  requestId: string | null;
  pendingInput: TriageInput | null;
  masked: boolean;
  revealed: boolean;
  revealUntil: number;
};
export type TriageAction =
  | { type: "scenario/select"; index: number }
  | { type: "input/edit"; patch: Partial<TriageInput> }
  | { type: "input/replace"; input: TriageInput }
  | { type: "run/start"; requestId: string; input: TriageInput }
  | { type: "run/success"; requestId: string; result: TriageResult }
  | { type: "run/error"; requestId: string; message: string }
  | { type: "run/cancel"; requestId?: string }
  | { type: "privacy/toggle" }
  | { type: "privacy/hide" };
export const REVEAL_WINDOW_MS = 15_000;
/** Include every field that can affect a decision; normalize default/unknown forms. */
export function inputsMatch(left: TriageInput, right: TriageInput): boolean {
  const a = inputSchema.safeParse(left),
    b = inputSchema.safeParse(right);
  if (!a.success || !b.success) return false;
  const normalize = (v: typeof a.data) =>
    Object.keys(inputSchema.shape).map(
      (key) => v[key as keyof typeof v] ?? null,
    );
  return (
    JSON.stringify(normalize(a.data)) === JSON.stringify(normalize(b.data))
  );
}
export function initialTriageState(): TriageState {
  const input = { ...SCENARIOS[0]!.input };
  return {
    input,
    submittedInput: { ...input },
    submittedMessage: input.message,
    result: triage(input),
    status: "idle",
    error: null,
    hasRun: false,
    requestId: null,
    pendingInput: null,
    masked: true,
    revealed: false,
    revealUntil: 0,
    scenarioMessage: input.message,
  };
}

/** Operator details that a sample scenario fills in. */
const SCENARIO_CONTEXT = [
  "reporting_delay_working_days",
  "elapsed_calendar_days",
  "responsibility",
  "account_tier",
  "transaction_date",
] as const;

export const isStale = (state: TriageState) =>
  !inputsMatch(state.input, state.submittedInput);
export function triageReducer(
  state: TriageState,
  action: TriageAction,
): TriageState {
  switch (action.type) {
    case "scenario/select": {
      const scenario = SCENARIOS[action.index];
      if (!scenario) return state;
      const input = { ...scenario.input };
      return {
        ...initialTriageState(),
        input,
        submittedInput: { ...input },
        submittedMessage: input.message,
        result: triage(input),
        scenarioMessage: input.message,
      };
    }
    case "input/edit":
    case "input/replace": {
      let input =
        action.type === "input/edit"
          ? { ...state.input, ...action.patch }
          : { ...action.input };
      let scenarioMessage = action.type === "input/edit" ? state.scenarioMessage : null;
      if (action.type === "input/edit" && scenarioMessage !== null) {
        const patch = action.patch;
        if (SCENARIO_CONTEXT.some((key) => key in patch)) {
          // The user is editing the details: they own them now.
          scenarioMessage = null;
        } else if (
          patch.message !== undefined &&
          !patch.message.startsWith(scenarioMessage.slice(0, 24))
        ) {
          // A new message of the user's own: the sample's hidden details
          // (e.g. "0 days elapsed") must not leak into its assessment.
          const own = { ...input };
          for (const key of SCENARIO_CONTEXT) delete own[key];
          input = own;
          scenarioMessage = null;
        }
      }
      return {
        ...state,
        input,
        scenarioMessage,
        error: null,
        status:
          state.status === "running"
            ? "running"
            : inputsMatch(input, state.submittedInput)
              ? "idle"
              : "dirty",
      };
    }
    case "run/start":
      return {
        ...state,
        requestId: action.requestId,
        pendingInput: { ...action.input },
        status: "running",
        error: null,
        masked: true,
        revealed: false,
        revealUntil: 0,
      };
    case "run/success": {
      if (state.requestId !== action.requestId || !state.pendingInput)
        return state;
      return {
        ...state,
        submittedInput: { ...state.pendingInput },
        submittedMessage: state.pendingInput.message,
        result: action.result,
        status: inputsMatch(state.input, state.pendingInput) ? "idle" : "dirty",
        error: null,
        hasRun: true,
        requestId: null,
        pendingInput: null,
        masked: true,
        revealed: false,
        revealUntil: 0,
      };
    }
    case "run/error":
      if (state.requestId !== action.requestId) return state;
      return {
        ...state,
        status: "error",
        error: action.message,
        requestId: null,
        pendingInput: null,
      };
    case "run/cancel":
      if (action.requestId && state.requestId !== action.requestId)
        return state;
      return {
        ...state,
        status: isStale(state) ? "dirty" : "idle",
        error: null,
        requestId: null,
        pendingInput: null,
      };
    case "privacy/toggle":
      return state.masked
        ? {
            ...state,
            masked: false,
            revealed: true,
            revealUntil: Date.now() + REVEAL_WINDOW_MS,
          }
        : { ...state, masked: true, revealed: false, revealUntil: 0 };
    case "privacy/hide":
      return { ...state, masked: true, revealed: false, revealUntil: 0 };
  }
}
