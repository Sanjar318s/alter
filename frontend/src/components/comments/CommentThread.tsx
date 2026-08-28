"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SmartImage } from "@/components/media/SmartImage";
import { comments as commentsApi } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import {
  countComments,
  formatCommentTime,
  type CommentItem,
} from "@/lib/comments";
import { cn } from "@/lib/cn";
import { EmojiStickerPicker } from "@/components/messages/EmojiStickerPicker";

export function CommentThread({
  targetType,
  targetId,
  onCountChange,
  compact,
}: {
  targetType: "build" | "publication";
  targetId: string;
  onCountChange?: (n: number) => void;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<CommentItem[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [busy, setBusy] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    commentsApi
      .list(targetType, targetId)
      .then((res) => {
        if (!alive) return;
        const list = (res.comments || []) as CommentItem[];
        setItems(list);
        onCountChange?.(countComments(list));
      })
      .catch(() => {
        if (!alive) return;
        setItems([]);
        onCountChange?.(0);
      });
    return () => {
      alive = false;
    };
  }, [targetType, targetId]);

  const total = countComments(items);

  async function submit() {
    const body = text.trim();
    if (!body || !user || busy) return;
    setBusy(true);
    const parentId = replyTo?.parentId || replyTo?.id || null;
    try {
      const res = await commentsApi.create({ targetType, targetId, text: body, parentId });
      const created = res.comment as CommentItem;
      setItems((prev) => insertComment(prev, created, parentId));
      onCountChange?.(total + 1);
    } catch {
      const local: CommentItem = {
        id: `local-${Date.now()}`,
        targetType,
        targetId,
        userId: user.id,
        username: user.username,
        displayName: user.username,
        text: body,
        parentId,
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => insertComment(prev, local, parentId));
      onCountChange?.(total + 1);
    }
    setText("");
    setReplyTo(null);
    setBusy(false);
  }

  async function remove(comment: CommentItem) {
    const dropped = 1 + (comment.replies?.length || 0);
    try {
      await commentsApi.remove(comment.id);
    } catch {
      /* local */
    }
    setItems((prev) => prev.filter((c) => c.id !== comment.id).map((c) => ({
      ...c,
      replies: (c.replies || []).filter((r) => r.id !== comment.id),
    })));
    onCountChange?.(Math.max(0, total - dropped));
  }

  return (
    <div className={cn("flex flex-col", compact ? "gap-3" : "gap-4")}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display font-extrabold text-[18px]">Комментарии</h2>
        <span className="font-mono text-[11px] text-ink-45">{total}</span>
      </div>

      <div className={cn("flex flex-col gap-4", compact && "max-h-[280px] overflow-y-auto pr-1")}>
        {items.length === 0 && (
          <p className="text-[13px] text-ink-45">Пока нет комментариев — напишите первым.</p>
        )}
        {items.map((c) => (
          <CommentRow
            key={c.id}
            comment={c}
            currentUserId={user?.id}
            currentUsername={user?.username}
            onReply={setReplyTo}
            onDelete={remove}
          />
        ))}
      </div>

      {user ? (
        <div>
          {replyTo && (
            <div className="flex items-center justify-between mb-1.5 text-[12px] text-ink-45">
              <span>
                Ответ @{replyTo.username}
              </span>
              <button type="button" className="bg-transparent border-0 text-magenta text-[12px]" onClick={() => setReplyTo(null)}>
                Отмена
              </button>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              ref={areaRef}
              className="field-box flex-1 min-h-[44px] max-h-28 resize-none py-2.5"
              placeholder={replyTo ? `Ответ @${replyTo.username}…` : "Написать комментарий…"}
              maxLength={1000}
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <EmojiStickerPicker
              emojiOnly
              align="right"
              buttonClassName="w-[44px] h-[44px]"
              onEmoji={(e) => {
                const el = areaRef.current;
                if (!el) {
                  setText((t) => t + e);
                  return;
                }
                const start = el.selectionStart ?? text.length;
                const end = el.selectionEnd ?? text.length;
                const next = text.slice(0, start) + e + text.slice(end);
                setText(next);
                requestAnimationFrame(() => {
                  el.focus();
                  const pos = start + e.length;
                  el.setSelectionRange(pos, pos);
                });
              }}
            />
            <Button size="sm" className="shrink-0 h-[44px] px-3" disabled={!text.trim() || busy} onClick={submit}>
              <Send size={15} />
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-ink-45">
          <Link href="/login" className="text-magenta no-underline hover:underline">Войдите</Link>
          , чтобы комментировать.
        </p>
      )}
    </div>
  );
}

function insertComment(list: CommentItem[], created: CommentItem, parentId: string | null): CommentItem[] {
  if (!parentId) return [...list, { ...created, replies: [] }];
  return list.map((c) => {
    if (c.id === parentId || (c.replies || []).some((r) => r.id === parentId)) {
      return { ...c, replies: [...(c.replies || []), created] };
    }
    return c;
  });
}

function CommentRow({
  comment,
  currentUserId,
  currentUsername,
  onReply,
  onDelete,
}: {
  comment: CommentItem;
  currentUserId?: string;
  currentUsername?: string;
  onReply: (c: CommentItem) => void;
  onDelete: (c: CommentItem) => void;
}) {
  const own = currentUserId === comment.userId || currentUsername === comment.username;
  return (
    <div>
      <div className="flex gap-2.5">
        <Link href={`/profile/${comment.username}`} className="shrink-0">
          <span className="block w-8 h-8 border border-line overflow-hidden">
            <SmartImage src={comment.avatarUrl} alt={comment.username} fallback={comment.username} />
          </span>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <Link href={`/profile/${comment.username}`} className="text-[13px] text-paper no-underline hover:text-magenta truncate">
              {comment.displayName || comment.username}
            </Link>
            <span className="font-mono text-[10px] text-ink-45 shrink-0">{formatCommentTime(comment.createdAt)}</span>
          </div>
          <p className="text-[13px] text-ink-70 mt-0.5 break-words">{comment.text}</p>
          <div className="flex items-center gap-3 mt-1">
            <button type="button" className="bg-transparent border-0 text-[11px] text-ink-45 hover:text-magenta p-0" onClick={() => onReply(comment)}>
              Ответить
            </button>
            {own && (
              <button type="button" className="bg-transparent border-0 text-[11px] text-ink-45 hover:text-magenta p-0 inline-flex items-center gap-1" onClick={() => onDelete(comment)}>
                <Trash2 size={11} /> Удалить
              </button>
            )}
          </div>
        </div>
      </div>
      {(comment.replies?.length || 0) > 0 && (
        <div className="ml-10 mt-3 flex flex-col gap-3 border-l border-line pl-3">
          {comment.replies!.map((r) => (
            <CommentRow
              key={r.id}
              comment={r}
              currentUserId={currentUserId}
              currentUsername={currentUsername}
              onReply={onReply}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
