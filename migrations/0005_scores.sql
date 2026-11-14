create table if not exists quiz_scores (
  id text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  document_id text not null references documents (id) on delete cascade,
  chapter text not null,
  score integer not null check (score >= 0),
  total integer not null check (total > 0),
  created_at timestamptz not null default now()
);

create index if not exists quiz_scores_doc_idx on quiz_scores (document_id, chapter);
create index if not exists quiz_scores_user_idx on quiz_scores (user_id, document_id, created_at);
