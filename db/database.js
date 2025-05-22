import pg from 'pg';
import { config } from '../config.js';

const pool = new pg.Pool(config.db);

export const db = {
    async init() {
        const client = await pool.connect();
        try {
            // Read and execute init.sql
            const fs = await import('fs');
            const initSql = fs.readFileSync('./db/init.sql', 'utf8');
            await client.query(initSql);
            
            // Populate historical stats
            await client.query('SELECT populate_historical_stats()');
        } finally {
            client.release();
        }
    },

    async upsertUser(user) {
        const { user_id, username, first_name, last_name } = user;
        const query = `
            INSERT INTO users (user_id, username, first_name, last_name, last_active)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                username = EXCLUDED.username,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                last_active = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const result = await pool.query(query, [user_id, username, first_name, last_name]);
        return result.rows[0];
    },

    async logRequest(userId, url, success, responseTime, errorMessage = null) {
        const query = `
            INSERT INTO requests (user_id, url, success, response_time, error_message)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const result = await pool.query(query, [userId, url, success, responseTime, errorMessage]);
        return result.rows[0];
    },

    async updateDailyStats() {
        const query = `
            INSERT INTO daily_stats (
                date,
                total_requests,
                successful_requests,
                failed_requests,
                unique_users,
                avg_response_time
            )
            SELECT 
                CURRENT_DATE,
                COUNT(*) as total_requests,
                COUNT(*) FILTER (WHERE success = true) as successful_requests,
                COUNT(*) FILTER (WHERE success = false) as failed_requests,
                COUNT(DISTINCT user_id) as unique_users,
                AVG(response_time)::INTEGER as avg_response_time
            FROM requests
            WHERE DATE(created_at) = CURRENT_DATE
            ON CONFLICT (date) DO UPDATE SET
                total_requests = EXCLUDED.total_requests,
                successful_requests = EXCLUDED.successful_requests,
                failed_requests = EXCLUDED.failed_requests,
                unique_users = EXCLUDED.unique_users,
                avg_response_time = EXCLUDED.avg_response_time;
        `;
        await pool.query(query);
    },

    async getStats(days = 7) {
        const query = `
            SELECT 
                date,
                total_requests,
                successful_requests,
                failed_requests,
                unique_users,
                avg_response_time
            FROM daily_stats
            WHERE date >= CURRENT_DATE - $1
            ORDER BY date DESC;
        `;
        const result = await pool.query(query, [days]);
        return result.rows;
    }
}; 