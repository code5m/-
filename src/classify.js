const QUOTA_RE = /\b(codex|chatgpt\s*work|usage|quota|limit|allowance|cap|5\s*hour|weekly|banked|global\s+reset)\b/i;
const RESET_RE = /\b(reset|resets|resetting|processed|propagat(?:e|ed|ing)|restored|refill(?:ed)?|refresh(?:ed)?)\b/i;
const COMPLETED_RE = /\b(reset (?:has been |is )?(?:processed|complete|completed|done)|limits? (?:have been )?reset|propagat(?:ed|ing)|restored|refilled)\b/i;
const BANKED_RE = /\bbanked\s+reset|reset\s+bank|banked\b/i;
const VAGUE_RE = /\b(soon|maybe|hopefully|thinking|need to|trying|working on it)\b/i;
const ACTIONABLE_TIME_RE = /\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(?::\d{2})?\s*(?:am|pm)|in\s+\d+\s+(?:minute|minutes|hour|hours|day|days)|pst|pdt|pt|utc|gmt)\b/i;
const AUTHORITATIVE_COMPLETED_RE = /\b(?:the\s+)?reset\s+has\s+been\s+(?:processed|completed)|\breset\s+processed\b/i;

export function classifyPost(text = "") {
  const normalized = String(text).replace(/\s+/g, " ").trim();
  const quota = QUOTA_RE.test(normalized);
  const reset = RESET_RE.test(normalized);
  const completed = COMPLETED_RE.test(normalized);
  const authoritativeCompleted = AUTHORITATIVE_COMPLETED_RE.test(normalized);
  const banked = BANKED_RE.test(normalized);
  const actionableTime = ACTIONABLE_TIME_RE.test(normalized);
  const vagueOnly = VAGUE_RE.test(normalized) && !completed && !authoritativeCompleted && !banked && !actionableTime;

  let kind = "ignore";
  let actionable = false;

  if (authoritativeCompleted) {
    kind = "completed";
    actionable = true;
  } else if (quota && reset) {
    if (completed) {
      kind = "completed";
      actionable = true;
    } else if (banked) {
      kind = "banked";
      actionable = true;
    } else if (actionableTime) {
      kind = "scheduled";
      actionable = true;
    } else {
      kind = "hint";
    }
  }

  return { kind, actionable, vagueOnly, normalized };
}
