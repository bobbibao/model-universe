'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import TextField, { inputClassName } from '@/components/FormElements/TextField';
import ContactApi from '@/core/client/api/Contact';
import { useCurrentUser } from '@/shared/client/providers/CurrentUserProvider';
import type { ContactMessageInput } from '@/shared/types/contact';
import { useTranslations } from 'next-intl';
import AdminIcon from '@/components/Admin/AdminIcon';
import Link from '@/i18n/navigation';
import SuccessSignal from '@/components/SuccessSignal';
import { toast } from 'react-toastify';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_MESSAGE_LENGTH = 10;
const emptyForm: ContactMessageInput = { name: '', email: '', phone: '', company: '', message: '' };

type ContactErrors = Partial<Record<keyof ContactMessageInput, string>>;

const TOPICS = [
  { id: 'advice', label: 'Tư vấn chọn kit', prompt: 'Tôi cần tư vấn mẫu mô hình phù hợp theo ngân sách và sở thích: ' },
  { id: 'order', label: 'Kiểm tra đơn hàng', prompt: 'Tôi cần tra cứu tiến độ đơn hàng mã: ' },
  { id: 'service', label: 'Thu mua & Dịch vụ', prompt: 'Tôi cần định giá và kiểm định mô hình: ' },
  { id: 'partner', label: 'Hợp tác & Góp ý', prompt: 'Tôi muốn liên hệ hợp tác / đóng góp ý kiến về: ' },
];

const Contact = () => {
  const t = useTranslations('studioContent');
  const { user } = useCurrentUser();
  const [form, setForm] = useState<ContactMessageInput>(emptyForm);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setForm((current) => ({
        ...current,
        name: current.name || `${user.lastName} ${user.firstName}`.trim(),
        email: current.email || user.email,
        phone: current.phone || user.phone || '',
      }));
    }
  }, [user]);

  const update = (key: keyof ContactMessageInput) => (value: string) => setForm({ ...form, [key]: value });

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Đã sao chép ${label}: ${text}`, { toastId: `copy-${label}` });
    } catch {
      toast.info(text, { toastId: `copy-${label}` });
    }
  };

  const handleSelectTopic = (topicId: string, promptText: string) => {
    setSelectedTopic(topicId);
    if (!form.message || TOPICS.some((t) => form.message.startsWith(t.prompt))) {
      setForm((prev) => ({ ...prev, message: promptText }));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: ContactErrors = {};
    if (!form.name.trim()) nextErrors.name = t('nameError');
    if (!EMAIL_PATTERN.test(form.email.trim())) nextErrors.email = t('emailError');
    if (form.message.trim().length < MIN_MESSAGE_LENGTH) {
      nextErrors.message = t('messageError', { count: MIN_MESSAGE_LENGTH });
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSending(true);
    const ok = await ContactApi.sendMessage(form);
    setSending(false);
    if (ok) {
      setSent(true);
      setForm(emptyForm);
      setSelectedTopic(null);
    }
  };

  return (
    <div className="mu-wrap mu-section studio-contact-premium">
      {/* Top Banner: Status & Breadcrumb */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-strokedark">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <AdminIcon name="support" size={16} />
          <span>Model Universe / {t('contactEyebrow')}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Đang trực tuyến · Phản hồi trong 5-15 phút</span>
        </div>
      </div>

      <div className="studio-contact-grid">
        {/* Left Column: Communication Hub & Channels */}
        <div className="studio-contact-left space-y-5">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              {t('contactTitle')}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t('contactIntro')}
            </p>
          </div>

          {/* 2x2 Compact Channels Matrix */}
          <div className="contact-channels-matrix" role="region" aria-label={t('quickChannelsTitle')}>
            {/* 1. Phone / Hotline */}
            <div className="contact-tile is-phone">
              <div className="tile-icon-wrap" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <div className="tile-content">
                <span className="tile-label">{t('hotlineLabel')}</span>
                <a href="tel:+84373498729" className="tile-value" title={t('callNow')}>
                  0373 498 729
                </a>
                <span className="tile-hint">8:00 - 22:00 hàng ngày</span>
              </div>
              <div className="tile-actions">
                <a href="tel:+84373498729" className="tile-btn is-primary" title={t('callNow')}>
                  {t('callNow')}
                </a>
                <button
                  type="button"
                  className="tile-btn is-icon"
                  onClick={() => handleCopy('0373498729', 'Hotline')}
                  title={t('copyPhone')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 2. Zalo */}
            <div className="contact-tile is-zalo">
              <div className="tile-icon-wrap" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
                  <rect width="48" height="48" rx="12" fill="#0068FF" />
                  <path d="M12 30.5h10.8a1.2 1.2 0 0 0 1.2-1.2v-.6a1.2 1.2 0 0 0-1.2-1.2H16.6l7.1-9.6a1.2 1.2 0 0 0-.9-1.9H12.5a1.2 1.2 0 0 0-1.2 1.2v.6a1.2 1.2 0 0 0 1.2 1.2h6.2l-7.1 9.6a1.2 1.2 0 0 0 .9 1.9zM27 16h2.2a1.2 1.2 0 0 1 1.2 1.2v12.1a1.2 1.2 0 0 1-1.2 1.2H27a1.2 1.2 0 0 1-1.2-1.2V17.2A1.2 1.2 0 0 1 27 16zm6 0h4.5a4.5 4.5 0 0 1 4.5 4.5v5.5a4.5 4.5 0 0 1-4.5 4.5H33a1.2 1.2 0 0 1-1.2-1.2V17.2A1.2 1.2 0 0 1 33 16zm3.2 11.5h1.3a1.5 1.5 0 0 0 1.5-1.5v-5.5a1.5 1.5 0 0 0-1.5-1.5h-1.3v8.5z" fill="#FFFFFF" />
                </svg>
              </div>
              <div className="tile-content">
                <span className="tile-label">{t('zaloLabel')}</span>
                <span className="tile-value">0373 498 729</span>
                <span className="tile-hint">Tư vấn trực tiếp 1:1</span>
              </div>
              <div className="tile-actions">
                <a
                  href="https://zalo.me/0373498729"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tile-btn is-zalo"
                >
                  <span>{t('chatZalo')}</span>
                  <span>↗</span>
                </a>
              </div>
            </div>

            {/* 3. Messenger */}
            <div className="contact-tile is-messenger">
              <div className="tile-icon-wrap" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
                  <rect width="48" height="48" rx="12" fill="#0084FF" />
                  <path d="M24 10C16.268 10 10 15.803 10 22.96c0 4.074 2.036 7.717 5.23 10.09V38l4.74-2.601c1.3.36 2.671.555 4.03.555 7.732 0 14-5.803 14-12.96S31.732 10 24 10zm1.526 17.29-3.934-4.186-7.672 4.186 8.442-8.96 4.018 4.186 7.588-4.186-8.442 8.96z" fill="#FFFFFF" />
                </svg>
              </div>
              <div className="tile-content">
                <span className="tile-label">{t('messengerLabel')}</span>
                <span className="tile-value">Fanpage Chính Thức</span>
                <span className="tile-hint">Nhắn qua Facebook</span>
              </div>
              <div className="tile-actions">
                <a
                  href="https://m.me/modeluniverse.vn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tile-btn is-messenger"
                >
                  <span>Messenger</span>
                  <span>↗</span>
                </a>
              </div>
            </div>

            {/* 4. Official Email */}
            <div className="contact-tile is-email">
              <div className="tile-icon-wrap" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div className="tile-content">
                <span className="tile-label">Email hỗ trợ</span>
                <span className="tile-value truncate text-xs" title="lehoangbao5678@gmail.com">
                  lehoangbao5678@...
                </span>
                <span className="tile-hint">Phản hồi trong 2 giờ</span>
              </div>
              <div className="tile-actions">
                <button
                  type="button"
                  className="tile-btn is-icon"
                  onClick={() => handleCopy('lehoangbao5678@gmail.com', 'Email')}
                  title="Sao chép email"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Showroom & Operating Hours Card (Directly Visible) */}
          <div className="showroom-card rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-strokedark dark:bg-boxdark">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Showroom & Điểm tiếp nhận</h3>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Mở cửa đón khách</span>
                </div>
              </div>

              <a
                href="https://maps.google.com/?q=123+Van+Kiep+Phuong+3+Binh+Thanh+Ho+Chi+Minh"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition-colors hover:bg-purple-50 hover:text-purple-600 dark:bg-meta-4 dark:text-slate-300 dark:hover:text-purple-300"
              >
                <span>Chỉ đường</span>
                <span>↗</span>
              </a>
            </div>

            <div className="mt-3.5 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600 dark:border-strokedark dark:text-slate-300">
              <p className="flex items-center gap-2">
                <span className="font-semibold text-slate-800 dark:text-white">Địa chỉ:</span>
                <span>123 Vạn Kiếp, Phường 3, Quận Bình Thạnh, TP. Hồ Chí Minh</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="font-semibold text-slate-800 dark:text-white">Thời gian:</span>
                <span>08:00 - 22:00 (Tất cả các ngày trong tuần, kể cả ngày lễ)</span>
              </p>
            </div>
          </div>

          {/* AI Assistant Quick Pill */}
          <Link
            href="/assistant"
            className="flex items-center justify-between gap-3 rounded-2xl border border-purple-200/80 bg-gradient-to-r from-purple-50/60 to-indigo-50/40 p-4 transition-all hover:border-purple-300 hover:shadow-xs dark:border-purple-900/60 dark:bg-purple-950/20"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-600 text-white shadow-xs">
                <AdminIcon name="spark" size={20} />
              </div>
              <div>
                <strong className="block text-xs font-bold text-slate-900 dark:text-white">
                  {t('assistantTitle')}
                </strong>
                <small className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('assistantIntro')}
                </small>
              </div>
            </div>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Trò chuyện ngay ↗</span>
          </Link>
        </div>

        {/* Right Column: Contact Message Form */}
        <div className="studio-contact-right rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-strokedark dark:bg-boxdark sm:p-7">
          <div className="mb-5">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Gửi tin nhắn hoặc yêu cầu hỗ trợ
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('formHint')}
            </p>
          </div>

          {/* Topic Selector Chips */}
          <div className="mb-5">
            <span className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Chọn chủ đề bạn cần trao đổi:
            </span>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((topic) => {
                const isSelected = selectedTopic === topic.id;
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => handleSelectTopic(topic.id, topic.prompt)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-meta-4 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {topic.label}
                  </button>
                );
              })}
            </div>
          </div>

          {sent ? (
            <div className="py-12 text-center">
              <SuccessSignal />
              <h3 className="mb-2 mt-4 text-xl font-bold text-slate-900 dark:text-white" role="status">
                {t('thanks')}
              </h3>
              <p className="mb-6 text-xs text-slate-500 dark:text-slate-400">{t('reply')}</p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-purple-700"
              >
                {t('sendAnother')}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid grid-cols-1 gap-3.5 sm:grid-cols-2" noValidate>
              <TextField
                label={t('name')}
                name="name"
                autoComplete="name"
                value={form.name}
                onChange={(event) => update('name')(event.target.value)}
                error={errors.name}
              />
              <TextField
                label={t('company')}
                name="company"
                placeholder={t('optional')}
                autoComplete="organization"
                value={form.company}
                onChange={(event) => update('company')(event.target.value)}
              />
              <TextField
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => update('email')(event.target.value)}
                error={errors.email}
              />
              <TextField
                label={t('phone')}
                name="phone"
                type="tel"
                placeholder={t('optional')}
                autoComplete="tel"
                value={form.phone}
                onChange={(event) => update('phone')(event.target.value)}
              />

              <div className="sm:col-span-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="message" className="text-xs font-bold text-slate-800 dark:text-white">
                    {t('message')}
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {form.message.length} / 2000 ký tự
                  </span>
                </div>
                <textarea
                  id="message"
                  rows={4}
                  maxLength={2000}
                  className={`${inputClassName} ${errors.message ? 'border-danger' : ''} text-xs leading-relaxed`}
                  placeholder="Mô tả chi tiết câu hỏi, mã sản phẩm hoặc yêu cầu của bạn..."
                  value={form.message}
                  onChange={(event) => update('message')(event.target.value)}
                />
                {errors.message && <p className="mt-1 text-xs text-rose-500">{errors.message}</p>}
              </div>

              <button
                type="submit"
                disabled={sending}
                className="mu-button mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold disabled:opacity-60 sm:col-span-2"
              >
                {sending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>{t('sending')}</span>
                  </>
                ) : (
                  <span>{t('send')}</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Contact;
