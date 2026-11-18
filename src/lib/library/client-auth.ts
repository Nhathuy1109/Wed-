import { authClient } from "@/lib/auth/client";
import { checkDeletedAccount, recoverOwner } from "@/lib/library/api";
import { DELETED_ACCOUNT_MESSAGE, isOwnerUsername, memberEmail, normalizeUsername } from "@/lib/library/ids";

export async function signInWithUsername(usernameRaw: string, password: string): Promise<string | null> {
  const username = normalizeUsername(usernameRaw);
  if (!username) return "Tên đăng nhập gồm 3-20 ký tự: chữ không dấu, số hoặc dấu gạch dưới.";
  const email = memberEmail(username);
  const first = await authClient.signIn.email({ email, password });
  if (!first.error) return null;
  if (!isOwnerUsername(username)) {
    try {
      const status = await checkDeletedAccount({ data: { username } });
      if (status.deleted) return DELETED_ACCOUNT_MESSAGE;
    } catch {
      /* bỏ qua, dùng thông báo mặc định */
    }
    return "Sai tên đăng nhập hoặc mật khẩu.";
  }
  const recovered = await recoverOwner({ data: { password } });
  if (!recovered.ok) return recovered.message;
  const second = await authClient.signIn.email({ email, password });
  if (second.error) return "Đã nhận mật khẩu chủ web nhưng chưa vào được. Thử lại.";
  return null;
}
