import { createRovingFocus, definePrimitive } from "@ui-sdk/core";

export type LaneEntriesOptions = {
  onEntryPress?: (id: string) => void;
};

export const laneEntries = definePrimitive({
  name: "lane-entries",
  options: { onEntryPress: "callback" },
  // The parameter only types the options; the state needs none of them.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  state: (options: LaneEntriesOptions) => ({ focused: null as string | null }),
  api: (context) => {
    const roving = createRovingFocus(context, { slot: "entry", key: "focused", orientation: () => "horizontal" });
    return {
      roving,
      press: (id: string) => context.options().onEntryPress?.(id),
      keydown(event: KeyboardEvent, el: HTMLElement) {
        roving.keydown(event, el);
      },
    };
  },
  slots: (slot) => ({
    root: slot({
      attrs: () => ({ role: "group" }),
    }),
    entry: slot<{ value: string }>({
      props: { value: "string" },
      attrs: (state, part) => ({ type: "button", tabindex: part.api.roving.tabIndex(state, part) }),
      press: ({ api, key }) => api.press(key),
      on: {
        keydown: (event, { el, api }) => {
          if (el) api.keydown(event as KeyboardEvent, el);
        },
      },
      bind: (el, part) => part.api.roving.bind(el, part),
    }),
  }),
});
