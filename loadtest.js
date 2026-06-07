import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 20 },
    { duration: '30s', target: 50 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(99)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const payload = JSON.stringify({
    type: 'email',
    payload: {
      recipient: `user${Math.floor(Math.random() * 1000)}@test.com`,
      subject: 'Load Test Email',
      body: 'Testing under load',
    },
  });

  const res = http.post('http://localhost:3000/api/jobs', payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 201': (r) => r.status === 201,
    'job created': (r) => JSON.parse(r.body).jobId !== undefined,
  });

  sleep(0.5);
}