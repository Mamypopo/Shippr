/**
 * Cargo-profile presets for the pairwise comparison form.
 *
 * Each preset is a complete upper triangle, derived from a target weight
 * vector and rounded onto the Saaty scale. The rounding introduces a little
 * inconsistency, so every preset is unit-tested to land under CR 0.1 — a
 * preset that ships contradictory judgments is a bug, not a starting point.
 */

import { CRITERIA, pairKey, type CriterionKey, type PairwiseInput } from "./ahp";

export type PresetKey =
  | "BALANCED"
  | "PERISHABLE_REEFER"
  | "LOW_MARGIN_GENERAL"
  | "PEAK_SEASON_RUSH";

export interface CargoPreset {
  key: PresetKey;
  label: { en: string; th: string };
  description: { en: string; th: string };
  pairwise: PairwiseInput;
}

/** Build an upper triangle from a sparse `"a:b"` map, defaulting the rest to 1. */
function triangle(values: Partial<Record<string, number>>): PairwiseInput {
  const out: PairwiseInput = {};
  for (let i = 0; i < CRITERIA.length; i++) {
    for (let j = i + 1; j < CRITERIA.length; j++) {
      const key = pairKey(CRITERIA[i], CRITERIA[j]);
      out[key] = values[key] ?? 1;
    }
  }
  return out;
}

export const CARGO_PRESETS: Record<PresetKey, CargoPreset> = {
  BALANCED: {
    key: "BALANCED",
    label: { en: "Balanced", th: "สมดุล" },
    description: {
      en: "All criteria weighted equally. A neutral starting point.",
      th: "ให้น้ำหนักทุกเกณฑ์เท่ากัน ใช้เป็นจุดตั้งต้นที่เป็นกลาง",
    },
    pairwise: triangle({}),
  },

  PERISHABLE_REEFER: {
    key: "PERISHABLE_REEFER",
    label: { en: "Perishable / Reefer", th: "สินค้าเน่าเสีย / ตู้เย็น" },
    description: {
      en: "Transit time and reefer plug availability dominate; cost is secondary because a late reefer is a total loss.",
      th: "ระยะเวลาขนส่งและความพร้อมของตู้เย็นสำคัญที่สุด ราคาเป็นรอง เพราะตู้เย็นที่มาช้าคือเสียหายทั้งตู้",
    },
    pairwise: triangle({
      "cost:transitTime": 1 / 3,
      "cost:reliability": 1 / 2,
      "cost:availability": 1 / 2,
      "cost:service": 2,
      "transitTime:reliability": 2,
      "transitTime:availability": 1,
      "transitTime:service": 5,
      "reliability:availability": 1,
      "reliability:service": 3,
      "availability:service": 4,
    }),
  },

  LOW_MARGIN_GENERAL: {
    key: "LOW_MARGIN_GENERAL",
    label: { en: "Low-margin General Cargo", th: "สินค้าทั่วไป มาร์จิ้นต่ำ" },
    description: {
      en: "Cost outweighs everything else; a few extra days are acceptable if the rate is right.",
      th: "ราคาสำคัญเหนือทุกอย่าง ช้าอีกสองสามวันรับได้ถ้าค่าระวางคุ้ม",
    },
    pairwise: triangle({
      "cost:transitTime": 3,
      "cost:reliability": 3,
      "cost:availability": 5,
      "cost:service": 7,
      "transitTime:reliability": 1,
      "transitTime:availability": 2,
      "transitTime:service": 3,
      "reliability:availability": 2,
      "reliability:service": 3,
      "availability:service": 1,
    }),
  },

  PEAK_SEASON_RUSH: {
    key: "PEAK_SEASON_RUSH",
    label: { en: "Peak Season Rush", th: "ช่วงพีค ของต้องออก" },
    description: {
      en: "Securing space and avoiding blank sailings matter most; paying over market beats not shipping at all.",
      th: "จองระวางให้ได้และเลี่ยงเรือยกเลิกเที่ยวสำคัญที่สุด จ่ายแพงกว่าตลาดยังดีกว่าของออกไม่ได้",
    },
    pairwise: triangle({
      "cost:transitTime": 1,
      "cost:reliability": 1 / 2,
      "cost:availability": 1 / 3,
      "cost:service": 2,
      "transitTime:reliability": 1 / 2,
      "transitTime:availability": 1 / 2,
      "transitTime:service": 2,
      "reliability:availability": 1,
      "reliability:service": 4,
      "availability:service": 5,
    }),
  },
};

export const PRESET_LIST: CargoPreset[] = Object.values(CARGO_PRESETS);

export function getPreset(key: string | null | undefined): CargoPreset | undefined {
  if (!key) return undefined;
  return CARGO_PRESETS[key as PresetKey];
}

/** Criterion order used by every preset, re-exported for form rendering. */
export const PRESET_CRITERIA: readonly CriterionKey[] = CRITERIA;
