import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function Lobby () {
  const [ fetching, setFetching ] = useState(false);
  const [ error, setError ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const createRoom = async () : Promise<void> => {
    setFetching(true);
  
    const roomName = inputRef.current?.value;
    const body = JSON.stringify({ appData: { name: roomName }} )
    const res = await fetch('/api/v1/room', { 
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body 
    });

    if (res.status !== 201) {
      setError(`Request failed with status ${res.status}`);
      setFetching(false);
      return;
    }

    const { roomId } : { roomId: string } = await res.json();
    navigate(`/room/${roomId}`);
  }

  const handleKeyPress = (event: any) => {
    if(event.key === 'Enter'){
      createRoom();
    }
  };

  return (
    <div className="Lobby">
      <h1>VP8 Frame Inspector - SFU demo</h1>
      <label>Room's name: <input ref={inputRef} type="text" onKeyPress={handleKeyPress} /></label>
      <button onClick={createRoom} disabled={fetching}>
        Create a new room
      </button>
      <p className="error">{ error }</p>
    </div>
  );
}

export default Lobby;
