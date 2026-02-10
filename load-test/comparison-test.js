import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const successfulRequests = new Counter('successful_requests');
const responseDuration = new Trend('response_duration');

// Test configuration
export const options = {
    stages: [
        { duration: '30s', target: 20 },   // Warm up to 20 users
        { duration: '1m', target: 50 },    // Ramp to 50 users
        { duration: '2m', target: 200 },   // Ramp to 200 users
        { duration: '2m', target: 500 },   // Stay at 500 users
        { duration: '1m', target: 150 },   // Push to 150 users
        { duration: '1m', target: 150 },   // Stay at 150
        { duration: '30s', target: 0 },    // Ramp down
    ],
    thresholds: {
        'http_req_duration': ['p(95)<1000'],
        'http_req_failed': ['rate<0.2'],
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Search queries
const queries = [
    'iphone', 'samsung', 'macbook', 'galaxy', 'laptop', 'phone',
    'iphune', 'samung', 'mackbook',  // typos
    'iph', 'sam', 'mac',  // partial
    'iphone 15', 'samsung s24', 'macbook pro',
];

export default function () {
    const query = queries[Math.floor(Math.random() * queries.length)];

    const response = http.get(`${BASE_URL}/api/search?q=${encodeURIComponent(query)}`);

    const success = check(response, {
        'status is 200': (r) => r.status === 200,
        'has results': (r) => {
            try {
                const body = JSON.parse(r.body);
                return Array.isArray(body.results);
            } catch (e) {
                return false;
            }
        },
    });

    errorRate.add(!success);
    responseDuration.add(response.timings.duration);

    if (success) {
        successfulRequests.add(1);
    }

    sleep(Math.random() * 2 + 1);
}
