-- Lưu các lần người học mở/đọc tài liệu để hiển thị lịch sử học tập.
alter table activity drop constraint if exists activity_kind_check;
alter table activity
  add constraint activity_kind_check check (kind in ('view', 'download', 'attempt'));
create index if not exists activity_user_recent_idx on activity (user_id, created_at desc);
create index if not exists quiz_results_user_recent_idx on quiz_results (user_id, created_at desc);
