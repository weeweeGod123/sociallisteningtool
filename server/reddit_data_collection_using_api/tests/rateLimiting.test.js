const request = require("supertest");
const axios = require("axios");
let { app } = require("../server");

// Mock axios to avoid real API calls
jest.mock("axios");

describe("Rate Limiting", () => {
  // Set up mocks before each test
  beforeEach(() => {
    // Mock successful token response
    axios.post.mockResolvedValue({
      data: { access_token: "mock_token" }
    });
    
    // Mock successful search response
    axios.get.mockResolvedValue({
      data: {
        data: {
          children: []
        }
      }
    });
  });

  // Reset mocks after each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Set a small rate limit for testing purposes
  beforeAll(() => {
    process.env.MAX_REQUESTS = "5";
    // Re-import the server module to apply the new rate limit
    jest.resetModules();
    ({ app } = require("../server"));
  });

  test("allows requests within rate limit", async () => {
    const response = await request(app)
      .get("/api/search")
      .query({ keyword: "test" });

    expect(response.status).not.toBe(429);
  }, 30000);

  test("blocks requests when rate limit exceeded", async () => {
    // Make requests to exceed rate limit
    for (let i = 0; i < 5; i++) {
      await request(app).get("/api/search").query({ keyword: "test" });
    }

    // This one should be rate limited
    const response = await request(app)
      .get("/api/search")
      .query({ keyword: "test" });

    expect(response.status).toBe(429);
    expect(response.body).toHaveProperty("error");
    expect(response.body).toHaveProperty("retryAfter");
  }, 30000);
});
