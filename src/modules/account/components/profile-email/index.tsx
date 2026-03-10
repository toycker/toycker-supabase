"use client"

import React from "react"

import AccountInfo from "../account-info"
import { CustomerProfile } from "@/lib/supabase/types"

type MyInformationProps = {
  customer: CustomerProfile
}

const ProfileEmail: React.FC<MyInformationProps> = ({ customer }) => {
  return (
    <div className="w-full" data-testid="account-email-editor">
      <AccountInfo
        label="Email"
        currentInfo={customer.email || "No email added"}
        clearState={() => {}}
        editable={false}
      />
      <p className="text-small-regular text-ui-fg-subtle mt-2">
        {customer.email
          ? "Email cannot be changed."
          : "You are signing in with WhatsApp OTP. Add an email during checkout if needed."}
      </p>
    </div>
  )
}

export default ProfileEmail
