'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import TextField, { inputClassName } from '@/components/FormElements/TextField';
import SuccessSignal from '@/components/SuccessSignal';
import AdminIcon from '@/components/Admin/AdminIcon';
import ContactIcon from '@/components/Contact/ContactIcon';
import { isShopOpen } from '@/components/Contact/openingHours';
import ContactApi from '@/core/client/api/Contact';
import { useCurrentUser } from '@/shared/client/providers/CurrentUserProvider';
import { showToast } from '@/shared/client/utils/toast';
import { CONTACT } from '@/shared/contact-channels';
import type { ContactMessageInput } from '@/shared/types/contact';
import '@/components/Contact/contact.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_MESSAGE_LENGTH = 10;
const emptyForm: ContactMessageInput = { name: '', email: '', phone: '', company: '', message: '' };
const TOPICS = ['topicAdviceTitle', 'topicOrderTitle', 'topicServiceTitle', 'topicPartnerTitle', 'topicOther'] as const;
type Topic = (typeof TOPICS)[number];

type ContactErrors = Partial<Record<keyof ContactMessageInput, string>>;

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

const Contact = () => {
  const t = useTranslations('studioContent');
  const c = useTranslations('contactHub');
  const { user } = useCurrentUser();
  const [form, setForm] = useState<ContactMessageInput>(emptyForm);
  const [topic, setTopic] = useState<Topic>('topicAdviceTitle');
  const [errors, setErrors] = useState<ContactErrors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  // Computed after hydration: the server does not know the visitor's clock.
  const [open, setOpen] = useState<boolean>();

  useEffect(() => {
    setOpen(isShopOpen());
    const timer = setInterval(() => setOpen(isShopOpen()), 60_000);
    return () => clearInterval(timer);
  }, []);

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

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast.success(c('copied', { value }), { toastId: `copy-${value}` });
    } catch {
      showToast.info(value, { toastId: `copy-${value}` });
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
    // The topic travels as the first line of the message, so the admin inbox shows it without a schema change.
    const ok = await ContactApi.sendMessage({ ...form, message: `[${c(topic)}] ${form.message.trim()}` });
    setSending(false);
    if (ok) {
      setSent(true);
      setForm(emptyForm);
    }
  };

  const channels = [
    {
      icon: 'phone',
      label: c('hotline'),
      value: CONTACT.phoneDisplay,
      note: c('hotlineNote'),
      href: CONTACT.tel,
      copy: CONTACT.phoneDisplay,
    },
    {
      icon: 'zalo',
      label: c('zalo'),
      value: CONTACT.phoneDisplay,
      note: c('zaloNote'),
      href: CONTACT.zalo,
      external: true,
    },
    {
      icon: 'messenger',
      label: c('messenger'),
      value: 'Model Universe',
      note: c('messengerNote'),
      href: CONTACT.messenger,
      external: true,
    },
    {
      icon: 'tiktok',
      label: c('tiktok'),
      value: CONTACT.tiktokHandle,
      note: c('tiktokNote'),
      href: CONTACT.tiktok,
      external: true,
    },
    {
      icon: 'mail',
      label: c('supportEmail'),
      value: CONTACT.supportEmail,
      note: c('supportEmailNote'),
      href: `mailto:${CONTACT.supportEmail}`,
      copy: CONTACT.supportEmail,
    },
    {
      icon: 'mail',
      label: c('email'),
      value: CONTACT.email,
      note: c('emailNote'),
      href: `mailto:${CONTACT.email}`,
      copy: CONTACT.email,
    },
  ] as const;

  return (
    <div className="mu-wrap ch-page">
      <section className="ch-hero" aria-labelledby="contact-title">
        <div className="ch-hero-copy">
          <p className="ch-eyebrow">{c('eyebrow')}</p>
          <h1 id="contact-title">{c('heroTitle')}</h1>
          <p className="ch-hero-intro">{c('heroIntro')}</p>
          <p className="ch-status" data-open={open === undefined ? undefined : String(open)}>
            <span className="ch-status-dot" aria-hidden="true" />
            {open === false ? c('closedNow') : open ? c('openNow') : null}
            <span className="ch-status-hours">
              <ContactIcon name="clock" size={14} />
              {c('openHours', { hours: CONTACT.hours })}
            </span>
          </p>
        </div>
        <div className="ch-hero-actions">
          <a className="ch-action is-phone" href={CONTACT.tel}>
            <span className="ch-action-icon">
              <ContactIcon name="phone" size={20} />
            </span>
            <span>
              <strong>{c('callHotline')}</strong>
              <small>{CONTACT.phoneDisplay}</small>
            </span>
          </a>
          <a className="ch-action is-zalo" href={CONTACT.zalo} {...external}>
            <ContactIcon name="zalo" size={40} />
            <span>
              <strong>{c('chatZalo')}</strong>
              <small>{c('fastestReply')}</small>
            </span>
          </a>
          <a className="ch-action is-messenger" href={CONTACT.messenger} {...external}>
            <ContactIcon name="messenger" size={40} />
            <span>
              <strong>{c('chatMessenger')}</strong>
              <small>Model Universe</small>
            </span>
          </a>
        </div>
      </section>

      <section className="ch-topics" aria-labelledby="contact-topics">
        <div className="ch-section-head">
          <h2 id="contact-topics">{c('channelsTitle')}</h2>
          <p>{c('channelsIntro')}</p>
        </div>
        <div className="ch-topic-grid">
          <article className="ch-topic">
            <span className="ch-topic-icon">
              <AdminIcon name="spark" size={20} />
            </span>
            <h3>{c('topicAdviceTitle')}</h3>
            <p>{c('topicAdviceText')}</p>
            <a className="ch-topic-link" href={CONTACT.zalo} {...external}>
              {c('chatZalo')} →
            </a>
          </article>
          <article className="ch-topic">
            <span className="ch-topic-icon">
              <AdminIcon name="truck" size={20} />
            </span>
            <h3>{c('topicOrderTitle')}</h3>
            <p>{c('topicOrderText')}</p>
            <div className="ch-topic-links">
              <Link className="ch-topic-link" href="/order-history">
                {c('topicOrderAction')} →
              </Link>
              <a className="ch-topic-link is-quiet" href={CONTACT.tel}>
                {c('call')} {CONTACT.phoneDisplay}
              </a>
            </div>
          </article>
          <article className="ch-topic">
            <span className="ch-topic-icon">
              <AdminIcon name="exchange" size={20} />
            </span>
            <h3>{c('topicServiceTitle')}</h3>
            <p>{c('topicServiceText')}</p>
            <Link className="ch-topic-link" href="/services/sell">
              {c('topicServiceAction')} →
            </Link>
          </article>
          <article className="ch-topic">
            <span className="ch-topic-icon">
              <AdminIcon name="users" size={20} />
            </span>
            <h3>{c('topicPartnerTitle')}</h3>
            <p>{c('topicPartnerText')}</p>
            <a className="ch-topic-link" href={`mailto:${CONTACT.email}`}>
              {CONTACT.email} →
            </a>
          </article>
        </div>
      </section>

      <div className="ch-columns">
        <div className="ch-stack">
          <section className="ch-card" aria-labelledby="contact-channels">
            <h2 id="contact-channels" className="ch-card-title">
              {c('allChannels')}
            </h2>
            <ul className="ch-channel-list">
              {channels.map((channel) => (
                <li key={channel.label} className="ch-channel">
                  <span
                    className={`ch-channel-icon ${channel.icon === 'phone' || channel.icon === 'mail' ? 'is-line' : ''}`}
                  >
                    <ContactIcon
                      name={channel.icon}
                      size={channel.icon === 'phone' || channel.icon === 'mail' ? 18 : 36}
                    />
                  </span>
                  <a className="ch-channel-body" href={channel.href} {...('external' in channel ? external : {})}>
                    <small>{channel.label}</small>
                    <strong>{channel.value}</strong>
                    <span>{channel.note}</span>
                  </a>
                  {'copy' in channel && (
                    <button
                      type="button"
                      className="ch-copy"
                      onClick={() => copy(channel.copy)}
                      aria-label={`${c('copy')} ${channel.value}`}
                      title={c('copy')}
                    >
                      <ContactIcon name="copy" size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="ch-card ch-showroom" aria-labelledby="contact-showroom">
            <div className="ch-showroom-head">
              <h2 id="contact-showroom" className="ch-card-title">
                {c('showroomTitle')}
              </h2>
              <a className="ch-directions" href={CONTACT.mapsUrl} {...external}>
                <ContactIcon name="pin" size={16} />
                {c('directions')}
              </a>
            </div>
            <dl className="ch-facts">
              <div>
                <dt>
                  <ContactIcon name="pin" size={16} />
                  {c('address')}
                </dt>
                <dd>{CONTACT.addressLine}</dd>
              </div>
              <div>
                <dt>
                  <ContactIcon name="clock" size={16} />
                  {c('hours')}
                </dt>
                <dd>{c('hoursValue', { hours: CONTACT.hours })}</dd>
              </div>
            </dl>
            <p className="ch-visit-note">{c('visitNote')}</p>
          </section>
        </div>

        <section className="ch-card ch-form-card" aria-labelledby="contact-form">
          <h2 id="contact-form" className="ch-form-title">
            {c('formTitle')}
          </h2>
          <p className="ch-form-intro">{c('formIntro')}</p>

          {sent ? (
            <div className="py-10 text-center">
              <SuccessSignal />
              <h3 className="mb-2 mt-4 text-xl font-bold text-slate-900" role="status">
                {t('thanks')}
              </h3>
              <p className="mb-6 text-sm text-slate-500">{t('reply')}</p>
              <button type="button" onClick={() => setSent(false)} className="ch-submit">
                {t('sendAnother')}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="ch-form" noValidate>
              <fieldset className="ch-topic-picker">
                <legend>{c('formTopic')}</legend>
                <div>
                  {TOPICS.map((value) => (
                    <button key={value} type="button" aria-pressed={topic === value} onClick={() => setTopic(value)}>
                      {c(value)}
                    </button>
                  ))}
                </div>
              </fieldset>
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
              <div className="ch-form-wide">
                <label htmlFor="message" className="mb-1.5 block text-sm font-semibold text-slate-800">
                  {t('message')}
                </label>
                <textarea
                  id="message"
                  rows={5}
                  maxLength={2000}
                  className={`${inputClassName} ${errors.message ? 'border-danger' : ''} text-sm leading-relaxed`}
                  placeholder={c('messagePlaceholder')}
                  value={form.message}
                  onChange={(event) => update('message')(event.target.value)}
                  aria-invalid={errors.message ? true : undefined}
                />
                {errors.message && <p className="mt-1 text-xs text-rose-600">{errors.message}</p>}
              </div>
              <button type="submit" disabled={sending} className="ch-submit ch-form-wide">
                {sending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>{t('sending')}</span>
                  </>
                ) : (
                  <span>{t('send')}</span>
                )}
              </button>
              <p className="ch-privacy ch-form-wide">{c('privacy')}</p>
            </form>
          )}
        </section>
      </div>
    </div>
  );
};

export default Contact;
