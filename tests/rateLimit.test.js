import { checkRateLimit, rateLimit } from '../bot.js';

describe('Rate Limiting', () => {
    beforeEach(() => {
        // Clear the rate limit map before each test
        rateLimit.clear();
    });

    test('should allow requests within rate limit', () => {
        const userId = 123;
        
        // Make 10 requests (within limit)
        for (let i = 0; i < 10; i++) {
            expect(checkRateLimit(userId)).toBe(true);
        }
    });

    test('should block requests exceeding rate limit', () => {
        const userId = 123;
        
        // Make 11 requests (exceeding limit)
        for (let i = 0; i < 11; i++) {
            const result = checkRateLimit(userId);
            if (i < 10) {
                expect(result).toBe(true);
            } else {
                expect(result).toBe(false);
            }
        }
    });

    test('should reset rate limit after 1 minute', () => {
        const userId = 123;
        
        // Make 10 requests
        for (let i = 0; i < 10; i++) {
            expect(checkRateLimit(userId)).toBe(true);
        }
        
        // Mock time passing (1 minute + 1 second)
        const timestamps = rateLimit.get(userId);
        timestamps.forEach((timestamp, index) => {
            timestamps[index] = timestamp - 61000;
        });
        
        // Should allow new requests after time reset
        expect(checkRateLimit(userId)).toBe(true);
    });
}); 