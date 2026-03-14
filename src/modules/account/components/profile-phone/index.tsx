"use client"

import React from "react"

import AccountInfo from "../account-info"
import { CustomerProfile } from "@/lib/supabase/types"
import { getCheckoutPhoneValue } from "@/lib/util/customer-phone"

type MyInformationProps = {
  customer: CustomerProfile
}

const ProfilePhone: React.FC<MyInformationProps> = ({ customer }) => {
  const displayPhone = getCheckoutPhoneValue(customer.phone) || "No phone number"

  return (
    <div className="w-full">
      <AccountInfo
        label="Phone"
        currentInfo={displayPhone}
        clearState={() => {}}
        data-testid="account-phone-editor"
        editable={false}
      />
      <p className="text-small-regular text-ui-fg-subtle mt-2">
        Your phone is linked to your WhatsApp login and cannot be changed.
      </p>
    </div>
  )
}

export default ProfilePhone
