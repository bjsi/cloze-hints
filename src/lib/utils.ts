import {RNPlugin} from "@remnote/plugin-sdk";
import {cssKey} from "./constants";

export const updateCSS = async (plugin: RNPlugin, update: Record<string, string> | ((x: Record<string, string>) => Record<string, string>)) => {
  const allHints = typeof update === "function"
    ? update((await plugin.storage.getSession(cssKey)) || {})
    : update;
  await plugin.storage.setSession(cssKey, allHints);
  let css = ''
  Object.entries(allHints).map(([key, value]) => {
    css += `._${key}::before {
      content: "${value}";
    }\n`
  })
  await plugin.app.registerCSS("powerup", css);
}
