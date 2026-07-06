'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Hash, MessageSquare, Plus, Send, SmilePlus, Users } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SOCKET_EVENTS } from '@taskforge/shared-types';
import { get, post, apiErrorMessage } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import { Topbar } from '@/components/shell/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton, Textarea } from '@/components/ui/misc';
import { UserAvatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ChannelRow {
  id: string;
  type: string;
  name: string | null;
  unreadCount: number;
  lastMessageAt: string | null;
  project: { id: string; name: string; color: string } | null;
  members: Array<{ userId: string; user: { id: string; name: string; avatarUrl: string | null } }>;
}

interface MessageRow {
  id: string;
  body: string;
  senderId: string;
  isEdited: boolean;
  createdAt: string;
  sender: { id: string; name: string; avatarUrl: string | null };
  reactions: Array<{ emoji: string; userIds: string[] }>;
  readBy: string[];
}

const QUICK_EMOJI = ['👍', '❤️', '🎉', '👀', '😂'];

function channelLabel(channel: ChannelRow, meId: string | undefined): string {
  if (channel.type === 'DIRECT') {
    const other = channel.members.find((m) => m.userId !== meId);
    return other?.user.name ?? 'Direct message';
  }
  return channel.name ?? channel.project?.name ?? 'Channel';
}

export default function ChatPage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [typing, setTyping] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: channels, isPending: channelsPending } = useQuery({
    queryKey: ['channels', workspaceId],
    queryFn: () => get<ChannelRow[]>(`/workspaces/${workspaceId}/channels`),
  });

  const channelId = activeId ?? channels?.[0]?.id ?? null;
  const activeChannel = channels?.find((c) => c.id === channelId) ?? null;

  const { data: messages } = useQuery({
    queryKey: ['messages', channelId],
    queryFn: () => get<MessageRow[]>(`/workspaces/${workspaceId}/channels/${channelId}/messages`, { limit: 50 }),
    enabled: Boolean(channelId),
  });

  // Live: join channel room, handle incoming messages + typing.
  useEffect(() => {
    if (!channelId) return;
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.JOIN_CHANNEL, channelId);

    const onNew = () => {
      void queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
      void queryClient.invalidateQueries({ queryKey: ['channels', workspaceId] });
      void post(`/workspaces/${workspaceId}/channels/${channelId}/read`).catch(() => undefined);
    };
    const onTypingStart = (p: { channelId: string; userName: string; userId: string }) => {
      if (p.channelId === channelId && p.userId !== me?.id) {
        setTyping(p.userName);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(null), 3000);
      }
    };
    const onTypingStop = () => setTyping(null);
    const onReaction = () => void queryClient.invalidateQueries({ queryKey: ['messages', channelId] });

    socket.on(SOCKET_EVENTS.MESSAGE_NEW, onNew);
    socket.on(SOCKET_EVENTS.TYPING_START, onTypingStart);
    socket.on(SOCKET_EVENTS.TYPING_STOP, onTypingStop);
    socket.on(SOCKET_EVENTS.MESSAGE_REACTION, onReaction);

    // Mark read on open.
    void post(`/workspaces/${workspaceId}/channels/${channelId}/read`).catch(() => undefined);

    return () => {
      socket.off(SOCKET_EVENTS.MESSAGE_NEW, onNew);
      socket.off(SOCKET_EVENTS.TYPING_START, onTypingStart);
      socket.off(SOCKET_EVENTS.TYPING_STOP, onTypingStop);
      socket.off(SOCKET_EVENTS.MESSAGE_REACTION, onReaction);
      socket.emit(SOCKET_EVENTS.LEAVE_CHANNEL, channelId);
    };
  }, [channelId, workspaceId, me?.id, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);

  const send = useMutation({
    mutationFn: () => post<MessageRow>(`/workspaces/${workspaceId}/channels/${channelId}/messages`, { body: body.trim() }),
    onSuccess: () => {
      setBody('');
      void queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
      void queryClient.invalidateQueries({ queryKey: ['channels', workspaceId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const react = useMutation({
    mutationFn: (input: { messageId: string; emoji: string }) =>
      post(`/workspaces/${workspaceId}/channels/${channelId}/messages/${input.messageId}/reactions`, { emoji: input.emoji }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['messages', channelId] }),
  });

  const emitTyping = useMemo(() => {
    let last = 0;
    return () => {
      const now = Date.now();
      if (now - last > 1500 && channelId) {
        last = now;
        getSocket().emit(SOCKET_EVENTS.TYPING_START, { channelId });
      }
    };
  }, [channelId]);

  return (
    <>
      <Topbar title="Chat" />
      <div className="flex min-h-0 flex-1">
        {/* Channel list */}
        <div className="flex w-64 shrink-0 flex-col border-r">
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Channels</span>
            <NewChannelDialog workspaceId={workspaceId} />
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2 scrollbar-thin">
            {channelsPending ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9" />)
            ) : (
              channels?.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => setActiveId(channel.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                    channel.id === channelId ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                  )}
                >
                  {channel.type === 'DIRECT' ? (
                    <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{channelLabel(channel, me?.id)}</span>
                  {channel.unreadCount > 0 && <Badge className="shrink-0">{channel.unreadCount}</Badge>}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Conversation */}
        <div className="flex min-w-0 flex-1 flex-col">
          {!channelId ? (
            <EmptyState icon={MessageSquare} title="No conversation selected" className="my-auto" />
          ) : (
            <>
              <div className="flex items-center gap-2 border-b px-4 py-2.5">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{activeChannel ? channelLabel(activeChannel, me?.id) : ''}</span>
                <span className="text-xs text-muted-foreground">{activeChannel?.members.length} members</span>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
                {messages?.map((message) => {
                  const mine = message.senderId === me?.id;
                  return (
                    <div key={message.id} className={cn('group flex gap-2.5', mine && 'flex-row-reverse')}>
                      <UserAvatar user={message.sender} className="mt-0.5 h-7 w-7" />
                      <div className={cn('max-w-[70%]', mine && 'text-right')}>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{message.sender.name}</span>{' '}
                          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                          {message.isEdited && ' · edited'}
                        </p>
                        <div
                          className={cn(
                            'mt-1 inline-block whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-left text-sm',
                            mine ? 'rounded-tr-sm bg-primary text-primary-foreground' : 'rounded-tl-sm bg-secondary'
                          )}
                        >
                          {message.body}
                        </div>
                        <div className={cn('mt-1 flex items-center gap-1', mine && 'justify-end')}>
                          {message.reactions.map((r) => (
                            <button
                              key={r.emoji}
                              onClick={() => react.mutate({ messageId: message.id, emoji: r.emoji })}
                              className={cn(
                                'rounded-full border px-1.5 py-0.5 text-xs transition-colors hover:bg-accent',
                                me && r.userIds.includes(me.id) && 'border-primary bg-primary/10'
                              )}
                            >
                              {r.emoji} {r.userIds.length}
                            </button>
                          ))}
                          <div className="relative hidden group-hover:block">
                            <details className="group/emoji">
                              <summary className="flex cursor-pointer list-none items-center rounded-full border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent">
                                <SmilePlus className="h-3 w-3" />
                              </summary>
                              <div className="absolute bottom-full z-10 mb-1 flex gap-1 rounded-lg border bg-popover p-1 shadow-popover">
                                {QUICK_EMOJI.map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={(e) => {
                                      react.mutate({ messageId: message.id, emoji });
                                      (e.currentTarget.closest('details') as HTMLDetailsElement).open = false;
                                    }}
                                    className="rounded p-1 text-sm hover:bg-accent"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </details>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="border-t p-3">
                {typing && <p className="mb-1 px-1 text-xs text-muted-foreground">{typing} is typing…</p>}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (body.trim()) send.mutate();
                  }}
                  className="flex items-end gap-2"
                >
                  <Textarea
                    value={body}
                    onChange={(e) => {
                      setBody(e.target.value);
                      emitTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (body.trim()) send.mutate();
                      }
                    }}
                    placeholder={`Message ${activeChannel ? channelLabel(activeChannel, me?.id) : ''}`}
                    rows={1}
                    className="min-h-0 flex-1 resize-none"
                  />
                  <Button type="submit" size="icon" loading={send.isPending} disabled={!body.trim()}>
                    <Send />
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function NewChannelDialog({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const me = useAuthStore((s) => s.user);

  const { data: members } = useQuery({
    queryKey: ['members', workspaceId],
    queryFn: () =>
      get<Array<{ id: string; user: { id: string; name: string } }>>(`/workspaces/${workspaceId}/members`),
    enabled: open,
  });
  const [selected, setSelected] = useState<string[]>([]);

  const create = useMutation({
    mutationFn: () =>
      post(`/workspaces/${workspaceId}/channels`, {
        type: 'GROUP',
        name,
        memberIds: selected,
      }),
    onSuccess: () => {
      setOpen(false);
      setName('');
      setSelected([]);
      void queryClient.invalidateQueries({ queryKey: ['channels', workspaceId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New group channel</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && selected.length) create.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label>Channel name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="design-team" required />
          </div>
          <div className="space-y-1.5">
            <Label>Members</Label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2 scrollbar-thin">
              {members
                ?.filter((m) => m.user.id !== me?.id)
                .map((m) => (
                  <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={selected.includes(m.user.id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...prev, m.user.id] : prev.filter((id) => id !== m.user.id)
                        )
                      }
                    />
                    {m.user.name}
                  </label>
                ))}
            </div>
          </div>
          <Button type="submit" className="w-full" loading={create.isPending} disabled={!name.trim() || !selected.length}>
            Create channel
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
