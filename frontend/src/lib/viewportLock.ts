/** Routes that fill the viewport with no document scroll (chat, studio, me). */
export function isViewportLockRoute(pathname: string): boolean {
  return (
    pathname === "/messages" ||
    pathname.startsWith("/messages/") ||
    pathname.startsWith("/channels/") ||
    pathname === "/studio" ||
    pathname.startsWith("/studio/") ||
    pathname === "/me" ||
    pathname.startsWith("/me/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}
