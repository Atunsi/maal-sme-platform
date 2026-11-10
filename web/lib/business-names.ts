// Display names for the synthetic businesses, so a visitor reads a business, not a number. Fictional and
// UI-only: made here from the business ID alone, never stored, never sent to the API, and never part of a
// decision or its receipt. The admin page still shows the ID beside the name.
//
// The form follows Saudi commercial registrations: "مؤسسة" (an establishment, a sole proprietorship) or
// "شركة" (a company), then a trade name of an image and a place in the Kingdom. The names claim no line of
// business, so none can contradict the business's sector. Any match with a real registered name is chance.
import type { Locale } from "@/lib/i18n";

type Pair = readonly [ar: string, en: string];

const IMAGES: readonly Pair[] = [
  ["سدرة", "Sidrah"],
  ["نخلة", "Nakhlah"],
  ["رمال", "Rimal"],
  ["أفق", "Ufuq"],
  ["ركن", "Rukn"],
  ["واحة", "Wahat"],
  ["ضفاف", "Difaf"],
  ["نجمة", "Najmat"],
  ["غيمة", "Ghaimat"],
  ["بيرق", "Bairaq"],
  ["صقر", "Saqr"],
  ["مرقب", "Marqab"],
  ["دانة", "Danat"],
  ["لؤلؤة", "Lulu'at"],
  ["ريحانة", "Raihanat"],
  ["سنا", "Sana"],
  ["مزن", "Muzn"],
  ["ظلال", "Dhilal"],
  ["روابي", "Rawabi"],
  ["نسيم", "Nasim"],
  ["عقيق", "Aqiq"],
  ["قافلة", "Qafilat"],
  ["منارة", "Manarat"],
  ["سحاب", "Sahab"],
  ["بوابة", "Bawwabat"],
  ["جادة", "Jaddat"],
  ["درة", "Durrat"],
  ["مرسى", "Marsa"],
  ["وهج", "Wahj"],
  ["خزامى", "Khuzama"],
  ["عرين", "Arin"],
  ["شموخ", "Shumukh"],
  ["فنار", "Fanar"],
  ["ينبوع", "Yanbu'"],
  ["قمم", "Qimam"],
  ["سهول", "Suhul"],
  ["نوافذ", "Nawafidh"],
  ["مسار", "Masar"],
  ["أصالة", "Asalat"],
  ["رواد", "Ruwwad"],
];

const PLACES: readonly Pair[] = [
  ["نجد", "Najd"],
  ["اليمامة", "Al-Yamamah"],
  ["طويق", "Tuwaiq"],
  ["حنيفة", "Hanifah"],
  ["العارض", "Al-Arid"],
  ["الوشم", "Al-Washm"],
  ["سدير", "Sudair"],
  ["الخرج", "Al-Kharj"],
  ["الدرعية", "Diriyah"],
  ["القصيم", "Al-Qassim"],
  ["عنيزة", "Unaizah"],
  ["حائل", "Hail"],
  ["الأحساء", "Al-Ahsa"],
  ["الدهناء", "Ad-Dahna"],
  ["الصمان", "As-Summan"],
  ["العلا", "AlUla"],
  ["تبوك", "Tabuk"],
  ["أبها", "Abha"],
  ["الباحة", "Al-Baha"],
  ["ينبع", "Yanbu"],
  ["الطائف", "Taif"],
  ["الجبيل", "Jubail"],
  ["الشرقية", "Ash-Sharqiyah"],
  ["المجمعة", "Al-Majma'ah"],
  ["شقراء", "Shaqra"],
  ["الزلفي", "Az-Zulfi"],
  ["الأفلاج", "Al-Aflaj"],
  ["حريملاء", "Huraymila"],
  ["ثادق", "Thadiq"],
  ["رماح", "Rumah"],
];

const FORMS = [
  { ar: "مؤسسة", en: "Est." },
  { ar: "شركة", en: "Co." },
] as const;

/** The serving population (config.yaml `id_range`): 1,000 businesses, 10,001 to 11,000. */
const FIRST = 10001;
const SLOTS = IMAGES.length * PLACES.length; // 1,200 image-place pairs
// Steps through the pairs in a scattered order, so neighbouring IDs get unrelated names. 487 shares no factor
// with 1,200, so every slot is reached once before any repeats: 1,000 IDs, 1,000 different names.
const STEP = 487;

export type BusinessName = { ar: string; en: string };

export function businessName(id: number | string): BusinessName {
  const n = Number(id);
  const slot = (((n - FIRST) * STEP) % SLOTS + SLOTS) % SLOTS;
  const [imageAr, imageEn] = IMAGES[slot % IMAGES.length]!;
  const [placeAr, placeEn] = PLACES[Math.floor(slot / IMAGES.length)]!;
  const form = FORMS[(n * 31 + 7) % FORMS.length]!;
  return { ar: `${form.ar} ${imageAr} ${placeAr}`, en: `${imageEn} ${placeEn} ${form.en}` };
}

/** The business's name in the page's language. */
export function nameOf(id: number | string, locale: Locale): string {
  return businessName(id)[locale];
}

/** Lower case, no accents or apostrophes, and one spelling for the Arabic letters people type either way. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .replace(/['’‘`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Businesses for a search box: by the start of the ID when the query is digits, otherwise by name, in either
 * language, with every word of the query found in the name. `ids` is the set to search (the online snapshot
 * holds only some); in ID order, at most `limit`.
 */
export function findBusinesses(query: string, ids: readonly number[], limit = 8): number[] {
  const q = fold(query);
  if (!q) return [];
  if (/^[0-9]+$/.test(q)) return ids.filter((id) => String(id).startsWith(q)).slice(0, limit);
  if (q.length < 2) return [];
  const words = q.split(" ");
  const found: number[] = [];
  for (const id of ids) {
    const { ar, en } = businessName(id);
    const name = `${fold(en)} ${fold(ar)}`;
    if (words.every((word) => name.includes(word))) found.push(id);
    if (found.length === limit) break;
  }
  return found;
}
