
-- Script de sauvegarde et recréation de la base de données
-- Garde les scénarios existants et les accès

-- 1. Sauvegarde des données existantes dans des tables temporaires
CREATE TABLE IF NOT EXISTS backup_ecos_scenarios AS 
SELECT * FROM ecos_scenarios;

CREATE TABLE IF NOT EXISTS backup_ecos_sessions AS 
SELECT * FROM ecos_sessions;

CREATE TABLE IF NOT EXISTS backup_ecos_messages AS 
SELECT * FROM ecos_messages;

CREATE TABLE IF NOT EXISTS backup_ecos_evaluations AS 
SELECT * FROM ecos_evaluations;

CREATE TABLE IF NOT EXISTS backup_exchanges AS 
SELECT * FROM exchanges;

CREATE TABLE IF NOT EXISTS backup_daily_counters AS 
SELECT * FROM daily_counters;

-- 2. Suppression des tables existantes
DROP TABLE IF EXISTS ecos_evaluations CASCADE;
DROP TABLE IF EXISTS ecos_messages CASCADE;
DROP TABLE IF EXISTS ecos_sessions CASCADE;
DROP TABLE IF EXISTS ecos_scenarios CASCADE;
DROP TABLE IF EXISTS training_session_participants CASCADE;
DROP TABLE IF EXISTS training_session_scenarios CASCADE;
DROP TABLE IF EXISTS training_sessions CASCADE;
DROP TABLE IF EXISTS exchanges CASCADE;
DROP TABLE IF EXISTS daily_counters CASCADE;

-- 3. Recréation des tables avec la nouvelle structure

-- Table des scénarios ECOS avec support d'images
CREATE TABLE ecos_scenarios (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  patient_prompt TEXT NOT NULL,
  evaluation_criteria JSONB NOT NULL,
  pinecone_index VARCHAR(255),
  image_url VARCHAR(500),
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des sessions ECOS
CREATE TABLE ecos_sessions (
  id SERIAL PRIMARY KEY,
  scenario_id INTEGER REFERENCES ecos_scenarios(id) ON DELETE CASCADE,
  student_email VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'in_progress',
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  total_score DECIMAL(5,2),
  max_possible_score DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table des messages de conversation
CREATE TABLE ecos_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES ecos_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'patient', 'system')),
  content TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Table des évaluations
CREATE TABLE ecos_evaluations (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES ecos_sessions(id) ON DELETE CASCADE,
  criterion_name VARCHAR(255) NOT NULL,
  score DECIMAL(3,1) NOT NULL,
  max_score DECIMAL(3,1) NOT NULL,
  feedback TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des sessions de formation
CREATE TABLE training_sessions (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table de liaison sessions-scénarios
CREATE TABLE training_session_scenarios (
  id SERIAL PRIMARY KEY,
  training_session_id INTEGER REFERENCES training_sessions(id) ON DELETE CASCADE,
  scenario_id INTEGER REFERENCES ecos_scenarios(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des participants aux sessions
CREATE TABLE training_session_participants (
  id SERIAL PRIMARY KEY,
  training_session_id INTEGER REFERENCES training_sessions(id) ON DELETE CASCADE,
  student_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des échanges de chat
CREATE TABLE exchanges (
  id SERIAL PRIMARY KEY,
  utilisateur_email VARCHAR(255) NOT NULL,
  question TEXT NOT NULL,
  reponse TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  context_docs JSONB,
  pinecone_index VARCHAR(255)
);

-- Table des compteurs quotidiens
CREATE TABLE daily_counters (
  utilisateur_email VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  count INTEGER DEFAULT 1,
  PRIMARY KEY (utilisateur_email, date)
);

-- 4. Restauration des données depuis les tables de sauvegarde

-- Restaurer les scénarios
INSERT INTO ecos_scenarios (id, title, description, patient_prompt, evaluation_criteria, pinecone_index, image_url, created_by, created_at)
SELECT 
  id, 
  title, 
  description, 
  patient_prompt, 
  evaluation_criteria, 
  pinecone_index,
  COALESCE(image_url, NULL) as image_url,
  created_by, 
  created_at 
FROM backup_ecos_scenarios;

-- Restaurer les sessions
INSERT INTO ecos_sessions (id, scenario_id, student_email, status, started_at, completed_at, total_score, max_possible_score, created_at, updated_at)
SELECT id, scenario_id, student_email, status, started_at, completed_at, total_score, max_possible_score, created_at, updated_at 
FROM backup_ecos_sessions;

-- Restaurer les messages
INSERT INTO ecos_messages (id, session_id, role, content, timestamp)
SELECT id, session_id, role, content, timestamp 
FROM backup_ecos_messages;

-- Restaurer les évaluations
INSERT INTO ecos_evaluations (id, session_id, criterion_name, score, max_score, feedback, created_at)
SELECT id, session_id, criterion_name, score, max_score, feedback, created_at 
FROM backup_ecos_evaluations;

-- Restaurer les échanges
INSERT INTO exchanges (id, utilisateur_email, question, reponse, timestamp, context_docs, pinecone_index)
SELECT id, utilisateur_email, question, reponse, timestamp, context_docs, pinecone_index 
FROM backup_exchanges;

-- Restaurer les compteurs quotidiens
INSERT INTO daily_counters (utilisateur_email, date, count)
SELECT utilisateur_email, date, count 
FROM backup_daily_counters;

-- 5. Mise à jour des séquences
SELECT setval('ecos_scenarios_id_seq', (SELECT MAX(id) FROM ecos_scenarios));
SELECT setval('ecos_sessions_id_seq', (SELECT MAX(id) FROM ecos_sessions));
SELECT setval('ecos_messages_id_seq', (SELECT MAX(id) FROM ecos_messages));
SELECT setval('ecos_evaluations_id_seq', (SELECT MAX(id) FROM ecos_evaluations));
SELECT setval('training_sessions_id_seq', COALESCE((SELECT MAX(id) FROM training_sessions), 1));
SELECT setval('training_session_scenarios_id_seq', COALESCE((SELECT MAX(id) FROM training_session_scenarios), 1));
SELECT setval('training_session_participants_id_seq', COALESCE((SELECT MAX(id) FROM training_session_participants), 1));
SELECT setval('exchanges_id_seq', (SELECT MAX(id) FROM exchanges));

-- 6. Création des index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_ecos_scenarios_created_by ON ecos_scenarios(created_by);
CREATE INDEX IF NOT EXISTS idx_ecos_sessions_student_email ON ecos_sessions(student_email);
CREATE INDEX IF NOT EXISTS idx_ecos_sessions_scenario_id ON ecos_sessions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_ecos_sessions_status ON ecos_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ecos_messages_session_id ON ecos_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ecos_evaluations_session_id ON ecos_evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_utilisateur_email ON exchanges(utilisateur_email);
CREATE INDEX IF NOT EXISTS idx_exchanges_timestamp ON exchanges(timestamp);
CREATE INDEX IF NOT EXISTS idx_daily_counters_date ON daily_counters(date);
CREATE INDEX IF NOT EXISTS idx_training_sessions_created_by ON training_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_training_sessions_dates ON training_sessions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_training_session_scenarios_session_id ON training_session_scenarios(training_session_id);
CREATE INDEX IF NOT EXISTS idx_training_session_scenarios_scenario_id ON training_session_scenarios(scenario_id);
CREATE INDEX IF NOT EXISTS idx_training_session_participants_session_id ON training_session_participants(training_session_id);
CREATE INDEX IF NOT EXISTS idx_training_session_participants_email ON training_session_participants(student_email);

-- 7. Suppression des tables de sauvegarde
DROP TABLE IF EXISTS backup_ecos_scenarios;
DROP TABLE IF EXISTS backup_ecos_sessions;
DROP TABLE IF EXISTS backup_ecos_messages;
DROP TABLE IF EXISTS backup_ecos_evaluations;
DROP TABLE IF EXISTS backup_exchanges;
DROP TABLE IF EXISTS backup_daily_counters;

-- 8. Affichage du résumé
SELECT 'Migration terminée avec succès' AS status;
SELECT COUNT(*) AS scenarios_restaures FROM ecos_scenarios;
SELECT COUNT(*) AS sessions_restaurees FROM ecos_sessions;
SELECT COUNT(*) AS messages_restaures FROM ecos_messages;
SELECT COUNT(*) AS evaluations_restaurees FROM ecos_evaluations;
SELECT COUNT(*) AS exchanges_restaures FROM exchanges;
