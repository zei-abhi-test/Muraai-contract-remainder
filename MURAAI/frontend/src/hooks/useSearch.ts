import { useQuery } from '@tanstack/react-query'
import { searchApi } from '@/api/search'
import { queryKeys } from '@/lib/react-query'

export function useGlobalSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.search.global(query),
    queryFn: () => searchApi.globalSearch(query),
    enabled: query.length > 2,
  })
}
