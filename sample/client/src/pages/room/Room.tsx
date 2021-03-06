import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from "react-router-dom";

import Meet from './Meet';

function Room() {
  const inputRef = useRef<HTMLInputElement>(null);

  const { roomId } = useParams();
  const navigate = useNavigate();
  const [ roomName, setRoomName ] = useState<string | null>(null)
  const [ username, setUsername ] = useState('');

  useEffect(() => {
    const fetchAppData = async () => {
      try {
        const res = await fetch(`/api/v1/rooms/${roomId}`);
        if (res.status !== 200) {
          throw new Error('Invalid status code');
        }
        const { appData } = await res.json();
        setRoomName(appData.name);
      } catch (err) {
        navigate('/');
      }
    }
    fetchAppData();
  }, [])

  if (!roomId) {
    navigate('/');
    return null;
  }

  if (!roomName) {
    return (
      <div className="Lobby">
        <h1>Loading...</h1>
      </div>
    );
  }

  if (roomId === '' || username.trim() === '') {
    const handleButton = () => setUsername(inputRef.current!.value);
    const handleKeyPress = (event: any) => {
      if(event.key === 'Enter'){
        handleButton();
      }
    };
    return (
      <div className="Lobby">
        <h1>Welcome to <span className="roomName">{roomName}</span> room!</h1>
        <label>Your name is <input ref={inputRef} type="text" onKeyPress={handleKeyPress}/></label>
        <button onClick={handleButton}>
          Join room!
        </button>
      </div>
    )
  }

  return (
    <Meet
      roomId={roomId}
      roomName={roomName}
      username={username}
    />
  );
}

export default Room;