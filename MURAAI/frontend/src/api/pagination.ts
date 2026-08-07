export interface Paginated<T> {
  items: T[]
  page: number
  per_page: number
  total: number
  total_pages: number
}
