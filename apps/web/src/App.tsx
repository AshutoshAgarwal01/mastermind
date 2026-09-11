import './App.css'
import { MultiplayerProvider } from './state/MultiplayerContext'
import { useMultiplayer } from './state/useMultiplayer'
import { Home } from './screens/Home'
import { CreateGame } from './screens/CreateGame'
import { JoinGame } from './screens/JoinGame'
import { HowToPlay } from './screens/HowToPlay'
import { SettingsScreen } from './screens/SettingsScreen'
import { Lobby } from './screens/Lobby'
import { RoleVote } from './screens/RoleVote'
import { RoleReveal } from './screens/RoleReveal'
import { SetSecretCode } from './screens/SetSecretCode'
import { MainGame } from './screens/MainGame'
import { GameEnd } from './screens/GameEnd'

function Screens() {
  const { state } = useMultiplayer()
  const room = state.room

  if (!room) {
    switch (state.screen) {
      case 'create':
        return <CreateGame />
      case 'join':
        return <JoinGame />
      case 'how-to':
        return <HowToPlay />
      case 'settings':
        return <SettingsScreen />
      case 'home':
      default:
        return <Home />
    }
  }

  switch (room.status) {
    case 'lobby':
      return <Lobby />
    case 'role-vote':
      return <RoleVote />
    case 'setting-code':
      return state.showRoleReveal ? <RoleReveal /> : <SetSecretCode />
    case 'playing':
      return state.showRoleReveal ? <RoleReveal /> : <MainGame />
    case 'ended':
      return state.showGameReview ? <MainGame /> : <GameEnd />;
    default:
      return <Home />
  }
}

function App() {
  return (
    <MultiplayerProvider>
      <Screens />
    </MultiplayerProvider>
  )
}

export default App
