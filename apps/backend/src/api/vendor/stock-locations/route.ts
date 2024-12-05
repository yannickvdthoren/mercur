import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { createStockLocationsWorkflow } from '@medusajs/medusa/core-flows'

import { SELLER_MODULE } from '../../../modules/seller'
import { fetchSellerByAuthActorId } from '../../../shared/infra/http/utils'
import { VendorCreateStockLocationType } from './validators'

/**
 * @oas [post] /vendor/stock-locations
 * operationId: "VendorCreateStockLocation"
 * summary: "Create a Stock Location"
 * description: "Creates a Stock Location."
 * x-authenticated: true
 * parameters:
 *   - in: query
 *     name: fields
 *     description: The comma-separated fields to include in the response
 *     schema:
 *       type: string
 * requestBody:
 *   content:
 *     application/json:
 *       schema:
 *         $ref: "#/components/schemas/VendorCreateStockLocation"
 * responses:
 *   "201":
 *     description: Created
 *     content:
 *       application/json:
 *         schema:
 *           type: object
 *           properties:
 *             stock_location:
 *               $ref: "#/components/schemas/VendorStockLocation"
 * tags:
 *   - Stock Location
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<VendorCreateStockLocationType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  const seller = await fetchSellerByAuthActorId(
    req.auth_context.actor_id,
    req.scope
  )

  const { result } = await createStockLocationsWorkflow(req.scope).run({
    input: { locations: [req.validatedBody] }
  })

  await remoteLink.create({
    [SELLER_MODULE]: {
      seller_id: seller.id
    },
    [Modules.STOCK_LOCATION]: {
      stock_location_id: result[0].id
    }
  })

  const {
    data: [stockLocation]
  } = await query.graph(
    {
      entity: 'stock_location',
      fields: req.remoteQueryConfig.fields,
      filters: {
        id: result[0].id
      }
    },
    { throwIfKeyNotFound: true }
  )

  res.status(201).json({
    stock_location: stockLocation
  })
}

/**
 * @oas [get] /vendor/stock-locations
 * operationId: "VendorListStockLocations"
 * summary: "List Stock Locations"
 * description: "Retrieves a list of Stock Locations."
 * x-authenticated: true
 * parameters:
 *   - in: query
 *     name: fields
 *     description: The comma-separated fields to include in the response
 *     schema:
 *       type: string
 * responses:
 *   "200":
 *     description: OK
 *     content:
 *       application/json:
 *         schema:
 *           type: object
 *           properties:
 *             stock_locations:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/VendorStockLocation"
 * tags:
 *   - Stock Location
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: sellerLocations } = await query.graph(
    {
      entity: 'stock_location',
      fields: req.remoteQueryConfig.fields.map((field) => `seller.${field}`),
      filters: req.filterableFields
    },
    { throwIfKeyNotFound: true }
  )

  res.status(200).json({
    stock_locations: sellerLocations.map(
      (sellerLocation) => sellerLocation.stock_location
    )
  })
}
