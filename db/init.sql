CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(70) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'volunteer',
    name VARCHAR(100) NOT NULL,
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE skills (
    id SERIAL PRIMARY KEY,
    title VARCHAR(60) UNIQUE NOT NULL
);

CREATE TABLE user_skills (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
    UNIQUE(user_id, skill_id)
);

CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    website VARCHAR(70),
    email VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE organizations_staff (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    position VARCHAR(50),
    UNIQUE(organization_id, user_id)
);

CREATE TABLE organization_followers (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(organization_id, user_id)
);

CREATE TABLE organization_posts (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    photos TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    title VARCHAR(60) NOT NULL
);

CREATE TABLE problems (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    location GEOGRAPHY(POINT) NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    severity INTEGER DEFAULT 1,
    photos TEXT[],
    status VARCHAR(50) DEFAULT 'pending',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_to_user INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_to_organization INTEGER REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE TABLE problem_confirmations (
    id SERIAL PRIMARY KEY,
    problem_id INTEGER REFERENCES problems(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(problem_id, user_id)
);

CREATE TABLE problem_resolution_confirmations (
    id SERIAL PRIMARY KEY,
    problem_id INTEGER REFERENCES problems(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(problem_id, user_id)
);

CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    location GEOGRAPHY(POINT),
    event_date TIMESTAMP,
    max_volunteers INTEGER,
    current_volunteers INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'planned',
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    problem_id INTEGER REFERENCES problems(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    timezone_offset INTEGER DEFAULT 0
);

CREATE TABLE event_participants (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'registered',
    UNIQUE(event_id, user_id)
);

CREATE TABLE organization_creation_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    website VARCHAR(70),
    email VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE organization_deletion_requests (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    requested_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE badges (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    condition_type VARCHAR(50),
    condition_value INTEGER
);

CREATE TABLE user_badges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    badge_id INTEGER REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_problems_location ON problems USING GIST (location);
CREATE INDEX idx_events_location ON events USING GIST (location);
CREATE INDEX idx_organization_posts_org_id ON organization_posts(organization_id);
CREATE INDEX idx_organization_posts_created_at ON organization_posts(created_at DESC);


INSERT INTO categories (title) VALUES
    ('garbage'),
    ('water_pollution'),
    ('air_pollution'),
    ('deforestation'),
    ('illegal_dumping'),
    ('animal_rescue'),
    ('other');

INSERT INTO skills (title) VALUES
    ('photography'),
    ('video_production'),
    ('copywriting'),
    ('smm'),
    ('first_aid'),
    ('driving'),
    ('truck_driving'),
    ('construction'),
    ('gardening'),
    ('logistics'),
    ('event_management'),
    ('fundraising'),
    ('legal_advice');

INSERT INTO badges (title, description, category, condition_type, condition_value) VALUES
    ('First Step', 'First event participation', 'events', 'events_attended', 1),
    ('Active Citizen', '10 events participated', 'events', 'events_attended', 10),
    ('Super Volunteer', '50 events participated', 'events', 'events_attended', 50),
    ('Eco Detective', '10 problems confirmed', 'problems', 'problems_confirmed', 10),
    ('Problem Solver', 'First problem solved', 'problems', 'problems_solved', 1),
    ('Hero', '10 problems solved', 'problems', 'problems_solved', 10),
    ('Reporter', '10 problems reported', 'problems', 'problems_reported', 10),
    ('Skilled Volunteer', '5 skills added', 'skills', 'skills_count', 5);

DO $$
BEGIN
    RAISE NOTICE '✅ EcoSystem Database initialized successfully!';
    RAISE NOTICE '   Tables created: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public');
END $$;