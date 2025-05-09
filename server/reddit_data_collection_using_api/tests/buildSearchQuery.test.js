/**
 * Query Builder Tests
 *
 * Tests for the buildSearchQuery function that formats search parameters
 * for the Reddit API search endpoint
 */

const { buildSearchQuery } = require("../server");

describe("buildSearchQuery", () => {
  test("should build a basic query with a single keyword", () => {
    const params = { keyword: "javascript" };
    const result = buildSearchQuery(params);

    // Validate basic query structure
    expect(result.q).toBe("javascript NOT nsfw:1");
    expect(result.t).toBe("all");
    expect(result.sort).toBe("relevance");
    expect(result.limit).toBe(100);
    expect(result.restrict_sr).toBe(false);
  });

  test("should handle quoted phrases correctly", () => {
    const params = { keyword: '"web development"' };
    const result = buildSearchQuery(params);

    // Verify quoted phrases are processed correctly
    expect(result.q).toBe('"web development" NOT nsfw:1');
  });

  test("should automatically add quotes to phrases with spaces", () => {
    const params = { keyword: "web development" };
    const result = buildSearchQuery(params);

    // Confirm phrases with spaces are quoted
    expect(result.q).toBe('"web development" NOT nsfw:1');
  });

  test("should preserve logical operators (AND, OR)", () => {
    const params = { keyword: "javascript OR python" };
    const result = buildSearchQuery(params);

    // Check logical operators are preserved
    expect(result.q).toBe("javascript OR python NOT nsfw:1");
  });

  test("should handle multiple terms and operators", () => {
    const params = { keyword: "javascript AND (react OR angular)" };
    const result = buildSearchQuery(params);

    // Ensure complex queries with multiple terms and operators are processed
    expect(result.q).toBe("javascript AND (react OR angular) NOT nsfw:1");
  });

  test("should filter by subreddits when provided", () => {
    const params = {
      keyword: "javascript",
      subreddits: ["programming", "webdev"],
    };
    const result = buildSearchQuery(params);

    // Validate subreddits are included in the query
    expect(result.q).toContain("javascript");
    expect(result.q).toContain("(subreddit:programming OR subreddit:webdev)");
  });

  test("should omit NSFW filter when includeNsfw is true", () => {
    const params = {
      keyword: "javascript",
      includeNsfw: true,
    };
    const result = buildSearchQuery(params);

    // Confirm NSFW filter is omitted when includeNsfw is true
    expect(result.q).toBe("javascript");
    expect(result.q).not.toContain("NOT nsfw:1");
  });

  test("should apply custom timeframe", () => {
    const params = {
      keyword: "javascript",
      timeframe: "week",
    };
    const result = buildSearchQuery(params);

    // Verify custom timeframe is applied
    expect(result.t).toBe("week");
  });

  test("should apply custom sort order", () => {
    const params = {
      keyword: "javascript",
      sort: "new",
    };
    const result = buildSearchQuery(params);

    // Confirm custom sort order is applied
    expect(result.sort).toBe("new");
  });

  test("should handle complex queries with multiple features", () => {
    const params = {
      keyword: 'javascript "react hooks" OR angular',
      subreddits: ["programming", "webdev"],
      timeframe: "month",
      sort: "top",
      includeNsfw: false,
    };
    const result = buildSearchQuery(params);

    // Validate complex queries with multiple features are processed
    expect(result.q).toContain("javascript");
    expect(result.q).toContain('"react hooks"');
    expect(result.q).toContain("OR angular");
    expect(result.q).toContain("(subreddit:programming OR subreddit:webdev)");
    expect(result.q).toContain("NOT nsfw:1");
    expect(result.t).toBe("month");
    expect(result.sort).toBe("top");
  });
});
