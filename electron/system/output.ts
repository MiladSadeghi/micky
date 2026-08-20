export const TOOL_OUTPUT_CAP = 4_000
export const COMMAND_OUTPUT_CAP = 4_000

export function capOutput(
  value: string,
  max = TOOL_OUTPUT_CAP
): { text: string; truncated: boolean } {
  if (value.length <= max) return { text: value, truncated: false }
  return {
    text: `${value.slice(0, Math.max(0, max - 14)).trimEnd()}\n…[truncated]`,
    truncated: true
  }
}
