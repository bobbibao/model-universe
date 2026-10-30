import { toast as baseToast } from 'react-toastify';
import { showToast } from '@/shared/client/utils/toast';

jest.mock('react-toastify', () => {
  let counter = 0;
  const listeners: Array<(payload: any) => void> = [];

  const baseToastMock: any = jest.fn((content: any, options: any) => {
    counter += 1;
    const id = counter;
    listeners.forEach((cb) => cb({ id, status: 'added' }));
    return id;
  });

  baseToastMock.success = jest.fn((content: any, options: any) => {
    counter += 1;
    const id = counter;
    listeners.forEach((cb) => cb({ id, status: 'added' }));
    return id;
  });

  baseToastMock.error = jest.fn((content: any, options: any) => {
    counter += 1;
    const id = counter;
    listeners.forEach((cb) => cb({ id, status: 'added' }));
    return id;
  });

  baseToastMock.info = jest.fn((content: any, options: any) => {
    counter += 1;
    const id = counter;
    listeners.forEach((cb) => cb({ id, status: 'added' }));
    return id;
  });

  baseToastMock.warning = jest.fn((content: any, options: any) => {
    counter += 1;
    const id = counter;
    listeners.forEach((cb) => cb({ id, status: 'added' }));
    return id;
  });

  baseToastMock.warn = baseToastMock.warning;

  baseToastMock.dismiss = jest.fn((id?: string | number) => {
    if (id !== undefined) {
      listeners.forEach((cb) => cb({ id, status: 'removed' }));
    }
  });

  baseToastMock.onChange = jest.fn((cb: any) => {
    listeners.push(cb);
    return () => {
      const idx = listeners.indexOf(cb);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  });

  baseToastMock.isActive = jest.fn();
  baseToastMock.update = jest.fn();

  return {
    toast: baseToastMock,
  };
});

describe('showToast strict FIFO queue (max 3 newest toasts)', () => {
  beforeEach(() => {
    showToast.dismiss();
    jest.clearAllMocks();
  });

  it('keeps at most 3 toasts and drops the oldest when a 4th arrives', () => {
    // 1. Show Toast 1
    const t1 = showToast.success('Toast 1');
    expect(baseToast.dismiss).not.toHaveBeenCalled();

    // 2. Show Toast 2
    const t2 = showToast.info('Toast 2');
    expect(baseToast.dismiss).not.toHaveBeenCalled();

    // 3. Show Toast 3
    const t3 = showToast.warning('Toast 3');
    expect(baseToast.dismiss).not.toHaveBeenCalled();

    // 4. Show Toast 4 -> Toast 1 MUST be dismissed immediately
    const t4 = showToast.error('Toast 4');
    expect(baseToast.dismiss).toHaveBeenCalledWith(t1);

    // 5. Show Toast 5 -> Toast 2 MUST be dismissed immediately
    const t5 = showToast.info('Toast 5');
    expect(baseToast.dismiss).toHaveBeenCalledWith(t2);
  });

  it('allows manual dismissal', () => {
    const t1 = showToast.success('Toast A');
    const t2 = showToast.success('Toast B');

    showToast.dismiss(t1);
    expect(baseToast.dismiss).toHaveBeenCalledWith(t1);

    const t3 = showToast.success('Toast C');
    const t4 = showToast.success('Toast D');
    // Since t1 was dismissed, active were [t2, t3, t4] (count = 3)
    // Adding t5 should dismiss t2
    const t5 = showToast.success('Toast E');
    expect(baseToast.dismiss).toHaveBeenCalledWith(t2);
  });
});
