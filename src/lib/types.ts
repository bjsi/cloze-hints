import {Rem} from "@remnote/plugin-sdk"

export interface BaseProps {
  rem: Rem;
}
export interface EditCloze { type: "edit", cId: string}
export interface CreateCloze { type: "create" }
export type ClozeProps = EditCloze | CreateCloze
