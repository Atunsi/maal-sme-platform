import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ApiError, Card, CardLoading, Num, Page } from "@/components/ui";
import { RoleLink } from "@/components/RoleLink";
import { fill, getMessages, isLocale, type Locale, type Messages } from "@/lib/i18n";
import { isServingId } from "@/lib/population";
import type { ApiResult } from "@/lib/types";
import type { Scope } from "@/lib/request-layer";
import { DEMO_BUSINESS, roleOf } from "@/lib/businesses";
import { searchOf } from "@/lib/static-data";
import { nameOf } from "@/lib/business-names";
import { localeOf } from "@/lib/i18n";

export function NotServing({ locale, m, id }: { locale: string; m: Messages; id: string }) {
  return (
    <Page>
      {/* A number outside the demo's range belongs to no business, so it gets no business name: the heading is
          the number as typed. */}
      <h1 className="heading text-[40px]">{isServingId(Number(id)) ? fill(m.dashboard.title, { id, name: nameOf(id, localeOf(m)) }) : <Num>{id.slice(0, 20)}</Num>}</h1>
      <ApiError kind="not_found" m={m} />
      {/* CR1 (DECISIONS 62): a bad or unknown number in the address gets the same demo hint as the entry field. */}
      <p data-registration-hint className="text-body">
        {m.registration.notFoundHint}{" "}
        <RoleLink href={`/${locale}/business/${DEMO_BUSINESS}`} aria-label={fill(m.registration.openDemo, { number: DEMO_BUSINESS })} className="textlink font-mono font-semibold">
          <Num>{DEMO_BUSINESS}</Num>
        </RoleLink>
      </p>
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
  searchParams,
  load,
  title,
  children,
}: {
  params: Params;
  /** The page's query: the demo role in it is part of the request layer's key (FX3, RL2). */
  searchParams?: Promise<{ as?: string | string[] }>;
  load: (id: number, scope: Scope) => Promise<ApiResult<T>>;
  title: (m: Messages) => string;
  /** `base` is the business's own address, `/<locale>/business/<id>`, for links to its other pages. */
  children: (data: T, context: { locale: Locale; m: Messages; base: string }) => ReactNode;
}) {
  const { locale, id: rawId } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  const id = Number(rawId);
  if (!isServingId(id)) return <NotServing locale={locale} m={m} id={rawId} />;
  const scope: Scope = { locale, role: roleOf(searchParams ? (await searchOf(searchParams)).as : null) };
  return (
    <Suspense
      fallback={
        // I7: the title and the business ID come from the route, so they show before the lens answers.
        <Page>
          <div className="flex flex-col gap-3" data-lens-fallback>
            <span className="font-mono text-label uppercase text-muted">{fill(m.dashboard.title, { id: rawId, name: nameOf(rawId, localeOf(m)) })}</span>
            <h1 className="heading text-[40px] sm:text-[52px]">{title(m)}</h1>
          </div>
          <CardLoading title={title(m)} m={m} tall />
        </Page>
      }
    >
      <Body result={load(id, scope)} render={(data) => children(data, { locale, m, base: `/${locale}/business/${id}` })} locale={locale} m={m} id={rawId} title={title(m)} />
    </Suspense>
  );
}
