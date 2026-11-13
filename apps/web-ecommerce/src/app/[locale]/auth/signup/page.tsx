import StoreLayout from '@/components/Layouts/StoreLayout';
import SignUp from '@/core/client/features/auth/pages/SignUp';
import { privatePageMetadata } from '@/shared/seo';

export const metadata = privatePageMetadata('Đăng ký');

const SignUpPage = () => {
  return (
    <StoreLayout>
      <SignUp />
    </StoreLayout>
  );
};

export default SignUpPage;
