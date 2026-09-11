import { describe, expect, it } from "vitest";
import {
  classifyQuery,
  escapeLike,
  extractPhone,
  extractToken,
  type SearchKind,
} from "../routes/admin/search";

/**
 * `GET /v1/admin/search` is a dispatcher: what it does is decided entirely by
 * the *shape* of what the agent typed. Everything downstream of that decision
 * is a primary-key or unique-index lookup, so the only thing that can be
 * meaningfully wrong — and the only thing testable without a database — is the
 * dispatch itself.
 *
 * These are unit tests on purpose. The integration suites need
 * `TEST_DATABASE_URL`, which is unset by default, so a misrouted phone number
 * would otherwise not fail CI at all.
 */

/** Shorthand: only the branch a query lands in. */
const kindOf = (q: string): SearchKind => classifyQuery(q).kind;

describe("classifyQuery: blank and oversized input", () => {
  it.each([undefined, null, "", "   ", "a", " x "])(
    "treats %p as empty rather than scanning",
    (input) => {
      expect(classifyQuery(input).kind).toBe("empty");
    },
  );

  it("rejects input long enough to be a pathological pattern", () => {
    expect(kindOf("x".repeat(513))).toBe("empty");
  });

  it("still accepts a long pasted URL", () => {
    const url = `https://pgkhata.com/invoice/${"0".repeat(8)}-1111-2222-3333-444444444444?${"u=1&".repeat(50)}`;
    expect(url.length).toBeLessThanOrEqual(512);
    expect(kindOf(url)).toBe("token");
  });

  it("reports the trimmed input back verbatim", () => {
    expect(classifyQuery("  Sunrise PG  ").text).toBe("Sunrise PG");
  });
});

describe("classifyQuery: phone is the primary lookup key", () => {
  it.each([
    ["9876543210", "9876543210"],
    ["+919876543210", "9876543210"],
    ["+91 9876543210", "9876543210"],
    ["+91-98765-43210", "9876543210"],
    ["919876543210", "9876543210"],
    ["09876543210", "9876543210"],
    ["+91 (98765) 43210", "9876543210"],
    ["98765 43210", "9876543210"],
    ["98765.43210", "9876543210"],
  ])("normalises %s to the 10 national digits", (input, expected) => {
    const classified = classifyQuery(input);
    expect(classified.kind).toBe("phone");
    expect(classified.value).toBe(expected);
  });

  it.each(["12345", "98765432101234", "987654321"])(
    "refuses to guess at %s and falls through to free text",
    (input) => {
      expect(kindOf(input)).not.toBe("phone");
    },
  );

  it("does not treat a phone-shaped fragment inside a name as a phone", () => {
    expect(kindOf("Ravi 9876543210")).toBe("text");
  });

  it("extractPhone returns null for anything not phone-shaped", () => {
    expect(extractPhone("ravi@pg.in")).toBeNull();
    expect(extractPhone("9876543210")).toBe("9876543210");
  });
});

describe("classifyQuery: email", () => {
  it.each(["ravi@gmail.com", "RAVI@GMAIL.COM", "@sunrisepg.in", "ravi+bills@gmail.com"])(
    "routes %s to the email branch",
    (input) => {
      expect(kindOf(input)).toBe("email");
    },
  );

  it("passes the address through unchanged for a substring match", () => {
    expect(classifyQuery("@sunrisepg.in").value).toBe("@sunrisepg.in");
  });
});

describe("classifyQuery: UUID", () => {
  const uuid = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

  it("routes a bare UUID to the primary-key probes", () => {
    expect(classifyQuery(uuid)).toEqual({ kind: "uuid", value: uuid, text: uuid });
  });

  it("is case-insensitive", () => {
    expect(kindOf(uuid.toUpperCase())).toBe("uuid");
  });

  it.each([
    "3f2504e0-4f89-11d3-9a0c",
    "3f2504e0-4f89-11d3-9a0c-0305e82c3301-extra",
    "zzzzzzzz-4f89-11d3-9a0c-0305e82c3301",
  ])("does not mistake %s for a UUID", (input) => {
    expect(kindOf(input)).not.toBe("uuid");
  });
});

describe("classifyQuery: a whole pasted URL resolves to its token", () => {
  const billToken = "8c4b0d2e-9f11-4a3b-8b7e-2d6c1a5e9f03";
  const onboardingToken = "kZ9-qTnR4xLb_7Yw2PmH1cVdAeJs6UgF";

  it.each([
    [`https://pgkhata.com/invoice/${billToken}`, billToken],
    [`https://pgkhata.com/invoice/${billToken}?utm_source=whatsapp`, billToken],
    [`https://pgkhata.com/invoice/${billToken}#summary`, billToken],
    [`http://localhost:3000/public/signup/${billToken}`, billToken],
    [`https://pgkhata.com/public/complaint/${billToken}/`, billToken],
    [`pgkhata.com/onboarding/${onboardingToken}`, onboardingToken],
    [`/invoice/${billToken}`, billToken],
  ])("lifts the token out of %s", (url, expected) => {
    const classified = classifyQuery(url);
    expect(classified.kind).toBe("token");
    expect(classified.value).toBe(expected);
  });

  it("keeps the original URL in `text` so the handler can tell it was extracted", () => {
    const url = `https://pgkhata.com/invoice/${billToken}`;
    const classified = classifyQuery(url);
    // value !== text is what suppresses the free-text fallback: a dead link
    // should not be re-run as a name search for the URL itself.
    expect(classified.value).not.toBe(classified.text);
    expect(classified.text).toBe(url);
  });

  it("never mistakes a hostname for the token", () => {
    // A dot is not in the token alphabet, which is what keeps `pgkhata.com`
    // and `verylongsubdomainwithoutdots.example` out of the running.
    expect(classifyQuery(`https://pgkhata.com/invoice/${billToken}`).value).toBe(billToken);
    expect(extractToken("https://someverylongsubdomainname.example/x")).toBeNull();
  });

  it("returns null for anything that is not link-shaped", () => {
    expect(extractToken(billToken)).toBeNull();
    expect(extractToken("Sunrise PG")).toBeNull();
  });
});

describe("classifyQuery: bare tokens keep a free-text escape hatch", () => {
  const onboardingToken = "kZ9qTnR4xLbYw2PmH1cVdAeJs6UgFabc";

  it("routes a bare base64url token to the token branch", () => {
    const classified = classifyQuery(onboardingToken);
    expect(classified.kind).toBe("token");
    // value === text marks it as bare, which is the signal the handler uses to
    // retry as free text — "sunrisepgboyshostelkanadia" is also long, opaque
    // and token-shaped, and it is somebody's property name.
    expect(classified.value).toBe(classified.text);
  });

  it("treats a long unbroken property name the same way, so it stays findable", () => {
    const name = "sunrisepgboyshostelkanadia";
    expect(classifyQuery(name)).toEqual({ kind: "token", value: name, text: name });
  });
});

describe("classifyQuery: free text is the fallback, not the default", () => {
  it.each(["Sunrise PG", "Ravi Kumar", "PG-01", "101", "Indore", "PG_01"])(
    "routes %s to the free-text branch",
    (input) => {
      expect(kindOf(input)).toBe("text");
    },
  );

  it("never returns a kind outside the declared set", () => {
    const kinds: SearchKind[] = ["empty", "phone", "email", "uuid", "token", "text"];
    for (const input of ["", "9876543210", "a@b.co", "Sunrise PG", "/invoice/x"]) {
      expect(kinds).toContain(kindOf(input));
    }
  });
});

describe("ilike escaping", () => {
  /**
   * `_` is the dangerous one and the reason this is tested here rather than
   * trusted: property codes and emails are full of underscores, and an
   * unescaped `PG_01` silently also matches `PG-01` and `PGX01` with no way for
   * the agent to tell the results apart.
   */
  it("neutralises the single-character wildcard", () => {
    expect(escapeLike("PG_01")).toBe("PG\\_01");
  });

  it("neutralises the multi-character wildcard", () => {
    expect(escapeLike("100%")).toBe("100\\%");
  });

  it("escapes the escape character first, so nothing is double-escaped", () => {
    expect(escapeLike("a\\b")).toBe("a\\\\b");
    expect(escapeLike("a\\_b")).toBe("a\\\\\\_b");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeLike("Sunrise PG")).toBe("Sunrise PG");
    expect(escapeLike("ravi@gmail.com")).toBe("ravi@gmail.com");
  });

  it("cannot be used to turn a search into a match-everything pattern", () => {
    // Without escaping this is the pattern `%%%`, which matches every row.
    expect(escapeLike("%")).toBe("\\%");
  });
});

describe("dispatch precedence", () => {
  /**
   * Each of these is ambiguous on purpose: it satisfies more than one shape
   * test. The order in `classifyQuery` is the whole contract, so it is asserted
   * rather than left to whichever branch happens to be written first.
   */
  it("prefers the token in a URL over the digits in it", () => {
    const url = "https://pgkhata.com/invoice/8c4b0d2e-9f11-4a3b-8b7e-2d6c1a5e9f03?ref=9876543210";
    expect(kindOf(url)).toBe("token");
  });

  it("prefers the token in a URL over an email in it", () => {
    const url = "https://pgkhata.com/onboarding/kZ9qTnR4xLbYw2PmH1cVdAeJs6UgFabc?to=ravi@pg.in";
    const classified = classifyQuery(url);
    expect(classified.kind).toBe("token");
    expect(classified.value).toBe("kZ9qTnR4xLbYw2PmH1cVdAeJs6UgFabc");
  });

  it("prefers phone over email, because a phone never contains an @", () => {
    expect(kindOf("+91 98765 43210")).toBe("phone");
  });

  it("prefers email over UUID when an address contains one", () => {
    expect(kindOf("3f2504e0-4f89-11d3-9a0c-0305e82c3301@pg.in")).toBe("email");
  });

  it("prefers UUID over the bare-token branch", () => {
    // A UUID satisfies the opaque-token pattern too; classifying it as a UUID
    // is what gets the five primary-key probes rather than three token probes.
    expect(kindOf("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe("uuid");
  });
});
