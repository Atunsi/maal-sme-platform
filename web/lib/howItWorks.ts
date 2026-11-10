// E9: the "How Ma'al decides" page (DECISIONS 51). Fixed text written for the UI from the repo's own
// documents; the source of each section is in the comment above it. No digits (N1): any number the page
// shows comes from code. `[[id|text]]` marks a glossary term, rendered with <Term>, first appearance only.
// Every Arabic string is a draft for review, like the rest of messages/ar.json.
import type { GlossaryId } from "@/lib/glossary";

export type HowSection = {
  id: string;
  /** Path under /[locale], with the role query added by the page. */
  link: string;
  en: { title: string; body: string[]; linkLabel: string };
  ar: { title: string; body: string[]; linkLabel: string; draft: true };
};

export const HOW_INTRO = {
  en: {
    eyebrow: "How Ma'al decides",
    title: "From transactions to a decision you can check",
    intro: "What each part of the demo reads, what it returns, and what it never does. Every section links to the same part for the demo business.",
  },
  ar: {
    eyebrow: "كيف يقرر مآل",
    title: "من المعاملات إلى قرار يمكنك التحقق منه",
    intro: "ما يقرؤه كل جزء من النسخة التجريبية، وما يعيده، وما لا يفعله أبدًا. ويرتبط كل قسم بالجزء نفسه للمنشأة التجريبية.",
    draft: true,
  },
} as const;

export const HOW_SECTIONS: HowSection[] = [
  // Schema §12 (generator from config), §23 (research and serving populations), DECISIONS 41 (U11, serving only).
  {
    id: "data",
    link: "/business/{id}",
    en: {
      title: "Data in",
      body: [
        "Every business here is [[synthetic-data|synthetic data]] made by the project's generator from a fixed configuration. No real business, bank or person is behind any of it.",
        "The generator makes a large research [[population|population]] for training and testing the models, and a smaller serving population. This demo, and the API under it, show serving businesses only.",
      ],
      linkLabel: "Open the demo business",
    },
    ar: {
      title: "البيانات الداخلة",
      body: [
        "كل منشأة هنا [[synthetic-data|بيانات اصطناعية]] ينتجها مولّد المشروع من إعدادات ثابتة. لا تقف وراءها أي منشأة أو بنك أو شخص حقيقي.",
        "يُنتج المولّد [[population|مجموعة]] بحث كبيرة لتدريب النماذج واختبارها، ومجموعة خدمة أصغر. ولا تعرض هذه النسخة التجريبية، ولا الواجهة البرمجية خلفها، إلا منشآت مجموعة الخدمة.",
      ],
      linkLabel: "افتح المنشأة التجريبية",
      draft: true,
    },
  },
  // Schema §15 (data sufficiency, insufficient_data and partial_profile as states, not scores), §16 (null reasons).
  {
    id: "profile",
    link: "/business/{id}",
    en: {
      title: "The behavioural profile",
      body: [
        "Bank and point-of-sale activity is turned once into a set of behavioural features, such as how regular income is and how often the balance runs short. Every lens reads this same profile.",
        "A business with too little recent activity gets [[insufficient-data|insufficient data]]: a refusal to judge, never a low result. One with some features missing gets a [[partial-profile|partial profile]], and each missing feature is listed with its reason.",
      ],
      linkLabel: "See the profile features",
    },
    ar: {
      title: "الملف السلوكي",
      body: [
        "تُحوَّل حركة الحساب البنكي ونقاط البيع مرة واحدة إلى مجموعة مؤشرات سلوكية، مثل انتظام الدخل وتكرار انخفاض الرصيد. وكل عدسة تقرأ هذا الملف نفسه.",
        "المنشأة ذات النشاط الحديث القليل تحصل على [[insufficient-data|بيانات غير كافية]]: امتناع عن الحكم، وليس نتيجة منخفضة. والمنشأة التي تنقصها بعض المؤشرات تحصل على [[partial-profile|ملف جزئي]]، ويُعرض كل مؤشر ناقص مع سببه.",
      ],
      linkLabel: "اعرض مؤشرات الملف",
      draft: true,
    },
  },
  // Schema §11 and §17 (base markup always present, markup_fixed_at_inception, charity_directed), DECISIONS 41 (U1, U2, U3).
  {
    id: "credit",
    link: "/business/{id}/credit",
    en: {
      title: "Credit",
      body: [
        "Reads the profile and returns a decision: approved or declined, and for an approval the amount, the repayment months and the base markup, with the reasons that weighed most.",
        "The [[markup-fixed|markup is fixed at signing]] and late payments go to charity. There is no control anywhere that changes a term, and no what-if on the offer.",
      ],
      linkLabel: "Open the Credit page",
    },
    ar: {
      title: "التمويل",
      body: [
        "تقرأ الملف وتعيد قرارًا: موافقة أو رفض، ومع الموافقة المبلغ وأشهر السداد وهامش الربح الأساسي، مع الأسباب الأكثر تأثيرًا.",
        "[[markup-fixed|هامش الربح ثابت عند التوقيع]]، و[[charity-late|غرامات التأخير تُصرف في وجوه الخير]]. ولا يوجد في أي مكان عنصر يغيّر شرطًا من شروط عرض التمويل.",
      ],
      linkLabel: "افتح صفحة التمويل",
      draft: true,
    },
  },
  // DECISIONS 26 (rule table proposed, not certified), schema §6 feature 24, DECISIONS 41 (U6 fixed label).
  {
    id: "sharia",
    link: "/business/{id}/sharia",
    en: {
      title: "Sharia screen",
      body: [
        "Reads the declared merchant code, or the registered sector when there is none, and checks it against a rule table. It returns a status and every rule it checked.",
        "It is a rule-based [[sharia-screen|Sharia screen]], pending confirmation by a Sharia advisor. It is never a Sharia ruling, and the page says so every time.",
      ],
      linkLabel: "Open the Sharia screen page",
    },
    ar: {
      title: "الفحص الشرعي",
      body: [
        "يقرأ رمز فئة التاجر المُعلَن، أو القطاع المسجل إن لم يوجد، ويطابقه مع جدول قواعد. ويعيد الحالة وكل قاعدة فحصها.",
        "هو [[sharia-screen|فحص شرعي]] قائم على القواعد، ينتظر اعتماد مستشار شرعي. وليس حكمًا شرعيًا أبدًا، والصفحة توضّح ذلك في كل مرة.",
      ],
      linkLabel: "افتح صفحة الفحص الشرعي",
      draft: true,
    },
  },
  // Schema §7 (balance-sheet snapshot, zakatable assets less short-term liabilities), §17 (nisab and hawl), DECISIONS Zakat
  // section (nisab source status), 41 (U7) and 45 (U7 widened).
  {
    id: "zakat",
    link: "/business/{id}/zakat",
    en: {
      title: "Zakat",
      body: [
        "Reads the balance-sheet snapshot, not the transactions: [[zakatable-assets|zakatable assets]] less deductible liabilities give the Zakat base, which is checked against the [[nisab|nisab]] and the hawl.",
        "A plate shows the verification status of the gold price behind the nisab, and the result is not a ZATCA assessment.",
      ],
      linkLabel: "Open the Zakat page",
    },
    ar: {
      title: "الزكاة",
      body: [
        "تقرأ الميزانية لا المعاملات: [[zakatable-assets|الأصول الزكوية]] محسومًا منها [[deductible-liabilities|الالتزامات المحسومة]] تعطي الوعاء الزكوي، ويُقارن بـ[[nisab|النصاب]] و[[hawl|الحول]].",
        "وتبيّن لوحة حالة التحقق من سعر الذهب الذي يُحسب عليه النصاب، والنتيجة ليست ربطًا زكويًا من هيئة الزكاة والضريبة والجمارك.",
      ],
      linkLabel: "افتح صفحة الزكاة",
      draft: true,
    },
  },
  // Schema §10 (naive baseline, the model must beat it), DECISIONS 23 and 27 (crunch alert, method chosen on validation).
  {
    id: "forecast",
    link: "/business/{id}/forecast",
    en: {
      title: "Forecast",
      body: [
        "Reads the profile and projects the balance ahead, next to a [[naive-baseline|naive baseline]] the model has to beat. It returns the projections and a [[crunch-alert|crunch alert]] level.",
        "Both lines are projections. The page draws no actual history, because the API returns none.",
      ],
      linkLabel: "Open the Forecast page",
    },
    ar: {
      title: "التدفق النقدي",
      body: [
        "يقرأ الملف ويتوقع الرصيد القادم، بجانب [[naive-baseline|خط أساس بسيط]] يجب أن يتفوق النموذج عليه. ويعيد التوقعات ومستوى [[crunch-alert|تنبيه شح السيولة]].",
        "الخطان كلاهما توقعات. ولا ترسم الصفحة سجلًا فعليًا، لأن الواجهة البرمجية لا تعيده.",
      ],
      linkLabel: "افتح صفحة التدفق النقدي",
      draft: true,
    },
  },
  // Schema §8 and §29 (flag_reason only, raw scores never returned), §36.4 (peer benchmarking rejected), DECISIONS 29 (cap).
  {
    id: "review",
    link: "/business/{id}/review",
    en: {
      title: "Review queue",
      body: [
        "Reads the transactions and returns a [[review-queue|review queue]]: a short list for a person to look at, each with its [[flag-reason|flag reason]].",
        "It is never a verdict, it gives no number that ranks risk, and it never compares one business with others.",
      ],
      linkLabel: "Open the Review queue page",
    },
    ar: {
      title: "قائمة المراجعة",
      body: [
        "تقرأ المعاملات وتعيد [[review-queue|قائمة مراجعة]]: قائمة قصيرة ليراجعها شخص، لكل معاملة [[flag-reason|سبب إدراجها]].",
        "وليست حكمًا أبدًا، ولا تعطي رقمًا يرتّب المخاطر، ولا تقارن منشأة بأخرى أبدًا.",
      ],
      linkLabel: "افتح صفحة قائمة المراجعة",
      draft: true,
    },
  },
  // DECISIONS 24 (complete reproducibility receipt), pipeline/week8.py RECEIPT_SCOPE, pipeline/verify.py.
  {
    id: "receipts",
    link: "/business/{id}",
    en: {
      title: "Receipts",
      body: [
        "Each result shows, in plain words, what data it used, how it was reached and a [[reference|reference number]] to quote if you have a question. The technical record below is for auditors.",
        "Every result carries a [[receipt|receipt]]: the hashes of the configuration, the model, the data and the code, and the [[output-hash|output hash]] of the result itself.",
        "The receipt's [[scope|scope]] names a command that re-runs the decision from the same inputs and checks that it comes out byte for byte the same.",
      ],
      linkLabel: "See how a result was reached",
    },
    ar: {
      title: "الإيصالات",
      body: [
        "تبيّن كل نتيجة، بكلمات واضحة، البيانات التي اعتمدت عليها وكيف وصلنا إليها، مع [[reference|رقم مرجعي]] تذكره إذا كان لديك استفسار. أما السجل التقني أدناه فهو للمدققين.",
        "تحمل كل نتيجة [[receipt|إيصالًا]]: بصمات الإعدادات والنموذج والبيانات والشيفرة، و[[output-hash|بصمة المخرجات]] للنتيجة نفسها.",
        "يذكر [[scope|نطاق]] الإيصال أمرًا يعيد تشغيل القرار من المدخلات نفسها ويتحقق أنه يخرج مطابقًا بايتًا ببايت.",
      ],
      linkLabel: "اطّلع على كيفية الوصول إلى نتيجة",
      draft: true,
    },
  },
  // DECISIONS 29 (scenarios are demonstrations on one business), DECISIONS 42 (the demo sign-in protects nothing).
  {
    id: "limits",
    link: "/scenarios",
    en: {
      title: "Limits",
      body: [
        "All of this runs on synthetic data, so no figure here describes a real market.",
        "Each [[scenario|scenario]] rebuilds a single business under one disaster: a demonstration, not an estimate.",
        "The demo sign-in protects nothing. The password sits in the page, and every page opens for anyone with its address.",
      ],
      linkLabel: "Open the scenarios",
    },
    ar: {
      title: "الحدود",
      body: [
        "كل هذا يعمل على بيانات اصطناعية، فلا يصف أي رقم هنا سوقًا حقيقية.",
        "يعيد كل [[scenario|سيناريو]] بناء منشأة واحدة تحت أزمة واحدة: عرض توضيحي، وليس تقديرًا.",
        "لا يحمي الدخول التجريبي أي شيء. فكلمة المرور مكتوبة في الصفحة، وكل صفحة تُفتح لأي شخص لديه رابطها.",
      ],
      linkLabel: "افتح السيناريوهات",
      draft: true,
    },
  },
];

export type Segment = string | { term: GlossaryId; text: string };

/** Splits `[[id|text]]` marks out of a paragraph. */
export function segments(paragraph: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const match of paragraph.matchAll(/\[\[([a-z-]+)\|([^\]]+)\]\]/g)) {
    if (match.index! > last) out.push(paragraph.slice(last, match.index));
    out.push({ term: match[1] as GlossaryId, text: match[2]! });
    last = match.index! + match[0].length;
  }
  if (last < paragraph.length) out.push(paragraph.slice(last));
  return out;
}

/** The paragraph as it reads, without the term marks. */
export const plainText = (paragraph: string) => segments(paragraph).map((s) => (typeof s === "string" ? s : s.text)).join("");
