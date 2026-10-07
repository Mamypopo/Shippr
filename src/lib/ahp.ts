/**
 * Analytic Hierarchy Process (AHP) engine.
 *
 * Pure, dependency-free and deterministic: the same module runs in the browser
 * for live recalculation as the user moves sliders, and on the server to
 * produce the record that gets persisted. One implementation means the number
 * shown to the user and the number stored in the decision log cannot drift.
 *
 * Nothing in here throws on input the UI is capable of producing. Degenerate
 * cases return a usable result plus a `warnings` entry, because a dashboard
 * that blanks out mid-interaction is worse than one that explains itself.
 */

// ---------------------------------------------------------------------------
// Criteria
// ---------------------------------------------------------------------------

export const CRITERIA = [
  "cost",
  "transitTime",
  "reliability",
  "availability",
  "service",
] as const;

export type CriterionKey = (typeof CRITERIA)[number];

/** `min` = a lower raw value is better (cost, days). `max` = higher is better. */
export const CRITERION_DIRECTION: Record<CriterionKey, "min" | "max"> = {
  cost: "min",
  transitTime: "min",
  reliability: "max",
  availability: "max",
  service: "max",
};

export const CRITERION_LABELS: Record<CriterionKey, { en: string; th: string }> = {
  cost: { en: "Cost", th: "ต้นทุน" },
  transitTime: { en: "Transit Time", th: "ระยะเวลาขนส่ง" },
  reliability: { en: "Schedule Reliability", th: "ความตรงต่อเวลา" },
  availability: { en: "Space & Equipment", th: "ระวาง/ตู้คอนเทนเนอร์" },
  service: { en: "Service & Documentation", th: "บริการและเอกสาร" },
};

// ---------------------------------------------------------------------------
// Saaty constants
// ---------------------------------------------------------------------------

/** Saaty's Random Consistency Index, indexed by matrix order. */
export const RANDOM_INDEX: Readonly<Record<number, number>> = {
  1: 0,
  2: 0,
  3: 0.58,
  4: 0.9,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
  10: 1.49,
};

/** A CR at or above this means the judgments are too contradictory to use. */
export const CR_THRESHOLD = 0.1;

export const SAATY_MIN = 1 / 9;
export const SAATY_MAX = 9;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Matrix = number[][];

/**
 * The upper triangle of a comparison matrix, keyed `"<rowKey>:<colKey>"` using
 * the order the keys were supplied in. A value of 3 at `"cost:transitTime"`
 * reads as "Cost is moderately more important than Transit Time".
 */
export type PairwiseInput = Record<string, number>;

export interface Alternative<K extends string = CriterionKey> {
  id: string;
  label: string;
  /** Raw, real-world values — USD, days, percent. Not pre-normalized. */
  values: Record<K, number>;
}

export interface InconsistencyHint {
  rowKey: string;
  colKey: string;
  /** What the user entered. */
  entered: number;
  /** What the derived weights imply it should have been. */
  suggested: number;
  /** |ln(entered / suggested)| — bigger means more contradictory. */
  deviation: number;
}

export interface ConsistencyResult {
  lambdaMax: number;
  consistencyIndex: number;
  consistencyRatio: number;
  isConsistent: boolean;
}

export interface AHPResult<K extends string = CriterionKey> {
  keys: readonly K[];
  matrix: Matrix;
  /** Column-normalized matrix, exposed so the UI can show the working. */
  normalizedMatrix: Matrix;
  weights: Record<K, number>;
  lambdaMax: number;
  consistencyIndex: number;
  consistencyRatio: number;
  isConsistent: boolean;
  /** Worst offending cells, most contradictory first. Empty when consistent. */
  inconsistencies: InconsistencyHint[];
  ranking: RankedAlternative<K>[];
  warnings: string[];
}

export interface RankedAlternative<K extends string = CriterionKey> {
  id: string;
  label: string;
  /** Per-criterion local score in (0, 1]. */
  localScores: Record<K, number>;
  /** Weighted sum of local scores. */
  rawScore: number;
  /** rawScore rescaled so the best alternative is 100. */
  score100: number;
  rank: number;
}

// ---------------------------------------------------------------------------
// Matrix construction
// ---------------------------------------------------------------------------

export function pairKey(a: string, b: string): string {
  return `${a}:${b}`;
}

/**
 * Expand an upper-triangle input into a full reciprocal matrix.
 *
 * Missing cells default to 1 (indifference) rather than failing, so a
 * half-filled form still produces a sensible live preview.
 */
export function buildMatrix<K extends string>(
  keys: readonly K[],
  upper: PairwiseInput,
  warnings: string[] = [],
): Matrix {
  const n = keys.length;
  const matrix: Matrix = Array.from({ length: n }, () => new Array<number>(n).fill(1));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const raw = upper[pairKey(keys[i], keys[j])];
      let value = typeof raw === "number" && Number.isFinite(raw) ? raw : 1;

      if (value <= 0) {
        warnings.push(
          `Comparison ${keys[i]} vs ${keys[j]} was ${value}, which is not a valid ratio. Treated as 1.`,
        );
        value = 1;
      } else if (value < SAATY_MIN || value > SAATY_MAX) {
        warnings.push(
          `Comparison ${keys[i]} vs ${keys[j]} (${value}) falls outside the 1/9–9 Saaty scale.`,
        );
      }

      matrix[i][j] = value;
      matrix[j][i] = 1 / value;
    }
  }

  return matrix;
}

/** Column-normalize: every column sums to 1. */
export function normalizeMatrix(matrix: Matrix): Matrix {
  const n = matrix.length;
  const colSums = new Array<number>(n).fill(0);

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) colSums[j] += matrix[i][j];
  }

  return matrix.map((row) => row.map((v, j) => (colSums[j] > 0 ? v / colSums[j] : 0)));
}

// ---------------------------------------------------------------------------
// Priority vector
// ---------------------------------------------------------------------------

const MAX_ITERATIONS = 1000;
const CONVERGENCE_EPSILON = 1e-10;

function normalizeVector(v: number[]): number[] {
  const sum = v.reduce((acc, x) => acc + x, 0);
  if (sum <= 0 || !Number.isFinite(sum)) return v.map(() => 1 / v.length);
  return v.map((x) => x / sum);
}

/** Normalized geometric mean of each row — the classic closed-form estimate. */
export function geometricMeanWeights(matrix: Matrix): number[] {
  const n = matrix.length;
  // Summing logs rather than multiplying avoids overflow on larger matrices.
  const means = matrix.map((row) => {
    const logSum = row.reduce((acc, v) => acc + Math.log(v > 0 ? v : Number.EPSILON), 0);
    return Math.exp(logSum / n);
  });
  return normalizeVector(means);
}

export interface PriorityVectorResult {
  weights: number[];
  converged: boolean;
  iterations: number;
}

/**
 * Principal right eigenvector by power iteration, seeded with the geometric
 * mean so it converges in a handful of steps for realistic matrices.
 */
export function computePriorityVector(matrix: Matrix): PriorityVectorResult {
  const n = matrix.length;
  if (n === 0) return { weights: [], converged: true, iterations: 0 };
  if (n === 1) return { weights: [1], converged: true, iterations: 0 };

  let current = geometricMeanWeights(matrix);

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    const next = normalizeVector(multiply(matrix, current));

    let delta = 0;
    for (let i = 0; i < n; i++) delta = Math.max(delta, Math.abs(next[i] - current[i]));
    current = next;

    if (delta < CONVERGENCE_EPSILON) {
      return { weights: current, converged: true, iterations: iteration };
    }
  }

  // Never leave the caller without a vector: fall back to the closed form.
  return {
    weights: geometricMeanWeights(matrix),
    converged: false,
    iterations: MAX_ITERATIONS,
  };
}

function multiply(matrix: Matrix, vector: number[]): number[] {
  return matrix.map((row) => row.reduce((acc, v, j) => acc + v * vector[j], 0));
}

// ---------------------------------------------------------------------------
// Consistency
// ---------------------------------------------------------------------------

export function computeConsistency(matrix: Matrix, weights: number[]): ConsistencyResult {
  const n = matrix.length;

  if (n <= 2) {
    // A 1x1 or 2x2 reciprocal matrix is consistent by construction.
    return { lambdaMax: n, consistencyIndex: 0, consistencyRatio: 0, isConsistent: true };
  }

  const product = multiply(matrix, weights);
  let lambdaSum = 0;
  let counted = 0;

  for (let i = 0; i < n; i++) {
    if (weights[i] > 0) {
      lambdaSum += product[i] / weights[i];
      counted++;
    }
  }

  const lambdaMax = counted > 0 ? lambdaSum / counted : n;

  // Floating point can push a perfectly consistent matrix a hair below n,
  // which would otherwise surface as a negative CI.
  const consistencyIndex = Math.max(0, (lambdaMax - n) / (n - 1));
  const ri = RANDOM_INDEX[n];
  const consistencyRatio = ri && ri > 0 ? consistencyIndex / ri : 0;

  return {
    lambdaMax,
    consistencyIndex,
    consistencyRatio,
    isConsistent: consistencyRatio < CR_THRESHOLD,
  };
}

/**
 * Locate the judgments that fight the derived weights hardest.
 *
 * "Your judgments are inconsistent" is not actionable. Comparing each entered
 * ratio against `w_i / w_j` turns it into "you said Cost is 7x Transit Time,
 * but the rest of your answers imply about 3x", which a user can act on.
 */
export function findInconsistencies<K extends string>(
  keys: readonly K[],
  matrix: Matrix,
  weights: number[],
  limit = 3,
): InconsistencyHint[] {
  const hints: InconsistencyHint[] = [];

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (weights[j] <= 0) continue;
      const suggested = weights[i] / weights[j];
      if (!Number.isFinite(suggested) || suggested <= 0) continue;

      const entered = matrix[i][j];
      const deviation = Math.abs(Math.log(entered / suggested));
      if (deviation < 1e-9) continue;

      hints.push({ rowKey: keys[i], colKey: keys[j], entered, suggested, deviation });
    }
  }

  return hints.sort((a, b) => b.deviation - a.deviation).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Alternative scoring
// ---------------------------------------------------------------------------

/**
 * Ideal-mode normalization straight from the quoted figures.
 *
 * The textbook alternative is a second pairwise matrix per criterion. For five
 * criteria that is fifty extra questions, which no coordinator will finish —
 * and the inputs here (USD, days, on-time %) are already on real ratio scales,
 * so deriving the local scores is both less work and less arbitrary.
 */
export function scoreAlternativesOnCriterion<K extends string>(
  alternatives: Alternative<K>[],
  criterion: K,
  direction: "min" | "max",
  warnings: string[] = [],
): number[] {
  const values = alternatives.map((a) => a.values[criterion]);
  const n = values.length;
  const uniform = () => new Array<number>(n).fill(n > 0 ? 1 / n : 0);

  if (n === 0) return [];
  if (values.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
    warnings.push(`Criterion "${criterion}" has a missing or non-numeric value; scored evenly.`);
    return uniform();
  }

  if (direction === "min") {
    if (values.some((v) => v <= 0)) {
      warnings.push(
        `Criterion "${criterion}" has a value of zero or less, which cannot be ranked as "lower is better"; scored evenly.`,
      );
      return uniform();
    }
    const best = Math.min(...values);
    return values.map((v) => best / v);
  }

  const best = Math.max(...values);
  if (best <= 0) {
    warnings.push(`Criterion "${criterion}" has no positive values; scored evenly.`);
    return uniform();
  }
  return values.map((v) => (v > 0 ? v / best : 0));
}

// ---------------------------------------------------------------------------
// Top-level entry point
// ---------------------------------------------------------------------------

export interface ComputeAHPOptions<K extends string = CriterionKey> {
  keys?: readonly K[];
  directions?: Record<K, "min" | "max">;
  alternatives?: Alternative<K>[];
}

/**
 * Run the whole process: matrix -> weights -> consistency -> ranking.
 *
 * Cheap enough (a 5x5 eigenvector is microseconds) to call on every slider
 * change without debouncing.
 */
export function computeAHP<K extends string = CriterionKey>(
  pairwise: PairwiseInput,
  options: ComputeAHPOptions<K> = {},
): AHPResult<K> {
  const keys = (options.keys ?? (CRITERIA as readonly string[] as readonly K[])) as readonly K[];
  const directions = (options.directions ??
    (CRITERION_DIRECTION as unknown as Record<K, "min" | "max">)) as Record<K, "min" | "max">;
  const alternatives = options.alternatives ?? [];

  const warnings: string[] = [];
  const matrix = buildMatrix(keys, pairwise, warnings);
  const { weights: weightVector, converged } = computePriorityVector(matrix);

  if (!converged) {
    warnings.push(
      "The priority vector did not converge; fell back to the geometric-mean estimate.",
    );
  }

  const consistency = computeConsistency(matrix, weightVector);
  const inconsistencies = consistency.isConsistent
    ? []
    : findInconsistencies(keys, matrix, weightVector);

  const weights = Object.fromEntries(
    keys.map((key, i) => [key, weightVector[i]]),
  ) as Record<K, number>;

  return {
    keys,
    matrix,
    normalizedMatrix: normalizeMatrix(matrix),
    weights,
    ...consistency,
    inconsistencies,
    ranking: rankAlternatives(keys, directions, weights, alternatives, warnings),
    warnings,
  };
}

export function rankAlternatives<K extends string>(
  keys: readonly K[],
  directions: Record<K, "min" | "max">,
  weights: Record<K, number>,
  alternatives: Alternative<K>[],
  warnings: string[] = [],
): RankedAlternative<K>[] {
  if (alternatives.length === 0) return [];

  const localByCriterion = new Map<K, number[]>();
  for (const key of keys) {
    localByCriterion.set(
      key,
      scoreAlternativesOnCriterion(alternatives, key, directions[key], warnings),
    );
  }

  const scored = alternatives.map((alt, index) => {
    const localScores = Object.fromEntries(
      keys.map((key) => [key, localByCriterion.get(key)![index]]),
    ) as Record<K, number>;

    const rawScore = keys.reduce((acc, key) => acc + (weights[key] ?? 0) * localScores[key], 0);

    return { id: alt.id, label: alt.label, localScores, rawScore };
  });

  const best = Math.max(...scored.map((s) => s.rawScore));

  return scored
    .slice()
    .sort((a, b) => b.rawScore - a.rawScore)
    .map((s, i) => ({
      ...s,
      score100: best > 0 ? (s.rawScore / best) * 100 : 0,
      rank: i + 1,
    }));
}
