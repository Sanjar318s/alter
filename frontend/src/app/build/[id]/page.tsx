"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Flag, Heart, MessageCircle, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CommentThread } from "@/components/comments/CommentThread";
import { BuildGallery } from "@/components/builds/BuildGallery";
import { CreateBuildModal } from "@/components/builds/CreateBuildModal";
import { CommissionRequestForm } from "@/components/orders/CommissionRequestForm";
import { Modal } from "@/components/ui/Modal";
import { formatCount } from "@/lib/format";
import { SmartImage } from "@/components/media/SmartImage";
import { builds as buildsApi, commissions, messages as messagesApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/AuthContext";

export default function BuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  async function load() {
    try {
      setError("");
      setData(await buildsApi.get(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не найдено");
      setData(null);
    }
  }
  useEffect(() => {
    load();
  }, [id]);

  if (error && !data) {
    return (
      <div className="pt-16 px-6 max-w-[640px] mx-auto text-center">
        <h1 className="font-display font-extrabold text-[28px]">Работа не найдена</h1>
        <p className="text-ink-70 mt-2">{error}</p>
        <Button href="/explore" className="mt-6">Вернуться в Explore</Button>
      </div>
    );
  }
  if (!data) return <div className="pt-16 px-6 font-mono text-ink-45">Загрузка…</div>;

  const b = data.build;
  const photos = (data.photos || []).map((p: any) => p.imageUrl).filter(Boolean);
  if (b.coverImageUrl && !photos.includes(b.coverImageUrl)) photos.unshift(b.coverImageUrl);
  const liked = data.liked;
  const isOwner = data.isOwner;

  async function like() {
    try {
      const res = liked ? await buildsApi.unlike(id) : await buildsApi.like(id);
      setData((d: any) => ({ ...d, liked: res.liked, build: { ...d.build, likesCount: res.likesCount } }));
    } catch {
      setData((d: any) => ({ ...d, liked: !liked, build: { ...d.build, likesCount: (d.build.likesCount || 0) + (liked ? -1 : 1) } }));
    }
  }

  return (
    <div className="pt-10 px-4 sm:px-6 lg:px-8 pb-20 max-w-[1240px] mx-auto min-w-0">
      <Link href="/explore" className="inline-flex items-center gap-2 text-[13px] text-ink-45 no-underline mb-6 hover:text-paper">
        <ArrowLeft size={16} /> Исследовать
      </Link>
      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-10">
        <BuildGallery
          photos={photos}
          title={b.character || b.title}
          makerUsername={data.author?.username}
        />
        <div>
          {b.commissionStatus && <Badge status={b.commissionStatus} />}
          <h1 className="font-display font-extrabold text-[clamp(24px,5vw,36px)] mt-3">{b.character || b.title}</h1>
          <div className="font-mono text-[12px] text-ink-45 uppercase mt-1">
            {b.franchise} {b.year ? `· ${b.year}` : ""}
          </div>
          {data.author && (
            <Link href={`/profile/${data.author.username}`} className="flex items-center gap-2.5 mt-4 no-underline text-paper hover:text-magenta">
              <span className="w-10 h-10 shrink-0 overflow-hidden border border-line">
                <SmartImage src={data.author.avatarUrl} alt={data.author.username} fallback={data.author.username} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] truncate">{data.author.displayName || data.author.username}</span>
                <span className="block text-[12px] text-ink-45">@{data.author.username}</span>
              </span>
            </Link>
          )}
          {b.description && <p className="text-[14px] text-ink-70 mt-4 whitespace-pre-wrap">{b.description}</p>}
          <div className="flex gap-3 mt-6">
            <Button variant="outline" size="sm" onClick={like}>
              <Heart size={14} className="mr-1" /> {formatCount(b.likesCount || 0)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
                toast("Ссылка скопирована");
              }}
            >
              <Share2 size={14} className="mr-1" /> Поделиться
            </Button>
          </div>
          {isOwner && (
            <div className="mt-6 border border-line p-4">
              <div className="font-mono text-[11px] uppercase text-ink-45 mb-3">Управление работой</div>
              <div className="flex flex-col gap-2">
                <Button size="sm" onClick={() => setEdit(true)}>Редактировать</Button>
                <Button size="sm" variant="outline" onClick={async () => {
                  await buildsApi.update(id, { hidden: !b.hidden, photos: (data.photos || []).map((p: any) => ({ imageUrl: p.imageUrl })) });
                  load();
                }}>{b.hidden ? "Показать" : "Скрыть"} в Explore</Button>
                <Button size="sm" variant="danger" onClick={async () => {
                  if (!confirm("Удалить работу? Это нельзя отменить.")) return;
                  await buildsApi.remove(id);
                  router.push(`/profile/${user?.username}`);
                }}>Удалить работу</Button>
              </div>
            </div>
          )}
          {!isOwner && b.commissionStatus === "open" && data.author && (
            <Button className="mt-6 w-full" onClick={() => setRequestOpen(true)}>Хочу такой же</Button>
          )}
          {!isOwner && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={async () => {
              await messagesApi.report({ targetType: "build", targetId: id, reason: "abuse" });
              toast("Жалоба отправлена модераторам");
            }}>
              <Flag size={14} className="mr-1" /> Пожаловаться
            </Button>
          )}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3 text-[13px] text-ink-45">
              <MessageCircle size={14} /> Комментарии
            </div>
            <CommentThread targetType="build" targetId={id} />
          </div>
        </div>
      </div>
      {edit && (
        <CreateBuildModal
          initial={{ ...b, photos: data.photos }}
          onClose={() => setEdit(false)}
          onSaved={load}
        />
      )}
      {requestOpen && data.author && (
        <Modal title="Заявка на коммишен" onClose={() => setRequestOpen(false)}>
          <BuildCommissionForm
            authorId={data.author.id}
            character={b.character}
            buildUrl={typeof window !== "undefined" ? window.location.href : ""}
            onClose={() => setRequestOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}

function BuildCommissionForm({
  authorId,
  character,
  buildUrl,
  onClose,
}: {
  authorId: string;
  character?: string;
  buildUrl: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [commissionId, setCommissionId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    commissions
      .list()
      .then((r) => {
        const mine = (r.commissions || []).find((c: any) => c.makerId === authorId) || (r.commissions || [])[0];
        if (!mine) setError("У автора нет открытой комиссии");
        else setCommissionId(mine.id);
      })
      .catch((e) => setError(e.message));
  }, [authorId]);

  if (error) return <p className="text-[13px] text-amber">{error}</p>;
  if (!commissionId) return <p className="font-mono text-[12px] text-ink-45">Загрузка…</p>;
  return (
    <CommissionRequestForm
      commissionId={commissionId}
      characterDefault={character}
      extraNotes={buildUrl ? `Работа: ${buildUrl}` : undefined}
      onClose={onClose}
    />
  );
}
