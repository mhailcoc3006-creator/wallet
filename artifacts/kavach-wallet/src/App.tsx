import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import KavachApp from '@/components/kavach-app';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <KavachApp />
      <Toaster theme="dark" position="top-center" richColors />
    </QueryClientProvider>
  );
}

export default App;
