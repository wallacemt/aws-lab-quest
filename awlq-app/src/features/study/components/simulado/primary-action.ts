export type SimuladoPrimaryAction = "confirm" | "advance" | "show-summary" | "submit";

export function resolvePrimaryAction({
  reviewEachAnswer,
  submitted,
  confirmed,
  isLast,
}: {
  reviewEachAnswer: boolean;
  submitted: boolean;
  confirmed: boolean;
  isLast: boolean;
}): SimuladoPrimaryAction {
  if (reviewEachAnswer && !submitted) {
    if (!confirmed) return "confirm";
    return isLast ? "show-summary" : "advance";
  }

  return isLast && !submitted ? "submit" : "advance";
}
