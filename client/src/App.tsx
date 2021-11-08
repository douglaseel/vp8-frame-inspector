import React  from 'react';
import Lobby from './pages/lobby/Lobby';
import Room from './pages/room/Room';

function App() {

  const searchParams = new URLSearchParams(window.location.search);
  const roomId = searchParams.get('roomId');
  if (roomId) {
    return (
      <Room id={roomId}/>
    )
  }

  return (
    <Lobby />
  )
}

export default App;
