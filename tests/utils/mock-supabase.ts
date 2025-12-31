/**
 * Mock Supabase client for testing
 */

export interface MockSupabaseClient {
  from: (table: string) => MockQueryBuilder;
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null }; error: null }>;
    getSession: () => Promise<{ data: { session: { user: { id: string } } | null }; error: null }>;
  };
}

export interface MockQueryBuilder {
  select: (columns?: string) => MockQueryBuilder;
  insert: (data: unknown) => MockQueryBuilder;
  update: (data: unknown) => MockQueryBuilder;
  upsert: (data: unknown, options?: { onConflict?: string }) => MockQueryBuilder;
  delete: () => MockQueryBuilder;
  eq: (column: string, value: unknown) => MockQueryBuilder;
  gte: (column: string, value: unknown) => MockQueryBuilder;
  lte: (column: string, value: unknown) => MockQueryBuilder;
  gt: (column: string, value: unknown) => MockQueryBuilder;
  lt: (column: string, value: unknown) => MockQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => MockQueryBuilder;
  single: () => Promise<{ data: unknown; error: null }>;
  maybeSingle: () => Promise<{ data: unknown | null; error: null }>;
  then: (onResolve: (value: { data: unknown[] | null; error: null }) => unknown) => Promise<unknown>;
}

export function createMockSupabaseClient(mockData: Record<string, unknown[]> = {}): MockSupabaseClient {
  return {
    from: (table: string) => createMockQueryBuilder(table, mockData),
    auth: {
      getUser: async () => ({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
      getSession: async () => ({
        data: { session: { user: { id: 'test-user-id' } } },
        error: null,
      }),
    },
  };
}

function createMockQueryBuilder(
  table: string,
  mockData: Record<string, unknown[]>
): MockQueryBuilder {
  let query: {
    table: string;
    filters: Array<{ column: string; operator: string; value: unknown }>;
    data?: unknown;
    operation?: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  } = {
    table,
    filters: [],
  };

  const builder: MockQueryBuilder = {
    select: (columns) => {
      query.operation = 'select';
      return builder;
    },
    insert: (data) => {
      query.operation = 'insert';
      query.data = data;
      return builder;
    },
    update: (data) => {
      query.operation = 'update';
      query.data = data;
      return builder;
    },
    upsert: (data, options) => {
      query.operation = 'upsert';
      query.data = data;
      return builder;
    },
    delete: () => {
      query.operation = 'delete';
      return builder;
    },
    eq: (column, value) => {
      query.filters.push({ column, operator: 'eq', value });
      return builder;
    },
    gte: (column, value) => {
      query.filters.push({ column, operator: 'gte', value });
      return builder;
    },
    lte: (column, value) => {
      query.filters.push({ column, operator: 'lte', value });
      return builder;
    },
    gt: (column, value) => {
      query.filters.push({ column, operator: 'gt', value });
      return builder;
    },
    lt: (column, value) => {
      query.filters.push({ column, operator: 'lt', value });
      return builder;
    },
    order: (column, options) => {
      return builder;
    },
    single: async () => {
      const data = mockData[table]?.[0] || null;
      return { data, error: null };
    },
    maybeSingle: async () => {
      const data = mockData[table]?.[0] || null;
      return { data, error: null };
    },
    then: async (onResolve) => {
      let results = mockData[table] || [];
      
      // Apply filters
      for (const filter of query.filters) {
        results = results.filter((item: any) => {
          const itemValue = item[filter.column];
          switch (filter.operator) {
            case 'eq':
              return itemValue === filter.value;
            case 'gte':
              return itemValue >= filter.value;
            case 'lte':
              return itemValue <= filter.value;
            case 'gt':
              return itemValue > filter.value;
            case 'lt':
              return itemValue < filter.value;
            default:
              return true;
          }
        });
      }

      return onResolve({ data: results, error: null });
    },
  };

  return builder;
}
