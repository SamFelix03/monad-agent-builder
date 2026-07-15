/** Width of the floating tool library card (Tailwind `w-72`). */
export const TOOL_PANEL_CARD_WIDTH = "18rem"

/** Outer padding around the floating panel (Tailwind `p-4`). */
export const TOOL_PANEL_OUTER_PADDING = "1rem"

/** Total horizontal space the tool panel occupies from the left edge. */
export const TOOL_PANEL_FOOTPRINT = `calc(${TOOL_PANEL_CARD_WIDTH} + ${TOOL_PANEL_OUTER_PADDING} * 2)`

/** Left offset for toolbar and zoom controls beside the panel. */
export const TOOL_PANEL_CHROME_LEFT = `calc(${TOOL_PANEL_FOOTPRINT} + 0.5rem)`
