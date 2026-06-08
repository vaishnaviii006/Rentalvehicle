-- Select user to verify
SELECT email FROM "core"."user" WHERE id = '20202020-9e3b-46d4-a556-88b9ddc2b034';

-- Update user email and password
UPDATE "core"."user"
SET email = 'kunshu56@gmail.com', "passwordHash" = '$2b$10$XOAWfd0f5ZpiQjoZ/eMWneNf7XVUuC/Kyz6rEj1jG78.A0VN02.Uq'
WHERE id = '20202020-9e3b-46d4-a556-88b9ddc2b034';

-- Verify update
SELECT email FROM "core"."user" WHERE id = '20202020-9e3b-46d4-a556-88b9ddc2b034';
