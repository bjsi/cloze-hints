import {
  AppEvents,
  declareIndexPlugin,
  ReactRNPlugin,
  Rem,
  RichTextInterface,
  WidgetLocation,
} from '@remnote/plugin-sdk';
import '../style.css';
import '../App.css';
import {
  clozeHintsPowerupCode,
  hintsSlotCode,
  hintsStorageKey,
  clozePropsStorageKey as clozePropsStorageKey,
} from '../lib/constants';
import * as Re from 'remeda';
import { ClozeProps } from '../lib/types';

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.app.registerPowerup('Cloze Hint', clozeHintsPowerupCode, 'Add hints to clozes', {
    slots: [
      {
        hidden: true,
        code: hintsSlotCode,
        name: 'Hints',
      },
    ],
  });

  await plugin.app.registerWidget('cloze_hint_input', WidgetLocation.FloatingWidget, {
    dimensions: { height: 'auto', width: '250px' },
  });

  const getClozeProps = async (): Promise<ClozeProps | undefined> => {
    const sel = await plugin.editor.getSelectedText();
    const pos = sel?.range.start;
    if (sel && sel.range.start === sel.range.end) {
      // edit
      const text = await plugin.editor.getFocusedEditorText();
      if (!text || !pos) {
        return;
      }
      const idx = await plugin.richText.indexOfElementAt(text, pos);
      const cId = text[idx].cId;
      if (!cId) {
        return;
      }
      return { type: 'edit', cId };
    } else if (sel && sel.range.start !== sel.range.end) {
      return { type: 'create' };
    } else {
      return undefined;
    }
  };

  await plugin.app.registerCommand({
    id: `clozeHint`,
    name: `Cloze Hint`,
    description: 'Add a new cloze hint or edit the focused cloze hint',
    keyboardShortcut: 'mod+shift+:',
    action: async () => {
      const caretPos = await plugin.editor.getCaretPosition();
      if (!caretPos) return;
      const props = await getClozeProps();
      await plugin.storage.setSession(clozePropsStorageKey, props);
      await plugin.window.openFloatingWidget('cloze_hint_input', {
        top: caretPos.top + 25,
        left: caretPos.left,
      });
    },
  });

  const getHintsFromRem = async (rem: Rem): Promise<Record<string, string>> => {
    const hintsAsStr = await rem.getPowerupProperty(clozeHintsPowerupCode, hintsSlotCode);
    try {
      return JSON.parse(hintsAsStr) as Record<string, string>;
    } catch (e) {
      return {};
    }
  };

  const loadAllHints = async (): Promise<void> => {
    const powerup = await plugin.powerup.getPowerupByCode(clozeHintsPowerupCode);
    const taggedRem = (await powerup?.taggedRem()) || [];
    const allHints = (await Promise.all(taggedRem.map(getHintsFromRem))).reduce(
      (acc, x) => Re.merge(acc, x),
      {}
    );
    await plugin.storage.setLocal(hintsStorageKey, allHints);
  };

  await loadAllHints();

  const registerQueueCSS = async () => {
    const allHints = (await plugin.storage.getLocal<Record<string, string>>(hintsStorageKey)) || {};
    let css = '';
    Object.entries(allHints).map(([key, value]) => {
      css += `[data-cloze-id="${key}"]::before {
        content: "${value}";
      }\n`;
    });
    await plugin.app.registerCSS('powerup', css);
  };

  const registerMainAppCSS = async () => {
    const allHints = (await plugin.storage.getLocal<Record<string, string>>(hintsStorageKey)) || {};
    let css = '';
    Object.entries(allHints)
      .filter(([_, value]) => !!value)
      .map(([key, value]) => {
        css += `.cloze-id-${key}::after {
        content: " (${value})";
        opacity: 0.5;
      }\n`;
      });
    await plugin.app.registerCSS('powerup', css);
  };

  const registerInitialCSS = async () => {
    const url = await plugin.window.getURL();
    if (url.includes('/flashcards')) {
      await registerQueueCSS();
    } else {
      registerMainAppCSS();
    }
  };

  plugin.event.addListener(
    AppEvents.PowerupSlotChanged,
    `${clozeHintsPowerupCode}.${hintsSlotCode}`,
    async (data) => {
      const { remId } = data;
      const rem = await plugin.rem.findOne(remId);
      if (!rem) {
        return;
      }
      const allHints = await plugin.storage.getLocal<Record<string, string>>(hintsStorageKey);
      const remHints = await getHintsFromRem(rem);
      const newAllHints = Re.merge(allHints, remHints);
      await plugin.storage.setLocal(hintsStorageKey, newAllHints);
      await registerInitialCSS();
    }
  );

  await registerInitialCSS();

  let lastURL: string | undefined;
  plugin.event.addListener(AppEvents.URLChange, undefined, async ({ pathname }) => {
    if ((pathname as string).includes('/flashcards')) {
      registerQueueCSS();
    } else if (lastURL?.includes('/flashcards')) {
      registerMainAppCSS();
    }
    lastURL = pathname;
  });

  plugin.event.addListener(AppEvents.GlobalRemChanged, undefined, async (data) => {
    if ((data.changes?.text || data.changes?.backText) && data.old) {
      const prevText: RichTextInterface = data.old.text.concat(data.old.backText);
      const newText: RichTextInterface = (data.changes?.text || data.old.text).concat(
        data.changes?.backText || data.old.backText
      );
      const prevcIds = prevText.filter((x) => x?.cId).map((x) => x.cId);
      const newcIds = newText.filter((x) => x?.cId).map((x) => x.cId);
      const removedcIds = Re.difference(prevcIds, newcIds);
      if (removedcIds.length > 0) {
        const allHints =
          (await plugin.storage.getLocal<Record<string, string>>(hintsStorageKey)) || {};
        const updatedAllHints = Object.fromEntries(
          Object.entries(allHints).filter(([k]) => !removedcIds.includes(k))
        );
        await plugin.storage.setLocal(hintsStorageKey, updatedAllHints);
      }
    }
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
