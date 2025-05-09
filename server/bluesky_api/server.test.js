const request = require('supertest');
const fs = require('fs');
const child_process = require('child_process');

jest.mock('fs');
jest.mock('child_process');

let app;
beforeAll(() => {
  app = require('./server');
});

describe('Bluesky API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/bluesky/test returns success', async () => {
    const res = await request(app).get('/api/bluesky/test');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('POST /api/bluesky/search with no query returns 400', async () => {
    const res = await request(app).post('/api/bluesky/search').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/No search query/);
  });

  test('POST /api/bluesky/search with valid query returns started', async () => {
    child_process.spawn.mockReturnValue({
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn()
    });
    const res = await request(app).post('/api/bluesky/search').send({ query: 'test' });
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('started');
    expect(res.body.search_id).toBeDefined();
  });

  test('GET /api/bluesky/status with no search_id returns 404', async () => {
    const res = await request(app).get('/api/bluesky/status');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/not found/);
  });

  test('GET /api/bluesky/status with unknown search_id returns 404', async () => {
    const res = await request(app).get('/api/bluesky/status?search_id=unknown');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/not found/);
  });

  test('GET /api/bluesky/results with no search_id returns 404', async () => {
    const res = await request(app).get('/api/bluesky/results');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/not found/);
  });

  test('GET /api/bluesky/results with unknown search_id returns 404', async () => {
    const res = await request(app).get('/api/bluesky/results?search_id=unknown');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("Search ID not found");
  });
}); 