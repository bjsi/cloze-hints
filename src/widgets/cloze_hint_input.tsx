import { renderWidget, usePlugin, useRunAsync, WidgetLocation } from "@remnote/plugin-sdk"
import React from "react";
import {isHotkey} from 'is-hotkey'
import {clozeHintsPowerupCode, hintsSlotCode, clozePropsStorageKey, } from "../lib/constants";
import {ClozeProps} from "../lib/types";

function ClozeHintInput() {
  const plugin = usePlugin();
  const ref = React.useRef<HTMLInputElement | null>(null);
  const ctx = useRunAsync(async () => await plugin.widget.getWidgetContext<WidgetLocation.FloatingWidget>(), []);
  const props = useRunAsync(() => plugin.storage.getSession<ClozeProps>(clozePropsStorageKey), [])
  const floatingWidgetId = ctx?.floatingWidgetId!;
  const rem = useRunAsync(() => plugin.focus.getFocusedRem(), []);
  const existingHintsStr = useRunAsync(async () => await rem?.getPowerupProperty(clozeHintsPowerupCode, hintsSlotCode), [rem])
  const existingHints = existingHintsStr ? JSON.parse(existingHintsStr) : {}
  const [hintText, setHintText] = React.useState("");
  React.useEffect(() => {
    if (props?.type == "edit") {
      setHintText(existingHints[props.cId])
    }
  }, [existingHintsStr])

  React.useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (isHotkey('escape')(e) && floatingWidgetId) {
        plugin.window.closeFloatingWidget(floatingWidgetId);
        e.stopPropagation();
        e.preventDefault();
      }
    }
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
    }
  }, [floatingWidgetId])

  React.useEffect(() => {
    ref.current?.focus();
  }, []);

  async function handleClozeHint(hint: string) {
    const clozeHintPowerup = await plugin.powerup.getPowerupByCode(clozeHintsPowerupCode)
    const selRichText = (await plugin.editor.getSelectedText())?.richText || [];
    if (!rem) {
      return
    }

    if (!await rem?.hasPowerup(clozeHintsPowerupCode)) {
      await rem?.addTag(clozeHintPowerup!._id);
    }

    const hints = {
      ...existingHints,
    }

    if (props?.type === "edit") {
      hints[props.cId] = hint;
    }
    else {
      if (hint === "") {
        return;
      }
      const clozeId = (Math.random()).toString().substring(2)
      hints[clozeId] = hint;
      const richTextWithCloze = selRichText.map((element) => {
        if (typeof element === "string") {
          return {
            i: "m" as const,
            cId: clozeId,
            text: element,
          }
        }
        else {
          return {
            ...element,
            cId: clozeId,
          }
        }
      });
      await plugin.editor.deleteCharacters(1, -1);
      await plugin.editor.insertRichText(richTextWithCloze)
    }

    await rem.setPowerupProperty(clozeHintsPowerupCode, hintsSlotCode, [JSON.stringify(hints)])
  }


  return (
    <div className="flex flex-rows items-center">
      <input
        value={hintText}
        onChange={e => setHintText(e.target.value)}
        onKeyDown={async (e) => {
          if (isHotkey('escape')(e)) {
            await plugin.window.closeFloatingWidget(floatingWidgetId);
          }
          else if (isHotkey('enter')(e)) {
            e.preventDefault();
            e.stopPropagation();
            const hint = hintText.trim();
            if (hint == null) {
              return
            }
            await handleClozeHint(hint)
            await plugin.window.closeFloatingWidget(floatingWidgetId);
          }
        }}
        className="w-full"
        placeholder="Hint"
        ref={ref}
      />
    </div>
  )
}

renderWidget(ClozeHintInput)
