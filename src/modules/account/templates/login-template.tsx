"use client"

import { Suspense } from "react"

import PhoneLogin from "@modules/account/components/phone-login"
import AuthShell from "@modules/account/components/auth-shell"

type LoginTemplateProps = {
  next?: string
  returnUrl?: string
}

const LoginTemplateContent = ({ next, returnUrl }: LoginTemplateProps) => {
  return (
    <AuthShell
      title="Welcome to Toycker"
      subtitle="Enter your WhatsApp number to continue"
    >
      <PhoneLogin next={next} returnUrl={returnUrl} />
    </AuthShell>
  )
}

const LoginTemplate = (props: LoginTemplateProps) => {
  return (
    <Suspense
      fallback={
        <div className="w-full h-full flex items-center justify-center p-8">
          Loading...
        </div>
      }
    >
      <LoginTemplateContent {...props} />
    </Suspense>
  )
}

export default LoginTemplate
