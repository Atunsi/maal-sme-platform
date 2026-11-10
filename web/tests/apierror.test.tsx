// X4 (DECISIONS 45): an API error's detail is backend text, so Arabic shows the English-template note.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/components/ui";
import { localeOf } from "@/lib/i18n";
import { ar, en } from "./helpers";

describe("api error", () => {
  it("api error detail is labelled as backend text in arabic", () => {
    expect(localeOf(ar)).toBe("ar");
    expect(localeOf(en)).toBe("en");
    const detail = "business_id must be an integer";
    const arabic = render(<ApiError kind="invalid" detail={detail} m={ar} />);
    const backend = arabic.container.querySelector("[data-backend]")!;
    expect(backend.textContent).toBe(detail);
    expect(backend.getAttribute("lang")).toBe("en");
    expect(arabic.container.textContent).toContain(ar.common.englishTemplate);
    arabic.unmount();
    const english = render(<ApiError kind="invalid" detail={detail} m={en} />);
    expect(english.container.textContent).not.toContain(en.common.englishTemplate);
    expect(english.container.querySelector("[data-backend]")!.textContent).toBe(detail);
  });
});
