export const JOB_STATUSES = [
  "scheduled",
  "in_progress",
  "waiting_parts",
  "completed",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const OPEN_JOB_STATUSES = JOB_STATUSES.filter((s) => s !== "cancelled");

export const STATUS_LABEL: Record<JobStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  waiting_parts: "Waiting parts",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATUS_TONE: Record<JobStatus, "amber" | "green" | "red" | "steel"> =
  {
    scheduled: "steel",
    in_progress: "amber",
    waiting_parts: "red",
    completed: "green",
    cancelled: "steel",
  };

export const PAY_METHODS = ["cash", "zelle", "venmo", "card", "check"] as const;
export type PayMethod = (typeof PAY_METHODS)[number];

export const PAY_LABEL: Record<PayMethod, string> = {
  cash: "Cash",
  zelle: "Zelle",
  venmo: "Venmo",
  card: "Card",
  check: "Check",
};
