// The serving population's ID range (schema §23). This bounds what the picker accepts.
// It says nothing about how many businesses a given store holds; /health reports that.
export const SERVING_ID_MIN = 10001;
export const SERVING_ID_MAX = 11000;

export function isServingId(id: number): boolean {
  return Number.isInteger(id) && id >= SERVING_ID_MIN && id <= SERVING_ID_MAX;
}
