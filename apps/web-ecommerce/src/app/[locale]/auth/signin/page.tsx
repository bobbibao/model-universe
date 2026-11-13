import { Suspense } from 'react';
import StoreLayout from '@/components/Layouts/StoreLayout';
import SignIn from '@/core/client/features/auth/pages/SignIn';
import { privatePageMetadata } from '@/shared/seo';

export const metadata = privatePageMetadata('Đăng nhập');

const SignInPage = () => {
  return (
    <StoreLayout>
      <Suspense>
        <SignIn />
      </Suspense>
    </StoreLayout>
  );
};

export default SignInPage;
