import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ApiError, Card, CardLoading, Page } from "@/components/ui";
import { fill, getMessages, isLocale, type Locale, type Messages } from "@/lib/i18n";
import { isServingId } from "@/lib/population";
import type { ApiResult } from "@/lib/types";

export function NotServing({ locale, m, id }: { locale: string; m: Messages; id: string }) {
  return (
    <Page>
      <h1 className="heading text-[40px]">{fill(m.dashboard.title, { id })}</h1>
      <ApiError kind="not_found" m={m} />
      <Link href={`/${locale}`} className="textlink underline">
        {m.common.back}
      </Link>
    </Page>
  );
}

/** One lens: its own loading state and its own error, so a slow or failed lens blocks no other (§8). */
export function Lens<T>({ title, result, m, children }: { title: string; result: Promise<ApiResult<T>>; m: Messages; children: (data: T) => ReactNode }) {
  return (
    <Suspense fallback={<CardLoading title={title} m={m} />}>
      <Resolved title={title} result={result} m={m}>
        {children}
      </Resolved>
    </Suspense>
  );
}

async function Resolved<T>({ title, result, m, children }: { title: string; result: Promise<ApiResult<T>>; m: Messages; children: (data: T) => ReactNode }) {
  const r = await result;
  if (r.ok) return children(r.data);
  return (
    <Card title={title}>
      <ApiError kind={r.kind} detail={r.detail} m={m} />
    </Card>
  );
}

type Params = Promise<{ locale: string; id: string }>;

async function Body<T>({ result, render, locale, m, id, title }: { result: Promise<ApiResult<T>>; render: (data: T) => ReactNode; locale: string; m: Messages; id: string; title: string }) {
  const r = await result;
  if (r.ok) return <Page>{render(r.data)}</Page>;
  if (r.kind === "not_found") return <NotServing locale={locale} m={m} id={id} />;
  return (
    <Page>
      <h1 className="heading text-[40px]">{title}</h1>
      <ApiError kind={r.kind} detail={r.detail} m={m} />
    </Page>
  );
}

/** A page for one lens: it fetches that lens alone, through the queue in lib/api.ts. */
export async function LensPage<T>({
  params,
  load,
  title,
  children,
}: {
  params: Params;
  load: (id: number) => Promise<ApiResult<T>>;
  title: (m: Messages) => string;
  children: (data: T, context: { locale: Locale; m: Messages }) => ReactNode;
}) {
  const { locale, id: rawId } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  const id = Number(rawId);
  if (!isServingId(id)) return <NotServing locale={locale} m={m} id={rawId} />;
  return (
    <Suspense
      fallback={
        // I7: the title and the business ID come from the route, so they show before the lens answers.
        <Page>
          <div className="flex flex-col gap-3" data-lens-fallback>
            <span className="font-mono text-[13px] uppercase text-muted">{fill(m.dashboard.title, { id: rawId })}</span>
            <h1 className="heading text-[40px] sm:text-[52px]">{title(m)}</h1>
          </div>
          <CardLoading title={title(m)} m={m} tall />
        </Page>
      }
    >
      <Body result={load(id)} render={(data) => children(data, { locale, m })} locale={locale} m={m} id={rawId} title={title(m)} />
    </Suspense>
  );
}
