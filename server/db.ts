import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

-- ECOS tables
CREATE TABLE IF NOT EXISTS ecos_scenarios (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  patient_prompt TEXT NOT NULL,
  evaluation_criteria JSONB NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ecos_sessions (
  id SERIAL PRIMARY KEY,
  scenario_id INTEGER REFERENCES ecos_scenarios(id),
  student_email VARCHAR(255) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'in_progress'
);

CREATE TABLE IF NOT EXISTS ecos_evaluations (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES ecos_sessions(id),
  criterion_id VARCHAR(50) NOT NULL,
  score INTEGER NOT NULL,
  feedback TEXT
);

CREATE TABLE IF NOT EXISTS ecos_reports (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES ecos_sessions(id),
  summary TEXT NOT NULL,
  strengths TEXT[],
  weaknesses TEXT[],
  recommendations TEXT[]
);

CREATE TABLE IF NOT EXISTS ecos_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES ecos_sessions(id),
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);