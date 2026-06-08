import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { pluginDirFromImportMeta, registerVisualPrimitives } from "./src/extension.ts";

export default function (pi: ExtensionAPI): void {
  registerVisualPrimitives(pi, { pluginDir: pluginDirFromImportMeta(import.meta.url) });
}
