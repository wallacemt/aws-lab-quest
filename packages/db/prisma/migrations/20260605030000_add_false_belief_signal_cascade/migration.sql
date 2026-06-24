-- LGPD F-05: Add explicit FK relation from FalseBeliefSignal to User with
-- onDelete: Cascade. Previously the userId column had no FK constraint, so
-- deleting a User left orphaned FalseBeliefSignal rows. This migration adds
-- the constraint so cascades work correctly.

ALTER TABLE "FalseBeliefSignal"
  ADD CONSTRAINT "FalseBeliefSignal_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
