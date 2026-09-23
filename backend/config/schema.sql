-- Social Media Analytics Database Schema
-- Run this file to create all necessary tables

-- USERS table
CREATE TABLE IF NOT EXISTS USERS (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    avatar_url VARCHAR(255),
    interests TEXT[], -- Array of user interests for personalized trending topics
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SOCIAL_ACCOUNT table
CREATE TABLE IF NOT EXISTS SOCIAL_ACCOUNT (
    account_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    platform VARCHAR(50) NOT NULL,
    account_handle VARCHAR(100),
    account_name VARCHAR(100),
    profile_picture_url VARCHAR(255),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expiry TIMESTAMP,
    is_connected BOOLEAN DEFAULT true,
    platform_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE,
    UNIQUE(user_id, platform, account_handle)
);

-- ANALYTICS table
CREATE TABLE IF NOT EXISTS ANALYTICS (
    analytics_id SERIAL PRIMARY KEY,
    account_id INT NOT NULL,
    followers INT,
    following INT,
    likes INT,
    comments INT,
    shares INT,
    impressions INT,
    reach INT,
    engagement_rate DECIMAL(5,2),
    analytics_data JSONB NOT NULL,
    collected_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES SOCIAL_ACCOUNT(account_id) ON DELETE CASCADE
);

-- POST table
CREATE TABLE IF NOT EXISTS POST (
    post_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    account_id INT NOT NULL,
    platform_post_id VARCHAR(100),
    content TEXT NOT NULL,
    image_url VARCHAR(255),
    video_url VARCHAR(255),
    publish_date TIMESTAMP,
    post_type VARCHAR(20),
    post_data JSONB,
    FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES SOCIAL_ACCOUNT(account_id) ON DELETE CASCADE
);

-- CONTENT_SUGGESTION table
CREATE TABLE IF NOT EXISTS CONTENT_SUGGESTION (
    suggestion_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    source VARCHAR(100),
    title VARCHAR(255),
    content TEXT,
    suggested_hashtags TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_account_user_platform ON SOCIAL_ACCOUNT(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_analytics_account_date ON ANALYTICS(account_id, collected_date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_data ON ANALYTICS USING GIN (analytics_data);
CREATE INDEX IF NOT EXISTS idx_posts_account_date ON POST(account_id, publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_user ON CONTENT_SUGGESTION(user_id);