import React, { useState } from 'react';
import './App.css';

function App() {
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
    window.location.pathname = '/' + roomId;
  }

  return (
    <div className="App">
      <header className="App-header">
        { error !== ""  && 
          <p>{ error }</p>
        }
        <button onClick={createRoom} disabled={fetching}>
          Create a room
        </button>
      </header>
    </div>
  );
}

export default App;
