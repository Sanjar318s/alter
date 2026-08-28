"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { cn } from "@/lib/cn";
import type { PlatformRole } from "@/lib/AuthContext";

const SOCIAL_PLATFORMS = ["telegram", "youtube", "instagram", "tiktok", "vk"] as const;

function socialPlatforms(socials: { platform: string; url: string }[]) {
  const extras = socials
    .map((s) => s.platform)
    .filter((p) => !(SOCIAL_PLATFORMS as readonly string[]).includes(p));
  return [...new Set([...SOCIAL_PLATFORMS, ...extras])];
}

type MePersonalInfoFormProps = {
  nick: string;
  display: string;
  city: string;
  langs: string;
  email: string;
  phone: string;
  bio: string;
  dob: string;
  showAge: boolean;
  role: PlatformRole | null | undefined;
  socials: { platform: string; url: string }[];
  dirty: boolean;
  isClient: boolean;
  proSettings?: React.ReactNode;
  onNickChange: (v: string) => void;
  onDisplayChange: (v: string) => void;
  onCityChange: (v: string) => void;
  onLangsChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onBioChange: (v: string) => void;
  onDobChange: (v: string) => void;
  onShowAgeChange: (v: boolean) => void;
  onSocialsChange: (socials: { platform: string; url: string }[]) => void;
  onSave: (socialsOverride?: { platform: string; url: string }[]) => void;
  onReset: () => void;
};

const ROLE_LABELS: Record<string, string> = {
  client: "Клиент",
  blogger: "Блогер",
  seller: "Продавец",
};

export function MePersonalInfoForm({
  nick,
  display,
  city,
  langs,
  email,
  phone,
  bio,
  dob,
  showAge,
  role,
  socials,
  dirty,
  isClient,
  proSettings,
  onNickChange,
  onDisplayChange,
  onCityChange,
  onLangsChange,
  onPhoneChange,
  onBioChange,
  onDobChange,
  onShowAgeChange,
  onSocialsChange,
  onSave,
  onReset,
}: MePersonalInfoFormProps) {
  const [editingSocial, setEditingSocial] = useState<string | null>(null);
  const [socialDraft, setSocialDraft] = useState("");

  function getSocialUrl(platform: string) {
    return socials.find((s) => s.platform === platform)?.url ?? "";
  }

  function setSocialUrl(platform: string, url: string) {
    const next = socials.filter((s) => s.platform !== platform);
    if (url.trim()) next.push({ platform, url: url.trim() });
    onSocialsChange(next);
  }

  function openSocialEdit(platform: string) {
    setEditingSocial(platform);
    setSocialDraft(getSocialUrl(platform));
  }

  function commitSocialEdit() {
    if (editingSocial) setSocialUrl(editingSocial, socialDraft);
    setEditingSocial(null);
    setSocialDraft("");
  }

  function handleSave() {
    let nextSocials = socials;
    if (editingSocial) {
      nextSocials = socials.filter((s) => s.platform !== editingSocial);
      if (socialDraft.trim()) {
        nextSocials = [...nextSocials, { platform: editingSocial, url: socialDraft.trim() }];
      }
      onSocialsChange(nextSocials);
      setEditingSocial(null);
      setSocialDraft("");
    }
    onSave(nextSocials);
  }

  const socialPending =
    editingSocial !== null && socialDraft.trim() !== getSocialUrl(editingSocial).trim();
  const canSave = dirty || socialPending;

  return (
    <section>
      <h3 className="me-form-section-title">Личная информация</h3>
      <div className="me-form-grid">
        <div className="me-form-field">
          <label>Ник {nick.length}/20</label>
          <input
            className="field-box"
            maxLength={20}
            value={nick}
            onChange={(e) => onNickChange(e.target.value)}
          />
        </div>
        <div className="me-form-field">
          <label>Город</label>
          <input className="field-box" value={city} onChange={(e) => onCityChange(e.target.value)} />
        </div>
        <div className="me-form-field">
          <label>Роль</label>
          <div className="field-box flex items-center text-[14px] text-paper">
            {role ? ROLE_LABELS[role] ?? role : "Не выбрана"}
          </div>
        </div>
        <div className="me-form-field">
          <label>Язык</label>
          <input className="field-box" value={langs} onChange={(e) => onLangsChange(e.target.value)} />
        </div>
        <div className="me-form-field">
          <label>Имя</label>
          <input className="field-box" value={display} onChange={(e) => onDisplayChange(e.target.value)} />
        </div>
        <div className="me-form-field">
          <label>Email</label>
          <input className="field-box" value={email} disabled />
        </div>
        <div className="me-form-field">
          <label>Телефон</label>
          <input className="field-box" value={phone} onChange={(e) => onPhoneChange(e.target.value)} />
        </div>
        <div className="me-form-field">
          <label>Дата рождения</label>
          <input type="date" className="field-box" value={dob} onChange={(e) => onDobChange(e.target.value)} />
          <label className="flex items-center gap-2 mt-2 text-[12px] text-ink-70 cursor-pointer">
            <input
              type="checkbox"
              checked={showAge}
              onChange={(e) => onShowAgeChange(e.target.checked)}
            />
            Показывать возраст
          </label>
        </div>
        <div className="me-form-field me-form-grid-full">
          <label>Bio {bio.length}/500</label>
          <textarea
            className="field-box min-h-[100px] resize-y"
            maxLength={500}
            rows={4}
            value={bio}
            onChange={(e) => onBioChange(e.target.value)}
          />
        </div>
        <div className="me-form-field me-form-grid-full">
          <label>Соцсети</label>
          <div className="me-social-row">
            {socialPlatforms(socials).map((platform) => {
              const hasUrl = Boolean(getSocialUrl(platform));
              return (
                <button
                  key={platform}
                  type="button"
                  className={cn("me-social-chip", hasUrl && "me-social-chip--active")}
                  onClick={() => openSocialEdit(platform)}
                >
                  <BrandIcon name={platform} />
                  <span className="capitalize">{platform}</span>
                </button>
              );
            })}
          </div>
          {editingSocial && (
            <div className="flex gap-2 mt-2">
              <input
                className="field-box flex-1"
                placeholder={`Ссылка ${editingSocial}`}
                value={socialDraft}
                onChange={(e) => setSocialDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && commitSocialEdit()}
              />
              <Button type="button" size="sm" onClick={commitSocialEdit}>
                OK
              </Button>
            </div>
          )}
        </div>
      </div>

      {proSettings}

      <div className="flex flex-wrap gap-2 mt-6">
        <Button disabled={!canSave} onClick={handleSave}>
          Сохранить изменения
        </Button>
        <Button variant="outline" onClick={onReset}>
          Сбросить
        </Button>
      </div>
      {isClient && (
        <p className="text-[12px] text-ink-45 mt-3">
          Смена роли — через заявку во вкладке «Безопасность».
        </p>
      )}
    </section>
  );
}
