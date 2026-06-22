CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  venue       TEXT NOT NULL DEFAULT '',
  starts_at   TIMESTAMPTZ NOT NULL,
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  section     TEXT NOT NULL,
  row_label   TEXT NOT NULL,
  number      INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'available',  -- available | sold
  UNIQUE (event_id, section, row_label, number)
);

CREATE TABLE IF NOT EXISTS reservations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending',    -- pending | paid | payment_failed
  total_cents INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS reservation_seats (
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  seat_id        UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  PRIMARY KEY (reservation_id, seat_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  status         TEXT NOT NULL,
  provider_ref   TEXT,
  amount_cents   INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  seat_id        UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  qr_code        TEXT NOT NULL,
  pdf_url        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, seat_id)
);

-- Données de démo : 1 événement + une petite grille de sièges (idempotent).
INSERT INTO events (id, title, description, venue, starts_at, image_url)
VALUES ('11111111-1111-1111-1111-111111111111',
        'Concert de gala', 'Soirée d''ouverture', 'Zénith de Paris',
        now() + interval '30 days', NULL)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE r TEXT; n INT;
BEGIN
  FOREACH r IN ARRAY ARRAY['A','B','C'] LOOP
    FOR n IN 1..8 LOOP
      INSERT INTO seats (event_id, section, row_label, number, price_cents)
      VALUES ('11111111-1111-1111-1111-111111111111', 'Orchestre', r, n,
              CASE r WHEN 'A' THEN 5000 WHEN 'B' THEN 4000 ELSE 3000 END)
      ON CONFLICT (event_id, section, row_label, number) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
