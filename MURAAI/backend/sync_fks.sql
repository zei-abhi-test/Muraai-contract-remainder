DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_contract_deleted_by' AND table_name = 'contract') THEN
    ALTER TABLE contract ADD CONSTRAINT fk_contract_deleted_by FOREIGN KEY (deleted_by_id) REFERENCES "user"(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_contract_activated_by' AND table_name = 'contract') THEN
    ALTER TABLE contract ADD CONSTRAINT fk_contract_activated_by FOREIGN KEY (activated_by_id) REFERENCES "user"(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_contract_terminated_by' AND table_name = 'contract') THEN
    ALTER TABLE contract ADD CONSTRAINT fk_contract_terminated_by FOREIGN KEY (terminated_by_id) REFERENCES "user"(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_contract_archived_by' AND table_name = 'contract') THEN
    ALTER TABLE contract ADD CONSTRAINT fk_contract_archived_by FOREIGN KEY (archived_by_id) REFERENCES "user"(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_contract_event_log_user' AND table_name = 'contract_event_log') THEN
    ALTER TABLE contract_event_log ADD CONSTRAINT fk_contract_event_log_user FOREIGN KEY (user_id) REFERENCES "user"(id);
  END IF;
END $$;
