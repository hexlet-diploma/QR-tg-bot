-- Create users table
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT PRIMARY KEY,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create requests table
CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(user_id),
    url TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    response_time INTEGER NOT NULL, -- in milliseconds
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create daily_stats table
CREATE TABLE IF NOT EXISTS daily_stats (
    date DATE PRIMARY KEY,
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    avg_response_time INTEGER DEFAULT 0
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);

-- Function to update daily stats
CREATE OR REPLACE FUNCTION update_daily_stats()
RETURNS TRIGGER AS $$
BEGIN
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
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic stats update
DROP TRIGGER IF EXISTS update_stats_trigger ON requests;
CREATE TRIGGER update_stats_trigger
    AFTER INSERT ON requests
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_stats();

-- Function to populate historical stats
CREATE OR REPLACE FUNCTION populate_historical_stats()
RETURNS void AS $$
BEGIN
    INSERT INTO daily_stats (
        date,
        total_requests,
        successful_requests,
        failed_requests,
        unique_users,
        avg_response_time
    )
    SELECT 
        DATE(created_at),
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE success = true) as successful_requests,
        COUNT(*) FILTER (WHERE success = false) as failed_requests,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(response_time)::INTEGER as avg_response_time
    FROM requests
    WHERE DATE(created_at) < CURRENT_DATE
    GROUP BY DATE(created_at)
    ON CONFLICT (date) DO UPDATE SET
        total_requests = EXCLUDED.total_requests,
        successful_requests = EXCLUDED.successful_requests,
        failed_requests = EXCLUDED.failed_requests,
        unique_users = EXCLUDED.unique_users,
        avg_response_time = EXCLUDED.avg_response_time;
END;
$$ LANGUAGE plpgsql; 