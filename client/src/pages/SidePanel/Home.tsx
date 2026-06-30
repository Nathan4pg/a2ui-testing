import * as React from 'react';
import { BarChart3, MessageSquare, RotateCcw } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { useAgentChat } from '@/hooks/use-agent-chat';
import { Chat } from './Chat';
import { Dashboard } from './Dashboard';

export default function Home() {
  const { items, datasets, activeTool, status, error, sendMessage, reset } =
    useAgentChat();

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-3 py-2">
        <div>
          <h1 className="text-sm font-semibold leading-tight">
            Agent Side Panel
          </h1>
          <p className="text-[11px] text-muted-foreground">
            Ollama · MCP · ag-ui
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          className="h-8 gap-1 text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          New chat
        </Button>
      </header>

      <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-3 mt-2 grid grid-cols-2">
          <TabsTrigger value="chat" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-2 min-h-0 flex-1 outline-none">
          <Chat
            items={items}
            activeTool={activeTool}
            status={status}
            error={error}
            onSend={sendMessage}
          />
        </TabsContent>

        <TabsContent
          value="dashboard"
          className="mt-0 min-h-0 flex-1 overflow-y-auto outline-none"
        >
          <Dashboard datasets={datasets} />
        </TabsContent>
      </Tabs>

      <Toaster />
    </div>
  );
}
