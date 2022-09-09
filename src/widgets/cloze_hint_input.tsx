import { renderWidget, usePlugin, useRunAsync, WidgetLocation } from "@remnote/plugin-sdk"
import React from "react";
import {isHotkey} from 'is-hotkey'
import {clozeHintsPowerupCode, hintsSlotCode, InputProps, inputProps, } from "../lib/constants";

function ClozeHintInput() {
  const plugin = usePlugin();
  const ref = React.useRef<HTMLInputElement | null>(null);
  const [hintText, setHintText] = React.useState("");
  const ctx = useRunAsync(async () => await plugin.widget.getWidgetContext<WidgetLocation.FloatingWidget>(), []);
  const floatingWidgetId = ctx?.floatingWidgetId!;
  // const props = useRunAsync(() => plugin.storage.getLocal<InputProps>(inputProps), [])

  React.useEffect(() => {
    if (floatingWidgetId) {
      const escFunction = (e: KeyboardEvent) => {
        if (isHotkey('escape')(e)) {
          plugin.window.closeFloatingWidget(floatingWidgetId);
          e.stopPropagation();
        }
      }
      document.addEventListener("keydown", escFunction);
      return () => {
        document.removeEventListener("keydown", escFunction);
      }
    }
  }, [floatingWidgetId])

  React.useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div className="flex flex-rows items-center">
      <input
        value={hintText}
        onChange={e => setHintText(e.target.value)}
        onKeyDown={async (e) => {
          if (isHotkey('enter')(e)) {
            e.stopPropagation();
            const hint = hintText.trim();
            if (hint) {
              const clozeHintPowerup = await plugin.powerup.getPowerupByCode(clozeHintsPowerupCode)
              const selRichText = (await plugin.editor.getSelectedText())?.richText || [];
              const rem = await plugin.focus.getFocusedRem();
              if (!rem) {
                return
              }

              if (!await rem?.hasPowerup(clozeHintsPowerupCode)) {
                await rem?.addTag(clozeHintPowerup!._id);
              }
              
              const clozeId = (Math.random()).toString().substring(2)
              const existingHintsStr = (await rem.getPowerupProperty(clozeHintsPowerupCode, hintsSlotCode))
              const existingHints = existingHintsStr ? JSON.parse(existingHintsStr) : {}
              const hints = {
                ...existingHints,
                [clozeId]: hintText,
              }
              await rem.setPowerupProperty(clozeHintsPowerupCode, hintsSlotCode, [JSON.stringify(hints)])
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
              await plugin.window.closeFloatingWidget(floatingWidgetId);
            }
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
