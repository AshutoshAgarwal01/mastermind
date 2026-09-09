import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  Difficulty,
  ErrorResponse,
  JoinRoomResponse,
  PegColorId,
  PegCount,
  Role,
  RoomStateView,
} from '@mastermind/shared';
import { getSocket } from './socketClient';
import { MultiplayerContext } from './useMultiplayer';
import type { MultiplayerActions, MultiplayerState, Theme, UiScreen } from './useMultiplayer';
import { trackEvent, trackPageView } from './telemetry';

const THEME_KEY = 'mastermind:theme';
const COLORBLIND_KEY = 'mastermind:colorblind';
const SESSION_KEY_PREFIX = 'mastermind:session:';

export function MultiplayerProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<UiScreen>('home');
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem(THEME_KEY) as Theme | null) ?? 'light');
  const [colorBlind, setColorBlind] = useState(() => localStorage.getItem(COLORBLIND_KEY) === 'true');
  const [playerName, setPlayerNameState] = useState('');
  const [room, setRoom] = useState<RoomStateView | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [currentGuess, setCurrentGuess] = useState<(PegColorId | null)[]>([]);
  const [roleVoteChoice, setRoleVoteChoice] = useState<Role | null>(null);
  const [showRoleReveal, setShowRoleReveal] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const roomCodeRef = useRef<string | null>(null);
  const prevRoundRef = useRef<number | null>(null);
  const settingCodeInitRef = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.colorblind = String(colorBlind);
  }, [colorBlind]);

  useEffect(() => {
    const socket = getSocket();
    const onRoomUpdate = (next: RoomStateView) => {
      setRoom((prevRoom) => {
        const prevStatus = prevRoom?.status ?? null;
        const enteringActive =
          (prevStatus === 'lobby' || prevStatus === 'role-vote') &&
          (next.status === 'setting-code' || next.status === 'playing');
        if (enteringActive) {
          setShowRoleReveal(true);
        }
        return next;
      });
      roomCodeRef.current = next.roomCode;
    };
    const onKicked = () => {
      setRoom(null);
      setJoinError('You were removed from the room by the host.');
      setScreen('home');
    };
    socket.on('room_update', onRoomUpdate);
    socket.on('kicked', onKicked);
    return () => {
      socket.off('room_update', onRoomUpdate);
      socket.off('kicked', onKicked);
    };
  }, []);

  // Clear the in-progress draft guess whenever a new round begins.
  useEffect(() => {
    if (room?.status === 'playing' && room.round !== prevRoundRef.current) {
      prevRoundRef.current = room.round;
      setCurrentGuess(new Array(room.settings.pegCount).fill(null));
    }
  }, [room?.status, room?.round, room?.settings.pegCount]);

  // Report the screen the player is actually looking at (in-room status takes over from the
  // pre-room screen state once a room exists).
  useEffect(() => {
    trackPageView(room?.status ? `room:${room.status}` : `pre-room:${screen}`);
  }, [room?.status, screen]);

  // Give the Coder a blank draft to fill in once it's their turn to set the secret code.
  useEffect(() => {
    if (room?.status === 'setting-code') {
      if (!settingCodeInitRef.current) {
        settingCodeInitRef.current = true;
        setCurrentGuess(new Array(room.settings.pegCount).fill(null));
      }
    } else {
      settingCodeInitRef.current = false;
    }
  }, [room?.status, room?.settings.pegCount]);

  const createRoom = useCallback(async (name: string, difficulty: Difficulty, pegCount: PegCount) => {
    setJoinError(null);
    setConnecting(true);
    const socket = getSocket();
    setPlayerNameState(name);
    await new Promise<void>((resolve) => {
      socket.emit('create_room', { name, difficulty, pegCount }, (res: JoinRoomResponse | ErrorResponse) => {
        setConnecting(false);
        if (res.ok) {
          sessionStorage.setItem(SESSION_KEY_PREFIX + res.room.roomCode, res.sessionToken);
          setRoom(res.room);
        } else {
          setJoinError(res.message);
          trackEvent('error.client', { context: 'create_room', message: res.message });
        }
        resolve();
      });
    });
  }, []);

  const joinRoom = useCallback(async (roomCode: string, name: string) => {
    setJoinError(null);
    setConnecting(true);
    const socket = getSocket();
    const code = roomCode.trim().toUpperCase();
    const sessionToken = sessionStorage.getItem(SESSION_KEY_PREFIX + code) ?? undefined;
    setPlayerNameState(name);
    await new Promise<void>((resolve) => {
      socket.emit('join_room', { roomCode: code, name, sessionToken }, (res: JoinRoomResponse | ErrorResponse) => {
        setConnecting(false);
        if (res.ok) {
          sessionStorage.setItem(SESSION_KEY_PREFIX + res.room.roomCode, res.sessionToken);
          setRoom(res.room);
        } else {
          setJoinError(res.message);
          trackEvent('error.client', { context: 'join_room', message: res.message });
        }
        resolve();
      });
    });
  }, []);

  const startGame = useCallback(async () => {
    const socket = getSocket();
    await new Promise<void>((resolve) => {
      socket.emit('start_game', (res) => {
        if (!res.ok) setJoinError(res.message);
        resolve();
      });
    });
  }, []);

  const kickPlayer = useCallback(async (playerId: string) => {
    const socket = getSocket();
    await new Promise<void>((resolve) => {
      socket.emit('kick_player', { playerId }, () => resolve());
    });
  }, []);

  const voteRole = useCallback((role: Role) => {
    setRoleVoteChoice(role);
    getSocket().emit('vote_role', { role });
  }, []);

  const setPeg = useCallback((index: number, color: PegColorId) => {
    setCurrentGuess((prev) => {
      const next = [...prev];
      next[index] = color;
      return next;
    });
  }, []);

  const clearGuess = useCallback(() => {
    setCurrentGuess((prev) => new Array(prev.length).fill(null));
  }, []);

  const submitGuess = useCallback(async () => {
    if (currentGuess.some((c) => c === null)) return;
    const socket = getSocket();
    await new Promise<void>((resolve) => {
      socket.emit('submit_guess', { guess: currentGuess as PegColorId[] }, (res) => {
        if (!res.ok) setJoinError(res.message);
        resolve();
      });
    });
  }, [currentGuess]);

  const submitSecretCode = useCallback(async () => {
    if (currentGuess.some((c) => c === null)) return;
    const socket = getSocket();
    await new Promise<void>((resolve) => {
      socket.emit('set_secret_code', { code: currentGuess as PegColorId[] }, (res) => {
        if (!res.ok) setJoinError(res.message);
        resolve();
      });
    });
  }, [currentGuess]);

  const acknowledgeRoleReveal = useCallback(() => {
    setShowRoleReveal(false);
  }, []);

  const playAgain = useCallback(async () => {
    const socket = getSocket();
    await new Promise<void>((resolve) => {
      socket.emit('play_again', (res) => {
        if (!res.ok) setJoinError(res.message);
        resolve();
      });
    });
  }, []);

  const leaveRoom = useCallback(() => {
    getSocket().emit('leave_room');
    if (roomCodeRef.current) sessionStorage.removeItem(SESSION_KEY_PREFIX + roomCodeRef.current);
    setRoom(null);
    setShowRoleReveal(false);
    setRoleVoteChoice(null);
    setScreen('home');
  }, []);

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(THEME_KEY, next);
    setThemeState(next);
  }, []);

  const toggleColorBlind = useCallback(() => {
    setColorBlind((prev) => {
      const next = !prev;
      localStorage.setItem(COLORBLIND_KEY, String(next));
      return next;
    });
  }, []);

  const state: MultiplayerState = {
    screen,
    theme,
    colorBlind,
    playerName,
    room,
    joinError,
    currentGuess,
    roleVoteChoice,
    showRoleReveal,
    connecting,
  };

  const actions: MultiplayerActions = {
    goTo: setScreen,
    setTheme,
    toggleColorBlind,
    setPlayerName: setPlayerNameState,
    createRoom,
    joinRoom,
    startGame,
    kickPlayer,
    voteRole,
    setPeg,
    clearGuess,
    submitGuess,
    submitSecretCode,
    acknowledgeRoleReveal,
    playAgain,
    leaveRoom,
  };

  return <MultiplayerContext.Provider value={{ state, actions }}>{children}</MultiplayerContext.Provider>;
}
