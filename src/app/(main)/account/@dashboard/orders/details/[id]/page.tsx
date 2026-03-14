import { retrieveOrder } from "@lib/data/orders"
import { retrieveCustomer } from "@lib/data/customer"
import { notFound } from "next/navigation"
import OrderCompletedTemplate from "@modules/order/templates/order-completed-template"

type Props = {
    params: Promise<{ id: string }>
}

export default async function OrderDetailsPage({ params }: Props) {
    const { id } = await params
    const [order, customer] = await Promise.all([
        retrieveOrder(id),
        retrieveCustomer(),
    ])

    if (!order || !customer || order.user_id !== customer.id) {
        notFound()
    }

    return (
        <OrderCompletedTemplate
            order={order}
            customerPhone={customer.phone}
            context="account"
        />
    )
}
