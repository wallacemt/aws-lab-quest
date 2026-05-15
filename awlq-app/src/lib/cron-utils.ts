export type ScheduleForm = {
  frequency: "hourly" | "daily" | "weekly" | "custom";
  hour: number;
  minute: number;
  dayOfWeek: number;
  custom: string;
};

const DAY_NAMES = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
const DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function parseCronToHuman(pattern: string): string {
  const parts = pattern.trim().split(/\s+/);
  if (parts.length !== 5) return pattern;

  const [min, hour, dom, month, dow] = parts as [string, string, string, string, string];

  if (min === "*" && hour === "*" && dom === "*" && month === "*" && dow === "*") {
    return "A cada minuto";
  }

  const isEveryHour = min !== "*" && hour === "*" && dom === "*" && month === "*" && dow === "*";
  if (isEveryHour) {
    const m = parseInt(min, 10);
    return `A cada hora aos ${pad(isNaN(m) ? 0 : m)} minutos`;
  }

  if (min === "0" && hour !== "*" && dom === "*" && month === "*" && dow === "*") {
    const h = parseInt(hour, 10);
    return `Todo dia as ${pad(isNaN(h) ? 0 : h)}:00 UTC`;
  }

  if (min !== "*" && hour !== "*" && dom === "*" && month === "*" && dow === "*") {
    const m = parseInt(min, 10);
    const h = parseInt(hour, 10);
    if (!isNaN(m) && !isNaN(h)) {
      return `Todo dia as ${pad(h)}:${pad(m)} UTC`;
    }
  }

  if (min !== "*" && hour !== "*" && dom === "*" && month === "*" && dow !== "*") {
    const m = parseInt(min, 10);
    const h = parseInt(hour, 10);
    const d = parseInt(dow, 10);
    if (!isNaN(m) && !isNaN(h) && !isNaN(d) && d >= 0 && d <= 6) {
      return `Todo ${DAY_NAMES[d]} as ${pad(h)}:${pad(m)} UTC`;
    }
  }

  if (hour === "*" && dom === "*" && month === "*" && dow === "*") {
    return "A cada hora";
  }

  return pattern;
}

export function cronToScheduleForm(pattern: string): ScheduleForm {
  const parts = pattern.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { frequency: "custom", hour: 0, minute: 0, dayOfWeek: 0, custom: pattern };
  }

  const [min, hour, dom, month, dow] = parts as [string, string, string, string, string];

  if (hour === "*" && dom === "*" && month === "*" && dow === "*") {
    return { frequency: "hourly", hour: 0, minute: parseInt(min, 10) || 0, dayOfWeek: 0, custom: pattern };
  }

  const h = parseInt(hour, 10);
  const m = parseInt(min, 10);
  const d = parseInt(dow, 10);

  if (!isNaN(h) && !isNaN(m) && dom === "*" && month === "*" && dow !== "*" && !isNaN(d)) {
    return { frequency: "weekly", hour: h, minute: m, dayOfWeek: d, custom: pattern };
  }

  if (!isNaN(h) && !isNaN(m) && dom === "*" && month === "*" && dow === "*") {
    return { frequency: "daily", hour: h, minute: m, dayOfWeek: 0, custom: pattern };
  }

  return { frequency: "custom", hour: 0, minute: 0, dayOfWeek: 0, custom: pattern };
}

export function scheduleFormToCron(form: ScheduleForm): string {
  if (form.frequency === "custom") return form.custom;
  if (form.frequency === "hourly") return `${form.minute} * * * *`;
  if (form.frequency === "daily") return `${form.minute} ${form.hour} * * *`;
  if (form.frequency === "weekly") return `${form.minute} ${form.hour} * * ${form.dayOfWeek}`;
  return form.custom;
}

export { DAY_SHORT };
