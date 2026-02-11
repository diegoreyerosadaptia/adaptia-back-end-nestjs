// ods-list.dto.ts
export type OdsOption = { code: string; label: string }
export type MetaOption = { code: string; label: string }
export type IndicadorOption = { code: string; label: string }

export type OdsOptionsResponse = {
  objectives: OdsOption[]
  metas: MetaOption[]
  indicadores: IndicadorOption[]
}
