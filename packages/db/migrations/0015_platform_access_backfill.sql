-- Backfill 'clear' platform access for all existing SME organisations that lack it (#50)
INSERT INTO core.platform_access (id, organization_id, platform, granted_at)
SELECT gen_random_uuid(), sp.organization_id, 'clear', now()
FROM core.sme_profile sp
WHERE NOT EXISTS (
  SELECT 1 FROM core.platform_access pa
  WHERE pa.organization_id = sp.organization_id AND pa.platform = 'clear'
);
