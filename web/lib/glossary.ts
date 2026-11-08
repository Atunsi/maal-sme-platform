// E3: the glossary (DECISIONS 43). Fixed text written for the UI, not generated. Only terms the UI shows,
// each defined from a repo source named in `source`. Rules, all tested: no digits in any term or
// definition (N1), at most thirty words per definition, no symbol characters, every entry has a source (N2).
// Every Arabic string is a draft for the compliance owner's review, like the rest of messages/ar.json.
import type { Locale } from "@/lib/i18n";

export type GlossaryEntry = {
  id: string;
  en: { term: string; definition: string };
  ar: { term: string; definition: string; draft: true };
  source: string;
};

export const GLOSSARY = [
  {
    id: "pd",
    en: { term: "PD (probability of default)", definition: "The credit model's estimate of how likely the business is to fall behind on repayment. It is a model output on synthetic data, not a measured rate." },
    ar: { term: "احتمال التعثر (PD)", definition: "تقدير نموذج الائتمان لاحتمال تأخر المنشأة في السداد. هو مخرج نموذج على بيانات اصطناعية، وليس معدلًا مقيسًا.", draft: true },
    source: "DECISIONS.md entry 23 (credit lens v1)",
  },
  {
    id: "cv-auc",
    en: { term: "CV AUC", definition: "How well the credit model ranks businesses that later default above those that do not, measured by cross-validation. Half is no better than chance; one is perfect." },
    ar: { term: "CV AUC", definition: "مقياس لقدرة نموذج الائتمان على ترتيب المنشآت التي تتعثر لاحقًا فوق غيرها، محسوب بالتحقق المتقاطع. النصف لا يفضل الصدفة، والواحد هو الكمال.", draft: true },
    source: "DECISIONS.md entry 23 (model receipt fields)",
  },
  {
    id: "oracle-ceiling",
    en: { term: "Oracle ceiling", definition: "The AUC of the generator's hidden risk index on this synthetic data: the most any model could reach here. It shows how much signal the data holds." },
    ar: { term: "السقف المرجعي", definition: "قيمة AUC لمؤشر المخاطر المخفي لدى المولّد على هذه البيانات الاصطناعية، وهي أقصى ما يبلغه أي نموذج هنا. تبيّن مقدار الإشارة في البيانات.", draft: true },
    source: "DECISIONS.md entry 21 (oracle ceiling, latent risk index)",
  },
  {
    id: "receipt",
    en: { term: "Receipt", definition: "The hashes and versions that produced a result: configuration, model, data, code and output. Anyone with the repository can re-run the result and compare." },
    ar: { term: "الإيصال", definition: "البصمات والإصدارات التي أنتجت النتيجة: الإعدادات والنموذج والبيانات والشيفرة والمخرجات. يستطيع أي شخص لديه المستودع إعادة تشغيلها والمقارنة.", draft: true },
    source: "DECISIONS.md entry 24 (complete reproducibility receipt)",
  },
  {
    id: "output-hash",
    en: { term: "Output hash", definition: "A hash of the result itself, without its receipt. If a re-run gives the same output hash, the result was reproduced byte for byte." },
    ar: { term: "بصمة المخرجات", definition: "بصمة النتيجة نفسها دون إيصالها. إذا أعطت إعادة التشغيل البصمة نفسها، فقد أُعيد إنتاج النتيجة بايتًا ببايت.", draft: true },
    source: "pipeline/week8.py output_sha256; DECISIONS.md entry 24",
  },
  {
    id: "scope",
    en: { term: "Scope", definition: "The receipt's own statement of what it covers: the deterministic core only. It also names the command that verifies the result." },
    ar: { term: "النطاق", definition: "بيان الإيصال لما يشمله: النواة الحتمية فقط. ويذكر كذلك الأمر الذي يتحقق من النتيجة.", draft: true },
    source: "pipeline/week8.py RECEIPT_SCOPE; schema §36.1",
  },
  {
    id: "partial-profile",
    en: { term: "Partial profile", definition: "The business has enough activity to be scored, but some features could not be computed. Each missing feature is listed with its reason." },
    ar: { term: "ملف جزئي", definition: "لدى المنشأة نشاط يكفي للتقييم، لكن بعض الخصائص تعذّر حسابها. تُعرض كل خاصية ناقصة مع سببها.", draft: true },
    source: "docs/Behavioral_Profile_Feature_Schema.md §15",
  },
  {
    id: "insufficient-data",
    en: { term: "Insufficient data", definition: "Too little recent activity for any lens to run. It is a refusal to score, not a low result." },
    ar: { term: "بيانات غير كافية", definition: "النشاط الحديث أقل من أن تعمل أي عدسة. هذا امتناع عن التقييم، وليس نتيجة منخفضة.", draft: true },
    source: "docs/Behavioral_Profile_Feature_Schema.md §15",
  },
  {
    id: "hawl",
    en: { term: "Hawl", definition: "One full lunar year of holding assets at or above the nisab. Zakat falls due only once the hawl is complete." },
    ar: { term: "الحول", definition: "سنة قمرية كاملة من تملك الأصول عند النصاب أو فوقه. لا تجب الزكاة إلا بعد اكتمال الحول.", draft: true },
    source: "docs/Behavioral_Profile_Feature_Schema.md §17",
  },
  {
    id: "nisab",
    en: { term: "Nisab", definition: "The minimum wealth on which Zakat is due, set by a weight of gold. In this demo the gold price behind it is a placeholder, not verified." },
    ar: { term: "النصاب", definition: "الحد الأدنى من المال الذي تجب فيه الزكاة، ويُقدّر بوزن من الذهب. سعر الذهب في هذا العرض قيمة مؤقتة غير موثقة.", draft: true },
    source: "docs/Behavioral_Profile_Feature_Schema.md §17; DECISIONS.md entry 41 (U7)",
  },
  {
    id: "zakatable-assets",
    en: { term: "Zakatable assets", definition: "Cash, inventory and receivables at the balance-sheet snapshot: the business assets Zakat is calculated on." },
    ar: { term: "الأصول الزكوية", definition: "النقد والمخزون والذمم المدينة في لقطة الميزانية: أصول المنشأة التي تُحسب عليها الزكاة.", draft: true },
    source: "docs/Behavioral_Profile_Feature_Schema.md §7",
  },
  {
    id: "deductible-liabilities",
    en: { term: "Deductible liabilities", definition: "Payables and other short-term debts due within the Zakat year. They are subtracted from zakatable assets to give the Zakat base." },
    ar: { term: "الالتزامات المخصومة", definition: "الذمم الدائنة والديون قصيرة الأجل المستحقة خلال سنة الزكاة. تُطرح من الأصول الزكوية للوصول إلى وعاء الزكاة.", draft: true },
    source: "docs/Behavioral_Profile_Feature_Schema.md §7",
  },
  {
    id: "sharia-screen",
    en: { term: "Sharia screen", definition: "A rule-based check of the business's activity against a rule table. It is pending confirmation by a Sharia advisor and is not a Sharia ruling." },
    ar: { term: "الفحص الشرعي", definition: "فحص قائم على القواعد لنشاط المنشأة مقابل جدول قواعد. ينتظر تأكيد مستشار شرعي، وليس حكمًا شرعيًا.", draft: true },
    source: "docs/Behavioral_Profile_Feature_Schema.md §6 (feature 24); DECISIONS.md entry 26",
  },
  {
    id: "rule-table-status",
    en: { term: "Rule table status", definition: "Whether the Sharia rule table has been confirmed. While it reads proposed and unverified, no advisor has certified it." },
    ar: { term: "حالة جدول القواعد", definition: "هل أُكّد جدول القواعد الشرعية. ما دام مقترحًا وغير موثق، فلم يعتمده أي مستشار.", draft: true },
    source: "DECISIONS.md entry 26 (rule table proposed, not certified)",
  },
  {
    id: "markup-fixed",
    en: { term: "Markup fixed at signing", definition: "The markup is set once, when the contract is signed, and is never repriced during repayment." },
    ar: { term: "هامش ثابت عند التوقيع", definition: "يُحدَّد هامش الربح مرة واحدة عند توقيع العقد، ولا يُعاد تسعيره خلال السداد.", draft: true },
    source: "docs/Behavioral_Profile_Feature_Schema.md §17 (fixed markup at inception)",
  },
  {
    id: "charity-late",
    en: { term: "Charity-directed late payment", definition: "Any late-payment penalty goes to charity and is never kept as income, because conventional late fees are not permitted." },
    ar: { term: "غرامات التأخير للأعمال الخيرية", definition: "أي غرامة على التأخر في السداد تُصرف للأعمال الخيرية ولا تُحتسب دخلًا، لأن غرامات التأخير التقليدية غير جائزة.", draft: true },
    source: "docs/Behavioral_Profile_Feature_Schema.md §17 (late payments)",
  },
  {
    id: "cash-floor",
    en: { term: "Cash floor", definition: "A balance of zero. The forecast watches for a projected balance that falls below it." },
    ar: { term: "حد النقد", definition: "رصيد يساوي صفرًا. يراقب التوقع أي رصيد متوقع ينزل تحته.", draft: true },
    source: "DECISIONS.md entry 23 (crunch alert, projected negative balance)",
  },
  {
    id: "naive-baseline",
    en: { term: "Naive baseline", definition: "A simple forecast built from the trailing thirty-day average. The model has to beat it to earn its place." },
    ar: { term: "الخط الأساسي البسيط", definition: "توقع بسيط مبني على متوسط آخر ثلاثين يومًا. على النموذج أن يتفوق عليه ليثبت جدواه.", draft: true },
    source: "docs/Behavioral_Profile_Feature_Schema.md §10",
  },
  {
    id: "crunch-alert",
    en: { term: "Crunch alert", definition: "The forecast's warning level for a coming cash shortfall: none, watch or crunch." },
    ar: { term: "تنبيه الضائقة", definition: "مستوى تحذير التوقع من نقص نقدي قادم: لا تنبيه، أو مراقبة، أو ضائقة.", draft: true },
    source: "DECISIONS.md entry 23 (crunch alert); schema §8",
  },
  {
    id: "review-queue",
    en: { term: "Review queue", definition: "Transactions picked out for a person to look at. The lens fills a fixed number of slots for every business, so a full queue proves nothing by itself." },
    ar: { term: "قائمة المراجعة", definition: "معاملات مختارة ليراجعها شخص. تملأ العدسة عددًا ثابتًا من الخانات لكل منشأة، لذا لا تثبت القائمة الممتلئة شيئًا بذاتها.", draft: true },
    source: "DECISIONS.md entry 29 (the anomaly lens fills its cap)",
  },
  {
    id: "flag-reason",
    en: { term: "Flag reason", definition: "Why a transaction was placed in the review queue, given as a category such as an unusual amount or an unusual hour. It is not an accusation." },
    ar: { term: "سبب الإدراج", definition: "سبب وضع المعاملة في قائمة المراجعة، في صورة فئة مثل مبلغ غير معتاد أو ساعة غير معتادة. وليس اتهامًا.", draft: true },
    source: "docs/Behavioral_Profile_Feature_Schema.md §8 and §29",
  },
  {
    id: "scenario",
    en: { term: "Scenario", definition: "The same demo business rebuilt in memory under a disaster picked from a fixed menu, so the disaster is the only difference." },
    ar: { term: "السيناريو", definition: "منشأة العرض نفسها يُعاد بناؤها في الذاكرة تحت كارثة مختارة من قائمة ثابتة، فتكون الكارثة هي الفرق الوحيد.", draft: true },
    source: "DECISIONS.md entry 29 (scenario library)",
  },
  {
    id: "baseline",
    en: { term: "Baseline", definition: "The scenario with no extra disaster: the demo business exactly as configured. Every other scenario is compared with it." },
    ar: { term: "الأساس", definition: "السيناريو دون كارثة إضافية: منشأة العرض كما ضُبطت تمامًا. يُقارن به كل سيناريو آخر.", draft: true },
    source: "DECISIONS.md entry 29 (scenario library)",
  },
  {
    id: "synthetic-data",
    en: { term: "Synthetic data", definition: "Data made by the project's generator from a fixed configuration. None of it comes from a real business." },
    ar: { term: "بيانات اصطناعية", definition: "بيانات ينتجها مولّد المشروع من إعدادات ثابتة. لا يأتي شيء منها من منشأة حقيقية.", draft: true },
    source: "docs/Behavioral_Profile_Feature_Schema.md §12",
  },
  {
    id: "population",
    en: { term: "Population (serving and research)", definition: "The generator makes two groups: a large research population for training and testing models, and a smaller serving population that the API and this demo show." },
    ar: { term: "المجموعة (الخدمة والبحث)", definition: "يُنتج المولّد مجموعتين: مجموعة بحث كبيرة لتدريب النماذج واختبارها، ومجموعة خدمة أصغر تعرضها الواجهة البرمجية وهذا العرض.", draft: true },
    source: "docs/Behavioral_Profile_Feature_Schema.md §23",
  },
] as const satisfies readonly GlossaryEntry[];

export type GlossaryId = (typeof GLOSSARY)[number]["id"];

export function glossaryEntry(id: GlossaryId): GlossaryEntry {
  return GLOSSARY.find((entry) => entry.id === id)!;
}

/** Entries in the alphabetical order of the locale's own terms. */
export function glossaryFor(locale: Locale) {
  return [...GLOSSARY].sort((a, b) => a[locale].term.localeCompare(b[locale].term, locale));
}
