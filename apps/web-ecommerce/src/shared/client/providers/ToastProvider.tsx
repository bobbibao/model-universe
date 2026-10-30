'use client';

import { useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import { Events, eventEmitter } from '@/shared/client/utils/eventEmitter';
import { showToast, CustomCloseButton, CustomToastIcon } from '@/shared/client/utils/toast';

interface ToastProviderProps {
  children: React.ReactNode;
}

interface ValidationMessagesEvent {
  title?: string;
  validationMessages?: string[];
}

export default function ToastProvider({ children }: ToastProviderProps) {
  // Validation messages returned by the API (ApiResponse.userValidationMessages) are shown as an error toast.
  useEffect(() => {
    eventEmitter.subscribe(Events.OPEN_MODAL_MESSAGES_ERRORS, ({ title, validationMessages }: ValidationMessagesEvent) => {
      const lines = [title, ...(validationMessages || []).map((message) => `• ${message}`)].filter(Boolean);
      showToast.error(lines.join('\n'), {
        style: { whiteSpace: 'pre-line' },
        autoClose: 5000,
      });
    });
    return () => eventEmitter.unsubscribe(Events.OPEN_MODAL_MESSAGES_ERRORS);
  }, []);

  return (
    <>
      {children}
      <ToastContainer
        position="top-right"
        limit={3}
        newestOnTop={true}
        autoClose={3500}
        hideProgressBar={true}
        closeOnClick={false}
        pauseOnHover={true}
        draggable={true}
        draggablePercent={40}
        closeButton={(props) => <CustomCloseButton {...props} />}
        icon={({ type }) => <CustomToastIcon type={type} />}
      />
    </>
  );
}
