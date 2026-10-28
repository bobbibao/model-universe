jest.mock('nodemailer', () => ({ __esModule: true, default: { createTransport: jest.fn() } }));
import nodemailer from 'nodemailer';
import MailService from '../../src/core/server/services/MailService';
import { requirePayoutSignature } from '../../src/core/server/services/PayOSPayoutService';

describe('real mail and payout transport boundaries', () => {
  const old = { ...process.env };
  beforeEach(() => {
    (MailService as unknown as { transporter: unknown }).transporter = undefined;
    jest.clearAllMocks();
  });
  afterEach(() => {
    process.env = { ...old };
  });
  it('never claims OTP or transactional delivery without SMTP, including development', async () => {
    delete process.env.SMTP_HOST;
    process.env.NODE_ENV = 'development';
    await expect(new MailService().sendRegistrationOtp('recipient@example.test', '123456', 5)).rejects.toThrow('SMTP');
    await expect(new MailService().sendTransactional('recipient@example.test', 'Update', 'Message')).rejects.toThrow(
      'SMTP',
    );
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });
  it('uses encrypted Gmail transport and returns a real provider message ID', async () => {
    Object.assign(process.env, {
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '465',
      SMTP_USER: 'sender@example.test',
      SMTP_PASS: 'test-only',
      SMTP_FROM: 'Shop <sender@example.test>',
    });
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'smtp-accepted-id' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    expect(await new MailService().sendTransactional('recipient@example.test', 'Update', 'Body')).toBe(
      'smtp-accepted-id',
    );
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ secure: true, host: 'smtp.gmail.com', port: 465, socketTimeout: 20000 }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'recipient@example.test', subject: '[Model Universe] Update' }),
    );
  });
  it('propagates SMTP rejection instead of returning a simulated success', async () => {
    process.env.SMTP_HOST = 'smtp.example.test';
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: jest.fn().mockRejectedValue(new Error('Recipient rejected')),
    });
    await expect(new MailService().sendTransactional('recipient@example.test', 'Update', 'Body')).rejects.toThrow(
      'Recipient rejected',
    );
  });
  it('rejects unsigned successful payout data before the SDK can accept it', async () => {
    await expect(requirePayoutSignature(new Response(JSON.stringify({ code: '00', data: {} })))).rejects.toThrow(
      'missing its signature',
    );
  });
  it('passes signed responses to SDK verification and preserves real provider errors', async () => {
    const response = new Response(JSON.stringify({ code: '00', data: {} }), {
      headers: { 'x-signature': 'sdk-must-verify-this' },
    });
    expect(await requirePayoutSignature(response)).toBe(response);
    const failure = new Response(JSON.stringify({ code: '601', desc: 'Invalid key' }));
    expect(await requirePayoutSignature(failure)).toBe(failure);
  });
});
