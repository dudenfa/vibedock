import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

type LogLevel = "info" | "warn" | "error";

export class Logger {
  private logFilePath?: string;

  initialize(): void {
    const logDir = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(logDir, { recursive: true });
    this.logFilePath = path.join(logDir, "vibedock.log");
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.write("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.write("warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.write("error", message, data);
  }

  private write(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const payload = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    });

    if (level === "error") {
      console.error(payload);
    } else if (level === "warn") {
      console.warn(payload);
    } else {
      console.log(payload);
    }

    if (!this.logFilePath) {
      return;
    }

    fs.appendFileSync(this.logFilePath, `${payload}\n`, "utf8");
  }
}

