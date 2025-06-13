
-- Script de sauvegarde et recréation complète de la base de données
-- Garde les scénarios et accès existants

-- 1. Sauvegarder les données existantes
CREATE TEMP TABLE backup_scenarios AS SELECT * FROM ecos_scenarios;
CREATE TEMP TABLE backup_sessions AS SELECT * FROM ecos_sessions;
CREATE TEMP TABLE backup_messages AS SELECT * FROM ecos_messages;
CREATE TEMP TABLE backup_evaluations AS SELECT * FROM ecos_evaluations;
CREATE TEMP TABLE backup_exchanges AS SELECT * FROM exchanges;

-- Afficher les données sauvegardées
SELECT COUNT(*) FROM backup_scenarios;
SELECT COUNT(*) FROM backup_sessions;
SELECT COUNT(*) FROM backup_messages;
SELECT COUNT(*) FROM backup_evaluations;
SELECT COUNT(*) FROM backup_exchanges;

-- 2. Supprimer toutes les tables existantes
DROP TABLE IF EXISTS ecos_reports CASCADE;
DROP TABLE IF EXISTS ecos_evaluations CASCADE;
DROP TABLE IF EXISTS ecos_messages CASCADE;
DROP TABLE IF EXISTS ecos_sessions CASCADE;
DROP TABLE IF EXISTS training_session_students CASCADE;
DROP TABLE IF EXISTS training_session_scenarios CASCADE;
DROP TABLE IF EXISTS training_sessions CASCADE;
DROP TABLE IF EXISTS ecos_scenarios CASCADE;
DROP TABLE IF EXISTS exchanges CASCADE;
DROP TABLE IF EXISTS daily_counters CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 3. Recréer toutes les tables avec la structure correcte

-- Table users
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  profile_image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Table ecos_scenarios avec image_url
CREATE TABLE ecos_scenarios (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  patient_prompt TEXT NOT NULL,
  evaluation_criteria JSONB,
  pinecone_index VARCHAR(255),
  image_url VARCHAR(500),
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Table training_sessions
CREATE TABLE training_sessions (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Table training_session_scenarios
CREATE TABLE training_session_scenarios (
  id SERIAL PRIMARY KEY,
  training_session_id INTEGER REFERENCES training_sessions(id) ON DELETE CASCADE NOT NULL,
  scenario_id INTEGER REFERENCES ecos_scenarios(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Table training_session_students
CREATE TABLE training_session_students (
  id SERIAL PRIMARY KEY,
  training_session_id INTEGER REFERENCES training_sessions(id) ON DELETE CASCADE NOT NULL,
  student_email VARCHAR(255) NOT NULL,
  assigned_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Table ecos_sessions avec training_session_id
CREATE TABLE ecos_sessions (
  id SERIAL PRIMARY KEY,
  scenario_id INTEGER REFERENCES ecos_scenarios(id) ON DELETE CASCADE NOT NULL,
  student_email VARCHAR(255) NOT NULL,
  training_session_id INTEGER REFERENCES training_sessions(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'in_progress' NOT NULL,
  start_time TIMESTAMP DEFAULT NOW() NOT NULL,
  end_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Table ecos_messages
CREATE TABLE ecos_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES ecos_sessions(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(20) CHECK (role IN ('student', 'patient')) NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Table ecos_evaluations
CREATE TABLE ecos_evaluations (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES ecos_sessions(id) ON DELETE CASCADE NOT NULL,
  criterion_id VARCHAR(100) NOT NULL,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  feedback TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Table ecos_reports
CREATE TABLE ecos_reports (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES ecos_sessions(id) ON DELETE CASCADE NOT NULL,
  summary TEXT,
  strengths TEXT[],
  weaknesses TEXT[],
  recommendations TEXT[],
  global_score INTEGER,
  is_insufficient_content BOOLEAN DEFAULT FALSE,
  message TEXT,
  details TEXT,
  feedback TEXT,
  scores JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Table exchanges
CREATE TABLE exchanges (
  id SERIAL PRIMARY KEY,
  utilisateur_email VARCHAR(255) NOT NULL,
  question TEXT NOT NULL,
  reponse TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Table daily_counters
CREATE TABLE daily_counters (
  utilisateur_email VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  count INTEGER DEFAULT 0 NOT NULL,
  PRIMARY KEY (utilisateur_email, date)
);

-- 4. Restaurer les données des scénarios
INSERT INTO ecos_scenarios (id, title, description, patient_prompt, evaluation_criteria, pinecone_index, image_url, created_by, created_at, updated_at)
SELECT id, title, description, patient_prompt, evaluation_criteria, pinecone_index, image_url, created_by, created_at, COALESCE(updated_at, created_at)
FROM backup_scenarios;

-- Restaurer les sessions (sans training_session_id pour l'instant)
INSERT INTO ecos_sessions (id, scenario_id, student_email, status, start_time, end_time, created_at, updated_at)
SELECT id, scenario_id, student_email, status, start_time, end_time, created_at, COALESCE(updated_at, created_at)
FROM backup_sessions
WHERE EXISTS (SELECT 1 FROM backup_scenarios WHERE id = backup_sessions.scenario_id);

-- Restaurer les messages
INSERT INTO ecos_messages (id, session_id, role, content, timestamp)
SELECT id, session_id, role, content, timestamp
FROM backup_messages
WHERE session_id IN (SELECT id FROM ecos_sessions);

-- Restaurer les évaluations
INSERT INTO ecos_evaluations (id, session_id, criterion_id, score, max_score, feedback, created_at)
SELECT id, session_id, criterion_id, score, max_score, feedback, created_at
FROM backup_evaluations
WHERE session_id IN (SELECT id FROM ecos_sessions);

-- Restaurer les exchanges
INSERT INTO exchanges (id, utilisateur_email, question, reponse, timestamp)
SELECT id, utilisateur_email, question, reponse, timestamp
FROM backup_exchanges;

-- 5. Réinitialiser les séquences
SELECT setval('ecos_scenarios_id_seq', COALESCE((SELECT MAX(id) FROM ecos_scenarios), 1));
SELECT setval('ecos_sessions_id_seq', COALESCE((SELECT MAX(id) FROM ecos_sessions), 1));
SELECT setval('ecos_messages_id_seq', COALESCE((SELECT MAX(id) FROM ecos_messages), 1));
SELECT setval('ecos_evaluations_id_seq', COALESCE((SELECT MAX(id) FROM ecos_evaluations), 1));
SELECT setval('exchanges_id_seq', COALESCE((SELECT MAX(id) FROM exchanges), 1));
SELECT setval('training_sessions_id_seq', 1);
SELECT setval('training_session_scenarios_id_seq', 1);
SELECT setval('training_session_students_id_seq', 1);

-- 6. Créer les index pour optimiser les performances
CREATE INDEX idx_ecos_sessions_scenario_id ON ecos_sessions(scenario_id);
CREATE INDEX idx_ecos_sessions_student_email ON ecos_sessions(student_email);
CREATE INDEX idx_ecos_sessions_training_session_id ON ecos_sessions(training_session_id);
CREATE INDEX idx_ecos_sessions_status ON ecos_sessions(status);
CREATE INDEX idx_ecos_messages_session_id ON ecos_messages(session_id);
CREATE INDEX idx_ecos_messages_timestamp ON ecos_messages(timestamp);
CREATE INDEX idx_ecos_evaluations_session_id ON ecos_evaluations(session_id);
CREATE INDEX idx_ecos_reports_session_id ON ecos_reports(session_id);
CREATE INDEX idx_exchanges_email ON exchanges(utilisateur_email);
CREATE INDEX idx_exchanges_timestamp ON exchanges(timestamp);
CREATE INDEX idx_daily_counters_email_date ON daily_counters(utilisateur_email, date);
CREATE INDEX idx_training_session_scenarios_session_id ON training_session_scenarios(training_session_id);
CREATE INDEX idx_training_session_scenarios_scenario_id ON training_session_scenarios(scenario_id);
CREATE INDEX idx_training_session_students_session_id ON training_session_students(training_session_id);
CREATE INDEX idx_training_session_students_email ON training_session_students(student_email);

-- 7. Supprimer les tables temporaires
DROP TABLE backup_scenarios;
DROP TABLE backup_sessions;
DROP TABLE backup_messages;
DROP TABLE backup_evaluations;
DROP TABLE backup_exchanges;

-- 8. Vérification finale
SELECT 'Migration terminée avec succès' as status;
SELECT COUNT(*) as scenarios_restaures FROM ecos_scenarios;
SELECT COUNT(*) as sessions_restaurees FROM ecos_sessions;
SELECT COUNT(*) as messages_restaures FROM ecos_messages;
SELECT COUNT(*) as evaluations_restaurees FROM ecos_evaluations;
SELECT COUNT(*) as exchanges_restaures FROM exchanges;
