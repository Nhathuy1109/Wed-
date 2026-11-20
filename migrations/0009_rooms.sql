create table if not exists rooms (
  code text primary key,
  owner_id text not null,
  status text not null default 'lobby',
  seconds integer not null default 15,
  quiz text not null default '[]',
  idx integer not null default 0,
  phase_ms bigint not null default 0,
  created_ms bigint not null
);
create table if not exists room_players (
  code text not null references rooms (code) on delete cascade,
  user_id text not null,
  name text not null,
  score integer not null default 0,
  primary key (code, user_id)
);
create table if not exists room_answers (
  code text not null references rooms (code) on delete cascade,
  idx integer not null,
  user_id text not null,
  pick integer not null,
  pts integer not null,
  primary key (code, idx, user_id)
);
