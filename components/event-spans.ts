import { createChange, createSpans, definePrimitive, type ChangeDetails, type Span, type SpansDraft, type SpansMessage, type SpansReason } from "@ui-sdk/core";

export type EventSpan = Span & { title: string; label: string };

export type EventSpansOptions = {
  spans?: EventSpan[];
  defaultSpans?: EventSpan[];
  onSpansChange?: (spans: EventSpan[], details: ChangeDetails<SpansReason>) => void;
  onSpanPress?: (id: string) => void;
  describe?: (span: EventSpan) => string;
  days?: number;
};

type EventSpansState = { spans: EventSpan[]; draft: SpansDraft<EventSpan> | null; days: number };

function germanMessage({ type, label }: SpansMessage<EventSpan>): string {
  if (type === "cancel") return `${label}: Verschieben abgebrochen.`;
  if (type === "resize") return `${label}: Dauer geändert.`;
  return `${label}: verschoben.`;
}

// Dates of a course belong to it alone, so the arrows across tracks and the delete keys stay unused on the board.
const ignoredKeys = new Set(["ArrowUp", "ArrowDown", "Delete", "Backspace"]);

export const eventSpans = definePrimitive({
  name: "event-spans",
  options: { spans: "value", defaultSpans: "value", onSpansChange: "callback", onSpanPress: "callback", describe: "callback", days: "number" },
  controlled: ["spans"],
  state: (options: EventSpansOptions): EventSpansState => ({
    spans: options.spans ?? options.defaultSpans ?? [],
    draft: null,
    days: options.days ?? 100,
  }),
  sync: (options) => ({
    ...(options.spans === undefined ? {} : { spans: options.spans }),
    ...(options.days === undefined ? {} : { days: options.days }),
  }),
  api: (context) => {
    const change = createChange(context);
    const spans = createSpans<EventSpansState, EventSpan>(context, {
      key: "spans",
      draft: "draft",
      set: (value, details) => change("spans", value, details),
      axis: "x",
      min: () => 0,
      max: () => context.store.get().days,
      step: () => 1,
      minSize: () => 1,
      label: (span) => context.options().describe?.(span) ?? span.label,
      message: germanMessage,
      createAutoScroll: { edge: 40 },
    });
    return {
      spans,
      press: (id: string) => context.options().onSpanPress?.(id),
      keydown(event: KeyboardEvent, id: string) {
        if (ignoredKeys.has(event.key)) return false;
        return spans.keydown(event, id);
      },
    };
  },
  slots: (slot) => ({
    root: slot({
      bind: (_el, { api }) => {
        window.addEventListener("blur", api.spans.cancel);
        return () => window.removeEventListener("blur", api.spans.cancel);
      },
    }),
    track: slot<{ value: string }, { spans: EventSpan[] }>({
      props: { value: "string" },
      state: (state, { api, key }) => ({ spans: api.spans.spansOn(state, key) }),
      bind: (el, { api, key }) => api.spans.bindTrack(el, key),
    }),
    span: slot<{ value: string }>({
      props: { value: "string" },
      role: "button",
      focus: "native",
      press: ({ api, key }) => api.press(key),
      attrs: (state, { api, key }) => ({ type: "button", ...api.spans.spanAttrs(state, key) }),
      bind: (el, { api, key }) => api.spans.bindSpan(el, key),
      on: {
        pointerdown: (event, { api, key }) => api.spans.spanPointerdown(event as PointerEvent, key),
        keydown: (event, { api, key }) => {
          api.keydown(event as KeyboardEvent, key);
        },
      },
    }),
  }),
});
