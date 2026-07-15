/**
 * One page of `TItem` rows. On the server this is the raw shape services
 * return (entities); over the wire it's the shape of the paginated list DTOs
 * (e.g. `OnetimeInviteListDto`).
 */
export type PaginatedList<TItem> = {
  items: TItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};
