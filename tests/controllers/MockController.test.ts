import request from 'supertest';
import { createApp } from '../../src/app';
import { Express } from 'express';

describe('MockController', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /api/mock/test', () => {
    it('should return a mock message and timestamp', async () => {
      const response = await request(app).get('/api/mock/test');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'This is a mock route');
      expect(response.body).toHaveProperty('timestamp');
      
      // timestamp가 ISO 형식인지 확인
      const timestamp = response.body.timestamp;
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });
});
