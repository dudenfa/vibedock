import type { Session } from "electron";
import { Logger } from "./logger";

const deniedPermissions = new Set([
  "camera",
  "microphone",
  "notifications",
  "geolocation",
  "midi",
  "midiSysex",
  "pointerLock",
  "openExternal"
]);

export function applySessionSecurity(
  electronSession: Session,
  logger: Logger,
  scope: string
): void {
  electronSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (deniedPermissions.has(permission)) {
      logger.warn("Denied permission request", { permission, scope });
      callback(false);
      return;
    }

    callback(false);
  });

  electronSession.setPermissionCheckHandler((_wc, permission) => {
    if (deniedPermissions.has(permission)) {
      return false;
    }

    return false;
  });
}

