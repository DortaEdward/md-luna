CREATE VIRTUAL TABLE notes_fts USING fts5(title, body, tokenize = 'porter unicode61');
--> statement-breakpoint
CREATE TRIGGER notes_fts_delete AFTER DELETE ON notes BEGIN
  DELETE FROM notes_fts WHERE rowid = old.id;
END;