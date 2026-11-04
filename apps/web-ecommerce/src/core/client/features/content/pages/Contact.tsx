'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import TextField, { inputClassName } from '@/components/FormElements/TextField';
import ContactApi from '@/core/client/api/Contact';
import { useCurrentUser } from '@/shared/client/providers/CurrentUserProvider';
import type { ContactMessageInput } from '@/shared/types/contact';
import { useTranslations } from 'next-intl';
import BrandLogo from '@/components/BrandLogo';
import SuccessSignal from '@/components/SuccessSignal';
import { showToast } from '@/shared/client/utils/toast';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_MESSAGE_LENGTH = 10;
const emptyForm: ContactMessageInput = { name: '', email: '', phone: '', company: '', message: '' };

type ContactErrors = Partial<Record<keyof ContactMessageInput, string>>;

const Contact = () => {
  const t = useTranslations('studioContent');
  const { user } = useCurrentUser();
  const [form, setForm] = useState<ContactMessageInput>(emptyForm);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

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
      showToast.success(`Đã sao chép ${label}: ${text}`, {
        toastId: `copy-${label}`,
        href: label === 'Email' ? `mailto:${text}` : undefined,
      });
    } catch {
      showToast.info(text, { toastId: `copy-${label}` });
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
    }
  };

  return (
    <div className="mu-wrap mu-section contact-clean-page">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14 items-start">
        {/* Left Column: Official Brand & Direct Information */}
        <div className="space-y-6">
          <div>
            <div className="mb-3">
              <BrandLogo href="/contact" showName={true} className="text-xl text-slate-900 dark:text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              {t('contactTitle')}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t('contactIntro')}
            </p>
          </div>

          {/* Clean Contact Information List */}
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:divide-strokedark dark:border-strokedark dark:bg-boxdark">
            {/* 1. Hotline */}
            <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
              <div className="flex items-center gap-3.5">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-meta-4 dark:text-slate-200">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {t('hotlineLabel')}
                  </span>
                  <a href="tel:+84373725104" className="text-sm font-bold text-slate-900 hover:underline dark:text-white sm:text-base">
                    0373 725 104
                  </a>
                  <span className="block text-xs text-slate-400">Hỗ trợ 08:00 - 22:00</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="tel:+84373725104"
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                >
                  {t('callNow')}
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy('0373725104', 'Hotline')}
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 dark:border-strokedark dark:text-slate-400 dark:hover:bg-meta-4"
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
            <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
              <div className="flex items-center gap-3.5">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-meta-4 dark:text-slate-200">
                  <span className="text-xs font-extrabold tracking-tighter">ZALO</span>
                </div>
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {t('zaloLabel')}
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white sm:text-base">
                    0373 725 104
                  </span>
                  <span className="block text-xs text-slate-400">Tư vấn trực tiếp 1:1</span>
                </div>
              </div>
              <a
                href="https://zalo.me/0373725104"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-strokedark dark:text-slate-200 dark:hover:bg-meta-4"
              >
                <span>{t('chatZalo')}</span>
                <span>↗</span>
              </a>
            </div>

            {/* 3. Facebook & Messenger */}
            <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
              <div className="flex items-center gap-3.5">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-meta-4 dark:text-slate-200">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {t('messengerLabel')}
                  </span>
                  <a
                    href="https://www.facebook.com/modeluniverse.vn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-slate-900 hover:underline dark:text-white sm:text-base"
                  >
                    Model Universe
                  </a>
                  <span className="block text-xs text-slate-400">Fanpage Facebook chính thức</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://www.facebook.com/modeluniverse.vn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-strokedark dark:text-slate-200 dark:hover:bg-meta-4"
                >
                  <span>Fanpage</span>
                  <span>↗</span>
                </a>
                <a
                  href="https://m.me/modeluniverse.vn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                >
                  <span>{t('chatMessenger')}</span>
                  <span>↗</span>
                </a>
              </div>
            </div>

            {/* 4. TikTok */}
            <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
              <div className="flex items-center gap-3.5">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-meta-4 dark:text-slate-200">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                  </svg>
                </div>
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Kênh TikTok
                  </span>
                  <a
                    href="https://www.tiktok.com/@model.universe.c"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-slate-900 hover:underline dark:text-white sm:text-base"
                  >
                    @model.universe.c
                  </a>
                  <span className="block text-xs text-slate-400">Video unbox & giới thiệu kit</span>
                </div>
              </div>
              <a
                href="https://www.tiktok.com/@model.universe.c"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-strokedark dark:text-slate-200 dark:hover:bg-meta-4"
              >
                <span>Xem TikTok</span>
                <span>↗</span>
              </a>
            </div>

            {/* 5. Email liên hệ */}
            <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
              <div className="flex items-center gap-3.5 min-w-0 pr-2">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-meta-4 dark:text-slate-200">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Email liên hệ & Hợp tác
                  </span>
                  <a
                    href="mailto:contact@modeluniverse.vn"
                    className="block truncate text-sm font-bold text-slate-900 hover:underline dark:text-white"
                  >
                    contact@modeluniverse.vn
                  </a>
                  <span className="block text-xs text-slate-400">Đối tác, ký gửi & khiếu nại</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('contact@modeluniverse.vn', 'Email liên hệ')}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 dark:border-strokedark dark:text-slate-400 dark:hover:bg-meta-4"
                title="Sao chép email"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>

            {/* 6. Email hỗ trợ khách hàng */}
            <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
              <div className="flex items-center gap-3.5 min-w-0 pr-2">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-meta-4 dark:text-slate-200">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Email hỗ trợ khách hàng
                  </span>
                  <a
                    href="mailto:support@modeluniverse.vn"
                    className="block truncate text-sm font-bold text-slate-900 hover:underline dark:text-white"
                  >
                    support@modeluniverse.vn
                  </a>
                  <span className="block text-xs text-slate-400">Đơn hàng, bảo hành & hoàn tiền</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('support@modeluniverse.vn', 'Email hỗ trợ')}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 dark:border-strokedark dark:text-slate-400 dark:hover:bg-meta-4"
                title="Sao chép email"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          </div>

          {/* Showroom & Operating Hours */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-strokedark dark:bg-boxdark sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-strokedark">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Showroom & Điểm tiếp nhận trực tiếp</h3>
              <a
                href="https://maps.google.com/?q=730/126+Le+Duc+Tho+An+Hoi+Dong+Ho+Chi+Minh"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Bản đồ ↗
              </a>
            </div>
            <div className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <p>
                <strong className="text-slate-900 dark:text-white">Địa chỉ: </strong>
                730/126 Đ. Lê Đức Thọ, An Hội Đông, Hồ Chí Minh, Việt Nam
              </p>
              <p>
                <strong className="text-slate-900 dark:text-white">Giờ mở cửa: </strong>
                08:00 - 22:00 hàng ngày (kể cả Thứ 7, Chủ Nhật và ngày Lễ)
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Clean, Straightforward Contact Form */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-strokedark dark:bg-boxdark sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Gửi tin nhắn trực tiếp
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Điền thông tin bên dưới, chúng tôi sẽ phản hồi trong thời gian sớm nhất.
            </p>
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
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                {t('sendAnother')}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
              <TextField
                label={t('name')}
                name="name"
                autoComplete="name"
                value={form.name}
                onChange={(event) => update('name')(event.target.value)}
                error={errors.name}
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
              <TextField
                label={t('company')}
                name="company"
                placeholder={t('optional')}
                autoComplete="organization"
                value={form.company}
                onChange={(event) => update('company')(event.target.value)}
              />

              <div className="sm:col-span-2">
                <label htmlFor="message" className="mb-1.5 block text-xs font-bold text-slate-800 dark:text-white">
                  {t('message')}
                </label>
                <textarea
                  id="message"
                  rows={5}
                  maxLength={2000}
                  className={`${inputClassName} ${errors.message ? 'border-danger' : ''} text-xs leading-relaxed`}
                  placeholder="Nhập nội dung tin nhắn hoặc yêu cầu của bạn..."
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
