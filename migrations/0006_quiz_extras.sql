alter table quiz_scores add column if not exists wrong text not null default '[]';
alter table quiz_scores add column if not exists wrong_count integer not null default 0;

create table if not exists quiz_reports (
  id text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  document_id text not null references documents (id) on delete cascade,
  chapter text not null,
  question text not null,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists quiz_reports_created_idx on quiz_reports (created_at);
