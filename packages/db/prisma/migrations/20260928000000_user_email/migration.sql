-- Accounts are identified by email instead of a free-form username.
ALTER TABLE "user" RENAME COLUMN "username" TO "email";
ALTER INDEX "user_username_key" RENAME TO "user_email_key";

-- Emails are matched case-insensitively; normalise existing values.
UPDATE "user" SET "email" = lower(trim("email"))
WHERE "email" <> lower(trim("email"))
  AND NOT EXISTS (SELECT 1 FROM "user" u2 WHERE u2."email" = lower(trim("user"."email")));
