import {useState, type ReactNode} from 'react';
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {useToast} from 'silver-ui';

interface QueryProviderProps {
  children: ReactNode;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

function suppressErrorToast(meta: unknown): boolean {
  return Boolean(
    meta &&
    typeof meta === 'object' &&
    'suppressErrorToast' in meta &&
    meta.suppressErrorToast,
  );
}

export function QueryProvider({children}: QueryProviderProps) {
  const showToast = useToast();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            if (suppressErrorToast(query.meta)) {
              return;
            }
            showToast({type: 'error', body: errorMessage(error)});
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (suppressErrorToast(mutation.meta)) {
              return;
            }
            showToast({type: 'error', body: errorMessage(error)});
          },
        }),
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
