-- Written by hand. An assessment keeps the configuration it was created under for good (#229): the version, its fingerprint,
-- the methodology, the engine release and the country module, along with its SME, number and kind. Publishing a newer
-- configuration never rescores an assessment; a rescore is a new assessment (#230).
CREATE FUNCTION "mizan"."guard_assessment_pins"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.config_version IS DISTINCT FROM OLD.config_version
     OR NEW.config_fingerprint IS DISTINCT FROM OLD.config_fingerprint
     OR NEW.methodology IS DISTINCT FROM OLD.methodology
     OR NEW.engine_version IS DISTINCT FROM OLD.engine_version
     OR NEW.country_module IS DISTINCT FROM OLD.country_module
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.assessment_no IS DISTINCT FROM OLD.assessment_no
     OR NEW.sequence IS DISTINCT FROM OLD.sequence
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.previous_assessment_id IS DISTINCT FROM OLD.previous_assessment_id THEN
    RAISE EXCEPTION 'MIZAN assessment % keeps the configuration and identity it was created with', OLD.assessment_no USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "mizan_assessment_pinned" BEFORE UPDATE ON "mizan"."assessment" FOR EACH ROW EXECUTE FUNCTION "mizan"."guard_assessment_pins"();
