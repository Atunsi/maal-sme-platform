// The serving population's ID range (schema §23). This bounds what the picker accepts.
// It says nothing about how many businesses a given store holds; /health reports that.
export const SERVING_ID_MIN = 10001;
export const SERVING_ID_MAX = 11000;

/** Every serving ID, in order: what a search covers when the page has no shorter list. */
export const SERVING_IDS: readonly number[] = Array.from({ length: SERVING_ID_MAX - SERVING_ID_MIN + 1 }, (_, i) => SERVING_ID_MIN + i);

export function isServingId(id: number): boolean {
  return Number.isInteger(id) && id >= SERVING_ID_MIN && id <= SERVING_ID_MAX;
}
