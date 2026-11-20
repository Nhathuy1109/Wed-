create table if not exists user_password_copy (
  user_id text primary key,
  cipher text not null,
  updated_ms bigint not null
);
