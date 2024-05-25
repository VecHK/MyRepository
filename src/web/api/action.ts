import request, { baseURL } from 'web/utils/request'
import { FilterRule } from 'server/core/ItemPool'
import { CreateItemForm, Item } from 'server/core/Item'
import { ActionName, ActionPayload, ActionRouteTable } from 'server/api'
import { FileID } from 'server/core/File'
import { ImageDimession } from 'server/utils/generate-image'

export function requestAction<N extends ActionName>(
  action: N,
  payload?: ActionPayload<N>,
) {
  type D = Awaited<ReturnType<ActionRouteTable[N]>>
  return request<D>({
    method: 'POST',
    url: 'action',
    data: {
      action,
      payload,
    },
  })
}

export function fileId2Url(f_id: FileID): string {
  return baseURL`files/${f_id}`
}

export async function listingItem(
  sort_by: 'index',
  after_id: number | undefined,
  limit: number,
  desc: boolean = false,
  filter_rules: FilterRule[],
) {
  return request<Item[]>({
    method: 'POST',
    url: 'action',
    data: {
      action: 'listing',
      payload: { sort_by, after_id, limit, desc, filter_rules },
    },
  })
}
