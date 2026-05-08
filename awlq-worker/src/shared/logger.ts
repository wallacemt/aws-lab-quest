import pino from "pino";
import { config } from "../config.js";

export const logger = pino({
  level: config.worker.logLevel,
  ...(process.env.NODE_ENV !== "production" && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
});
