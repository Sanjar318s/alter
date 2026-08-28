"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  Flag,
  ImagePlus,
  Link2,
  Lock,
  Mic,
  MoreVertical,
  Paperclip,
  Pin,
  Plus,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  User,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { Frame } from "@/components/Frame";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { CountBadge } from "@/components/ui/CountBadge";
import { IconButton } from "@/components/ui/IconButton";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { ChannelInfoPanel } from "@/components/messages/ChannelInfoPanel";
import { ChannelMenu, type ChannelMenuAction } from "@/components/messages/ChannelMenu";
import { ChannelSheet } from "@/components/messages/ChannelSheet";
import { ChannelSidebar } from "@/components/messages/ChannelSidebar";
import {
  COMMUNITY_CHANNEL_COUNT,
  getChannelById,
  getRegionChannels,
  getTopicChannels,
  overlayLiveChannels,
  type LiveChannelRow,
} from "@/lib/communityChannels";
import { ChatMessageRow, type ChatMsg } from "@/components/messages/ChatMessageRow";
import { EmojiStickerPicker } from "@/components/messages/EmojiStickerPicker";
import { GifPicker } from "@/components/messages/GifPicker";
import { ForwardMessageModal } from "@/components/messages/ForwardMessageModal";
import { MessageContextMenu, type MessageMenuAction } from "@/components/messages/MessageContextMenu";
import { ReportModal } from "@/components/messages/ReportModal";
import { Modal } from "@/components/ui/Modal";
import {
  getHiddenSenders,
  hideSender,
  getPinnedMessageIds,
  isMessageFavorite,
  isMessagePinned,
  isThreadSubscribed,
  toggleMessageFavorite,
  togglePinnedMessage,
  toggleThreadSubscription,
} from "@/lib/messageLocalPrefs";
import { MediaRecorderService } from "@/lib/MediaRecorderService";
import { SmartImage } from "@/components/media/SmartImage";
import { cn } from "@/lib/cn";
import { formatBlacklistCardLine } from "@/lib/blacklistCardFormat";
import { admin, messages as messagesApi, uploadFile, users } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/AuthContext";
import { isOwnerStaffRole, isPlatformOwnerUser } from "@/lib/owner";
import { editImageList, useEditImage } from "@/components/media/ImageEditorProvider";
import { subscribeRealtime } from "@/lib/realtimeHub";

type Msg = ChatMsg;

type PendingAttach = { file: File; preview: string; kind: "image" | "video" | "file" };

function msgPreview(m: Msg) {
  if (m.type === "sticker") return m.sticker || "Стикер";
  if (m.type === "image") return "Фото";
  if (m.type === "voice") return "Голосовое";
  if (m.type === "video") return "Видео";
  if (m.type === "file") return m.text || "Файл";
  if (m.type === "order") return "Заявка на заказ";
  return m.text || "";
}

function isRealSrc(src?: string) {
  if (!src) return false;
  return /^(blob:|data:|https?:|\/)/.test(src);
}

function isViewingConv(convId: string, activeId: string, channels: LiveChannelRow[]) {
  if (!convId || !activeId) return false;
  if (convId === activeId || convId === `conv-${activeId}`) return true;
  const row = channels.find((c) => c.id === activeId || c.conversationId === activeId);
  return Boolean(row && row.conversationId === convId);
}

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

const PROFILE_TABS = [
  { id: "media" as const, label: "Медиа" },
  { id: "files" as const, label: "Файлы" },
  { id: "links" as const, label: "Ссылки" },
];

export default function MessagesInner({ conversationId }: { conversationId?: string } = {}) {
  const { user } = useAuth();
  const toast = useToast();
  const edit = useEditImage();
  const router = useRouter();
  const sp = useSearchParams();
  const isGhostView = sp.get("ghost") === "1";
  const ghostTargetUser = sp.get("targetUser") || "";
  const [tab, setTab] = useState<"dm" | "channels">(
    sp.get("tab") === "channels" ? "channels" : "dm"
  );
  const [chip, setChip] = useState<"all" | "unread" | "mentions">("all");
  const [active, setActive] = useState(sp.get("c") || conversationId || "");
  const [channelListMode, setChannelListMode] = useState<"topics" | "regions">("topics");
  const [pane, setPane] = useState<"list" | "thread" | "profile">("list");
  const [hydrated, setHydrated] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mediaView, setMediaView] = useState<{ items: string[]; index: number; title?: string } | null>(null);
  const [sharedTab, setSharedTab] = useState<"media" | "files" | "links">("media");
  const [reportTarget, setReportTarget] = useState<{ type: string; id: string; name: string } | null>(null);
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [drop, setDrop] = useState(false);
  const [recording, setRecording] = useState<"audio" | "video" | null>(null);
  const [recTime, setRecTime] = useState(0);
  const [msgMenu, setMsgMenu] = useState<{ message: Msg; anchor: DOMRect } | null>(null);
  const [forwardMsg, setForwardMsg] = useState<Msg | null>(null);
  const [editingMsg, setEditingMsg] = useState<Msg | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; body: string; action: () => void } | null>(null);
  const [hiddenSenders, setHiddenSenders] = useState<string[]>([]);
  const [prefsTick, setPrefsTick] = useState(0);
  const [modPerms, setModPerms] = useState({ isOwner: false, canViewUsers: false });
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [pending, setPending] = useState<PendingAttach[]>([]);
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [threadQuery, setThreadQuery] = useState("");
  const [matchIdx, setMatchIdx] = useState(0);
  const rec = useRef(new MediaRecorderService());
  const startX = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const [dms, setDms] = useState<{ id: string; name: string; preview: string; time: string; unread: number; type: string; peerId?: string; peerUsername?: string; avatarUrl?: string; pinned?: boolean; muted?: boolean }[]>([]);
  const [sharedFiles, setSharedFiles] = useState<{ id: string; name: string; size: string; date: string; url?: string }[]>([]);
  const [sharedMedia, setSharedMedia] = useState<string[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [peer, setPeer] = useState<any>(null);
  const [apiChannels, setApiChannels] = useState<LiveChannelRow[]>([]);
  const [muted, setMuted] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [typing, setTyping] = useState("");
  const [ghostIntervene, setGhostIntervene] = useState(false);
  const [ghostCanIntervene, setGhostCanIntervene] = useState(false);
  const [channelManageOpen, setChannelManageOpen] = useState(false);
  const [channelInfoOpen, setChannelInfoOpen] = useState(false);
  const [channelMenuAnchor, setChannelMenuAnchor] = useState<DOMRect | null>(null);
  const [channelSheet, setChannelSheet] = useState<null | "members" | "pinned" | "media" | "files" | "activity">(null);
  const [channelMembers, setChannelMembers] = useState<{ id: string; username: string; avatarUrl?: string }[]>([]);
  const [channelCreatedAt, setChannelCreatedAt] = useState<string | undefined>();
  const [channelTitleDraft, setChannelTitleDraft] = useState("");
  const [channelWriteModeDraft, setChannelWriteModeDraft] = useState<"members" | "owner_only" | "channel_admins">("members");
  const [channelManagersDraft, setChannelManagersDraft] = useState("");
  const ghostReadOnly = isGhostView && !ghostIntervene;
  const activeRef = useRef(active);
  const apiChannelsRef = useRef(apiChannels);
  activeRef.current = active;
  apiChannelsRef.current = apiChannels;

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (conversationId) setActive(conversationId);
  }, [conversationId]);

  useEffect(() => {
    if (!isGhostView) return;
    admin
      .me()
      .then((m) => setGhostCanIntervene(Boolean(m.permissions?.canViewUsers || m.isOwner)))
      .catch(() => setGhostCanIntervene(false));
  }, [isGhostView]);

  useEffect(() => {
    messagesApi
      .conversations()
      .then((r) => {
        const mapped = (r.conversations || []).map((c: any) => ({
          id: c.id,
          name: c.members?.[0]?.username || "диалог",
          preview: c.lastMessage?.text || (c.lastMessage?.type === "image" ? "📷 Фото" : c.lastMessage?.type === "voice" ? "🎤 Голосовое" : ""),
          time: c.lastMessage?.createdAt ? new Date(c.lastMessage.createdAt).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }) : "",
          unread: c.unread || 0,
          type: c.lastMessage?.type || "text",
          peerId: c.members?.[0]?.id,
          peerUsername: c.members?.[0]?.username,
          avatarUrl: c.members?.[0]?.avatarUrl,
          pinned: c.settings?.pinned,
          muted: c.settings?.muted,
        }));
        setDms(mapped);
        if (conversationId) {
          setActive(conversationId);
          setPane("thread");
        } else if (mapped[0] && !sp.get("c") && sp.get("tab") !== "channels" && !isMobileViewport()) {
          setActive(mapped[0].id);
          setPane("thread");
        }
      })
      .catch(() => setDms([]));
    messagesApi.channels().then((r) => setApiChannels(r.channels || [])).catch(() => setApiChannels([]));
  }, [conversationId, sp]);

  useEffect(() => {
    if (!active) return;
    const catalog = getChannelById(active);
    const ch = apiChannelsRef.current.find((c) => c.id === active || c.conversationId === active);
    const channelId = catalog?.id || ch?.id;
    const convId = ch?.conversationId || (catalog ? `conv-${catalog.id}` : active);
    let cancelled = false;
    (async () => {
      if (channelId) {
        await messagesApi.joinChannel(channelId).catch(() => {});
        const listed = await messagesApi.channels().catch(() => null);
        if (!cancelled && listed) setApiChannels(listed.channels || []);
      }
      if (cancelled) return;
      messagesApi
        .thread(convId, undefined, isGhostView)
        .then((r) => {
          if (cancelled) return;
          const raw = (r.messages || []) as any[];
          const base = raw.map((m) => ({
            id: m.id,
            own: m.senderId === user?.id,
            sender: m.sender?.username || (m.senderId === user?.id ? user?.username || "" : ""),
            senderId: m.senderId,
            senderAvatar: m.sender?.avatarUrl || (m.senderId === user?.id ? user?.avatarUrl : undefined),
            senderRole: m.sender?.staffRole || "none",
            senderBadgeHidden: Boolean(m.sender?.staffBadgeHidden),
            text: m.deleted ? "Сообщение удалено" : m.text,
            type: m.type || "text",
            time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }) : "",
            mediaUrl: m.mediaUrl,
            duration: m.duration,
            createdAt: m.createdAt,
            reactions: m.reactions || {},
            replyToId: m.replyTo as string | undefined,
          }));
          const replyCounts = base.reduce<Record<string, number>>((acc, m) => {
            if (m.replyToId) acc[m.replyToId] = (acc[m.replyToId] || 0) + 1;
            return acc;
          }, {});
          setMsgs(
            base.map(({ replyToId, ...m }) => {
              const parent = replyToId ? raw.find((x) => x.id === replyToId) : null;
              return {
                ...m,
                replyCount: replyCounts[m.id] || 0,
                replyTo: parent
                  ? {
                      id: parent.id,
                      sender: parent.sender?.username || "",
                      preview: parent.deleted ? "Сообщение удалено" : parent.text || parent.type || "",
                    }
                  : undefined,
              };
            })
          );
        })
        .catch(() => {
          if (!cancelled) setMsgs([]);
        });
      messagesApi.attachments(convId, undefined, isGhostView).then((r) => {
        if (cancelled) return;
        const items = r.items || [];
        setSharedFiles(
          items
            .filter((i: any) => i.type === "file" || i.fileName)
            .map((i: any) => ({ id: i.id, name: i.fileName || "файл", size: "", date: "", url: i.mediaUrl }))
        );
        setSharedMedia(items.map((i: any) => i.mediaUrl).filter(Boolean));
      }).catch(() => {});
    })();
    const dm = dms.find((d) => d.id === active);
    if (dm?.peerUsername) {
      users.get(dm.peerUsername).then(setPeer).catch(() => setPeer(null));
    } else if (channelId) {
      setPeer(null);
    }
    setMuted(Boolean(dm?.muted));
    setPinned(Boolean(dm?.pinned));
    if (channelId || isChannel) {
      messagesApi.getSettings(convId).then((s) => {
        setMuted(Boolean(s.muted));
        setPinned(Boolean(s.pinned));
      }).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [active, user?.id]);

  useEffect(() => {
    const urlTab = sp.get("tab");
    const urlC = sp.get("c");
    if (urlTab === "reels") {
      router.replace("/reels");
      return;
    }
    if (urlTab === "channels") {
      setTab("channels");
      if (urlC) {
        setActive(urlC);
        setPane("thread");
      } else if (!isMobileViewport()) {
        setActive("ch-obshalka");
        setPane("thread");
      } else {
        setPane("list");
      }
    } else if (urlC || conversationId) {
      setActive(urlC || conversationId || "");
      setPane("thread");
    } else if (isMobileViewport()) {
      setPane("list");
    }
  }, [sp, conversationId, router]);

  useEffect(() => {
    const onMessage = (_event: string, raw: unknown) => {
      try {
        const data = raw as { conversationId?: string; message?: any; userId?: string; username?: string };
        if (_event === "message" && data.message) {
          const convId = data.conversationId as string;
          const viewing = isViewingConv(convId, activeRef.current, apiChannelsRef.current);
          if (convId && !viewing) {
            const isCh = apiChannelsRef.current.some((c) => c.conversationId === convId);
            if (isCh) {
              setApiChannels((list) =>
                list.map((c) =>
                  c.conversationId === convId
                    ? {
                        ...c,
                        unread: (c.unread || 0) + 1,
                        lastMessage: {
                          text: data.message.text,
                          type: data.message.type,
                          createdAt: new Date().toISOString(),
                          sender: data.message.sender?.username || "",
                        },
                      }
                    : c
                )
              );
              return;
            }
            setDms((list) => {
              const next = list.map((d) => d.id === convId ? { ...d, unread: (d.unread || 0) + 1, preview: data.message.text || d.preview } : d);
              const hit = next.find((d) => d.id === convId);
              return hit ? [hit, ...next.filter((d) => d.id !== convId)] : next;
            });
            return;
          }
          setMsgs((m) => {
            if (m.some((x) => x.id === data.message.id)) return m;
            return [...m, {
              id: data.message.id,
              own: data.message.senderId === user?.id,
              sender: data.message.sender?.username || peer?.user?.username || "",
              senderAvatar: data.message.sender?.avatarUrl || (data.message.senderId === user?.id ? user?.avatarUrl : undefined),
              senderRole: data.message.sender?.staffRole || "none",
              senderBadgeHidden: Boolean(data.message.sender?.staffBadgeHidden),
              text: data.message.text,
              type: data.message.type || "text",
              time: "сейчас",
              mediaUrl: data.message.mediaUrl,
              duration: data.message.duration,
            }];
          });
        }
        if (_event === "typing" && data.conversationId && isViewingConv(data.conversationId, activeRef.current, apiChannelsRef.current) && data.userId !== user?.id) {
          setTyping(data.username || "печатает…");
          window.setTimeout(() => setTyping(""), 2000);
        }
      } catch {
        /* ignore */
      }
    };
    return subscribeRealtime(onMessage);
  }, [user?.id]);

  useEffect(() => {
    let t: number | undefined;
    if (recording) t = window.setInterval(() => setRecTime((s) => s + 1), 1000);
    else setRecTime(0);
    return () => {
      if (t) clearInterval(t);
    };
  }, [recording]);

  const list = dms.filter((d) => {
    if (query && !d.name.includes(query) && !d.preview.toLowerCase().includes(query.toLowerCase())) return false;
    if (chip === "unread") return d.unread > 0;
    if (chip === "mentions") return false;
    return true;
  });

  const activeChannel = apiChannels.find((c) => c.id === active || c.conversationId === active);
  const catalogChannel = getChannelById(active) || (activeChannel ? getChannelById(activeChannel.id) : undefined);
  const isChannel = Boolean(catalogChannel || activeChannel);
  const threadConvId = activeChannel?.conversationId || (catalogChannel ? `conv-${catalogChannel.id}` : active);
  const channelTitle = catalogChannel?.title || activeChannel?.title || "";
  const sidebarChannels = overlayLiveChannels(
    channelListMode === "topics" ? getTopicChannels() : getRegionChannels(),
    apiChannels
  );
  const isOwner = isPlatformOwnerUser(user);
  const isChannelManager = Boolean(
    isChannel &&
      user?.username &&
      (activeChannel?.managerUsernames || []).map((x: string) => x.toLowerCase()).includes((user.username || "").toLowerCase())
  );
  const activeDm = dms.find((d) => d.id === active);
  const canPostToChannel =
    !isChannel ||
    (activeChannel?.writeMode || "members") === "members" ||
    ((activeChannel?.writeMode || "members") === "owner_only" && isOwner) ||
    ((activeChannel?.writeMode || "members") === "channel_admins" && (isOwner || isChannelManager));
  const peerName = peer?.user?.username || activeDm?.name || "диалог";
  const isModerator = modPerms.isOwner || modPerms.canViewUsers || isOwner || ghostCanIntervene;
  const visibleMsgs = msgs.filter((m) => !hiddenSenders.includes(m.sender.toLowerCase()));
  const forwardTargets = [
    ...dms.map((d) => ({ id: d.id, label: d.name, kind: "dm" as const, avatarUrl: d.avatarUrl })),
    ...apiChannels.map((c) => ({
      id: c.conversationId || c.id,
      label: c.title || c.id,
      kind: "channel" as const,
    })),
  ].filter((t, i, arr) => t.id && arr.findIndex((x) => x.id === t.id) === i && t.id !== threadConvId);
  const threadQ = threadQuery.trim().toLowerCase();
  const matchIds = threadQ
    ? msgs.filter((m) => `${m.text || ""} ${msgPreview(m)}`.toLowerCase().includes(threadQ)).map((m) => m.id)
    : [];

  useEffect(() => {
    if (!matchIds.length) return;
    const id = matchIds[Math.min(matchIdx, matchIds.length - 1)];
    document.getElementById(`msg-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [matchIdx, threadQuery]);

  useEffect(() => {
    setHiddenSenders(getHiddenSenders());
    admin.me().then((m) => setModPerms({ isOwner: m.isOwner, canViewUsers: Boolean(m.permissions?.canViewUsers) })).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isChannel || !activeChannel) return;
    setChannelTitleDraft(activeChannel.title || "");
    setChannelWriteModeDraft((activeChannel.writeMode as "members" | "owner_only" | "channel_admins") || "members");
    setChannelManagersDraft((activeChannel.managerUsernames || []).join(", "));
  }, [isChannel, activeChannel?.id, activeChannel?.title, activeChannel?.writeMode]);

  function selectChannel(id: string) {
    setActive(id);
    setPane("thread");
    setReplyTo(null);
    setPending([]);
    router.replace(`/messages?tab=channels&c=${id}`, { scroll: false });
  }

  function selectDm(id: string) {
    setActive(id);
    setPane("thread");
    setReplyTo(null);
    setPending([]);
    router.replace(`/messages?c=${id}`, { scroll: false });
  }

  async function send(extra?: Partial<Msg>) {
    const body = extra?.text ?? text;
    const urls = extra?.mediaUrls?.length ? extra.mediaUrls : extra?.mediaUrl ? [extra.mediaUrl] : [];
    const type = extra?.type || (urls.length ? "image" : extra?.sticker ? "sticker" : "text");
    if (!body && !urls.length && type !== "voice" && type !== "video" && type !== "sticker") return;
    const msg: Msg = {
      id: String(Date.now()),
      own: true,
      sender: user?.username || "",
      senderAvatar: user?.avatarUrl,
      text: body,
      type,
      time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      mediaUrl: extra?.mediaUrl || urls[0],
      mediaUrls: extra?.mediaUrls || (urls.length ? urls : undefined),
      duration: extra?.duration,
      sticker: extra?.sticker,
      replyTo: extra?.replyTo ?? (replyTo ? { id: replyTo.id, sender: replyTo.sender, preview: msgPreview(replyTo) } : undefined),
    };
    setMsgs((m) => [...m, msg]);
    setText("");
    setReplyTo(null);
    try {
      await messagesApi.send(threadConvId, {
        text: msg.text,
        mediaUrl: msg.mediaUrl,
        type: msg.type,
        duration: msg.duration,
        replyTo: msg.replyTo?.id,
      });
      if (isChannel) {
        setApiChannels((list) =>
          list.map((c) =>
            c.conversationId === threadConvId || c.id === active
              ? {
                  ...c,
                  lastMessage: {
                    text: msg.text || "",
                    type: msg.type,
                    createdAt: new Date().toISOString(),
                    sender: user?.username || "",
                  },
                  unread: 0,
                }
              : c
          )
        );
      }
    } catch {
      setMsgs((m) => m.map((x) => (x.id === msg.id ? { ...x, failed: true } : x)));
    }
  }

  async function reactToMessage(id: string, emoji: string) {
    setMsgs((list) =>
      list.map((m) => {
        if (m.id !== id) return m;
        const reactions = { ...(m.reactions || {}) };
        const users = [...(reactions[emoji] || [])];
        const me = user?.id || user?.username || "";
        const idx = users.indexOf(me);
        if (idx >= 0) users.splice(idx, 1);
        else users.push(me);
        if (users.length) reactions[emoji] = users;
        else delete reactions[emoji];
        return { ...m, reactions };
      })
    );
    try {
      await messagesApi.react(id, emoji);
    } catch {
      /* keep optimistic UI */
    }
  }

  async function queueFiles(files: FileList | File[], asImage: boolean) {
    const list = Array.from(files);
    const images = list.filter((f) => asImage || f.type.startsWith("image"));
    const rest = list.filter((f) => !(asImage || f.type.startsWith("image")));
    const edited = await editImageList(edit, images);
    const next: PendingAttach[] = [];
    for (const file of [...edited.files, ...rest]) {
      const kind: PendingAttach["kind"] = file.type.startsWith("image")
        ? "image"
        : file.type.startsWith("video")
          ? "video"
          : "file";
      next.push({ file, preview: URL.createObjectURL(file), kind });
    }
    if (!next.length) return;
    setPending((p) => [...p, ...next]);
    composerRef.current?.focus();
  }

  async function sendComposer() {
    if (ghostReadOnly) {
      toast("Ghost view: включите «Вмешаться», чтобы писать", true);
      return;
    }
    if (pending.length) {
      const uploaded: string[] = [];
      for (const p of pending) {
        try {
          const up = await uploadFile(p.file, p.file.name, p.file.type);
          uploaded.push(up.url);
        } catch {
          uploaded.push(p.preview);
        }
      }
      const kinds = pending.map((p) => p.kind);
      const type = kinds.every((k) => k === "image") ? "image" : kinds[0] === "video" ? "video" : "file";
      await send({
        type,
        mediaUrls: uploaded,
        mediaUrl: uploaded[0],
        text: text.trim() || undefined,
      });
      pending.forEach((p) => {
        if (p.preview.startsWith("blob:") && !uploaded.includes(p.preview)) URL.revokeObjectURL(p.preview);
      });
      setPending([]);
      return;
    }
    await send();
  }

  const peerIsPlatformOwner = isOwnerStaffRole(peer?.profile?.staffRole);
  const peerHref = peer?.user?.username ? `/profile/${peer.user.username}` : "#";

  function bumpPrefs() {
    setPrefsTick((t) => t + 1);
  }

  function messageLink(msgId: string) {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const tab = isChannel ? "channels" : undefined;
    const c = active;
    const qs = new URLSearchParams();
    if (tab) qs.set("tab", tab);
    if (c) qs.set("c", c);
    return `${base}/messages?${qs.toString()}#msg-${msgId}`;
  }

  function canEditMessage(m: Msg) {
    if (!m.own || m.type !== "text" || !m.text) return false;
    if (!m.createdAt) return true;
    return Date.now() - new Date(m.createdAt).getTime() <= 15 * 60 * 1000;
  }

  async function resolveSenderId(m: Msg) {
    if (m.senderId) return m.senderId;
    if (!m.sender) return null;
    try {
      const r = await users.search(m.sender);
      return r.users?.[0]?.id || null;
    } catch {
      return null;
    }
  }

  async function blockSender(m: Msg, mod = false) {
    const senderId = await resolveSenderId(m);
    if (!senderId) {
      toast("Не удалось определить пользователя", true);
      return;
    }
    if (isOwnerStaffRole(m.senderRole)) {
      toast("Нельзя заблокировать владельца платформы", true);
      return;
    }
    try {
      await messagesApi.block(senderId, mod ? { source: "manual", reason: "moderation" } : undefined);
      toast(mod ? "Пользователь заблокирован модератором" : "Пользователь заблокирован");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Не удалось заблокировать", true);
    }
  }

  async function handleMessageAction(action: MessageMenuAction) {
    const m = msgMenu?.message;
    if (!m) return;
    setMsgMenu(null);

    if (action === "reply") {
      startReply(m);
      return;
    }
    if (action === "forward") {
      setForwardMsg(m);
      return;
    }
    if (action === "copy-link") {
      await navigator.clipboard.writeText(messageLink(m.id));
      toast("Ссылка скопирована");
      return;
    }
    if (action === "copy-text") {
      const copy = m.text || msgPreview(m);
      await navigator.clipboard.writeText(copy);
      toast("Текст скопирован");
      return;
    }
    if (action === "favorite") {
      const nowFav = toggleMessageFavorite(m.id);
      bumpPrefs();
      toast(nowFav ? "Добавлено в избранное" : "Убрано из избранного");
      return;
    }
    if (action === "thread-sub") {
      const nowSub = toggleThreadSubscription(m.id);
      bumpPrefs();
      toast(nowSub ? "Вы подписаны на ответы" : "Подписка на ответы отключена");
      return;
    }
    if (action === "edit") {
      setEditingMsg(m);
      setEditDraft(m.text || "");
      return;
    }
    if (action === "pin") {
      const nowPinned = togglePinnedMessage(threadConvId, m.id);
      bumpPrefs();
      toast(nowPinned ? "Сообщение закреплено" : "Сообщение откреплено");
      return;
    }
    if (action === "delete") {
      setConfirmDialog({
        title: "Удалить сообщение?",
        body: "Сообщение исчезнет у всех участников чата. Это действие нельзя отменить.",
        action: async () => {
          try {
            await messagesApi.remove(m.id);
            setMsgs((list) => list.filter((x) => x.id !== m.id));
            toast("Сообщение удалено");
          } catch (e) {
            toast(e instanceof Error ? e.message : "Не удалось удалить", true);
          }
        },
      });
      return;
    }
    if (action === "report" || action === "mod-report") {
      setReportTarget({ type: "message", id: m.id, name: `@${m.sender}` });
      return;
    }
    if (action === "hide-user") {
      hideSender(m.sender);
      setHiddenSenders(getHiddenSenders());
      toast(`Сообщения @${m.sender} скрыты`);
      return;
    }
    if (action === "block" || action === "mod-block") {
      setConfirmDialog({
        title: action === "mod-block" ? "Заблокировать пользователя (модерация)?" : "Заблокировать пользователя?",
        body: `@${m.sender} больше не сможет писать вам. Действие можно отменить в настройках.`,
        action: () => blockSender(m, action === "mod-block"),
      });
      return;
    }
    if (action === "mod-profile") {
      router.push(`/profile/${encodeURIComponent(m.sender)}`);
      return;
    }
    if (action === "mod-restrict") {
      const senderId = await resolveSenderId(m);
      if (senderId) router.push(`/admin?user=${encodeURIComponent(senderId)}`);
      else toast("Не удалось открыть админку", true);
      return;
    }
    if (action === "mod-history") {
      router.push(`/admin?q=${encodeURIComponent(m.sender)}`);
      return;
    }
  }

  function openMessageMenu(message: Msg, anchor: DOMRect) {
    setMsgMenu({ message, anchor });
  }

  async function loadChannelMembersList() {
    const chId = catalogChannel?.id || activeChannel?.id;
    if (!chId) return;
    try {
      const r = await messagesApi.channelMembers(chId);
      setChannelMembers(r.members || []);
      if (r.channel?.createdAt) setChannelCreatedAt(String(r.channel.createdAt));
    } catch {
      setChannelMembers([]);
    }
  }

  async function handleChannelMenuAction(action: ChannelMenuAction) {
    const chId = catalogChannel?.id || activeChannel?.id;
    const displayTitle = channelTitle.startsWith("#") ? channelTitle : `# ${channelTitle}`;
    const membersCount =
      typeof activeChannel?.membersCount === "number"
        ? activeChannel.membersCount
        : typeof catalogChannel?.members === "number"
          ? catalogChannel.members
          : channelMembers.length;

    if (action === "notifications") {
      const next = !muted;
      setMuted(next);
      await messagesApi.settings(threadConvId, { muted: next }).catch(() => setMuted(!next));
      toast(next ? "Уведомления канала выключены" : "Уведомления канала включены");
      return;
    }
    if (action === "search") {
      setThreadSearchOpen(true);
      return;
    }
    if (action === "pinned") {
      setChannelSheet("pinned");
      return;
    }
    if (action === "media") {
      setChannelSheet("media");
      return;
    }
    if (action === "files") {
      setChannelSheet("files");
      return;
    }
    if (action === "members" || action === "manage-members") {
      await loadChannelMembersList();
      setChannelSheet("members");
      return;
    }
    if (action === "invite") {
      const link = `${window.location.origin}/messages?tab=channels&c=${chId || active}`;
      await navigator.clipboard.writeText(link);
      toast("Ссылка-приглашение скопирована");
      return;
    }
    if (action === "activity") {
      setChannelSheet("activity");
      return;
    }
    if (action === "settings") {
      setChannelManageOpen(true);
      setChannelInfoOpen(false);
      return;
    }
    if (action === "moderation") {
      router.push("/admin");
      return;
    }
    if (action === "audit-log") {
      router.push(`/admin?q=${encodeURIComponent(displayTitle.replace(/^#\s*/, ""))}`);
      return;
    }
    if (action === "leave") {
      if (!chId) return;
      setConfirmDialog({
        title: "Покинуть канал?",
        body: `Вы выйдете из ${displayTitle}. Чтобы вернуться, снова откройте канал из списка.`,
        action: async () => {
          try {
            await messagesApi.leaveChannel(chId);
            toast("Вы покинули канал");
            setChannelInfoOpen(false);
            selectChannel(getTopicChannels()[0]?.id || "ch-obshalka");
          } catch (e) {
            toast(e instanceof Error ? e.message : "Не удалось покинуть канал", true);
          }
        },
      });
    }
  }

  function openChannelInfo() {
    setChannelInfoOpen((v) => !v);
    setProfileOpen(false);
    if (isMobileViewport()) setPane("profile");
    if (!channelInfoOpen) loadChannelMembersList().catch(() => {});
  }

  function startReply(m: Msg) {
    setReplyTo(m);
    setMsgMenu(null);
    composerRef.current?.focus();
  }

  function openProfile() {
    setProfileOpen(true);
    setChannelInfoOpen(false);
    setPane("profile");
  }

  function closeProfile() {
    setProfileOpen(false);
    setPane("thread");
  }

  useEffect(() => {
    if (!mediaView) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMediaView(null);
      if (e.key === "ArrowRight") {
        setMediaView((v) => v ? { ...v, index: (v.index + 1) % v.items.length } : v);
      }
      if (e.key === "ArrowLeft") {
        setMediaView((v) => v ? { ...v, index: (v.index - 1 + v.items.length) % v.items.length } : v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mediaView]);

  const channelMembersCount =
    typeof activeChannel?.membersCount === "number"
      ? activeChannel.membersCount
      : typeof catalogChannel?.members === "number"
        ? catalogChannel.members
        : channelMembers.length;
  const channelPinnedIds = getPinnedMessageIds(threadConvId);
  const channelPinnedMsgs = msgs.filter((m) => channelPinnedIds.includes(m.id));
  const channelLastActive = activeChannel?.lastMessage?.createdAt
    ? new Date(activeChannel.lastMessage.createdAt).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : undefined;

  return (
    <div
      className="flex flex-1 w-full min-h-0 min-w-0 max-w-full overflow-hidden relative"
      onDragOver={(e) => { e.preventDefault(); setDrop(true); }}
      onDragLeave={() => setDrop(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrop(false);
        if (e.dataTransfer.files.length) queueFiles(e.dataTransfer.files, true);
      }}
    >
      {drop && (
        <div className="absolute inset-0 z-40 bg-ink/80 flex items-center justify-center font-display text-[28px] text-magenta">
          ОТПУСТИТЕ ФАЙЛ
        </div>
      )}
      <aside
        className={cn(
          "shrink-0 bg-stage/90 backdrop-blur-sm border-r border-line flex flex-col min-h-0 h-full overflow-hidden",
          "w-full md:w-[min(100%,260px)] lg:w-[300px]",
          hydrated && pane !== "list" && "hidden md:flex"
        )}
      >
        <div className="flex shrink-0 border-b border-line px-1 pt-1">
          <button
            type="button"
            onClick={() => {
              setTab("dm");
              if (isMobileViewport()) {
                setPane("list");
                router.replace("/messages", { scroll: false });
              } else if (dms[0]) {
                selectDm(dms.find((d) => d.id === active)?.id || dms[0].id);
              }
            }}
            className={cn(
              "flex-1 py-3 text-[13px] border-b-2 bg-transparent transition-colors",
              tab === "dm" ? "border-magenta text-paper font-medium" : "border-transparent text-ink-45 hover:text-paper"
            )}
          >
            Личные {dms.length}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("channels");
              if (isMobileViewport()) {
                setPane("list");
                router.replace("/messages?tab=channels", { scroll: false });
              } else {
                selectChannel(getChannelById(active) ? active : "ch-obshalka");
              }
            }}
            className={cn(
              "flex-1 py-3 text-[13px] border-b-2 bg-transparent transition-colors",
              tab === "channels" ? "border-magenta text-paper font-medium" : "border-transparent text-ink-45 hover:text-paper"
            )}
          >
            Каналы {COMMUNITY_CHANNEL_COUNT}
          </button>
        </div>
        <div className="shrink-0 p-3 border-b border-line">
          <div className="relative">
            <input
              className="w-full h-9 rounded-[10px] bg-ink border border-line px-3 pr-9 text-[12px] text-paper placeholder:text-ink-45 focus:outline-none focus:border-magenta/50"
              placeholder="Поиск"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <SlidersHorizontal size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-45 pointer-events-none" />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {(["all", "unread", "mentions"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChip(c)}
                className={cn(
                  "text-[11px] px-3 py-1 rounded-full border transition-colors",
                  chip === c
                    ? "border-magenta text-magenta bg-magenta/10"
                    : "border-[#2a2640] text-ink-45 hover:text-paper hover:border-[#3a3550]"
                )}
              >
                {c === "all" ? "Все" : c === "unread" ? "Непрочитанные" : "Упоминания"}
              </button>
            ))}
          </div>
        </div>

        {tab === "dm" ? (
          <div className="pane-scroll">
            {list.length === 0 && (
              <div className="px-4 py-8 text-center text-[12px] text-ink-45">Нет диалогов</div>
            )}
            {list.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => selectDm(d.id)}
                className={cn(
                  "relative w-full flex items-center gap-3 px-4 py-3 border-b border-[#1f1c2e] text-left transition-colors",
                  active === d.id
                    ? "bg-[#1a1524] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-magenta"
                    : "hover:bg-[#151320]/80"
                )}
              >
                <Frame className="w-11 h-11 shrink-0 overflow-hidden">
                  <SmartImage src={d.avatarUrl} alt={d.name} fallback={d.name} />
                </Frame>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px]">{d.name}</div>
                  <div className="text-[12px] text-ink-45 truncate">{d.type === "voice" ? "Голосовое сообщение" : d.type === "video" ? "Видеосообщение" : d.preview}</div>
                </div>
                {d.unread > 0 && <CountBadge count={d.unread} dot />}
              </button>
            ))}
          </div>
        ) : (
          <ChannelSidebar
            query={query}
            chip={chip}
            activeId={catalogChannel?.id || active}
            listMode={channelListMode}
            onListModeChange={setChannelListMode}
            channels={sidebarChannels}
            onSelect={(ch) => selectChannel(ch.id)}
          />
        )}
      </aside>
      <section
        className={cn(
          "flex flex-1 min-w-0 min-h-0 overflow-hidden flex-col",
          (!hydrated || pane === "profile" || pane === "list") && "hidden md:flex"
        )}
      >
        {isGhostView && (
          <div className="px-3 sm:px-4 py-2 border-b border-line bg-magenta/10 flex items-center justify-between gap-2">
            <p className="text-[12px] text-paper">
              Ghost view{ghostTargetUser ? ` · target ${ghostTargetUser}` : ""} · {ghostReadOnly ? "только просмотр" : "вмешательство активно"}
            </p>
            <Button
              size="sm"
              variant={ghostIntervene ? "danger" : "outline"}
              onClick={() => setGhostIntervene((v) => !v)}
              disabled={!ghostCanIntervene}
            >
              {ghostIntervene ? "Выйти из вмешательства" : "Вмешаться"}
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3.5 border-b border-line min-w-0 bg-ink/35 backdrop-blur-md">
          <button
            type="button"
            className="md:hidden shrink-0 bg-transparent border-0 text-paper"
            onClick={() => {
              setPane("list");
              if (tab === "channels") router.replace("/messages?tab=channels", { scroll: false });
              else router.replace("/messages", { scroll: false });
            }}
          >
            <ArrowLeft size={18} />
          </button>
          {isChannel ? (
            <span className="w-10 h-10 shrink-0 flex items-center justify-center text-xl bg-[#12101a] border border-[#2a2640] rounded-[10px]">
              {catalogChannel?.icon || "💬"}
            </span>
          ) : (
            <button
              type="button"
              aria-label="Открыть аватар"
              className="p-0 border-0 bg-transparent shrink-0 cursor-pointer"
              onClick={() => setMediaView({ items: [peer?.profile?.avatarUrl].filter(Boolean), index: 0, title: peerName })}
            >
              <Frame className="w-9 h-9 overflow-hidden">
                <SmartImage src={peer?.profile?.avatarUrl || activeDm?.avatarUrl} alt={peerName} fallback={peerName} />
              </Frame>
            </button>
          )}
          <div className="flex-1 min-w-0">
            {threadSearchOpen ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  className="field-box text-[12px] py-1.5 flex-1"
                  placeholder="Поиск в чате…"
                  value={threadQuery}
                  onChange={(e) => { setThreadQuery(e.target.value); setMatchIdx(0); }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { setThreadSearchOpen(false); setThreadQuery(""); }
                    if (e.key === "Enter" && matchIds.length) setMatchIdx((i) => (i + 1) % matchIds.length);
                  }}
                />
                <span className="font-mono text-[10px] text-ink-45 shrink-0">
                  {matchIds.length ? `${Math.min(matchIdx, matchIds.length - 1) + 1}/${matchIds.length}` : "0"}
                </span>
                <IconButton label="Назад" className="w-8 h-8" disabled={!matchIds.length} onClick={() => setMatchIdx((i) => (i - 1 + matchIds.length) % matchIds.length)}>
                  <ChevronUp size={14} />
                </IconButton>
                <IconButton label="Далее" className="w-8 h-8" disabled={!matchIds.length} onClick={() => setMatchIdx((i) => (i + 1) % matchIds.length)}>
                  <ChevronDown size={14} />
                </IconButton>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  {isChannel ? (
                    <span className="text-[16px] font-semibold truncate text-paper">
                      {channelTitle.startsWith("#") ? channelTitle : `# ${channelTitle}`}
                    </span>
                  ) : (
                    <Link href={peerHref} className="text-[16px] font-semibold truncate text-paper no-underline hover:text-magenta">
                      {peerName}
                    </Link>
                  )}
                  {isChannel && catalogChannel?.locked && <Lock size={13} className="shrink-0 text-ink-45" />}
                  {!isChannel && <Badge />}
                </div>
                <div className="text-[12px] text-ink-45 truncate mt-0.5">
                  {typing
                    ? "печатает…"
                    : isChannel
                    ? `Канал · ${channelMembersCount} участников`
                    : peer?.profile?.city || peer?.profile?.bio || "Личный чат"}
                </div>
              </>
            )}
          </div>
          {isChannel && (
            <>
              <IconButton
                label="Закреплённые"
                className="w-9 h-9 shrink-0 hidden sm:inline-flex"
                onClick={() => setChannelSheet("pinned")}
              >
                <Pin size={16} />
              </IconButton>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[12px] text-ink-45 px-2">
                <Users size={15} />
                {channelMembersCount}
              </span>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center shrink-0 text-[12px] font-medium px-3.5 py-1.5 rounded-[10px] border transition-colors",
                  channelInfoOpen
                    ? "text-paper border-magenta bg-magenta/15"
                    : "text-magenta border-magenta/70 bg-transparent hover:bg-magenta/10"
                )}
                onClick={openChannelInfo}
              >
                + Информация
              </button>
              <IconButton
                label="Меню канала"
                className="w-9 h-9 shrink-0"
                onClick={(e) => setChannelMenuAnchor(e.currentTarget.getBoundingClientRect())}
              >
                <MoreVertical size={16} />
              </IconButton>
            </>
          )}
          <IconButton
            label="Поиск"
            className={cn("w-9 h-9 shrink-0", threadSearchOpen && "text-magenta")}
            onClick={() => {
              setThreadSearchOpen((v) => !v);
              if (threadSearchOpen) setThreadQuery("");
            }}
          >
            {threadSearchOpen ? <X size={16} /> : <Search size={16} />}
          </IconButton>
          {!isChannel && (
            <>
              <IconButton label="Пожаловаться" className="w-9 h-9 shrink-0" onClick={() => setReportTarget({ type: "user", id: activeDm?.peerId || peer?.user?.id || peerName, name: peerName })}>
                <Flag size={16} />
              </IconButton>
              <button
                type="button"
                className={cn(
                  "hidden md:inline-flex items-center shrink-0 text-[12px] font-medium px-3 py-1.5 rounded-[4px] border",
                  profileOpen
                    ? "text-paper border-line bg-ink hover:border-magenta"
                    : "text-paper border-magenta/70 bg-magenta/20 hover:bg-magenta/30 hover:border-magenta shadow-[0_0_12px_rgba(229,72,122,0.25)]"
                )}
                onClick={() => (profileOpen ? closeProfile() : openProfile())}
              >
                {profileOpen ? "Закрыть" : "Профиль"}
              </button>
              <IconButton
                label="Профиль"
                className="md:hidden shrink-0 w-9 h-9"
                onClick={() => (profileOpen ? closeProfile() : openProfile())}
              >
                <User size={16} />
              </IconButton>
            </>
          )}
        </div>
        {isChannel && isOwner && channelManageOpen && activeChannel && (
          <div className="px-3 sm:px-4 py-2 border-b border-line bg-stage/70">
            <div className="grid md:grid-cols-2 gap-2">
              <label className="text-[11px] text-ink-45">
                Название канала
                <input
                  className="field-box mt-1 h-9 text-[12px] w-full"
                  value={channelTitleDraft}
                  onChange={(e) => setChannelTitleDraft(e.target.value)}
                />
              </label>
              <label className="text-[11px] text-ink-45">
                Кто может писать
                <select
                  className="field-box mt-1 h-9 text-[12px] w-full"
                  value={channelWriteModeDraft}
                  onChange={(e) => setChannelWriteModeDraft(e.target.value as "members" | "owner_only" | "channel_admins")}
                >
                  <option value="members">Все участники</option>
                  <option value="owner_only">Только владелец</option>
                  <option value="channel_admins">Владелец и админы канала</option>
                </select>
              </label>
            </div>
            <label className="text-[11px] text-ink-45 block mt-2">
              Админы канала (ники через запятую)
              <input
                className="field-box mt-1 h-9 text-[12px] w-full"
                placeholder="например: username1, username2"
                value={channelManagersDraft}
                onChange={(e) => setChannelManagersDraft(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await messagesApi.manageChannel(activeChannel.id, {
                      title: channelTitleDraft.trim() || activeChannel.title,
                      writeMode: channelWriteModeDraft,
                      managerUsernames: channelManagersDraft
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    });
                    const c = await messagesApi.channels();
                    setApiChannels(c.channels || []);
                    toast("Настройки канала сохранены");
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Не удалось сохранить канал", true);
                  }
                }}
              >
                Сохранить
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await messagesApi.manageChannel(activeChannel.id, { move: "up" });
                    const c = await messagesApi.channels();
                    setApiChannels(c.channels || []);
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Не удалось поднять канал", true);
                  }
                }}
              >
                Вверх
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await messagesApi.manageChannel(activeChannel.id, { move: "down" });
                    const c = await messagesApi.channels();
                    setApiChannels(c.channels || []);
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Не удалось опустить канал", true);
                  }
                }}
              >
                Вниз
              </Button>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setChannelManageOpen(false)}>
                Закрыть
              </Button>
            </div>
          </div>
        )}
        <div ref={threadRef} className="pane-scroll chat-thread px-3 sm:px-5 py-4 flex flex-col gap-4">
          {visibleMsgs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-16 text-center text-[13px] text-ink-45">
              {hiddenSenders.length > 0 && msgs.length > 0
                ? "Сообщения скрыты. Откройте меню пользователя, чтобы вернуть."
                : isChannel
                ? "Пока нет сообщений. Напишите первым."
                : "Нет сообщений"}
            </div>
          ) : (
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-line/70" />
              <span className="font-mono text-[11px] text-ink-45 uppercase tracking-wide">Сегодня</span>
              <div className="flex-1 h-px bg-line/70" />
            </div>
          )}
          {visibleMsgs.map((m) => {
            const hit = Boolean(threadQ && matchIds.includes(m.id));
            const activeHit = hit && matchIds[Math.min(matchIdx, matchIds.length - 1)] === m.id;
            void prefsTick;
            const decorated: Msg = {
              ...m,
              favorited: isMessageFavorite(m.id),
              pinned: isMessagePinned(threadConvId, m.id),
            };
            return (
              <ChatMessageRow
                key={m.id}
                message={decorated}
                hit={hit}
                threadQ={threadQ}
                highlight={highlight}
                activeHit={activeHit}
                onMenuOpen={(msg, anchor) => openMessageMenu(msg, anchor)}
                onReply={startReply}
                onReact={reactToMessage}
                onForward={setForwardMsg}
                onOpenMedia={(items, index) => setMediaView({ items, index })}
                onScrollToReply={(id) => document.getElementById(`msg-${id}`)?.scrollIntoView({ block: "center" })}
              />
            );
          })}
        </div>
        {blocked ? (
          <div className="px-4 py-4 text-[13px] text-ink-45">Пользователь заблокирован. Сообщения не отправляются.</div>
        ) : ghostReadOnly ? (
          <div className="px-4 py-4 border-t border-line bg-stage/60">
            <div className="panel p-4 text-[13px]">
              <div className="font-semibold mb-1">Режим наблюдателя</div>
              <div className="text-ink-45">Вы просматриваете чат как призрак. Нажмите «Вмешаться», чтобы отправлять сообщения и модерировать.</div>
            </div>
          </div>
        ) : isChannel && !canPostToChannel ? (
          <div className="px-4 py-4 border-t border-line bg-stage/60">
            <div className="panel p-4 text-[13px]">
              <div className="font-semibold mb-1">
                {(activeChannel?.writeMode || "members") === "channel_admins"
                  ? "Писать могут только владелец и админы канала"
                  : "Писать может только владелец"}
              </div>
              <div className="text-ink-45">
                {(activeChannel?.writeMode || "members") === "channel_admins"
                  ? "Обычным участникам в этом канале доступно только чтение."
                  : "Это owner-only канал. Здесь публикуются карточки блокировок в стиле ALTER."}
              </div>
            </div>
          </div>
        ) : (
        <div className="shrink-0 px-3 sm:px-5 py-3 border-t border-line bg-stage/55 backdrop-blur-md">
          {recording && (
            <div
              className="flex items-center gap-3 mb-3 px-3 py-2 border border-magenta/40 bg-magenta/5 rounded-[10px]"
              onPointerDown={(e) => { startX.current = e.clientX; }}
              onPointerUp={async (e) => {
                const dx = e.clientX - startX.current;
                if (dx < -80) {
                  rec.current.cancel();
                  setRecording(null);
                  toast("Запись отменена");
                  return;
                }
                try {
                  const blob = await rec.current.stop();
                  const url = URL.createObjectURL(blob);
                  await send({ type: recording === "audio" ? "voice" : "video", mediaUrl: url, duration: recTime, text: recording === "audio" ? "Голосовое" : "Видео" });
                } catch {
                  toast(recording === "audio" ? "Не удалось сохранить голосовое" : "Не удалось загрузить видео", true);
                }
                setRecording(null);
              }}
            >
              <span className="text-magenta animate-pulse">●</span>
              <span className="font-mono text-[12px]">00:{String(recTime).padStart(2, "0")}</span>
              <span className="text-[12px] text-ink-45 hidden sm:inline">
                отпустите, чтобы отправить · влево — отмена
              </span>
            </div>
          )}

          {replyTo && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 border-l-2 border-magenta bg-[#12101a] rounded-r-[10px]">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-magenta">Ответ {replyTo.sender}</div>
                <div className="text-[12px] text-ink-45 truncate">{msgPreview(replyTo)}</div>
              </div>
              <button type="button" className="bg-transparent border-0 text-ink-45 hover:text-paper" onClick={() => setReplyTo(null)} aria-label="Отменить ответ">
                <X size={14} />
              </button>
            </div>
          )}

          {pending.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
              {pending.map((p, i) => (
                <div key={p.preview} className="relative w-16 h-16 shrink-0 border border-line bg-ink overflow-hidden">
                  {p.kind === "image" ? (
                    <img src={p.preview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-ink-45 px-1 text-center">{p.file.name}</div>
                  )}
                  <button
                    type="button"
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-ink/80 border-0 text-paper flex items-center justify-center"
                    onClick={() => {
                      URL.revokeObjectURL(p.preview);
                      setPending((list) => list.filter((_, j) => j !== i));
                    }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input ref={fileRef} type="file" className="hidden" multiple onChange={(e) => { if (e.target.files) queueFiles(e.target.files, false); e.target.value = ""; }} />
          <input ref={imageRef} type="file" accept="image/*" className="hidden" multiple onChange={(e) => { if (e.target.files) queueFiles(e.target.files, true); e.target.value = ""; }} />

          <div className="rounded-[14px] border border-line bg-ink/70 backdrop-blur-sm focus-within:border-magenta/50 transition-colors overflow-hidden">
            <textarea
              ref={composerRef}
              className="w-full min-h-[56px] max-h-36 resize-none bg-transparent border-0 px-4 pt-3.5 pb-2 text-[14px] text-paper placeholder:text-ink-45 focus:outline-none"
              maxLength={2000}
              value={text}
              placeholder={pending.length ? "Подпись к фото…" : replyTo ? "Ваш ответ…" : "Напишите сообщение…"}
              rows={2}
              onChange={(e) => {
                setText(e.target.value);
                if (threadConvId) messagesApi.typing(threadConvId).catch(() => {});
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendComposer();
                }
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2">
              <div className="flex items-center flex-wrap">
                <IconButton label="Файл" className="w-9 h-9 text-ink-45 hover:text-paper" onClick={() => fileRef.current?.click()}>
                  <Paperclip size={17} strokeWidth={1.75} />
                </IconButton>
                <IconButton label="Изображение" className="w-9 h-9 text-ink-45 hover:text-paper" onClick={() => imageRef.current?.click()}>
                  <ImagePlus size={17} strokeWidth={1.75} />
                </IconButton>
                <GifPicker
                  disabled={ghostReadOnly}
                  onSelect={(gif) => send({ type: "image", mediaUrl: gif.url })}
                />
                <EmojiStickerPicker
                  onEmoji={(e) => {
                    setText((t) => t + e);
                    composerRef.current?.focus();
                  }}
                  onSticker={(s) => send({ type: "sticker", sticker: s.emoji, text: s.name })}
                />
                <IconButton
                  label="Голос"
                  className="w-9 h-9 text-ink-45 hover:text-paper"
                  onPointerDown={async () => {
                    try {
                      await rec.current.start("audio");
                      setRecording("audio");
                    } catch {
                      toast("Нет доступа к микрофону", true);
                    }
                  }}
                >
                  <Mic size={17} strokeWidth={1.75} />
                </IconButton>
                <IconButton label="Ещё" className="w-9 h-9 text-ink-45 hover:text-paper" onClick={() => fileRef.current?.click()}>
                  <Plus size={17} strokeWidth={1.75} />
                </IconButton>
              </div>

              <div className="flex items-center shrink-0">
                <button
                  type="button"
                  disabled={!text.trim() && !recording && !pending.length}
                  onClick={() => sendComposer()}
                  className="h-9 w-10 flex items-center justify-center rounded-l-[10px] bg-magenta text-paper border-0 disabled:opacity-40 hover:bg-[#d63d6f] transition-colors"
                >
                  <Send size={16} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="h-9 w-7 flex items-center justify-center rounded-r-[10px] bg-magenta text-paper border-0 border-l border-[#c93a66]/50 hover:bg-[#d63d6f] transition-colors"
                  aria-label="Опции отправки"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
        )}
      </section>
      {isChannel && (
        <aside
          className={cn(
            "border-l border-line bg-stage/90 backdrop-blur-sm min-w-0 shrink-0 min-h-0 overflow-hidden flex-col",
            channelInfoOpen ? "flex flex-1 w-full md:flex-none md:w-[280px] lg:w-[300px]" : "hidden"
          )}
        >
          <ChannelInfoPanel
            icon={catalogChannel?.icon || "💬"}
            title={channelTitle}
            channelId={catalogChannel?.id || activeChannel?.id}
            membersCount={channelMembersCount}
            notificationsOn={!muted}
            pinnedCount={channelPinnedIds.length}
            mediaCount={sharedMedia.length}
            filesCount={sharedFiles.length}
            createdAt={channelCreatedAt}
            onToggleNotifications={async () => {
              const next = !muted;
              setMuted(next);
              await messagesApi.settings(threadConvId, { muted: next }).catch(() => setMuted(!next));
            }}
            onOpenSheet={async (sheet) => {
              if (sheet === "members") await loadChannelMembersList();
              setChannelSheet(sheet);
            }}
            onClose={() => {
              setChannelInfoOpen(false);
              setPane("thread");
            }}
          />
        </aside>
      )}
      {!isChannel && (
      <aside
        className={cn(
          "border-l border-line bg-stage min-w-0 shrink-0 min-h-0 overflow-hidden flex-col",
          profileOpen
            ? "flex flex-1 w-full md:flex-none md:w-[260px] lg:w-[280px]"
            : "hidden"
        )}
      >
        <div className="pane-scroll p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[10px] uppercase tracking-wide text-ink-45">Профиль</span>
          <button type="button" className="bg-transparent border-0 text-ink-45 hover:text-paper" onClick={closeProfile} aria-label="Закрыть профиль">
            <X size={16} />
          </button>
        </div>
        <button
          type="button"
          className="block mx-auto p-0 border-0 bg-transparent cursor-pointer"
          onClick={() => setMediaView({ items: [peer?.profile?.avatarUrl].filter(Boolean), index: 0, title: peerName })}
        >
          <Frame className="w-20 h-20 overflow-hidden">
            <SmartImage src={peer?.profile?.avatarUrl || activeDm?.avatarUrl} alt={peerName} fallback={peerName} />
          </Frame>
        </button>
        <Link href={peerHref} className="block text-center font-display font-extrabold mt-3 text-paper no-underline hover:text-magenta">
          {peerName}
        </Link>
        <p className="text-[13px] text-ink-70 mt-3">{peer?.profile?.bio || "Нет описания"}</p>
        <div className="flex gap-2 justify-center mt-3 text-ink-45">
          <BrandIcon name="instagram" />
        </div>
        <Button href={peerHref} variant="outline" size="sm" className="mt-4 w-full">Открыть профиль</Button>

        <div className="mt-6 flex border-b border-line -mx-1">
          {PROFILE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSharedTab(t.id)}
              className={cn(
                "flex-1 py-2.5 text-[11px] font-mono uppercase tracking-wide border-b-2 -mb-px bg-transparent transition-colors",
                sharedTab === t.id
                  ? "border-magenta text-paper"
                  : "border-transparent text-ink-45 hover:text-paper"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-3 min-h-[120px]">
          {sharedTab === "media" && (
            <div className="grid grid-cols-3 gap-1">
              {sharedMedia.length === 0 && <p className="col-span-3 text-[12px] text-ink-45 py-4">Нет медиа</p>}
              {sharedMedia.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  className="aspect-square border-0 p-0 cursor-pointer overflow-hidden"
                  onClick={() => setMediaView({ items: sharedMedia, index: i })}
                >
                  <SmartImage src={src} alt="" fallback="media" />
                </button>
              ))}
            </div>
          )}

          {sharedTab === "files" && (
            <div className="flex flex-col gap-1">
              {sharedFiles.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => {
                    if (file.url) window.open(`${file.url}${file.url.includes("?") ? "&" : "?"}download=1`, "_blank");
                  }}
                  className="flex items-start gap-2.5 w-full text-left px-1 py-2 rounded-[4px] bg-transparent border-0 hover:bg-ink/60 transition-colors"
                >
                  <span className="w-9 h-9 shrink-0 bg-ink border border-line flex items-center justify-center text-magenta">
                    <FileText size={16} strokeWidth={1.75} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12px] text-paper truncate">{file.name}</span>
                    <span className="block font-mono text-[10px] text-ink-45 mt-0.5">
                      {file.size} · {file.date}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {sharedTab === "links" && (
            <div className="py-4 text-[12px] text-ink-45">Ссылки из переписки появятся здесь</div>
          )}
        </div>

        <label className="flex items-center justify-between mt-6 text-[13px] cursor-pointer group">
          <span className="flex items-center gap-2 text-ink-70 group-hover:text-paper transition-colors">
            <Bell size={14} /> Уведомления
          </span>
          <Checkbox
            checked={!muted}
            onChange={async () => {
              const next = !muted;
              setMuted(next);
              await messagesApi.settings(threadConvId, { muted: next }).catch(() => setMuted(!next));
            }}
          />
        </label>
        <label className="flex items-center justify-between mt-3 text-[13px] cursor-pointer group">
          <span className="flex items-center gap-2 text-ink-70 group-hover:text-paper transition-colors">
            <Pin size={14} /> Закрепить
          </span>
          <Checkbox
            checked={pinned}
            onChange={async () => {
              const next = !pinned;
              setPinned(next);
              await messagesApi.settings(threadConvId, { pinned: next }).catch(() => setPinned(!next));
            }}
          />
        </label>
        <Button variant="ghost" className="mt-6" onClick={() => setReportTarget({ type: "user", id: activeDm?.peerId || peer?.user?.id || peerName, name: peerName })}>Пожаловаться</Button>
        {!peerIsPlatformOwner && (
        <Button variant="danger" size="sm" onClick={async () => {
          const dm = dms.find((d) => d.id === active) as any;
          if (dm?.peerId) await messagesApi.block(dm.peerId);
          setBlocked(true);
        }}>Заблокировать</Button>
        )}
        </div>
      </aside>
      )}

      {channelMenuAnchor && isChannel && (
        <ChannelMenu
          open
          anchor={channelMenuAnchor}
          title={channelTitle}
          membersCount={channelMembersCount}
          notificationsOn={!muted}
          isModerator={isModerator || isOwner}
          onClose={() => setChannelMenuAnchor(null)}
          onAction={handleChannelMenuAction}
        />
      )}

      {channelSheet && isChannel && (
        <ChannelSheet
          kind={channelSheet}
          title={channelTitle.startsWith("#") ? channelTitle : `# ${channelTitle}`}
          members={channelMembers}
          pinnedMessages={channelPinnedMsgs.map((m) => ({ id: m.id, text: m.text, sender: m.sender }))}
          media={sharedMedia}
          files={sharedFiles}
          activity={{
            messagesCount: activeChannel?.messagesCount || msgs.length,
            membersCount: channelMembersCount,
            lastActive: channelLastActive,
          }}
          onClose={() => setChannelSheet(null)}
          onOpenMember={(username) => router.push(`/profile/${encodeURIComponent(username)}`)}
          onScrollToMessage={(id) => {
            setChannelSheet(null);
            document.getElementById(`msg-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
          }}
          onOpenMedia={(items, index) => setMediaView({ items, index })}
        />
      )}

      {msgMenu && (
        <MessageContextMenu
          open
          anchor={msgMenu.anchor}
          own={msgMenu.message.own}
          isModerator={isModerator}
          canBlockTarget={!isOwnerStaffRole(msgMenu.message.senderRole)}
          favorited={isMessageFavorite(msgMenu.message.id)}
          threadSubscribed={isThreadSubscribed(msgMenu.message.id)}
          pinned={isMessagePinned(threadConvId, msgMenu.message.id)}
          canEdit={canEditMessage(msgMenu.message)}
          onClose={() => setMsgMenu(null)}
          onAction={handleMessageAction}
        />
      )}

      {forwardMsg && (
        <ForwardMessageModal
          message={forwardMsg}
          targets={forwardTargets}
          onClose={() => setForwardMsg(null)}
          onForward={async (conversationId, label) => {
            const body = `↗ Переслано от @${forwardMsg.sender}:\n${forwardMsg.text || msgPreview(forwardMsg)}`;
            await messagesApi.send(conversationId, { text: body, type: forwardMsg.type === "image" ? "text" : forwardMsg.type, mediaUrl: forwardMsg.mediaUrl });
            toast(`Переслано в ${label}`);
          }}
        />
      )}

      {editingMsg && (
        <Modal title="Редактировать сообщение" onClose={() => setEditingMsg(null)}>
          <textarea
            className="field-box w-full min-h-[120px] text-[14px]"
            value={editDraft}
            maxLength={2000}
            onChange={(e) => setEditDraft(e.target.value)}
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setEditingMsg(null)}>Отмена</Button>
            <Button
              onClick={async () => {
                try {
                  await messagesApi.edit(editingMsg.id, editDraft.trim());
                  setMsgs((list) => list.map((x) => (x.id === editingMsg.id ? { ...x, text: editDraft.trim() } : x)));
                  setEditingMsg(null);
                  toast("Сообщение изменено");
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Не удалось изменить", true);
                }
              }}
            >
              Сохранить
            </Button>
          </div>
        </Modal>
      )}

      {confirmDialog && (
        <Modal title={confirmDialog.title} onClose={() => setConfirmDialog(null)}>
          <p className="text-[13px] text-ink-70 leading-relaxed">{confirmDialog.body}</p>
          <div className="flex justify-end gap-2 mt-5">
            <Button variant="ghost" onClick={() => setConfirmDialog(null)}>Отмена</Button>
            <Button
              variant="danger"
              onClick={async () => {
                const action = confirmDialog.action;
                setConfirmDialog(null);
                await action();
              }}
            >
              Подтвердить
            </Button>
          </div>
        </Modal>
      )}

      {reportTarget && (
        <ReportModal
          targetName={reportTarget.name}
          onClose={() => setReportTarget(null)}
          onSubmit={async ({ reason, description, files }) => {
            try {
              const urls: string[] = [];
              for (const file of files) {
                const up = await uploadFile(file, file.name, file.type);
                urls.push(up.url);
              }
              await messagesApi.report({
                targetType: reportTarget.type,
                targetId: reportTarget.id,
                reason,
                details: description,
                files: urls,
              });
              setReportTarget(null);
              toast("Жалоба отправлена модераторам");
            } catch (e) {
              toast(e instanceof Error ? e.message : "Не удалось отправить жалобу", true);
            }
          }}
        />
      )}
      {mediaView && (
        <MediaLightbox
          items={mediaView.items}
          index={mediaView.index}
          title={mediaView.title}
          onClose={() => setMediaView(null)}
          onIndex={(i) => setMediaView((v) => (v ? { ...v, index: i } : v))}
        />
      )}
    </div>
  );
}

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-magenta/40 text-paper rounded-[2px] px-0.5">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

function ChatPhoto({ src, onOpen }: { src: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="block w-full p-0 border-0 bg-transparent cursor-pointer">
      <span className="block w-full aspect-square overflow-hidden rounded-[4px] border border-line">
        <SmartImage src={src} alt="" fallback="фото" />
      </span>
    </button>
  );
}

function BlacklistCard({ text }: { text: string }) {
  const lines = text.split("\n").filter(Boolean);
  const formatted = lines.slice(1).map((line) => formatBlacklistCardLine(line));
  const lineMap = new Map(
    formatted
      .map((line) => {
        const i = line.indexOf(":");
        if (i === -1) return null;
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()] as const;
      })
      .filter(Boolean) as Array<readonly [string, string]>
  );
  const evidenceRaw = lineMap.get("Доказательства") || "";
  const evidenceItems = evidenceRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const evidenceImages = evidenceItems.filter((src) => /\.(png|jpe?g|webp|gif)$/i.test(src));
  const actionType = (lineMap.get("Тип") || "").toLowerCase();
  const title = actionType.includes("чёрный список")
    ? "В чёрном списке"
    : actionType.includes("авто")
      ? "Автоблокировка"
      : "Блокировка";
  const infoRows = [
    ["Пользователь", lineMap.get("Пользователь")],
    ["Причина", lineMap.get("Причина")],
    ["Кем", lineMap.get("Кем")],
    ["Когда", lineMap.get("Когда")],
    ["Риск", lineMap.get("Риск")],
    ["Комментарий", lineMap.get("Комментарий") || lineMap.get("Детали")],
    ["Срок", lineMap.get("Срок")],
  ].filter(([, value]) => value && value !== "—") as Array<[string, string]>;

  return (
    <div className="border border-magenta/40 bg-gradient-to-br from-[#2a1525]/95 via-[#1e1524] to-[#14141c] p-3 rounded-[6px] w-full">
      <div className="font-mono text-[10px] uppercase tracking-wide text-ink-45 mb-2">ALTER · Модерация</div>
      <div className="flex gap-2.5 items-start">
        <div className="flex-1 min-w-0">
          <h4 className="text-[15px] font-semibold leading-snug mb-2.5 text-paper flex items-center gap-1.5">
            <span className="text-[14px] leading-none opacity-90">⛔</span>
            {title}
          </h4>
          <dl className="space-y-2">
            {infoRows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] leading-none text-ink-45 mb-0.5">{label}</dt>
                <dd
                  className={cn(
                    "text-[12px] leading-[1.45] text-paper/95 m-0",
                    label === "Комментарий" && "line-clamp-3"
                  )}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="shrink-0 w-11 h-11 rounded-[6px] border border-magenta/25 bg-magenta/5 flex items-center justify-center text-[20px] leading-none opacity-80">
          🛡
        </div>
      </div>
      {evidenceItems.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-ink/20">
          <div className="text-[11px] text-ink-45 mb-1.5">Доказательства</div>
          {evidenceImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {evidenceImages.map((src) => (
                <a key={src} href={src} target="_blank" rel="noreferrer" className="block">
                  <span className="block w-20 h-20 overflow-hidden rounded-[4px] border border-magenta/30 bg-ink/30">
                    <SmartImage src={src} alt="Доказательство" fallback="доказательство" />
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MediaLightbox({
  items,
  index,
  title,
  onClose,
  onIndex,
}: {
  items: string[];
  index: number;
  title?: string;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const src = items[index];
  return (
    <div
      className="fixed inset-0 z-[90] bg-ink/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute top-4 right-4 w-10 h-10 bg-transparent border-0 text-paper hover:text-magenta z-10"
        onClick={onClose}
      >
        <X size={22} />
      </button>
      {items.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Назад"
            className="absolute left-3 sm:left-6 w-10 h-10 bg-stage/80 border border-line text-paper flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index - 1 + items.length) % items.length);
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Далее"
            className="absolute right-3 sm:right-6 w-10 h-10 bg-stage/80 border border-line text-paper flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index + 1) % items.length);
            }}
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}
      <div className="w-full max-w-[720px]" onClick={(e) => e.stopPropagation()}>
        {isRealSrc(src) ? (
          <img src={src} alt="" className="w-full max-h-[80vh] object-contain mx-auto" />
        ) : (
          <div className="w-full aspect-[4/5] max-h-[80vh] overflow-hidden">
            <SmartImage src={src} alt="" fallback={title || "фото"} />
          </div>
        )}
        <div className="text-center mt-3 font-mono text-[12px] text-ink-45">
          {title || "Фото"}
          {items.length > 1 ? ` · ${index + 1}/${items.length}` : ""}
        </div>
      </div>
    </div>
  );
}
