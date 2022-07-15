import { declareIndexPlugin, ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import '../style.css';
import '../App.css';
import {clozeHintsPowerupCode, hintsSlotCode} from '../lib/constants';
import {updateCSS} from '../lib/utils';

async function onActivate(plugin: ReactRNPlugin) {

  await plugin.app.registerPowerup(
    "Cloze Hint",
    clozeHintsPowerupCode,
    "Add hints to clozes",
    {
      slots: [{
        code: hintsSlotCode,
        name: "Hints",
      }],
    }
  );

  const loadAllHints = async () => {
    const allHints: Record<string, string> = {}
    const powerup = await plugin.powerup.getPowerupByCode(clozeHintsPowerupCode);
    const taggedRem = (await powerup?.taggedRem()) || [];
    await Promise.all(
      taggedRem.map(async rem => {
        const hintsAsStr = await rem.getPowerupProperty(clozeHintsPowerupCode, hintsSlotCode)
        try {
          const hints = JSON.parse(hintsAsStr) as Record<string, string>;
          Object.entries(hints).forEach(([k, v]) => { allHints[k] = v })
        }
        catch(e) {
        }
      })
    )
    return allHints;
  }

  const allHints = await loadAllHints();
  await updateCSS(plugin, allHints);

  await plugin.app.registerWidget(
    "cloze_hint_input",
    WidgetLocation.FloatingWidget,
    {dimensions: {height: "auto", width: "250px"}},
  )

  await plugin.app.registerCommand({
    id: `clozeWithHint`,
    name: `Add a cloze with a hint`,
    keyboardShortcut: "opt+z",
    action: async () => {
      const selRichText = await plugin.editor.getSelectedRichText();
      const selPlainText = await plugin.richText.toString(selRichText);
      if (!selPlainText) {
        console.log("no selected text")
        return;
      }
      const caretPos = await plugin.editor.getCurrentCaretDOMRect();
      if (caretPos) {
        await plugin.window.openFloatingWidget("cloze_hint_input", {top: caretPos.top + 25, left: caretPos.left})
      }
    },
  })
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
