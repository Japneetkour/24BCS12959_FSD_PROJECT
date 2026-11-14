import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Send, FileText, Download, Loader2 } from 'lucide-react';
import { groupApi, resourceApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useSocket, useSocketEvent } from '../../context/SocketContext';
import { Avatar } from '../ui/Display';
import Spinner from '../ui/Spinner';
import { fmtBytes, fmtDate, fmtTime } from '../../utils/format';

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

/**
 * Real-time group chat.
 * - History via REST (cursor pagination, "load earlier").
 * - New messages via Socket.io `message:send` (ack) and `message:new` broadcasts.
 * - Typing indicators via the `typing` event.
 */
export default function ChatPanel({ group }) {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState({});
  const listRef = useRef(null);
  const stickToBottom = useRef(true);
  const typingTimeout = useRef(null);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // Initial history
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    groupApi
      .messages(group._id, { limit: 30 })
      .then((d) => {
        if (cancelled) return;
        setMessages(d.items);
        setHasMore(d.hasMore);
        stickToBottom.current = true;
      })
      .catch((err) => toast.error(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [group._id]);

  // Join the socket room (re-join after reconnects).
  useEffect(() => {
    if (!socket || !connected) return undefined;
    socket.emit('group:join', { groupId: group._id }, (res) => {
      if (!res?.ok) toast.error(res?.error || 'Could not join chat room');
    });
    return () => socket.emit('group:leave', { groupId: group._id });
  }, [socket, connected, group._id]);

  useSocketEvent('message:new', (msg) => {
    if (msg.group !== group._id) return;
    const el = listRef.current;
    stickToBottom.current = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120 || msg.sender?._id === user._id;
    setMessages((list) => (list.some((m) => m._id === msg._id) ? list : [...list, msg]));
    if (msg.sender) setTyping((t) => { const n = { ...t }; delete n[msg.sender._id]; return n; });
  });

  useSocketEvent('typing', ({ groupId, user: u, isTyping }) => {
    if (groupId !== group._id) return;
    setTyping((t) => {
      const n = { ...t };
      if (isTyping) n[u._id] = u.name;
      else delete n[u._id];
      return n;
    });
  });

  useLayoutEffect(() => {
    if (stickToBottom.current) scrollToBottom();
  }, [messages, loading]);

  const loadEarlier = useCallback(async () => {
    if (!messages.length) return;
    setLoadingMore(true);
    const el = listRef.current;
    const prevHeight = el.scrollHeight;
    try {
      const d = await groupApi.messages(group._id, { before: messages[0].createdAt, limit: 30 });
      stickToBottom.current = false;
      setMessages((list) => [...d.items, ...list]);
      setHasMore(d.hasMore);
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - prevHeight; }); // keep position
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [group._id, messages]);

  const emitTyping = (isTyping) => socket?.emit('typing', { groupId: group._id, isTyping });

  const onChange = (e) => {
    setText(e.target.value);
    emitTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => emitTyping(false), 1500);
  };

  const send = async (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    clearTimeout(typingTimeout.current);
    emitTyping(false);
    stickToBottom.current = true;
    try {
      if (socket && connected) {
        await new Promise((resolve, reject) => {
          socket.timeout(8000).emit('message:send', { groupId: group._id, content }, (err, res) => {
            if (err || !res?.ok) reject(new Error(res?.error || 'Message not delivered'));
            else resolve(res.message);
          });
        });
      } else {
        // REST fallback when the socket is down.
        const msg = await groupApi.sendMessage(group._id, content);
        setMessages((list) => (list.some((m) => m._id === msg._id) ? list : [...list, msg]));
      }
      setText('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const typingNames = Object.values(typing);

  return (
    <div className="flex h-[calc(100vh-18rem)] min-h-[420px] flex-col">
      <div ref={listRef} className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {loading && <div className="grid h-full place-items-center"><Spinner className="h-6 w-6 text-brand-500" /></div>}
        {!loading && hasMore && (
          <div className="pb-2 text-center">
            <button type="button" onClick={loadEarlier} disabled={loadingMore} className="btn btn-secondary btn-sm">
              {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Load earlier messages
            </button>
          </div>
        )}
        {!loading && messages.length === 0 && <p className="muted py-12 text-center text-sm">No messages yet — say hello 👋</p>}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
          const mine = m.sender?._id === user._id;
          const grouped = !newDay && prev?.sender?._id === m.sender?._id && prev?.type !== 'system' && new Date(m.createdAt) - new Date(prev.createdAt) < 5 * 60000;

          return (
            <Fragment key={m._id}>
              {newDay && (
                <div className="flex items-center gap-3 py-3">
                  <span className="h-px flex-1 bg-ink-100 dark:bg-ink-800" />
                  <span className="text-[11px] font-semibold text-ink-400">{fmtDate(m.createdAt, 'EEEE, MMM d')}</span>
                  <span className="h-px flex-1 bg-ink-100 dark:bg-ink-800" />
                </div>
              )}
              {m.type === 'system' ? (
                <p className="py-1 text-center text-[11px] text-ink-400">{m.content} · {fmtTime(m.createdAt)}</p>
              ) : (
                <div className={clsx('flex gap-2.5', mine && 'flex-row-reverse', grouped ? 'mt-0.5' : 'mt-3')}>
                  <div className="w-8 shrink-0">{!grouped && !mine && <Avatar user={m.sender || { name: 'Deleted user' }} size="sm" />}</div>
                  <div className={clsx('flex max-w-[75%] flex-col', mine && 'items-end')}>
                    {!grouped && !mine && <span className="mb-0.5 text-xs font-semibold text-ink-600 dark:text-ink-300">{m.sender?.name || 'Deleted user'}</span>}
                    <div
                      className={clsx(
                        'rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                        mine ? 'rounded-tr-md bg-brand-600 text-white' : 'rounded-tl-md bg-ink-100 text-ink-800 dark:bg-ink-800 dark:text-ink-100'
                      )}
                    >
                      {m.type === 'resource' && m.resource ? (
                        <button type="button" onClick={() => resourceApi.download(m.resource).catch((err) => toast.error(err.message))} className="flex items-center gap-2.5 text-left">
                          <span className={clsx('grid h-9 w-9 place-items-center rounded-lg', mine ? 'bg-white/20' : 'bg-white dark:bg-ink-700')}>
                            <FileText className="h-4 w-4" />
                          </span>
                          <span>
                            <span className="block font-semibold">{m.resource.title}</span>
                            <span className={clsx('flex items-center gap-1 text-xs', mine ? 'text-white/70' : 'text-ink-500')}>
                              <Download className="h-3 w-3" /> {fmtBytes(m.resource.file?.size)}
                            </span>
                          </span>
                        </button>
                      ) : (
                        <span className="whitespace-pre-wrap break-words">{m.content}</span>
                      )}
                    </div>
                    <span className="mt-0.5 text-[10px] text-ink-400">{fmtTime(m.createdAt)}</span>
                  </div>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      <div className="h-5 px-5 text-xs italic text-ink-400">
        {typingNames.length > 0 && `${typingNames.slice(0, 2).join(', ')}${typingNames.length > 2 ? ' and others' : ''} ${typingNames.length > 1 ? 'are' : 'is'} typing…`}
      </div>
      <form onSubmit={send} className="flex items-end gap-2 border-t border-ink-100 p-3 dark:border-ink-800">
        <textarea
          value={text}
          onChange={onChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) send(e);
          }}
          rows={1}
          maxLength={2000}
          placeholder={connected ? `Message ${group.name}…` : 'Reconnecting… messages will be sent over HTTP'}
          className="textarea max-h-32 min-h-[44px] flex-1 resize-none py-2.5"
          aria-label="Message"
        />
        <button type="submit" disabled={!text.trim() || sending} className="btn btn-primary h-11 w-11 p-0" aria-label="Send message">
          {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
