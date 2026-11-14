import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';
import { API_BASE, notificationApi } from '../api';

const SocketContext = createContext(null);

/**
 * Owns the Socket.io connection (opened only while logged in) and the live
 * unread-notification counter. Pages subscribe to events via `useSocketEvent`.
 */
export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState(0);
  const listeners = useRef(new Set());

  const refreshUnread = useCallback(() => {
    notificationApi.unreadCount().then((d) => setUnread(d.count)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return undefined;
    }
    refreshUnread();
    const s = io(API_BASE || undefined, { withCredentials: true, transports: ['websocket', 'polling'] });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('notification:new', (n) => {
      setUnread((c) => c + 1);
      toast(n.title, { icon: '🔔', id: n._id });
      listeners.current.forEach((fn) => fn(n));
    });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user?._id, refreshUnread]); // eslint-disable-line react-hooks/exhaustive-deps

  const onNotification = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected, unread, setUnread, refreshUnread, onNotification }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);

/** Subscribe to a socket event for the lifetime of a component. */
export function useSocketEvent(event, handler) {
  const { socket } = useSocket();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return undefined;
    const fn = (...args) => ref.current(...args);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event]);
}
