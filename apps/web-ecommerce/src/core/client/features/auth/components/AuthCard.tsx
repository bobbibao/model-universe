import React from 'react';

// Centered card used by the sign-in and sign-up pages: the page's name, one line on why, then the form.
const AuthCard = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="mx-auto my-8 w-full max-w-lg px-4 sm:my-16">
      <div className="rounded-[20px] border border-stroke bg-white p-6 dark:border-store-card dark:bg-store-panel sm:p-10">
        <h1 className="text-center text-3xl font-medium tracking-tight text-black dark:text-white">{title}</h1>
        {description && (
          <p className="mt-3 text-center text-sm leading-6 text-body dark:text-store-muted">{description}</p>
        )}
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
};

export const primaryButtonClassName =
  'w-full rounded-[10px] bg-brand px-4 py-3.5 font-medium text-brand-ink transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-hover disabled:cursor-not-allowed disabled:opacity-60';

export const secondaryButtonClassName =
  'w-full rounded-md bg-gray px-4 py-3 font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-store-card dark:text-store-text';

export default AuthCard;
