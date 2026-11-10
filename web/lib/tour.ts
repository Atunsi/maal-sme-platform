// E1: the guided tour (DECISIONS 51). Fixed text written for the UI. Captions say what to look at, never
// what a value is, and hold no digits (N1). Every Arabic string is a draft for review.
import type { Locale } from "@/lib/i18n";

/** The one place the tour's business and scenario are named. */
export const TOUR = { business: 10001, scenario: "severe_collapse" } as const;

export type TourStep = {
  id: string;
  /** Path under /[locale], before the tour and role queries. */
  path: string;
  /** Extra query, without the leading ? or &. */
  query?: string;
  /** Value of the data-tour attribute on the element the step points at. */
  target: string;
  en: { title: string; caption: string };
  ar: { title: string; caption: string; draft: true };
};

const biz = `/business/${TOUR.business}`;

export const TOUR_STEPS: TourStep[] = [
  {
    id: "verdict",
    path: biz,
    target: "verdict",
    en: { title: "The verdict", caption: "Start with the decision word, the amount and the terms under it. The markup fixed at signing and the charity line come with every approval." },
    ar: { title: "القرار", caption: "ابدأ بكلمة القرار، وتحتها المبلغ والشروط. هامش الربح الثابت عند التوقيع وصرف غرامات التأخير في وجوه الخير يرافقان كل موافقة.", draft: true },
  },
  {
    id: "factors",
    path: `${biz}/credit`,
    target: "factors",
    en: { title: "Why, in plain words", caption: "Each bar is one reason. Bars on the supports side helped the approval, bars on the against side weighed on it, and the plates name how strongly." },
    ar: { title: "ليش، بكلام واضح", caption: "كل شريط سبب واحد. الأشرطة في جهة الدعم ساعدت الموافقة، واللي في الجهة الثانية أضعفتها، واللوحات توضّح قوة كل سبب.", draft: true },
  },
  {
    id: "compliance",
    path: `${biz}/credit`,
    query: "view=compliance",
    target: "compliance",
    en: { title: "The Compliance View", caption: "The same decision for a reviewer: the model's raw outputs, and the CV AUC and oracle ceiling read straight from the receipt." },
    ar: { title: "عرض الامتثال", caption: "القرار نفسه للمراجع: مخرجات النموذج الخام، وقيمة AUC بالتحقق المتقاطع وسقفها المرجعي، مقروءتين مباشرة من الإيصال.", draft: true },
  },
  {
    id: "pending",
    path: `${biz}/sharia`,
    target: "pending",
    en: { title: "Pending a Sharia advisor", caption: "The frame says this is rule-based screening awaiting an advisor. Below it, the rule table status shows the table is not yet confirmed." },
    ar: { title: "بانتظار مستشار شرعي", caption: "الإطار يوضّح أن هذا فحص قائم على القواعد ينتظر اعتماد مستشار شرعي. وتحته تبيّن حالة جدول القواعد أن الجدول لم يُعتمد بعد.", draft: true },
  },
  {
    id: "waterfall",
    path: `${biz}/zakat`,
    target: "waterfall",
    en: { title: "Zakat, step by step", caption: "Follow the bars from zakatable assets to the Zakat base, and the marker where the nisab sits. The plate says whether the nisab price has been verified." },
    ar: { title: "الزكاة خطوة بخطوة", caption: "تتبّع الأشرطة من الأصول الزكوية إلى الوعاء الزكوي، والعلامة عند موضع النصاب. واللوحة توضّح هل جرى التحقق من سعر النصاب.", draft: true },
  },
  {
    id: "runway",
    path: `${biz}/forecast`,
    target: "runway",
    en: { title: "The runway", caption: "Compare the model's line with the naive baseline, and watch where either crosses the cash floor. Focus the chart to read each horizon." },
    ar: { title: "المدى النقدي", caption: "قارن خط النموذج بخط الأساس البسيط، ولاحظ وين ينزل أي منهما تحت الحد الأدنى للنقد. اضغط على المخطط عشان تقرأ كل أفق.", draft: true },
  },
  {
    id: "timeline",
    path: `${biz}/review`,
    target: "timeline",
    en: { title: "The review queue", caption: "Each mark is a transaction listed for a person to look at, placed by date and named by its flag reason. A full list proves nothing by itself." },
    ar: { title: "قائمة المراجعة", caption: "كل علامة معاملة مدرجة ليراجعها شخص، مرتبة حسب التاريخ ومسمّاة بسبب إدراجها. وامتلاء القائمة لا يثبت شيئًا بذاته.", draft: true },
  },
  {
    id: "diff",
    path: "/scenarios",
    query: `scenario=${TOUR.scenario}`,
    target: "diff",
    en: { title: "The same business under stress", caption: "The diff sheet marks every row the disaster changed. The panel below sums up the findings, with the caveat that each scenario is a single business." },
    ar: { title: "المنشأة نفسها تحت الضغط", caption: "ورقة المقارنة تبرز كل صف غيّرته الأزمة. واللوحة تحتها تلخص النتائج، مع التنبيه إلى أن كل سيناريو منشأة وحدة.", draft: true },
  },
  {
    id: "receipt",
    path: biz,
    target: "receipt",
    // DECISIONS 58: the step explains the plain card, not hashes; the technical record is named for auditors.
    en: { title: "How this result was reached", caption: "Every result says what data it used and how it was reached, and gives a reference number to quote if you have a question. Auditors can open the technical record." },
    ar: { title: "كيف وصلنا إلى هذه النتيجة", caption: "تبيّن كل نتيجة البيانات التي اعتمدت عليها وكيف وصلنا إليها، وتعطيك رقمًا مرجعيًا تذكره إذا كان لديك استفسار. ويستطيع المدققون فتح السجل التقني.", draft: true },
  },
];

/** The page URL for a step, keeping the demo role. */
export function tourHref(locale: Locale, step: TourStep, role: string | null): string {
  const query = [step.query, `tour=${step.id}`, role ? `as=${role}` : null].filter(Boolean).join("&");
  return `/${locale}${step.path}?${query}`;
}

/** I10: carries the step a finished tour ended on, as ?tourEnded=, on a page link's query. */
export function withTourEnded(query: string, stepId: string | null): string {
  if (!stepId) return query;
  return `${query}${query ? "&" : "?"}tourEnded=${stepId}`;
}

export function tourStep(id: string | null): { step: TourStep; index: number } | null {
  const index = TOUR_STEPS.findIndex((s) => s.id === id);
  return index < 0 ? null : { step: TOUR_STEPS[index]!, index };
}
