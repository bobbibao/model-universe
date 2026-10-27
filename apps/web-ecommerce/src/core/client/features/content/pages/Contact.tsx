'use client';

import { FormEvent, useEffect, useState } from 'react';
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

const Contact = () => {
  const t = useTranslations('studioContent');
  const { user } = useCurrentUser();
  const [form, setForm] = useState<ContactMessageInput>(emptyForm);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Signed-in customers do not have to type their details again.
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

  const handleCopyPhone = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText('0373498729');
      toast.success(t('copiedPhoneToast', { phone: '0373 498 729' }), { toastId: 'copy-phone' });
    } catch {
      toast.info('0373 498 729', { toastId: 'copy-phone' });
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
    <div className="mu-wrap mu-section studio-contact">
      <div className="studio-contact-copy">
        <p className="studio-kicker">
          <AdminIcon name="support" size={17} /> MODEL UNIVERSE / {t('contactEyebrow')}
        </p>
        <h1>{t('contactTitle')}</h1>
        <p className="studio-hero-intro">{t('contactIntro')}</p>

        {/* Quick Direct Contacts: Hotline, Zalo, Messenger */}
        <div className="studio-contact-channels" role="region" aria-label={t('quickChannelsTitle')}>
          {/* 1. Phone / Hotline */}
          <div className="studio-channel-card is-phone">
            <div className="channel-icon-wrap" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div className="channel-info">
              <span className="channel-label">{t('hotlineLabel')}</span>
              <a href="tel:+84373498729" className="channel-value" title={t('callNow')}>
                0373 498 729
              </a>
              <small className="channel-desc">{t('hotlineDesc')}</small>
            </div>
            <div className="channel-actions">
              <a href="tel:+84373498729" className="channel-action-btn is-call" title={t('callNow')}>
                <span>{t('callNow')}</span>
              </a>
              <button
                type="button"
                className="channel-copy-btn"
                onClick={handleCopyPhone}
                title={t('copyPhone')}
                aria-label={t('copyPhone')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          </div>

          {/* 2. Zalo */}
          <a
            href="https://zalo.me/0373498729"
            target="_blank"
            rel="noopener noreferrer"
            className="studio-channel-card is-zalo"
            title={`${t('chatZalo')} - 0373 498 729`}
          >
            <div className="channel-icon-wrap" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="#0068FF" />
                <path d="M12 30.5h10.8a1.2 1.2 0 0 0 1.2-1.2v-.6a1.2 1.2 0 0 0-1.2-1.2H16.6l7.1-9.6a1.2 1.2 0 0 0-.9-1.9H12.5a1.2 1.2 0 0 0-1.2 1.2v.6a1.2 1.2 0 0 0 1.2 1.2h6.2l-7.1 9.6a1.2 1.2 0 0 0 .9 1.9zM27 16h2.2a1.2 1.2 0 0 1 1.2 1.2v12.1a1.2 1.2 0 0 1-1.2 1.2H27a1.2 1.2 0 0 1-1.2-1.2V17.2A1.2 1.2 0 0 1 27 16zm6 0h4.5a4.5 4.5 0 0 1 4.5 4.5v5.5a4.5 4.5 0 0 1-4.5 4.5H33a1.2 1.2 0 0 1-1.2-1.2V17.2A1.2 1.2 0 0 1 33 16zm3.2 11.5h1.3a1.5 1.5 0 0 0 1.5-1.5v-5.5a1.5 1.5 0 0 0-1.5-1.5h-1.3v8.5z" fill="#FFFFFF" />
              </svg>
            </div>
            <div className="channel-info">
              <span className="channel-label">{t('zaloLabel')}</span>
              <strong className="channel-value">0373 498 729</strong>
              <small className="channel-desc">{t('zaloDesc')}</small>
            </div>
            <div className="channel-actions">
              <span className="channel-action-btn is-zalo">
                <span>{t('chatZalo')}</span>
                <span aria-hidden="true">↗</span>
              </span>
            </div>
          </a>

          {/* 3. Messenger */}
          <a
            href="https://m.me/modeluniverse.vn"
            target="_blank"
            rel="noopener noreferrer"
            className="studio-channel-card is-messenger"
            title={`${t('chatMessenger')} - Facebook Messenger`}
          >
            <div className="channel-icon-wrap" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="#0084FF" />
                <path d="M24 10C16.268 10 10 15.803 10 22.96c0 4.074 2.036 7.717 5.23 10.09V38l4.74-2.601c1.3.36 2.671.555 4.03.555 7.732 0 14-5.803 14-12.96S31.732 10 24 10zm1.526 17.29-3.934-4.186-7.672 4.186 8.442-8.96 4.018 4.186 7.588-4.186-8.442 8.96z" fill="#FFFFFF" />
              </svg>
            </div>
            <div className="channel-info">
              <span className="channel-label">{t('messengerLabel')}</span>
              <strong className="channel-value">MODEL UNIVERSE</strong>
              <small className="channel-desc">{t('messengerDesc')}</small>
            </div>
            <div className="channel-actions">
              <span className="channel-action-btn is-messenger">
                <span>{t('chatMessenger')}</span>
                <span aria-hidden="true">↗</span>
              </span>
            </div>
          </a>
        </div>

        <Link href="/assistant" className="studio-contact-assistant">
          <AdminIcon name="spark" size={26} />
          <span>
            <strong>{t('assistantTitle')}</strong>
            <small>{t('assistantIntro')}</small>
          </span>
          <span aria-hidden="true">↗</span>
        </Link>
        <details className="service-terms mt-6">
          <summary>{t('office')}</summary>
          <div className="service-terms-content">
            <p>123 Vạn Kiếp, Phường 3, Quận Bình Thạnh, TP. Hồ Chí Minh</p>
            <a href="tel:+84373498729">+84 373 498 729 (Hotline)</a>
            <a href="https://zalo.me/0373498729" target="_blank" rel="noopener noreferrer">Zalo: 0373 498 729</a>
            <a href="https://m.me/modeluniverse.vn" target="_blank" rel="noopener noreferrer">Messenger: m.me/modeluniverse.vn</a>
            <a href="mailto:lehoangbao5678@gmail.com">lehoangbao5678@gmail.com</a>
          </div>
        </details>
      </div>

      <div className="mu-panel studio-contact-form p-6 sm:p-8">
        <div className="studio-contact-hint mb-5">
          <AdminIcon name="spark" size={17} />
          <span>{t('formHint')}</span>
        </div>
        {sent ? (
          <div className="py-10 text-center">
            <SuccessSignal />
            <p className="mb-2 text-2xl font-semibold" role="status">
              {t('thanks')}
            </p>
            <p className="mb-6 text-body dark:text-store-muted">{t('reply')}</p>
            <button onClick={() => setSent(false)} className="font-medium text-brand-hover hover:underline">
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
              <label htmlFor="message" className="mb-2 block text-sm font-medium text-black dark:text-white">
                {t('message')}
              </label>
              <textarea
                id="message"
                rows={5}
                maxLength={2000}
                className={`${inputClassName} ${errors.message ? 'border-danger' : ''}`}
                value={form.message}
                onChange={(event) => update('message')(event.target.value)}
              />
              {errors.message && <p className="mt-1 text-sm text-danger">{errors.message}</p>}
            </div>
            <button type="submit" disabled={sending} className="mu-button disabled:opacity-60 sm:col-span-2">
              {t(sending ? 'sending' : 'send')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Contact;
