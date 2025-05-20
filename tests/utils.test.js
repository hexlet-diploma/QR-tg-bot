import { isValidUrl, normalizeUrl } from '../bot.js';

describe('URL Validation and Normalization', () => {
    describe('isValidUrl', () => {
        test('should validate correct URLs', () => {
            expect(isValidUrl('https://example.com')).toBe(true);
            expect(isValidUrl('http://example.com')).toBe(true);
            expect(isValidUrl('https://sub.example.com/path?query=123')).toBe(true);
        });

        test('should reject invalid URLs', () => {
            expect(isValidUrl('not-a-url')).toBe(false);
            expect(isValidUrl('ftp://example.com')).toBe(false);
            expect(isValidUrl('')).toBe(false);
            expect(isValidUrl(null)).toBe(false);
        });
    });

    describe('normalizeUrl', () => {
        test('should add https:// to URLs without protocol', () => {
            expect(normalizeUrl('example.com')).toBe('https://example.com');
            expect(normalizeUrl('www.example.com')).toBe('https://www.example.com');
        });

        test('should not modify URLs with existing protocol', () => {
            expect(normalizeUrl('https://example.com')).toBe('https://example.com');
            expect(normalizeUrl('http://example.com')).toBe('http://example.com');
        });
    });
}); 