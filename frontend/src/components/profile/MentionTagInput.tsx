"use client";

import { useState } from "react";
import { X } from "lucide-react";

const SUGGEST_USERS = ["luna.s", "raiden.photo", "victor.maker", "forge.atelier"];

export type MentionChip = { id: string; displayName: string; type: "user" | "person"; username?: string };

export function MentionTagInput({
  tags,
  mentions,
  onTagsChange,
  onMentionsChange,
}: {
  tags: string[];
  mentions: MentionChip[];
  onTagsChange: (tags: string[]) => void;
  onMentionsChange: (mentions: MentionChip[]) => void;
}) {
  const [tagInput, setTagInput] = useState("");
  const [mentionInput, setMentionInput] = useState("");
  const [personInput, setPersonInput] = useState("");

  function addTag(raw: string) {
    const t = raw.replace(/^#/, "").trim().toLowerCase();
    if (t && !tags.includes(t)) onTagsChange([...tags, t]);
    setTagInput("");
  }

  function addMention(username: string) {
    if (mentions.some((m) => m.username === username)) return;
    onMentionsChange([
      ...mentions,
      { id: `m-${Date.now()}`, displayName: username, type: "user", username },
    ]);
    setMentionInput("");
  }

  function addPerson(name: string) {
    const n = name.trim();
    if (!n) return;
    onMentionsChange([
      ...mentions,
      { id: `p-${Date.now()}`, displayName: n, type: "person" },
    ]);
    setPersonInput("");
  }

  const filteredUsers = SUGGEST_USERS.filter(
    (u) => u.includes(mentionInput.replace("@", "").toLowerCase()) && !mentions.some((m) => m.username === u)
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-[12px] text-ink-45">Теги</label>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 font-mono text-[10px] uppercase px-2 py-1 border border-magenta/40 text-magenta rounded-[4px]">
              #{t}
              <button type="button" className="bg-transparent border-0 text-ink-45 p-0" onClick={() => onTagsChange(tags.filter((x) => x !== t))}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <input
          className="field-box mt-2 text-[13px]"
          placeholder="#genshin — Enter"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(tagInput);
            }
          }}
        />
      </div>

      <div>
        <label className="text-[12px] text-ink-45">Отметить пользователя</label>
        <input
          className="field-box mt-1.5 text-[13px]"
          placeholder="@username"
          value={mentionInput}
          onChange={(e) => setMentionInput(e.target.value)}
        />
        {mentionInput.length > 0 && filteredUsers.length > 0 && (
          <div className="mt-1 border border-line bg-ink">
            {filteredUsers.map((u) => (
              <button
                key={u}
                type="button"
                className="block w-full text-left px-3 py-2 text-[13px] hover:bg-stage bg-transparent border-0 text-magenta"
                onClick={() => addMention(u)}
              >
                @{u}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {mentions.filter((m) => m.type === "user").map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 text-[12px] px-2 py-1 bg-stage border border-line rounded-[4px]">
              @{m.username}
              <button type="button" className="bg-transparent border-0 text-ink-45 p-0" onClick={() => onMentionsChange(mentions.filter((x) => x.id !== m.id))}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[12px] text-ink-45">Имя без аккаунта</label>
        <div className="flex gap-2 mt-1.5">
          <input
            className="field-box flex-1 text-[13px]"
            placeholder="Иван (фотограф)"
            value={personInput}
            onChange={(e) => setPersonInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addPerson(personInput);
              }
            }}
          />
          <button type="button" className="px-3 py-2 border border-line text-[12px] bg-transparent text-paper" onClick={() => addPerson(personInput)}>
            Добавить
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {mentions.filter((m) => m.type === "person").map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 text-[12px] px-2 py-1 bg-stage border border-line rounded-[4px]">
              {m.displayName}
              <button type="button" className="bg-transparent border-0 text-ink-45 p-0" onClick={() => onMentionsChange(mentions.filter((x) => x.id !== m.id))}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
