-- Tên đăng nhập của các tài khoản bị chủ web xóa. Dùng để báo lý do khi người đó đăng nhập lại.
create table if not exists deleted_accounts (
  username_key text primary key,
  username text not null,
  deleted_at timestamptz not null default now()
);
