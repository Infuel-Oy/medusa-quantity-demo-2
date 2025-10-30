import {ExecArgs, StoreProductVariant} from "@medusajs/framework/types"
import { Modules, QueryContext } from "@medusajs/framework/utils"
import {confirmOrderEditRequestWorkflow, createOrderChangeWorkflow, orderEditAddNewItemWorkflow, orderEditUpdateItemQuantityWorkflow} from "@medusajs/core-flows";

export default async function testOrderingWithDecimalQuantity({
                                                                container,
                                                              }: ExecArgs) {
  const query = container.resolve("query")
  const orderModuleService = container.resolve(Modules.ORDER)
  const regionModuleService = container.resolve(Modules.REGION)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)

  const regions = await regionModuleService.listRegions(
    { countries: ["dk"] } as any
  )
  const salesChannels = await salesChannelModuleService.listSalesChannels()

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "*",
      "variants.*",
      "variants.calculated_price.*",
    ],
    context: {
      variants: {
        calculated_price: QueryContext({
          region_id: regions[0].id,
          currency_code: "eur",
        }),
      },
    },
  })

  if (!products.length) {
    console.log("No products found.")
    return
  }

  const product = products[0]
  const variant = product.variants?.[0] as StoreProductVariant
  if (!variant) {
    console.log("No variants found for the first product.")
    return
  }

  // Create a new order with the first product's first variant
  const order = await orderModuleService.createOrders({
    currency_code: "eur",
    items: [
      {
        title: product.title,
        quantity: 123.4,
        unit_price: variant.calculated_price?.calculated_amount || 1,
        variant_id: variant.id,
        product_id: product.id,
      },
    ],
    region_id: regions[0].id,
    sales_channel_id: salesChannels[0].id,
    shipping_address: {
      country_code: "de"
    }
  })

  console.log("Created order:", order)

  await createOrderChangeWorkflow(container)
    .run({
      input: {
        order_id: order.id,
        change_type: "edit"
      }
    })

  // changing quantity to another decimal value is working
  await orderEditUpdateItemQuantityWorkflow(container).run({
    input: {
      order_id: order.id,
      items: order.items?.map((item) => ({
        id: item.id,
        quantity: 123.5,
      })) || [],
    },
  });

  // changing quantity to zero is working
  await orderEditUpdateItemQuantityWorkflow(container).run({
    input: {
      order_id: order.id,
      items: order.items?.map((item) => ({
        id: item.id,
        quantity: 0,
      })) || [],
    },
  });

  // adding new item with decimal quantity is not working (this was working with medusa 2.7.1)
  await orderEditAddNewItemWorkflow(container).run({
    input: {
      order_id: order.id,
      items: order.items?.map((item) => ({
        variant_id: variant.id,
        quantity: 123.5 // changing this to an integer value like 124 makes it work
      })) || [],
    },
  });

  await confirmOrderEditRequestWorkflow(container)
    .run({
      input: {
        order_id: order.id
      }
    })

}