import React, { useState } from 'react';

function Lobby () {
  const [ fetching, setFetching ] = useState(false);
  const [ error, setError ] = useState("");

  const createRoom = async () : Promise<void> => {
    setFetching(true);
  
    const body = JSON.stringify({ appData: "test"} )
    const res = await fetch('/room', { method: "POST", body });
    if (res.status !== 201) {
      setError(`Request failed with status ${res.status}`);
      setFetching(false);
      return;
    }

    const { roomId } : { roomId: string } = await res.json();
    window.location.search = '?roomId=' + roomId;
  }

  return (
    <div className="App">
      { error !== ""  && 
        <p>{ error }</p>
      }
      <button onClick={createRoom} disabled={fetching}>
        Create a room
      </button>
    </div>
  );
}

export default Lobby;
