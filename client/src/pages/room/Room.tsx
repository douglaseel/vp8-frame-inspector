import React, { useRef, useState } from 'react';
import { useParams, useNavigate } from "react-router-dom";

import Meet from './Meet';

function Room() {
  const inputRef = useRef<HTMLInputElement>(null);

  const { roomId } = useParams();
  const navigate = useNavigate();
  const [ username, setUsername ] = useState('');

  if (!roomId) {
    navigate('/');
    return null;
  }

  if (roomId === '' || username.trim() === '') {
    const onClick = () => setUsername(inputRef.current!.value);
    return (
      <div className="Lobby">
        <label>Your name is <input ref={inputRef} type="text" /></label>
        <button onClick={onClick}>
          Join room!
        </button>
      </div>
    )
  }

  return (
    <Meet
      roomId={roomId}
      username={username}
    />
  );
}

export default Room;