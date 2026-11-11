// FX3 (DECISIONS 62): how long the web server keeps an API answer in memory. One place, so the lifetimes can be
// changed without reading the request layer.

/** Answers about one business: profile, lenses, comparison, history. */
export const BUSINESS_DATA_MS = 30_000;

/** Reference data that is the same for every business: the health line, the business list, the scenario catalogue. */
export const REFERENCE_DATA_MS = 5 * 60_000;

/** After a 429 with no Retry-After header, wait this long before the one retry. */
export const RETRY_AFTER_DEFAULT_MS = 1_000;

/** Never wait longer than this for a retry, whatever the API states: the page shows its error state instead. */
export const RETRY_AFTER_MAX_MS = 5_000;

/** The most answers kept at once; the oldest is dropped first. */
export const CACHE_MAX_ENTRIES = 500;
