import pino from "pino";
import { config } from "./config.js";

export const logger = pino({
  level: config.ENVIRONMENT === "production" ? "info" : "debug",
  transport:
    config.ENVIRONMENT === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
});
