import { AppEvents, declareIndexPlugin, ReactRNPlugin, Rem, RichTextInterface, WidgetLocation } from '@remnote/plugin-sdk';
import '../style.css';
import '../App.css';
import {clozeHintsPowerupCode, hintsSlotCode, hintsStorageKey, inputProps } from '../lib/constants';
import * as Re from 'remeda';

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.app.registerPowerup(
    "Cloze Hint",
    clozeHintsPowerupCode,
    "Add hints to clozes",
    {
      slots: [{
        hidden: true,
        code: hintsSlotCode,
        name: "Hints",
      }],
    }
  );

  await plugin.app.registerWidget(
    "cloze_hint_input",
    WidgetLocation.FloatingWidget,
    {dimensions: {height: "auto", width: "250px"}},
  )

  // TODO: just have one command to add / edit cloze hint
  await plugin.app.registerCommand({
    id: `editClozeHint`,
    name: `Edit Cloze Hint`,
    action: async () => {
      const sel = await plugin.editor.getSelectedText();
      const pos = sel?.range.start
      const rem = await plugin.focus.getFocusedRem();
      if (!rem?.hasPowerup(clozeHintsPowerupCode)) {
        return
      }
      const text = await plugin.editor.getFocusedEditorText();
      if (!text || !pos ) {
        return;
      }
      const idx = await plugin.richText.indexOfElementAt(text, pos);
      if (!text[idx].cId) {
        return;
      }

      console.log(text[idx].cId)

     // const caretPos = await plugin.editor.getCaretPosition();
     //  if (caretPos) {
     //    await plugin.storage.setLocal(inputProps, { editCid: text[idx].cId })
     //    await plugin.window.openFloatingWidget("cloze_hint_input", {top: caretPos.top + 25, left: caretPos.left})
     //  }
    }
  })

  await plugin.app.registerCommand({
    id: `clozeWithHint`,
    name: `Cloze Hint`,
    action: async () => {
      const selRichText = (await plugin.editor.getSelectedText())?.richText || [];
      const empty = await plugin.richText.empty(selRichText);
      if (empty) {
        return;
      }
      const caretPos = await plugin.editor.getCaretPosition();
      if (caretPos) {
        await plugin.window.openFloatingWidget("cloze_hint_input", {top: caretPos.top + 25, left: caretPos.left})
      }
    },
  })

  const getHints = async (rem: Rem): Promise<Record<string, string>> => {
    const hintsAsStr = await rem.getPowerupProperty(clozeHintsPowerupCode, hintsSlotCode)
    try {
      return JSON.parse(hintsAsStr) as Record<string, string>;
    }
    catch(e) {
      return {}
    }
  }

  const loadAllHints = async (): Promise<void> => {
    const powerup = await plugin.powerup.getPowerupByCode(clozeHintsPowerupCode);
    const taggedRem = (await powerup?.taggedRem()) || [];
    const allHints = (await Promise.all(taggedRem.map(getHints))).reduce((acc, x) => Re.merge(acc, x), {})
    await plugin.storage.setLocal(hintsStorageKey, allHints);
  }

  await loadAllHints();

  const registerQueueCSS = async () => {
    const allHints = (await plugin.storage.getLocal<Record<string, string>>(hintsStorageKey)) || {}
    let css = ''
    Object.entries(allHints).map(([key, value]) => {
      css += `[data-cloze-id="${key}"]::before {
        content: "${value}";
      }\n`
    })
    await plugin.app.registerCSS("powerup", css);
  }

  const registerMainCSS = async () => {
    const allHints = (await plugin.storage.getLocal<Record<string, string>>(hintsStorageKey)) || {}
    let css = ''
    Object.entries(allHints).map(([key, value]) => {
      css += `.cloze-id-${key}::after {
        content: " (${value})";
        opacity: 0.5;
      }\n`
    })
    await plugin.app.registerCSS("powerup", css);
  }

  plugin.event.addListener(
    AppEvents.PowerupSlotChanged,
    `${clozeHintsPowerupCode}.${hintsSlotCode}`,
    async (data) => {
      const {remId} = data;
      const rem = await plugin.rem.findOne(remId);
      if (!rem) {
        return;
      }
      const allHints = await plugin.storage.getLocal<Record<string, string>>(hintsStorageKey);
      const remHints = await getHints(rem);
      const newAllHints = Re.merge(allHints, remHints);
      await plugin.storage.setLocal(hintsStorageKey, newAllHints);
      await registerMainCSS();
  })

  const url = await plugin.window.getURL();
  if (url.startsWith('/flashcards')) {
    await registerQueueCSS();
  }
  else {
    registerMainCSS();
  }

  let lastURL: string | undefined;
  plugin.event.addListener(AppEvents.URLChange, undefined, async ({pathname}) => {
    if ((pathname as string).startsWith('/flashcards')) {
      registerQueueCSS();
    }
    else if (lastURL?.startsWith('/flashcards')) {
      registerMainCSS();
    }
    lastURL = pathname
  })

  plugin.event.addListener(AppEvents.GlobalRemChanged, undefined, async (data) => {
    if ((data.changes?.text || data.changes?.backText) && data.old) {
      const prevText: RichTextInterface = data.old.text.concat(data.old.backText);
      const newText: RichTextInterface = (data.changes?.text || data.old.text).concat(data.changes?.backText || data.old.backText)
      const prevcIds = prevText.filter(x => x?.cId).map(x => x.cId);
      const newcIds = newText.filter(x => x?.cId).map(x => x.cId);
      const removedcIds = Re.difference(prevcIds, newcIds);
      if (removedcIds.length > 0) {
        const allHints = (await plugin.storage.getLocal<Record<string, string>>(hintsStorageKey)) || {}
        const updatedAllHints = Object.entries(allHints).filter(([k]) => !removedcIds.includes(k))
        await plugin.storage.setLocal(hintsStorageKey, updatedAllHints);
      }
    }
  })
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
