const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

jest.mock('fs');
jest.mock('child_process');

let app;
beforeAll(() => {
  app = require('./server');
});

describe('Reddit API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/reddit/test returns success', async () => {
    const res = await request(app).get('/api/reddit/test');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('POST /api/reddit/search with no query returns 400', async () => {
    const res = await request(app).post('/api/reddit/search').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/No search query/);
  });

  test('POST /api/reddit/search with valid query returns started', async () => {
    child_process.spawn.mockReturnValue({
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn()
    });
    const res = await request(app).post('/api/reddit/search').send({ query: 'test' });
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('started');
    expect(res.body.id).toBeDefined();
  });

  test('GET /api/reddit/status with no search_id returns 400', async () => {
    const res = await request(app).get('/api/reddit/status');
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/search_id/);
  });

  test('GET /api/reddit/status with unknown search_id returns 404', async () => {
    fs.existsSync.mockReturnValue(false);
    const res = await request(app).get('/api/reddit/status?search_id=unknown');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/not found/);
  });

  test('GET /api/reddit/results with no search_id returns 400', async () => {
    const res = await request(app).get('/api/reddit/results');
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/search_id/);
  });

  test('GET /api/reddit/results with unknown search_id returns 404', async () => {
    fs.existsSync.mockReturnValue(false);
    const res = await request(app).get('/api/reddit/results?search_id=unknown');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/not found/);
  });
}); 