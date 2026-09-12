import pino from "pino";
import { config } from "./config.js";

const isProductionRuntime =
  config.ENVIRONMENT === "production" ||
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL === "1";

export const logger = pino({
  level: isProductionRuntime ? "info" : "debug",
  transport: isProductionRuntime
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
